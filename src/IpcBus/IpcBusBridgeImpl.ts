import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import {IpcBusData} from './IpcBusTransport';
import {IpcBusTransportNode} from './IpcBusTransportNode';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl extends IpcBusTransportNode implements IpcBusInterfaces.IpcBusBridge  {
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

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.name}`);
                this._subscriptions.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send message received on '${channel}' to peer #Renderer_${connData.connKey}`);
                    connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
                });
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusData.replyChannel}' from peer #${ipcBusEvent.sender.name}`);
                let webContents = this._requestChannels.get(ipcBusData.replyChannel);
                if (webContents) {
                    this._requestChannels.delete(ipcBusData.replyChannel);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send response received on '${ipcBusData.replyChannel}' to peer #Renderer_${webContents.id}`);
                    webContents.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
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
                            , (event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onRendererMessage(event, command, ipcBusData, ipcBusEvent, args));
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
                this._ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT, {peerId: peerId}, {channel: '', sender: ipcBusPeer});
                this._ipcBusPeers.delete(peerId);
            }
        });
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
    }

    private _onRendererMessage(event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        const webContents = event.sender;
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.name} post ${command} on '${ipcBusEvent.channel}'`);
        switch (command) {
            case IpcBusUtils.IPC_BUS_COMMAND_CONNECT : {
                this._onConnect(event, ipcBusData.peerId);
                ipcBusEvent.sender.process.rid = webContents.id;
                // Hidden function, may disappear
                try {
                // Electron 1.7.1
                // ipcBusEvent.sender.process.pid = webContents.getOSProcessId();
                    ipcBusEvent.sender.process.pid = webContents.getProcessId();
                }
                catch (err) {
                    ipcBusEvent.sender.process.pid = webContents.id;
                }
                let peerName = args[0];
                if (peerName == null) {
                    peerName = `${ipcBusEvent.sender.process.type}-${ipcBusEvent.sender.process.rid}_${ipcBusEvent.sender.process.pid}`;
                }
                ipcBusEvent.sender.name = peerName;
                this._ipcBusPeers.set(ipcBusData.peerId, ipcBusEvent.sender);
                // We get back to the webContents
                // - to confirm the connection
                // - to provide the webContents id
                webContents.send(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, ipcBusEvent.sender);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT :
            case IpcBusUtils.IPC_BUS_COMMAND_CLOSE : {
                // We do not close the socket, we just disconnect a peer
                command = IpcBusUtils.IPC_BUS_COMMAND_DISCONNECT;
                this._rendererCleanUp(webContents, webContents.id, ipcBusData.peerId);
                this._ipcBusPeers.delete(ipcBusData.peerId);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL : {
                this._subscriptions.addRef(ipcBusEvent.channel, webContents.id, webContents, ipcBusData.peerId);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL : {
                if (ipcBusData.unsubscribeAll) {
                    this._subscriptions.releaseAll(ipcBusEvent.channel, webContents.id, ipcBusData.peerId);
                }
                else {
                    this._subscriptions.release(ipcBusEvent.channel, webContents.id, ipcBusData.peerId);
                }
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_ALL : {
                this._rendererCleanUp(webContents, webContents.id, ipcBusData.peerId);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE : {
                this._requestChannels.set(ipcBusData.replyChannel, webContents);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL : {
                this._requestChannels.delete(ipcBusData.replyChannel);
                break;
            }
            default :
                break;
        }
        this._ipcPushCommand(command, ipcBusData, ipcBusEvent, args);
    }
}

