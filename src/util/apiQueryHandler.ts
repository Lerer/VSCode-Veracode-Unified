import {ProxySettings} from '../util/proxyHandler'; 
import {generateHeader} from  './veracode-hmac';
import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import Axios from 'axios';

export class APIHandler {

    static m_userAgent: string = 'veracode-vscode-plugin';
    static m_protocol: string = 'https://';
    static DEFAULT_METHOD: 'get'|'post' = 'get';

    // generic API caller
    static request(host:string,path: string, params: any,credHandler:CredsHandler ,proxySettings: ProxySettings|null): Thenable<string> {
        let method : 'get'|'post' = this.DEFAULT_METHOD; 
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
        let proxyString = null;
        if(proxySettings !== null) {
            if(proxySettings.proxyUserName !== '') {
            // split the proxy ip addr after the dbl-slash
            let n = proxySettings.proxyHost.indexOf('://');
            let preamble = proxySettings.proxyHost.substring(0, n+3);
            let postamble = proxySettings.proxyHost.substring(n+3);

            proxyString = preamble + proxySettings.proxyUserName + ':' +
                            proxySettings.proxyPassword + '@' +
                            postamble + ':' +
                            proxySettings.proxyPort;
            }
            else{
                proxyString = proxySettings.proxyHost + ':' + proxySettings.proxyPort
            }
        }

        // set up options for the request call
        // var options = {
        //     url: this.m_protocol + host + path,
        //     proxy: proxyString,
        //     strictSSL: false,       // needed for testing, self-signed cert in Burp proxy
        //     qs: params,
        //     headers: {
        //         'User-Agent': this.m_userAgent,
        //         'Authorization': generateHeader(
        //                             credHandler.getApiId()||'', 
        //                             credHandler.getApiKey()||'', 
        //                             host, path,
        //                             queryString,
        //                             'GET')
        //     },
        //     json: false
        // };
       
        log.debug("Veracode proxy settings: " + proxyString);

        return Axios.request({
            method,
            headers:{
                'User-Agent': this.m_userAgent,
                'Authorization': generateHeader(
                                    credHandler.getApiId()||'', 
                                    credHandler.getApiKey()||'', 
                                    host, path,
                                    queryString,
                                    'GET')
            },
            params,
            url: this.m_protocol + host + path
        });
    }
}
    