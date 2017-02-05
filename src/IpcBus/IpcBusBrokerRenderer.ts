import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import {CreateIpcBusTransport, IpcBusTransport, IpcBusData} from './IpcBusTransport';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBrokerRenderer implements IpcBusInterfaces.IpcBusBroker {
    private _ipcBusTransport: IpcBusTransport;
    private _ipcObj: any;
    private _channelRendererRefs: IpcBusUtils.ChannelConnectionMap;
    private _requestChannels: Map<string, any>;
    private _webContents: any;
//    _lambdaCleanUpHandler: Function;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcObj = require('electron').ipcMain;
        this._channelRendererRefs = new IpcBusUtils.ChannelConnectionMap('[IpcBusBrokerRenderer]');
        this._requestChannels = new Map<string, any>();
        this._webContents = require('electron').webContents;
        this._ipcBusTransport = CreateIpcBusTransport(ipcOptions);
        this._ipcBusTransport._onEventReceived = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    private _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE: {
                IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
                this._channelRendererRefs.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
                    IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send message received on '${channel}' to peer #Renderer_${connData.connKey}`);
                    connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
                });
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE: {
                IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusData.replyChannel}' from peer #${ipcBusEvent.sender.peerName}`);
                let webContents = this._requestChannels.get(ipcBusData.replyChannel);
                if (webContents) {
                    this._requestChannels.delete(ipcBusData.replyChannel);
                    IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send response received on '${ipcBusData.replyChannel}' to peer #Renderer_${webContents.id}`);
                    webContents.send(IpcBusUtils.IPC_BUS_RENDERER_EVENT, name, ipcBusData, ipcBusEvent, args);
                }
                break;
            }
        }
    }

    // Set API
    start(timeoutDelay?: number): Promise<string> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }
        let p = new Promise<string>((resolve, reject) => {
            this._ipcBusTransport.ipcConnect(timeoutDelay)
                .then((msg) => {
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE
                        , (event: any) => this._onHandshake(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CONNECT
                        , (event: any) => this._onConnect(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CLOSE
                        , (event: any) => this._onClose(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND
                        , (event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onRendererMessage(event, command, ipcBusData, ipcBusEvent, args));
                    IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                    resolve(msg);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    stop() {
        this._ipcBusTransport.ipcClose();
        this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE);
        this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_RENDERER_CONNECT);
        this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_RENDERER_CLOSE);
        this._ipcObj.removeListener(IpcBusUtils.IPC_BUS_RENDERER_COMMAND);
    }

    private _rendererCleanUp(webContents: any, webContentsId: string): void {
        this._channelRendererRefs.releaseConnection(webContentsId, (channel, peerName, connData) => {
            this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: peerName, peerProcess: this._ipcBusTransport.ipcBusProcess}});
        });
        // ForEach is supposed to support deletion during the iteration !
        this._requestChannels.forEach((webContentsForRequest, channel) => {
            if (webContentsForRequest === webContents) {
                this._requestChannels.delete(channel);
            }
        });
    }

    private _onHandshake(event: any): void {
        const webContents = event.sender;
        // Have to closure the webContentsId as webContents is undefined when destroyed !!!
        let webContentsId = webContents.id;
        webContents.addListener('destroyed', () => {
            this._rendererCleanUp(webContents, webContentsId);
        });
        // webContents.addListener('destroyed', this._lambdaCleanUpHandler);
        webContents.send(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, webContents.id);
    }

    private _onConnect(event: any): void {
        const webContents = event.sender;
        webContents.send(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, webContents.id);
    }

    private _onClose(event: any): void {
        const webContents = event.sender;
        // Do not know how to manage that !
        // webContents.removeListener('destroyed', this._lambdaCleanUpHandler);
        this._rendererCleanUp(webContents, webContents.id);
    }

    private _onRendererMessage(event: any, command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} post ${command} on '${ipcBusEvent.channel}'`);
        switch (command) {
            case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL : {
                this._channelRendererRefs.addRef(ipcBusEvent.channel, webContents.id, webContents, ipcBusEvent.sender.peerName);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL : {
                if (ipcBusData.unsubscribeAll) {
                    this._channelRendererRefs.releasePeerName(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName);
                }
                else {
                    this._channelRendererRefs.release(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName);
                }
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
        this._ipcBusTransport.ipcPushCommand(command, ipcBusData, ipcBusEvent, args);
    }
}

