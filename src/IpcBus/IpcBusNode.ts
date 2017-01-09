/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';
import {IpcBusBrokerClient} from './IpcBusBrokerClient';

// Implementation for Node process
/** @internal */
export class IpcBusNodeClient implements IpcBusInterfaces.IpcBusClient {
    protected _peerName: string;
    protected _ipcBusBrokerClient: IpcBusBrokerClient;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcBusBrokerClient = new IpcBusBrokerClient(ipcOptions);
        this._peerName = 'Node_' + process.pid;
    }

    // Set API
    connect(connectCallback: IpcBusInterfaces.IpcBusConnectHandler) {
        this._ipcBusBrokerClient.connect(connectCallback);
    }

    close() {
        this._ipcBusBrokerClient.close();
    }

    subscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusBrokerClient.subscribe(topic, this._peerName, listenCallback);
    }

    unsubscribe(topic: string, listenCallback: IpcBusInterfaces.IpcBusTopicHandler) {
        this._ipcBusBrokerClient.unsubscribe(topic, this._peerName, listenCallback);
    }

    send(topic: string, data: Object | string) {
        this._ipcBusBrokerClient.send(topic, data, this._peerName);
    }

    request(topic: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusBrokerClient.request(topic, data, this._peerName, timeoutDelay);
    }

    queryBrokerState(topic: string) {
        this._ipcBusBrokerClient.queryBrokerState(topic, this._peerName);
    }
}

