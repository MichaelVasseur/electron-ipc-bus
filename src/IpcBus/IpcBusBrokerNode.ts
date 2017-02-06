/// <reference path='typings/easy-ipc.d.ts'/>

import * as BaseIpc from 'easy-ipc';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
// import * as util from 'util';

import {IpcBusCommonClient} from './IpcBusClient';
import {CreateIpcBusTransport, IpcBusTransport, IpcBusData} from './IpcBusTransport';

/** @internal */
export class IpcBusBrokerNode implements IpcBusInterfaces.IpcBusBroker {
    private _baseIpc: BaseIpc;
    private _ipcServer: any = null;
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _subscriptions: IpcBusUtils.ChannelConnectionMap;
    private _requestChannels: Map<string, any>;
    private _ipcBusBrokerClient: IpcBusCommonClient;

    private _queryStateLamdba: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) => this._onQueryState(ipcBusEvent, replyChannel);
    private _serviceAvailableLambda: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) => this._onServiceAvailable(ipcBusEvent, serviceName);

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._subscriptions = new IpcBusUtils.ChannelConnectionMap('[IpcBusBrokerNode]');
        this._requestChannels = new Map<string, any>();
        this._baseIpc.on('connection', (socket: any, server: any) => this._onConnection(socket, server));
        this._baseIpc.on('close', (err: any, socket: any, server: any) => this._onClose(err, socket, server));
        this._baseIpc.on('data', (data: any, socket: any, server: any) => this._onData(data, socket, server));

        let ipcBusTransport: IpcBusTransport = CreateIpcBusTransport(ipcOptions);
        this._ipcBusBrokerClient = new IpcBusCommonClient(ipcBusTransport);
    }

    // IpcBusBroker API
    start(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        let p = new Promise<string>((resolve, reject) => {
            this._baseIpc.once('listening', (server: any) => {
                // Reentrance guard ?
                if (this._ipcServer) {
                    resolve('started');
                }
                else {
                    this._ipcServer = server;
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${this._ipcOptions}`);
                    this._ipcBusBrokerClient.connect(`Broker_${process.pid}`)
                        .then(() => {
                            this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
                            this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_SERVICE_AVAILABLE, this._serviceAvailableLambda);
                            resolve('started');
                        })
                        .catch((err) => reject(`Broker client error = ${err}`));
                }
            });
            setTimeout(() => {
                reject('timeout');
            }, timeoutDelay);
            this._baseIpc.listen(this._ipcOptions.port, this._ipcOptions.host);
        });
        return p;
    }

    stop() {
        if (this._ipcServer) {
            this._ipcBusBrokerClient.off(IpcBusInterfaces.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
            this._ipcBusBrokerClient.off(IpcBusInterfaces.IPCBUS_CHANNEL_SERVICE_AVAILABLE, this._serviceAvailableLambda);
            this._ipcBusBrokerClient.close();
            this._ipcServer.close();
            this._ipcServer = null;
        }
    }

    private _queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach(function (connData, channel) {
            connData.peerNames.forEach(function (count, peerName) {
                queryStateResult.push({ channel: channel, peerName: peerName, count: count });
            });
        });
        return queryStateResult;
    }

    private _isServiceAvailable(serviceName: string): boolean {
        return this._subscriptions.hasChannel(IpcBusUtils.getServiceCallChannel(serviceName));
    }

    private _onQueryState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) {
        const queryState = this._queryState();
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(queryState);
        }
        else if (replyChannel != null) {
            this._ipcBusBrokerClient.send(replyChannel, queryState);
        }
    }

    private _onServiceAvailable(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) {
        const availability = this._isServiceAvailable(serviceName);
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Service '${serviceName}' availability : ${availability}`);
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(availability);
        }
    }

    private _onConnection(socket: any, server: any): void {
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        // IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        // IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        socket.on('error', (err: string) => {
            IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${err}`);
        });
    }

    private _onClose(err: any, socket: any, server: any): void {
        this._subscriptions.releaseConnection(socket.remotePort);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((socketForRequest, channel) => {
            if (socketForRequest.remotePort === socket.remotePort) {
                this._requestChannels.delete(channel);
            }
        });
        IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    private _onData(data: any, socket: any, server: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL: {
//                        const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Subscribe to channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);

                    this._subscriptions.addRef(ipcBusEvent.channel, socket.remotePort, socket, ipcBusEvent.sender.peerName);
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL: {
                    const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Unsubscribe from channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);

                    if (ipcBusData.unsubscribeAll) {
                        this._subscriptions.releasePeerName(ipcBusEvent.channel, socket.remotePort, ipcBusEvent.sender.peerName);
                    }
                    else {
                        this._subscriptions.release(ipcBusEvent.channel, socket.remotePort, ipcBusEvent.sender.peerName);
                    }
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE: {
                    const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Received send on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);

                    // Send data to subscribed connections
                    this._subscriptions.forEachChannel(ipcBusEvent.channel, function (connData, channel) {
                        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, ipcBusData, ipcBusEvent, data.args[2], connData.conn);
                    });
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE: {
                    const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Received request on channel '${ipcBusEvent.channel}' (reply = '${ipcBusData.replyChannel}') from peer #${ipcBusEvent.sender.peerName}`);

                    // Register on the replyChannel
                    this._requestChannels.set(ipcBusData.replyChannel, socket);

                    // Request data to subscribed connections
                    this._subscriptions.forEachChannel(ipcBusEvent.channel, function (connData, channel) {
                        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, ipcBusData, ipcBusEvent, data.args[2], connData.conn);
                    });
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE: {
                    const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Received response request on channel '${ipcBusEvent.channel}' (reply = '${ipcBusData.replyChannel}') from peer #${ipcBusEvent.sender.peerName}`);

                    let socket = this._requestChannels.get(ipcBusData.replyChannel);
                    if (socket) {
                        this._requestChannels.delete(ipcBusData.replyChannel);
                        // Send data to subscribed connections
                        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE, ipcBusData, ipcBusEvent, data.args[2], socket);
                    }
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL: {
                    const ipcBusData: IpcBusData = data.args[0];
                    const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = data.args[1];
                    IpcBusUtils.Logger.info(`[IPCBus:Broker] Received cancel request on channel '${ipcBusEvent.channel}' (reply = '${ipcBusData.replyChannel}') from peer #${ipcBusEvent.sender.peerName}`);

                    this._requestChannels.delete(ipcBusData.replyChannel);
                    break;
                }
            }
        }
    }
}
