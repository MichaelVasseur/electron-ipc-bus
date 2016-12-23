/// <reference types="node" />

import { EventEmitter } from "events";
import * as IpcBusInterfaces from "./IpcBusInterfaces";
import * as IpcBusUtils from "./IpcBusUtils";

// Implementation for Renderer process
/** @internal */
export class IpcBusRendererClient extends EventEmitter implements IpcBusInterfaces.IpcBusClient {
    private _ipcObj: any;
    private _connected?: boolean = null;

    constructor() {
        super();
        this._ipcObj = require("electron").ipcRenderer;
        this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, (eventOrTopic: any, topicOrContent: any, contentOrPeer: any, peerOrUndefined: any) => this._onReceive(eventOrTopic, topicOrContent, contentOrPeer, peerOrUndefined));
    }

    private _onReceive(eventOrTopic: any, topicOrContent: any, contentOrPeer: any, peerOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerOrUndefined === undefined) {
            console.log("[IPCBus:Client] Received message on '" + eventOrTopic + "'");
            EventEmitter.prototype.emit.call(this, eventOrTopic, eventOrTopic, topicOrContent, contentOrPeer);
        }
        else {
            console.log("[IPCBus:Client] Received message on '" + topicOrContent + "'");
            EventEmitter.prototype.emit.call(this, topicOrContent, topicOrContent, contentOrPeer, peerOrUndefined);
        }
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectFunc): void {
        if (this._connected === false) {
            throw new Error("Connection is closed");
        }
        // connect can be called multiple times
        this._connected = true;
        setTimeout(() => {
            connectCallback("connect", -1);
        }, 1);
    }

    close(): void {
        this._connected = false;
    }

    send(topic: string, data: Object | string): void {
        if (this._connected !== true) {
            throw new Error("Please connect first");
        }
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, topic, data);
    }

    request(topic: string, data: Object | string, requestCallback: IpcBusInterfaces.IpcBusRequestFunc, timeoutDelay: number): void {
        if (this._connected !== true) {
            throw new Error("Please connect first");
        }

        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        // Prepare reply's handler, we have to change the replyTopic to topic
        const localRequestCallback: IpcBusInterfaces.IpcBusRequestFunc = (replyTopic: string, content: Object | string, peerName: string) => {
            console.log("Peer #" + peerName + " replied to request on " + replyTopic + ": " + content);
            requestCallback(topic, content, peerName);
        };

        const replyTopic = IpcBusUtils.GenerateReplyTopic();
        this.subscribe(replyTopic, localRequestCallback);

        // Execute request
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, topic, data, replyTopic);

        // Clean-up
        setTimeout(() => {
            this.unsubscribe(replyTopic, localRequestCallback);
        }, timeoutDelay);
    }

    queryBrokerState(topic: string): void {
        if (this._connected !== true) {
            throw new Error("Please connect first");
        }
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, topic);
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusListenFunc): void {
        if (this._connected !== true) {
            throw new Error("Please connect first");
        }
        EventEmitter.prototype.addListener.call(this, topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusListenFunc): void {
        if (this._connected !== true) {
            throw new Error("Please connect first");
        }
        EventEmitter.prototype.removeListener.call(this, topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, topic);
    }
}
