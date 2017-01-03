/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import * as BaseIpc from "easy-ipc";
import * as IpcBusInterfaces from "./IpcBusInterfaces";
import * as IpcBusUtils from "./IpcBusUtils";

/** @internal */
export class IpcBusBrokerClient implements IpcBusInterfaces.IpcBusBroker {
    private _baseIpc: BaseIpc;
    private _ipcServer: any = null;
    private _busPath: string = null;
    private _subscriptions: IpcBusUtils.TopicConnectionMap;

    constructor(busPath?: string) {
        if (busPath == null) {
            this._busPath = IpcBusUtils.GetCmdLineArgValue("bus-path");
        }
        else {
            this._busPath = busPath;
        }
        this._baseIpc = new BaseIpc();
        this._subscriptions = new IpcBusUtils.TopicConnectionMap();
        this._baseIpc.on("connection", (conn: any, server: any) => this._onConnection(conn, server));
        this._baseIpc.on("close", (err: any, conn: any, server: any) => this._onClose(err, conn, server));
        this._baseIpc.on("data", (data: any, conn: any, server: any) => this._onData(data, conn, server));
    }

    // Set API
    start() {
        this._baseIpc.once("listening", (server: any) => {
            this._ipcServer = server;
            console.log("[IPCBus:Broker] Listening for incoming connections on '" + this._busPath + "' ...");
        });
        this._baseIpc.listen(this._busPath);
    }

    stop() {
        if (this._ipcServer != null) {
            this._ipcServer.close();
            this._ipcServer = null;
        }
    }

    private _onConnection(conn: any, server: any): void {
        console.log("[IPCBus:Broker] Incoming connection !");
        conn.on("error", (err: string) => {
            console.log("[IPCBus:Broker] Error on connection: " + err);
        });
    }

    private _onClose(err: any, conn: any, server: any): void {
        this._subscriptions.releaseConnection(conn);
        console.log("[IPCBus:Broker] Connection closed !");
    }

    private _onData(data: any, conn: any, server: any): void {
        if (BaseIpc.Cmd.isCmd(data)) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " subscribed to topic '" + msgTopic + "'");

                        this._subscriptions.addRef(msgTopic, conn, msgPeerName);
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] Peer #" + msgPeerName + " unsubscribed from topic '" + msgTopic + "'");

                        this._subscriptions.release(msgTopic, conn, msgPeerName);
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' from peer #" + msgPeerName);

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames: Map<string, number>, conn: any, topic: string) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, topic, msgContent, msgPeerName, conn);
                        });
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgContent = data.args[1] as string;
                        const msgPeerName = data.args[2] as string;
                        const msgReplyTopic = data.args[3] as string;
                        console.log("[IPCBus:Broker] Received request on topic '" + msgTopic + "' (reply = '" + msgReplyTopic + "') from peer #" + msgPeerName);

                        this._subscriptions.forEachTopic(msgTopic, function (peerNames: Map<string, number>, conn: any, topic: string) {
                            // Request data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE, topic, msgContent, msgPeerName, msgReplyTopic, conn);
                        });
                        break;
                    }
                case IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0] as string;
                        const msgPeerName = data.args[1] as string;
                        console.log("[IPCBus:Broker] QueryState message reply on topic: " + msgTopic + " from peer #" + msgPeerName);

                        let queryStateResult: any = [];
                        this._subscriptions.forEachConnection(function (peerNames: Map<string, number>, conn: any, topic: string) {
                            peerNames.forEach(function (count: number, peerName: string) {
                                queryStateResult.push({ topic: topic, peerName: peerName, count: count });
                            });
                        });
                        this._subscriptions.forEachTopic(msgTopic, function (peerNames: Map<string, number>, conn: any, topic: string) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE, topic, queryStateResult, msgPeerName, conn);
                        });
                        break;
                    }
            }
        }
    }
}
