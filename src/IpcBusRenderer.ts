/// <reference types="node" />
/// <reference path="IpcBusConstants.ts" />
/// <reference path="IpcBusInterfaces.ts" />
/// <reference path="TopicConnectionMap.ts" />

import {EventEmitter} from 'events';

// import {*} from "IpcBusInterfaces";

// import {TopicConnectionMap} from "TopicConnectionMap";

// import {ElectronIpcBus} from 'IpcBusConstants';
 
// Implementation for Renderer process
class IpcBusRendererClient extends EventEmitter {

    _ipcObj : any;
    _connected? : boolean = null;

    constructor(){
        super();
        this._ipcObj = require('electron').ipcRenderer;
        this._ipcObj.on(ElectronIpcBus.IPC_BUS_RENDERER_RECEIVE, function (eventOrTopic, topicOrContent, contentOrPeer, peerOrUndefined) {
            // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
            if (peerOrUndefined === undefined) {
                console.log("[IPCBus:Client] Received message on '" + eventOrTopic + "'")
                EventEmitter.prototype.emit.call(self, eventOrTopic, eventOrTopic, topicOrContent, contentOrPeer)
            }
            else {
                console.log("[IPCBus:Client] Received message on '" + topicOrContent + "'")
                EventEmitter.prototype.emit.call(self, topicOrContent, topicOrContent, contentOrPeer, peerOrUndefined)
            }
        })
    }

    // Set API
    connect(callback : Function) : void {
        if (this._connected == false) {
            throw new Error("Connection is closed")
        }
        // connect can be called multiple times
        this._connected = true
        setTimeout(function () {
            callback('connect')
        }, 1)
    }

    close() : void {
        this._connected = false
    }

    send(topic : string, data : Object | string) : void {
        if (this._connected != true) {
            throw new Error("Please connect first")
        }
        this._ipcObj.send(ElectronIpcBus.IPC_BUS_RENDERER_SEND, topic, data)
    }

    request (topic : string, data : Object | string, replyCallback : Function, timeoutDelay : number) : void {
        if (this._connected != true) {
            throw new Error("Please connect first")
        }

        const replyTopic = _generateReplyTopic()
        EventEmitter.prototype.once.call(this, replyTopic, function (replyTopic : string, data : Object | string, peer : string) {

            replyCallback(topic, data, peer)
        })

        if (timeoutDelay === undefined) {
            timeoutDelay = 2000
        }
        this._ipcObj.send(ElectronIpcBus.IPC_BUS_RENDERER_REQUEST, topic, data, replyTopic, timeoutDelay)
    }

    this.queryBrokerState = function (topic : string) : void {
        if (this._connected != true) {
            throw new Error("Please connect first")
        }
        this._ipcObj.send(ElectronIpcBus.IPC_BUS_RENDERER_QUERYSTATE, topic)
    }

    this.subscribe = function (topic : string, handler : Function) : void {
        if (this._connected != true) {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.addListener.call(this, topic, handler)
        this._ipcObj.send(ElectronIpcBus.IPC_BUS_RENDERER_SUBSCRIBE, topic)
    }

    this.unsubscribe = function (topic : string,  handler : Function) : void {
        if (this._connected != true) {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.removeListener.call(this, topic, handler)
        this._ipcObj.send(ElectronIpcBus.IPC_BUS_RENDERER_UNSUBSCRIBE, topic)
    }
}
