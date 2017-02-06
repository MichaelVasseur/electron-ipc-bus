/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusUtils from './IpcBusUtils';
import * as BaseIpc from 'easy-ipc';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import {IpcBusTransport, IpcBusData} from './IpcBusTransport';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    protected _baseIpc: BaseIpc;
    protected _busConn: any;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data: any) => {
            if (BaseIpc.Cmd.isCmd(data)) {
                this._onEventReceived(data.name, data.args[0], data.args[1], data.args[2]);
            }
        });
    }

    /// IpcBusTrandport API
    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            super.ipcConnect(timeoutDelay, peerName)
            .then((msg) => {
                this._baseIpc.on('connect', (conn: any) => {
                    this._busConn = conn;
                    this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, {}, '');
                    resolve(msg);
                });
                setTimeout(() => {
                    reject('timeout');
                }, timeoutDelay);
                this._baseIpc.connect(this.ipcOptions.port, this.ipcOptions.host);
            })
            .catch((err) => {
                reject(err);
            });
        });
        return p;
    }

    ipcClose() {
        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, {}, '');
        this._busConn.end();
        this._busConn = null;
    }

    ipcPushCommand(command: string, ipcBusData: IpcBusData, channel: string, args?: any[]): void {
       this._ipcPushCommand(command, ipcBusData, {channel: channel, sender: this.peer}, args);
    }

    protected _ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void {
        ipcBusData.id = this._id;
        if (args) {
            BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, args, this._busConn);
        }
        else {
            BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, this._busConn);
        }
    }
}
