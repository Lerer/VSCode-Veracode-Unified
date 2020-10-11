'use strict'

import log = require('loglevel');
import {CredsHandler} from '../util/credsHandler';
import {ProxySettings} from '../util/proxyHandler';
import {User,UserRule} from '../models/identity-models';
import {APIHandler} from '../util/apiQueryHandler';

export class IdentityHandler {
    public static api_host:string = 'api.veracode.com';
    public static api_base_path:string = '/api/authn'
    //roles:Array<any> = [];
    
    constructor(private credentialHandler:CredsHandler, private proxySettings: ProxySettings|null) { }
    
    public async getCurrentUser(): Promise<User | undefined> {
        log.info('getCurrentUser');
        const requestPath = '/v2/users/self';
        let roles: UserRule[] = [];
        let currentUser :User;
        const jsonTxt = await APIHandler.request(
                IdentityHandler.api_host,
                IdentityHandler.api_base_path+ requestPath,
                {},
                this.credentialHandler,
                this.proxySettings
            )
            .then(resTxt => JSON.parse(resTxt))
            .then((userJson) => {
                log.info(userJson);
                log.info(userJson.roles);
                log.info(userJson.roles.map((role:any) =>  role.role_description));
                let roles: UserRule[] = userJson.roles.map((role:any) =>  {
                    return {
                        id: role.role_id,
                        name: role.role_name,
                        description: role.role_description
                    }
                });
                currentUser = {
                    email: userJson.email_address,
                    roles,
                    id: userJson.user_id,
                    name: userJson.user_name
                } as User;
            },(err) => {
                throw err;
            }); 
        return new Promise((resolve, reject) => {          
            return resolve(currentUser);
        });
    }


}