'use strict';

import { ConfigParser } from "./configparser/configparser";

import log = require('loglevel');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class CredsHandler {

    credHolder:ConfigParser ; 

    constructor(private credFile:string,private credProfile:string) {
        this.credHolder = new ConfigParser();
    }

    async loadCredsFromFile () {

        log.info("reading creds from file: " + this.credFile);
        log.info("Will be looking for profile: " + this.credProfile);

        try {
            this.credHolder = new ConfigParser();
            await this.credHolder.readAsync(this.credFile);
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
        return this.credHolder.get(this.credProfile,"veracode_api_key_id");
    }

    getApiKey(): string|undefined {
        return this.credHolder.get(this.credProfile,"veracode_api_key_secret");
    }

}