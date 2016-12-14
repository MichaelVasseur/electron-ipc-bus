/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>
/// <reference path="IpcBusConstants.ts" />
/// <reference path="IpcBusInterfaces.ts" />
/// <reference path="TopicConnectionMap.ts" />

import {EventEmitter} from 'events';
import {Ipc as BaseIpc, IpcCmd as BaseIpcCmd} from 'easy-ipc';
import {IpcBusNodeClient} from "./IpcBusNode";

class IpcBusBridge extends EventEmitter {
    _ipcObj : any;
    _topicRendererRefs : ElectronIpcBus.TopicConnectionMap;
    _webContents : any;
    _busConn : any;

    constructor(conn : any){
        super();
        this._busConn = conn;
        this._ipcObj = require("electron").ipcMain;
        this._topicRendererRefs = new ElectronIpcBus.TopicConnectionMap();
        this._webContents = require("electron").webContents;

        this._ipcObj.addListener(ElectronIpcBus.IPC_BUS_RENDERER_SUBSCRIBE, this.onSubscribe);
        this._ipcObj.addListener(ElectronIpcBus.IPC_BUS_RENDERER_UNSUBSCRIBE, this.onUnsubscribe);
        this._ipcObj.addListener(ElectronIpcBus.IPC_BUS_RENDERER_SEND, this.onSend);
        this._ipcObj.addListener(ElectronIpcBus.IPC_BUS_RENDERER_REQUEST, this.onRequest);
        this._ipcObj.addListener(ElectronIpcBus.IPC_BUS_RENDERER_QUERYSTATE, this.onQueryState);
        console.log("[IPCBus:Bridge] Installed");
    }

    rendererSubscribeHandler(msgTopic : string, msgContent : any, msgPeer : string) : void {
        console.log("[IPCBus:Bridge] message received on '" + msgTopic + "'")
        this._topicRendererRefs.forEachTopic(msgTopic, function (peerNames : Map<string, number>, valueId : any, topic : string) {
            const peerName = "Renderer_" + valueId;
            console.log("[IPCBus:Bridge] Forward message received on '" + topic + "' to peer #" + peerName);
            var currentWCs = this._webContents.fromId(valueId);
            if (currentWCs != undefined) {
                currentWCs.send(ElectronIpcBus.IPC_BUS_RENDERER_RECEIVE, topic, msgContent, msgPeer);
            }
        })
    }

    rendererCleanUp(wcsId : string) : void {
        this._topicRendererRefs.releaseConnection(wcsId, function (topic : string, conn : any, peerName : string, count : number) {
            if (count == 0) {
                console.log("[IPCBus:Bridge] Forward unsubscribe '" + topic + "' to IPC Broker")
                EventEmitter.prototype.removeListener.call(this, topic, this.rendererSubscribeHandler)
            }
            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn)
        })
    }

    onSubscribe(event : any, topic : string) : void {
        const currentWCs = event.sender;
        const peerName = "Renderer_" + currentWCs.id
        console.log("[IPCBus:Bridge] Peer #" + peerName + " subscribed to topic '" + topic + "'")
        this._topicRendererRefs.addRef(topic, currentWCs.id, peerName, function (keyTopic : string, valueId : any, peerName : string, count : number) {
            if (count == 1) {
                EventEmitter.prototype.addListener.call(this, topic, this.rendererSubscribeHandler)
                console.log("[IPCBus:Bridge] Forward subscribe '" + topic + "' to IPC Broker")
                currentWCs.on("destroyed", function () {
                    this.rendererCleanUp(valueId)
                })
            }
            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, this._busConn)
        })
    }

    onUnsubscribe(event : any, topic : string) {
        const currentWCs = event.sender;
        const peerName = "Renderer_" + currentWCs.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " unsubscribed from topic : '" + topic + "'");
        this._topicRendererRefs.release(topic, currentWCs.id, peerName, function (keyTopic : string, valueId : any, peerName : string, count : number) {
            if (count == 0) {
                console.log("[IPCBus:Bridge] Forward unsubscribe '" + topic + "' to IPC Broker");
                EventEmitter.prototype.removeListener.call(this, topic, this.rendererSubscribeHandler);
            }
            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn);
        })
    }

    onSend(event :any, topic : string, data : any) : void {
        const currentWCs = event.sender;
        const peerName = "Renderer_" + currentWCs.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " sent message on '" + topic + "'");
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SENDTOPICMESSAGE, topic, data, peerName, this._busConn);
    }

    onRequest(event : any, topic : string, data : any, replyTopic : string, timeoutDelay : number) : void {
        const currentWCs = event.sender;
        const peerName = "Renderer_" + currentWCs.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " sent request on '" + topic + "'");
        if (timeoutDelay === undefined) {

            timeoutDelay = 2000; // 2s by default
        }

        // Prepare reply's handler
        const replyHandler = function (replyTopic : string, content : any, peerName : string) {
            console.log('Peer #' + peerName + ' replied to request on ' + replyTopic + ' : ' + content);
            BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, replyTopic, peerName, this._busConn);
            currentWCs.send(ElectronIpcBus.IPC_BUS_RENDERER_RECEIVE, replyTopic, content, peerName);
        }
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SUBSCRIBETOPIC, replyTopic, peerName, this._busConn);
        // Execute request
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SENDREQUESTMESSAGE, topic, data, replyTopic, peerName, this._busConn);
    }

    onQueryState(event : any, topic : string, data : any) {
        const currentWCs = event.sender;
        const peerName = "Renderer_" + currentWCs.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " query Broker state on topic : '" + topic + "'");
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, this._busConn);
    }
}


// Implementation for Master process
export class IpcBusMasterClient extends IpcBusNodeClient {
    private _ipcBusBridge : IpcBusBridge;

    constructor(busPath? : string) {
        super(busPath);
        this._peerName = "Master";
    }

    // Set API
    connect(callback : Function) {
        super.connect(function(conn : any){
            this._ipcBusBridge = new IpcBusBridge(this._busConn);
            callback('connect', this._busConn);
        })
    }
}

