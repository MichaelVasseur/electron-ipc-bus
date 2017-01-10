/// <reference types='node' />

import { EventEmitter } from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

class IpcBusRendererBridge extends EventEmitter {
    private _ipcObj: any;
    private _connected?: boolean = null;

    constructor() {
        super();
        this._ipcObj = require('electron').ipcRenderer;
        this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onFirstMessageReceived(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined));
    }

    protected _onMessageReceived(topic: any, payload: any, peerName: any, replyTopic?: any): void {
        if (replyTopic) {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Emit request on topic '${topic}' from peer #${peerName} (replyTopic?='${replyTopic}')`);
            this.emit(topic, topic, payload, peerName,
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
            this.emit(topic, topic, payload, peerName);
        }
    }

    private _onFirstMessageReceived(eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (eventOrTopic instanceof EventEmitter) {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening`);
             let lambdaStandard: Function = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onMessageReceived(topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, lambdaStandard);
            lambdaStandard(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
        } else {
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening`);
            let lambdaSandbox: Function = (eventOrTopic: any, topicOrPayload: any, payloadOrPeerName: any, peerNameOfReplyTopic: any, replyTopicOrUndefined?: any) => this._onMessageReceived(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic);
            this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, lambdaSandbox);
            lambdaSandbox(eventOrTopic, topicOrPayload, payloadOrPeerName, peerNameOfReplyTopic, replyTopicOrUndefined);
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
        this.addListener(topic, listenCallback);
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, topic);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        if (this._connected !== true) {
            throw new Error('Please connect first');
        }
        this.removeListener(topic, listenCallback);
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
                this.unsubscribe(generatedTopic, localRequestCallback);
                let content = payload as any;
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
                if (this.listenerCount(generatedTopic) > 0) {
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


// Implementation for Renderer process
/** @internal */
export class IpcBusRendererClient implements IpcBusInterfaces.IpcBusClient {
    private _ipcBusRendererBridge: IpcBusRendererBridge;

    constructor() {
        this._ipcBusRendererBridge = new IpcBusRendererBridge();
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler): void {
        this._ipcBusRendererBridge.connect(connectCallback);
    }

    close(): void {
        this._ipcBusRendererBridge.close();
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        this._ipcBusRendererBridge.subscribe(topic, listenCallback);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler): void {
        this._ipcBusRendererBridge.unsubscribe(topic, listenCallback);
    }

    send(topic: string, data: Object | string): void {
        this._ipcBusRendererBridge.send(topic, data);
    }

    request(topic: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusRendererBridge.request(topic, data, timeoutDelay);
    }

    queryBrokerState(topic: string): void {
        this._ipcBusRendererBridge.queryBrokerState(topic);
    }
}
