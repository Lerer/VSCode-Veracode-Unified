import log = require('loglevel');
import * as vscode from 'vscode';
import { SeverityNames } from '../models/dataTypes';

export const addSummaryReportView = (report: any) => {
    log.debug(report.data);
    if (!report.data) {
        vscode.window.showErrorMessage('Error retriving Summary Report Data');
        return;
    }

    const reportData = report.data;
    const panel = vscode.window.createWebviewPanel(
    'Veracode-summary',
    `Veracode Summary Report - ${reportData.app_name}${reportData.sandbox_name? '-'+reportData.sandbox_name : ''}`,
    vscode.ViewColumn.One,
    {}
    );

    // And set its HTML content
    panel.webview.html = getWebviewContent(reportData);
}

const getWebviewContent = (data:any) => {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <style>
#MAIN {
  font-family: Arial, Helvetica, sans-serif;
  border-collapse: collapse;
  width: 40%;
}

body {
    background-color: #eeeeee;
    color: black;
}

#MAIN td,th {
  border: 1px solid #333;
  padding: 8px;
  color: #000000
}

#MAIN tr:nth-child(even){background-color: #e2e2e2;}

#MAIN tr:hover {background-color: #ddd;}

#MAIN th {
    background-color: #00b4e6;
    padding-top: 12px;
    padding-bottom: 12px;
    text-align: left;
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
    <h1>Summary Report</h1>
    <h2>Application Name: ${data.app_name}</h2>
    <ul>
    <li>Business Criticality: ${SeverityNames[parseInt(data.business_criticality)]}</li>
    <li>Business Unit: ${data.business_unit}</li>
    <li>Business Owner: ${data.business_owner}</li>
    </ul>
    <h3>${getSandbox(data)}</h3>
    <ul>  
        <li>Last Updated: ${new Date(data.last_update_time).toString()}</li>
        <li>Flaws not mitigated: ${data.flaws_not_mitigated}</li>
        <li>Policy Compliance: ${data.policy_compliance_status}</li>
    </ul>
    <br/>
    <table id="MAIN">
        <tr><th>Severity</th><th>Total</th></tr>
        ${summarySeverities(data.severity)}
    </table>
      <br/>
  </body>
  </html>`;
  }

const getSandbox = (data:any):string => {
    if(data.sandbox_name) {
        return `Sandbox: ${data.sandbox_name}`;
    } 
    return `Policy Scan`;
}

const summarySeverities = (sevData:any[]):string => {
    if (sevData && sevData.length) {
        return sevData.map((sev) => {
            let totalForSev = 0; 
            const catData = sev.category.map((cat:any) => {
                totalForSev += cat.count; 
                return `<tr><td>&ensp;${cat.categoryname}</td><td>${cat.count}</td></tr>`;
            }).join('');  
            const base = `<tr class="upper bold"><td>${SeverityNames[parseInt(sev.level)]}</td><td>${totalForSev}</td></tr>`; 
            return `${base}${catData}`;
        }).join('');
    }
    return '';
}
