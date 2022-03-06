import { APIHandler } from "../util/apiQueryHandler";
import { CredsHandler } from "../util/credsHandler";
import { ProxySettings } from "../util/proxyHandler";

const API_HOST:string = 'api.veracode.com';
const BASE_PATH = '/was/configservice/v1';
const API_BASE_PATH:string = `${BASE_PATH}/analyses`
import log from 'loglevel';
//import FormData = require("form-data");
import Axios, { AxiosProxyConfig } from "axios";
import { getNested } from "../util/jsonUtil";

type stringORnothing = string|null|undefined;

export const listAPIScans = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null) => {
    return getAPIScanByName(credentialHandler, proxySettings,null);
}

export const getAPIScanByName = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,scanName:stringORnothing,) => {
    let scanDefinitions:any;
    const queryParams: any = {
        scan_type: 'API_SCAN'
    };
    if (scanName && scanName.length>0) {
        queryParams['name'] = scanName;
    }
    try {
        scanDefinitions = await APIHandler.request(
            API_HOST,
            API_BASE_PATH,
            queryParams,
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        console.log(`"Finished get scans via API request ${(scanName) ? 'with search for ['+scanName +']' : '' }`);
        log.debug(scanDefinitions);
    } catch (error) {
        if (error instanceof Error) {
            log.error(error.message);
        }
        return {};
    }
    console.log('end getAPIScanByName request');
    return scanDefinitions.data;
}

const createOrUpdateScan = async (method:'put',credentialHandler:CredsHandler, proxySettings: ProxySettings|null,idPath:string,specName:string,baseURL:stringORnothing) => {
    //const data = new FormData();
    
    const queryParams = {
        run_verification:false,
        scan_type:'API_SCAN'
    };

    /*
    POST https://ui.analysiscenter.veracode.com/was/configservice/v1/analyses?run_verification=false&scan_type=API_SCAN

{
    "name": "Example API",
    "scans":
    [
        {
            "action_type": "ADD",
            "request_id": "0",
            "scan_config_request":
            {
                "target_url":
                {
                    "url": "http://a7b11b7461c90455697cc0d3e27b72ad-1519729585.us-east-1.elb.amazonaws.com"
                },
                "api_scan_setting":
                {
                    "spec_id": "7be5a42d1c6d22ba1b4dde92173b9783"
                }
            }
        }
    ],
    "visibility":
    {
        "setup_type": "SEC_LEADS_ONLY",
        "team_identifiers":
        []
    }
}
    */

    // to standartize
    const body = {
        name: "scan from IDE",
        schedule: {
            now: true,
            duration: {
                length: 1,
                unit: "DAY"
            },
        }
    }

    //data.append('analysis',JSON.stringify(content));
  
    
    let scan:any;

    // if in the future we need query string - const queryString = APIHandler.generateQueryString(params);
    const headers: any = APIHandler.generageDefaultHeader(credentialHandler,API_HOST,`${API_BASE_PATH}${idPath}`,'?run_verification=false',method);

    try {
        scan = await APIHandler.request(
            API_HOST,
            `${API_BASE_PATH}${idPath}`,
            queryParams,
            'put',
            body,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished submit new API Scan request via API request");
        console.log(scan);
        
    } catch (error) {
        if (error instanceof Error) {
            log.error(error.message);
            console.log(Object.keys(error));
            console.log('==========================');
            console.log(Object.values(error)[2]);
        }
        return scan = {data:{}};
    }

    console.log('end createUpdateScan request');
    return scan.data;
}

export const submitScan = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,scanName:string,baseURL:stringORnothing) => { 

    const searchRequest = await getAPIScanByName(credentialHandler, proxySettings,scanName);
    const exisitngScans =  getNested(searchRequest,'_embedded','analyses');
    console.log(exisitngScans);
    const validResponse =  (exisitngScans && exisitngScans instanceof Array) ;

    if (!validResponse) {
        throw Error(`get API Scan by name [${scanName}] failed`);
    }
    const exsitngScan = exisitngScans.filter((scan: any) => scan.name===scanName);
    const analysisId = (exsitngScan.length>0 ? exsitngScan[0].analysis_id : null);
    
    if (!analysisId) {
        // Todo - submit new scan
    //    return createUpdateScan('post',credentialHandler,proxySettings,'',specName,specFilePath,baseURL);
    } else {
        return createOrUpdateScan('put',credentialHandler,proxySettings,`/${analysisId}`,scanName,baseURL);
    }

}
