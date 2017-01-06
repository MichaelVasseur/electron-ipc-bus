/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for Renderer process
/** @internal */
export class IpcBusRendererClient extends EventEmitter implements IpcBusInterfaces.IpcBusClient {
    private _ipcObj: any;
    private _connected?: boolean = null;

    constructor() {
        super();
        this._ipcObj = require('electron').ipcRenderer;
        this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onReceive(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined));
    }

    private _onReceive(eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (eventOrTopic instanceof EventEmitter) {
            console.log(`[IPCBus:Renderer] Received message on '${topicOrPayload}'`);
            EventEmitter.prototype.emit.call(this, topicOrPayload, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
        }
        else {
            console.log(`[IPCBus:Renderer] Received message on '${eventOrTopic}'`);
            EventEmitter.prototype.emit.call(this, eventOrTopic, eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic);
        }
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler): void {
        if (this._connected === false) {
            throw new Error('Connection is closed');
        }
        // connect can be called multiple times
        this._connected = true;
        setTimeout(() => {
            connectCallback('connect', -1);
        }, 1);
    }

    close(): void {
        this._connected = false;
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        EventEmitter.prototype.addListener.call(this, topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        EventEmitter.prototype.removeListener.call(this, topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, topic);
    }

    send(topic: string, data: Object | string): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, topic, data);
    }

    // request(topic: string, data: Object | string, requestCallback: IpcBusInterfaces.IpcBusRequestFunc, timeoutDelay: number): void {
    //     this.requestPromise(topic, data, timeoutDelay).then((RequestArgs: IpcBusInterfaces.IpcBusRequestResponse) => {
    //         requestCallback(RequestArgs.topic, RequestArgs.payload, RequestArgs.peerName);
    //     });
    // }

    request(topic: string, data: Object | string, timeoutDelay: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }

        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (topic: string, content: Object | string, peerName: string, replyTopic?: string) => {
                console.log(`[IPCBus:Node] Peer #${peerName} replied to request on ${generatedTopic} : ${content}`);
                this.unsubscribe(generatedTopic, localRequestCallback);
                let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content, peerName: peerName};
                resolve(response);
            };

            this.subscribe(generatedTopic, localRequestCallback);

            // Execute request
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, topic, data, generatedTopic);

            // Clean-up
            setTimeout(() => {
                if (EventEmitter.prototype.listenerCount.call(this, generatedTopic) > 0) {
                    this.unsubscribe(generatedTopic, localRequestCallback);
                    reject('timeout');
                }
            }, timeoutDelay);
        });
        return p;
    }

    queryBrokerState(topic: string): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, topic);
    }
}
