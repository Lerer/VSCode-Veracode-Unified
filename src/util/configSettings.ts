'use strict';

import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import log = require('loglevel');

import { ProxySettings } from './proxyHandler';


export class ConfigSettings {

    m_veracodeConfigSettings: any;

    constructor(private m_context: vscode.ExtensionContext) { }

    loadSettings() {
        // this will always work, since the contribution point is set in package.json
        this.m_veracodeConfigSettings = vscode.workspace.getConfiguration("veracode");
    }
    
    saveSettings() { }

    getCredentialProfile(): string {
        this.loadSettings();

        let profile:string = this.m_veracodeConfigSettings.get("API profile in configuration file");
        if (!profile || profile.length===0) {
            console.log('profile setting: '+profile);
            profile = 'default';
        }

        return profile;
    }

    getCredsFile(): string {

            this.loadSettings();

            let filename: string;

            // get() will return the default value from package.json - 'null' if nothing is actually set
            filename = this.m_veracodeConfigSettings.get("credsFile");
            if( !filename || filename == "")
            {
                // default to $HOME/.veracode/credentials
                filename = os.homedir + path.sep + ".veracode" + path.sep + "credentials";
            }

            return filename;
    }

    getCredentialsProfile(): string {
        this.loadSettings();

        let profile:string;

        // get() will return the default value from package.json - 'null' if nothing is actually set
        profile = this.m_veracodeConfigSettings.get("securityProfile");
        if( !profile || profile == "")
        {
            // default to $HOME/.veracode/credentials
            profile = "default";
        }

        return profile;
    }

    getScanCount(): number {
        // this needs to be here to pick up when the user changes the settings
        this.loadSettings();

        return this.m_veracodeConfigSettings.get("scanCount");
    }

    getSandboxCount(): number {
        // this needs to be here to pick up when the user changes the settings
        this.loadSettings();

        return this.m_veracodeConfigSettings.get("sandboxCount");

    }

    getLogLevel(): log.LogLevelDesc {
            this.loadSettings();

            let level: string;
            // get() will return the default value from package.json - 'info' if nothing is actually set
            level = this.m_veracodeConfigSettings.get("logLevel");
            
            // default to 'info' (redundant due to default setting in package.json)
            if( !level || level == "null"){
                level = "info";
            }

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
    }

    getProxySettings(): ProxySettings|null {

        this.loadSettings();

        let addr = this.m_veracodeConfigSettings.get('proxyHost');

        // if the addr is null, assume no proxy settings
        if(addr === '')
            return null;

        // else, get the rest of the settings
        let port = this.m_veracodeConfigSettings.get('proxyPort');
        let name = this.m_veracodeConfigSettings.get('proxyName');
        let pw = this.m_veracodeConfigSettings.get('proxyPassword');

        var proxySettings = new ProxySettings(addr, port, name, pw);
        log.debug('Proxy Settings: ' + proxySettings.toString());
        return proxySettings;
    }
}