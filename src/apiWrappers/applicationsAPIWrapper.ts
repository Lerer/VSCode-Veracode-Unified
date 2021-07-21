import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { ProxySettings } from '../util/proxyHandler';

const API_HOST:string = 'api.veracode.com';
const API_BASE_PATH:string = '/appsec/v1/applications'

const applicationRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string|null,appName:string|null) => {
    let applications = {};
    let params:any= {};
    let path = API_BASE_PATH;
    if (appGUID) {
        path = `${API_BASE_PATH}/${appGUID}`;
    }
    if (appName) {
        params.name = appName;
    }
    try {
        applications = await APIHandler.request(
            API_HOST,
            path,
            params,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished API request");
        
    } catch (error) {
        console.log(error.response);
        return {};
    }
    console.log('end getApplication request');
    return applications;
}

export const getApplications = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null) => {
    console.log('getApplications');
    let applications:any = await applicationRequest(credentialHandler,proxySettings,null,null);
    console.log('end getApplications');
    if (applications.data) {
        return applications.data._embedded.applications;
    } else {
        return applications;
    }
}

const getApplicationById = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string) => {
    console.log('getApplicationById');
    let application = await applicationRequest(credentialHandler,proxySettings,appGUID,null);
    console.log('end getApplicationById');
    return application;
}

export const getApplicationByName = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appName:string) => {
    // legacy_id
    console.info(`getApplicationByName - START - ${escape(appName)}`);
    let application:any = await applicationRequest(credentialHandler,proxySettings,null,appName);
    console.info('getApplicationByName - END');
    if (application.data) {
        return application.data._embedded.applications;
    } else {
        return application;
    }
}


