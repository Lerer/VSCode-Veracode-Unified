'use strict';

import log = require('loglevel');
import { ConfigSettings } from './configSettings';

// deliberately don't interact with the 'context' here - save that for the calling classes

export class ProxySettings {

    constructor(private m_ipAddr: string, private m_port: string, private m_username: string, private m_password: string) { }

    public get proxyIpAddr(): string { return this.m_ipAddr; }
    public get proxtPort(): string { return this.m_port;}
    public get proxyUserName(): string { return this.m_username; }
    public get proxyPassword(): string { return this.m_password; }

    public toString(): string {
        return("Server: " + this.m_ipAddr + ":" + this.m_port + ", login: " + this.m_username + ":" + this.m_password);
    }
}

export class ProxyHandler {

    // class properties
    private m_proxySettings: ProxySettings = null;

    // @constructor
    constructor(private m_configSettings: ConfigSettings) {
    }

    public loadProxySettings() {
        this.m_proxySettings = this.m_configSettings.getProxySettings();
    }
    public get proxySettings(): ProxySettings {
        return this.m_proxySettings;
    }
}