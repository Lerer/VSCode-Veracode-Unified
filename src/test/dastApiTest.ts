import * as dotenv from 'dotenv';
import { listSpecifications, submitSpecifications } from '../apiWrappers/apiSpecificationAPIWrapper';

import { CredsHandler } from "../util/credsHandler";

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

const testSet = async () => {
    await testSubmitNewApiSpec();
    await testListApiSpecifications();
}

testSet();
