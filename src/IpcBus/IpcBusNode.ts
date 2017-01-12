/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusUtils from './IpcBusUtils';
import * as BaseIpc from 'easy-ipc';
import { IpcBusCommonEventEmitter } from './IpcBusClient';
import { IpcBusCommonClient } from './IpcBusClient';

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
                case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        this._onDataReceived.apply(this, data.args);
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
    }

    ipcSubscribe(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    ipcUnsubscribe(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    ipcSend(topic: string, data: Object | string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, peerName, this._busConn);
    }

    ipcRequest(topic: string, data: Object | string, peerName: string, replyTopic: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, peerName, replyTopic, this._busConn);
    }

    ipcQueryBrokerState(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, this._busConn);
    }
}

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(new IpcBusNodeEventEmitter('Node_' + process.pid, ipcOptions));
    }
}
