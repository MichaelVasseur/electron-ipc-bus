/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// This class implements the transaction between an EventEmitter and an ipc client : BrokerServer (easy-ipc) or Electron (ipcRenderer/ipcMain)
/** @internal */
export abstract class IpcBusCommonEventEmitter extends EventEmitter {
    protected _peerName: string;

    constructor(peerName: string) {
        super();
        this._peerName = peerName;
    }

   PeerName(): string {
        return this._peerName;
    }

    protected _onRequestDataReceived(...args: any[]) {
        const replyChannel = args[0];
        const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = args[1];
        IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${replyChannel}')`);
        ipcBusEvent.requestResolve =  (payload: Object | string) => {
            this.ipcSend({channel: replyChannel, sender: {peerName: this._peerName}}, { resolve : payload });
        };
        ipcBusEvent.requestResolve =  (err: string) => {
            this.ipcSend({channel: replyChannel, sender: {peerName: this._peerName}}, { reject : err });
        };
        this.emit(ipcBusEvent.channel, args.slice(1));
    }

    protected _onSendDataReceived(...args: any[]) {
        const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = args[0];
        IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        this.emit(ipcBusEvent.channel, args);
    }

    // Set API
    connect(timeoutDelay?: number): Promise<string> {
        return this.ipcConnect(timeoutDelay);
    }

    abstract ipcConnect(timeoutDelay?: number): Promise<string>;

    close() {
        this.ipcClose();
    }

    abstract ipcClose(): void;

    subscribe(channel: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.addListener(channel, listenCallback);
        this.ipcSubscribe({channel: channel, sender: {peerName: peerName || this._peerName}});
    }

    abstract ipcSubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;

    unsubscribe(channel: string, peerName: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.removeListener(channel, listenCallback);
        this.ipcUnsubscribe({channel: channel, sender: {peerName: peerName || this._peerName}});
    }

    abstract ipcUnsubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;

    // for performance purpose we do not call sendFromPeer but ipcSend directly
    send(channel: string, data: Object | string, peerName: string) {
        this.ipcSend({channel: channel, sender: {peerName: peerName || this._peerName}}, data);
    }

    abstract ipcSend(ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: Object | string): void;

    request(channel: string, data: Object | string, peerName: string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        peerName = peerName || this._peerName;

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const generatedChannel = IpcBusUtils.GenerateReplyChannel();

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback: IpcBusInterfaces.IpcBusChannelHandler = (localEvent, payload) => {
                IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] Peer #${peerName} replied to request on ${generatedChannel}`);
                this.unsubscribe(generatedChannel, peerName, localRequestCallback);
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: {peerName: peerName}};
                let content = payload as any;
                if (content.hasOwnProperty('resolve')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: ipcBusEvent, payload: content.resolve};
                    resolve(response);
                }
                else if (content.hasOwnProperty('reject')) {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: ipcBusEvent, payload: content.reject};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: ipcBusEvent, payload: 'unknown format'};
                    reject(response);
                }
            };

            this.subscribe(generatedChannel, peerName, localRequestCallback);

            // Execute request
            this.ipcRequest(generatedChannel, {channel: channel, sender: {peerName: peerName}}, data);

            // Clean-up
            setTimeout(() => {
                if (this.listenerCount(generatedChannel) > 0) {
                    this.unsubscribe(generatedChannel, peerName, localRequestCallback);
                    IpcBusUtils.Logger.info(`[IpcBusCommonEventEmitter] reject: timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: {channel: channel, sender: {peerName: ''}}, payload: 'timeout'};
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    abstract ipcRequest(replyChannel: string, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, data: Object | string): void;

    queryBrokerState(channel: string, peerName: string) {
        this.ipcQueryBrokerState({channel: channel, sender: {peerName: peerName || this._peerName}});
    }

    abstract ipcQueryBrokerState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusEventEmitter: IpcBusCommonEventEmitter;

    constructor(ipcBusEventEmitter: IpcBusCommonEventEmitter) {
        this._ipcBusEventEmitter = ipcBusEventEmitter;
    }

    get peerName(): string {
        return this._ipcBusEventEmitter.PeerName();
    }

    // Set API
    connect(timeoutDelay?: number): Promise<string> {
        return this._ipcBusEventEmitter.connect(timeoutDelay);
    }

    close() {
        this._ipcBusEventEmitter.close();
    }

    subscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this._ipcBusEventEmitter.subscribe(channel, null, listenCallback);
    }

    unsubscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this._ipcBusEventEmitter.unsubscribe(channel, null, listenCallback);
    }

    send(channel: string, data: Object | string) {
        this._ipcBusEventEmitter.send(channel, data, null);
    }

    request(channel: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._ipcBusEventEmitter.request(channel, data, null, timeoutDelay);
    }

    queryBrokerState(channel: string) {
        this._ipcBusEventEmitter.queryBrokerState(channel, null);
    }

    // addListener(event: string | symbol, listener: Function): this;
    // on(event: string | symbol, listener: Function): this;
    // once(event: string | symbol, listener: Function): this;
    // prependListener(event: string | symbol, listener: Function): this;
    // prependOnceListener(event: string | symbol, listener: Function): this;
    // removeListener(event: string | symbol, listener: Function): this;
    // removeAllListeners(event?: string | symbol): this;

}
