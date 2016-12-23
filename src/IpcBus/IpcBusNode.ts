/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import {EventEmitter} from "events";
import * as BaseIpc from "easy-ipc";
import * as IpcBusInterfaces from "./IpcBusInterfaces";
import * as IpcBusUtils from "./IpcBusUtils";

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient extends EventEmitter implements IpcBusInterfaces.IpcBusClient {
    protected _busPath: string;
    protected _baseIpc: BaseIpc;
    protected _peerName: string;
    protected _busConn: any;

    constructor(busPath?: string) {
        super();
        if (busPath == null) {
            this._busPath = IpcBusUtils.GetCmdLineArgValue("bus-path");
        }
        else {
            this._busPath = busPath;
        }
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
                        console.log("[IPCBus:Client] Emit message received on topic '" + msgTopic + "' from peer #" + msgPeerName);
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgPeerName);
                        break;
                    }

                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        const msgReplyTopic = data.args[2];
                        const msgPeerName = data.args[3];
                        console.log("[IPCBus:Client] Emit request received on topic '" + msgTopic + "' from peer #" + msgPeerName);
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgReplyTopic, msgPeerName);
                        break;
                    }
            }
        }
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectFunc) {
        this._baseIpc.on("connect", (conn: any) => {
            this._busConn = conn;
            connectCallback("connect", this._busConn);
        });
        this._baseIpc.connect(this._busPath);
    }

    close() {
        this._busConn.end();
    }

    send(topic: string, data: Object | string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, topic, data, this._peerName, this._busConn);
    }

    request(topic: string, data: Object | string, requestCallback: IpcBusInterfaces.IpcBusRequestFunc, timeoutDelay: number) {
        if (timeoutDelay === undefined) {
            timeoutDelay = 2000; // 2s by default
        }

        // Prepare reply's handler
        const localRequestCallback: IpcBusInterfaces.IpcBusRequestFunc = (replyTopic: string, content: Object | string, peerName: string) => {
            console.log("Peer #" + peerName + " replied to request on " + replyTopic + ": " + content);
            requestCallback(topic, content, peerName);
        };

        // Set reply's topic 
        const replyTopic = IpcBusUtils.GenerateReplyTopic();
        this.subscribe(replyTopic, localRequestCallback);

        // Execute request
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, topic, data, replyTopic, this._peerName, this._busConn);

        // Clean-up
        setTimeout(() => {
           this.unsubscribe(replyTopic, localRequestCallback);
        }, timeoutDelay);
    }

    queryBrokerState(topic: string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, this._peerName, this._busConn);
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusListenFunc) {
        EventEmitter.prototype.addListener.call(this, topic, listenCallback);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusListenFunc) {
        EventEmitter.prototype.removeListener.call(this, topic, listenCallback);
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }
}

