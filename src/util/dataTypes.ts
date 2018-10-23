/* 
 * data types used across files
 */

'use strict';

export enum NodeType {
    Application = 1,
    Sandbox,
    Scan
}

/*
 * a node in the Explorer view
 * can represent an App, a Sandbox, or a Scan(Build)
 */
export class BuildNode {

    // parent is the appID for sandboxes, set to 0 for apps
    constructor(private m_type: NodeType, private m_name: string, private m_id: string, private m_parent: string) { }

    public get type(): NodeType { return this.m_type; }
    public get name(): string { return this.m_name;}      // the Map key??
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