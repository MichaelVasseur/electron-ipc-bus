/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>

import {EventEmitter} from 'events';
import {Ipc as BaseIpc} from 'easy-ipc';
import {IpcBusClient} from "./IpcBusInterfaces";
import * as IpcBusUtils from './IpcBusUtils';

// Implementation for Node process
export class IpcBusNodeClient extends EventEmitter implements IpcBusClient {
    protected _busPath : string;
    protected _baseIpc : BaseIpc;
    protected _peerName : string;
    protected _busConn : any;

    constructor(busPath? : string) {
        super();
        if (busPath == null) {
            this._busPath = IpcBusUtils.GetCmdLineArgValue('bus-path');
        }
        else{
            this._busPath = busPath;
        }
        this._peerName = "Node_" + process.pid;

        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', (data : any, conn : any) => this.onData(data, conn));
    }

    onData(data : any, conn : any) : void {
        if (BaseIpc.Cmd.isCmd(data) == true) {
            switch (data.name) {
                case IpcBusUtils.IPC_BUS_EVENT_TOPICMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgPeerName = data.args[2]
                        console.log("[IPCBus:Client] Emit message received on topic '" + msgTopic + "' from peer #" + msgPeerName)
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgPeerName)
                        break
                    }

                case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgReplyTopic = data.args[2]
                        const msgPeerName = data.args[3]
                        console.log("[IPCBus:Client] Emit request received on topic '" + msgTopic + "' from peer #" + msgPeerName)
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgReplyTopic, msgPeerName)
                        break
                    }
            }
        }
    }

    // Set API
    connect(callback : Function) {
        let self = this; // closure
        this._baseIpc.on('connect', function (conn : any) {
            self._busConn = conn
            callback('connect', self._busConn);
        })
        this._baseIpc.connect(this._busPath);
    }

    close() {
        this._busConn.end();
    }

    send(topic : string, data : Object | string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDTOPICMESSAGE, topic, data, this._peerName, this._busConn);
    }

    request(topic : string, data : Object | string, replyCallback : Function, timeoutDelay : number) {
        if (timeoutDelay === undefined) {
            timeoutDelay = 2000; // 2s by default
        }

        // Prepare reply's handler
        const replyHandler = function (replyTopic : string, content : Object | string, peerName : string) {

            console.log('Peer #' + peerName + ' replied to request on ' + replyTopic + ' : ' + content);
            this.unsubscribe(replyTopic, replyHandler);
            replyCallback(topic, content, peerName);
        }

        // Set reply's topic 
        const replyTopic = IpcBusUtils.GenerateReplyTopic();
        this.subscribe(replyTopic, replyHandler);
        // Execute request
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SENDREQUESTMESSAGE, topic, data, replyTopic, this._peerName, this._busConn);
    }

    queryBrokerState(topic : string) {
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_QUERYSTATE, topic, this._peerName, this._busConn);
    }

    subscribe(topic : string, handler : Function) {
        EventEmitter.prototype.addListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }

    unsubscribe(topic : string, handler : Function) {
        EventEmitter.prototype.removeListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }
}

