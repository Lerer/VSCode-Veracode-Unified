import { window } from 'vscode';

export interface MitigationObj  {
    label: string;
    value: 'fp'|'osenv'|'netenv'|'appdesign'|'acceptrisk'|'comment';
}

const mitigations: MitigationObj[] = [
    {
        label: 'Comment',
        value: 'comment'
    },
    {
        label: 'Mitigate by OS Environment',
        value: 'osenv'
    },
    {
        label: 'Mitigate by Network Environment',
        value: 'netenv'
    },
    {
        label: 'Mitigate by Design',
        value: 'appdesign'
    },
    {
        label: 'Potential False Positive',
        value: 'fp'
    },
    {
        label: 'Accept the Risk',
        value: 'acceptrisk'
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
    if (mitigationStatus === 'none' || mitigationStatus==='rejected') {
        return mitigations.map((item) => item.label);
    } else {
        return mitigations.filter((item) => item.value=='comment').map((item) => item.label);
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