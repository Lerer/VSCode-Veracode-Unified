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

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    /*let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });
    context.subscriptions.push(disposable);
    */

    /*
    let disposable = vscode.commands.registerCommand('veracodeExplorer.sayHello', () => {
        vscode.window.showInformationMessage('Hello Veracode!');
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('veracodeExplorer.cmd1', () => {
        vscode.window.showInformationMessage('Veracode cmd1');
    });
    context.subscriptions.push(disposable);
    
    disposable = vscode.commands.registerCommand('veracodeExplorer.cmd2', () => {
        vscode.window.showInformationMessage('Veracode cmd2');
    });
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('veracodeExplorer.cmd3', () => {
        vscode.window.showInformationMessage('Veracode cmd3');
    });
    context.subscriptions.push(disposable);
    */
   
    controller = new MainController(context);
    controller.activate();
}

// this method is called when your extension is deactivated
export function deactivate() {
    controller.deactivate();
}