'use strict';

import { ConfigSettings } from "./configSettings";

import * as fs from "fs";
import log = require('loglevel');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class CredsHandler {

    // class properties
    m_credsMap;

    // @constructor
    constructor(private m_configSettings: ConfigSettings) {
        this.m_credsMap = new Map();
    }

    loadCredsFromFile(): string {
        // get the creds file
        let credsFile = this.m_configSettings.getCredsFile();

        log.info("reading creds from file: " + credsFile);

        let data: string = null;
        try {
            data = fs.readFileSync(credsFile, 'utf8');
            log.debug("File data: " + data);
        }
        catch (error) {
            // file does not exist, is not readable, etc.
            log.info(error.message);
            throw new Error("Veracode credentials file " + credsFile + " not found or is not readable");
        }

        // parse the data from the file
        // string split on CR and/or LF
        let lines = data.split(/\r?\n/);
        
        for(var i = 0; i < lines.length; i++) {
            let pieces = lines[i].split("=");
            if(pieces.length == 2) {
                this.m_credsMap.set(pieces[0].trim(), pieces[1].trim() );
            }
        }

        // sanity checking
        if(!this.m_credsMap.has("veracode_api_key_id"))
            throw new Error("Missing API ID from Veracode credentials file");

        if(!this.m_credsMap.has("veracode_api_key_secret"))
            throw new Error("Missing API Secret Key from Veracode credentials file")

        return null;
    }

    getApiId(): string {
        return this.m_credsMap.get("veracode_api_key_id");
    }

    getApiKey(): string {
        return this.m_credsMap.get("veracode_api_key_secret");
    }

}