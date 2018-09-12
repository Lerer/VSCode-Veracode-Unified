'use strict';

import * as vscode from "vscode";

import { ConfigSettings } from "./util/configSettings";
import { BuildExplorer } from "./buildExplorer";


// TODO: is this mainController really necessary??


export class MainController {

    m_buildExplorer: BuildExplorer;

    // @constructor
    constructor(private m_context: vscode.ExtensionContext,
                private m_configSettings: ConfigSettings) { }

    activate() {

        // create the Build Explorer that will handle browsing the Veracode apps and scans
        this.m_buildExplorer = new BuildExplorer(this.m_context, this.m_configSettings);
    }

    deactivate() {
        // placeholder
    }

}
