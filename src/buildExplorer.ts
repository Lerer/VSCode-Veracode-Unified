'use strict';

import * as vscode from 'vscode';
import log = require('loglevel');
import glob = require('glob');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { ProjectConfigHandler } from "./util/projectConfigHandler";
import { ProxyHandler } from "./util/proxyHandler";
import { RawAPI } from "./util/rawAPI";
import { BuildNode, NodeType, FlawInfo, NodeSubtype, sortNumToName } from "./util/dataTypes";
import { isUndefined } from 'util';
import {proposeMitigationCommandHandler} from './util/mitigationHandler';
import { MitigationHandler } from './apiWrappers/mitigation-api-wrapper';

const flawDiagnosticsPrefix: string = 'FlawID: ';

export class BuildModel {

	m_apiHandler: RawAPI;
	m_flawSorting: NodeSubtype;

	constructor(private m_configSettings: ConfigSettings) {
		let credsHandler = new CredsHandler(this.m_configSettings);
		let projectConfig = new ProjectConfigHandler();
		let proxyHandler = new ProxyHandler(this.m_configSettings);
		this.m_apiHandler = new RawAPI(credsHandler, proxyHandler,projectConfig);			// TODO: switch to Findings API
		this.m_flawSorting = NodeSubtype.None;
	}

    // roots are going to be the Apps
	public get roots(): Thenable<BuildNode[]> {
		return this.m_apiHandler.getAppList();	
	}

	// will be the scans, sandboxes, flaw categories, and flaws
	public getChildren(node: BuildNode): Thenable<BuildNode[]> | BuildNode[] {
		log.info('getChildren');
		log.debug('getting children of: '+node);
		// get either app children --> sandboxes and scans
		if(node.type === NodeType.Application || node.type === NodeType.Sandbox) {

			let sandboxCount = this.m_configSettings.getSandboxCount();
			let scanCount = this.m_configSettings.getScanCount();
	
			// if App or Sandbox, get scans
			return this.m_apiHandler.getAppChildren(node, sandboxCount, scanCount);
		}
		else if(node.type === NodeType.Scan) {
			// else if scan, get flaw categories - default to severity
			return this.m_apiHandler.getBuildInfo(node, this.m_flawSorting);
		}
		else {	// node type == flaw category
			// get the flaws for this category
			return this.m_apiHandler.getFlaws(node);
		}
	}
 
	public setFlawSorting(sort:NodeSubtype) {
		this.m_flawSorting = sort;
	}

	getFlawInfo(flawID: string, buildID: string): FlawInfo {
		return this.m_apiHandler.getFlawInfo(flawID, buildID);
	}
}


