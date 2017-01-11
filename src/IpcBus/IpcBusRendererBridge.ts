import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import {IpcBusNodeEventEmitter} from './IpcBusNode';

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusRendererBridge extends IpcBusNodeEventEmitter {
    _ipcObj: any;
    _topicRendererRefs: IpcBusUtils.TopicConnectionMap;
    _webContents: any;
//    _lambdaListenerHandler: Function;
//    _lambdaCleanUpHandler: Function;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Renderers', ipcOptions);
        this._ipcObj = require('electron').ipcMain;
        this._topicRendererRefs = new IpcBusUtils.TopicConnectionMap('[IPCBus:Bridge]');
        this._webContents = require('electron').webContents;
//        this._lambdaListenerHandler = (msgTopic: string, msgContent: any, msgPeer: string, msgReplyTopic?: string) => this.rendererSubscribeHandler(msgTopic, msgContent, msgPeer, msgReplyTopic);
        // this._lambdaCleanUpHandler = (webContentsId: any) => {
        //     this.rendererCleanUp(webContentsId);
        // };
    }

    // Override the base method, we forward message to renderer/s
    protected _onDataReceived(topic: string, payload: Object| string, peerName: string, replyTopic?: string) {
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
    connect(connectHandler: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect(() => {
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_HANDSHAKE, (event: any) => this.onHandshake(event));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CONNECT, (event: any) => this.onConnect(event));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_CLOSE, (event: any) => this.onClose(event));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SUBSCRIBE, (event: any, topic: string, peerName: string) => this.onSubscribe(event, topic, peerName));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_UNSUBSCRIBE, (event: any, topic: string, peerName: string) => this.onUnsubscribe(event, topic, peerName));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_SEND, (event: any, topic: string, data: any, peerName: string) => this.onSend(event, topic, data, peerName));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_REQUEST, (event: any, topic: string, data: any, peerName: string, replyTopic: string) => this.onRequest(event, topic, data, peerName, replyTopic));
            this._ipcObj.addListener(IpcBusUtils.IPC_BUS_RENDERER_QUERYSTATE, (event: any, topic: string, peerName: string) => this.onQueryState(event, topic, peerName));
            IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            connectHandler();
        });
    }

    rendererCleanUp(webContentsId: any): void {
        this._topicRendererRefs.releaseConnection(webContentsId, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
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

    onSubscribe(event: any, topic: string, peerName: string): void {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} subscribed to topic '${topic}'`);
        this._topicRendererRefs.addRef(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => {
            // If it is the first time this renderer is listening this topic, we have to add the callback
            // if (count === 1) {
            //     EventEmitter.prototype.addListener.call(this, topic, this._lambdaListenerHandler);
            //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Register callback for '${topic}'`);
            // }
            this.ipcSubscribe(topic, peerName);
        });
    }

    onUnsubscribeCB(topic: string, webContentsId: any, peerName: string, count: number) {
        // If it is the last time this renderer is listening this topic, we have to remove the callback
        // if (count === 0) {
        //     IpcBusUtils.Logger.info(`[IPCBus:Bridge] Unregister callback for '${topic}'`);
        //     EventEmitter.prototype.removeListener.call(this, topic, this._lambdaListenerHandler);
        // }
        this.ipcUnsubscribe(topic, peerName);
    }

    onUnsubscribe(event: any, topic: string, peerName: string) {
        const webContents = event.sender;
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} unsubscribed from topic '${topic}'`);
        this._topicRendererRefs.release(topic, webContents.id, peerName, (topic: string, webContentsId: any, peerName: string, count: number) => this.onUnsubscribeCB(topic, webContentsId, peerName, count));
    }

    onSend(event: any, topic: string, data: any, peerName: string): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} sent message on '${topic}'`);
        this.ipcSend(topic, data, peerName);
    }

    onRequest(event: any, topic: string, data: any, peerName: string, replyTopic: string): void {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} sent request on '${topic}'`);
        this.ipcRequest(topic, data, peerName, replyTopic);
    }

    onQueryState(event: any, topic: string, peerName: string) {
        IpcBusUtils.Logger.info(`[IPCBus:Bridge] Peer #${peerName} query Broker state on topic '${topic}'`);
        this.ipcQueryBrokerState(topic, peerName);
    }
}
