/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';
import {IpcBusCommonEventEmitter} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// Implementation for renderer process
/** @internal */
export class IpcBusRendererEventEmitter extends IpcBusCommonEventEmitter {
    private _ipcObj: any;
    private _onIpcEventReceived: Function;

    constructor() {
        super();
    };

    private _onHandshake(eventOrPeerName: any, peerNameOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        let peerName: string;
        if (peerNameOrUndefined) {
            peerName = peerNameOrUndefined;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${peerName}`);
            this._onIpcEventReceived = (eventEmitter: any, name: string, args: any[]) => this._onEventReceived(name, args);
        } else {
            peerName = eventOrPeerName;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${peerName}`);
            this._onIpcEventReceived = (name: string, args: any[]) =>  this._onEventReceived( name, args);
        }
        this.emit(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, peerName);
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, this._onIpcEventReceived);
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, this._onIpcEventReceived);
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
            this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, this._onIpcEventReceived);
            this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, this._onIpcEventReceived);
            this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_CLOSE);
            this._ipcObj = null;
        }
    }

    ipcSubscribe(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, event);
    }

    ipcUnsubscribe(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, event, false);
    }

    ipcUnsubscribeAll(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, event, true);
    }

    ipcSend(event: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_SEND, event, args);
    }

    ipcRequest(replyChannel: string, event: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, replyChannel, event, args);
    }

    ipcQueryBrokerState(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, event);
    }
}


// Implementation of IpcBusClient for Renderer process
/** @internal */
export class IpcBusRendererClient extends IpcBusCommonClient {
     constructor() {
        super('renderer', new IpcBusRendererEventEmitter());
        this._ipcBusEventEmitter.on(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (eventOrPeerName: any, peerNameOrUndefined: any) => this._onHandshake(eventOrPeerName, peerNameOrUndefined));
    }

    private _onHandshake(eventOrPeerName: any, peerNameOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerNameOrUndefined) {
            this._peerName = peerNameOrUndefined;
        } else {
            this._peerName = eventOrPeerName;
        }
        IpcBusUtils.Logger.info(`[IPCBus:Renderer] #${this.peerName}`);
    }
}
