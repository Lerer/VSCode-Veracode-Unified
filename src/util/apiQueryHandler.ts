import {ProxySettings} from '../util/proxyHandler'; 
import {generateHeader} from  './veracode-hmac';
import {CredsHandler} from '../util/credsHandler';
import Axios, { AxiosProxyConfig } from 'axios';
import * as FormData from 'form-data';

export class APIHandler {

    static m_userAgent: string = 'veracode-vscode-plugin';
    static m_protocol: string = 'https://';
    static DEFAULT_METHOD: 'get'|'post' = 'get';

    public static generageDefaultHeader = (credHandler:CredsHandler,host:string,path: string,queryString:string,method:'get'|'post'|'put') => {
        return {
            'User-Agent': APIHandler.m_userAgent,
            'Authorization': generateHeader(
                                credHandler.getApiId()||'', 
                                credHandler.getApiKey()||'', 
                                host, path,
                                queryString,
                                method.toUpperCase())
        }
    }

    public static generateQueryString = (params: any):string => {
        let queryString = '';
        if(params !== null && Object.keys(params).length>0) {
            var keys = Object.keys(params);
            queryString = '?';
            let index = 0;
            for(var key in keys)
            {   
                if(index > 0)
                    queryString += '&';
                queryString += keys[key] + '=' + params[keys[key]];
                index++;
            }
        }
        return queryString;
    }

    // generic API caller
    static request(host:string,path: string, params: any,reqMethod:'get'|'post'|undefined,body:any|undefined,credHandler:CredsHandler ,proxySettings: ProxySettings|null): Thenable<string> {
        let method : 'get'|'post' = reqMethod || this.DEFAULT_METHOD; 
        // funky for the Veracode HMAC generation
        let queryString = this.generateQueryString(params);
        
        // Set up proxy settings
        let axiosProxy: AxiosProxyConfig | false = false; 
        if(proxySettings !== null) {
            axiosProxy = proxySettings.getAxiosProxy();
        }

        const headers:any = this.generageDefaultHeader(credHandler,host,path,queryString,method); 

        return Axios.request({
            method,
            proxy:axiosProxy,
            headers,
            params,
            url: this.m_protocol + host + path,
            data: body
        });
    }
}
    