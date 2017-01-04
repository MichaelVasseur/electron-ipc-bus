/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import {EventEmitter} from "events";
import * as BaseIpc from "easy-ipc";
import * as IpcBusInterfaces from "./IpcBusInterfaces";
import * as IpcBusUtils from "./IpcBusUtils";

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends EventEmitter implements IpcBusInterfaces.IpcBusClient {
    private _ipcOptions: IpcBusUtils.IpcOptions;
    protected _baseIpc: BaseIpc;
    protected _peerName: string;
    protected _busConn: any;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super();
        this._ipcOptions = ipcOptions;
        this._peerName = "Node_" + process.pid;
        this._baseIpc = new BaseIpc();
        this._baseIpc.on("data", (data: any, conn: any) => this._onData(data, conn));
    }

    protected _onData(data: any, conn: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        const msgPeerName = data.args[2];
                        console.log("[IPCBus:Node] Emit message received on topic '" + msgTopic + "' from peer #" + msgPeerName);
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgPeerName);
                        break;
                    }

                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        const msgPeerName = data.args[2];
                        const msgReplyTopic = data.args[3];
                        console.log("[IPCBus:Node] Emit request received on topic '" + msgTopic + "' from peer #" + msgPeerName);
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgPeerName, msgReplyTopic);
                        break;
                    }
            }
        }
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this._baseIpc.on("connect", (conn: any) => {
            this._busConn = conn;
            connectCallback("connect", this._busConn);
        });
        this._baseIpc.connect(this._ipcOptions.port, this._ipcOptions.host);
    }

    close() {
        this._busConn.end();
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        EventEmitter.prototype.addListener.call(this, topic, listenCallback);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        EventEmitter.prototype.removeListener.call(this, topic, listenCallback);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }

    send(topic: string, data: Object | string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, this._peerName, this._busConn);
    }

    // request(topic: string, data: Object | string, requestCallback: IpcBusInterfaces.IpcBusRequestFunc, timeoutDelay: number) {
    //     this.requestPromise(topic, data, timeoutDelay).then((RequestArgs) => {
    //         requestCallback(RequestArgs.topic, RequestArgs.payload, RequestArgs.peerName);
    //     });
    // }

    request(topic: string, data: Object | string, timeoutDelay: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        const generatedTopic = IpcBusUtils.GenerateReplyTopic();

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            // Prepare reply's handler, we have to change the replyTopic to topic
            const localRequestCallback: IpcBusInterfaces.IpcBusTopicHandler = (topic: string, content: Object | string, peerName: string, replyTopic?: string) => {
                console.log("[IPCBus:Node] Peer #" + peerName + " replied to request on " + generatedTopic + ": " + content);
                this.unsubscribe(generatedTopic, localRequestCallback);
                let response: IpcBusInterfaces.IpcBusRequestResponse = {topic: topic, payload: content, peerName: peerName};
                resolve(response);
            };

            this.subscribe(generatedTopic, localRequestCallback);

            // Execute request
            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, this._peerName, generatedTopic, this._busConn);

            // Clean-up
            setTimeout(() => {
                if (EventEmitter.prototype.listenerCount.call(this, generatedTopic) > 0) {
                    this.unsubscribe(generatedTopic, localRequestCallback);
                    reject("timeout");
                }
            }, timeoutDelay);
        });
        return p;
    }

    queryBrokerState(topic: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, this._peerName, this._busConn);
    }
}

