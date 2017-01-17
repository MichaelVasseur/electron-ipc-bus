/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';

import {IpcBusTransport} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';
import {IpcBusData} from './IpcBusClient';

import * as IpcBusInterfaces from './IpcBusInterfaces';

// Implementation for renderer process
/** @internal */
export class IpcBusIpcRendererTransport extends IpcBusTransport {
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
            this._onIpcEventReceived = (eventEmitter: any, name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        } else {
            peerName = eventOrPeerName;
            IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${peerName}`);
            this._onIpcEventReceived = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) =>  this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        }
        this._onEventReceived(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, {}, {channel: '', sender: { peerName: peerName}}, []);
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
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, event);
    }

    ipcUnsubscribe(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, event, false);
    }

    ipcUnsubscribeAll(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, event, true);
    }

    ipcSend(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, ipcBusData, ipcBusEvent, args);
    }

    ipcRequest(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, ipcBusEvent, args);
    }

    ipcQueryBrokerState(event: IpcBusInterfaces.IpcBusEvent): void {
        this._ipcObj.send(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, event);
    }
}


// Implementation of IpcBusClient for Renderer process
/** @internal */
export class IpcBusRendererClient extends IpcBusCommonClient {
     constructor() {
        super('renderer', new IpcBusIpcRendererTransport());
    }

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE:
                this._peerName = ipcBusEvent.sender.peerName;
                IpcBusUtils.Logger.info(`[IPCBus:Renderer] #${this.peerName}`);
                break;
            default :
                super._onEventReceived(name, ipcBusData, ipcBusEvent, args);
                break;
        }
    }
}
