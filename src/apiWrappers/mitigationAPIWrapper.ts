import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import {ProxySettings} from '../util/proxyHandler';
import {APIHandler} from '../util/apiQueryHandler';
import { MitigationObj } from '../util/mitigationHandler';

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

const API_HOST:string = 'api.veracode.com';

export const postAnnotation = async (credentialHandler:CredsHandler, proxySettings: ProxySettings|null,appGUID:string,sandboxGUID:string,flowId:string,annotation:MitigationObj,comment:string) => {
    log.debug('postAnnotation - START');
    log.debug(`flaws: ${flowId}, comment: '${comment}', Annotation Type: ${annotation.value}`);

    const idMatch = flowId.match(/^[\w-]*-flaw-(.*)$/);
    if (!idMatch || !idMatch[1]) {
        return {error: "cannot find the flaw ID for annotation"}
    }
    let annotationRes:any  = {};
    let path = `/appsec/v2/applications/${appGUID}/annotations`;
    let body = {
        "action": annotation.value,
        comment,
        "issue_list":`${idMatch[1]}`
    }

    let queryParams: any = {};
    if (sandboxGUID && sandboxGUID.indexOf('policy')<0) {
        queryParams['context'] = sandboxGUID;
    }

    await credentialHandler.loadCredsFromFile();

    try {
        annotationRes = await APIHandler.request(
            API_HOST,
            path,
            queryParams,
            'post',
            body,
            credentialHandler,  
            proxySettings  
        );
        console.log("Finished Annotation API request");
        console.log(annotationRes);
        
    } catch (error) {
        log.error('ERROR');
        log.error(error);
        annotationRes = {};
    }
    log.debug('postAnnotation - END');
    return annotationRes;
}

