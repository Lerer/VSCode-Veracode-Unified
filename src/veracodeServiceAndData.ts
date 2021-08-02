import { CredsHandler } from "./util/credsHandler";
import { BuildNode, NodeType, TreeGroupingHierarchy, SeverityNames } from "./models/dataTypes";
import { ProxySettings } from "./util/proxyHandler";
import { getSandboxFindings } from "./apiWrappers/findingsAPIWrapper"; 
import { getNested } from "./util/jsonUtil";
import * as log from "loglevel";
import { ConfigSettings } from "./util/configSettings";


export const EMPTY_RESULT_NODE_NAME: string = "(Empty Results)";

export class VeracodeServiceAndData {
    // Cache will store findings requests based on the APP and context (sandbox)
    private cache: any;
    private grouping: TreeGroupingHierarchy;

    constructor() {
        this.cache = {};
        this.grouping = TreeGroupingHierarchy.Severity;
    }

    public clearCache(sandboxId?:string) {
        if (sandboxId) {
            if (this.cache[sandboxId]) {
                delete this.cache[sandboxId];
            } else {
                log.warn(`No cache found for sandbox ID: ${sandboxId}`);
            }
        } else {
            this.cache = {};
        }
    }

    public getRawCacheData(sandboxId: string):any {
        return this.cache[sandboxId];
    }

    private async fetchFindingsForCache (sandboxNode: BuildNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null,flawPullSize:number) {
        const findingsData = await getSandboxFindings(sandboxNode,credentialHandler,proxySettings,flawPullSize);
        const findings = getNested(findingsData,'_embedded','findings');
        if (findings) { 
            this.cache[sandboxNode.id] = findings;
        }
    }

    public async getSandboxNextLevel (
        sandboxNode: BuildNode,
        credentialHandler:CredsHandler, 
        proxySettings: ProxySettings|null,
        configSettings:ConfigSettings ): Promise<BuildNode[]> {
        let nodes: BuildNode[] = [];
        if (!this.cache[sandboxNode.id]) {
            await this.fetchFindingsForCache(sandboxNode,credentialHandler,proxySettings,configSettings.getFlawsLoadCount());
            if (!this.cache[sandboxNode.id]) {
                log.debug('No results for that specific sandbox');
                nodes.push(new BuildNode(NodeType.Empty,EMPTY_RESULT_NODE_NAME,`${sandboxNode.id}-${EMPTY_RESULT_NODE_NAME}`,sandboxNode.id));
            }
        }

        if (nodes.length===0) { 
            switch (this.grouping) {// TODO - work on Category
                case TreeGroupingHierarchy.Severity: {
                    // Calculate the number of issues in each Severity
                    nodes = this.getStatusNodes(sandboxNode.id,sandboxNode.parent);
                    break;
                }

                case TreeGroupingHierarchy.CWE: {
                    // Calculate the number of issues in each CWE
                    nodes = this.getCWENodes(sandboxNode.id,sandboxNode.sandboxGUID,sandboxNode.parent);
                    break;
                }

                default: { 
                    nodes = this.getStatusNodes(sandboxNode.id,sandboxNode.parent);
                    break; 
                } 
                
            }
        }
        return nodes;    
    }

    private getStatusNodes(sandboxId:string,appGUID: string): BuildNode[] {
        const statuses: Array<number>  = [0,0,0,0,0,0];
        const scanResults: [] = this.cache[sandboxId];
        if (scanResults) {
            scanResults.forEach(element => {
                let status = element['finding_details']['severity'];
                statuses[5-status] = statuses[5-status] + 1;
            });
        }

        const statusNodes = statuses.map((status,i) => {
            return new BuildNode(NodeType.Severity,`${SeverityNames[5-i]} (${status})`,`${sandboxId}-sev-${5-i}`,sandboxId,'',appGUID);
        });

        console.log(statusNodes.map((bnode) => bnode.name));

        return statusNodes;

    }

