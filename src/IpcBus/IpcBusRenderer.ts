/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for Renderer process
/** @internal */
export class IpcBusRendererClient implements IpcBusInterfaces.IpcBusClient {
    private _ipcObj: any;
    private _connected?: boolean = null;

    constructor() {
        this._ipcObj = require('electron').ipcRenderer;
        this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onReceive(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined));
    }

    private _onReceiveBis(topic: any, payload: any, peerName: any, replyTopic?: any): void {
        if (replyTopic) {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Emit request on topic '${topic}' from peer #${peerName} (replyTopic?='${replyTopic}')`);
            this._ipcObj.emit(this, topic, topic, payload, peerName,
                (resolve: Object | string) => {
                    this.send(replyTopic, { resolve : resolve });
                },
                (err: string) => {
                    this.send(replyTopic, { reject : err });
                }
            );
        }
        else {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Emit message on topic '${topic}' from peer #${peerName}`);
            this._ipcObj.emit(topic, topic, payload, peerName);
        }
    }

    private _onReceive(eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (eventOrTopic instanceof EventEmitter) {
            this._onReceiveBis(topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
        } else {
            this._onReceiveBis(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic);
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
        this._ipcObj.addListener(topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        this._ipcObj.removeListener(topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, topic);
    }

    send(topic: string, data: Object | string): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, topic, data);
    }

    request(topic: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }

        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (localGeneratedTopic, payload, peerName, requestResolve, requestReject) => {
                IpcBusUtils.Logger.info(`[IPCBus:Renderer] Peer #${peerName} replied to request on ${generatedTopic} : ${payload}`);
                let content = payload as any;
                this.unsubscribe(generatedTopic, localRequestCallback);
                if (content.hasOwnProperty('resolve')) {
                    IpcBusUtils.Logger.info(`[IPCBus:Renderer] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content.resolve, peerName: peerName};
                    resolve(response);
                }
                else if (content.hasOwnProperty('reject')) {
                    IpcBusUtils.Logger.info(`[IPCBus:Renderer] reject: ${content.reject}`);
                    reject(content.reject);
                }
                else {
                    IpcBusUtils.Logger.info(`[IPCBus:Renderer] reject: unknown format`);
                    reject('unknown format');
                }
            };

            this.subscribe(generatedTopic, localRequestCallback);

            // Execute request
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, topic, data, generatedTopic);

            // Clean-up
            setTimeout(() => {
                if (this._ipcObj.listenerCount(generatedTopic) > 0) {
                    this.unsubscribe(generatedTopic, localRequestCallback);
                    IpcBusUtils.Logger.info(`[IPCBus:Renderer] reject: timeout`);
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
