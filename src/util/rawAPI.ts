'use strict';

import * as vscode from 'vscode';

import log = require('loglevel');
import request = require('request');
import xml2js = require('xml2js');

import { NodeType, NodeSubtype,BuildNode,FlawInfo } from "./dataTypes";
import { CredsHandler } from "./credsHandler";
import { ProxyHandler, ProxySettings } from "./proxyHandler"
import veracodehmac = require('./veracode-hmac');
import { ProjectConfigHandler } from './projectConfigHandler';

// deliberately don't interact with the 'context' here - save that for the calling classes
//      ?? error windows...??

export class RawAPI {

    m_userAgent: string = 'veracode-vscode-plugin';
    m_protocol: string = 'https://';
    m_host: string = 'analysiscenter.veracode.com';
    m_proxySettings: ProxySettings|null = null;
    m_flawReports: any = {};             // dictionary of downloaded reports (JSON format)
    m_flawCache: any = {};               // a dictionary of dictionarys.  Outer key = buildID.  Inner key = flawID.

    constructor(private m_credsHandler: CredsHandler, private m_proxyHandler: ProxyHandler,private m_projectConfigHandler: ProjectConfigHandler) { 
    }

    private getProxyString() {
        let proxyString = null;
        if(this.m_proxySettings !== null) {
            if(this.m_proxySettings.proxyUserName !== '') {
            // split the proxy ip addr after the dbl-slash
            let n = this.m_proxySettings.proxyHost.indexOf('://');
            let preamble = this.m_proxySettings.proxyHost.substring(0, n+3);
            let postamble = this.m_proxySettings.proxyHost.substring(n+3);

            proxyString = preamble + this.m_proxySettings.proxyUserName + ':' +
                            this.m_proxySettings.proxyPassword + '@' +
                            postamble + ':' +
                            this.m_proxySettings.proxyPort;
            } else{
                proxyString = this.m_proxySettings.proxyHost + ':' + this.m_proxySettings.proxyPort
            }
        }
        return proxyString;
    }

    // generic API caller
    private getRequest(endpoint: string, params: any): Thenable<string> {  

        // funky for the Veracode HMAC generation
        let queryString = '';
        if(params !== null && Object.keys(params).length>0) {
            var keys = Object.keys(params);
            queryString = '?';
            let index = 0;
            for(var key in keys)
            {   
                if(index > 0)
                    queryString += '&';
                queryString += keys[key] + '=' + params[keys[key]];
                index++;
            }
        }

        let proxyString = this.getProxyString();

        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
            proxy: proxyString,
            strictSSL: false,       // needed for testing, self-signed cert in Burp proxy
            qs: params,
            headers: {
                'User-Agent': this.m_userAgent,
                'Authorization': veracodehmac.generateHeader(
                                    this.m_credsHandler.getApiId()||'', 
                                    this.m_credsHandler.getApiKey()||'', 
                                    this.m_host, endpoint,
                                    queryString,
                                    'GET')
            },
            json: false
        };
       
        log.info("Calling Veracode with: " + options.url + queryString);
        log.debug("Veracode proxy settings: " + proxyString);

