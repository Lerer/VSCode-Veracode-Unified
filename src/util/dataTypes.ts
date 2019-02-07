/* 
 * data types used across files
 */

'use strict';

export enum NodeType {
    Application = 1,
    Sandbox,
    Scan,
    FlawCategory,
    Flaw
}

export enum NodeSubtype {
    None = 0,
    Severity = 1,
    CWE,
    File
}

// for mapping the sort-type (a number) to a displayable string
export function sortNumToName(sortNum:number) {

    let sortName:string;

    switch (sortNum) {
        case 1:
            sortName = 'Severity';
            break;
        case 2:
            sortName = 'CWE';
            break;
        case 3:
            sortName = 'Filename';
            break;
        default:
            sortName = 'unknown';
    }

    return sortName;
}

/*
 * a node in the Explorer view
 * can represent an App, a Sandbox, or a Scan(Build)
 */
export class BuildNode {

    // parent is the appID for sandboxes, set to 0 for apps
    constructor(private m_type: NodeType, private m_subtype: NodeSubtype, private m_name: string, private m_id: string, private m_parent: string) { }

    public get type(): NodeType { return this.m_type; }
    public get subtype(): NodeSubtype { return this.m_subtype; }
    public get name(): string { return this.m_name;}
    public get id(): string { return this.m_id; }
    public get parent(): string { return this.m_parent; }

    public toString(): string {
        return("Name: " + this.m_name + ", ID: " + this.m_id + ", parent ID: " + this.m_parent);
    }
}

/* 
 * Flaw into displayed in the VSCode Problems window
 */
export class FlawInfo {

    constructor(private m_id: string,
                private m_file: string,
                private m_line: string,
                private m_severity: string,
                private m_cweDesc: string,
                private m_flawDesc: string) {}

    public get id(): string { return this.m_id; }
    public get file(): string { return this.m_file; }
    public get line(): string { return this.m_line; }
    public get severity(): string { return this.m_severity; }
    public get cweDesc(): string { return this.m_cweDesc; }
    public get desc(): string { return this.m_flawDesc; }

    public toString(): string {
        return("ID: " + this.m_id);
    }
}