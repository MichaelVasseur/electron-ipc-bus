/// <reference types='node' />

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import {IpcBusBrokerClient} from './IpcBusBrokerClient';
// import {EventEmitter} from 'events';

/** @internal */
export class IpcBusBrokerBridge extends IpcBusBrokerClient {
    _ipcObj: any;
    _topicRendererRefs: IpcBusUtils.TopicConnectionMap;
    _webContents: any;
//    _lambdaListenerHandler: Function;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcOptions);
        this._ipcObj = require('electron').ipcMain;
        this._topicRendererRefs = new IpcBusUtils.TopicConnectionMap('[IPCBus:Bridge]');
        this._webContents = require('electron').webContents;
//        this._lambdaListenerHandler = (msgTopic: string, msgContent: any, msgPeer: string, msgReplyTopic?: string) => this.rendererSubscribeHandler(msgTopic, msgContent, msgPeer, msgReplyTopic);
    }

    // Override the base method
    protected _onMessageReceived(topic: string, payload: Object| string, peerName: string, replyTopic?: string) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Received message on topic '${topic}' from peer #${peerName} (replyTopic?='${replyTopic}')`);
        this._topicRendererRefs.forEachTopic(topic, (peerNames: Map<string, number>, webContentsId: any, topic: string) => {
            let webContents = this._webContents.fromId(webContentsId);
            if (webContents) {
                const peerName = 'Renderer_' + webContentsId;
                IpcBusUtils.Logger.info(`[IPCBus:Bridge] Forward message received on '${topic}' to peer #${peerName}`);
                webContents.send(IpcBusUtils.IPC_BUS_RENDERER_RECEIVE, topic, payload, peerName, replyTopic);
            }
        });
    }

    // Set API
    connect(callback: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect((eventName: string, conn: any) => {
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, (event: any, topic: string) => this.onSubscribe(event, topic));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, (event: any, topic: string) => this.onUnsubscribe(event, topic));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND, (event: any, topic: string, data: any) => this.onSend(event, topic, data));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, (event: any, topic: string, data: any, replyTopic: string) => this.onRequest(event, topic, data, replyTopic));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, (event: any, topic: string) => this.onQueryState(event, topic));
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            callback(eventName, conn);
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
//                EventEmitter.prototype.addListener.call(this, topic, this._lambdaListenerHandler);
//                IpcBusUtils.Logger.info(`[IPCBus:Bridge] Register callback for '${topic}'`);
                webContents.on('destroyed', () => {
                    this.rendererCleanUp(webContentsId);
                });
            }
            this.postSubscribe(topic, peerName);
        });
    }

    onUnsubscribeCB(topic: string, webContentsId: any, peerName: string, count: number) {
        // If it is the last time this renderer is listening this topic, we have to remove the callback
        // if (count === 0) {
        //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Unregister callback for '${topic}'`);
        //     EventEmitter.prototype.removeListener.call(this, topic, this._lambdaListenerHandler);
        // }
        this.postUnsubscribe(topic, peerName);
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
        this.postSend(topic, data, peerName);
    }

    onRequest(event: any, topic: string, data: any, replyTopic: string): void {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} sent request on '${topic}'`);
        this.postRequest(topic, data, peerName, replyTopic);
    }

    onQueryState(event: any, topic: string) {
        const webContents = event.sender;
        const peerName = 'Renderer_' + webContents.id;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} query Broker state on topic '${topic}'`);
        this.postQueryBrokerState(topic, peerName);
    }
}
