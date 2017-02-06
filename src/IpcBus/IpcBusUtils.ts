// Constants
export const IPC_BUS_RENDERER_HANDSHAKE = 'IpcBusRenderer:Handshake';
export const IPC_BUS_RENDERER_CONNECT = 'IpcBusRenderer:Connect';
export const IPC_BUS_RENDERER_CLOSE = 'IpcBusRenderer:Close';
export const IPC_BUS_RENDERER_COMMAND = 'IpcBusRenderer:Command';
export const IPC_BUS_RENDERER_EVENT = 'IpcBusRenderer:Event';

export const IPC_BUS_COMMAND_CONNECT = 'IpcBusCommand:connect';
export const IPC_BUS_COMMAND_CLOSE = 'IpcBusCommand:close';
export const IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL = 'IpcBusCommand:subscribeChannel';
export const IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL = 'IpcBusCommand:unsubscribeChannel';
export const IPC_BUS_COMMAND_SENDMESSAGE = 'IpcBusCommand:sendMessage';
export const IPC_BUS_COMMAND_REQUESTMESSAGE = 'IpcBusCommand:requestMessage';
export const IPC_BUS_COMMAND_REQUESTRESPONSE = 'IpcBusCommand:requestResponse';
export const IPC_BUS_COMMAND_REQUESTCANCEL = 'IpcBusCommand:requestCancel';

export const IPC_BUS_EVENT_SENDMESSAGE = 'IpcBusEvent:onSendMessage';
export const IPC_BUS_EVENT_REQUESTMESSAGE = 'IpcBusEvent:onRequestMessage';
export const IPC_BUS_EVENT_REQUESTRESPONSE = 'IpcBusEvent:onRequestResponse';

export const IPC_BUS_TIMEOUT = 2000;

export function uuid(): string {
    return Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
}

/** @internal */
export function GenerateReplyChannel(): string {
    return '/electron-ipc-bus/request-reply/' + uuid();
}

/** @internal */
function GetCmdLineArgValue(argName: string): string {
    for (let i = 0; i < process.argv.length; ++i) {
        if (process.argv[i].startsWith('--' + argName)) {
            const argValue = process.argv[i].split('=')[1];
            return argValue;
        }
    }
    return null;
}

/** @internal */
export class IpcOptions {
    port: any;      // with easy ipc, port can be either a number or a string (Function support is hidden).
    host: string;

    isValid(): boolean {
        return (this.port != null);
    }
};

// This method may be called from a pure JS stack.
// It means we can not trust type and we have to check it.
export function ExtractIpcOptions(busPath: string): IpcOptions {
    let ipcOptions: IpcOptions = new IpcOptions();
    if (busPath == null) {
        busPath = GetCmdLineArgValue('bus-path');
    }
    if (busPath != null) {
        if (typeof busPath === 'number') {
            ipcOptions.port = busPath;
        }
        else if (typeof busPath === 'string') {
            let parts = busPath.split(':');
            if (parts.length === 1) {
                ipcOptions.port = parts[0];
            }
            else if (parts.length === 2) {
                ipcOptions.host = parts[0];
                ipcOptions.port = parts[1];
            }
        }
    }
    return ipcOptions;
}

// Helper to get a valid service channel namespace
export function getServiceNamespace(serviceName: string): string {
    return `/electron-ipc-bus/ipc-service/${serviceName}`;
}

// Helper to get the call channel related to given service
export function getServiceCallChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/call';
}

// Helper to get the event channel related to given service
export function getServiceEventChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/event';
}

/** @internal */
export class Logger {
    public static enable: boolean = false;

    static info(msg: string) {
        console.log(msg);
    }

    static warn(msg: string) {
        console.warn(msg);
    }

    static error(msg: string) {
        console.error(msg);
    }
};

/** @internal */
export class ChannelConnectionMap<T extends string | number> {
    private _name: string;
    private _channelsMap: Map<string, Map<T, ChannelConnectionMap.ConnectionData<T>>>;

    constructor(name: string) {
        this._name = name;
        this._channelsMap = new Map<string, Map<T, ChannelConnectionMap.ConnectionData<T>>>();
    }

    private _info(str: string) {
        Logger.info(`[${this._name}] ${str}`);
    }

    private _warn(str: string) {
        Logger.warn(`[${this._name}] ${str}`);
    }

    private _error(str: string) {
       Logger.error(`[${this._name}] ${str}`);
    }

    public hasChannel(channel: string): boolean {
        return this._channelsMap.has(channel);
    }

    public addRef(channel: string, connKey: T, conn: any, peerName: string, callback?: ChannelConnectionMap.MapHandler<T>) {
        Logger.enable && this._info(`AddRef: '${channel}', connKey = ${connKey}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            connsMap = new Map<T, ChannelConnectionMap.ConnectionData<T>>();
            // This channel has NOT been subscribed yet, add it to the map
            this._channelsMap.set(channel, connsMap);
            // Logger.enable && this._info(`AddRef: channel '${channel}' is added`);
        }
        let connData = connsMap.get(connKey);
        if (connData == null) {
            // This channel has NOT been already subscribed by this connection
            connData = new ChannelConnectionMap.ConnectionData<T>(connKey, conn);
            connsMap.set(connKey, connData);
            // Logger.enable && this._info(`AddRef: connKey = ${connKey} is added`);
        }
        let count = connData.peers.get(peerName);
        if (count == null) {
            // This channel has NOT been already subcribed by this peername, by default 1
            count = 1;
            // Logger.enable && this._info(`AddRef: peerName #${peerName} is added`);
        }
        else {
            ++count;
        }
        connData.peers.set(peerName, count);
        Logger.enable && this._info(`AddRef: '${channel}', connKey = ${connKey}, count = ${connData.peers.size}`);
        if ((callback instanceof Function) === true) {
            callback(channel, peerName, connData);
        }
    }

