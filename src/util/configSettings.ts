'use strict';

import * as vscode from "vscode";
import * as fs from "fs";
import { isNullOrUndefined } from "util";

/* save to config
    - creds filepath
    - # of apps to refresh list (default to 10 if nothing in config file)

*/

export class ConfigSettings {

    m_context: any = null;
    m_veracodeConfigSettings: any;

    constructor(context) {
        this.m_context = context;
    }

    loadSettings() {

        // this will always work, since the contribution point is set in package.json
        if(!(this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode")) )
            throw new Error("No veracode section found in User's config file");
    }
    
    saveSettings() {

    }

    getCredsFile(): string {

        //this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode");

        try {
            // this needs to be here to pick up when the user changes the settings
            this.loadSettings();

            let filename: string;
            // get() will return the default value from package.json - 'null' if nothing is actually set
            filename = this.m_veracodeConfigSettings.get("credsFile");
            if( !filename || filename == "null")
                throw new Error("No credentials file specified in User's config file");

            return filename;
        }
        finally {}  // either catch or finally is required
    }

    getRefreshCount(): number {
        
        return 10;
    }
}