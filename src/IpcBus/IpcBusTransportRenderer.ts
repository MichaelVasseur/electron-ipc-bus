/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport, IpcBusData } from './IpcBusTransport';

// Implementation for renderer process
/** @internal */
export class IpcBusTransportRenderer extends IpcBusTransport {
    private _ipcRenderer: any;
    private _onIpcEventReceived: Function;
    private _promiseConnected: Promise<string>;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
    };

    protected _reset() {
        this._promiseConnected = null;
        if (this._ipcRenderer) {
            this._ipcRenderer.removeAllListeners(IpcBusUtils.IPC_BUS_COMMAND_CONNECT);
            this._ipcRenderer.removeAllListeners(IpcBusUtils.IPC_BUS_RENDERER_EVENT);
            this._ipcRenderer = null;
        }
    }

    protected _onClose() {
        this._reset();
    }

    private _onConnect(eventOrPeer: any, peerOrUndefined: IpcBusInterfaces.IpcBusPeer): void {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (peerOrUndefined) {
            this._ipcBusPeer = peerOrUndefined;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Standard listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (eventEmitter: any, name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        } else {
            this._ipcBusPeer = eventOrPeer;
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Renderer] Activate Sandbox listening for #${this._ipcBusPeer.name}`);
            this._onIpcEventReceived = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        }
        this._ipcRenderer.addListener(IpcBusUtils.IPC_BUS_RENDERER_EVENT, this._onIpcEventReceived);
    };

    /// IpcBusTrandport API
    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            p = this._promiseConnected = new Promise<string>((resolve, reject) => {
                this._ipcRenderer = require('electron').ipcRenderer;
                // Do not type timer as it may differ between node and browser api, let compiler and browserify deal with.
                let timer = setTimeout(() => {
                    timer = null;
                    this._reset();
                    reject('timeout');
                }, timeoutDelay);
                // We wait for the bridge confirmation
                this._ipcRenderer.once(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, (eventOrPeer: any, peerOrUndefined: IpcBusInterfaces.IpcBusPeer) => {
                    clearTimeout(timer);
                    this._onConnect(eventOrPeer, peerOrUndefined);
                    resolve('connected');
                });
                this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, {}, '', [peerName]);
            });
        }
        return p;
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

