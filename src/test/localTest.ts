import { getApplicationByName,getSandboxList,getApplications, getSandboxByName } from "../apiWrappers/applicationsAPIWrapper";
import { CredsHandler } from "../util/credsHandler";


const credHandler = new CredsHandler('/Users/ylerer/.veracode/credentials','default');
const test0 = async () => {
    await credHandler.loadCredsFromFile();
    const apps = await getApplications(credHandler,null);
    console.log("printing from Test");
    console.log(apps);
}

const test1 = async () => {
    await credHandler.loadCredsFromFile();
    const apps = await getApplicationByName(credHandler,null,'test-commandline');
    console.log("printing from Test");
    console.log(apps);
}

const test2 = async () => {
    await credHandler.loadCredsFromFile();
    const sandboxes = await getSandboxList(credHandler,null,'24ca9d18-8988-4859-a66c-2f329ed17dcd');
    console.log("printing from Test");
    console.log(sandboxes);
}

const test3 = async () => {
    await credHandler.loadCredsFromFile();
    const sandbox = await getSandboxByName(credHandler,null,'24ca9d18-8988-4859-a66c-2f329ed17dcd','test1');
    console.log("printing from Test");
    console.log(sandbox);
}


const testSet = async () => {
    //await test0();
    //await test1();
    await test2();
    await test3();
}

testSet();
