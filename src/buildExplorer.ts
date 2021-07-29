'use strict';

import * as vscode from 'vscode';
import log = require('loglevel');
import glob = require('glob');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { ProjectConfigHandler } from "./util/projectConfigHandler";
import { ProxyHandler } from "./util/proxyHandler";
import { RawAPI } from "./util/rawAPI";
import { BuildNode, NodeType, FlawInfo, TreeGroupingHierarchy } from "./models/dataTypes";
import {proposeMitigationCommandHandler} from './util/mitigationHandler';
import { postAnnotation } from './apiWrappers/mitigationAPIWrapper';
import {getAppList,getAppChildren} from './apiWrappers/applicationsAPIWrapper';
import { VeracodeServiceAndData } from './veracodeServiceAndData';
import { getNested } from './util/jsonUtil';

const flawDiagnosticsPrefix: string = 'FlawID: ';

export class VeracodeExtensionModel {

	m_apiHandler: RawAPI;
	m_flawSorting: TreeGroupingHierarchy;
	credsHandler: CredsHandler;
	projectConfig: ProjectConfigHandler;
	veracodeService: VeracodeServiceAndData;
	private extensionDiagCollection: vscode.DiagnosticCollection;

	constructor(private m_configSettings: ConfigSettings) {
		this.credsHandler = new CredsHandler(this.m_configSettings.getCredsFile(),this.m_configSettings.getCredsProfile());
		this.projectConfig = new ProjectConfigHandler();
		let proxyHandler = new ProxyHandler(this.m_configSettings);
		this.m_apiHandler = new RawAPI(this.credsHandler, proxyHandler,this.projectConfig);	
		this.m_flawSorting = TreeGroupingHierarchy.Severity;
		this.veracodeService = new VeracodeServiceAndData();
		this.extensionDiagCollection = vscode.languages.createDiagnosticCollection('Veracode');
	}

    // roots are going to be the Apps
	public get roots(): Thenable<BuildNode[]> {
		let proxyHandler = new ProxyHandler(this.m_configSettings);
		proxyHandler.loadProxySettings();
		return getAppList(this.credsHandler,proxyHandler.proxySettings,this.projectConfig);
	}

	// will be the scans, sandboxes, flaw categories, and flaws
	public async getChildren(node: BuildNode): Promise<BuildNode[]> {
		log.debug('getting children of: '+node);

		let proxyHandler = new ProxyHandler(this.m_configSettings);
		proxyHandler.loadProxySettings();
		// get either app children --> sandboxes and scans
		switch (node.type) {
			case (NodeType.Application):  // || node.type === NodeType.Sandbox) {
				let sandboxCount = this.m_configSettings.getSandboxCount();
				// if App or Sandbox, get scans
				return getAppChildren(node, this.credsHandler,proxyHandler.proxySettings,this.projectConfig,sandboxCount);
			// Handle the result of a specific context		
			case (NodeType.Sandbox):
			case (NodeType.Policy):
				const sandboxNodes = await this.veracodeService.getSandboxNextLevel(node,this.credsHandler,proxyHandler.proxySettings,this.m_configSettings);
				this.addDiagnosticsForSandbox(node.id);
				return sandboxNodes;
			case (NodeType.Severity):
				return this.veracodeService.getFlawsOfSeverityNode(node);
			case (NodeType.Scan):
				// else if scan, get flaw categories - default to severity
				return this.m_apiHandler.getBuildInfo(node, this.m_flawSorting);
			default: 
				// node type == flaw category
				// get the flaws for this category
				return this.m_apiHandler.getFlaws(node);
		}
	}
 
	public setFlawSorting(sort:TreeGroupingHierarchy) {
		this.veracodeService.sortFindings(sort);
	}

	getFlawInfo(flawID: string, buildID: string): FlawInfo {
		return this.m_apiHandler.getFlawInfo(flawID, buildID);
	}

	public clearFlawsInfo (): void {
		this.extensionDiagCollection.clear();
		this.veracodeService.clearCache();
	}

