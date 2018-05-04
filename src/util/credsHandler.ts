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
    constructor() {
        //this.m_context = context;
        //this.m_credsFile = credsFile;
    }

    // return null on success, else an error string
    private readCredsFromFile(): string {

        if(!this.m_credsFile)
            throw new Error("Credentials file not set");

        console.log("reading file: " + this.m_credsFile);

        let data: string = null;
        try {
            data = fs.readFileSync(this.m_credsFile, 'utf8');
            console.log("File data: " + data);
        }
        catch (error) {
            // file does not exist, is not readable, etc.
            console.log(error.message);
            throw new Error("Creds file, " + this.m_credsFile + ", not found, or is not readable");
        }

        // parse the data from the file
        // string split on CR and/or LF
        let lines = data.split(/\r?\n/);
        //let map = {};
        let credsMap = new Map();
        for(var i = 0; i < lines.length; i++) {
            let pieces = lines[i].split("=");
            if(pieces.length == 2) {
                credsMap.set(pieces[0].trim(), pieces[1].trim() );
            }
        }

        return null;
    }

    loadCredsFromFile(credsFile: string): string {
        // today, only 1 choice
        this.m_credsFile = credsFile;
        return this.readCredsFromFile();
    }

    getApiId(): string {
        return this.m_apiID;
    }

    getApiKey(): string {
        return this.m_apiKey;
    }

}