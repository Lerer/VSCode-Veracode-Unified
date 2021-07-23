import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';

import log from 'loglevel';

const API_HOST:string = 'api.veracode.com';
const API_BASE_PATH:string = '/appsec/v1/applications'

const resultsRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string,sandboxGUID:string|null,sandboxName:string|null) => {
    log.debug('resultsRequest - START');
    let findings = {};
    let path = `/appsec/v2/applications/${appGUID}/findings`;
    let params:any = {};
    if (sandboxGUID) {
        params.context = sandboxGUID;
    }

    try {
        findings = await APIHandler.request(
            API_HOST,
            path,
            params,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished Findings API request");
        
    } catch (error) {
        console.log(error.response);
        findings = {};
    }
    console.log('end getApplication request');
    log.debug('resultsRequest - START');
    return findings;
}
