import { getApplicationByName,getSandboxList,getApplications, getSandboxByName } from "../apiWrappers/applicationsAPIWrapper";
import { getSandboxFindings } from "../apiWrappers/findingsAPIWrapper";
import { CredsHandler } from "../util/credsHandler";
import { VeracodeNode, NodeType } from "../models/dataTypes";


const credHandler = new CredsHandler('/Users/ylerer/.veracode/credentials','default');
const testGetApplications = async () => {
    await credHandler.loadCredsFromFile();
    const apps = await getApplications(credHandler,null);
    console.log("printing from Test");
    console.log(apps);
}

const testGetApplicationByName = async () => {
    await credHandler.loadCredsFromFile();
    const apps = await getApplicationByName(credHandler,null,'test-commandline');
    console.log("printing from Test");
    console.log(apps);
}

const testSandboxList = async () => {
    await credHandler.loadCredsFromFile();
    const sandboxes = await getSandboxList(credHandler,null,'24ca9d18-8988-4859-a66c-2f329ed17dcd');
    console.log("printing from Test");
    console.log(sandboxes);
}

const testGetSandboxByName = async () => {
    await credHandler.loadCredsFromFile();
    const sandbox = await getSandboxByName(credHandler,null,'24ca9d18-8988-4859-a66c-2f329ed17dcd','test1');
    console.log("printing from Test");
    console.log(sandbox);
}

const testGetSandboxFindings = async () => {
    await credHandler.loadCredsFromFile();
    const sandboxNode: VeracodeNode = new VeracodeNode(NodeType.Sandbox,'test1','272d28d4-45f7-4c50-b123-ed9c1c6b383b','24ca9d18-8988-4859-a66c-2f329ed17dcd');
    const findings = await getSandboxFindings(sandboxNode,credHandler,null,20);

    console.log(findings);
}

const matchTest = () => {
    const id = '24ca9d18-8988-4859-a66c-2f329ed17dcd-sev-7';
    const match = id.match(/^[\w-]*-sev-(.*)$/);
    console.log(match!.length);
    console.log(match![0]);
    console.log(match![1]);
}


const testSet = async () => {
    await testGetApplications();
    //await testGetApplicationByName();
    await testSandboxList();
    //await testGetSandboxByName();
    await testGetSandboxFindings();
    //matchTest()
}

testSet();
