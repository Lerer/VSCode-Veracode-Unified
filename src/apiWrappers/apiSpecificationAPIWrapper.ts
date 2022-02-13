import {existsSync,createReadStream} from 'fs';
import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';
import {getNested} from '../util/jsonUtil';

import log from 'loglevel';
import * as FormData from 'form-data';
import  Axios, { AxiosProxyConfig } from 'axios';

const API_HOST:string = 'api.veracode.com';
const BASE_PATH = '/was/configservice/v1';
const API_BASE_PATH:string = `${BASE_PATH}/api_specifications`
export const POLICY_CONTAINER_NAME = 'POLICY';

type stringORnothing = string|null|undefined;


export const listSpecifications = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null) => {
    return getSpecificationByName(credentialHandler, proxySettings,null);
}

export const getSpecificationByName = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,specName:stringORnothing) => {
    let specifications:any;
    const params: any = {};
    if (specName && specName.length>0) {
        params['spec_name'] = specName;
    }
    try {
        specifications = await APIHandler.request(
            API_HOST,
            API_BASE_PATH,
            params,
            'get',
            undefined,
            credentialHandler,  
            proxySettings  
        );
        console.log(`"Finished get specifications via API request ${(specName) ? 'with search for ['+specName +']' : '' }`);
        log.debug(specifications);
    } catch (error) {
        if (error instanceof Error) {
            log.error(error.message);
        }
        return {};
    }
    console.log('end listSpecifications request');
    return specifications.data;
}

export const submitSpecifications = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,specName:string,specFilePath: string,baseURL:stringORnothing) => { 

    const specExists = existsSync(specFilePath);
    if (!specExists) {
        throw new Error(`Cannot access the spec file in path: ${specFilePath}`);
        
    } 

    const searchRequest = await getSpecificationByName(credentialHandler, proxySettings,specName);
    const exisitngSpecs =  getNested(searchRequest,'_embedded','api_specs');
    console.log(exisitngSpecs);
    const validResponse =  (exisitngSpecs && exisitngSpecs instanceof Array) ;

    if (!validResponse) {
        throw Error(`get specifications by name [${specName}] failed`);
    }

    const found = exisitngSpecs.filter((item: { spec_name: string; }) => item.spec_name === specName);
    const specId = (found.length>0 ? found[0].spec_id : null);
    
    if (!specId) {
        return createUpdateSpecification('post',credentialHandler,proxySettings,'',specName,specFilePath,baseURL);
    } else {
        return createUpdateSpecification('put',credentialHandler,proxySettings,`/${specId}`,specName,specFilePath,baseURL);
    }

}

const createUpdateSpecification = async (method:'post'|'put',credentialHandler:CredsHandler, proxySettings: ProxySettings|null,idPath:string,specName:string,specFilePath: string,baseURL:stringORnothing) => {
    const data = new FormData();
    const specExists = existsSync(specFilePath);
    if (!specExists) {
        throw new Error(`Cannot access the spec file in path: ${specFilePath}`);
        
    } 
    data.append('file', createReadStream(specFilePath));
    data.append('spec_name',specName);
    if (baseURL && baseURL.trim().length>0) {
        data.append('custom_base_url',baseURL.trim());
    }

    const params = {};
  
    
    let specifications:any;
    
    try {

        // if in the future we need query string - const queryString = APIHandler.generateQueryString(params);
        const headers: any = APIHandler.generageDefaultHeader(credentialHandler,API_HOST,`${API_BASE_PATH}${idPath}`,'',method);

        for (const key in data.getHeaders()) {
            headers[key] = data.getHeaders()[key];
        }

        // Set up proxy settings
        let axiosProxy: AxiosProxyConfig | false = false; 
        if(proxySettings !== null) {
            axiosProxy = proxySettings.getAxiosProxy();
        }

        specifications = await Axios.request({
            method,
            url: `https://${API_HOST}${API_BASE_PATH}${idPath}`,
            data,
            params,
            headers,
            proxy:axiosProxy
          });

        console.log("Finished submit new spec via API request");

    } catch (error) {
        if (error instanceof Error) {
            log.error(error.message);
            console.log(Object.keys(error));
            console.log('==========================');
            console.log(Object.values(error)[1]);
        }
        return {};
    }
    console.log('end submitSpecifications request');
    return specifications.data;
}

