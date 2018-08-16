'use strict';

import * as vscode from 'vscode';

import request = require('request');
import veracodehmac = require('./veracode-hmac');

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
                console.log("got it");
                //console.log(body);
                // return the raw XML data
                this.handleAppList(body);
			} else {
                console.log("GetAppList failed, code: " + httpResponse.statusCode);
			}
			
        }).bind(this) );
    }

    handleAppList(rawXML: string) {
        console.log("handling app List: " + rawXML);
    }

    getAppList() {
       this.getRequest("/api/5.0/getapplist.do");
    }



}