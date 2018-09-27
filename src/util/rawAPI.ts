'use strict';

//import * as vscode from 'vscode';
import * as path from "path";

import log = require('loglevel');
import request = require('request');
import xml2js = require('xml2js');

import { NodeType } from "./dataTypes";
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
            for(var key in keys)
                queryString += keys[key] + '=' + params[keys[key]];
        }

        let proxyString = null;
        if(this.m_proxySettings !== null) {
            // split the proxy ip addr after the dbl-slash
            let n = this.m_proxySettings.proxyIpAddr.indexOf('://');
            let preamble = this.m_proxySettings.proxyIpAddr.substring(0, n+3);
            let postamble = this.m_proxySettings.proxyIpAddr.substring(n+3);

            proxyString = preamble + this.m_proxySettings.proxyUserName + ':' +
                            this.m_proxySettings.proxyPassword + '@' +
                            postamble + ':' +
                            this.m_proxySettings.proxtPort;
        }

        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
            proxy: proxyString,
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
                if(err)
                    reject(err);
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
          this.getRequest("/api/5.0/getapplist.do", null).then( (rawXML) => {
                resolve(this.handleAppList(rawXML));
            });
        }); 
    }

    // parse the app list from raw XML into an array of BuildNodes
    private handleAppList(rawXML: string): BuildNode[] {
        log.debug("handling app List: " + rawXML);

        let appArray = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.applist.app.forEach( (entry) => {
                let a = new BuildNode(NodeType.Application, entry.$.app_name, entry.$.app_id);

                log.debug("App: [" + a.toString() + "]");
                appArray.push( a );
            });
        });

        return appArray;
    }

     // get the build list for an app via API call
     getBuildList(appID: string, count: number): Thenable<BuildNode[]> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/getbuildlist.do", {"app_id": appID}).then( (rawXML) => {
                resolve(this.handleBuildList(rawXML, count));
            });
        }); 
    }

    // parse the build list from raw XML into an array of BuildNodes
    private handleBuildList(rawXML: string, count: number): BuildNode[] {
        log.debug("handling build List: " + rawXML);

        let buildArray = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.buildlist.build.forEach( (entry) => {
                let b = new BuildNode(NodeType.Scan, entry.$.version, entry.$.build_id);

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
     getBuildInfo(buildID: string): Thenable<FlawInfo[]> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/detailedreport.do", {"build_id": buildID}).then( (rawXML) => {
                resolve(this.handleDetailedReport(rawXML));
            });
        }); 
    }

    // parse the detailed report and extract the flaws
    private handleDetailedReport(rawXML: string): FlawInfo[] {
        log.debug("handling build Info: " + rawXML.substring(0,256));   // trim for logging

        let flawArray = [];

        xml2js.parseString(rawXML, (err, result) => {

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
                                        cwe.$.cwename,
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
        });

        return flawArray;
    }

}