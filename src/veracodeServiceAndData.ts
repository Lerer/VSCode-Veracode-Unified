import { CredsHandler } from "./util/credsHandler";
import { VeracodeNode, NodeType, TreeGroupingHierarchy, SeverityNames, FilterMitigation, FilterByPolicyImpact } from "./models/dataTypes";
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
    private filterMitigation: FilterMitigation;
    private filterEffectingPolicy: FilterByPolicyImpact;

    constructor() {
        this.cache = {};
        this.grouping = TreeGroupingHierarchy.Severity;
        this.filterMitigation = FilterMitigation.IncludeMitigated;
        this.filterEffectingPolicy = FilterByPolicyImpact.AllFlaws;
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
        return this.cache[sandboxId].filter((flaw:any) => this.isPassAllFilters(flaw));
    }

    private async fetchFindingsForCache (sandboxNode: VeracodeNode,credentialHandler:CredsHandler, proxySettings: ProxySettings|null,flawPullSize:number) {
        const findingsData = await getSandboxFindings(sandboxNode,credentialHandler,proxySettings,flawPullSize,undefined);
        const findings = getNested(findingsData,'_embedded','findings');
        if (findings) { 
            this.cache[sandboxNode.id] = findings;
        }
    }

    private isFlawMitigated(rawFlaw: any): boolean {
        const findingStatus = getNested(rawFlaw,'finding_status','status');
        return (findingStatus === 'CLOSED')
    }

    public filterForMitigation(rawFlaw: any) : boolean {
        return (this.filterMitigation === FilterMitigation.IncludeMitigated || !this.isFlawMitigated(rawFlaw));
    }

    private isFlawEffectingPolicy(rawFlaw: any) : boolean {
        const effectingPolicy = getNested(rawFlaw,'violates_policy');
        return (effectingPolicy || false);
    }

    public filterForEffectingPolicy(rawFlaw: any): boolean {
        return (this.filterEffectingPolicy === FilterByPolicyImpact.AllFlaws || this.isFlawEffectingPolicy(rawFlaw));
    }

    public isPassAllFilters(rawFlaw: any) : boolean {
        return (this.filterForEffectingPolicy(rawFlaw) && this.filterForMitigation(rawFlaw));
    }

    public async getSandboxNextLevel (
        sandboxNode: VeracodeNode,
        credentialHandler:CredsHandler, 
        proxySettings: ProxySettings|null,
        configSettings:ConfigSettings ): Promise<VeracodeNode[]> {
        let nodes: VeracodeNode[] = [];
        if (!this.cache[sandboxNode.id]) {
            await this.fetchFindingsForCache(sandboxNode,credentialHandler,proxySettings,configSettings.getFlawsLoadCount());
            if (!this.cache[sandboxNode.id]) {
                log.debug('No results for that specific sandbox');
                nodes.push(new VeracodeNode(NodeType.Empty,EMPTY_RESULT_NODE_NAME,`${sandboxNode.id}-${EMPTY_RESULT_NODE_NAME}`,sandboxNode.id));
            }
        }

        if (nodes.length===0) { 
            switch (this.grouping) {
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

                case TreeGroupingHierarchy.FlawCategory: {
                    // Calculate the number of issues in each CWE
                    nodes = this.getFlawCategoryNodes(sandboxNode.id,sandboxNode.sandboxGUID,sandboxNode.parent);
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

    private getStatusNodes(sandboxId:string,appGUID: string): VeracodeNode[] {
        const statuses: Array<number>  = [0,0,0,0,0,0];
        const scanResults: [] = this.cache[sandboxId];
        if (scanResults) {
            scanResults.forEach(element => {
                if (this.isPassAllFilters(element)) {
                    let status = element['finding_details']['severity'];
                    statuses[5-status] = statuses[5-status] + 1;
                }
            });
        }

        return statuses.map((status,i) => {
            return new VeracodeNode(NodeType.Severity,`${SeverityNames[5-i]} (${status})`,`${sandboxId}-sev-${5-i}`,sandboxId,'',appGUID);
        });
    }

    private getCWENodes(sandboxId:string,sandboxGUID: string,appGUID: string): VeracodeNode[] {
        const scanResults: [] = this.cache[sandboxId];

        const CWEs: Map<number,number> = new Map();
        const CWENames : Map<number,string> = new Map();
        if (scanResults) {
            scanResults.forEach(element => {
                if (this.isPassAllFilters(element)) {
                    let cwe:number = getNested(element,'finding_details','cwe','id');
                    if (CWEs.has(cwe)) {
                        CWEs.set(cwe,(CWEs.get(cwe)!+1));
                    } else {
                        CWEs.set(cwe,1);
                        const cweName = `${SeverityNames[getNested(element,'finding_details','severity')]} - ${getNested(element,'finding_details','cwe','name')} (${getNested(element,'finding_details','finding_category','name')})`;
                        CWENames.set(cwe,cweName);
                    }
                }
            });
        }
        const cweArr = [...CWEs.keys()].sort((a,b) => a-b);
        return cweArr.map((cwe) => {
            return new VeracodeNode(NodeType.CWE,`CWE-${cwe} - ${CWENames.get(cwe)}`,`${sandboxId}-cwe-${cwe}`,sandboxId,sandboxGUID,appGUID);
        });
    }

    private getFlawCategoryNodes(sandboxId:string,sandboxGUID: string,appGUID: string): VeracodeNode[] {
        const scanResults: [] = this.cache[sandboxId];

        const flawCategories: Map<number,number> = new Map();
        const flawCategoryNames : Map<number,string> = new Map();
        if (scanResults) {
            scanResults.forEach(element => {
                if (this.isPassAllFilters(element)) {
                    let flawCategoryId:number = getNested(element,'finding_details','finding_category','id');
                    if (flawCategories.has(flawCategoryId)) {
                        flawCategories.set(flawCategoryId,(flawCategories.get(flawCategoryId)!+1));
                    } else {
                        flawCategories.set(flawCategoryId,1);
                        const flawCategoryName = `${getNested(element,'finding_details','finding_category','name')}`;
                        flawCategoryNames.set(flawCategoryId,flawCategoryName);
                    }
                }
            });
        }
        const flawCategoryArr = [...flawCategories.keys()].sort((a,b) => a-b);
        return flawCategoryArr.map((flawCategoryId) => {
            return new VeracodeNode(NodeType.FlawCategory,`${flawCategoryNames.get(flawCategoryId)} (${flawCategories.get(flawCategoryId)})`,`${sandboxId}-flawcat-${flawCategoryId}`,sandboxId,sandboxGUID,appGUID);
        });
    }

    public sortFindings (groupType: TreeGroupingHierarchy) {
        log.debug(`Change grouping to: ${groupType}`);
        this.grouping = groupType;
    }
    
    public updateFilterMitigations (mitigationFilter: FilterMitigation) {
        log.debug(`Change mitigation filtering to: ${mitigationFilter}`);
        this.filterMitigation = mitigationFilter;
    }

    public updateFilterImpactPolicy(impactPolicyFilter:FilterByPolicyImpact) {
        log.debug(`change impact policy filtering to: ${impactPolicyFilter}`);
        this.filterEffectingPolicy = impactPolicyFilter;
    }

    public getFlawsOfSeverityNode(severityNode:VeracodeNode): Promise<VeracodeNode[]> {
        //^[\w-]*-sev-(.*)$
        const statusMatch = severityNode.id.match(/^[\w-]*-sev-(.*)$/);
        const scanResults: [] = this.cache[severityNode.parent];
        return new Promise((resolve, reject) => {
            if (scanResults && statusMatch && statusMatch[1]) {
                const status = parseInt(statusMatch[1]);
                resolve(scanResults.filter((itemPreFilter) => {
                    return (this.isPassAllFilters(itemPreFilter)) && getNested(itemPreFilter,'finding_details','severity') === status }
                ).map((itemForMap) => {
                    const flawId = getNested(itemForMap,'issue_id');
                    const flawCWE = getNested(itemForMap,'finding_details','cwe','id');
                    const flawFile = getNested(itemForMap,'finding_details','file_name');
                    const flawLine = getNested(itemForMap,'finding_details','file_line_number');
                    const flaw = new VeracodeNode(NodeType.Flaw,
                        `#${flawId} - CWE-${flawCWE} - ${flawFile}:${flawLine}`,
                        `${severityNode.parent}-flaw-${flawId}`,
                        severityNode.id,
                        severityNode.parent,severityNode.appGUID,getNested(itemForMap,'violates_policy'));
                    flaw.raw = itemForMap;
                    flaw.setMitigationData(getNested(itemForMap,'finding_status','resolution_status'));
                    return flaw;    
                })
                );
            }
            reject([]); 
        }); 
    }

    public getFlawsOfCWENode(cweNode:VeracodeNode): Promise<VeracodeNode[]> {
        //^[\w-]*-cwe-(.*)$
        const cweMatch = cweNode.id.match(/^[\w-]*-cwe-(.*)$/);
        const scanResults: [] = this.cache[cweNode.parent];
        return new Promise((resolve, reject) => {
            if (cweMatch && cweMatch[1]) {
                const cweId = parseInt(cweMatch[1]);
                resolve(scanResults.filter((itemPreFilter) => {
                    return this.isPassAllFilters(itemPreFilter) && getNested(itemPreFilter,'finding_details','cwe','id') === cweId }
                ).map((itemForMap) => {
                    const flawId = getNested(itemForMap,'issue_id');
                    const flawFile = getNested(itemForMap,'finding_details','file_name');
                    const flawLine = getNested(itemForMap,'finding_details','file_line_number');
                    const flaw = new VeracodeNode(NodeType.Flaw,
                        `#${flawId} - ${flawFile}:${flawLine}`,
                        `${cweNode.parent}-flaw-${flawId}`,
                        cweNode.id,
                        cweNode.sandboxGUID,cweNode.appGUID,getNested(itemForMap,'violates_policy'));
                    flaw.raw = itemForMap;
                    flaw.setMitigationData(getNested(itemForMap,'finding_status','resolution_status'));
                    return flaw;  
                })
                );
            }
            reject([]); 
        }); 
    }

    public getFlawsOfFlawCategoryNode(flawCatNode:VeracodeNode): Promise<VeracodeNode[]> {
        //^[\w-]*-cwe-(.*)$
        const flawCatMatch = flawCatNode.id.match(/^[\w-]*-flawcat-(.*)$/);
        const scanResults: [] = this.cache[flawCatNode.parent];
        return new Promise((resolve, reject) => {
            if (flawCatMatch && flawCatMatch[1]) {
                const flawCategoryId = parseInt(flawCatMatch[1]);
                resolve(scanResults.filter((itemPreFilter) => {
                    return this.isPassAllFilters(itemPreFilter) && getNested(itemPreFilter,'finding_details','finding_category','id') === flawCategoryId }
                ).map((itemForMap) => {
                    const flawId = getNested(itemForMap,'issue_id');
                    const flawFile = getNested(itemForMap,'finding_details','file_name');
                    const flawLine = getNested(itemForMap,'finding_details','file_line_number');
                    const flawCWE = getNested(itemForMap,'finding_details','cwe','id');
                    const flawSeverity = SeverityNames[getNested(itemForMap,'finding_details','severity')];
                    const flaw = new VeracodeNode(NodeType.Flaw,
                        `#${flawId} - ${flawSeverity} - CWE-${flawCWE} - ${flawFile}:${flawLine}`,
                        `${flawCatNode.parent}-flaw-${flawId}`,
                        flawCatNode.id,
                        flawCatNode.sandboxGUID,flawCatNode.appGUID,getNested(itemForMap,'violates_policy'));
                    flaw.raw = itemForMap;
                    flaw.setMitigationData(getNested(itemForMap,'finding_status','resolution_status'));
                    return flaw;  
                })
                );
            }
            reject([]); 
        }); 
    }
}

