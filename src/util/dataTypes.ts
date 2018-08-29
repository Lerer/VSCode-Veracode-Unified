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
    
    m_type: NodeType;
    m_name: string;
    m_id: string;

    constructor(type: NodeType, name: string, id: string)
    {
        this.m_type = type;
        this.m_name = name;
        this.m_id = id;
    }

    public get type(): NodeType { return this.m_type; }
    public get name(): string { return this.m_name;}      // the Map key??
    public get id(): string { return this.m_name; }
}