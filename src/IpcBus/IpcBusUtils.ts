// Constants
export const IPC_BUS_RENDERER_SUBSCRIBE = "IPC_BUS_RENDERER_SUBSCRIBE";
export const IPC_BUS_RENDERER_UNSUBSCRIBE = "IPC_BUS_RENDERER_UNSUBSCRIBE";
export const IPC_BUS_RENDERER_SEND = "IPC_BUS_RENDERER_SEND";
export const IPC_BUS_RENDERER_REQUEST = "IPC_BUS_RENDERER_REQUEST";
export const IPC_BUS_RENDERER_RECEIVE = "IPC_BUS_RENDERER_RECEIVE";
export const IPC_BUS_RENDERER_QUERYSTATE = "IPC_BUS_RENDERER_QUERYSTATE";

export const IPC_BUS_COMMAND_SUBSCRIBETOPIC = "subscribeTopic";
export const IPC_BUS_COMMAND_UNSUBSCRIBETOPIC = "unsubscribeTopic";
export const IPC_BUS_COMMAND_SENDMESSAGE = "sendMessage";
export const IPC_BUS_COMMAND_REQUESTMESSAGE = "requestMessage";
export const IPC_BUS_COMMAND_QUERYSTATE = "queryState";
export const IPC_BUS_EVENT_SENDMESSAGE = "onSendMessage";
export const IPC_BUS_EVENT_REQUESTMESSAGE = "onRequestMessage";

function uuid(): string {
    return Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
}

/** @internal */
export function GenerateReplyTopic(): string {
    return "replyTopic/" + uuid();
}

