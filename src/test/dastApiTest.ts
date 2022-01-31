import * as dotenv from 'dotenv';
import { listSpecifications } from '../apiWrappers/apiSpecificationAPIWrapper';

import { CredsHandler } from "../util/credsHandler";

dotenv.config();

const credFileLocation = process.env.CREDENTIALS_FILE_LOCATION || '~/.veracode/credentials';
const credProfile = process.env.CREDENTIALS_PROFILE || 'default';

const credHandler = new CredsHandler(credFileLocation,credProfile);

// const testSubmitNewApiSpec = async () => {
//     await credHandler.loadCredsFromFile();
//     const apps = await submitNewApiSpec(credHandler,null);
//     console.log("printing from Test");
//     console.log(apps);
// }

const testListApiSpecifications = async () => {
    await credHandler.loadCredsFromFile();
    const specs = await listSpecifications(credHandler,null);
    console.log(specs._embedded);
}

const testSet = async () => {
    await testListApiSpecifications();
}

testSet();