/// <reference path='typings/easy-ipc.d.ts'/>

import * as IpcBusInterfaces from './IpcBusInterfaces';
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

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super();
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data: any, conn: any) => this._onData(data, conn));
    }

    protected _onData(data: any, conn: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                    {
                        const topic = data.args[0];
                        const payload = data.args[1];
                        const peerName = data.args[2];
                        this._onDataReceived(topic, payload, peerName, null);
                        break;
                    }

                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const topic = data.args[0];
                        const payload = data.args[1];
                        const peerName = data.args[2];
                        const replyTopic = data.args[3];
                        this._onDataReceived(topic, payload, peerName, replyTopic);
                        break;
                    }
            }
        }
    }

    // Set API
    ipcConnect(connectHandler: IpcBusInterfaces.IpcBusConnectHandler) {
        this._baseIpc.on('connect', (conn: any) => {
            this._busConn = conn;
            connectHandler();
        });
        this._baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
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
        super('Node_' + process.pid, new IpcBusNodeEventEmitter(ipcOptions));
    }
}