/** @internal */
function GetCmdLineArgValue(argName: string): string {
    for (let i = 0; i < process.argv.length; ++i) {
        if (process.argv[i].startsWith("--" + argName)) {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

export class IpcOptions {
    port: any;
    host: string;

    isValid(): boolean {
        return (this.port != null);
    }
};

export function GetPortAndHost(busPath: string): IpcOptions {
    let ipcOptions: IpcOptions = new IpcOptions();
    if (busPath == null) {
        busPath = GetCmdLineArgValue("bus-path");
    }
    if (typeof busPath === "number") {
        ipcOptions.port = busPath;
        return ipcOptions;
    }
    if (typeof busPath !== "string") {
        return ipcOptions;
    }
    if ((busPath == null) || (busPath.length === 0)) {
        return ipcOptions;
    }
    let parts = busPath.split(":");
    if (parts.length === 1) {
        ipcOptions.port = parts[0];
    }
    else if (parts.length === 2) {
        ipcOptions.host = parts[0];
        ipcOptions.port = parts[1];
    }
    return ipcOptions;
}

// export interface TopicConnectionMapCB { (peerNames?: Map<string, number>, conn?: any, topic?: string, count?: number): void };

/** @internal */
export class TopicConnectionMap {

    private _name: string;
    private _topicsMap: Map<string, Map<any, Map<string, number>>>;

    constructor(name: string) {
        this._name = name;
        this._topicsMap = new Map<string, Map<any, Map<string, number>>>();
    }

    private _log(str: string) {
        console.log("[" + this._name + "] " + str);
    }

    private _warn(str: string) {
        console.warn("[" + this._name + "] " + str);
    }

    private _error(str: string) {
        console.error("[" + this._name + "] " + str);
    }

    public addRef(topic: string, conn: any, peerName: string, callback?: Function) {
        this._log("AddRef: " + topic + " : conn " + conn);

        let connsMap = this._topicsMap.get(topic);
        if (connsMap == null) {
            connsMap = new Map<any, Map<string, number>>();
            // This topic has NOT been subscribed yet, add it to the map
            this._topicsMap.set(topic, connsMap);
            this._log("AddRef: topic '" + topic + "' is added");
        }
        let peerNamesMap = connsMap.get(conn);
        if (peerNamesMap == null) {
            // This topic has NOT been already subscribed by this connection
            peerNamesMap = new Map<string, number>();
            connsMap.set(conn, peerNamesMap);
            this._log("AddRef: conn '" + conn + "' is added");
        }
        let count = peerNamesMap.get(peerName);
        if (count == null) {
            // This topic has NOT been already subcribed by this peername, by default 1
            count = 1;
            this._log("AddRef: peerName '" + peerName + "' is added");
        }
        else {
            ++count;
        }
        peerNamesMap.set(peerName, count);
        this._log("AddRef: topic '" + topic + "', conn " + conn + ", count = " + peerNamesMap.size);
        if ((callback instanceof Function) === true) {
            callback(topic, conn, peerName, peerNamesMap.size);
        }
    }

    private _release(topic: string, conn: any, peerName?: string, callback?: Function) {
        this._log("Release: " + topic + " conn " + conn);

        let connsMap = this._topicsMap.get(topic);
        if (connsMap == null) {
            this._warn("Release: topic '" + topic + "' is unknown");
        }
        else {
            let peerNamesMap = connsMap.get(conn);
            if (peerNamesMap == null) {
                this._warn("Release: conn '" + conn + "' is unknown");
            }
            else {
                if (peerName == null) {
                    let peerNamesTemp = new Array<string>();
                    for (let peerName of peerNamesMap.keys()) {
                        peerNamesTemp.push(peerName);
                    }
                    // Test callback first to manage performance
                    if ((callback instanceof Function) === true) {
                        for (let peerName of peerNamesTemp) {
                            peerNamesMap.delete(peerName);
                            callback(topic, conn, peerName, peerNamesMap.size);
                        }
                    }
                    else {
                        for (let peerName of peerNamesTemp) {
                            peerNamesMap.delete(peerName);
                        }
                    }
                }
                else {
                    let count = peerNamesMap.get(peerName);
                    if (count == null) {
                        this._warn("Release: peername '" + peerName + "' is unknown");
                    }
                    else {
                        // This connection has subscribed to this topic
                        --count;
                        if (count > 0) {
                            peerNamesMap.set(peerName, count);
                        } else {
                            // The connection is no more referenced
                            peerNamesMap.delete(peerName);
                            this._log("Release: peerName '" + peerName + "' is released");
                        }
                    }
                    if ((callback instanceof Function) === true) {
                        callback(topic, conn, peerName, peerNamesMap.size);
                    }
                }
                if (peerNamesMap.size === 0) {
                    connsMap.delete(conn);
                    this._log("Release: conn '" + conn + "' is released");
                    if (connsMap.size === 0) {
                        this._topicsMap.delete(topic);
                        this._log("Release: topic '" + topic + "' is released");
                    }
                }
                this._log("Release: topic '" + topic + "', conn " + conn + ", count = " + peerNamesMap.size);
            }
        }
    }

    public release(topic: string, conn: any, peerName: string, callback?: Function) {
        this._release(topic, conn, peerName, callback);
    }

    public releaseConnection(conn: any, callback?: Function) {
        this._log("ReleaseConn: conn " + conn);

        // Store keys in an intermediate array
        // Not sure iterating and removing at the same time is well supported 
        let topicsTmp = new Array<string>();
        for (let topic of this._topicsMap.keys()) {
            topicsTmp.push(topic);
        }
        for (let topic of topicsTmp) {
            this._release(topic, conn, null, callback);
        }
    }

    public forEach(callback: Function) {
        this._log("ForEach");

        if ((callback instanceof Function) === false) {
            this._error("ForEach: No callback provided !");
            return;
        }

        this._topicsMap.forEach((connsMap: Map<any, Map<string, number>>, topic: string) => {
            callback(connsMap, topic);
        });
    }

    public forEachTopic(topic: string, callback: Function) {
        this._log("ForEachTopic: " + topic);

        if ((callback instanceof Function) === false) {
            this._error("ForEachTopic: No callback provided !");
            return;
        }

        let connsMap = this._topicsMap.get(topic);
        if (connsMap == null) {
            this._warn("ForEachTopic: Unknown topic '" + topic + "' !");
        }
        else {
            connsMap.forEach((peerNames: Map<string, number>, conn: any) => {
                this._warn("ForEachTopic: '" + topic + "' = " + conn + " (" + peerNames.size + ")");
                callback(peerNames, conn, topic);
            });
        }
    }

    public forEachConnection(callback: Function) {
        this._log("ForEachConn");

        if ((callback instanceof Function) === false) {
            this._error("ForEachConn: No callback provided !");
            return;
        }

        this._topicsMap.forEach((connsMap: Map<any, Map<string, number>>, topic: string) => {
            connsMap.forEach(function (peerNames: Map<string, number>, conn: any) {
                callback(peerNames, conn, topic);
            });
        });
    }
}
