import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';

import log from 'loglevel';

const API_HOST:string = 'api.veracode.com';

const pipelineScanRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,scanGUID:string) => {
    log.debug('pipelineScanRequest - START');
    let findings:any  = {};
    let path = `/pipeline_scan/scans/${scanGUID}`;

    try {
        findings = await APIHandler.request(
            API_HOST,
            path,
            {},
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished pipelineScan API request");
        console.log(findings.data);
        
    } catch (error) {
        console.log(error.response);
        findings = {};
    }
    console.log('end pipelineScanRequest');
    log.debug('findingsRequest - END');
    return findings;
}

export const getSandboxFindings = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,scanGUID:string): Promise<any> => {
    const scan: any = await pipelineScanRequest(credentialHandler,proxySettings,scanGUID);
    return scan.data || {};
}