    private getCWENodes(sandboxId:string,sandboxGUID: string,appGUID: string): BuildNode[] {
        const scanResults: [] = this.cache[sandboxId];

        const CWEs: Map<number,number> = new Map();
        const CWENames : Map<number,string> = new Map();
        if (scanResults) {
            scanResults.forEach(element => {
                let cwe:number = getNested(element,'finding_details','cwe','id');
                if (CWEs.has(cwe)) {
                    CWEs.set(cwe,(CWEs.get(cwe)!+1));
                } else {
                    CWEs.set(cwe,1);
                    const cweName = `${SeverityNames[getNested(element,'finding_details','severity')]} - ${getNested(element,'finding_details','cwe','name')} (${getNested(element,'finding_details','finding_category','name')})`;
                    CWENames.set(cwe,cweName);
                }
            });
        }
        const cweArr = [...CWEs.keys()].sort((a,b) => a-b);
        const cweNodes: BuildNode[] = cweArr.map((cwe) => {
            return new BuildNode(NodeType.CWE,`CWE-${cwe} - ${CWENames.get(cwe)}`,`${sandboxId}-cwe-${cwe}`,sandboxId,sandboxGUID,appGUID);
        });

        console.log(cweNodes.map((bnode) => bnode.name));

        return cweNodes;
    }

    public sortFindings (groupType: TreeGroupingHierarchy) {
        console.log(`Change grouping to: ${groupType}`);
        this.grouping = groupType;
    }

    public getFlawsOfSeverityNode(severityNode:BuildNode): Promise<BuildNode[]> {
        //^[\w-]*-sev-(.*)$
        const statusMatch = severityNode.id.match(/^[\w-]*-sev-(.*)$/);
        const scanResults: [] = this.cache[severityNode.parent];
        return new Promise((resolve, reject) => {
            if (statusMatch && statusMatch[1]) {
                const status = parseInt(statusMatch[1]);
                resolve(scanResults.filter((item) => {
                    return getNested(item,'finding_details','severity') === status }
                ).map((item) => {
                    const flawId = getNested(item,'issue_id');
                    const flawCWE = getNested(item,'finding_details','cwe','id');
                    const flawFile = getNested(item,'finding_details','file_name');
                    const flawLine = getNested(item,'finding_details','file_line_number');
                    return new BuildNode(NodeType.Flaw,
                        `#${flawId} - CWE-${flawCWE} - ${flawFile}:${flawLine}`,
                        `${severityNode.parent}-flaw-${flawId}`,
                        severityNode.id,
                        severityNode.parent,severityNode.appGUID,getNested(item,'violates_policy'));
                })
                );
            }
            reject([]); 
        }); 
    }

    public getFlawsOfCWENode(cweNode:BuildNode): Promise<BuildNode[]> {
        //^[\w-]*-cwe-(.*)$
        const cweMatch = cweNode.id.match(/^[\w-]*-cwe-(.*)$/);
        const scanResults: [] = this.cache[cweNode.parent];
        return new Promise((resolve, reject) => {
            if (cweMatch && cweMatch[1]) {
                const cweId = parseInt(cweMatch[1]);
                resolve(scanResults.filter((item) => {
                    return getNested(item,'finding_details','cwe','id') === cweId }
                ).map((item) => {
                    const flawId = getNested(item,'issue_id');
                    const flawFile = getNested(item,'finding_details','file_name');
                    const flawLine = getNested(item,'finding_details','file_line_number');
                    return new BuildNode(NodeType.Flaw,
                        `#${flawId} - ${flawFile}:${flawLine}`,
                        `${cweNode.parent}-flaw-${flawId}`,
                        cweNode.id,
                        cweNode.sandboxGUID,cweNode.appGUID,getNested(item,'violates_policy'));
                })
                );
            }
            reject([]); 
        }); 
    }
}
