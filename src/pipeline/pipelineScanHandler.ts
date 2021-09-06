import * as path from 'path';
import {URL,pathToFileURL} from 'url';
import * as vscode from 'vscode';
import {readFileSync,writeFileSync} from 'fs';
import log = require('loglevel');
import * as crypto from 'crypto';

import { ScanUpdateScanStatusEnum, ScanResourceScanStatusEnum, SegmentsApi, FindingsApi, ScanFindingsResource, addInterceptor, removeGlobalInterceptor, updateScanStatus, ScanResource, getScanStatus, Scan, createNewScan } from '../apiWrappers/pipelineAPIWrapper';
import { ConfigSettings } from '../util/configSettings';
import { CredsHandler } from '../util/credsHandler';
import { AxiosResponse } from 'axios';
import { jsonToVisualOutput } from '../reports/pipelineScanJsonHandler';


function getTimeStamp(): string {
    const now = new Date();
    return `${now.getHours()}:${('0'+now.getMinutes()).slice(-2)}:${('0'+now.getSeconds()).slice(-2)}_${('00'+now.getMilliseconds()).slice(-3)}`;
}

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


    public logMessage(message: string) {
        this.outputChannel.appendLine(`${getTimeStamp()} - ${message}`);
    }

    public async scanFileWithPipeline (target: vscode.Uri,configSettings:ConfigSettings) {
        configSettings.loadSettings();
        this.clear();

        let credsHandler = new CredsHandler(configSettings.getCredsFile(),configSettings.getCredsProfile());
        await credsHandler.loadCredsFromFile();

        let filename = target.fsPath.substring(target.fsPath.lastIndexOf(path.sep) + 1);
        this.pipelineStatusBarItem.text = `Scanning ${filename}`;
        this.pipelineStatusBarItem.show();
        
        const pipelineScanResultsFilename = configSettings.getPipelineResultFilename();
        
        try {
            let fileUrl = pathToFileURL(target.fsPath);
            if (vscode.workspace.workspaceFolders && pipelineScanResultsFilename) {
                let outputFile = pathToFileURL(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, pipelineScanResultsFilename));
                this.logMessage(`Beginning scanning of '${filename}'`)
                await runPipelineScan(credsHandler,fileUrl, outputFile, (messgae:string) => {this.outputChannel.appendLine(`${getTimeStamp()} - ${messgae}`)});
                this.logMessage(`Analysis Complete.`); 
                this.pipelineStatusBarItem.text = `Scan complete ${filename}`;
                setTimeout(() => {
                    this.pipelineStatusBarItem.hide();
                }, 10000);
            }
        } catch(error:any) {
            this.logMessage(error.message);
        }
    }
}

export async function runPipelineScan(credsHandler:CredsHandler, target: URL, outputFile: URL, messageFunction: (message: string) => void = ((m:string) => log.debug(m))) {
    log.debug('runPipelineScan - START');
	
    const findingsApi = new FindingsApi();

    let runningScanId = '';

    let fileUrlString = target.toString();
    let fileName = fileUrlString.substring(fileUrlString.lastIndexOf(path.sep) + 1);
	messageFunction(`Scanning ${fileName}`);

    let file = readFileSync(target);

    const interceptor: number = addInterceptor(credsHandler);
    try {
        // Add interceptor
        // Create a scan ID
        const scanHash: Scan = createScanFileHash(file,fileName);
        let scansPostResponse = await createNewScan(scanHash);//await scansApi.scansPost(scanHash);
        log.info(scansPostResponse);
        if (scansPostResponse.data.scan_id && scansPostResponse.data.binary_segments_expected) {
            runningScanId = scansPostResponse.data.scan_id;
            messageFunction(`Scan ID ${runningScanId}`);
            await uploadFile(runningScanId, file, scansPostResponse.data.binary_segments_expected,messageFunction);
            try {
                let startScanPutResponse = await updateScanStatus(runningScanId,ScanUpdateScanStatusEnum.STARTED);
                messageFunction(`Scan status ${startScanPutResponse.data.scan_status}`);
            } catch(error:any) {
                messageFunction(error.message);
            }
            await pollScanStatus(runningScanId,messageFunction);
            let scansScanIdFindingsGetResponse = await findingsApi.scansScanIdFindingsGet(runningScanId);
            if (scansScanIdFindingsGetResponse.data.findings) {
                messageFunction(`Number of findings is ${scansScanIdFindingsGetResponse.data.findings.length}`);
                processScanFindingsResource(scansScanIdFindingsGetResponse.data, outputFile);
                // Add display for the pipeline findings
                await jsonToVisualOutput(outputFile);
            }
        }
    } catch(error:any) {
        messageFunction(error.message);
    }
    removeGlobalInterceptor(interceptor);
}

async function cancelScan(scanId: string,messageCallback?: (message: string) => void) {
    if (messageCallback) {
        messageCallback(`Cancelling scan ${scanId}`);
    }
	try {
        let scansScanIdPutResponse:AxiosResponse<ScanResource> = await updateScanStatus(scanId, ScanUpdateScanStatusEnum.CANCELLED);
        if (messageCallback){
            messageCallback(`Scan status ${scansScanIdPutResponse.data.scan_status}`);
        }
    } catch(error:any) {
        if (messageCallback) {
            messageCallback(error.message);
        }
    }
}

function createScanFileHash(file: Buffer, fileName: string): Scan {
	return {
		binary_hash: crypto.createHash('sha256').update(file).digest('hex'),
		binary_name: fileName,
		binary_size: file.byteLength
	};
}

async function uploadFile(scanId: string, file: Buffer, segmentCount: number,messageFunction: (message: string) => void = ((m:string) => {return;})) {
    const segmentsApi = new SegmentsApi();
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
			messageFunction(`Uploaded segment ${i+1} out of ${segmentCount} of total upload size: ${scansScanIdSegmentsSegmentIdPutResponse.data.segment_size} bytes`);
		} catch(error:any) {
			messageFunction(error.message);
		}
	}
}

async function pollScanStatus(scanId: string,messageFunction: (message: string) => void = ((m:string) => {return;})) {
	let scanComplete = false;
    let scansScanIdGetResponse;
	while (!scanComplete) {
		await sleep(4000);
        scansScanIdGetResponse = await getScanStatus(scanId);
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

function processScanFindingsResource(scanFindingsResource: ScanFindingsResource, outputFile: URL,messageFunction: (message: string) => void = ((m:string) => {return;})) {
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



