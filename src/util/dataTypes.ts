/* 
 * data types used across files
 */

'use strict';

export enum NodeType {
    Application = 1,
    Sandbox,
    Scan,
    FlawCategory,
    Flaw,
    CWE
}

// export enum NodeSubtype {
//     None = 0,
//     Severity = 1,
//     CWE,
//     File
// }

export enum TreeGroupingHierarchy {
    Severity =1,
    CWE = 2,
    FlawCategory=3,
}

export enum FilterMitigation {
    IncludeMitigated,
    ExcludeMitigated
}

export enum FilterByPolicyImpact {
    AllFlaws,
    OnlyEffectingPolicy
}

export type MitigationStatus = 'none' | 'proposed' | 'accepted' | 'rejected';

// for mapping the sort-type (a number) to a displayable string
export function sortNumToName(sortNum:number) {

    let sortName:string;

    switch (sortNum) {
        case TreeGroupingHierarchy.Severity:
            sortName = 'Severity';
            break;
        case TreeGroupingHierarchy.CWE:
            sortName = 'CWE';
            break;
        case TreeGroupingHierarchy.FlawCategory:
            sortName = 'Flaw Category';
            break;
        default:
            sortName = 'unknown';
    }

    return sortName;
}

/*
 * a node in the Explorer view
 * can represent an App, a Sandbox, a Scan(Build), a flaw sorting category, or a flaw
 */
export class BuildNode {

    // parent is the appID for sandboxes, set to 0 for apps
    constructor(private m_type: NodeType, private m_name: string, 
        private m_id: string, private m_parent: string,private isEffectPolicy?:boolean,private vBuildId?:string, private m_mitigationStatus?: 'na'|'none'|'accepted'|'rejected'|'proposed') { }

    public get type(): NodeType { return this.m_type; }
    public get name(): string { return this.m_name;}
    public get id(): string { return this.m_id; }
    public get buildId(): string|undefined {return this.vBuildId;}
    public get parent(): string { return this.m_parent; }
    public get mitigationStatus() : string {return this.m_mitigationStatus || 'na';}
    public get effectPolicy(): boolean {return this.isEffectPolicy || false;}


    public toString(): string {
        return("Node Type: "+this.m_type+", Name: " + this.m_name + ", ID: " + this.m_id + ", parent ID: " + this.m_parent);
    }
}

/* 
 * Flaw into displayed in the VSCode Problems window
 */


export class FlawInfo {
    private m_remediation_status:MitigationStatus  = 'none';
    private m_mitigation_status_desc:string | undefined;

    constructor(private m_id: string,
                private m_file: string,
                private m_line: string,
                private m_severity: string,
                private m_cweDesc: string,
                private m_flawDesc: string,
                private m_buildID: string,
                ) {}

    public set mitigated(value:MitigationStatus) {
        this.m_remediation_status = value;
    }
    public set mitigationStatus(value: string|undefined) {
        this.m_mitigation_status_desc = value;
    }
    public get id(): string { return this.m_id; }
    public get file(): string { return this.m_file; }
    public get line(): string { return this.m_line; }
    public get severity(): string { return this.m_severity; }
    public get cweDesc(): string { return this.m_cweDesc; }
    public get desc(): string { return this.m_flawDesc; }
    public get buildID(): string { return this.m_buildID; }
    public get mitigationStatus():string|undefined {return this.m_mitigation_status_desc}
    public get mitigated(): MitigationStatus {return this.m_remediation_status}

    public isMitigated():boolean { return this.m_remediation_status==='accepted'}

    public toString(): string {
        return("ID: " + this.m_id);
    }
}