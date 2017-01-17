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
                this._onEventReceived(data.name, data.args[0]);
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

    ipcSubscribe(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, event, this._busConn);
    }

    ipcUnsubscribe(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, event, false, this._busConn);
    }

    ipcUnsubscribeAll(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, event, true, this._busConn);
    }

    ipcSend(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        BaseIpc.Cmd.exec.apply(this, [IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, ipcBusData, ipcBusEvent].concat(args).concat([this._busConn]));
    }

    ipcRequest(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        BaseIpc.Cmd.exec.apply(this, [IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, ipcBusEvent].concat(args).concat([this._busConn]));
    }

    ipcQueryBrokerState(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, event, this._busConn);
    }
}

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Node_' + process.pid, new IpcBusSocketTransport(ipcOptions));
    }
}