    private _release(channel: string, connKey: T, peerName: string, removeAll: boolean, callback?: ChannelConnectionMap.MapHandler<T>) {
        Logger.enable && this._info(`Release: '${channel}', connKey = ${connKey}`);

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`Release: '${channel}' is unknown`);
        }
        else {
            let connData = connsMap.get(connKey);
            if (connData == null) {
                Logger.enable && this._warn(`Release: connKey = ${connKey} is unknown`);
            }
            else {
                if (peerName == null) {
                    // Test callback first to manage performance
                    if ((callback instanceof Function) === true) {
                        // ForEach is supposed to support deletion during the iteration !
                        connData.peers.forEach((count, peerName) => {
                            connData.peers.delete(peerName);
                            callback(channel, peerName, connData);
                        });
                    }
                    else {
                        connData.peers.clear();
                    }
                }
                else {
                    let count = connData.peers.get(peerName);
                    if (count == null) {
                        Logger.enable && this._warn(`Release: peerName #${peerName} is unknown`);
                    }
                    else {
                        if (removeAll) {
                            if ((callback instanceof Function) === true) {
                                while (count > 0) {
                                    --count;
                                     connData.peers.set(peerName, count);
                                     callback(channel, peerName, connData);
                                }
                            }
                            connData.peers.delete(peerName);
                        }
                        else {
                            // This connection has subscribed to this channel
                            --count;
                            if (count > 0) {
                                connData.peers.set(peerName, count);
                            } else {
                                // The connection is no more referenced
                                connData.peers.delete(peerName);
                                // Logger.enable && this._info(`Release: peerName #${peerName} is released`);
                            }
                            if ((callback instanceof Function) === true) {
                                callback(channel, peerName, connData);
                            }
                        }
                    }
                }
                if (connData.peers.size === 0) {
                    connsMap.delete(connKey);
                    // Logger.enable && this._info(`Release: conn = ${connKey} is released`);
                    if (connsMap.size === 0) {
                        this._channelsMap.delete(channel);
                        // Logger.enable && this._info(`Release: channel '${channel}' is released`);
                    }
                }
                Logger.enable && this._info(`Release: '${channel}', connKey = ${connKey}, count = ${connData.peers.size}`);
            }
        }
    }

    // public releaseAll(channel: string, callback?: ChannelConnectionMap.MapHandler<T>) {
    //     Logger.enable && this._info(`releaseAll: channel = ${channel}`);
    //     let connsMap = this._channelsMap.get(channel);
    //     if (connsMap == null) {
    //         Logger.enable && this._warn(`Release: '${channel}' is unknown`);
    //     }
    //     // while
    //     // releaseConnection
    // }

    public release(channel: string, connKey: T, peerName: string, callback?: ChannelConnectionMap.MapHandler<T>) {
        this._release(channel, connKey, peerName, false, callback);
    }

    public releasePeerName(channel: string, connKey: T, peerName: string, callback?: ChannelConnectionMap.MapHandler<T>) {
        Logger.enable && this._info(`releasePeerName: connKey = ${connKey}, peerName = ${peerName}`);
        this._release(channel, connKey, peerName, true, callback);
    }

    public releaseConnection(connKey: T, callback?: ChannelConnectionMap.MapHandler<T>) {
        Logger.enable && this._info(`ReleaseConn: connKey = ${connKey}`);

        // ForEach is supposed to support deletion during the iteration !
        this._channelsMap.forEach((connsMap, channel) => {
            this._release(channel, connKey, null, false, callback);
        });
    }

    public forEachChannel(channel: string, callback: ChannelConnectionMap.ForEachHandler<T>) {
        Logger.enable && this._info(`forEachChannel: '${channel}'`);

        if ((callback instanceof Function) === false) {
            Logger.enable && this._error('forEachChannel: No callback provided !');
            return;
        }

        let connsMap = this._channelsMap.get(channel);
        if (connsMap == null) {
            Logger.enable && this._warn(`forEachChannel: Unknown channel '${channel}' !`);
        }
        else {
            connsMap.forEach((connData, connKey) => {
                Logger.enable && this._info(`forEachChannel: '${channel}', connKey = ${connKey} (${connData.peers.size})`);
                callback(connData, channel);
            });
        }
    }

    public forEach(callback: ChannelConnectionMap.ForEachHandler<T>) {
        Logger.enable && this._info('forEach');

        if ((callback instanceof Function) === false) {
            Logger.enable && this._error('forEach: No callback provided !');
            return;
        }

        this._channelsMap.forEach((connsMap, channel: string) => {
            connsMap.forEach((connData, connKey) => {
                Logger.enable && this._info(`forEach: '${channel}', connKey = ${connKey} (${connData.peers.size})`);
                callback(connData, channel);
            });
        });
    }
}

/** @internal */
export namespace ChannelConnectionMap {
    /** @internal */
    export class ConnectionData<T extends string | number> {
        readonly connKey: T;
        readonly conn: any;
        peers: Map<string, number> = new Map<string, number>();

        constructor(connKey: T, conn: any) {
            this.connKey = connKey;
            this.conn = conn;
        }
    }

    /** @internal */
    export interface MapHandler<T extends string | number> {
        (channel: string, peerName: string, connData: ConnectionData<T>): void;
    };

    /** @internal */
    export interface ForEachHandler<T extends string | number> {
        (ConnectionData: ConnectionData<T>, channel: string): void;
    };
};

