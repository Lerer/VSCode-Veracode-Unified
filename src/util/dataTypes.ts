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
}