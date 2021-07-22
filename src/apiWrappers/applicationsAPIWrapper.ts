import {APIHandler} from '../util/apiQueryHandler';
import { CredsHandler } from '../util/credsHandler';
import { BuildNode, NodeType } from '../util/dataTypes';
import { ProxySettings } from '../util/proxyHandler';

import log from 'loglevel';
import { ProjectConfigHandler } from '../util/projectConfigHandler';

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

const sandboxRequest = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string,sandboxGUID:string|null,sandboxName:string|null) => {
    let sandboxes = {};
    let path = `${API_BASE_PATH}/${appGUID}/sandboxes`;
    if (sandboxGUID) {
        path = `${path}/${sandboxGUID}`;
    }
    try {
        sandboxes = await APIHandler.request(
            API_HOST,
            path,
            {},
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished API request");
        
    } catch (error) {
        console.log(error.response);
        return {};
    }
    console.log('end getApplication request');
    return sandboxes;
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

export const getApplicationByGUID = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string) => {
    console.log('getApplicationByGUID');
    let application = await applicationRequest(credentialHandler,proxySettings,appGUID,null);
    console.log('end getApplicationByGUID');
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

    // get the app list via API call
export const getAppList = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,projectConfig:ProjectConfigHandler): Promise<BuildNode[]> => {
    log.debug('getAppList');
    /* (re-)loading the creds and proxy info here should be sufficient to pick up 
        * any changes by the user, as once they get the App List working they should 
        * be good to go and not make more changes
        */

    // (re-)load the creds, in case the user changed them
    try {
        await credentialHandler.loadCredsFromFile();
        await projectConfig.loadPluginConfigFromFile();
    }
    catch (error) {
        log.error(error.message);
        return Promise.resolve([]);
    }

    let applications: any;
    if (projectConfig.getApplicationName()) {
        applications = await getApplicationByName(credentialHandler,proxySettings,projectConfig.getApplicationName()!);
    } else {
        applications = await getApplications(credentialHandler,proxySettings);
    }

    
    return new Promise((resolve,reject) => {
        const appNodes = handleAppList(applications);
        if (appNodes.length>0) {
            resolve(appNodes);
        } else {
            log.error("Could not get the requested application/s from the Veracode Platform");
            reject();
        }
    })
}

    // parse the app list from raw XML into an array of BuildNodes
const handleAppList = (applications: any) /*(rawXML: string)*/: BuildNode[] => {
    log.debug("handling app List: " + JSON.stringify(applications));

    let appArray : BuildNode[] = [];

    if (typeof applications==='object' && applications.length) {
        appArray = applications.map((app:any) => {
            return new BuildNode(NodeType.Application, app.profile.name, app.id, '0');
        });
    }

    return appArray;
}

export const getSandboxList = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string):Promise<Array<any>> => {
    console.log('getSandboxList');
    let sandboxes:any = await sandboxRequest(credentialHandler,proxySettings,appGUID,null,null);
    console.log('end getSandboxList');
    if (sandboxes.data) {
        if (sandboxes.data._embedded.sandboxes) {
            return sandboxes.data._embedded.sandboxes;
        }
    } else {
        log.error('Error getting results for sandboxes list');
        log.error(JSON.stringify(sandboxes));
    }
    log.info('No sandboxes found');
    return [];
}

export const getSandboxByName = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string,sandboxName:string) => {
    console.log('getSandboxByName');
    let sandboxes:Array<any> = await getSandboxList(credentialHandler,proxySettings,appGUID);
    console.log('end getSandboxByName');
    return sandboxes.filter((sandbox)=> {
        return sandbox.name===sandboxName;
    });
}
