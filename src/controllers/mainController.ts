'use strict';

import * as vscode from "vscode";
import { isUndefined, isNullOrUndefined } from "util";

//const vscode = require("vscode");

export class MainController {

    // class properties
    m_context: any;
    m_credsFile: string;

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
    }

    setCredsFile() {
        console.log("setting creds file");

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
}
