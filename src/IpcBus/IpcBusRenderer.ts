/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
import {IpcBusCommonEventEmitter} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';

// Implementation for renderer process
/** @internal */
export class IpcBusRendererEventEmitter extends IpcBusCommonEventEmitter {
    private _ipcObj: any;

    constructor() {
        super();
        this._ipcObj = null;
    }

    private _onFirstMessageReceived(eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (eventOrTopic instanceof EventEmitter) {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening`);
             let lambdaStandard: Function = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onDataReceived(topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, lambdaStandard);
            lambdaStandard(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
        } else {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening`);
            let lambdaSandbox: Function = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onDataReceived(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, lambdaSandbox);
            lambdaSandbox(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
        }
    }

    // Set API
    ipcConnect(connectHandler: IpcBusInterfaces.IpcBusConnectHandler): void {
        if (!this._ipcObj) {
            this._ipcObj = require('electron').ipcRenderer;
            this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onFirstMessageReceived(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined));
        }
        setTimeout(() => {
            connectHandler();
        }, 1);
    }

    ipcClose(): void {
        if (this._ipcObj) {
            this._ipcObj.removeAllListeners(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE);
            this._ipcObj = null;
        }
    }

    ipcSubscribe(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic);
    }

    ipcUnsubscribe(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, topic);
    }

    ipcSend(topic: string, data: Object | string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, topic, data);
    }

    ipcRequest(topic: string, data: Object | string, peerName: string, replyTopic: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, topic, data, replyTopic);
    }

    ipcQueryBrokerState(topic: string, peerName: string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, topic);
    }
}


// Implementation of IpcBusClient for Renderer process
/** @internal */
export class IpcBusRendererClient extends IpcBusCommonClient {
     constructor() {
        super('Renderer', new IpcBusRendererEventEmitter());
    }
}
