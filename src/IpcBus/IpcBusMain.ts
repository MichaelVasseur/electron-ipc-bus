import * as IpcBusUtils from './IpcBusUtils';

import {IpcBusSocketTransport} from './IpcBusNode';
import {IpcBusCommonClient} from './IpcBusClient';
import {IpcBusEventInternal} from './IpcBusClient';
import * as IpcBusInterfaces from './IpcBusInterfaces';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
class IpcBusRendererBridge extends IpcBusSocketTransport {
    _ipcObj: any;
    _channelRendererRefs: IpcBusUtils.ChannelConnectionMap;
    _webContents: any;
//    _lambdaCleanUpHandler: Function;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcOptions);
        this._ipcObj = require('electron').ipcMain;
        this._channelRendererRefs = new IpcBusUtils.ChannelConnectionMap('[IPCBus:Bridge]');
        this._webContents = require('electron').webContents;
        // this._lambdaCleanUpHandler = (webContentsId: string) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    // Override the base method, we forward message to renderer/s
    protected _onEventReceived(name: string, args: any[]) {
        const ipcBusEvent: IpcBusEventInternal = args[0];
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received ${name} on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        this._channelRendererRefs.forEachChannel(ipcBusEvent.channel, (connData, channel) => {
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward send received on '${channel}' to peer #Renderer_${connData.connKey}`);
            connData.conn.send(name, name, args);
        });
        super._onEventReceived(name, args);
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
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE
                        , (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent) => this.onSubscribe(event, ipcBusEvent));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE
                        , (event: any, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, removeAll: boolean) => this.onUnsubscribe(event, ipcBusEvent, removeAll));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND
                        , (event: any, ipcBusEvent: IpcBusEventInternal, data: any) => this.onSend(event, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST
                        , (event: any, ipcBusEvent: IpcBusEventInternal, data: any, ) => this.onRequest(event, ipcBusEvent, data));
                    this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE
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
            let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: {peerName: peerName}};
            this.onUnsubscribeCB(ipcBusEvent, connData)
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
            this._channelRendererRefs.releaseAll(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName
                , (channel, peerName, connData) => this.onUnsubscribeCB(ipcBusEvent, connData));
        }
        else {
            this._channelRendererRefs.release(ipcBusEvent.channel, webContents.id, ipcBusEvent.sender.peerName
                , (channel, peerName, connData) => this.onUnsubscribeCB(ipcBusEvent, connData));
        }
    }

    onSend(event: any, ipcBusEvent: IpcBusEventInternal, args: any[]): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent message on '${ipcBusEvent.channel}'`);
        this.ipcSend(ipcBusEvent, args);
    }

    onRequest(event: any, ipcBusEvent: IpcBusEventInternal, args: any[]): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${ipcBusEvent.sender.peerName} sent request on '${ipcBusEvent.channel}'`);
        this.ipcRequest(ipcBusEvent, args);
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

