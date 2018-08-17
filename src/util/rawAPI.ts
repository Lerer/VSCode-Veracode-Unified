'use strict';

import * as vscode from 'vscode';
import log = require('loglevel');
import request = require('request');
import veracodehmac = require('./veracode-hmac');
import convert = require('xml-js');


import { CredsHandler } from "../util/credsHandler";

// deliberately don't interact with the 'context' here - save that for the calling classes

export class RawAPI {

    m_credsHandler: CredsHandler = null;
    m_userAgent: string = 'veracode-vscode-plugin';
    m_protocol: string = 'https://';
    m_host: string = 'analysiscenter.veracode.com';

    constructor(credsHandler: CredsHandler) {
        this.m_credsHandler = credsHandler;
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
        
        // make the call
        
        request.get(options, (function (err, httpResponse, body) {
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
			
        }).bind(this) );
    }

    handleAppList(rawXML: string) {
        log.debug("handling app List: " + rawXML);

        let result = convert.xml2js(rawXML, {compact:false});
        let numApps = result.elements[0].elements.length;

        let appMap = new Map();

        //console.log("converted: " + result);

        result.elements[0].elements.forEach(function(entry) {
            log.debug("name: " + entry.attributes.app_name + " id: " + entry.attributes.app_id);
            appMap.set(entry.attributes.app_name, entry.attributes.app_id);
        });
        
    }

    getAppList() {
       this.getRequest("/api/5.0/getapplist.do");
    }



}