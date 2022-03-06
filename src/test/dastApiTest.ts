import * as dotenv from 'dotenv';
import { listSpecifications, submitSpecifications } from '../apiWrappers/apiSpecificationAPIWrapper';
import { getAPIScanByName, listAPIScans, submitScan } from '../apiWrappers/wasAnalysesWrapper';

import { CredsHandler } from "../util/credsHandler";
import { getNested } from '../util/jsonUtil';

const API_SCAN_NAME = 'Petstore APIs';

dotenv.config();

const credFileLocation = process.env.CREDENTIALS_FILE_LOCATION || '~/.veracode/credentials';
const credProfile = process.env.CREDENTIALS_PROFILE || 'default';

const credHandler = new CredsHandler(credFileLocation,credProfile);

const testSubmitNewApiSpec = async () => {
    // Set the spec file
    const testDataFilePath = 'test-data/petstore-swagger.json';

    // set the spec name
    const testSpecName = 'Test Specification 02';
    
    // load credentials
    await credHandler.loadCredsFromFile();

    // submit for specifications create/update
    const submission = await submitSpecifications(credHandler,null,testSpecName,testDataFilePath,undefined);
    console.log("printing from Test");
    console.log(submission);
}

const testListApiSpecifications = async () => {
    await credHandler.loadCredsFromFile();
    const specs = await listSpecifications(credHandler,null);
    console.log(specs._embedded);
}

const testSubmitAPIScan = async (scanName:string) => {
    await credHandler.loadCredsFromFile();
    const apiScan = await submitScan(credHandler,null,scanName,null);
    console.log(apiScan);
}


const testSet = async (tests:Array<boolean>) => {
    if (tests[0]) {
        await testSubmitNewApiSpec();
    }
    if (tests[1]) {
        await testListApiSpecifications();
    }
    if (tests[2]) {
        await testSubmitAPIScan(API_SCAN_NAME);
    }
}

testSet([false,false,true]);
