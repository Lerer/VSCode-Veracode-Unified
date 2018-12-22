'use strict';

import * as vscode from 'vscode';
import log = require('loglevel');
import glob = require('glob');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { ProxyHandler } from "./util/proxyHandler";
import { RawAPI } from "./util/rawAPI";
import { BuildNode, NodeType, FlawInfo, NodeSubtype } from "./util/dataTypes";
import { isUndefined } from 'util';


export class BuildModel {

    m_apiHandler: RawAPI;

	constructor(private m_configSettings: ConfigSettings) {

		let credsHandler = new CredsHandler(this.m_configSettings);
		let proxyHandler = new ProxyHandler(this.m_configSettings);
		this.m_apiHandler = new RawAPI(credsHandler, proxyHandler);
	}

    // roots are going to be the Apps
	public get roots(): Thenable<BuildNode[]> {
		return this.m_apiHandler.getAppList();	
	}

	// will be the scans, sandboxes, flaw categories and flaws
	public getChildren(node: BuildNode): Thenable<BuildNode[]> | BuildNode[] {

		// get either app children --> sandboxes and scans
		if(node.type === NodeType.Application || node.type === NodeType.Sandbox) {

			let sandboxCount = this.m_configSettings.getSandboxCount();
			let scanCount = this.m_configSettings.getScanCount();
	
			// if App or Sandbox, get scans
			return this.m_apiHandler.getAppChildren(node, sandboxCount, scanCount);
		}
		else if(node.type === NodeType.Scan) {
			// else if scan, get flaw categories - default to severity
			return this.m_apiHandler.getBuildInfo(node, NodeSubtype.Severity);
		}
		else {	// node type == flaw category
			// get the flaws for this category
			return this.m_apiHandler.getFlaws(node);
		}
	}
 
	// TODO: cleaner - give the API handler to the BuildExplorer class??
	getFlawInfo(flawID: string): FlawInfo {
		return this.m_apiHandler.getFlawInfo(flawID);
	}
}


export class BuildTreeDataProvider implements vscode.TreeDataProvider<BuildNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private readonly m_buildModel: BuildModel) { }

    // a bit sloppy in that it always refreshes from the root...??
	public refresh(): any {
        this._onDidChangeTreeData.fire();
	}

	public getTreeItem(element: BuildNode): vscode.TreeItem {
		return {
			label: element.name,
			collapsibleState: element.type === NodeType.Flaw ? void 0: vscode.TreeItemCollapsibleState.Collapsed,
			command: element.type === NodeType.Flaw ? {
				command: 'veracodeExplorer.getFlawInfo',
				arguments: [element.id],
				title: 'Get Flaw Info'
			} : null
		};
	}

    /*   TODO: cleanup
     * called with element == undefined for the root(s) - aka Apps
     * called again for each app to get the sandboxes and/or builds
	 * called again for each sandbox to get the builds
     */
	public getChildren(element?: BuildNode): BuildNode[] | Thenable <BuildNode[]> {
		return element ? this.m_buildModel.getChildren(element) : this.m_buildModel.roots;
	}

	/*
	// optional method, only required for certain cases
	public getParent(element: BuildNode): BuildNode {
		
		//const parent = element.resource.with({ path: dirname(element.resource.path) });
        //return parent.path !== '//' ? { resource: parent, isDirectory: true } : null;
        log.debug("Tree Item - getParent");

        return null;
	}
	*/
}

/*
 * Handles the build/scan explorer in the VSCode Explorer
 */
export class BuildExplorer {

	private m_buildViewer: vscode.TreeView<BuildNode>;
	private m_buildModel: BuildModel;
	private m_diagCollection: vscode.DiagnosticCollection;

	constructor(private m_context: vscode.ExtensionContext, private m_configSettings: ConfigSettings) {

		this.m_buildModel = new BuildModel(this.m_configSettings);
        const treeDataProvider = new BuildTreeDataProvider(this.m_buildModel);

        // link the TreeDataProvider to the Veracode Explorer view
		this.m_buildViewer = vscode.window.createTreeView('veracodeExplorer', { treeDataProvider });

		// link the 'Refresh' command to a method
        let disposable = vscode.commands.registerCommand('veracodeExplorer.refresh', () => treeDataProvider.refresh());
        m_context.subscriptions.push(disposable);

		// create the 'getFlawInfo' command - called when the user clicks on a flaw
		disposable = vscode.commands.registerCommand('veracodeExplorer.getFlawInfo', (flawID) => this.getFlawInfo(flawID));
		m_context.subscriptions.push(disposable);

		// Flaw sorting commands
		disposable = vscode.commands.registerCommand('veracodeExplorer.sortSeverity', () => this.setFlawSort(NodeSubtype.Severity));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeExplorer.sortCwe', () => this.setFlawSort(NodeSubtype.CWE));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeExplorer.sortFile', () => this.setFlawSort(NodeSubtype.File));
		m_context.subscriptions.push(disposable);		

		this.m_diagCollection = vscode.languages.createDiagnosticCollection("Veracode");
		this.m_context.subscriptions.push(this.m_diagCollection);
    }

	// get the info for a flaw and display it in the Problems view
	private getFlawInfo(flawID: string) {
		this.m_diagCollection.clear();
		var diagArray = [];

		// file matching constants
		let root = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let options = {cwd: root, nocase: true, ignore: ['target/**', '**/PrecompiledWeb/**'], absolute: true};

		let flaw = this.m_buildModel.getFlawInfo(flawID);

		// why -1 for range??  Needed, but why?
		var range = new vscode.Range(parseInt(flaw.line, 10)-1, 0, parseInt(flaw.line,10)-1, 0);
		var diag = new vscode.Diagnostic(range, 
					'FlawID: ' + flaw.id + ' (' + flaw.cweDesc + ')',
					this.mapSeverityToVSCodeSeverity(flaw.severity));
		
		/* 
		* VSCode's workspace.findFiles() is case-sensative (even on Windows)
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
    }

	private setFlawSort(sort:NodeSubtype) {
		log.debug('Flaw sort :' + sort);
	}

	// VScode only supports 4 levels of Diagnostics (and we'll use only 3), while Veracode has 6
	private mapSeverityToVSCodeSeverity(sev: string): vscode.DiagnosticSeverity {
		switch(sev) {
			case '5':													// Veracode Very-High
			case '4': return vscode.DiagnosticSeverity.Error;			// Veracode High
			case '3': return vscode.DiagnosticSeverity.Warning;			// Veracode Medium
			default: return vscode.DiagnosticSeverity.Information;
			// ignore VSCode's 'Hints'
		}
	}
}
