import * as path from 'path';
import * as url from 'url';
import * as vscode from 'vscode';

export class VeracodePipelineScanHandler {

    private outputChannel:vscode.OutputChannel;
    private pipelineStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);


    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Veracode Pipeline Scan');
    }

    public clear() {
        this.outputChannel.clear();
	    this.outputChannel.show();
    }

    private getTimeStamp() {
        const now = new Date();
        return `${now.getHours()}:${('0'+now.getMinutes()).slice(-2)}:${('0'+now.getSeconds()).slice(-2)}_${now.getMilliseconds()}`;
    }

    public logMessage(uri:any) {
        this.clear();
        console.log('Printing');
        this.outputChannel.appendLine(`${this.getTimeStamp()} - ${uri}`);
        console.log('done printing');
    }

    public async scanFileWithPipeline (target: vscode.Uri) {
        //loadConfig();
        this.clear();
        //pipelineScanDiagnosticCollection.clear();
    
        // if (!target && vscode.workspace.workspaceFolders) {
            // if (extensionConfig['pipelineScanFilepath'] === '') {
            //     sendLogMessage('No default Pipeline Scan filepath set, see extension help for configuration settings');
            //     return;
            // }
            // target = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, extensionConfig['pipelineScanFilepath']);
        // }
    
        let filename = target.fsPath.substring(target.fsPath.lastIndexOf(path.sep) + 1);
        this.pipelineStatusBarItem.text = `Scanning ${filename}`;
        this.pipelineStatusBarItem.show();
    
        try {
            let fileUrl = url.pathToFileURL(target.fsPath);
            if (vscode.workspace.workspaceFolders) {
                //let outputFile = url.pathToFileURL(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, pipelineScanResultsFilename));
                //await runPipelineScan(fileUrl, outputFile, sendLogMessage);
                this.pipelineStatusBarItem.text = `Scan complete ${filename}`;
                setTimeout(() => {
                    this.pipelineStatusBarItem.hide();
                }, 10000);
            }
        } catch(error) {
            this.logMessage(error.message);
        }
    }
}