import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';

import log from 'loglevel';
import { VeracodeNode, NodeType } from '../models/dataTypes';

const API_HOST:string = 'api.veracode.com';

const findingsRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string,sandboxGUID:string|null,flawPullSize: number) => {
    log.debug('findingsRequest - START');
    let findings:any  = {};
    let path = `/appsec/v2/applications/${appGUID}/findings`;
    let params:any = { "size": flawPullSize};
    if (sandboxGUID) {
        params.context = sandboxGUID;
    }

    try {
        findings = await APIHandler.request(
            API_HOST,
            path,
            params,
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished Findings API request");
        console.log(findings.data);
        
    } catch (error) {
        console.log(error.response);
        findings = {};
    }
    console.log('end Findings request');
    log.debug('findingsRequest - END');
    return findings;
}

export const getSandboxFindings = async (sandboxNode: VeracodeNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null,flawPullSize:number, scanType?: any): Promise<VeracodeNode[]> => {
    const sandboxGUID = sandboxNode.type === NodeType.Sandbox ? sandboxNode.id : null;
    const findings: any = await findingsRequest(credentialHandler,proxySettings,sandboxNode.parent,sandboxGUID,flawPullSize);
    return findings.data || {};
}


