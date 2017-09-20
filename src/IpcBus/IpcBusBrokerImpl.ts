//import { Buffer } from 'buffer';

import { IpcPacketNet as BaseIpc } from './Net/ipcPacketNet';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
// import * as util from 'util';

import { IpcBusCommonClient } from './IpcBusClient';
import { IpcBusTransport, IpcBusCommand } from './IpcBusTransport';
import { IpcBusTransportNode } from './IpcBusTransportNode';
import { IpcPacketBuffer } from './Net/ipcPacketBuffer';

/** @internal */
export class IpcBusBrokerImpl implements IpcBusInterfaces.IpcBusBroker {
    private _baseIpc: BaseIpc;
    private _ipcServer: any = null;
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _ipcBusBrokerClient: IpcBusCommonClient;

    private _promiseStarted: Promise<string>;

    private _subscriptions: IpcBusUtils.ChannelConnectionMap<string>;
    private _requestChannels: Map<string, any>;
    private _ipcBusPeers: Map<string, IpcBusInterfaces.IpcBusPeer>;

    private _queryStateLamdba: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) => this._onQueryState(ipcBusEvent, replyChannel);
    private _serviceAvailableLambda: IpcBusInterfaces.IpcBusListener = (ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) => this._onServiceAvailable(ipcBusEvent, serviceName);

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcOptions = ipcOptions;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string>('IPCBus:Broker');
        this._requestChannels = new Map<string, any>();
        this._ipcBusPeers = new Map<string, IpcBusInterfaces.IpcBusPeer>();

        let ipcBusTransport: IpcBusTransport = new IpcBusTransportNode(ipcBusProcess, ipcOptions);
        this._ipcBusBrokerClient = new IpcBusCommonClient(ipcBusTransport);
    }

    private _reset() {
        this._promiseStarted = null;
        if (this._baseIpc) {
            this._baseIpc.removeAllListeners();
            this._baseIpc = null;
        }

        if (this._ipcServer) {
            this._ipcBusBrokerClient.close();
            this._ipcServer.close();
            this._ipcServer = null;
        }
    }

    // IpcBusBroker API
    start(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseStarted;
        if (!p) {
            p = this._promiseStarted = new Promise<string>((resolve, reject) => {
                let timer: NodeJS.Timer;
                // Below zero = infinite
                if (timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        this._reset();
                        reject('timeout');
                    }, timeoutDelay);
                }
                this._baseIpc = new BaseIpc();
                this._baseIpc.once('listening', (server: any) => {
                    this._ipcServer = server;
                    if (this._baseIpc) {
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Listening for incoming connections on ${this._ipcOptions}`);
                        clearTimeout(timer);
                        this._baseIpc.on('connection', (socket: any, server: any) => this._onConnection(socket, server));
                        this._baseIpc.on('close', (err: any, socket: any, server: any) => this._onClose(err, socket, server));
                        this._baseIpc.on('packet', (buffer: any, socket: any, server: any) => this._onData(buffer, socket, server));

                        this._ipcBusBrokerClient.connect(`Broker_${process.pid}`)
                            .then(() => {
                                this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_QUERY_STATE, this._queryStateLamdba);
                                this._ipcBusBrokerClient.on(IpcBusInterfaces.IPCBUS_CHANNEL_SERVICE_AVAILABLE, this._serviceAvailableLambda);
                                resolve('started');
                            })
                            .catch((err) => {
                                this._reset();
                                reject(`Broker client error = ${err}`);
                            });
                    }
                    else {
                        this._reset();
                    }
                });

                this._baseIpc.listen(this._ipcOptions.port, this._ipcOptions.host);
            });
        }
        return p;
    }

    stop() {
        if (this._ipcServer) {
            this._reset();
        }
    }

    queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((count: number, peerId: string) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerId), count: count });
            });
        });
        return queryStateResult;
    }

    isServiceAvailable(serviceName: string): boolean {
        return this._subscriptions.hasChannel(IpcBusUtils.getServiceCallChannel(serviceName));
    }

    private _onQueryState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, replyChannel: string) {
        const queryState = this.queryState();
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(queryState);
        }
        else if (replyChannel != null) {
            this._ipcBusBrokerClient.send(replyChannel, queryState);
        }
    }

    private _onServiceAvailable(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, serviceName: string) {
        const availability = this.isServiceAvailable(serviceName);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Service '${serviceName}' availability : ${availability}`);
        if (ipcBusEvent.request) {
            ipcBusEvent.request.resolve(availability);
        }
    }

    private _onConnection(socket: any, server: any): void {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Incoming connection !`);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.address=' + JSON.stringify(socket.address()));
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.localAddress=' + socket.localAddress);
        // IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remoteAddress=' + socket.remoteAddress);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info('[IPCBus:Broker] socket.remotePort=' + socket.remotePort);
        socket.on('error', (err: string) => {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Error on connection: ${err}`);
        });
    }

    private _socketCleanUp(socket: any): void {
        this._subscriptions.releaseConnection(socket.remotePort);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((socketForRequest, channel) => {
            if (socketForRequest.remotePort === socket.remotePort) {
                this._requestChannels.delete(channel);
            }
        });
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connection closed !`);
    }

    private _onClose(err: any, socket: any, server: any): void {
        this._socketCleanUp(socket);
    }

    private _onData(buffer: Buffer, socket: any, server: any): void {
        let ipcBusCommand: IpcBusCommand = IpcPacketBuffer.toObject(buffer);
        if (ipcBusCommand && ipcBusCommand.name) {
            switch (ipcBusCommand.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_CONNECT: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Connect peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    this._ipcBusPeers.set(ipcBusCommand.peer.id, ipcBusCommand.peer);
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Unsubscribe all '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    if (this._ipcBusPeers.delete(ipcBusCommand.peer.id)) {
                        this._subscriptions.releasePeerId(socket.remotePort, ipcBusCommand.peer.id);
                    }
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_CLOSE: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Close peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}}`);

                    this._socketCleanUp(socket);
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Subscribe to channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    this._subscriptions.addRef(ipcBusCommand.channel, socket.remotePort, socket, ipcBusCommand.peer.id);
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Unsubscribe from channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    if (ipcBusCommand.data.unsubscribeAll) {
                        this._subscriptions.releaseAll(ipcBusCommand.channel, socket.remotePort, ipcBusCommand.peer.id);
                    }
                    else {
                        this._subscriptions.release(ipcBusCommand.channel, socket.remotePort, ipcBusCommand.peer.id);
                    }
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_ALL: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Unsubscribe all '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    this._subscriptions.releasePeerId(socket.remotePort, ipcBusCommand.peer.id);
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Received send on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    // Send ipcBusCommand to subscribed connections
                    this._subscriptions.forEachChannel(ipcBusCommand.channel, function (connData, channel) {
                       connData.conn.write(buffer);
                    });
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Received request on channel '${ipcBusCommand.channel}' (reply = '${ipcBusCommand.data.replyChannel}') from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    // Register on the replyChannel
                    this._requestChannels.set(ipcBusCommand.data.replyChannel, socket);

                    // Request ipcBusCommand to subscribed connections
                    this._subscriptions.forEachChannel(ipcBusCommand.channel, function (connData, channel) {
                        connData.conn.write(buffer);
                    });
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Received response request on channel '${ipcBusCommand.channel}' (reply = '${ipcBusCommand.data.replyChannel}') from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}}`);

                    let socket = this._requestChannels.get(ipcBusCommand.data.replyChannel);
                    if (socket) {
                        this._requestChannels.delete(ipcBusCommand.data.replyChannel);
                        // Send ipcBusCommand to subscribed connections
                        socket.write(buffer);
                    }
                    break;
                }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL: {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Broker] Received cancel request on channel '${ipcBusCommand.channel}' (reply = '${ipcBusCommand.data.replyChannel}') from peer #${ipcBusCommand.peer.id} - ${ipcBusCommand.peer.name}`);

                    this._requestChannels.delete(ipcBusCommand.data.replyChannel);
                    break;
                }
            }
        }
    }
}
