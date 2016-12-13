/// <reference types="node" />

namespace ElectronIpcBus {

import {uuid} from 'uuid';

export function _generateReplyTopic() : string {

    return 'replyTopic/' + uuid.v4()
}

export interface TopicConnectionMapCB { (peerNames? : Map<string, number>, conn? : any, topic? : string, count? : number) : void };

export class TopicConnectionMap {

    private topicsMap : Map<string, Map<any, Map<string, number>>> = new Map<string, Map<any, Map<string, number>>>();

    constructor(){
    }

    private _log(str : string) {
        console.log("[" + this.constructor.name + "] " + str);
    }

    private _warn(str : string) {
        console.warn("[" + this.constructor.name + "] " + str);
    }

    private _error(str : string) {
        console.error("[" + this.constructor.name + "] " + str);
    }

    public addRef(topic : string, conn : any, peerName : string, callback? : Function) {
        this._log("AddRef : " + topic + "  : conn " + conn)

        let connsMap = this.topicsMap.get(topic);
        if (connsMap == null) {
            connsMap = new Map<any, Map<string, number>>();
            // This topic has NOT been subscribed yet, add it to the map
            this.topicsMap.set(topic, connsMap);
            this._log("AddRef : topic '" + topic + "' is added");
        }
        let peerNamesMap = connsMap.get(conn)
        if (peerNamesMap == null) {
            // This topic has NOT been already subscribed by this connection
            peerNamesMap = new Map<string, number>();
            connsMap.set(conn, peerNamesMap);
            this._log("AddRef : conn '" + conn + "' is added");
        }
        let count = peerNamesMap.get(peerName);
        if (count == null) {
            // This topic has NOT been already subcribed by this peername, by default 1
            count = 1;
            this._log("AddRef : peerName '" + peerName + "' is added");
        }
        else {
            ++count;
        }
        peerNamesMap.set(peerName, count);
        this._log("AddRef : topic '" + topic + "', conn " + conn + ", count = " + peerNamesMap.size);
        if (callback != null) {
            callback(topic, conn, peerName, peerNamesMap.size);
        }
    }

    private _release(topic : string, conn : any, peerName? : string, callback? : Function) {
        this._log("Release : " + topic + " conn " + conn)

        let connsMap = this.topicsMap.get(topic);
        if (connsMap == null) {
            this._warn("Release : topic '" + topic + "' is unknown");
        }
        else {
            let peerNamesMap = connsMap.get(conn);
            if (peerNamesMap != null) {
                this._warn("Release : conn '" + conn + "' is unknown");
            }
            else {
                if (peerName == null)
                {
                    let peerNamesTemp : Array<string> = new Array<string>();
                    for (let peerName of peerNamesMap.keys()) {
                        peerNamesTemp.push(peerName);
                    }
                    for (let peerName of peerNamesTemp) {
                        peerNamesMap.delete(peerName);
                        if (callback != null) {
                            callback(topic, conn, peerName, peerNamesMap.size);
                        }
                    }
                }
                else
                {
                    let count = peerNamesMap.get(peerName);
                    if (count == null) {
                        this._warn("Release : peername '" + peerName + "' is unknown");
                    }
                    else {
                        // This connection has subscribed to this topic
                        --count;
                        if (count > 0) {
                            peerNamesMap.set(peerName, count);
                        } else {
                            // The connection is no more referenced
                            peerNamesMap.delete(peerName);
                            this._log("Release : peerName '" + peerName + "' is released");
                        }
                    }
                    if (callback != null) {
                        callback(topic, conn, peerName, peerNamesMap.size);
                    }
                }
                if (peerNamesMap.size === 0) {
                    connsMap.delete(conn);
                    this._log("Release : conn '" + conn + "' is released");
                    if (connsMap.size === 0) {
                        this.topicsMap.delete(topic);
                        this._log("Release : topic '" + topic + "' is released");
                    }
                }
                this._log("Release : topic '" + topic + "', conn " + conn + ", count = " + peerNamesMap.size);
            }
        }
    }

    public release(topic : string, conn : any, peerName : string, callback? : Function) {
        this._release(topic, conn, peerName, callback);
    }


    public releaseConnection(conn : any, callback? : Function) {
        this._log("ReleaseConn : conn " + conn);

        // Store keys in an intermediate array
        // Not sure iterating and removing at the same time is well supported 
        var topicsTmp : Array<string> = new Array<string>();
        for (let topic of this.topicsMap.keys()) {
            topicsTmp.push(topic);
        }
        for (let topic of topicsTmp) {
            this._release(topic, conn, null, callback);
        }
    }

    public forEach(callback : Function) {
        this._log("ForEach");

        if (callback == null) {
            this._error("ForEach : No callback provided !");
            return;
        }

        this.topicsMap.forEach(function (connsMap, topic) {
            callback(connsMap, topic);
        });
    }

    public forEachTopic(topic : string, callback : Function) {
        this._log("ForEachTopic : " + topic);

        if (callback == null) {
            this._error("ForEachTopic : No callback provided !");
            return;
        }

        let connsMap = this.topicsMap.get(topic);
        if (connsMap == null) {
            this._warn("ForEachTopic : Unknown topic '" + topic + "' !");
        }
        else {
            connsMap.forEach(function (peerNames, conn) {
                this._warn("ForEachTopic : '" + topic + "' = " + conn + " (" + peerNames.size + ")");
                callback(peerNames, conn, topic);
            });
        }
    }

    public forEachConnection(callback : Function) {
        this._log("ForEachConn");

        if (typeof callback !== "function") {
            this._error("ForEachConn : No callback provided !");
            return;
        }

        this.topicsMap.forEach(function (connsMap, topic) {
            connsMap.forEach(function (peerNames, conn) {
                callback(peerNames, conn, topic);
            })
        })
    }
}

}