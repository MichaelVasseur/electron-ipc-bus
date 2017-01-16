/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';
import {IpcBusCommonEventEmitter} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// Implementation for renderer process
/** @internal */
export class IpcBusRendererEventEmitter extends IpcBusCommonEventEmitter {
    private _ipcObj: any;
    private _OnSendData: Function;
    private _OnRequestData: Function;

    constructor() {
        super('Renderer');
    };

    private _onHandshake(eventOrPeerName: any, peerNameOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerNameOrUndefined) {
            this._peerName = peerNameOrUndefined;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._peerName}`);
            this._OnSendData = (eventEmitter: any, ...args: any[]) => this._onSendDataReceived(args);
            this._OnRequestData = (eventEmitter: any, ...args: any[]) => this._onRequestDataReceived(args);
        } else {
            this._peerName = eventOrPeerName;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._peerName}`);
            this._OnSendData = (...args: any[]) => this._onSendDataReceived(args);
            this._OnRequestData = (...args: any[]) => this._onRequestDataReceived(args);
        }
        this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_ON_SEND, this._OnSendData);
        this._ipcObj.on(IpcBusUtils.IPC_BUS_RENDERER_ON_REQUEST, this._OnRequestData);
    };

    private _ipcConnect(timeoutDelay: number): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, () => {
                resolve('connected');
            });
            setTimeout(() => {
                reject('timeout');
            }, timeoutDelay);
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT);
        });
        return p;
    }

    ipcConnect(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }
        if (this._ipcObj) {
            return this._ipcConnect(timeoutDelay);
        }
        else {
            let p = new Promise<string>((resolve, reject) => {
                this._ipcObj = require('electron').ipcRenderer;
                this._ipcObj.once(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (eventOrPeerName: any, peerNameOrUndefined: any) => {
                    this._onHandshake(eventOrPeerName, peerNameOrUndefined);
                    this._ipcConnect(timeoutDelay)
                        .then((msg) => {
                            resolve(msg);
                        })
                        .catch((err) => {
                            reject(err);
                        });
                });
                setTimeout(() => {
                    reject('timeout');
                }, timeoutDelay);
                this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE);
            });
            return p;
        }
    }

    ipcClose(): void {
        if (this._ipcObj) {
            this._ipcObj.removeListeneron(IpcBusUtils.IPC_BUS_RENDERER_ON_SEND, this._OnSendData);
            this._ipcObj.removeListeneron(IpcBusUtils.IPC_BUS_RENDERER_ON_REQUEST, this._OnRequestData);
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CLOSE);
            this._ipcObj = null;
        }
    }

    ipcSubscribe(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, event);
    }

    ipcUnsubscribe(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, event);
    }

    ipcSend(event: IpcBusInterfaces.IpcBusEvent, data: Object | string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, event, data);
    }

    ipcRequest(replyChannel: string, event: IpcBusInterfaces.IpcBusEvent, data: Object | string): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, replyChannel, event, data);
    }

    ipcQueryBrokerState(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, event);
    }
}


// Implementation of IpcBusClient for Renderer process
/** @internal */
export class IpcBusRendererClient extends IpcBusCommonClient {
     constructor() {
        super(new IpcBusRendererEventEmitter());
    }
}
