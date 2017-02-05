/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusUtils from './IpcBusUtils';
import * as BaseIpc from 'easy-ipc';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import {IpcBusTransport} from './IpcBusTransport';
import {IpcBusData} from './IpcBusTransport';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    private _baseIpc: BaseIpc;
    private _busConn: any;

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
    ipcConnect(timeoutDelay: number): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            this._baseIpc.on('connect', (conn: any) => {
                this._busConn = conn;
                resolve('connected');
            });
            setTimeout(() => {
                reject('timeout');
            }, timeoutDelay);
            this._baseIpc.connect(this.ipcOptions.port, this.ipcOptions.host);
        });
        return p;
    }

    ipcClose() {
        this._busConn.end();
        this._busConn = null;
    }

    ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void {
        if (args) {
            BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, args, this._busConn);
        }
        else {
            BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, this._busConn);
        }
    }
}
