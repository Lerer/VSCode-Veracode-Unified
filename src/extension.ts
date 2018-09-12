'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import log = require('loglevel');

import { MainController } from "./mainController";
let controller:MainController;

import { ConfigSettings } from "./util/configSettings";


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "veracode" is now active!');

    // adjust the logging level for the rest of the plugin
    let configSettings = new ConfigSettings(context);
    let logLevel = configSettings.getLogLevel();
    log.setLevel(logLevel);
    //console.log("Log level set to: " + logLevel);

    // fire up the Main Controller, which does all the work
    controller = new MainController(context, configSettings);
    controller.activate();
}

// this method is called when your extension is deactivated
export function deactivate() {
    controller.deactivate();
}