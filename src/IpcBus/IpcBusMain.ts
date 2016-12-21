/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import { EventEmitter } from "events";
import * as BaseIpc from "easy-ipc";
import { IpcBusNodeClient } from "./IpcBusNode";
import * as IpcBusUtils from "./IpcBusUtils";
import * as IpcBusInterfaces from "./IpcBusInterfaces";

class IpcBusBridge {
    _ipcObj: any;
    _topicRendererRefs: IpcBusUtils.TopicConnectionMap;
    _webContents: any;
    _busConn: any;
    _eventEmitter: EventEmitter;
    _lambdaListenerHandler: Function;

    constructor(eventEmitter: EventEmitter, conn: any) {
        this._eventEmitter = eventEmitter;
        this._busConn = conn;
        this._ipcObj = require("electron").ipcMain;
        this._topicRendererRefs = new IpcBusUtils.TopicConnectionMap();
        this._webContents = require("electron").webContents;
        this._lambdaListenerHandler = (msgTopic: string, msgContent: any, msgPeer: string) => this.rendererSubscribeHandler(msgTopic, msgContent, msgPeer);

        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, (event: any, topic: string) => this.onSubscribe(event, topic));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, (event: any, topic: string) => this.onUnsubscribe(event, topic));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND, (event: any, topic: string, data: any) => this.onSend(event, topic, data));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, (event: any, topic: string, data: any, replyTopic: string, timeoutDelay: number) => this.onRequest(event, topic, data, replyTopic, timeoutDelay));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, (event: any, topic: string) => this.onQueryState(event, topic));
        console.log("[IPCBus:Bridge] Installed");
    }

    rendererSubscribeHandler(msgTopic: string, msgContent: any, msgPeer: string): void {
        console.log("[IPCBus:Bridge] message received on '" + msgTopic + "'");
        this._topicRendererRefs.forEachTopic(msgTopic, (peerNames: Map<string, number>, webContentsId: any, topic: string) => {
            const peerName = "Renderer_" + webContentsId;
            console.log("[IPCBus:Bridge] Forward message received on '" + topic + "' to peer #" + peerName);
            let webContents = this._webContents.fromId(webContentsId);
            if (webContents != null) {
                webContents.send(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, msgTopic, msgContent, msgPeer);
            }
        });
    }

    rendererCleanUp(webContentsId: any): void {
        this._topicRendererRefs.releaseConnection(webContentsId, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
    }

    onSubscribe(event: any, topic: string): void {
        const webContents = event.sender;
        const peerName = "Renderer_" + webContents.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " subscribed to topic '" + topic + "'");
        this._topicRendererRefs.addRef(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => {
            // If it is the first time this renderer is listening this topic, we have to add the callback
            if (count === 1) {
                EventEmitter.prototype.addListener.call(this._eventEmitter, topic, this._lambdaListenerHandler);
                console.log("[IPCBus:Bridge] Forward subscribe '" + topic + "' to IPC Broker");
                webContents.on("destroyed", () => {
                    this.rendererCleanUp(webContentsId);
                });
            }
            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, this._busConn);
        });
    }

    onUnsubscribeCB(topic: string, webContentsId: any, peerName: string, count: number) {
        // If it is the last time this renderer is listening this topic, we have to remove the callback
        if (count === 0) {
            console.log("[IPCBus:Bridge] Forward unsubscribe '" + topic + "' to IPC Broker");
            EventEmitter.prototype.removeListener.call(this._eventEmitter, topic, this._lambdaListenerHandler);
        }
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    onUnsubscribe(event: any, topic: string) {
        const webContents = event.sender;
        const peerName = "Renderer_" + webContents.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " unsubscribed from topic: '" + topic + "'");
        this._topicRendererRefs.release(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
    }

    onSend(event: any, topic: string, data: any): void {
        const webContents = event.sender;
        const peerName = "Renderer_" + webContents.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " sent message on '" + topic + "'");
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, peerName, this._busConn);
    }

    onRequest(event: any, topic: string, data: any, replyTopic: string, timeoutDelay: number): void {
        const webContents = event.sender;
        const peerName = "Renderer_" + webContents.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " sent request on '" + topic + "'");
        if (timeoutDelay == null) {

            timeoutDelay = 2000; // 2s by default
        }

        // Prepare reply's handler
        const replyHandler: IpcBusInterfaces.IpcBusRequestFunc = (replyTopic: string, content: any, peerName: string) => {
            console.log("Peer #" + peerName + " replied to request on " + replyTopic + ": " + content);
            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, replyTopic, peerName, this._busConn);
            webContents.send(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, replyTopic, content, peerName);
        };
        EventEmitter.prototype.once.call(this._eventEmitter, replyTopic, replyHandler);

        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, replyTopic, peerName, this._busConn);
        // Execute request
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, replyTopic, peerName, this._busConn);
    }

    onQueryState(event: any, topic: string) {
        const webContents = event.sender;
        const peerName = "Renderer_" + webContents.id;
        console.log("[IPCBus:Bridge] Peer #" + peerName + " query Broker state on topic: '" + topic + "'");
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, this._busConn);
    }
}


// Implementation for Master process
export class IpcBusMainClient extends IpcBusNodeClient {
    private _ipcBusBridge: IpcBusBridge;

    constructor(busPath?: string) {
        super(busPath);
        this._peerName = "Master";
    }

    // Set API
    connect(callback: IpcBusInterfaces.IpcBusConnectFunc) {
        super.connect((eventName: string, conn: any) => {
            this._ipcBusBridge = new IpcBusBridge(this, conn);
            callback(eventName, conn);
        });
    }
}

