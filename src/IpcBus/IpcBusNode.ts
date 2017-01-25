/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusUtils from './IpcBusUtils';
import * as BaseIpc from 'easy-ipc';
import {IpcBusTransport} from './IpcBusClient';
import {IpcBusCommonClient} from './IpcBusClient';
import {IpcBusData} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// Implementation for Node process
/** @internal */
export class IpcBusSocketTransport extends IpcBusTransport {
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _baseIpc: BaseIpc;
    private _busConn: any;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super();
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data: any) => {
            if (BaseIpc.Cmd.isCmd(data)) {
                this.onEventHandler(data.name, data.args[0], data.args[1], data.args[2]);
            }
        });
    }

    // Set API
    ipcConnect(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }
        let p = new Promise<string>((resolve, reject) => {
            this._baseIpc.on('connect', (conn: any) => {
                this._busConn = conn;
                resolve('connected');
            });
            setTimeout(() => {
                reject('timeout');
            }, timeoutDelay);
            this._baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
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

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Node_' + process.pid, new IpcBusSocketTransport(ipcOptions));
    }
}
