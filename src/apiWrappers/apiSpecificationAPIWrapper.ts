import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';
import {getNested} from '../util/jsonUtil';

import log from 'loglevel';

const API_HOST:string = 'api.veracode.com';
const BASE_PATH = '/was/configservice/v1';
const API_BASE_PATH:string = `${BASE_PATH}/api_specifications`
export const POLICY_CONTAINER_NAME = 'POLICY';


export const listSpecifications = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null) => {
    let specifications:any = {data:""};
    try {
        specifications = await APIHandler.request(
            API_HOST,
            API_BASE_PATH,
            {},
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished applicationRequest API request");
        log.debug(specifications);
    } catch (error) {
        if (error instanceof Error) {
            log.error(error.message);
        }
        return {};
    }
    console.log('end getApplication request');
    return specifications.data;
}