	private addDiagnosticsForSandbox(sandboxNodeId:string) {
		const findings = this.veracodeService.getRawCacheData(sandboxNodeId);
		console.log(findings);
		console.log('got Raw scan data for scan');
		findings.forEach((rawFlaw: any) => {
			const findingDetails = getNested(rawFlaw,'finding_details');
			const findingStatus = getNested(rawFlaw,'finding_status');
			console.log(findingDetails);
			this.addDiagnosticItem(rawFlaw.issue_id+'',findingDetails,rawFlaw.description,findingStatus);

		});
	}

	private addDiagnosticItem(flawId:string,findingDetails:any,flawDesc:string,findingStatus:any){
		const vscodeFileName = this.findFilePath(findingDetails.file_name);
		console.log(`back from file finding ${vscodeFileName}`);
		if (vscodeFileName) {

			const flawSeverity = findingDetails.severity;
			const flawCategory = findingDetails.finding_category.name;
			const flawLineNumber = findingDetails.file_line_number;

			const mitigationStatus = findingStatus.resolution;
			const mitigationReviewStatus = findingStatus.mitigation_review_status;

			var diagArray: Array<vscode.Diagnostic> = [];
			var range = new vscode.Range(flawLineNumber-1, 0, flawLineNumber-1, 0);

			let mitigationPrefix :string= '';
			if (mitigationStatus!=='none') {
				mitigationPrefix = `[${mitigationReviewStatus}] `;
			}
			var diag = new vscode.Diagnostic(
				range, 
				mitigationPrefix +flawDiagnosticsPrefix + flawId + ' (' + flawCategory + ')',
				this.mapSeverityToVSCodeSeverity(flawSeverity)
			);
			
			let uri = vscode.Uri.file(vscodeFileName);
			console.log(uri.toString());

			diag.relatedInformation = [new vscode.DiagnosticRelatedInformation(
				new vscode.Location(uri, range), flawDesc)];

			// can't add to diag arrays for a URI, need to (re-)set instead?!?
			//diagArray = Array.clone(this.m_diagCollection.get(uri));
			diagArray = Object.assign([], this.extensionDiagCollection.get(uri));
			if( diagArray===undefined )
			{
				diagArray = [];
				diagArray.push(diag);
			
				this.extensionDiagCollection.set(uri, diagArray);
			}
			else {
				let newDiagArr:Array<vscode.Diagnostic> = diagArray;
				log.debug(newDiagArr);
				const existing = newDiagArr.filter((existingDiagnostic: vscode.Diagnostic) => {
					return (existingDiagnostic.message.indexOf(flawDiagnosticsPrefix+flawId) > -1);
				})
				if (existing.length===0){
					log.debug('issue not showing. adding to set');
					newDiagArr.push(diag);
					this.extensionDiagCollection.set(uri, newDiagArr);
				} else {
					log.debug('issue already showing');
				}
			}
		
		}
    }

	private findFilePath(fileName:string|undefined): string | undefined {
		if (!fileName) {
			log.warn('No file name provided for search');
			return;
		}
		// file matching constants
		let root: string|undefined = (vscode.workspace!== undefined && vscode.workspace.workspaceFolders !==undefined) ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
		let options: glob.IOptions = {cwd: root, nocase: true, ignore: ['target/**', '**/PrecompiledWeb/**','out/**','dist/**'], absolute: true,nodir:true};

		const matches = glob.sync('**/' + fileName, options);//, (err, matches) => {
			// if(err) {
			// 	log.debug('Glob file match error ' + err.message);
			// 	return;
			// }
			
		log.info('Glob file match ' + matches.length);

		// take the first, log info if thre are multiple matches
		if(matches.length > 1) {
			log.info("Multiple matches found for source file " + fileName +
				": " + matches);
		}
		log.info(matches);
		
		return matches[0];
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


export class VeracodeTreeDataProvider implements vscode.TreeDataProvider<BuildNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private readonly veracodeModel: VeracodeExtensionModel) { }

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
				arguments: [element.id],//, element.buildId],
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
		return element ? this.veracodeModel.getChildren(element) : this.veracodeModel.roots;
	}
}

