'use strict';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import log = require('loglevel');
import { pathToFileURL } from 'url';

import { VeracodeExtensionModel, VeracodeTreeDataProvider } from "./veracodeExplorer";

import { ConfigSettings } from "./util/configSettings";
import { FilterByPolicyImpact, FilterMitigation, TreeGroupingHierarchy, VeracodeNode } from './models/dataTypes';
import { summaryReportRequest } from './apiWrappers/summaryReportAPIWrapper';
import { addSummaryReportView } from './reports/veracodeSummaryReportHandler';
import { addSCAView } from './reports/veracodeSCAHandler';
import { proposeMitigationCommandHandler } from './util/mitigationHandler';
import { postAnnotation } from './apiWrappers/mitigationAPIWrapper';
import { CredsHandler } from './util/credsHandler';
import { VeracodePipelineScanHandler } from './pipeline/pipelineScanHandler';
import { jsonToVisualOutput } from './reports/pipelineScanJsonHandler';
import { submitSpecification } from './dast/dastHandler';

let veracodeModel: VeracodeExtensionModel;
let statusBarInfo: vscode.StatusBarItem;
let treeDataProvider: VeracodeTreeDataProvider;
let pipelineHandler: VeracodePipelineScanHandler;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // adjust the logging level for the rest of the plugin
    let configSettings = new ConfigSettings(context);
    let logLevel = configSettings.getLogLevel();
    log.setLevel(logLevel);

    veracodeModel = new VeracodeExtensionModel(configSettings);
    treeDataProvider = new VeracodeTreeDataProvider(veracodeModel);
    pipelineHandler = new VeracodePipelineScanHandler();

    // link the TreeDataProvider to the Veracode Explorer view
	vscode.window.createTreeView('veracodeUnifiedExplorer', { treeDataProvider: treeDataProvider });

    
    // link the 'Refresh' command to a method
    let disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.refresh', () => {
        veracodeModel.clearFlawsInfo();
        treeDataProvider.refresh()
    });
    context.subscriptions.push(disposable);

    // clean the diagnostics data due to a new application, sandbox or scan is selected
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.diagnosticsRefresh', () => veracodeModel.clearFlawsInfo());
    context.subscriptions.push(disposable);

    // Flaw sorting commands
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.sortSeverity', () => setFlawSort(TreeGroupingHierarchy.Severity));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.sortCwe', () => setFlawSort(TreeGroupingHierarchy.CWE));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.sortFlawCategory', () => setFlawSort(TreeGroupingHierarchy.FlawCategory));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.filterFlawIncMitigated', () => setFlawFilterMitigation(FilterMitigation.IncludeMitigated));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.filterFlawExcMitigated', () => setFlawFilterMitigation(FilterMitigation.ExcludeMitigated));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.filterFlawIncNoneEffectPolicy', () => setFlawFilterImpactPolicy(FilterByPolicyImpact.AllFlaws));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeUnifiedExplorer.filterFlawOnlyEffectPolicy', () => setFlawFilterImpactPolicy(FilterByPolicyImpact.OnlyEffectingPolicy));
    context.subscriptions.push(disposable);
    disposable = vscode.commands.registerCommand('veracodeAPISecurity.submitSpecification',() => submitSpecification(veracodeModel,configSettings));
    context.subscriptions.push(disposable);
                                                                        
    statusBarInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);	
    setFlawSort(TreeGroupingHierarchy.Severity);		// default to sorting flaws by severity
    updateStatusBar();
    statusBarInfo.show();

    
    context.subscriptions.push(vscode.commands.registerCommand('veracodeUnifiedExplorer.SCAReport', (sandboxNode: VeracodeNode) => { 
        let credsHandler = new CredsHandler(configSettings.getCredsFile(),configSettings.getCredsProfile());
        addSCAView(sandboxNode,credsHandler,configSettings.getProxySettings(),configSettings.getFlawsLoadCount()); 
    }));

    context.subscriptions.push(vscode.commands.registerCommand('veracodeUnifiedExplorer.summaryReport', async (sandboxNode: VeracodeNode) => { 
        let credsHandler = new CredsHandler(configSettings.getCredsFile(),configSettings.getCredsProfile());
        await credsHandler.loadCredsFromFile();
        vscode.window.showInformationMessage('Requesting Summary report from Veracode Platform')
        let report = await summaryReportRequest(credsHandler,configSettings.getProxySettings(),sandboxNode.appGUID,sandboxNode.sandboxGUID);
        addSummaryReportView(report); 
    }));

    // mitigation command
    vscode.commands.registerCommand("veracodeUnifiedExplorer.proposeMitigation",async (flawNode: VeracodeNode) => {
        const input = await proposeMitigationCommandHandler(flawNode.mitigationStatus);
        if (input) {
            log.debug('back from questions');
            let credsHandler = new CredsHandler(configSettings.getCredsFile(),configSettings.getCredsProfile());
            await postAnnotation(credsHandler,configSettings.getProxySettings(),flawNode.appGUID,flawNode.sandboxGUID,flawNode.id,input.reason,input.comment);
            veracodeModel.clearFlawsInfo();
            await treeDataProvider.refresh();
        }
    });

    vscode.commands.registerCommand("veracodeUnifiedExplorer.scanFileWithPipeline", async (uri: vscode.Uri) => {
        pipelineHandler.logMessage(uri.toString());
        pipelineHandler.scanFileWithPipeline(uri,configSettings);
    });

    vscode.commands.registerCommand("veracodeUnifiedExplorer.visualizePipelineScanFromJson", async (uri:vscode.Uri) => {
        jsonToVisualOutput(pathToFileURL(uri.fsPath),configSettings.getPipelineResultOutputStyle());
    })

    log.info(`adding file [${configSettings.getPipelineResultFilename()}] to menu context`);
    vscode.commands.executeCommand('setContext', 'veracode.pipelineScanResultsFilenameMenu', [
        configSettings.getPipelineResultFilename()
      ]);

	
}

const setFlawSort =(sort:TreeGroupingHierarchy) => {
    if (veracodeModel.getGrouping() !== sort) {
        veracodeModel.setFlawSorting(sort);
        treeDataProvider.refresh();
        updateStatusBar();
    }
}

const setFlawFilterMitigation = (filter:FilterMitigation) => {
    if (veracodeModel.getMitigationFilter() !== filter) {
        veracodeModel.setMitigationFilter(filter);
        veracodeModel.clearFlawsInfo();
        treeDataProvider.refresh();
        updateStatusBar();
    }
}

const setFlawFilterImpactPolicy = (filter: FilterByPolicyImpact) => {
    if (veracodeModel.getImpactPolicyFilter() !== filter) {
        veracodeModel.setImpactPolicyFilter(filter);
        veracodeModel.clearFlawsInfo();
        treeDataProvider.refresh();
        updateStatusBar();
    }	
}

const updateStatusBar = () => {
    const onlyImpactPolicy = veracodeModel.getImpactPolicyFilter() === FilterByPolicyImpact.OnlyEffectingPolicy;
    statusBarInfo.text = `Veracode - Group By ${veracodeModel.getGrouping()} - ${veracodeModel.getMitigationFilter()}${onlyImpactPolicy ? ','+veracodeModel.getImpactPolicyFilter(): ''}`;
}

// this method is called when your extension is deactivated
export function deactivate() {
    // This is intentional
}