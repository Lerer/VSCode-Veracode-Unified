import { window } from 'vscode';
/**
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

export interface MitigationObj  {
    label: string;
    value: 'FP'|'OSENV'|'NETENV'|'APPDESIGN'|'ACCEPTRISK'|'COMMENT';
}

const mitigations: MitigationObj[] = [
    {
        label: 'Comment',
        value: 'COMMENT'
    },
    {
        label: 'Mitigate by OS Environment',
        value: 'OSENV'
    },
    {
        label: 'Mitigate by Network Environment',
        value: 'NETENV'
    },
    {
        label: 'Mitigate by Design',
        value: 'APPDESIGN'
    },
    {
        label: 'Potential False Positive',
        value: 'FP'
    },
    {
        label: 'Accept the Risk',
        value: 'ACCEPTRISK'
    }
]

const firstInput = async (mitigationStatus:string) => {
    let items = itemsList(mitigationStatus);
 
    return window.showQuickPick(items, {
        placeHolder: 'Mitigation reason',
    })
}

const secondInput = async () => {
    return window.showInputBox({
        placeHolder: 'Comment'
    });
}

const itemsList = (mitigationStatus:string) => {
    if (mitigationStatus === 'NONE' || mitigationStatus==='REJECTED') {
        return mitigations.map((item) => item.label);
    } else {
        return mitigations.filter((item) => item.value=='COMMENT').map((item) => item.label);
    }
}

const proposeMitigationCommandHandler = async (mitigationStatus: string) => {

    const selection = await firstInput(mitigationStatus);
    let comment;
    if (selection) {
        comment = await secondInput();
    }

    if (selection && comment && comment.length>0){
        return {
            comment,
            reason:mitigations.filter(item => item.label===selection)[0]
        };
    } else {
        return;
    }

}

export {proposeMitigationCommandHandler}