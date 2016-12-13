/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>
/// <reference path="IpcBusConstants.ts" />
/// <reference path="IpcBusInterfaces.ts" />
/// <reference path="TopicConnectionMap.ts" />

import {EventEmitter} from 'events';
import {Ipc as BaseIpc, IpcCmd as BaseIpcCmd} from 'easy-ipc';

// import {*} from "IpcBusInterfaces";

// import {TopicConnectionMap} from "TopicConnectionMap";

// import {ElectronIpcBus} from 'IpcBusConstants';
 
function _getCmdLineArgValue(argName : string) {

    for (let i = 0; i < process.argv.length; i++) {

        if (process.argv[i].startsWith("--" + argName)) {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

// Implementation for Broker process
class IpcBusBrokerImpl {
    _baseIpc : BaseIpc = new BaseIpc();
    _ipcServer : any = null;
    _busPath : string = null;
    _ipcBusBrokerProc : IpcBusBrokerProc;

    constructor(busPath? : string) {
        if (busPath == null) {
            this._busPath = _getCmdLineArgValue('bus-path')
        }
        else{
            this._busPath = busPath;
        }
    }

    // Set API
    start() {
        this._baseIpc.on('listening', function (server : any) {
            this._ipcServer = server;
            console.log("[IPCBus:Broker] Listening for incoming connections on '" + this._busPath + "' ...");
            this._ipcBusBrokerProc = new IpcBusBrokerProc(this._baseIpc);
        })
        this._baseIpc.listen(this._busPath);
    }

    stop() {
       this._ipcServer.close();
       this._ipcServer = null;
       this._ipcBusBrokerProc = null;
    }
}

class IpcBusBrokerProc {
    _baseIpc : BaseIpc;
    _subscriptions : ElectronIpcBus.TopicConnectionMap = new ElectronIpcBus.TopicConnectionMap(); 

    constructor(baseIpc : BaseIpc){
        this._baseIpc = baseIpc;
        this._baseIpc.on('connection', this.onConnection);
        this._baseIpc.on('close', this.onClose);
        this._baseIpc.on('data', this.onData);
    }

    onConnection(conn : any, server  : any) : void {
         console.log("[IPCBus:Broker] Incoming connection !");
         conn.on("error", function (err : string) {
             console.log("[IPCBus:Broker] Error on connection : " + err);
         });
    }

    onClose(err : any, conn : any, server : any) : void {
        this._subscriptions.releaseConnection(conn);
        console.log("[IPCBus:Broker] Connection closed !");
     }

    onData(data : any, conn : any, server  : any) : void {
        if (BaseIpcCmd.isCmd(data) == true) {
            switch (data.name) {
                case ElectronIpcBus.IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " subscribed to topic '" + msgTopic + "'")
                        this._subscriptions.addRef(msgTopic, conn, msgPeerName);
                        break
                    }
                case ElectronIpcBus.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " unsubscribed from topic '" + msgTopic + "'")
                        this._subscriptions.release(msgTopic, conn, msgPeerName);
                        break
                    }
                case ElectronIpcBus.IPC_BUS_COMMAND_SENDTOPICMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' from peer #" + msgPeerName)

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames : Map<string, number>, conn : any, topic : string) {
                            // Send data to subscribed connections
                            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_EVENT_TOPICMESSAGE, topic, msgContent, msgPeerName, conn)
                        })
                        break
                    }
                case ElectronIpcBus.IPC_BUS_COMMAND_SENDREQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgReplyTopic = data.args[2] as string;
                        const msgPeerName = data.args[3] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' (reply = '" + msgReplyTopic + "') from peer #" + msgPeerName);

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames : Map<string, number>, conn : any, topic : string) {
                            // Request data to subscribed connections
                            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_EVENT_REQUESTMESSAGE, topic, msgContent, msgReplyTopic, msgPeerName, conn)
                        })
                        break
                    }
                case ElectronIpcBus.IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName  = data.args[1] as string;
                        console.log("[IPCBus:Broker] QueryState message reply on topic : " + msgTopic + " from peer #" + msgPeerName);

                        let queryStateResult : any = [];
                        this._subscriptions.forEachConnection(function (peerNames : Map<string, number>, conn : any, topic : string) {
                            peerNames.forEach(function (count, peerName) {
                                queryStateResult.push({ topic: topic, peerName: peerName, count: count })
                            })
                        })
                        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, queryStateResult, msgPeerName, conn)
                        break;
                    }
            }
        }
    }
}

