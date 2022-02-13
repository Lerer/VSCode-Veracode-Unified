'use strict';

import { ConfigParser } from "./configparser/configparser";
import * as vscode from 'vscode';

import {sep} from "path";
import log = require('loglevel');

// deliberately don't interact with the 'context' here - save that for the calling classes

export class ProjectConfigHandler {

    // class properties
    configHolder: ConfigParser;
    section: string = 'import';
    policySandbox: string = '__policy';
    application: string | undefined;
    sandbox: string | undefined;
    importMitigations: boolean = true;
    apiSecuritySection = 'api.security';

    // @constructor
    constructor() {
        this.configHolder = new ConfigParser();
    }

    async loadProjectConfigFromFile () {

        let root: string|undefined = (vscode.workspace!== undefined && vscode.workspace.workspaceFolders !==undefined) ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
        if (root===undefined) {
            log.info('No open project');
            return;
        }
        let pluginConfFilePath = root + sep + 'veracode-plugin.conf';
        log.info("Will be looking for profile: " + pluginConfFilePath);

        try {
            this.configHolder = new ConfigParser();
            await this.configHolder.readAsync(pluginConfFilePath);
        }
        catch (error) {
            // file does not exist, is not readable, etc.
            if (error instanceof Error) {
                log.info(error.message);
            }
            return;
        }

    }

    getApplicationName(): string|undefined {
        return this.configHolder.get(this.section,"application");
    }

    getSandboxName(): string|undefined {
        return this.configHolder.get(this.section,"sandbox");
    }

    isPolicySandbox(): boolean {
        let sandbox = this.getSandboxName();
        return (sandbox!==undefined && sandbox===this.policySandbox)
    }

    isIncludeMitigations(): boolean {
        let conf: string|undefined = this.configHolder.get(this.section,"include_mitigations");
        if (conf===undefined){
            return true;
        }
        return conf=='true';
    }

    getAPISpecName(): string|undefined {
        return this.configHolder.get(this.apiSecuritySection,"specName");
    } 
    
    getAPISpecPath(): string|undefined {
        return this.configHolder.get(this.apiSecuritySection,"specPath");
    } 
    
    getAPIBaseURL(): string|undefined {
        return this.configHolder.get(this.apiSecuritySection,"baseURL");
    }

}