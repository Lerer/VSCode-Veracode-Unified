'use strict';

import * as vscode from 'vscode';
import * as path from "path";
import log = require('loglevel');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { RawAPI } from "./util/rawAPI";
import { NodeType, FlawInfo } from "./util/dataTypes";
import { BuildNode } from "./util/dataTypes";
import { isUndefined } from 'util';


export class BuildModel {

    m_credsFile: string;
    m_credsHandler: CredsHandler = null;
    m_apiHandler: RawAPI;
	//private nodes: Map<string, BuildNode> = new Map<string, BuildNode>();

	constructor(private m_configSettings: ConfigSettings) {

        // get the creds
        try {
            this.m_credsFile = this.m_configSettings.getCredsFile();
            this.m_credsHandler = new CredsHandler();
			this.m_credsHandler.loadCredsFromFile(this.m_credsFile);

			this.m_apiHandler = new RawAPI(this.m_credsHandler);

        } catch(e) {
            log.error(e.message);
            vscode.window.showErrorMessage(e.message);
        }
	}

    // roots are going to be the Apps
	public get roots(): Thenable<BuildNode[]> {
		return this.m_apiHandler.getAppList();	
	}

	// will be the scans (or sandboxes later)
	public getChildren(node: BuildNode): Thenable<BuildNode[]> {
		return this.m_apiHandler.getBuildList(node.id);
	}
 
	public getBuildInfo(buildID: string): Thenable<FlawInfo[]> {
		return this.m_apiHandler.getBuildInfo(buildID);
	}

    /*
    // maybe sort by Sandboxes before builds??
	private sort(nodes: FtpNode[]): FtpNode[] {
		return nodes.sort((n1, n2) => {
			if (n1.isDirectory && !n2.isDirectory) {
				return -1;
			}

			if (!n1.isDirectory && n2.isDirectory) {
				return 1;
			}

			return basename(n1.resource.fsPath).localeCompare(basename(n2.resource.fsPath));
		});
	} */

}



export class BuildTreeDataProvider implements vscode.TreeDataProvider<BuildNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private readonly m_model: BuildModel) { }

    // a bit sloppy in that it always refreshes from the root...??
	public refresh(): any {
        this._onDidChangeTreeData.fire();
	}

	public getTreeItem(element: BuildNode): vscode.TreeItem {
		return {
			label: element.name,
			collapsibleState: element.type === NodeType.Application ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
			command: element.type === NodeType.Application ? {
				command: 'veracodeExplorer.getAppBuilds',
				arguments: [element.id],
				title: 'Get App Builds'
			} : {
				command: 'veracodeExplorer.getBuildResults',
				arguments: [element.id],
				title: 'Get Build Results'
			}
		};
	}

    /* 
     * called with element == undefined for the root(s) - aka Apps
     * called again for each app to get the builds
     */
	public getChildren(element?: BuildNode): BuildNode[] | Thenable <BuildNode[]> {
		return element ? this.m_model.getChildren(element) : this.m_model.roots;
	}

	public getParent(element: BuildNode): BuildNode {
		//const parent = element.resource.with({ path: dirname(element.resource.path) });
        //return parent.path !== '//' ? { resource: parent, isDirectory: true } : null;
        log.debug("Tree Item - getParent");

        // need to store the parent ID (app ID or Sandbox ID)??

        return null;
	}

    //public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    //    return null; //this.model.getContent(uri).then(content => content);
	//}
}

/*
 * Handles the build/scan explorer in the VSCode Explorer
 */
export class BuildExplorer {

	private m_buildViewer: vscode.TreeView<BuildNode>;
	private m_buildModel: BuildModel;
	//private m_treeDataProvider: any;
	private m_diagCollection: vscode.DiagnosticCollection;
	//private m_diagArray: vscode.Diagnostic[];