        // request = network access, so return the Promise of data later
        return new Promise( (resolve, reject) => {
            request(options, (err, res, body) => {
                if(err) {
                    reject(err);
                }
                else if (res.statusCode !== 200) {
                    err = new Error("Unexpected status code: " + res.statusCode);
                    err.res = res;
                    reject(err);
                }

                // return the body of the response
                resolve(body);
            });
        });
    }
    

    // get the app list via API call
    async getAppList(): Promise<BuildNode[]> {
        log.debug('getAppList');
        /* (re-)loading the creds and proxy info here should be sufficient to pick up 
         * any changes by the user, as once they get the App List working they should 
         * be good to go and not make more changes
         */

        // (re-)load the creds, in case the user changed them
        try {
            await this.m_credsHandler.loadCredsFromFile();
            await this.m_projectConfigHandler.loadPluginConfigFromFile();
        }
        catch (error) {
            vscode.window.showErrorMessage(error.message);
            return Promise.resolve([]);
        }

        // (re-)load the proxy info, in case the user changed them
        this.m_proxyHandler.loadProxySettings();
        this.m_proxySettings = this.m_proxyHandler.proxySettings;

        return new Promise( (resolve, reject) => {          
          this.getRequest("/api/5.0/getapplist.do", {})
            .then( (rawXML) => {
                resolve(this.handleAppList(rawXML));
            }, (err) => {
                log.error('getAppList ' + err);
            })
        });
    }

    // parse the app list from raw XML into an array of BuildNodes
    private handleAppList(rawXML: string): BuildNode[] {
        log.debug("handling app List: " + rawXML);

        let appArray : BuildNode[] = [];

        xml2js.parseString(rawXML, (err, result) => {
            // do we have the specific application?
            let applicationName: string|undefined = this.m_projectConfigHandler.getApplicationName();
            log.debug('Applicaiton for search: ['+applicationName+']');
            let uniquApplication :boolean= false;
            if (applicationName!==undefined) {
                let neededApp: Array<any> = result.applist.app.filter((entry:any) => {
                    return  (applicationName === entry.$.app_name);
                })
                if (neededApp.length===1) {
                    let a = new BuildNode(NodeType.Application, NodeSubtype.None, neededApp[0].$.app_name, neededApp[0].$.app_id, '0');
                    appArray.push( a );
                    uniquApplication = true;
                }
            }
            if (!uniquApplication){
                result.applist.app.forEach( (entry:any) => {
                    let a = new BuildNode(NodeType.Application, NodeSubtype.None, entry.$.app_name, entry.$.app_id, '0');
                    
                    log.debug("App: [" + a.toString() + "]");
                    appArray.push( a );
                });
            }
        });

        return appArray;
    }

    // get the children of the App (aka sandboxes and scans)
    public getAppChildren(node: BuildNode, sandboxCount: number, scanCount: number): Thenable<BuildNode[]> {
        log.debug('getAppChildren');
        let sandbox:string|undefined = this.m_projectConfigHandler.getSandboxName();
        return new Promise( (resolve, reject) => {

            let sandboxArray:BuildNode[];
            let buildArray:BuildNode[];

            if(node.type === NodeType.Application && (!this.m_projectConfigHandler.isPolicySandbox())) {
                // get sandboxes, but only for Apps (no nested sandboxes)
                this.getSandboxList(node, sandboxCount)
                    .then( (array: BuildNode[]) => {
                        sandboxArray = array;
                        if (array.length===1 && array[0].name==='{SB} ' +sandbox) {
                            // the sandboxes already filtered - no need to add build for policy
                            resolve(sandboxArray);
                        } else {
                            // get builds
                            this.getBuildList(node, scanCount)
                                .then( (buildListArray) => {
                                    buildArray = buildListArray;

                                    resolve(sandboxArray.concat(buildArray));
                                }
                            );
                        }
                    }
                );
            }
            else {
                // else, we're working on a sandbox, so builds only
                resolve(this.getBuildList(node, scanCount));
            }
        });
    }

    // get the sandbox list for an app via API call
    async getSandboxList(app: BuildNode, count: number): Promise<BuildNode[]>{
        log.debug('getSandboxList');
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/getsandboxlist.do", {"app_id": app.id}).then( (rawXML) => {
                resolve(this.handleSandboxList(rawXML, count));
            });
        });
    }

    // parse the sandbox list from raw XML into an array of BuildNodes
    private handleSandboxList(rawXML: string, count: number): BuildNode[] {
        log.debug("handling sandbox List: " + rawXML);

        let nodeArray: BuildNode[] = [];

        xml2js.parseString(rawXML, (err, result) => {

            // check to see if there are any sandboxes
            if(result.sandboxlist.hasOwnProperty("sandbox")) {
                // Check for specific sandbox
                let namedSandbox : string|undefined = this.m_projectConfigHandler.getSandboxName();
                let uniqueSandbox:boolean = false;
                if (namedSandbox!==undefined && !this.m_projectConfigHandler.isPolicySandbox()) {
                    let filteredSandboxes: Array<any> = result.sandboxlist.sandbox.filter((entry:any) => {
                        return (entry.$.sandbox_name===namedSandbox);
                    });
                    if (filteredSandboxes.length===1) {
                        log.debug('found specific named sandbox: '+namedSandbox);
                        let b = new BuildNode(NodeType.Sandbox, NodeSubtype.None, 
                            '{SB} ' + filteredSandboxes[0].$.sandbox_name, filteredSandboxes[0].$.sandbox_id, result.sandboxlist.$.app_id);
    
                        log.debug("Sandbox: [" + b.toString() + "]");
                        nodeArray.push( b );
                        uniqueSandbox = true;
                    }
                }
                if (!uniqueSandbox) {
                    result.sandboxlist.sandbox.forEach( (entry:any) => {
                        let b = new BuildNode(NodeType.Sandbox, NodeSubtype.None, 
                            '{SB} ' + entry.$.sandbox_name, entry.$.sandbox_id, result.sandboxlist.$.app_id);

                        log.debug("Sandbox: [" + b.toString() + "]");
                        nodeArray.push( b );
                    });
                }
            }
        });

        return this.sortHighLow(nodeArray).slice(0,count);
    }

     // get the build list for an app via API call
     getBuildList(node: BuildNode, count: number): Promise<BuildNode[]> {
        log.debug('getBuildList');
        return new Promise( (resolve, reject) => {
            if(node.type === NodeType.Application) {
                this.getRequest("/api/5.0/getbuildlist.do", {"app_id": node.id}).then( (rawXML) => {
                    resolve(this.handleBuildList(rawXML, count));
                });
            }
            else {
                // a sandbox
                this.getRequest("/api/5.0/getbuildlist.do", {"app_id": node.parent, "sandbox_id": node.id}).then( (rawXML) => {
                    resolve(this.handleBuildList(rawXML, count));
                });
            }
        }); 
    }

    // parse the build list from raw XML into an array of BuildNodes
    private handleBuildList(rawXML: string, count: number): BuildNode[] {
        log.debug("handling build List: " + rawXML);

        let buildArray: BuildNode[] = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.buildlist.build.forEach( (entry:any) => {

                // don't include dynamic scans
                if(entry.$.hasOwnProperty('dynamic_scan_type')) {
                    return;
                }

                let b = new BuildNode(NodeType.Scan, NodeSubtype.None, 
                    '{scan} ' + entry.$.version, entry.$.build_id, '0');

                log.debug("Build: [" + b.toString() + "]");
                buildArray.push( b );
            });
        });

        return this.sortHighLow(buildArray).slice(0,count);
    }

    // sort the builds from newest to oldest
    private sortHighLow(nodes: BuildNode[]): BuildNode[] {
		return nodes.sort((n1, n2) => {

            let num1 = +(n1.id);       //sneaky, fast way to convert to a number, vs. parseInt(n1.id, 10);
            let num2 = +(n2.id);       //sneaky, fast way to convert to a number, vs. parseInt(n2.id, 10);

			if (num1 < num2) 
                return 1;
            else if (num1 > num2)
                return -1;
			else
				return 0;
		});
    }
    
    // sort the other way (e.g., for flaws)
    private sortLowHigh(nodes: BuildNode[]): BuildNode[] {
		return nodes.sort((n1, n2) => {

            let num1 = +(n1.id);
            let num2 = +(n2.id);

			if (num1 > num2) 
                return 1;
            else if (num1 < num2)
                return -1;
			else
				return 0;
		});
	}

     // get the build data for a build via API call
     getBuildInfo(node: BuildNode, category: NodeSubtype): Thenable<BuildNode[]> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/detailedreport.do", {"build_id": node.id}).then( (rawXML) => {
                resolve(this.handleDetailedReport(rawXML, category));
            });
        }); 
    }

    // parse the detailed report and extract the flaws
    private handleDetailedReport(rawXML: string, category: NodeSubtype): BuildNode[] {
        log.debug("handling build Info: " + rawXML.substring(0,256));   // trim for logging

        var categoryArray: BuildNode[] = [];

        xml2js.parseString(rawXML, (err, result) => {

            // handle unfinished scans (e.g., scan created, but no files uploaded)
            if(result.hasOwnProperty("error"))
            {
                log.info("No report available - has this scan finished?")
                return categoryArray;
            }
            
            // keep for later processing
            this.m_flawReports[result.detailedreport.$.build_id] = result;
            this.m_flawCache[result.detailedreport.$.build_id] = {};        // create the empty dict of flaws for this build

            /*
            result.detailedreport.severity[1].category[0].cwe[0].staticflaws[0].flaw[0].$.issueid
            "17"
            result.detailedreport.severity[1].category[0].cwe[0].staticflaws[0].flaw[0].$.sourcefilepath
            "com/veracode/verademo/controller/"
            result.detailedreport.severity[1].category[0].cwe[0].staticflaws[0].flaw[0].$.sourcefile
            "UserController.java"
            result.detailedreport.severity[1].category[0].cwe[0].staticflaws[0].flaw[0].$.line
            "96"

            .severity[0-5] = V-high - Info
                .category[n] = cwe category
                    .cwe[n] = cwe id
                        .staticflaws[n] = ??
                            .flaw[n] = individual flaw detail
            */

            if(category === NodeSubtype.CWE) {
                categoryArray = this.getCWEs(result);
            }
            else if(category === NodeSubtype.File) {
                categoryArray = this.getFiles(result);
            }
            else {                                              // default to severities
                categoryArray = this.getSeverities(result);
            }
        });

        return categoryArray;
    }

    // get the list of severities for this scan
    private getSeverities(result: any): BuildNode[] {

        let categoryArray:BuildNode[] = [];

        result.detailedreport.severity.forEach( (sev:any) => {

            // if we don't find flaws of a certain severity, this will be empty
            if(sev.hasOwnProperty("category")) {

                let n = new BuildNode(NodeType.FlawCategory, NodeSubtype.Severity, this.mapSeverityNumToName(sev.$.level), 
                        sev['$'].level, result.detailedreport.$.build_id);

                categoryArray.push(n);
            }
        });
        
        return categoryArray;
    }

    private mapSeverityNumToName(sevNum: string): string {

        let name:string;

        switch (sevNum) {
            case '5':
                name = 'Very High';
                break;
            case '4':
                name = 'High';
                break;            
            case '3':
                name = 'Medium';
                break;         
            case '2':
                name = 'Low';
                break;         
            case '1':
                name = 'Very Low';
                break; 
            case '0':
                name = 'Informational';
                break;               
            default:
                name = 'Unknown';  
        }

        return name;
    }

    // get the list of CWEs reported in this scan
    private getCWEs(result: any): BuildNode[] {

        let categoryArray:BuildNode[] = [];

        result.detailedreport.severity.forEach( (sev:any) => {

            // if we don't find flaws of a certain severity, this will be empty
            if(sev.hasOwnProperty("category")) {
                sev.category.forEach( (cat:any) => {
                    let catName = cat.$.categoryname;

                    cat.cwe.forEach( (cwe:any) => {

                        // get cweid
                        let n = new BuildNode(NodeType.FlawCategory, NodeSubtype.CWE, 
                            'CWE-' + cwe.$.cweid + ', ' + catName, cwe.$.cweid, result.detailedreport.$.build_id);

                        categoryArray.push(n);
                    });
                });            
            }
        });
        
        return categoryArray;
    }

    // get the list of Files with flaws reported in this scan
    private getFiles(result: any): BuildNode[] {

        let categoryArray:BuildNode[] = [];

        result.detailedreport.severity.forEach( (sev:any) => {

            // if we don't find flaws of a certain severity, this will be empty
            if(sev.hasOwnProperty("category")) {
                sev.category.forEach( (cat:any) => {
                    cat.cwe.forEach( (cwe:any) => {
                        cwe.staticflaws.forEach( (staticflaw:any) => {
                            staticflaw.flaw.forEach( (flaw:any) => {

                                // don't add filename if it already exists 
                                if(!categoryArray.find( (elem:BuildNode) => {
                                    return elem.name == flaw.$.sourcefile;}) ) {

                                    let n = new BuildNode(NodeType.FlawCategory, NodeSubtype.File, 
                                        flaw.$.sourcefile, flaw.$.sourcefile, result.detailedreport.$.build_id);
                
                                    categoryArray.push(n);
                                }
                            });
                        });
                    });
                });
            }
        });
        
        return categoryArray;
    }

    private addFlowList (node: BuildNode,flawArray:BuildNode[],cwe:any,staticflaw:any) {
        staticflaw.flaw.forEach( (flaw:any) => {
            this.addFlaw(node.id, flaw.$, cwe.$, flawArray, node.parent);
        });
    }

    // get all the flaws in a specified category
    // TODO: currently this dynamically creates the list each time, maybe statically create this
    getFlaws(node: BuildNode):BuildNode[] {
        log.info('getFlaws');
        let flawArray:BuildNode[] = [];
        let currentReport = this.m_flawReports[node.parent];    // node.parent is the buildID

        log.info(node);

        // incoming BuildNode is a Flaw Category
        if(node.subtype === NodeSubtype.File) {

            currentReport.detailedreport.severity.forEach( (sev:any) => {
                 // if we don't find flaws of a certain severity, this will be empty
                 if(sev.hasOwnProperty("category")) {
                    sev.category.forEach( (cat:any) => {
                        cat.cwe.forEach( (cwe:any) => {
                            cwe.staticflaws.forEach( (staticflaw:any) => {
                                this.addFlowList(node,flawArray,cwe,staticflaw);
                            });
                        });
                    });
                }
            });
        }
        else if(node.subtype === NodeSubtype.CWE) {

            currentReport.detailedreport.severity.forEach( (sev:any) => {

                 // if we don't find flaws of a certain severity, this will be empty
                if(sev.hasOwnProperty("category")) {
                    sev.category.forEach( (cat:any) => {
                        cat.cwe.forEach( (cwe:any) => {
                            if(cwe.$.cweid == node.id) {
                                cwe.staticflaws.forEach( (staticflaw:any) => {
                                    this.addFlowList(node,flawArray,cwe,staticflaw);
                                });
                            }
                        });
                    });
                }
            });
        }
        else {      // default to severity
            // severity[0] = VeryHigh, [1] = High, etc.
            currentReport.detailedreport.severity[5-parseInt(node.id,10)].category.forEach( (cat:any) => {
                cat.cwe.forEach( (cwe:any) => {
                    cwe.staticflaws.forEach( 
                        (staticflaw:any) => {
                            this.addFlowList(node,flawArray,cwe,staticflaw);
                    });
                });
            });
        }

        return this.sortLowHigh(flawArray);
    }

    private addFlaw(nodeParent: string, flaw: any, cwe: any, flawArray:BuildNode[], buildID: string):void {
        // don't import fixed flaws
        //log.warn('flaw remediation status: '+flaw.remediation_status+" mitigation: "+flaw.mitigation_status+" mitigation desc: "+flaw.mitigation_status_desc);
        if(flaw.remediation_status != 'Fixed')
        {
            console.log(flaw);
            // the list of flaws for the explorer bar
            let n = new BuildNode(NodeType.Flaw, 
                    NodeSubtype.None, 
                    '[Flaw ID] ' + flaw.issueid,
                    flaw.issueid,
                    nodeParent, buildID,flaw.mitigation_status);

            flawArray.push(n);

            // TODO: sort array by flaw #?

            // Store the flaw data for later use when selected by the user
            //let parts = flaw.sourcefilepath.split('/');
            //let parent = parts[parts.length - 2];
    
            let f = new FlawInfo(flaw.issueid, 
                flaw.sourcefile,   // glob does not like '\'
                flaw.line,
                flaw.severity,
                '[CWE-' + cwe.cweid + '] ' + cwe.cwename,
                flaw.description,
                buildID,
                flaw.mitigation_status,
                flaw.mitigation_status_desc);

            log.info("Flaw: [" + f.toString() + "]");
            let fd :any= {};
            fd = this.m_flawCache[buildID];         // dict, indexed by flawID
            fd[flaw.issueid] = f;
            vscode.commands.executeCommand("veracodeStaticExplorer.getFlawInfo",flaw.issueid,buildID);
        }
    }

    getFlawInfo(flawID: string, buildID: string): FlawInfo {
        log.debug('getFlawInfo');
        // TODO: check for valid ID - good hygiene, but this is coming from data I create

        // this is a nested dict of dicts
        let fd = this.m_flawCache[buildID];             // dict of dicts
        return fd[flawID];
    }

}