import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';

import log from 'loglevel';

const API_HOST:string = 'api.veracode.com';
const API_BASE_PATH:string = '/appsec/v1/applications'
export const POLICY_CONTAINER_NAME = 'POLICY';


export const summaryReportRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string|null,sandboxGUID:string|null) => {
    log.debug('SUMMARY Repost request - START');
    let report = {};
    let params:any= {};
    let path = `/appsec/v2/applications/${appGUID}/summary_report`;
    if (sandboxGUID) {
        params['context'] = sandboxGUID;
    }
    
    try {
        report = await APIHandler.request(
            API_HOST,
            path,
            params,
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        log.debug("Finished API request");
        
    } catch (error:any) {
        log.error(error.response);
        return {};
    }
    log.debug('SUMMARY Repost request - END');
    return report;
}



