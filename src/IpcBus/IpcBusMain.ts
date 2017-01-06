/// <reference types='node' />
/// <reference path='typings/easy-ipc.d.ts'/>

import { EventEmitter } from 'events';
import * as BaseIpc from 'easy-ipc';
import { IpcBusNodeClient } from './IpcBusNode';
import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

class IpcBusBridge {
    _ipcObj: any;
    _topicRendererRefs: IpcBusUtils.TopicConnectionMap;
    _webContents: any;
    _busConn: any;
    _eventEmitter: EventEmitter;
    _lambdaListenerHandler: Function;

    constructor(eventEmitter: EventEmitter, conn: any) {
        this._eventEmitter = eventEmitter;
        this._busConn = conn;
        this._ipcObj = require('electron').ipcMain;
        this._topicRendererRefs = new IpcBusUtils.TopicConnectionMap('BridgeRef');
        this._webContents = require('electron').webContents;
        this._lambdaListenerHandler = (msgTopic: string, msgContent: any, msgPeer: string, msgReplyTopic?: string) => this.rendererSubscribeHandler(msgTopic, msgContent, msgPeer, msgReplyTopic);

        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, (event: any, topic: string) => this.onSubscribe(event, topic));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, (event: any, topic: string) => this.onUnsubscribe(event, topic));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND, (event: any, topic: string, data: any) => this.onSend(event, topic, data));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, (event: any, topic: string, data: any, replyTopic: string) => this.onRequest(event, topic, data, replyTopic));
        this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, (event: any, topic: string) => this.onQueryState(event, topic));
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
    }

    rendererSubscribeHandler(msgTopic: string, msgContent: any, msgPeer: string, msgReplyTopic?: string): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] message received on '${msgTopic}'`);
        this._topicRendererRefs.forEachTopic(msgTopic, (peerNames: Map<string, number>, webContentsId: any, topic: string) => {
            const peerName = 'Renderer_' + webContentsId;
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward message received on '${topic}' to peer #${peerName}`);
            let webContents = this._webContents.fromId(webContentsId);
            if (webContents != null) {
                webContents.send(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, msgTopic, msgContent, msgPeer, msgReplyTopic);
            }
        });
    }

    rendererCleanUp(webContentsId: any): void {
        this._topicRendererRefs.releaseConnection(webContentsId, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
    }

    onSubscribe(event: any, topic: string): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} subscribed to topic '${topic}'`);
        this._topicRendererRefs.addRef(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => {
            // If it is the first time this renderer is listening this topic, we have to add the callback
            if (count === 1) {
                EventEmitter.prototype.addListener.call(this._eventEmitter, topic, this._lambdaListenerHandler);
                IpcBusUtils.Logger.info(`[IPCBus:Bridge] Register callback for '${topic}'`);
                webContents.on('destroyed', () => {
                    this.rendererCleanUp(webContentsId);
                });
            }
            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, this._busConn);
        });
    }

    onUnsubscribeCB(topic: string, webContentsId: any, peerName: string, count: number) {
        // If it is the last time this renderer is listening this topic, we have to remove the callback
        if (count === 0) {
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Unregister callback for '${topic}'`);
            EventEmitter.prototype.removeListener.call(this._eventEmitter, topic, this._lambdaListenerHandler);
        }
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    onUnsubscribe(event: any, topic: string) {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} unsubscribed from topic '${topic}'`);
        this._topicRendererRefs.release(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
    }

    onSend(event: any, topic: string, data: any): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} sent message on '${topic}'`);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, peerName, this._busConn);
    }

    onRequest(event: any, topic: string, data: any, replyTopic: string): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} sent request on '${topic}'`);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, replyTopic, peerName, this._busConn);
    }

    onQueryState(event: any, topic: string) {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} query Broker state on topic '${topic}'`);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, this._busConn);
    }
}


// Implementation for Master process
/** @internal */
export class IpcBusMainClient extends IpcBusNodeClient {
    private _ipcBusBridge: IpcBusBridge;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcOptions);
        this._peerName = 'Master';
    }

    // Set API
    connect(callback: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect((eventName: string, conn: any) => {
            this._ipcBusBridge = new IpcBusBridge(this, conn);
            callback(eventName, conn);
        });
    }
}

