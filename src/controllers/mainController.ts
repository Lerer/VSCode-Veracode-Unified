'use strict';

import * as vscode from "vscode";
import { isNullOrUndefined } from "util";       // TODO: marked as depreacated, find alternative
import { CredsHandler } from "../util/credsHandler";

//const vscode = require("vscode");

export class MainController {

    // class properties
    m_context: any;
    m_credsFile: string;
    m_credsHandler: CredsHandler;

    // @constructor
    constructor(context) {
        this.m_context = context;
    }

    /*
    registerCommand(command) {
        this.m_context.subscriptions.push(vscode.commands.registerCommand(command, () => {
            this.m_event.emit(command);
        }))
    }
    */

    deactivate() {
        // placeholder
    }

    activate() {

        // register the VScode commands
        let disposable = vscode.commands.registerCommand("veracodeExplorer.setCredsFile", this.setCredsFile, this);
        this.m_context.subscriptions.push(disposable);

        disposable = vscode.commands.registerCommand("veracodeExplorer.refresh", this.refreshAppList, this);
        this.m_context.subscriptions.push(disposable);
        
    }

    setCredsFile() {
        console.log("setting creds file");

        // TODO: file picker dialog - hidden files on Mac might cause problems...??

        let options: vscode.InputBoxOptions = {
            prompt: "Creds file path: ",
            placeHolder: isNullOrUndefined(this.m_credsFile) ? "<enter filepath>" : this.m_credsFile
        };

        vscode.window.showInputBox(options).then(value => {
            if(!value) return;

            console.log("creds file: " + value);
            this.m_credsFile = value;
        });
    }

    refreshAppList() {
        console.log("refreshing app list");

        // check that we have a file path for the creds file
        if(isNullOrUndefined(this.m_credsFile)) {
            this.setCredsFile();
        }

        // for some silly reason, the user still didn't set the creds file...
        if(isNullOrUndefined(this.m_credsFile)) {
            vscode.window.showErrorMessage("The credentials filepath must be set");
            return;
        }

        // read the creds from the file (util method/class?)
        this.m_credsHandler = new CredsHandler(this.m_credsFile);
        this.m_credsHandler.loadCreds();




        // call the Findings API and get the list of apps
            // and sandboxes

        // show first 10 in list (user config param to expand, 0=unlimited)



    }
}
