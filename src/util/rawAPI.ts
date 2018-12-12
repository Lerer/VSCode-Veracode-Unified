'use strict';

//import * as vscode from 'vscode';

import log = require('loglevel');
import request = require('request');
import xml2js = require('xml2js');

import { NodeType, NodeSubtype } from "./dataTypes";
import { BuildNode } from "./dataTypes";
import { FlawInfo } from "./dataTypes";
import { CredsHandler } from "./credsHandler";
import { ProxyHandler, ProxySettings } from "./proxyHandler"
import veracodehmac = require('./veracode-hmac');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class RawAPI {

    m_userAgent: string = 'veracode-vscode-plugin';
    m_protocol: string = 'https://';
    m_host: string = 'analysiscenter.veracode.com';
    m_proxySettings: ProxySettings = null;
    m_currentReport: any;

    constructor(private m_credsHandler: CredsHandler, private m_proxyHandler: ProxyHandler) { 
    }

    // generic API caller
    private getRequest(endpoint: string, params: object): Thenable<string> {

        // reload, in case the user changed the data
        //this.m_proxySettings = this.m_proxyHandler.proxySettings;    

        // funky for the Veracode HMAC generation
        let queryString = '';
        if(params !== null) {
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
            }
            else{
                proxyString = this.m_proxySettings.proxyHost + ':' + this.m_proxySettings.proxyPort
            }
        }

        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
            proxy: proxyString,
            strictSSL: false,       // needed for testing, self-signed cert in Burp proxy
            qs: params,
            headers: {
                'User-Agent': this.m_userAgent,
                'Authorization': veracodehmac.calculateAuthorizationHeader(
                                    this.m_credsHandler.getApiId(), 
                                    this.m_credsHandler.getApiKey(), 
                                    this.m_host, endpoint,
                                    queryString,
                                    'GET')
            },
            json: false
        };
       
        log.info("Calling Veracode with: " + options.url + queryString);
        log.info("Veracode proxy settings: " + proxyString);

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
    getAppList(): Thenable<BuildNode[]> {

        /* (re-)loading the creds and proxy info here should be sufficient to pick up 
         * any changes by the user, as once they get the App List working they should 
         * be good to go and not make more changes
         */

        // (re-)load the creds, in case the user changed them
        this.m_credsHandler.loadCredsFromFile();

        // (re-)load the proxy info, in case the user changed them
        this.m_proxyHandler.loadProxySettings();
        this.m_proxySettings = this.m_proxyHandler.proxySettings;

        return new Promise( (resolve, reject) => {          
          this.getRequest("/api/5.0/getapplist.do", null)
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

        let appArray = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.applist.app.forEach( (entry) => {
                let a = new BuildNode(NodeType.Application, NodeSubtype.None, entry.$.app_name, entry.$.app_id, '0');

                log.debug("App: [" + a.toString() + "]");
                appArray.push( a );
            });
        });

        return appArray;
    }

    // get the children of the App (aka sandboxes and scans)
    public getAppChildren(node: BuildNode, sandboxCount: number, scanCount: number): Thenable<BuildNode[]> {

        return new Promise( (resolve, reject) => {

            let sandboxArray:BuildNode[];
            let buildArray:BuildNode[];

            if(node.type === NodeType.Application) {
                // get sandboxes, but only for Apps (no nested sandboxes)
                this.getSandboxList(node, sandboxCount)
                    .then( (array) => {
                        sandboxArray = array;
                    
                        // get builds
                        this.getBuildList(node, scanCount)
                            .then( (array) => {
                                buildArray = array;

                                resolve(sandboxArray.concat(buildArray));
                            });
                    });
            }
            else {
                // else, we're working on a sandbox, so builds only
                resolve(this.getBuildList(node, scanCount));
            }
        });
    }

    // get the sandbox list for an app via API call
    getSandboxList(app: BuildNode, count: number): Thenable<BuildNode[]>{
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/getsandboxlist.do", {"app_id": app.id}).then( (rawXML) => {
                resolve(this.handleSandboxList(rawXML, count));
            });
        });
    }

    // parse the sandbox list from raw XML into an array of BuildNodes
    private handleSandboxList(rawXML: string, count: number): BuildNode[] {
        log.debug("handling sandbox List: " + rawXML);

        let nodeArray = [];

        xml2js.parseString(rawXML, (err, result) => {

            // check to see if there are any sandboxes
            if(result.sandboxlist.hasOwnProperty("sandbox")) {
                result.sandboxlist.sandbox.forEach( (entry) => {
                    let b = new BuildNode(NodeType.Sandbox, NodeSubtype.None, entry.$.sandbox_name, entry.$.sandbox_id, result.sandboxlist.$.app_id);

                    log.debug("Sandbox: [" + b.toString() + "]");
                    nodeArray.push( b );
                });
            }
        });

        return this.sort(nodeArray).slice(0,count);
    }

     // get the build list for an app via API call
     getBuildList(node: BuildNode, count: number): Thenable<BuildNode[]> {
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

        let buildArray = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.buildlist.build.forEach( (entry) => {
                let b = new BuildNode(NodeType.Scan, NodeSubtype.None, entry.$.version, entry.$.build_id, '0');

                log.debug("Build: [" + b.toString() + "]");
                buildArray.push( b );
            });
        });

        return this.sort(buildArray).slice(0,count);
    }

    // sort the builds from newest to oldest
    private sort(nodes: BuildNode[]): BuildNode[] {
		return nodes.sort((n1, n2) => {

            // TODO: better answer than parseInt() every time
            let num1 = parseInt(n1.id, 10);
            let num2 = parseInt(n2.id, 10);

			if (num1 < num2) 
                return 1;
            else if (num1 > num2)
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

        var categoryArray = []; // TODO: move into 'error' check??

        xml2js.parseString(rawXML, (err, result) => {

            // handle unfinished scans (e.g., scan created, but no files uploaded)
            if(result.hasOwnProperty("error"))
            {
                log.info("No report available - has this scan finished?")
                return categoryArray;
            }

            // cache for later processing
            this.m_currentReport = result;


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

            if(category === NodeSubtype.Severity) {
                categoryArray = this.getSeverities(result);     // TODO: use class variable
            }
/*
            result.detailedreport.severity.forEach( (sev) => {

                // if we don't find flaws of a certain severity, this will be empty
                if(sev.hasOwnProperty("category")) {
                    sev.category.forEach( (cat) => {
                        cat.cwe.forEach( (cwe) => {
                            cwe.staticflaws.forEach( (staticflaw) => {
                                staticflaw.flaw.forEach( (flaw) => {

                                    // don't import fixed flaws
                                    if(flaw.$.remediation_status != 'Fixed')
                                    {
                                        let parts = flaw.$.sourcefilepath.split('/');
                                        let parent = parts[parts.length - 2];
                                        //let tpath = path.join(t2, flaw.$.sourcefile);

                                    let f = new FlawInfo(flaw.$.issueid, 
                                        parent + '/' + flaw.$.sourcefile,   // glob does not like '\'
                                        flaw.$.line,
                                        flaw.$.severity,
                                        // cwe.$.cweid,         
                                        cwe.$.cwename,          // 3-word CWE description (category)??
                                        flaw.$.description);

                                    log.debug("Flaw: [" + f.toString() + "]");
                                    flawArray.push( f );
                                    }
                                });
                            });
                        });
                    });
                }
            });
            */
        });

        //return flawArray;
        return categoryArray;
    }

    private getSeverities(result: any): BuildNode[] {

        let categoryArray = [];

        result.detailedreport.severity.forEach( (sev) => {

            // if we don't find flaws of a certain severity, this will be empty
            if(sev.hasOwnProperty("category")) {

                let n = new BuildNode(NodeType.FlawCategory, NodeSubtype.Severity, this.mapSeverityNumToName(sev.$.level), 
                        sev.$.level, result.detailedreport.$.build_id);

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

    getFlaws(node: BuildNode):BuildNode[] {

        let flawArray = [];

        // incoming BuildNode is a Flaw Category
        if(node.subtype === NodeSubtype.Severity) {

            // severity[0] = VeryHigh, [1] = High, etc.
            this.m_currentReport.detailedreport.severity[5-parseInt(node.id,10)].category.forEach( (cat) => {
                cat.cwe.forEach( (cwe) => {
                    cwe.staticflaws.forEach( (staticflaw) => {
                        staticflaw.flaw.forEach( (flaw) => {

                            // don't import fixed flaws
                            if(flaw.$.remediation_status != 'Fixed')
                            {
                                let parts = flaw.$.sourcefilepath.split('/');
                                let parent = parts[parts.length - 2];
                                //let tpath = path.join(t2, flaw.$.sourcefile);

                                let f = new BuildNode(NodeType.Flaw, 
                                        NodeSubtype.None, 
                                        '[Flaw ID] ' + flaw.$.issueid,
                                        flaw.$.issueid,
                                        node.id);

                                flawArray.push(f);

                                // TODO: sort array by flaw #

                                
                                /*
                                let f = new FlawInfo(flaw.$.issueid, 
                                    parent + '/' + flaw.$.sourcefile,   // glob does not like '\'
                                    flaw.$.line,
                                    flaw.$.severity,
                                    // cwe.$.cweid,         
                                    cwe.$.cwename,          // 3-word CWE description (category)??
                                    flaw.$.description);

                                log.debug("Flaw: [" + f.toString() + "]");
                                flawArray.push( f );
                                */
                            }
                        });
                    });
                });
            });
        }

        return flawArray;
    }

}