import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusCommand } from './IpcBusTransport';
import { IpcBusTransportNode } from './IpcBusTransportNode';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusTransportNode implements IpcBusInterfaces.IpcBusBridge {
    private _ipcMain: any;
    private _webContents: any;

    private _subscriptions: IpcBusUtils.ChannelConnectionMap<number>;
    private _requestChannels: Map<string, any>;
    private _ipcBusPeers: Map<string, IpcBusInterfaces.IpcBusPeer>;

//    _lambdaCleanUpHandler: Function;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
        this._ipcMain = require('electron').ipcMain;
        this._webContents = require('electron').webContents;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<number>('IPCBus:Bridge');
        this._requestChannels = new Map<string, any>();
        this._ipcBusPeers = new Map<string, IpcBusInterfaces.IpcBusPeer>();
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    protected _onClose() {
        this._ipcBusPeers.clear();
        this._ipcMain.removeAllListeners(IpcBusUtils.IPC_BUS_RENDERER_COMMAND);
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand) {
        switch (ipcBusCommand.name) {
            case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE:
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                this._subscriptions.forEachChannel(ipcBusCommand.channel, (connData, channel) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send message received on '${channel}' to peer #Renderer_${connData.connKey}`);
                    connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, ipcBusCommand);
                });
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusCommand.data.replyChannel}' from peer #${ipcBusCommand.peer.name}`);
                let webContents = this._requestChannels.get(ipcBusCommand.data.replyChannel);
                if (webContents) {
                    this._requestChannels.delete(ipcBusCommand.data.replyChannel);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send response received on '${ipcBusCommand.data.replyChannel}' to peer #Renderer_${webContents.id}`);
                    webContents.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, ipcBusCommand);
                }
                break;
            }
        }
    }

    // IpcBusBridge API
    start(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }
        let p = new Promise<string>((resolve, reject) => {
            this.ipcConnect(timeoutDelay)
                .then((msg) => {
                    // Guard against people calling start several times
                    if (this._ipcMain.listenerCount(IpcBusUtils.IPC_BUS_RENDERER_COMMAND) === 0) {
                        this._ipcMain.addListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND
                            , (event: any, ipcBusCommand: IpcBusCommand) => this._onRendererMessage(event, ipcBusCommand));
                    }
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                    resolve(msg);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    stop() {
        this.ipcClose();
        this._ipcMain.removeAllListeners(IpcBusUtils.IPC_BUS_RENDERER_COMMAND);
    }

    // Not exposed
    queryState(): Object {
        let queryStateResult: Object[] = [];
        this._subscriptions.forEach((connData, channel) => {
            connData.peerIds.forEach((count: number, peerId: string) => {
                queryStateResult.push({ channel: channel, peer: this._ipcBusPeers.get(peerId), count: count });
            });
        });
        return queryStateResult;
    }

    private _rendererCleanUp(webContents: any, webContentsId: number, peerId: string): void {
        this._subscriptions.releaseConnection(webContentsId);
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((webContentsForRequest, channel) => {
            if (webContentsForRequest === webContents) {
                this._requestChannels.delete(channel);
            }
        });
    }

    private _onConnect(event: any, peerId: string): void {
        const webContents = event.sender;
        // Have to closure the webContentsId as webContents.id is undefined when destroyed !!!
        let webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents, webContentsId, peerId);
            // Simulate the close message
            let ipcBusPeer = this._ipcBusPeers.get(peerId);
            if (ipcBusPeer) {
                this._ipcPushCommand({ name: IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT, channel: '', peer: ipcBusPeer });
                this._ipcBusPeers.delete(peerId);
            }
        });
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
    }

    private _onRendererMessage(event: any, ipcBusCommand: IpcBusCommand) {
        const webContents = event.sender;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusCommand.peer.name} post ${ipcBusCommand.name} on '${ipcBusCommand.channel}'`);
        switch (ipcBusCommand.name) {
            case IpcBusUtils.IPC_BUS_COMMAND_CONNECT : {
                this._onConnect(event, ipcBusCommand.peer.id);
                let peerName = `${ipcBusCommand.peer.process.type}-${webContents.id}`;
                // Hidden function, may disappear
                try {
                    ipcBusCommand.peer.process.rid = webContents.getProcessId();
                    peerName += `-r${ipcBusCommand.peer.process.rid}`;
                }
                catch (err) {
                    ipcBusCommand.peer.process.rid = webContents.id;
                }
                // >= Electron 1.7.1
                try {
                    ipcBusCommand.peer.process.pid = webContents.getOSProcessId();
                    peerName += `_${ipcBusCommand.peer.process.pid}`;
                }
                catch (err) {
                    ipcBusCommand.peer.process.pid = webContents.id;
                }
                ipcBusCommand.peer.name = ipcBusCommand.args[0] || peerName;
                this._ipcBusPeers.set(ipcBusCommand.peer.id, ipcBusCommand.peer);
                // We get back to the webContents
                // - to confirm the connection
                // - to provide peerName and id/s
                webContents.send(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, ipcBusCommand.peer);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT :
            case IpcBusUtils.IPC_BUS_COMMAND_CLOSE : {
                // We do not close the socket, we just disconnect a peer
                ipcBusCommand.name = IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT;
                this._rendererCleanUp(webContents, webContents.id, ipcBusCommand.peer.id);
                this._ipcBusPeers.delete(ipcBusCommand.peer.id);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL : {
                this._subscriptions.addRef(ipcBusCommand.channel, webContents.id, webContents, ipcBusCommand.peer.id);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL : {
                if (ipcBusCommand.data.unsubscribeAll) {
                    this._subscriptions.releaseAll(ipcBusCommand.channel, webContents.id, ipcBusCommand.peer.id);
                }
                else {
                    this._subscriptions.release(ipcBusCommand.channel, webContents.id, ipcBusCommand.peer.id);
                }
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_ALL : {
                this._rendererCleanUp(webContents, webContents.id, ipcBusCommand.peer.id);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE : {
                this._requestChannels.set(ipcBusCommand.data.replyChannel, webContents);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL : {
                this._requestChannels.delete(ipcBusCommand.data.replyChannel);
                break;
            }
            default :
                break;
        }
        this._ipcPushCommand(ipcBusCommand);
    }
}

