'use strict';

import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import log = require('loglevel');

import { ProxySettings } from './proxyHandler';
import { pipeline_output_display_style } from "../reports/pipelineScanJsonHandler";

const PIPELINE_SCAN_RESULTS_FILENAME = 'pipelineScanResultsFilename';
const PIPELINE_SCAN_RESULTS_OUTPUT_STYLE = 'pipelineScanResultsDisplayStyle';
const PIPELINE_SCAN_RESULTS_DEFAULT_OUTPUT_STYLE = 'simple';


export class ConfigSettings {

    veracodeExtensionConfigSettings: any;

    constructor(private m_context: vscode.ExtensionContext) { }

    loadSettings() {
        // this will always work, since the contribution point is set in package.json
        this.veracodeExtensionConfigSettings = vscode.workspace.getConfiguration("veracode");
    }
    
    getNewConfigParam(paramName: string) : string | undefined {
        this.loadSettings();
        return this.veracodeExtensionConfigSettings.get(paramName); 
    }

    getCredsProfile(): string {
        this.loadSettings();

        let profile:string = this.veracodeExtensionConfigSettings.get("API profile in credentials configuration file");
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
            filename = this.veracodeExtensionConfigSettings.get("credsFile");
            if( !filename || filename == "")
            {
                // default to $HOME/.veracode/credentials
                filename = os.homedir + path.sep + ".veracode" + path.sep + "credentials";
            }

            return filename;
    }

    getSandboxCount(): number {
        // this needs to be here to pick up when the user changes the settings
        this.loadSettings();

        return this.veracodeExtensionConfigSettings.get("sandboxCount");

    }

    getLogLevel(): log.LogLevelDesc {
            this.loadSettings();

            let level: string;
            // get() will return the default value from package.json - 'info' if nothing is actually set
            level = this.veracodeExtensionConfigSettings.get("logLevel");
            
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

    getFlawsLoadCount(): number {
        this.loadSettings();

        return this.veracodeExtensionConfigSettings.get('flawsCount');
    }

    getProxySettings(): ProxySettings|null {

        this.loadSettings();

        let addr = this.veracodeExtensionConfigSettings.get('proxyHost');

        // if the addr is null, assume no proxy settings
        if(addr === '')
            return null;

        // else, get the rest of the settings
        let port = this.veracodeExtensionConfigSettings.get('proxyPort');
        let name = this.veracodeExtensionConfigSettings.get('proxyName');
        let pw = this.veracodeExtensionConfigSettings.get('proxyPassword');

        var proxySettings = new ProxySettings(addr, port, name, pw);
        log.debug('Proxy Settings: ' + proxySettings.toString());
        return proxySettings;
    }

    getPipelineResultFilename(): string|undefined {
        return this.getNewConfigParam(PIPELINE_SCAN_RESULTS_FILENAME);
    }  
    
    getPipelineResultOutputStyle(): pipeline_output_display_style {
        return this.getNewConfigParam(PIPELINE_SCAN_RESULTS_OUTPUT_STYLE) as pipeline_output_display_style || PIPELINE_SCAN_RESULTS_DEFAULT_OUTPUT_STYLE;
    }
}