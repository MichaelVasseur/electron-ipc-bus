import * as IpcBusUtils from './IpcBusUtils';

import {IpcBusSocketTransport} from './IpcBusNode';
import {IpcBusCommonClient} from './IpcBusClient';
import {IpcBusData} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
class IpcBusRendererBridge extends IpcBusSocketTransport {
    _ipcObj: any;
    _channelRendererRefs: IpcBusUtils.ChannelConnectionMap;
    _requestChannels: Map<string, IpcBusUtils.ChannelConnectionMap.ConnectionData>;
    _webContents: any;
//    _lambdaCleanUpHandler: Function;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcOptions);
        this._ipcObj = require('electron').ipcMain;
        this._channelRendererRefs = new IpcBusUtils.ChannelConnectionMap('[IPCBus:Bridge]');
        this._requestChannels = new Map<string, IpcBusUtils.ChannelConnectionMap.ConnectionData>();
        this._webContents = require('electron').webContents;
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    // Override the base method, we forward message to renderer/s
    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                this._onMessageEventReceived(name, ipcBusData, ipcBusEvent, args);
                break;
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE:
                this._onRequestResponseEventReceived(name, ipcBusData, ipcBusEvent, args);
                break;
        }
        super._onEventReceived(name, ipcBusData, ipcBusEvent, args);
    }

    protected _onMessageEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        this._channelRendererRefs.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send message received on '${channel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
        });
    }

    protected _onRequestResponseEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusData.replyChannel}' from peer #${ipcBusEvent.sender.peerName}`);
        let connData: IpcBusUtils.ChannelConnectionMap.ConnectionData = this._requestChannels.get(ipcBusData.replyChannel);
        if (connData) {
            this._requestChannels.delete(ipcBusData.replyChannel);
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send response received on '${ipcBusData.replyChannel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
        }
    }

    // Set API
    ipcConnect(): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            super.ipcConnect()
                .then((msg) => {
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE
                        , (event: any) => this.onHandshake(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CONNECT
                        , (event: any) => this.onConnect(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CLOSE
                        , (event: any) => this.onClose(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND
                        , (event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this.onRendererMessage(event, command, ipcBusData, ipcBusEvent, args));
                    IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                    resolve(msg);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    rendererCleanUp(webContentsId: string): void {
        this._channelRendererRefs.releaseConnection(webContentsId, (channel, peerName, connData) => {
            super.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: peerName}});
        });
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((connData, channel) => {
            if (connData.connKey === webContentsId) {
                this._requestChannels.delete(channel);
            }
        });
    }

    onHandshake(event: any): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        // Have to closure the webContentsId as webContents is undefined when destroyed !!!
        let webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            this.rendererCleanUp(webContentsId);
        });
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
        webContents.send(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, peerName);
    }

    onConnect(event: any): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        webContents.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, peerName);
    }

    onClose(event: any): void {
        const webContents = event.sender;
        // Do not know how to manage that !
        // webContents.removeListener('destroyed', this._lambdaCleanUpHandler);
        this.rendererCleanUp(webContents.id);
    }

    onRendererMessage(event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} post ${command} on '${ipcBusEvent.channel}'`);
        switch (command) {
            case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL :
            {
                this._channelRendererRefs.addRef(ipcBusEvent.channel, webContents.id, webContents, ipcBusEvent.sender.peerName);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL :
            {
                if (ipcBusData.unsubscribeAll) {
                    this._channelRendererRefs.releasePeerName(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName);
                }
                else {
                    this._channelRendererRefs.release(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName);
                }
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE :
            {
                this._requestChannels.set(ipcBusData.replyChannel, new IpcBusUtils.ChannelConnectionMap.ConnectionData(webContents.id, webContents));
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL :
            {
                this._requestChannels.delete(ipcBusData.replyChannel);
                break;
            }
            default :
                break;
        }
        super.ipcPushCommand(command, ipcBusData, ipcBusEvent, args);
    }
}

export class IpcBusMainClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Master', new IpcBusRendererBridge(ipcOptions));
    }

    // Master is in charge to dispatch renderer events, so it can be called very often even if it has no listeners on its own.
    // For optimization-purpose we test if there are real master listeners for the channel before proceeding
    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        if (super.listenerCount(ipcBusEvent.channel) > 0) {
            super._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        }
    }
}

