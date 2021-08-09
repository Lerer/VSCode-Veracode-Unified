import * as vscode from 'vscode';
import { getSandboxFindings } from './apiWrappers/findingsAPIWrapper';
import { SeverityNames, SeverityColors, VeracodeNode } from './models/dataTypes';
import { CredsHandler } from './util/credsHandler';
import { getNested } from './util/jsonUtil';
import { ProxySettings } from './util/proxyHandler';

export const addSCAView = async (sandboxNode: VeracodeNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null,flawPullSize:number) => {
    console.log(sandboxNode);
    await credentialHandler.loadCredsFromFile();
    const SCAfindings = await getSandboxFindings(sandboxNode,credentialHandler, proxySettings,flawPullSize, ['SCA']);
    const scaEmbeddedFindings = getNested(SCAfindings,'_embedded','findings');
    if (!scaEmbeddedFindings) {
        vscode.window.showErrorMessage('Could not fetch SCA finding for the given Policy/Sandbox');
        return;
    }
    const panel = vscode.window.createWebviewPanel(
    'Veracode',
    `SCA Findings - ${sandboxNode.name}`,
    vscode.ViewColumn.One,
    {}
    );

    // And set its HTML content
    panel.webview.html = getWebviewContent(scaEmbeddedFindings);
}

const getWebviewContent = (scaFindings:any[]) => {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <style>
#SCA {
  font-family: Arial, Helvetica, sans-serif;
  border-collapse: collapse;
  width: 100%;
}

body {
    background-color: #eeeeee;
}

#SCA td,th {
  border: 1px solid #333;
  padding: 8px;
  color: #000000
}

#SCA tr:nth-child(even){background-color: #e2e2e2;}

#SCA tr:hover {background-color: #ddd;}

#SCA th {
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

.notViolatesPolicy {
    text-transform: uppercase;
}

.severity {
    font-weight: bold;
}

</style>
</head>
  <body>
      <table id="SCA">
        <thead><tr><th>Component</th><th>CVE (CVSS)</th><th>License/s (Risk Rating)</th><th width="50%">Description</th><th>Severity</th><th>Effect Policy</th></tr></thead>
        <tbody>${getSCARaws(scaFindings)}</tbody>
      </table>
      <br/>
  </body>
  </html>`;
  }

const getSCARaws = (scaFindings:any[]) => {
    let retVal: string = '<tr><td colspan=6>No Data</td></tr>';
    const scaSearchPrefix = 'https://sca.analysiscenter.veracode.com/vulnerability-database/search#query=';
    if (scaFindings) {
        scaFindings.sort((a,b) => getNested(b,'finding_details','severity') - getNested(a,'finding_details','severity'));
        retVal = scaFindings.map((scaFlaw:any) => {
            const details = getNested(scaFlaw,'finding_details');
            const cveEle = getNested(details,'cve');
            const fileName = `<td>${getNested(details,'component_filename')}</td>`;
            const cve = `<td><a href="${scaSearchPrefix}${getNested(cveEle,'name')}">${getNested(cveEle,'name')}</a> (${getNested(cveEle,'cvss')})</td>`;
            const sevInt = getNested(details,'severity') || 0;
            const severity = `<td class="severity" bgcolor='#${SeverityColors[sevInt]}'>${SeverityNames[sevInt]}</td>`;
            const violatesPolicy = `<td class="${getNested(scaFlaw,'violates_policy') ? 'violatesPolicy' : 'notViolatesPolicy'}">${getNested(scaFlaw,'violates_policy')}</td>`
            const licenses = getNested(details,'licenses').map((license:any) => `${license.license_id} (${SeverityNames[parseInt(getNested(license.risk_rating))]})`);
            return `<tr>${fileName}${cve}<td>${licenses}</td><td>${getNested(scaFlaw,'description')}</td>${severity}${violatesPolicy}</tr>`;
        }).toString();
    }
    return retVal

}