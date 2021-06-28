'use strict';

import { ConfigSettings } from "./configSettings";
import { ConfigParser } from "./configparser/configparser";

import log = require('loglevel');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class CredsHandler {

    // class properties
    credHolder: ConfigParser;
    profile: string;

    // @constructor
    constructor(private m_configSettings: ConfigSettings) {
        this.credHolder = new ConfigParser();
        this.profile = this.m_configSettings.getCredentialProfile();
    }

    async loadCredsFromFile () {
        // get the creds file
        let credsFile = this.m_configSettings.getCredsFile();

        log.info("reading creds from file: " + credsFile);
        log.info("Will be looking for profile: " + this.profile);

        try {
            this.credHolder = new ConfigParser();
            await this.credHolder.readAsync(credsFile);
        }
        catch (error) {
            // file does not exist, is not readable, etc.
            log.info(error.message);
            throw error;
        }

        // sanity checking
        if(!this.getApiId()||this.getApiId()?.length===0)
            throw new Error("Missing API ID from Veracode credentials file");

        if(!this.getApiKey()||this.getApiKey()?.length===0)
            throw new Error("Missing API Secret Key from Veracode credentials file")
    }

    getApiId(): string|undefined {
        return this.credHolder.get(this.profile,"veracode_api_key_id");
    }

    getApiKey(): string|undefined {
        return this.credHolder.get(this.profile,"veracode_api_key_secret");
    }

}