'use strict';

import * as vscode from "vscode";

/* save to config
    - creds filepath
    - # of apps to refresh list

*/

export class ConfigSettings {

    m_context: any = null;
    m_veracodeConfigSettings: any;

    constructor(context) {
        this.m_context = context;
        //this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode");
    }

    loadSettings() {

        if ( !(this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode")) )
            throw new Error("No veracode section found in User's config file");
    }

    saveSettings() {

    }

    getCredsFile(): string {
        try {
            this.loadSettings();

            let filename: string;
            // get() returns undefined when nothing found
            if( !(filename = this.m_veracodeConfigSettings.get("credsFile")) )
                throw new Error("No credentials file specified in User's config file");

            return filename;
        }
        finally {}      // either try or finally is required
    }
}