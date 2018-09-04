'use strict';

//import * as vscode from 'vscode';
import * as path from "path";

import log = require('loglevel');
import request = require('request');
import xml2js = require('xml2js');

import { NodeType } from "./dataTypes";
import { BuildNode } from "./dataTypes";
import { FlawInfo } from "./dataTypes";
import { CredsHandler } from "../util/credsHandler";
import veracodehmac = require('./veracode-hmac');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class RawAPI {

    m_userAgent: string = 'veracode-vscode-plugin';
    m_protocol: string = 'https://';
    m_host: string = 'analysiscenter.veracode.com';

    constructor(private m_credsHandler: CredsHandler) { }

    // generic API caller
    private getRequest(endpoint: string, params: object): Thenable<string> {

        // funky for the Veracode HMAC generation
        let queryString = '';
        if(params !== null) {
            var keys = Object.keys(params);
            queryString = '?';
            for(var key in keys)
                queryString += keys[key] + '=' + params[keys[key]];
        }

        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
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
     getBuildList(appID: string): Thenable<BuildNode[]> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/getbuildlist.do", {"app_id": appID}).then( (rawXML) => {
                resolve(this.handleBuildList(rawXML));
            });
        }); 
    }

    // parse the build list from raw XML into an array of BuildNodes
    private handleBuildList(rawXML: string): BuildNode[] {
        log.debug("handling build List: " + rawXML);

        let buildArray = [];

        xml2js.parseString(rawXML, (err, result) => {
            result.buildlist.build.forEach( (entry) => {
                let b = new BuildNode(NodeType.Scan, entry.$.version, entry.$.build_id);

                log.debug("Build: [" + b.toString() + "]");
                buildArray.push( b );
            });
        });

        return buildArray;
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

                                    let f = new FlawInfo(flaw.$.issueid, 
                                        flaw.$.sourcefilepath + path.sep + flaw.$.sourcefile,
                                        flaw.$.line,
                                        flaw.$.severity,
                                        cwe.$.cwename);

                                    log.debug("Flaw: [" + f.toString() + "]");
                                    flawArray.push( f );
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