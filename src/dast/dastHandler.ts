import { window,workspace } from "vscode"
import { ProjectConfigHandler } from "../util/projectConfigHandler";
import {submitSpecifications} from '../apiWrappers/apiSpecificationAPIWrapper';
import { VeracodeExtensionModel } from "../veracodeExplorer";
import { ConfigSettings } from "../util/configSettings";
import { existsSync } from "fs";
import { getLogger } from "loglevel";
import { sep } from "path";

const dastLogger = getLogger('Veracode DAST');

export const submitSpecification = async (veracodeModel: VeracodeExtensionModel,configSettings: ConfigSettings) => {

    window.showInformationMessage('Submitting API Specification...');
    const projectConfig = new ProjectConfigHandler();
    await projectConfig.loadProjectConfigFromFile();

    if (!projectConfig.getAPISpecName() || projectConfig.getAPISpecName()?.trim().length === 0) {
        window.showErrorMessage('API Specification submission failed!  API Specification name must be defined in Project settings. Cannot submit API specifications without one');
        return;
    }

    let apiSpecFilePath = 'noffound';
    if (!projectConfig.getAPISpecPath() || projectConfig.getAPISpecPath()?.trim().length === 0) {
        window.showErrorMessage('API Specification submission failed!  API Specification name must be defined in Project settings. Cannot submit API specifications without one');
        return;
    } else {
        let root: string|undefined = (workspace!== undefined && workspace.workspaceFolders !==undefined) ? workspace.workspaceFolders[0].uri.fsPath : undefined;
        if (root===undefined) {
            window.showErrorMessage(`API Specification submission failed!  There is no open project`);
            return;
        }
        apiSpecFilePath = root + sep + projectConfig.getAPISpecPath();
        dastLogger.info("Will be looking spec file at: " + apiSpecFilePath);
        const specExists = existsSync(apiSpecFilePath);
        if (!specExists) {
            window.showErrorMessage(`API Specification submission failed!\nCannot access the specification file in path: ${apiSpecFilePath}`);
            return;
        } 
    }

    await submitAfterVerifications(veracodeModel,configSettings,projectConfig,apiSpecFilePath);
}

const submitAfterVerifications = async (veracodeModel: VeracodeExtensionModel,configSettings: ConfigSettings,projectConfig:ProjectConfigHandler,apiSpecFilePath:string) => {
    if (projectConfig.getAPISpecName() && projectConfig.getAPISpecPath()) {
        const proxySettings = configSettings.getProxySettings();
        try {
            await submitSpecifications(
                veracodeModel.credsHandler,
                proxySettings,
                projectConfig.getAPISpecName()!,
                apiSpecFilePath,
                projectConfig.getAPIBaseURL()
            );
            window.showInformationMessage('API Specification successfully submitted to Veracode');
        } catch (error) {
            if (error instanceof Error) {
                window.showErrorMessage(error.message);
                getLogger('APISecurity').error(error.message);
            }
        }
    }
}