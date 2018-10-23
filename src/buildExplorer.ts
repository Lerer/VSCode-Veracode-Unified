'use strict';

import * as vscode from 'vscode';
import * as path from "path";
import log = require('loglevel');
import glob = require('glob');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { ProxyHandler } from "./util/proxyHandler";
import { RawAPI } from "./util/rawAPI";
import { NodeType, FlawInfo } from "./util/dataTypes";
import { BuildNode } from "./util/dataTypes";
import { isUndefined } from 'util';


export class BuildModel {

    //m_credsFile: string;
    //m_credsHandler: CredsHandler = null;
    m_apiHandler: RawAPI;
	//private nodes: Map<string, BuildNode> = new Map<string, BuildNode>();

	constructor(private m_configSettings: ConfigSettings) {

        // get the creds
        try {
            //let credsFile = this.m_configSettings.getCredsFile();
            let credsHandler = new CredsHandler(this.m_configSettings);
			//credsHandler.loadCredsFromFile(credsFile);

			let proxyHandler = new ProxyHandler(this.m_configSettings);
			this.m_apiHandler = new RawAPI(credsHandler, proxyHandler);

        } catch(e) {
            log.error(e.message);
            vscode.window.showErrorMessage(e.message);
        }
	}

    // roots are going to be the Apps
	public get roots(): Thenable<BuildNode[]> {
		return this.m_apiHandler.getAppList();	
	}

	// will be the scans and sandboxes
	public getChildren(node: BuildNode): Thenable<BuildNode[]> {
		let sandboxCount = this.m_configSettings.getSandboxCount();
		let scanCount = this.m_configSettings.getScanCount();

		// hold sandboxes (if any) in a temp array
		//let sandboxPromise = this.m_apiHandler.getSandboxList(node.id, sandboxCount);

		// append the scans to the temp array with the sandboxes
		//let buildPromise = this.m_apiHandler.getBuildList(node.id, scanCount);

		//let finalPromise = Promise.all([sandboxPromise, buildPromise]);
		//return finalPromise;

		return this.m_apiHandler.getAppChildren(node.id, sandboxCount, scanCount);
		
	}
 
	public getBuildInfo(buildID: string): Thenable<FlawInfo[]> {
		return this.m_apiHandler.getBuildInfo(buildID);
	}

	// maybe sort by Sandboxes before builds??
	/*
	private sort(nodes: BuildNode[]): BuildNode[] {
		return nodes.sort((n1, n2) => {
			if (n1.id < n2.id) 
				return -1;
			else
				return 0;
		});
	}
	*/
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
			collapsibleState: (element.type === NodeType.Application || element.type === NodeType.Sandbox) ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
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
	private m_workspaceFiles:string[];	//vscode.TextDocument[];

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

				// file matching constants
				let root = vscode.workspace.workspaceFolders[0].uri.fsPath;
				let options = {cwd: root, nocase: true, ignore: ['target/**', '**/PrecompiledWeb/**'], absolute: true};

				flaws.forEach( (flaw) => {
					// why -1 for range??  Needed, but why?
					var range = new vscode.Range(parseInt(flaw.line, 10)-1, 0, parseInt(flaw.line,10)-1, 0);
					var diag = new vscode.Diagnostic(range, 
								'FlawID: ' + flaw.id + ' (' + flaw.cweDesc + ')',
								this.mapSeverityToVSCodeSeverity(flaw.severity));
					
					/* VSCode's workspace.findFiles() is case-sensative (even on Windows)
					 * so I need to do my own file matching
					 */
					
					 // note on the glob library - need to convert Windows '\' to '/'
					 // (the backslash will look like an esacpe char)
					glob('**/' + flaw.file, options, (err, matches) => {
						if(err)
							log.debug('Glob file match error ' + err.message);
						else {
							log.debug('Glob file match ' + matches);

							// take the first, log info if thre are multiple matches
							if(matches.length > 1) {
								log.info("Multiple matches found for source file " + flaw.file +
									": " + matches);
							}

							let uri = vscode.Uri.file(matches[0]);

							diag.relatedInformation = [new vscode.DiagnosticRelatedInformation(
								new vscode.Location(uri, range), flaw.desc)];

							// can't add to diag arrays for a URI, need to (re-)set instead?!?
							diagArray = this.m_diagCollection.get(uri);
							if( isUndefined(diagArray) )
							{
								diagArray = [];
								diagArray.push(diag);
							
								this.m_diagCollection.set(uri, diagArray);
							}
							else {
								this.m_diagCollection.set(uri, [].concat(diagArray, diag));
							}
						}

					});
				});
			}
		);
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

}
