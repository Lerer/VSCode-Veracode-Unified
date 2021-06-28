import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import {ProxySettings} from '../util/proxyHandler';
import {APIHandler} from '../util/apiQueryHandler';
import { window } from 'vscode';
import { MitigationObj } from '../util/mitigationHandler';

export class MitigationHandler {
    public static api_host:string = 'analysiscenter.veracode.com';
    public static api_base_path:string = '/api'
    
    constructor(private credentialHandler:CredsHandler, private proxySettings: ProxySettings|null) { }
    
    public async postMitigationInfo(buildId:string,flowId:string,annotation:MitigationObj,comment:string){
        log.info('postMitigationInfo');
        if (!this.credentialHandler.getApiId() || this.credentialHandler.getApiId()?.length==0) {
            await this.credentialHandler.loadCredsFromFile();
        }
        
        const requestPath = '/updatemitigationinfo.do';
        
        try {
            await APIHandler.request(
                MitigationHandler.api_host,
                MitigationHandler.api_base_path+ requestPath,
                {
                    build_id:buildId,
                    action:annotation.value ,
                    comment,
                    flaw_id_list:`${flowId}`
                },
                this.credentialHandler,
                this.proxySettings
            );
            window.showInformationMessage(`${annotation.label} annotation submitted`);
        } catch (err) {
            log.error(err);
            log.error(err.response);
            window.showErrorMessage(`Annotation submittion failed. Please make sure no special charcters are included in the comment`);
        }
    }


}
