/// <reference types='node' />
/// <reference path='typings/easy-ipc.d.ts'/>

import {EventEmitter} from 'events';
import * as BaseIpc from 'easy-ipc';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for Node process
/** @internal */
export class IpcBusBrokerClient extends EventEmitter {
    private _ipcOptions: IpcBusUtils.IpcOptions;
    private _baseIpc: BaseIpc;
    private _busConn: any;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super();
        this._ipcOptions = ipcOptions;
        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data: any, conn: any) => this._onData(data, conn));
    }

    protected _onData(data: any, conn: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                    {
                        const topic = data.args[0];
                        const payload = data.args[1];
                        const peerName = data.args[2];
                        IpcBusUtils.Logger.info(`[IPCBus:Node] Emit message received on topic '${topic}' from peer #${peerName}`);
                        this._onSendReceived(topic, payload, peerName);
                        break;
                    }

                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const topic = data.args[0];
                        const payload = data.args[1];
                        const peerName = data.args[2];
                        const replyTopic = data.args[3];
                        IpcBusUtils.Logger.info(`[IPCBus:Node] Emit request received on topic '${topic}' from peer #${peerName}`);
                        this._onRequestReceived(topic, payload, peerName, replyTopic);
                        break;
                    }
            }
        }
    }

    protected _onSendReceived(topic: string, payload: Object| string, peerName: string) {
        EventEmitter.prototype.emit.call(this, topic, topic, payload, peerName);
    }

    protected _onRequestReceived(topic: string, payload: Object| string, peerName: string, replyTopic: string) {
        EventEmitter.prototype.emit.call(this, topic, topic, payload, peerName,
            (resolve: Object | string) => {
                this.postSend(replyTopic, { resolve : resolve }, peerName);
            },
            (err: string) => {
                this.postSend(replyTopic, { reject : err }, peerName);
            }
        );
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this._baseIpc.on('connect', (conn: any) => {
            this._busConn = conn;
            connectCallback('connect', this._busConn);
        });
        this._baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
    }

    close() {
        this._busConn.end();
    }

    subscribe(topic: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        EventEmitter.prototype.addListener.call(this, topic, listenCallback);
        this.postSubscribe(topic, peerName);
    }

    postSubscribe(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    unsubscribe(topic: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        EventEmitter.prototype.removeListener.call(this, topic, listenCallback);
        this.postUnsubscribe(topic, peerName);
    }

    postUnsubscribe(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, peerName, this._busConn);
    }

    send(topic: string, data: Object | string, peerName: string) {
        this.postSend(topic, data, peerName);
    }

    postSend(topic: string, data: Object | string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, peerName, this._busConn);
    }

    request(topic: string, data: Object | string, peerName: string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (topic, payload, peerName, requestResolve, requestReject) => {
                IpcBusUtils.Logger.info(`[IPCBus:Node] Peer #${peerName} replied to request on ${generatedTopic} : ${payload}`);
                this.unsubscribe(generatedTopic, peerName, localRequestCallback);
                let content = payload as any;
                if (content.hasOwnProperty('resolve')) {
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content.resolve, peerName: peerName};
                    resolve(response);
                }
                else if (content.hasOwnProperty('reject')) {
                    reject(content.reject);
                }
                else {
                    reject('unknown format');
                }
            };

            this.subscribe(generatedTopic, peerName, localRequestCallback);

            // Execute request
            this.postRequest(topic, data, peerName, generatedTopic);

            // Clean-up
            setTimeout(() => {
                if (EventEmitter.prototype.listenerCount.call(this, generatedTopic) > 0) {
                    this.unsubscribe(generatedTopic, peerName, localRequestCallback);
                    reject('timeout');
                }
            }, timeoutDelay);
        });
        return p;
    }

    postRequest(topic: string, data: Object | string, peerName: string, replyTopic: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, peerName, replyTopic, this._busConn);
    }

    queryBrokerState(topic: string, peerName: string) {
        this.postQueryBrokerState(topic, peerName);
    }

    postQueryBrokerState(topic: string, peerName: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, peerName, this._busConn);
    }
}

