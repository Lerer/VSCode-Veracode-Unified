import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import {ProxySettings} from '../util/proxyHandler';
import {APIHandler} from '../util/apiQueryHandler';
import { window } from 'vscode';
import { MitigationObj } from '../util/mitigationHandler';

export class MitigationHandler {


    //  https://api.veracode.com/appsec/v2/applications/{application_guid}/annotations
    /*
    {
        "issue_list": "1,2",
        "comment": "This is my comment",
        "action": "REJECTED"
    }
    COMMENT
    APPDESIGN states that custom business logic within the body of the application has addressed the finding. An automated process may not be able to fully identify this business logic.
    NETENV states that the network in which the application is running has provided an environmental control that has addressed the finding.
    OSENV states that the operating system on which the application is running has provided an environmental control that has addressed the finding.
    FP, which stands for false positive, states that Veracode has incorrectly identified a finding in your application. If you identify a finding as a potential false positive, Veracode does not exclude the potential false positive from your published report. Your organization can approve a potential false positive to exclude it from the published report. If your organization approves a finding as a false positive, your organization is accepting the risk that the finding might be valid.
    LIBRARY states that the current team does not maintain the library containing the finding. You referred the vulnerability to the library maintainer.
    ACCEPTRISK states that your business is willing to accept the risk associated with a finding. Your organization evaluated the potential risk and effort required to address the finding.
    ACCEPTED
    REJECTED
    */

    public static api_host:string = 'analysiscenter.veracode.com';
    public static api_base_path:string = '/api'
    
    constructor(private credentialHandler:CredsHandler, private proxySettings: ProxySettings|null) { }
    
    public async postMitigationInfo(buildId:string|undefined,flowId:string,annotation:MitigationObj,comment:string){
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
