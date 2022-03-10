import { accessSync, constants, readFileSync } from 'fs';
import log = require('loglevel');
import { URL } from 'url';
import * as vscode from 'vscode';
import { SeverityColors, SeverityNames } from '../models/dataTypes';

export type pipeline_output_display_style = 'simple'|'simple in style'|'detailed'|'detailed in style';

export async function jsonToVisualOutput(pipelineJSONResult: URL,outputStyle: pipeline_output_display_style) {

    try {
        accessSync(pipelineJSONResult, constants.R_OK );
      } catch (err) {
        console.error('no access!');
        vscode.window.showErrorMessage(`Error accessing ${pipelineJSONResult.toString()}.\nThe result file may not exist and you need to initiate a Pipeline Scan`);
        return;
      }

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

.upper {
    text-transform: uppercase;
}

.bold {
    font-weight: bold;
}

.severity {
    font-weight: bold;
}

#PL {
    font-family: Arial, Helvetica, sans-serif;
    border-collapse: collapse;
    width: 100%;
  }
  
  body {
      background-color: #eeeeee;
  }
  
  #PL td,th {
    border: 1px solid #333;
    padding: 8px;
    color: #000000
  }
  
  #PL tr:nth-child(even){background-color: #e2e2e2;}
  
  #PL tr:hover {background-color: #ddd;}
  
  #PL th {
      background-color: #00b4e6;
      padding-top: 12px;
      padding-bottom: 12px;
      text-align: left;
  }
    
 

</style>
</head>
  <body>
    <h1>Pipeline Results:</h1>
    <br/>
    ${getFindingsAsText(data,outputStyle)}
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
        content = `<p>${contentAsText(statuses,findings.length,outputStyle)}</p>`;
    } 
    if (outputStyle==='simple in style' || outputStyle==='detailed in style') {
        content = styledContent(statuses,findings.length,outputStyle);
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
                details = `${convertFlawDisplayToHTML(flaw.display_text)}</br>`;
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
    return `<details><summary>Issue details</summary>${removeAnchors}</details>`;
}

const styledContent = (statuses: Array<any>,total:number,outputStyle:pipeline_output_display_style) : string => {
    const start = '<table id="PL"><thead><tr><th>CWE</th><th>CWE Name</th><th>Severity</th><th>Location</th></tr></thead><tbody>\n';
    const end = `<tr><td colspan=4>Analyzed ${total} issues.</td></tr></tbody></table>`;

    const body = statuses.map((status,index) => {
        const sevInt = 5-index;
        const sevColor = SeverityColors[sevInt];
        const sevName = SeverityNames[sevInt];
        return status.map((flaw:any) => {                
            const sourceFile = flaw.files.source_file;
            const simple = `<tr><td>CWE-${flaw.cwe_id}</td><td>${flaw.issue_type}</td><td class="severity" bgcolor='#${sevColor}'>${sevName}</td><td>${sourceFile.file}:${sourceFile.line}</td>\n`;
            let details = '';
            if (outputStyle==='detailed in style') {
                details = `<tr><td colspan=4>${convertFlawDisplayToHTML(flaw.display_text)}</td></tr>`;
            }
            return `${simple}${details}`;
        }).join('');
    }).join('');

    return `${start}${body}${end}`;
}

