/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// This class implements the transaction between an EventEmitter and an ipc client : BrokerServer (easy-ipc) or Electron (ipcRenderer/ipcMain)
/** @internal */
export abstract class IpcBusCommonEventEmitter extends EventEmitter {
    protected _peerName: string;

    constructor(peerName: string) {
        super();
        this._peerName = peerName;
    }

   PeerName(): string {
        return this._peerName;
    }

    protected _onDataReceived(topic: string, payload: Object| string, peerName: string, replyTopic?: string) {
        if (replyTopic) {
            IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Emit request received on topic '${topic}' from peer #${peerName} (replyTopic '${replyTopic}')`);
            this.emit(topic, topic, payload, peerName,
                (payload: Object | string) => {
                    this.ipcSend(replyTopic, { resolve : payload }, this._peerName);
                },
                (err: string) => {
                    this.ipcSend(replyTopic, { reject : err }, this._peerName);
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
        this.ipcSubscribe(topic, peerName || this._peerName);
    }

    abstract ipcSubscribe(topic: string, peerName: string): void;

    unsubscribe(topic: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this.removeListener(topic, listenCallback);
        this.ipcUnsubscribe(topic, peerName || this._peerName);
    }

    abstract ipcUnsubscribe(topic: string, peerName: string): void;

    // for performance purpose we do not call sendFromPeer but ipcSend directly
    send(topic: string, data: Object | string, peerName: string) {
        this.ipcSend(topic, data, peerName || this._peerName);
    }

    abstract ipcSend(topic: string, data: Object | string, peerName: string): void;

    request(topic: string, data: Object | string, peerName: string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        peerName = peerName || this._peerName;

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (localGeneratedTopic, payload, peerName, requestResolve, requestReject) => {
                IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Peer #${peerName} replied to request on ${generatedTopic} : ${payload}`);
                this.unsubscribe(generatedTopic, peerName, localRequestCallback);
                let content = payload as any;
                if (content.hasOwnProperty('resolve')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content.resolve, peerName: peerName};
                    resolve(response);
                }
                else if (content.hasOwnProperty('reject')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: ${content.reject}`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content.reject, peerName: peerName};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: 'unknown format', peerName: ''};
                    reject(response);
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
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: 'timeout', peerName: ''};
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    abstract ipcRequest(topic: string, data: Object | string, peerName: string, replyTopic: string): void;

    queryBrokerState(topic: string, peerName: string) {
        this.ipcQueryBrokerState(topic, peerName || this._peerName);
    }

    abstract ipcQueryBrokerState(topic: string, peerName: string): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusEventEmitter: IpcBusCommonEventEmitter;

    constructor(ipcBusEventEmitter: IpcBusCommonEventEmitter) {
        this._ipcBusEventEmitter = ipcBusEventEmitter;
    }

    PeerName(): string {
        return this._ipcBusEventEmitter.PeerName();
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this._ipcBusEventEmitter.connect(connectCallback);
    }

    close() {
        this._ipcBusEventEmitter.close();
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusEventEmitter.subscribe(topic, null, listenCallback);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusEventEmitter.unsubscribe(topic, null, listenCallback);
    }

    send(topic: string, data: Object | string) {
        this._ipcBusEventEmitter.send(topic, data, null);
    }

    request(topic: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusEventEmitter.request(topic, data, null, timeoutDelay);
    }

    queryBrokerState(topic: string) {
        this._ipcBusEventEmitter.queryBrokerState(topic, null);
    }
}

