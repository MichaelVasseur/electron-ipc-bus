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
            connData.conn.send(name, name, ipcBusData, ipcBusEvent, args);
        });
    }

    protected _onRequestResponseEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusData.replyChannel}' from peer #${ipcBusEvent.sender.peerName}`);
        let connData: IpcBusUtils.ChannelConnectionMap.ConnectionData = this._requestChannels.get(ipcBusData.replyChannel);
        if (connData) {
            this._requestChannels.delete(ipcBusData.replyChannel);
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send response received on '${ipcBusData.replyChannel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(name, name, ipcBusData, ipcBusEvent, args);
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
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL
                        , (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onSubscribe(event, ipcBusEvent));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL
                        , (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, removeAll: boolean) => this.onUnsubscribe(event, ipcBusEvent, removeAll));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE
                        , (event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any) => this.onSend(event, ipcBusData, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE
                        , (event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any, ) => this.onRequest(event, ipcBusData, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE
                        , (event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any, ) => this.onRequestResponse(event, ipcBusData, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL
                        , (event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onRequestCancel(event, ipcBusData, ipcBusEvent));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE
                        , (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onQueryState(event, ipcBusEvent));
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
            this.onUnsubscribeCB({channel: channel, sender: {peerName: peerName}}, connData);
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

    onSubscribe(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} subscribed to channel '${ipcBusEvent.channel}'`);
        this._channelRendererRefs.addRef(ipcBusEvent.channel, webContents.id, webContents, ipcBusEvent.sender.peerName
            , (channel, peerName, connData) => {
                   this.ipcSubscribe(ipcBusEvent);
            }
        );
    }

    onUnsubscribeCB(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, connData: IpcBusUtils.ChannelConnectionMap.ConnectionData) {
        this.ipcUnsubscribe(ipcBusEvent);
    }

    onUnsubscribe(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, removeAll: boolean) {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} unsubscribed from channel '${ipcBusEvent.channel}'`);
        if (removeAll) {
            this._channelRendererRefs.releasePeerName(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName
                , (channel, peerName, connData) => this.onUnsubscribeCB(ipcBusEvent, connData));
        }
        else {
            this._channelRendererRefs.release(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName
                , (channel, peerName, connData) => this.onUnsubscribeCB(ipcBusEvent, connData));
        }
    }

    onSend(event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent message on '${ipcBusEvent.channel}'`);
        this.ipcSend(ipcBusData, ipcBusEvent, args);
    }

    onRequest(event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent request on '${ipcBusEvent.channel}'`);
        this._requestChannels.set(ipcBusData.replyChannel, new IpcBusUtils.ChannelConnectionMap.ConnectionData(webContents.id, webContents));
        this.ipcRequest(ipcBusData, ipcBusEvent, args);
    }

    onRequestResponse(event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent response request on '${ipcBusEvent.channel}'`);
        this.ipcRequestResponse(ipcBusData, ipcBusEvent, args);
    }

    onRequestCancel(event: any, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent cancel request on '${ipcBusEvent.channel}'`);
        this._requestChannels.delete(ipcBusData.replyChannel);
        this.ipcRequestCancel(ipcBusData, ipcBusEvent);
    }


    onQueryState(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} query Broker state on channel '${ipcBusEvent.channel}'`);
        this.ipcQueryBrokerState(ipcBusEvent);
    }
}

export class IpcBusMainClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Master', new IpcBusRendererBridge(ipcOptions));
    }
}

