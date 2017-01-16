import * as IpcBusUtils from './IpcBusUtils';

import {IpcBusNodeEventEmitter} from './IpcBusNode';
import {IpcBusCommonClient} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
class IpcBusRendererBridge extends IpcBusNodeEventEmitter {
    _ipcObj: any;
    _channelRendererRefs: IpcBusUtils.ChannelConnectionMap;
    _webContents: any;
//    _lambdaListenerHandler: Function;
//    _lambdaCleanUpHandler: Function;

    constructor(peerName: string, ipcOptions: IpcBusUtils.IpcOptions) {
        super(peerName, ipcOptions);
        this._ipcObj = require('electron').ipcMain;
        this._channelRendererRefs = new IpcBusUtils.ChannelConnectionMap('[IPCBus:Bridge]');
        this._webContents = require('electron').webContents;
//        this._lambdaListenerHandler = (msgChannel: string, msgContent: any, msgPeer: string, msgReplyChannel?: string) => this.rendererSubscribeHandler(msgChannel, msgContent, msgPeer, msgReplyChannel);
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    // Override the base method, we forward message to renderer/s
    protected _onSendDataReceived(args: any[]) {
        const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = args[0];
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received send on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        this._channelRendererRefs.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send received on '${channel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_ON_SEND, args);
        });
        super._onSendDataReceived(args);
    }

    protected _onRequestDataReceived(args: any[]) {
        const replyChannel = args[0];
        const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = args[1];
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received request on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel = '${replyChannel}')`);
        this._channelRendererRefs.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward request received on '${channel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(IpcBusUtils.IPC_BUS_RENDERER_ON_REQUEST, args);
        });
        super._onRequestDataReceived(args);
    }

    // Set API
    connect(): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            super.connect()
                .then((msg) => {
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (event: any) => this.onHandshake(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, (event: any) => this.onConnect(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CLOSE, (event: any) => this.onClose(event));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onSubscribe(event, ipcBusEvent));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onUnsubscribe(event, ipcBusEvent));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND, (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any) => this.onSend(event, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, (event: any, replyChannel: string, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any, ) => this.onRequest(event, replyChannel, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onQueryState(event, ipcBusEvent));
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
            let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: {peerName: peerName}};
            this.onUnsubscribeCB(ipcBusEvent, connData)
        });
    }

    onHandshake(event: any): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        // Have to store the webContentsId as webContents is undefined when destroyed !!!
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
        this._channelRendererRefs.addRef(ipcBusEvent.channel, webContents.id, webContents, ipcBusEvent.sender.peerName, (channel, peerName, connData) => {
            // If it is the first time this renderer is listening this channel, we have to add the callback
            // if (count === 1) {
            //     EventEmitter.prototype.addListener.call(this, channel, this._lambdaListenerHandler);
            //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Register callback for '${channel}'`);
            // }
            this.ipcSubscribe(ipcBusEvent);
        });
    }

    onUnsubscribeCB(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, connData: IpcBusUtils.ChannelConnectionMap.ConnectionData) {
        // If it is the last time this renderer is listening this channel, we have to remove the callback
        // if (count === 0) {
        //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Unregister callback for '${channel}'`);
        //     EventEmitter.prototype.removeListener.call(this, channel, this._lambdaListenerHandler);
        // }
        this.ipcUnsubscribe(ipcBusEvent);
    }

    onUnsubscribe(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} unsubscribed from channel '${ipcBusEvent.channel}'`);
        this._channelRendererRefs.release(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName, (channel, peerName, connData) => this.onUnsubscribeCB(ipcBusEvent, connData));
    }

    onSend(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent message on '${ipcBusEvent.channel}'`);
        this.ipcSend(ipcBusEvent, data);
    }

    // onEmitSend(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any): void {
    //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent message on '${ipcBusEvent.channel}'`);
    //     this.ipcSend(ipcBusEvent, data);
    // }

    onRequest(event: any, replyChannel: string, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: any): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent request on '${ipcBusEvent.channel}'`);
        this.ipcRequest(replyChannel, ipcBusEvent, data);
    }

    onQueryState(event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} query Broker state on channel '${ipcBusEvent.channel}'`);
        this.ipcQueryBrokerState(ipcBusEvent);
    }
}

export class IpcBusMainClient extends IpcBusCommonClient {
    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(new IpcBusRendererBridge('Master', ipcOptions));
    }
}

