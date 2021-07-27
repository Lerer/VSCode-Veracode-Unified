import { CredsHandler } from "./util/credsHandler";
import { BuildNode, NodeType, TreeGroupingHierarchy, SeverityNames } from "./util/dataTypes";
import { ProxySettings } from "./util/proxyHandler";
import { getSandboxFindings } from "./apiWrappers/findingsAPIWrapper"; 
import { getNested } from "./util/jsonUtil";
import * as log from "loglevel";


export const EMPTY_RESULT_NODE_NAME: string = "(Empty Results)";

export class VeracodeServiceAndData {
    // Cache will store findings requests based on the APP and context (sandbox)
    private cache: any;
    private grouping: TreeGroupingHierarchy;

    constructor() {
        this.cache = {};
        this.grouping = TreeGroupingHierarchy.Severity;
    }

    private async fetchFindingsForCache (sandboxNode: BuildNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null) {
        const findingsData = await getSandboxFindings(sandboxNode,credentialHandler,proxySettings);
        const findings = getNested(findingsData,'_embedded','findings');
        if (findings) { 
            this.cache[sandboxNode.id] = findings;
        }
    }

    public async getSandboxNextLevel (sandboxNode: BuildNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null): Promise<BuildNode[]> {
        let nodes: BuildNode[] = [];
        if (!this.cache[sandboxNode.id]) {
            await this.fetchFindingsForCache(sandboxNode,credentialHandler,proxySettings);
            if (!this.cache[sandboxNode.id]) {
                log.debug('No results for that specific sandbox');
                nodes.push(new BuildNode(NodeType.Empty,EMPTY_RESULT_NODE_NAME,`${sandboxNode.id}-${EMPTY_RESULT_NODE_NAME}`,sandboxNode.id));
            }
        }

        if (nodes.length===0) { 
            switch (this.grouping) {// TODO - work on CWE and Category
                case TreeGroupingHierarchy.Severity: {
                    // Calculate the number of issues in each Severity
                    nodes = this.getStatusNodes(sandboxNode.id);
                    break;
                }

                case TreeGroupingHierarchy.CWE: {
                    // Calculate the number of issues in each CWE
                    break;
                }

                default: { 
                    //statements; 
                    break; 
                } 
                
            }
        }

        return new Promise((resolve, reject) => {
            if (nodes.length>0) {
                resolve(nodes);
            } else { 
                reject([]);
            }
        }); 
    
    }

    public getStatusNodes(sandboxId:string): BuildNode[] {
        const statuses: Array<number>  = [0,0,0,0,0,0];
        const scanResults: [] = this.cache[sandboxId];
        if (scanResults) {
            scanResults.forEach(element => {
                let status = element['finding_details']['severity'];
                statuses[5-status] = statuses[5-status] + 1;
            });
        }

        const statusNodes = statuses.map((status,i) => {
            return new BuildNode(NodeType.Severity,`${SeverityNames[5-i]} (${status})`,`${sandboxId}-sev-${5-i}`,sandboxId);
        });

        console.log(statusNodes.map((bnode) => bnode.name));

        return statusNodes;

    }

    public sortFindings (groupType: TreeGroupingHierarchy) {
        console.log(`Change grouping to: ${groupType}`);
        this.grouping = groupType;
    }
}