	constructor(private m_context: vscode.ExtensionContext, private m_configSettings: ConfigSettings) {

		this.m_buildModel = new BuildModel(this.m_configSettings);
        const treeDataProvider = new BuildTreeDataProvider(this.m_buildModel);
		//context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('veracode', treeDataProvider));

        // first param must match the view name from package.json
		this.m_buildViewer = vscode.window.createTreeView('veracodeExplorer', { treeDataProvider });

        let disposable = vscode.commands.registerCommand('veracodeExplorer.refresh', () => treeDataProvider.refresh());
        m_context.subscriptions.push(disposable);

        disposable = vscode.commands.registerCommand('veracodeExplorer.getAppBuilds', (appID) => this.getBuildsForApp(appID));
		m_context.subscriptions.push(disposable);
		
		disposable = vscode.commands.registerCommand('veracodeExplorer.getBuildResults', (buildID) => this.getBuildResults(buildID));
		m_context.subscriptions.push(disposable);
		
		this.m_diagCollection = vscode.languages.createDiagnosticCollection("Veracode");
		this.m_context.subscriptions.push(this.m_diagCollection);
    }

    private getBuildsForApp(appID: string) {
        log.debug("getBuildsForApp: " + appID);
	}
	
	private getBuildResults(buildID: string) {
		this.m_buildModel.getBuildInfo(buildID)
			.then( (flaws) => {
				var diagArray = [];
				// Diag collection?  handle re-loading of flaws??

				flaws.forEach( (flaw) => {
					// why -1 for range??  Needed, but why?
					var range = new vscode.Range(parseInt(flaw.line, 10)-1, 0, parseInt(flaw.line,10)-1, 0);
					var diag = new vscode.Diagnostic(range, 
								'FlawID: ' + flaw.id + ' (' + flaw.cweDesc + ')',
								this.mapSeverityToVSCodeSeverity(flaw.severity));
					
								// really fussy on path - can't handle dual path-seps as a single one
								vscode.workspace.findFiles('**' + path.sep + flaw.file, '', 1)
									.then( (uri) => {
										diag.relatedInformation = [new vscode.DiagnosticRelatedInformation(
											new vscode.Location(uri[0], range), flaw.desc)];

										// can't add to diag arrays for a URI, need to set instead?!?
										diagArray = this.m_diagCollection.get(uri[0]);
										if( isUndefined(diagArray) )
										{
											diagArray = [];
											diagArray.push(diag);
										
											this.m_diagCollection.set(uri[0], diagArray);
										}
										else {
											this.m_diagCollection.set(uri[0], [].concat(diagArray, diag));
										}
									});
					//diag.relatedInformation = [new vscode.DiagnosticRelatedInformation(
					//			new vscode.Location(vscode.Uri.file(flaw.file), range), flaw.cweDesc)];

					
				});

				// TODO: better answer here - project root path??
				//var uri = vscode.workspace.workspaceFolders[0].uri;

				//this.m_diagCollection.set(uri, diagArray);
			});
    }

	// VScode only supports 4 levels of Diagnostics (and we'll use only 3), while Veracode has 6
	private mapSeverityToVSCodeSeverity(sev: string): vscode.DiagnosticSeverity {
		switch(sev) {
			case '5':
			case '4': return vscode.DiagnosticSeverity.Error;
			case '3': return vscode.DiagnosticSeverity.Warning;
			default: return vscode.DiagnosticSeverity.Information;
			// ignore VSCode's 'Hints'
		}
	}

    /*
    private reveal(): Thenable<void> {
		const node = this.getNode();
		if (node) {
			return this.ftpViewer.reveal(node);
		}
		return null;
	}

	private getNode(): FtpNode {
		if (vscode.window.activeTextEditor) {
			if (vscode.window.activeTextEditor.document.uri.scheme === 'ftp') {
				return { resource: vscode.window.activeTextEditor.document.uri, isDirectory: false };
			}
		}
		return null;
    } */
}
