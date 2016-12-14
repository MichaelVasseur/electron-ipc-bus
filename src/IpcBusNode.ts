/// <reference types="node" />
/// <reference path="typings/easy-ipc.d.ts"/>
/// <reference path="IpcBusConstants.ts" />
/// <reference path="IpcBusInterfaces.ts" />

import {EventEmitter} from 'events';
import {Ipc as BaseIpc, IpcCmd as BaseIpcCmd} from 'easy-ipc';

// Implementation for Node process
export class IpcBusNode extends EventEmitter {
    protected _busPath : string;
    protected _baseIpc : BaseIpc;
    protected _peerName : string;
    protected _busConn : any;

    constructor(busPath? : string) {
        super();
        if (busPath == null) {
            this._busPath = ElectronIpcBus._getCmdLineArgValue('bus-path');
        }
        else{
            this._busPath = busPath;
        }
        this._peerName = "Node_" + process.pid;

        this._baseIpc = new BaseIpc();
        this._baseIpc.on('data', this.onData);
    }

    onData(data : any, conn : any) : void {
        if (BaseIpcCmd.isCmd(data) == true) {
            switch (data.name) {
                case ElectronIpcBus.IPC_BUS_EVENT_TOPICMESSAGE:
                    {
                        const msgTopic = data.args[0]
                        const msgContent = data.args[1]
                        const msgPeerName = data.args[2]
                        console.log("[IPCBus:Client] Emit message received on topic '" + msgTopic + "' from peer #" + msgPeerName)
                        EventEmitter.prototype.emit.call(this, msgTopic, msgTopic, msgContent, msgPeerName)
                        break
                    }

                case ElectronIpcBus.IPC_BUS_EVENT_REQUESTMESSAGE:
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
        this._baseIpc.on('connect', function (conn : any) {
            this._busConn = conn
            callback('connect', this._busConn);
        })
        this._baseIpc.connect(this._busPath);
    }

    close() {
        this._busConn.end();
    }

    send(topic : string, data : any) {
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SENDTOPICMESSAGE, topic, data, this._peerName, this._busConn);
    }

    request(topic : string, data : any, replyCallback : Function, timeoutDelay : number) {
        if (timeoutDelay === undefined) {
            timeoutDelay = 2000; // 2s by default
        }

        // Prepare reply's handler
        const replyHandler = function (replyTopic : string, content : any, peerName : string) {

            console.log('Peer #' + peerName + ' replied to request on ' + replyTopic + ' : ' + content);
            this.unsubscribe(replyTopic, replyHandler);
            replyCallback(topic, content, peerName);
        }

        // Set reply's topic 
        const replyTopic = ElectronIpcBus._generateReplyTopic();
        this.subscribe(replyTopic, replyHandler);
        // Execute request
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SENDREQUESTMESSAGE, topic, data, replyTopic, this._peerName, this._busConn);
    }

    queryBrokerState(topic : string) {
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_QUERYSTATE, topic, this._peerName, this._busConn);
    }

    subscribe(topic : string, handler : Function) {
        EventEmitter.prototype.addListener.call(this, topic, handler)
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }

    unsubscribe(topic : string, handler : Function) {
        EventEmitter.prototype.removeListener.call(this, topic, handler)
        BaseIpcCmd.exec(ElectronIpcBus.IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, this._peerName, this._busConn);
    }
}

