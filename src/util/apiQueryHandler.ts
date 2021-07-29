import {ProxySettings} from '../util/proxyHandler'; 
import {generateHeader} from  './veracode-hmac';
import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import Axios, { AxiosProxyConfig } from 'axios';

export class APIHandler {

    static m_userAgent: string = 'veracode-vscode-plugin';
    static m_protocol: string = 'https://';
    static DEFAULT_METHOD: 'get'|'post' = 'get';

    // generic API caller
    static request(host:string,path: string, params: any,reqMethod:'get'|'post'|undefined,body:any|undefined,credHandler:CredsHandler ,proxySettings: ProxySettings|null): Thenable<string> {
        let method : 'get'|'post' = reqMethod || this.DEFAULT_METHOD; 
        // funky for the Veracode HMAC generation
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

        // Set up proxy settings
        let axiosProxy: AxiosProxyConfig | false = false; 
        if(proxySettings !== null) {
            // split the proxy ip addr after the dbl-slash
            let n = proxySettings.proxyHost.indexOf('://');
            let preamble = proxySettings.proxyHost.substring(0, n+3);
            let postamble = proxySettings.proxyHost.substring(n+3);
            axiosProxy = {
                host: postamble,
                port: parseInt(proxySettings.proxyPort),
                protocol: preamble
            };
            // if an Auth is required
            if(proxySettings.proxyUserName !== '') {
                axiosProxy.auth = {
                    username: proxySettings.proxyUserName,
                    password: proxySettings.proxyPassword
                }
            }
        }

        return Axios.request({
            method,
            proxy:axiosProxy,
            headers:{
                'User-Agent': this.m_userAgent,
                'Authorization': generateHeader(
                                    credHandler.getApiId()||'', 
                                    credHandler.getApiKey()||'', 
                                    host, path,
                                    queryString,
                                    method.toUpperCase())
            },
            params,
            url: this.m_protocol + host + path,
            data: body
        });
    }
}
    