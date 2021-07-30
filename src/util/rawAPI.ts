'use strict';

import * as vscode from 'vscode';

import log = require('loglevel');
import request = require('request');
import xml2js = require('xml2js');

import { NodeType, BuildNode,FlawInfo, TreeGroupingHierarchy } from "../models/dataTypes";
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
     getBuildInfo(node: BuildNode, groupBy: TreeGroupingHierarchy): Thenable<BuildNode[]> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/detailedreport.do", {"build_id": node.id}).then( (rawXML) => {
                resolve(this.handleDetailedReport(rawXML, groupBy));
            });
        }); 
    }

    // parse the detailed report and extract the flaws
    private handleDetailedReport(rawXML: string, groupBy: TreeGroupingHierarchy): BuildNode[] {
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

            if(groupBy === TreeGroupingHierarchy.CWE) {
                categoryArray = this.getCWEs(result);
            }
            else if(groupBy === TreeGroupingHierarchy.FlawCategory) {
                // TODO - implement flaw Category
            //     categoryArray = this.getFiles(result);
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

                let n = new BuildNode(NodeType.FlawCategory, this.mapSeverityNumToName(sev.$.level), 
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
                        let n = new BuildNode(NodeType.FlawCategory, 'CWE-' + cwe.$.cweid + ', ' + catName, `CWE${cwe.$.cweid}`, result.detailedreport.$.build_id);

                        categoryArray.push(n);
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
        if(node.type === NodeType.CWE) {

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
                    '[Flaw ID] ' + flaw.issueid,
                    flaw.issueid,
                    nodeParent,'SANDBOX_GUID','APP_GUID',true /* effecting policy */);// , buildID,flaw.mitigation_status);

            flawArray.push(n);

            // Store the flaw data for later use when selected by the user
            //let parts = flaw.sourcefilepath.split('/');
            //let parent = parts[parts.length - 2];
    
            let f = new FlawInfo(flaw.issueid, 
                flaw.sourcefile,   // glob does not like '\'
                flaw.line,
                flaw.severity,
                '[CWE-' + cwe.cweid + '] ' + cwe.cwename,
                flaw.description,
                buildID);
            f.mitigated = flaw.mitigation_status;
            f.mitigationStatus = flaw.mitigation_status_desc;
            log.info("Flaw: [" + f.toString() + "]");
            let fd :any= {};
            fd = this.m_flawCache[buildID];         // dict, indexed by flawID
            fd[flaw.issueid] = f;
            vscode.commands.executeCommand("veracodeStaticExplorer.getFlawInfo",flaw.issueid,buildID);
        }
    }

    getFlawInfo(flawID: string, buildID: string): FlawInfo {
        log.debug('getFlawInfo');

        // this is a nested dict of dicts
        let fd = this.m_flawCache[buildID];             // dict of dicts
        return fd[flawID];
    }

}