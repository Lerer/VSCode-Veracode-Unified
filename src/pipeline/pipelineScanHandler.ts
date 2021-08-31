import * as path from 'path';
import {URL,pathToFileURL} from 'url';
import * as vscode from 'vscode';
import {readFileSync,writeFileSync} from 'fs';

import { Scan, ScansApi, ScanUpdateScanStatusEnum, ScanResourceScanStatusEnum, SegmentsApi, FindingsApi, ScanFindingsResource } from '../apiWrappers/pipelineAPIWrapper';

let extensionConfig: vscode.WorkspaceConfiguration;

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

    public logMessage(message: string) {
        this.clear();
        this.outputChannel.appendLine(`${this.getTimeStamp()} - ${message}`);
    }

    public async scanFileWithPipeline (target: vscode.Uri) {
        //loadConfig();
        this.clear();
        //pipelineScanDiagnosticCollection.clear();

        
        if (!target && vscode.workspace.workspaceFolders) {
            if (extensionConfig['pipelineScanFilepath'] === '') {
                this.logMessage('No default Pipeline Scan filepath set, see extension help for configuration settings');
                return;
            }
            target = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, extensionConfig['pipelineScanFilepath']);
        }
        
        let filename = target.fsPath.substring(target.fsPath.lastIndexOf(path.sep) + 1);
        this.pipelineStatusBarItem.text = `Scanning ${filename}`;
        this.pipelineStatusBarItem.show();
        
        
        try {
            let fileUrl = pathToFileURL(target.fsPath);
            if (vscode.workspace.workspaceFolders) {
                //let outputFile = url.pathToFileURL(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, pipelineScanResultsFilename));
                
                let pipelineShell: vscode.ShellExecution = new vscode.ShellExecution('pwd');
                this.logMessage(pipelineShell.command.toString());

                //await runPipelineScan(fileUrl, outputFile, this.logMessage);
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




import * as crypto from 'crypto';

const usage = 'Usage: unofficial-veracode-pipeline-scan <file-to-scan> [<output-file>]';
const defaultOutputFileName = 'unofficial-veracode-pipeline-scan-results.json';

const scansApi = new ScansApi();
const segmentsApi = new SegmentsApi();
const findingsApi = new FindingsApi();

let runningScanId = '';
let messageFunction = sendLogMessage;

if (require.main === module) {
	process.on('SIGINT', async () => {
		await cancelScan();
		process.exit();
	});
	
	if (process.argv.length === 3 || process.argv.length === 4) {
		try {
			let fileUrl = pathToFileURL(process.argv[2]);
			let outputFileUrl = pathToFileURL(process.argv[3] || defaultOutputFileName);
			runPipelineScan(fileUrl, outputFileUrl);
		} catch(error){
			console.log(usage);
			console.log(error.message);
		}
	} else {
		console.log(usage);
	}
}

export async function runPipelineScan(target: URL, outputFile: URL, messageCallback?: (message: string) => void) {
	if (messageCallback) {
		messageFunction = messageCallback;
	}
    let fileUrlString = target.toString();
    let fileName = fileUrlString.substring(fileUrlString.lastIndexOf(path.sep) + 1);
	messageFunction(`Scanning ${fileName}`);

    let file = readFileSync(target);

    try {
        let scansPostResponse = await createScan(file, fileName);
        if (scansPostResponse.data.scan_id && scansPostResponse.data.binary_segments_expected) {
            runningScanId = scansPostResponse.data.scan_id;
            messageFunction(`Scan ID ${runningScanId}`);
            await uploadFile(runningScanId, file, scansPostResponse.data.binary_segments_expected);
            try {
                let scansScanIdPutResponse = await scansApi.scansScanIdPut(runningScanId, {
                    scan_status: ScanUpdateScanStatusEnum.STARTED
                });
                messageFunction(`Scan status ${scansScanIdPutResponse.data.scan_status}`);
            } catch(error) {
                messageFunction(error.message);
            }
            await pollScanStatus(runningScanId);
            let scansScanIdFindingsGetResponse = await findingsApi.scansScanIdFindingsGet(runningScanId);
            if (scansScanIdFindingsGetResponse.data.findings) {
                messageFunction(`Number of findings is ${scansScanIdFindingsGetResponse.data.findings.length}`);
                processScanFindingsResource(scansScanIdFindingsGetResponse.data, outputFile);
            }
        }
    } catch(error) {
        messageFunction(error.message);
    }
}

export async function cancelScan(scanId?: string) {
	let scanToCancel = scanId || runningScanId;
    messageFunction(`Cancelling scan ${scanToCancel}`);
	try {
        let scansScanIdPutResponse = await scansApi.scansScanIdPut(scanToCancel, {
            scan_status: ScanUpdateScanStatusEnum.CANCELLED
        });
        messageFunction(`Scan status ${scansScanIdPutResponse.data.scan_status}`);
    } catch(error) {
        messageFunction(error.message);
    }
}

function createScan(file: Buffer, fileName: string) {
	let scan: Scan = {
		binary_hash: crypto.createHash('sha256').update(file).digest('hex'),
		binary_name: fileName,
		binary_size: file.byteLength
	};
	return scansApi.scansPost(scan);
}

async function uploadFile(scanId: string, file: Buffer, segmentCount: number) {
	for (let i = 0; i < segmentCount; i++) {
		let segmentBegin = i * (file.byteLength/segmentCount);
		let segmentEnd = 0;
		if (i === segmentCount - 1) {
			segmentEnd = file.byteLength;
		} else {
			segmentEnd = segmentBegin + file.byteLength/segmentCount;
		}
		let fileSegment = file.slice(segmentBegin, segmentEnd);
		try {
			let scansScanIdSegmentsSegmentIdPutResponse = await segmentsApi.scansScanIdSegmentsSegmentIdPut(scanId, i, fileSegment);
			messageFunction(`Uploaded segment of size ${scansScanIdSegmentsSegmentIdPutResponse.data.segment_size} bytes`);
		} catch(error) {
			messageFunction(error.message);
		}
	}
}

async function pollScanStatus(scanId: string) {
	let scanComplete = false;
	while (!scanComplete) {
		await sleep(3000);
		let scansScanIdGetResponse = await scansApi.scansScanIdGet(scanId);
		switch(scansScanIdGetResponse.data.scan_status) {
			case ScanResourceScanStatusEnum.PENDING:
			case ScanResourceScanStatusEnum.STARTED:
			case ScanResourceScanStatusEnum.UPLOADING: {
				break;
			}
			default: {
				scanComplete = true;
			}
		}
		messageFunction(`Scan status ${scansScanIdGetResponse.data.scan_status}`);
	}
}

function processScanFindingsResource(scanFindingsResource: ScanFindingsResource, outputFile: URL) {
    messageFunction(`Saving results to ${outputFile.toString()}`);
    let data = JSON.stringify(scanFindingsResource, null, 4);
    writeFileSync(outputFile, data);
}

// Utils functions

function sleep(ms: number) {
	return new Promise((resolve) => {
	  	setTimeout(resolve, ms);
	});
}

function makeTimestamp(): string {
	let now = new Date();
	return `[${now.toISOString()}]`;
}

function sendLogMessage(message: string) {
	console.log(`${makeTimestamp()} ${message}`);
}
