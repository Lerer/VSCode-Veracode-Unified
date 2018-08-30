'use strict';

import * as vscode from 'vscode';
import log = require('loglevel');

import { ConfigSettings } from "./util/configSettings";
import { CredsHandler } from "./util/credsHandler";
import { RawAPI } from "./util/rawAPI";
import { NodeType } from "./util/dataTypes";
import { BuildNode } from "./util/dataTypes";


export class BuildModel {

    //m_configSettings: ConfigSettings;
    m_credsFile: string;
    m_credsHandler: CredsHandler = null;
    m_apiHandler: RawAPI;
    m_refresh: any;     // method to call when data is ready
	private nodes: Map<string, BuildNode> = new Map<string, BuildNode>();

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

	public getChildren(node: BuildNode): Thenable<BuildNode[]> {
        // will be the scans (or sandboxes later)
		return this.m_apiHandler.getBuildList(node.m_id);
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

    /*
	public getContent(resource: vscode.Uri): Thenable<string> {
		return this.connect().then(client => {
			return new Promise((c, e) => {
				client.get(resource.path.substr(2), (err, stream) => {
					if (err) {
						return e(err);
					}

					let string = ''
					stream.on('data', function (buffer) {
						if (buffer) {
							var part = buffer.toString();
							string += part;
						}
					});

					stream.on('end', function () {
						client.end();
						c(string);
					});
				});
			});
		});
	} */
}



export class BuildTreeDataProvider implements vscode.TreeDataProvider<BuildNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(private readonly m_model: BuildModel) { ; }

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
				arguments: [element.m_id],
				title: 'Get App Builds'
			} : void 0
		};
	}

    /* 
     * called with element == undefined for the root(s) - aka Apps
     * called again for each app to get the builds
     */
	public getChildren(element?: BuildNode): BuildNode[] | Thenable <BuildNode[]> {
		return element ? this.m_model.getChildren(element) : this.m_model.roots;

		//let arr = this.m_model.roots;
		//log.debug("app array: " + arr);
		//return arr;
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

	constructor(private m_context: vscode.ExtensionContext, private m_configSettings: ConfigSettings) {

		const buildModel = new BuildModel(this.m_configSettings);
        const treeDataProvider = new BuildTreeDataProvider(buildModel);
		//context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('veracode', treeDataProvider));

        // first param must match the view name from package.json
		this.m_buildViewer = vscode.window.createTreeView('veracodeExplorer', { treeDataProvider });

        let disposable = vscode.commands.registerCommand('veracodeExplorer.refresh', () => treeDataProvider.refresh());
        m_context.subscriptions.push(disposable);

        disposable = vscode.commands.registerCommand('veracodeExplorer.getBuildsForApp', appID => this.getBuildsForApp(appID));
        m_context.subscriptions.push(disposable);

		//vscode.commands.registerCommand('ftpExplorer.revealResource', () => this.reveal());
    }

    private getBuildsForApp(appID: string) {
        log.debug("getBuildsForApp: " + appID);
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
