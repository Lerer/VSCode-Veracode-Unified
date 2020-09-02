'use strict';

//import log = require('loglevel');
import { ConfigSettings } from './configSettings';

// deliberately don't interact with the 'context' here - save that for the calling classes

export class ProxySettings {

    constructor(private m_host: string, private m_port: string, private m_username: string, private m_password: string) { }

    public get proxyHost(): string { return this.m_host; }
    public get proxyPort(): string { return this.m_port;}
    public get proxyUserName(): string { return this.m_username; }
    public get proxyPassword(): string { return this.m_password; }

    public toString(): string {
        return("Server: " + this.m_host + ":" + this.m_port + ", login: " + 
                (this.m_username !== '' ? this.m_username : '<unset>') + ":" + 
                (this.m_password !== '' ? this.m_password : '<unset>') );
    }
}

export class ProxyHandler {

    // class properties
    private m_proxySettings: ProxySettings|null = null;

    // @constructor
    constructor(private m_configSettings: ConfigSettings) {
    }

    public loadProxySettings() {
        this.m_proxySettings = this.m_configSettings.getProxySettings();
    }
    
    public get proxySettings(): ProxySettings|null {
        return this.m_proxySettings;
    }
}