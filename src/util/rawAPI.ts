'use strict';

import * as vscode from 'vscode';

import { NodeType } from "./dataTypes";
import { BuildNode } from "./dataTypes";

import log = require('loglevel');
import request = require('request');
//import rp = require('request-promise');

import veracodehmac = require('./veracode-hmac');
import convert = require('xml-js');


import { CredsHandler } from "../util/credsHandler";

// deliberately don't interact with the 'context' here - save that for the calling classes

export class RawAPI {

    m_credsHandler: CredsHandler = null;
    m_refresh: any;
    m_userAgent: string = 'veracode-vscode-plugin';
    m_protocol: string = 'https://';
    m_host: string = 'analysiscenter.veracode.com';

    constructor(credsHandler: CredsHandler) {
        this.m_credsHandler = credsHandler;
    }

    // TODO: better return type??
    private setHeader(endpoint: string): any {
        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
            headers: {
                'User-Agent': this.m_userAgent,
                'Authorization': veracodehmac.calculateAuthorizationHeader(
                                    this.m_credsHandler.getApiId(), 
                                    this.m_credsHandler.getApiKey(), 
                                    this.m_host, endpoint,
                                    '',
                                    'GET')
            },
            json: false
            // simple = true                    // for promises, all codes except 2xx are errors
            // resolveWithFullResponse = false  // for promises, return only the body when resolved
        };

        return options;
    }

    private getRequest(endpoint: string) {

        // set up options for the request call
        var options = {
            url: this.m_protocol + this.m_host + endpoint,
            headers: {
                'User-Agent': this.m_userAgent,
                'Authorization': veracodehmac.calculateAuthorizationHeader(
                                    this.m_credsHandler.getApiId(), 
                                    this.m_credsHandler.getApiKey(), 
                                    this.m_host, endpoint,
                                    '',
                                    'GET')
            },
            json: false
        };
       
        return new Promise(function(resolve, reject) {
            request(options, function(err, res, body) {
                if(err)
                    reject(err);
                else if (res.statusCode !== 200) {
                    err = new Error("Unexpected status code: " + res.statusCode);
                    err.res = res;
                    reject(err);
                }

                // return the body of the response
                resolve(body);
            })
        })

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
    
    // a callback from the request GET call
    handleAppList(rawXML: string) {
        log.debug("handling app List: " + rawXML);

        let result = convert.xml2js(rawXML, {compact:false});
        let numApps = result.elements[0].elements.length;

        let appArray = [];

        //console.log("converted: " + result);

        result.elements[0].elements.forEach(function(entry) {
            log.debug("name: " + entry.attributes.app_name + " id: " + entry.attributes.app_id);
            let b = new BuildNode(NodeType.Application, entry.attributes.app_name, entry.attributes.app_id);
            appArray.push( b );
            //appMap.set(entry.attributes.app_name, entry.attributes.app_id);
        });

        return appArray;
        
    }

    getAppList(): Thenable<BuildNode[]> {

        //this.getRequest("/api/5.0/getapplist.do").then(this.handleAppList(body));

        var options = this.setHeader("/api/5.0/getapplist.do");
      
        return new Promise( (resolve, reject) => {
            request(options, (error, response, body) => {
                if(error) reject(error);
                if(response.statusCode != 200) {
                    reject('Invalid status code: ' + response.statusCode);
                }
                var appList = this.handleAppList(body);
                resolve(appList);
            });
        });
  
    }

}