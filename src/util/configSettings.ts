'use strict';

import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import log = require('loglevel');

//import * as fs from "fs";
//import { isNullOrUndefined } from "util";


export class ConfigSettings {

    m_veracodeConfigSettings: any;

    constructor(private m_context: vscode.ExtensionContext) { }

    loadSettings() {
        // this will always work, since the contribution point is set in package.json
        /*if(!(*/this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode"); // ) )
            //throw new Error("No veracode section found in User's config file");
    }
    
    saveSettings() { }

    getCredsFile(): string {
        //try {
            // this needs to be here to pick up when the user changes the settings
            this.loadSettings();

            let filename: string;

            // get() will return the default value from package.json - 'null' if nothing is actually set
            filename = this.m_veracodeConfigSettings.get("credsFile");
            if( !filename || filename == "null")
            {
                //throw new Error("No credentials file specified in User's config file");
                // default to $HOME/.veracode/credentials
                filename = os.homedir + path.sep + ".veracode" + path.sep + "credentials";
            }

            return filename;
        //}
        //finally {}  // either catch or finally is required
    }

    getRefreshCount(): number {
        return 10;
    }

    getLogLevel(): log.LogLevelDesc {
        //try {
            // this needs to be here to pick up when the user changes the settings
            this.loadSettings();

            let level: string;
            // get() will return the default value from package.json - 'info' if nothing is actually set
            level = this.m_veracodeConfigSettings.get("logLevel");
            
            // default to 'info' (redundant due to default setting in package.json)
            if( !level || level == "null")
            level = "info";

            // map string in config file to log level type
            let realLevel: log.LogLevelDesc;

            switch(level) {
                case 'trace': {
                    realLevel = log.levels.TRACE;
                    break;
                }
                case 'debug': {
                    realLevel = log.levels.DEBUG;
                    break;
                }
                case 'info': {
                    realLevel = log.levels.INFO;
                    break;
                }
                case 'warning': {
                    realLevel = log.levels.WARN;
                    break;
                }
                case 'error': {
                    realLevel = log.levels.ERROR;
                    break;
                }
                case 'silent': {
                    realLevel = log.levels.SILENT;
                    break;
                }
                default: {
                    // default to 'info' if nothing is specified
                    level = 'info';
                    realLevel = log.levels.INFO;
                }
            }

            console.log("Log level set to: " + level);
            return realLevel;
        //}
        //finally {}  // either catch or finally is required
    }
}