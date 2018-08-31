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

    constructor(private m_type: NodeType, private m_name: string, private m_id: string) { }

    public get type(): NodeType { return this.m_type; }
    public get name(): string { return this.m_name;}      // the Map key??
    public get id(): string { return this.m_id; }

    public toString(): string {
        return("Name: " + this.m_name + "ID: " + this.m_id);
    }
}

export class FlawInfo {

    constructor(private m_id: string,
                private m_file: string,
                private m_line: string) {}

    public get id(): string { return this.m_id; }
    public get file(): string { return this.m_file; }
    public get line(): string { return this.m_line; }

    public toString(): string {
        return("ID: " + this.m_id);
    }
}