export class BuildTreeDataProvider implements vscode.TreeDataProvider<BuildNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private readonly m_buildModel: BuildModel) { }

    // a bit sloppy in that it always refreshes from the root...??
	public refresh(): any {
        this._onDidChangeTreeData.fire(undefined);
	}

	public getTreeItem(element: BuildNode): vscode.TreeItem {
		let nodeType : NodeType = element.type;
		let command: vscode.Command | undefined = undefined;
		let retItem: vscode.TreeItem = {
			label: element.name,
			collapsibleState: element.type === NodeType.Flaw ? void 0: vscode.TreeItemCollapsibleState.Collapsed,
		}
		if (nodeType===NodeType.Scan || nodeType===NodeType.Application || nodeType===NodeType.Sandbox) {
			command = {
				title: nodeType+ 'selected',
				command: 'veracodeStaticExplorer.diagnosticsRefresh'
			};
			retItem.command = command;
		} else if (nodeType===NodeType.Flaw) {

			command = {
				command: 'veracodeStaticExplorer.getFlawInfo',
				arguments: [element.id, element.optional],
				title: 'Get Flaw Info'
			};
			retItem.command = command;
			retItem.contextValue = 'flaw';
		}
		
		return retItem;
	}

    /*
     * called with element == undefined for the root(s) - aka Apps
     * called again for each app to get the sandboxes and/or builds
	 * called again for each sandbox to get the builds
	 * called again for each build to get the categories
	 * called again to get the flaws in each category
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
	private m_sortBarInfo: vscode.StatusBarItem;
	private m_treeDataProvider: BuildTreeDataProvider;

	constructor(private m_context: vscode.ExtensionContext, private m_configSettings: ConfigSettings) {


		this.m_buildModel = new BuildModel(this.m_configSettings);
		this.m_treeDataProvider = new BuildTreeDataProvider(this.m_buildModel);

        // link the TreeDataProvider to the Veracode Explorer view
		this.m_buildViewer = vscode.window.createTreeView('veracodeStaticExplorer', { treeDataProvider: this.m_treeDataProvider });

		// link the 'Refresh' command to a method
        let disposable = vscode.commands.registerCommand('veracodeStaticExplorer.refresh', () => {
			this.clearFlawsInfo();
			this.m_treeDataProvider.refresh()
		});
        m_context.subscriptions.push(disposable);

		// create the 'getFlawInfo' command - called when the user clicks on a flaw
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.getFlawInfo', (flawID, buildID) => this.getFlawInfo(flawID, buildID));
		m_context.subscriptions.push(disposable);

		// clean the diagnostics data due to a new application, sandbox or scan is selected
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.diagnosticsRefresh', () => this.clearFlawsInfo());
		m_context.subscriptions.push(disposable);

		// Flaw sorting commands
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortSeverity', () => this.setFlawSort(NodeSubtype.Severity));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortCwe', () => this.setFlawSort(NodeSubtype.CWE));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortFile', () => this.setFlawSort(NodeSubtype.File));
		m_context.subscriptions.push(disposable);	
																			// arbitrary number, relative to other items I create?
		this.m_sortBarInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);	
		this.setFlawSort(NodeSubtype.Severity);		// default to sorting flaws by severity
		this.m_sortBarInfo.show();

		// mitigation command
		vscode.commands.registerCommand("veracodeStaticExplorer.proposeMitigation",async (flawBuildNode: BuildNode) => {
			console.log(flawBuildNode);
			const input = await proposeMitigationCommandHandler(flawBuildNode.mitigationStatus);
			if (input) {
				let credsHandler = new CredsHandler(this.m_configSettings);
				const handler = new MitigationHandler(credsHandler,this.m_configSettings.getProxySettings());
				await handler.postMitigationInfo(flawBuildNode.optional,flawBuildNode.id,input.reason,input.comment);
				this.clearFlawsInfo();
				await this.m_treeDataProvider.refresh();
			}
		});

		// TODO: add a command to the status bar to cycle through the flaw sorting types

		this.m_diagCollection = vscode.languages.createDiagnosticCollection("Veracode");
		this.m_context.subscriptions.push(this.m_diagCollection);
	}
	
	/**
	 * This function clear the diagnostics data.
	 * It should be use as a refresh mechanism when switching between scans 
	 */
	private clearFlawsInfo (): void {
		this.m_diagCollection.clear();
	}

	// get the info for a flaw and display it in the Problems view
	private getFlawInfo(flawID: string, buildID: string) {
		log.debug('getFlawInfo');
		var diagArray: Array<vscode.Diagnostic> | undefined = [];

		// file matching constants
		let root: string|undefined = (vscode.workspace!== undefined && vscode.workspace.workspaceFolders !==undefined) ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
		let options = {cwd: root, nocase: true, ignore: ['target/**', '**/PrecompiledWeb/**'], absolute: true,nodir:true};

		let flaw = this.m_buildModel.getFlawInfo(flawID, buildID);

		// why -1 for range??  Needed, but why?
		var range = new vscode.Range(parseInt(flaw.line, 10)-1, 0, parseInt(flaw.line,10)-1, 0);

		let mitigationPrefix :string= '';
		if (flaw.mitigated!=='none') {
			mitigationPrefix = `[${flaw.mitigationStatus}] `;
		}
		var diag = new vscode.Diagnostic(
			range, 
			mitigationPrefix +flawDiagnosticsPrefix + flaw.id + ' (' + flaw.cweDesc + ')',
			this.mapSeverityToVSCodeSeverity(flaw.severity)
		);
		
		/* 
		* VSCode's workspace.findFiles() is case-sensative (even on Windows)
		* so I need to do my own file matching
		*/
							
		// note on the glob library - need to convert Windows '\' to '/'
		// (the backslash will look like an esacpe char)
		log.debug('buildExplorer:getFlawInfo:flaw file: '+flaw.file);
		
		glob('**/' + flaw.file, options, (err, matches) => {
			if(err) {
				log.debug('Glob file match error ' + err.message);
				return;
			}
			
			log.info('Glob file match ' + matches.length);

			// take the first, log info if thre are multiple matches
			if(matches.length > 1) {
				log.info("Multiple matches found for source file " + flaw.file +
					": " + matches);
			}
			log.info(matches);
			let uri = vscode.Uri.file(matches[0]);
			console.log(uri.toString());

			diag.relatedInformation = [new vscode.DiagnosticRelatedInformation(
				new vscode.Location(uri, range), flaw.desc)];

			// can't add to diag arrays for a URI, need to (re-)set instead?!?
			//diagArray = Array.clone(this.m_diagCollection.get(uri));
			diagArray = Object.assign([], this.m_diagCollection.get(uri));
			if( diagArray===undefined )
			{
				diagArray = [];
				diagArray.push(diag);
			
				this.m_diagCollection.set(uri, diagArray);
			}
			else {
				let newDiagArr:Array<vscode.Diagnostic> = diagArray;
				log.debug(newDiagArr);
				const existing = newDiagArr.filter((existingDiagnostic: vscode.Diagnostic) => {
					return (existingDiagnostic.message.indexOf(flawDiagnosticsPrefix+flaw.id) > -1);
				})
				if (existing.length===0){
					log.debug('issue not showing. adding to set');
					newDiagArr.push(diag);
					this.m_diagCollection.set(uri, newDiagArr);
				} else {
					log.debug('issue already showing');
				}
			}
		
		});
    }

	private setFlawSort(sort:NodeSubtype) {

		let sortName = sortNumToName(sort);

		log.debug('Flaw sort : ' + sortName);
		this.m_buildModel.setFlawSorting(sort);

		this.m_sortBarInfo.text = 'Flaw Sorting: ' + sortName;
		this.m_treeDataProvider.refresh();
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
