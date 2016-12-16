/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import {EventEmitter} from 'events';
import {Ipc as BaseIpc} from 'easy-ipc';
//import BaseIpc from 'easy-ipc';
import {IpcBusBroker} from "./IpcBusInterfaces";
import * as IpcBusUtils from './IpcBusUtils';

class IpcBusBrokerProc {
    _baseIpc : BaseIpc;
    _subscriptions : IpcBusUtils.TopicConnectionMap; 

    constructor(baseIpc : BaseIpc){
        this._baseIpc = baseIpc;
        this._subscriptions = new IpcBusUtils.TopicConnectionMap(); 
        this._baseIpc.on('connection', (conn : any, server : any) => this.onConnection(conn, server));
        this._baseIpc.on('close', (err : any, conn : any, server : any) => this.onClose(err, conn, server));
        this._baseIpc.on('data', (data : any, conn : any, server  : any) => this.onData(data, conn, server));
    }

    onConnection(conn : any, server : any) : void {
         console.log("[IPCBus:Broker] Incoming connection !");
         conn.on("error", function (err : string) {
             console.log("[IPCBus:Broker] Error on connection : " + err);
         });
    }

    onClose(err : any, conn : any, server : any) : void {
        this._subscriptions.releaseConnection(conn);
        console.log("[IPCBus:Broker] Connection closed !");
     }

    onData(data : any, conn : any, server : any) : void {
        if (BaseIpc.Cmd.isCmd(data) == true) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " subscribed to topic '" + msgTopic + "'")
                        this._subscriptions.addRef(msgTopic, conn, msgPeerName);
                        break
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " unsubscribed from topic '" + msgTopic + "'")
                        this._subscriptions.release(msgTopic, conn, msgPeerName);
                        break
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDTOPICMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' from peer #" + msgPeerName)

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames : Map<string, number>, conn : any, topic : string) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_TOPICMESSAGE, topic, msgContent, msgPeerName, conn)
                        })
                        break
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDREQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgReplyTopic = data.args[2] as string;
                        const msgPeerName = data.args[3] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' (reply = '" + msgReplyTopic + "') from peer #" + msgPeerName);

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames : Map<string, number>, conn : any, topic : string) {
                            // Request data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, topic, msgContent, msgReplyTopic, msgPeerName, conn)
                        })
                        break
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE:
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
                        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, queryStateResult, msgPeerName, conn)
                        break;
                    }
            }
        }
    }
}


// Implementation for Broker process
export class IpcBusBrokerClient implements IpcBusBroker {
    private _baseIpc : BaseIpc;
    private _ipcServer : any = null;
    private _busPath : string = null;
    private _ipcBusBrokerProc : IpcBusBrokerProc;

    constructor(busPath? : string) {
        this._baseIpc = new BaseIpc();
        if (busPath == null) {
            this._busPath = IpcBusUtils.GetCmdLineArgValue('bus-path');
        }
        else{
            this._busPath = busPath;
        }
        this._ipcBusBrokerProc = new IpcBusBrokerProc(this._baseIpc);
    }

    // Set API
    start() {
        let self = this; // closure
        this._baseIpc.on('listening', function (server : any) {
            self._ipcServer = server;
            console.log("[IPCBus:Broker] Listening for incoming connections on '" + self._busPath + "' ...");
        })
        this._baseIpc.listen(this._busPath);
    }

    stop() {
       this._ipcServer.close();
       this._ipcServer = null;
    }
}

