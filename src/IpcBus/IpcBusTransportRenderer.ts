/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport, IpcBusData } from './IpcBusTransport';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportRenderer extends IpcBusTransport {
    private _ipcRenderer: any;
    private _onIpcEventReceived: Function;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
    };

    protected _reset() {
        if (this._ipcRenderer) {
            this._ipcRenderer.removeListener(IpcBusUtils.IPC_BUS_RENDERER_EVENT, this._onIpcEventReceived);
            this._ipcRenderer = null;
        }
    }

    protected _onClose() {
        this._reset();
    }

    private _onHandshake(eventOrPid: any, pidOrUndefined: any): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (pidOrUndefined) {
            this._ipcBusPeer.process.pid = pidOrUndefined;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (eventEmitter: any, name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        } else {
            this._ipcBusPeer.process.pid = eventOrPid;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        }
        this._ipcRenderer.addListener(IpcBusUtils.IPC_BUS_RENDERER_EVENT, this._onIpcEventReceived);
    };

    /// IpcBusTrandport API
    private _ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            super.ipcConnect(timeoutDelay, peerName)
                .then((msg) => {
                    // We wait for the bridge confirmation
                    this._ipcRenderer.once(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, () => {
                        resolve('connected');
                    });
                    setTimeout(() => {
                        reject('timeout');
                    }, timeoutDelay);
                    this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, {}, '');
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        if (this._ipcRenderer) {
            return this._ipcConnect(timeoutDelay, peerName);
        }
        else {
            let p = new Promise<string>((resolve, reject) => {
                this._ipcRenderer = require('electron').ipcRenderer;
                this._ipcRenderer.once(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (eventOrPid: any, pidOrUndefined: any) => {
                    this._onHandshake(eventOrPid, pidOrUndefined);
                    this._ipcConnect(timeoutDelay, peerName)
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
                this._ipcRenderer.send(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, this._peerId);
            });
            return p;
        }
    }

    ipcClose(): void {
        if (this._ipcRenderer) {
            this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CLOSE, {}, '');
            this._reset();
        }
    }

    ipcPushCommand(command: string, ipcBusData: IpcBusData, channel: string, args?: any[]): void {
        if (this._ipcRenderer) {
            ipcBusData.peerId = this._peerId;
            this._ipcRenderer.send(IpcBusUtils.IPC_BUS_RENDERER_COMMAND, command, ipcBusData, { channel: channel, sender: this.peer }, args);
        }
    }
}

