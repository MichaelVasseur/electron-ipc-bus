/// <reference path='typings/easy-ipc.d.ts'/>

import * as BaseIpc from 'easy-ipc';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

/** @internal */
export class IpcBusBrokerServer implements IpcBusInterfaces.IpcBusBroker {
    private _baseIpc: BaseIpc;
    private _ipcServer: any = null;
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _subscriptions: IpcBusUtils.TopicConnectionMap;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._subscriptions = new IpcBusUtils.TopicConnectionMap('[IPCBus:Broker]');
        this._baseIpc.on('connection', (socket: any, server: any) => this._onConnection(socket, server));
        this._baseIpc.on('close', (err: any, socket: any, server: any) => this._onClose(err, socket, server));
        this._baseIpc.on('data', (data: any, socket: any, server: any) => this._onData(data, socket, server));
    }

    // Set API
    start() {
        this._baseIpc.once('listening', (server: any) => {
            this._ipcServer = server;
            IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${this._ipcOptions}`);
        });
        this._baseIpc.listen(this._ipcOptions.port, this._ipcOptions.host);
    }

    stop() {
        if (this._ipcServer != null) {
            this._ipcServer.close();
            this._ipcServer = null;
        }
    }

    private _onConnection(socket: any, server: any): void {
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        socket.on('error', (err: string) => {
            IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${err}`);
        });
    }

    private _onClose(err: any, socket: any, server: any): void {
        this._subscriptions.releaseConnection(socket);
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    private _onData(data: any, socket: any, server: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        IpcBusUtils.Logger.info(`[IPCBus:Broker] Subscribe to topic '${msgTopic}' from peer #${msgPeerName}`);

                        this._subscriptions.addRef(msgTopic, socket.remotePort, socket, msgPeerName);
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        IpcBusUtils.Logger.info(`[IPCBus:Broker] Unsubscribe from topic '${msgTopic}' from peer #${msgPeerName}`);

                        this._subscriptions.release(msgTopic, socket.remotePort, msgPeerName);
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        IpcBusUtils.Logger.info(`[IPCBus:Broker] Received send on topic '${msgTopic}' from peer #${msgPeerName}`);

                        this._subscriptions.forEachTopic(msgTopic, function (connData, topic) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, topic, msgContent, msgPeerName, connData.conn);
                        });
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        const msgReplyTopic = data.args[3] as string;
                        IpcBusUtils.Logger.info(`[IPCBus:Broker] Received request on topic '${msgTopic}' (reply = '${msgReplyTopic}') from peer #${msgPeerName}`);

                        this._subscriptions.forEachTopic(msgTopic, function (connData, topic) {
                            // Request data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, topic, msgContent, msgPeerName, msgReplyTopic, connData.conn);
                        });
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        IpcBusUtils.Logger.info(`[IPCBus:Broker] QueryState message reply on topic '${msgTopic}' from peer #${msgPeerName}`);

                        let queryStateResult: Object[] = [];
                        this._subscriptions.forEach(function (connData, topic) {
                            connData.peerNames.forEach(function (count: number, peerName: string) {
                                queryStateResult.push({ topic: topic, peerName: peerName, count: count });
                            });
                        });
                        this._subscriptions.forEachTopic(msgTopic, function (connData, topic) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, topic, queryStateResult, msgPeerName, connData.conn);
                        });
                        break;
                    }
            }
        }
    }
}
