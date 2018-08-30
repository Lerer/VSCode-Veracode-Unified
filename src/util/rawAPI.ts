'use strict';

//import * as vscode from 'vscode';

import log = require('loglevel');
import request = require('request');
import convert = require('xml-js');

import { NodeType } from "./dataTypes";
import { BuildNode } from "./dataTypes";
import { CredsHandler } from "../util/credsHandler";
import veracodehmac = require('./veracode-hmac');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class RawAPI {

    //m_refresh: any;
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

        /* request.get(options, (function (err, httpResponse, body) {
			if (err) {
				console.log("GetAppList request error");
            } 
            
			if (httpResponse.statusCode === 200) {
                //console.log("got it");
                
                // return the raw XML data, based on the type of XML returned??
                this.handleAppList(body);


			} else {
                log.error("GetAppList failed, code: " + httpResponse.statusCode);
			}
			
        }).bind(this) ); */
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

        let result = convert.xml2js(rawXML, {compact:false});
        let appArray = [];

        result.elements[0].elements.forEach( (entry) => {
            log.debug("name: " + entry.attributes.app_name + " id: " + entry.attributes.app_id);
            let a = new BuildNode(NodeType.Application, entry.attributes.app_name, entry.attributes.app_id);
            appArray.push( a );
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

        let result = convert.xml2js(rawXML, {compact:false});
        let buildArray = [];

        result.elements[0].elements.forEach( (entry) => {
            log.debug("name: " + entry.attributes.version + " id: " + entry.attributes.build_id);
            let b = new BuildNode(NodeType.Scan, entry.attributes.version, entry.attributes.build_id);
            buildArray.push( b );
        });

        return buildArray;
    }

     // get the build data for a build via API call
     getBuildInfo(buildID: string): Thenable<string> {
        return new Promise( (resolve, reject) => {
          this.getRequest("/api/5.0/detailedreport.do", {"build_id": buildID}).then( (rawXML) => {
                resolve(this.handleBuildInfo(rawXML));
            });
        }); 
    }

    // parse(?) the build info
    private handleBuildInfo(rawXML: string): string {
        log.debug("handling build Info: " + rawXML);

        /*
        let result = convert.xml2js(rawXML, {compact:false});
        let buildArray = [];

        result.elements[0].elements.forEach( (entry) => {
            log.debug("name: " + entry.attributes.version + " id: " + entry.attributes.build_id);
            let b = new BuildNode(NodeType.Scan, entry.attributes.version, entry.attributes.build_id);
            buildArray.push( b );
        });
        */
        return rawXML;
    }

}