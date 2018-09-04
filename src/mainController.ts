'use strict';

import * as vscode from "vscode";
//import log = require('loglevel');

//import { isNullOrUndefined } from "util";       // TODO: marked as depreacated, find alternative
//import { CredsHandler } from "./util/credsHandler";
import { ConfigSettings } from "./util/configSettings";
import { BuildExplorer } from "./buildExplorer";


// TODO: is this mainController really necessary??


export class MainController {

    // class properties
    //m_configSettings: ConfigSettings;
    //m_credsFile: string;
    //m_credsHandler: CredsHandler;
    m_buildExplorer: BuildExplorer;

    // @constructor
    constructor(private m_context: vscode.ExtensionContext,
                private m_configSettings: ConfigSettings) { }

    /*
    registerCommand(command) {
        this.m_context.subscriptions.push(vscode.commands.registerCommand(command, () => {
            this.m_event.emit(command);
        }))
    }
    */

    activate() {
        // register the VScode commands
        //let disposable = vscode.commands.registerCommand("veracodeExplorer.setCredsFile", this.setCredsFile, this);
        //this.m_context.subscriptions.push(disposable);

        //load config settings
        //this.m_configSettings = new ConfigSettings(this.m_context);

        // create the Build Explorer that will handle browsing the Veracode apps and scans
        this.m_buildExplorer = new BuildExplorer(this.m_context, this.m_configSettings);
    }

    deactivate() {
        // placeholder
    }
    
    /*
    setCredsFile() {
        console.log("setting creds file");

        // TODO: file picker dialog - hidden files on Mac might cause problems...??

        let options: vscode.InputBoxOptions = {
            prompt: "Creds file path: ",
            placeHolder: isNullOrUndefined(this.m_credsFile) ? "<enter filepath>" : this.m_credsFile
        };

        vscode.window.showInputBox(options).then(value => {
            if(!value) return;

            log.info("creds file: " + value);
            this.m_credsFile = value;
        });

        // save the creds file in the config settings

    }
    */

}
