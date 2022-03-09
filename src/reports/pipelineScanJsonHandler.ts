import { readFileSync } from 'fs';
import log = require('loglevel');
import { URL } from 'url';
import * as vscode from 'vscode';
import { SeverityNames } from '../models/dataTypes';

export type pipeline_output_display_style = 'simple'|'simple in style'|'detailed'|'detailed in style';

export async function jsonToVisualOutput(pipelineJSONResult: URL,outputStyle: pipeline_output_display_style) {
    let content = readFileSync(pipelineJSONResult,{encoding:"utf-8"});

    if (!content) {
        vscode.window.showErrorMessage(`Error retriving data from ${pipelineJSONResult.toJSON()}`);
        return;    
    }

    const contentJson = JSON.parse(content);

    if (contentJson.findings) {
        const panel = vscode.window.createWebviewPanel(
        'Pipeline Scan summary',
        `Pipeline Scan summary`,
        vscode.ViewColumn.One,
        {}
        );
    
        // And set its HTML content
        panel.webview.html = getWebviewContent(contentJson.findings,outputStyle);
    }
}

const getWebviewContent = (data:any,outputStyle:pipeline_output_display_style) => {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <style>

body {
    background-color: #eeeeee;
    color: black;
}

.violatesPolicy {
    background-color: #ff0000;
    text-transform: uppercase;
    font-weight: bold;
}

.upper {
    text-transform: uppercase;
}

.bold {
    font-weight: bold;
}

.severity {
    font-weight: bold;
}

</style>
</head>
  <body>
    <h1>Pipeline Results:</h1>
    <br/>
    <p>
        ${getFindingsAsText(data,outputStyle)}
    </p>
      <br/>
  </body>
  </html>`;
  }

const getFindingsAsText = (findings: Array<any>,outputStyle:pipeline_output_display_style):string => {    
    const statuses: Array<Array<any>>  = [[],[],[],[],[],[]];
    
    findings.forEach((element:any) => {
        let status = element['severity'];
        statuses[5-status].push(element);
    });

    let content='';
    log.debug(outputStyle);
    if (outputStyle==='simple' || outputStyle==='detailed') {
        content = contentAsText(statuses,findings.length,outputStyle);
    }

    return content;
}

const contentAsText = (statuses: Array<any>,total:number,outputStyle:pipeline_output_display_style): string => {
    const totalIssueTitleStr = `Analyzed ${total} issues.` 
    const start = `${'='.repeat(totalIssueTitleStr.length)}\n</br>${totalIssueTitleStr}\n</br>${'='.repeat(totalIssueTitleStr.length)}\n</br>`;

    const main = statuses.map((status,index) => {
        const sevTitleStr = `Found ${statuses[index].length} issues of ${SeverityNames[5-index]} severity.`;
        const statusInfo = `${'-'.repeat(sevTitleStr.length)}\n</br>${sevTitleStr}\n</br>${'-'.repeat(sevTitleStr.length)}\n</br>`;
        const statusBody = status.map((flaw:any) => {                
            const sourceFile = flaw.files.source_file;
            const simple = `CWE-${flaw.cwe_id}: ${flaw.issue_type}: ${sourceFile.file}:${sourceFile.line}\n</br>`;
            let details = '';
            if (outputStyle==='detailed') {
                details = convertFlawDisplayToHTML(flaw.display_text);
            }
            return `${simple}${details}`;
        }).join('');
        return `${statusInfo}${statusBody}`;
    }).join('');

    return `${start}${main}`;
}

const convertFlawDisplayToHTML = (display:string) => {
    const removeSpans = display.replaceAll('</span>','</br>').replace('<span>','');
    const removeAnchors = removeSpans.replaceAll('<a ','</br> - <a ');
    return `<details><summary>Issue details</summary>${removeAnchors}</details></br>`;
}

