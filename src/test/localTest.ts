import { getApplicationByName } from "../apiWrappers/applicationsAPIWrapper";
import { CredsHandler } from "../util/credsHandler";


const credHandler = new CredsHandler('/Users/ylerer/.veracode/credentials','default');
const test1 = async () => {
    await credHandler.loadCredsFromFile();
    const apps = await getApplicationByName(credHandler,null,'Serverless async responder');
    console.log("printing from Test");
    console.log(apps);
}

test1();
