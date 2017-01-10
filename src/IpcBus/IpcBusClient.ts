/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// This class implements the transaction between an EventEmitter and an ipc client : BrokerServer (easy-ipc) or Electron (ipcRenderer/ipcMain)
/** @internal */
export abstract class IpcBusCommonEventEmitter extends EventEmitter {

    constructor() {
        super();
    }

    protected _onDataReceived(topic: string, payload: Object| string, peerName: string, replyTopic?: string) {
        if (replyTopic) {
            IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Emit request received on topic '${topic}' from peer #${peerName} (replyTopic '${replyTopic}')`);
            this.emit(topic, topic, payload, peerName,
                (payload: Object | string) => {
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: payload, peerName: peerName};
                    this.ipcSend(replyTopic, {resolve: response}, peerName);
                },
                (err: string) => {
//                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: err, peerName: peerName};
                    let response = err;
                    this.ipcSend(replyTopic, {reject: response}, peerName);
                }
            );
        }
        else {
            IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Emit message received on topic '${topic}' from peer #${peerName}`);
            this.emit(topic, topic, payload, peerName);
        }
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this.ipcConnect(connectCallback);
    }

    abstract ipcConnect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler): void;

    close() {
        this.ipcClose();
    }

    abstract ipcClose(): void;

    subscribe(topic: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this.addListener(topic, listenCallback);
        this.ipcSubscribe(topic, peerName);
    }

    abstract ipcSubscribe(topic: string, peerName: string): void;

    unsubscribe(topic: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this.removeListener(topic, listenCallback);
        this.ipcUnsubscribe(topic, peerName);
    }

    abstract ipcUnsubscribe(topic: string, peerName: string): void;

    send(topic: string, data: Object | string, peerName: string) {
        this.ipcSend(topic, data, peerName);
    }

    abstract ipcSend(topic: string, data: Object | string, peerName: string): void;

    request(topic: string, data: Object | string, peerName: string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (localGeneratedTopic, payload, peerName, requestResolve, requestReject) => {
                IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Peer #${peerName} replied to request on ${generatedTopic} : ${payload}`);
                this.unsubscribe(generatedTopic, peerName, localRequestCallback);
                let content = payload as any;
                if (content.hasOwnProperty('resolve')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] resolve`);
                    resolve(content.resolve);
                }
                else if (content.hasOwnProperty('reject')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: ${content.reject}`);
                    reject(content.reject);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: unknown format`);
                    reject('unknown format');
                }
            };

            this.subscribe(generatedTopic, peerName, localRequestCallback);

            // Execute request
            this.ipcRequest(topic, data, peerName, generatedTopic);

            // Clean-up
            setTimeout(() => {
                if (this.listenerCount(generatedTopic) > 0) {
                    this.unsubscribe(generatedTopic, peerName, localRequestCallback);
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: timeout`);
                    reject('timeout');
                }
            }, timeoutDelay);
        });
        return p;
    }

    abstract ipcRequest(topic: string, data: Object | string, peerName: string, replyTopic: string): void;

    queryBrokerState(topic: string, peerName: string) {
        this.ipcQueryBrokerState(topic, peerName);
    }

    abstract ipcQueryBrokerState(topic: string, peerName: string): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient implements IpcBusInterfaces.IpcBusClient {
    protected _peerName: string;
    protected _ipcBusEventEmitter: IpcBusCommonEventEmitter;

    constructor(peerName: string, ipcBusEventEmitter: IpcBusCommonEventEmitter) {
        this._peerName = peerName;
        this._ipcBusEventEmitter = ipcBusEventEmitter;
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this._ipcBusEventEmitter.connect(connectCallback);
    }

    close() {
        this._ipcBusEventEmitter.close();
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusEventEmitter.subscribe(topic, this._peerName, listenCallback);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusEventEmitter.unsubscribe(topic, this._peerName, listenCallback);
    }

    send(topic: string, data: Object | string) {
        this._ipcBusEventEmitter.send(topic, data, this._peerName);
    }

    request(topic: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusEventEmitter.request(topic, data, this._peerName, timeoutDelay);
    }

    queryBrokerState(topic: string) {
        this._ipcBusEventEmitter.queryBrokerState(topic, this._peerName);
    }
}

