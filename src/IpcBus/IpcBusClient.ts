/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// This class implements the transaction between an EventEmitter and an ipc client : BrokerServer (easy-ipc) or Electron (ipcRenderer/ipcMain)
/** @internal */

export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
}

export abstract class IpcBusTransport {
    // A bit ugly but efficient ;-)
    public onEventHandler: Function;

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        this.onEventHandler(name, ipcBusData, ipcBusEvent, args);
    }

    abstract ipcConnect(timeoutDelay?: number): Promise<string>;
    abstract ipcClose(): void;

    abstract ipcSubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
    abstract ipcUnsubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
    abstract ipcUnsubscribeAll(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;

    abstract ipcSend(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void;

    abstract ipcRequest(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void;
    abstract ipcRequestResponse(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void;
    abstract ipcRequestCancel(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;

    abstract ipcQueryBrokerState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient extends EventEmitter
                                implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusTransport: IpcBusTransport;
    protected _peerName: string;

    constructor(peerName: string, ipcBusEventEmitter: IpcBusTransport) {
        super();
        this._peerName = peerName;
        this._ipcBusTransport = ipcBusEventEmitter;
        this._ipcBusTransport.onEventHandler = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
    }

    get peerName(): string {
        return this._peerName;
    }

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                this._onSendEventReceived(ipcBusData, ipcBusEvent, args);
                break;
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                this._onRequestEventReceived(ipcBusData, ipcBusEvent, args);
                break;
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE:
                this._onRequestResponseEventReceived(ipcBusData, ipcBusEvent, args);
                break;
        }
    }

    private _onRequestEventReceived(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        IpcBusUtils.Logger.info(`[IpcBusTransport] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
        let localIpcBusEvent: IpcBusInterfaces.IpcBusEvent = JSON.parse(JSON.stringify(ipcBusEvent));
        localIpcBusEvent.requestResolve = (payload: Object | string) => {
            ipcBusData.resolve = true;
            this._ipcBusTransport.ipcRequestResponse(ipcBusData, {channel: ipcBusData.replyChannel, sender: {peerName: this._peerName}}, [payload]);
        };
        localIpcBusEvent.requestReject =  (err: string) => {
            ipcBusData.reject = true;
            this._ipcBusTransport.ipcRequestResponse(ipcBusData, {channel: ipcBusData.replyChannel, sender: {peerName: this._peerName}}, [err]);
        };
        let argsEmit: any[] = [localIpcBusEvent.channel, localIpcBusEvent].concat(args);
        super.emit.apply(this, argsEmit);
    }

    private _onRequestResponseEventReceived(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        IpcBusUtils.Logger.info(`[IpcBusTransport] Emit request response received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
        super.emit(ipcBusEvent.channel, ipcBusData, ipcBusEvent, args);
    }

    private _onSendEventReceived(ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]): void {
        IpcBusUtils.Logger.info(`[IpcBusTransport] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        let argsEmit: any[] = [ipcBusEvent.channel, ipcBusEvent].concat(args);
        super.emit.apply(this, argsEmit);
    }

    _request(channel: string, timeoutDelay: number, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const generatedChannel = IpcBusUtils.GenerateReplyChannel();
            const ipcBusData: IpcBusData = {replyChannel: generatedChannel};
            const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: {peerName: this._peerName}};

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (localIpcBusData: IpcBusData, localIpcBusEvent: IpcBusInterfaces.IpcBusEvent, responsePromise: any[]) => {
                IpcBusUtils.Logger.info(`[IpcBusTransport] Peer #${localIpcBusEvent.sender.peerName} replied to request on ${generatedChannel}`);
                // Unregister locally
                super.removeListener(generatedChannel, localRequestCallback);
                // Unrgister remotely
                this._ipcBusTransport.ipcRequestCancel(ipcBusData, ipcBusEvent);
                // The channel is not generated one
                localIpcBusEvent.channel = channel;
                if (localIpcBusData.resolve) {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, payload: responsePromise[0]};
                    resolve(response);
                }
                else if (localIpcBusData.reject) {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: responsePromise[0]};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: 'unknown format'};
                    reject(response);
                }
            };

            // Register locally
            super.addListener(generatedChannel, localRequestCallback);
            // Execute request
            this._ipcBusTransport.ipcRequest(ipcBusData, ipcBusEvent, args);

            // Clean-up
            setTimeout(() => {
                if (super.listenerCount(generatedChannel) > 0) {
                    // Unregister locally
                    super.removeListener(generatedChannel, localRequestCallback);
                    // Unrgister remotely
                    this._ipcBusTransport.ipcRequestCancel(ipcBusData, ipcBusEvent);
                    IpcBusUtils.Logger.info(`[IpcBusTransport] reject: timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: {channel: channel, sender: {peerName: ''}}, err: 'timeout'};
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    // Set API
    connect(timeoutDelay?: number): Promise<string> {
        return this._ipcBusTransport.ipcConnect(timeoutDelay);
    }

    close() {
        this._ipcBusTransport.ipcClose();
    }

    subscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.addListener(channel, listenCallback);
    }

    unsubscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.removeListener(channel, listenCallback);
    }

    send(channel: string, data: Object | string) {
        this._ipcBusTransport.ipcSend(new IpcBusData(), {channel: channel, sender: {peerName: this._peerName}}, [data]);
    }

    request(channel: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._request(channel, timeoutDelay, [data]);
    }

    queryBrokerState(channel: string) {
        this._ipcBusTransport.ipcQueryBrokerState({channel: channel, sender: {peerName: this._peerName}});
    }

    addListener(channel: string, listener: Function): this {
        super.addListener(channel, listener);
        this._ipcBusTransport.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    removeListener(channel: string, listener: Function): this {
        super.removeListener(channel, listener);
        this._ipcBusTransport.ipcUnsubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    on(channel: string, listener: Function): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Function): this {
        super.once(channel, listener);
        this._ipcBusTransport.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    off(channel: string, listener: Function): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusTransport.ipcUnsubscribeAll({channel: channel, sender: {peerName: this._peerName}});
            super.removeAllListeners(channel);
        }
        return this;
    }

    emit(channel: string, ...args: any[]): boolean {
        this._ipcBusTransport.ipcSend(new IpcBusData(), {channel: channel, sender: {peerName: this._peerName}}, args);
        return true;
    }

    emitRequest(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._request(channel, timeoutDelay, args);
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Function): this {
        super.prependListener(channel, listener);
        this._ipcBusTransport.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    prependOnceListener(channel: string, listener: Function): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusTransport.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }
}
