/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusUtils from './IpcBusUtils';
import * as BaseIpc from 'easy-ipc';
import { IpcBusCommonEventEmitter } from './IpcBusClient';
import { IpcBusCommonClient } from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// Implementation for Node process
/** @internal */
export class IpcBusNodeEventEmitter extends IpcBusCommonEventEmitter {
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _baseIpc: BaseIpc;
    private _busConn: any;

    constructor(peerName: string, ipcOptions: IpcBusUtils.IpcOptions) {
        super(peerName);
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data: any, conn: any) => this._onData(data, conn));
    }

    protected _onData(data: any, conn: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE:
                    {
                        this._onSendDataReceived(data.args[0]);
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE:
                    {
                        this._onRequestDataReceived(data.args[0]);
                        break;
                    }
            }
        }
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
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, event, this._busConn);
    }

    ipcUnsubscribe(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, event, this._busConn);
    }

    ipcSend(event: IpcBusInterfaces.IpcBusEvent, data: Object | string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, event, data, this._busConn);
    }

    ipcRequest(replyChannel: string, event: IpcBusInterfaces.IpcBusEvent, data: Object | string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, replyChannel, event, data, this._busConn);
    }

    ipcQueryBrokerState(event: IpcBusInterfaces.IpcBusEvent) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, event, this._busConn);
    }
}

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(new IpcBusNodeEventEmitter('Node_' + process.pid, ipcOptions));
    }
}