/*
 * Handles the build/scan explorer in the VSCode Explorer
 */
export class VeracodeExplorer {

	//private veracodeTreeViewExplorer: vscode.TreeView<BuildNode>;
	private veracodeModel: VeracodeExtensionModel;
	//private m_diagCollection: vscode.DiagnosticCollection;
	private m_sortBarInfo: vscode.StatusBarItem;
	private m_treeDataProvider: VeracodeTreeDataProvider;

	constructor(private m_context: vscode.ExtensionContext, private m_configSettings: ConfigSettings) {


		this.veracodeModel = new VeracodeExtensionModel(this.m_configSettings);
		this.m_treeDataProvider = new VeracodeTreeDataProvider(this.veracodeModel);

        // link the TreeDataProvider to the Veracode Explorer view
		//this.veracodeTreeViewExplorer = 
		vscode.window.createTreeView('veracodeStaticExplorer', { treeDataProvider: this.m_treeDataProvider });

		// link the 'Refresh' command to a method
        let disposable = vscode.commands.registerCommand('veracodeStaticExplorer.refresh', () => {
			this.veracodeModel.clearFlawsInfo();
			this.m_treeDataProvider.refresh()
		});
        m_context.subscriptions.push(disposable);

		// create the 'getFlawInfo' command - called when the user clicks on a flaw
		// disposable = vscode.commands.registerCommand('veracodeStaticExplorer.getFlawInfo', (flawID, buildID) => this.getFlawInfo(flawID, buildID));
		// m_context.subscriptions.push(disposable);

		// clean the diagnostics data due to a new application, sandbox or scan is selected
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.diagnosticsRefresh', () => this.veracodeModel.clearFlawsInfo());
		m_context.subscriptions.push(disposable);

		// Flaw sorting commands
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortSeverity', () => this.setFlawSort(TreeGroupingHierarchy.Severity));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortCwe', () => this.setFlawSort(TreeGroupingHierarchy.CWE));
		m_context.subscriptions.push(disposable);
		disposable = vscode.commands.registerCommand('veracodeStaticExplorer.sortFlawCategory', () => this.setFlawSort(TreeGroupingHierarchy.FlawCategory));
		m_context.subscriptions.push(disposable);	
																			// arbitrary number, relative to other items I create?
		this.m_sortBarInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);	
		this.setFlawSort(TreeGroupingHierarchy.Severity);		// default to sorting flaws by severity
		this.m_sortBarInfo.show();

		// mitigation command
		vscode.commands.registerCommand("veracodeStaticExplorer.proposeMitigation",async (flawBuildNode: BuildNode) => {
			console.log(flawBuildNode);
			const input = await proposeMitigationCommandHandler(flawBuildNode.mitigationStatus);
			if (input) {
				console.log('back from questions');
				let credsHandler = new CredsHandler(this.m_configSettings.getCredsFile(),this.m_configSettings.getCredsProfile());
				const annotationResponse = await postAnnotation(credsHandler,this.m_configSettings.getProxySettings(),flawBuildNode.parent,flawBuildNode.id,input.reason,input.comment);
				log.info('Annotation sent');
				log.info(annotationResponse);
				log.info('==================  Reseting Tree ===================');
				//const handler = new MitigationHandler(credsHandler,this.m_configSettings.getProxySettings());
				//await handler.postMitigationInfo(flawBuildNode.buildId,flawBuildNode.id,input.reason,input.comment);
				this.veracodeModel.clearFlawsInfo();
				await this.m_treeDataProvider.refresh();
			}
		});
	}

	private setFlawSort(sort:TreeGroupingHierarchy) {
		this.veracodeModel.setFlawSorting(sort);
		this.m_treeDataProvider.refresh();
		this.m_sortBarInfo.text = `Veracode - Group By ${sort}`;
	}
}

