'use strict';

import * as fs from "fs";

// deliberately don't interact with the 'context' here - save that for the calling classes

export class CredsHandler {

    // class properties
    //m_context: any;
    m_credsFile: string = null;
    m_apiID: string = null;
    m_apiKey: string = null;

    // @constructor
    constructor(credsFile: string) {
        //this.m_context = context;
        this.m_credsFile = credsFile;
    }

    // return null on success, else an error string
    private readCredsFromFile(): string {

        if(!this.m_credsFile)
            return "Credentials file not set";

        // return error if file not found

        console.log("reading file: " + this.m_credsFile);

        try {
            var data = fs.readFileSync(this.m_credsFile);
            console.log("File data: " + data);
        }
        catch (error) {
            console.log("Error: " + error);
        }


        return null;
    }

    loadCreds(): string {
        // today, only 1 choice
        return this.readCredsFromFile();
    }

    getApiId(): string {
        return this.m_apiID;
    }

    getApiKey(): string {
        return this.m_apiKey;
    }

}