/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// This class implements the transaction between an EventEmitter and an ipc client : BrokerServer (easy-ipc) or Electron (ipcRenderer/ipcMain)
/** @internal */

export class IpcBusEventInternal implements IpcBusInterfaces.IpcBusEvent {
    channel: string;
    requestResolve?: IpcBusInterfaces.IpcBusRequestResolve;
    requestReject?: IpcBusInterfaces.IpcBusRequestReject;
    sender: IpcBusInterfaces.IpcBusSender;
    replyChannel?: string;
}

export abstract class IpcBusTransport {
    public onEventHandler: Function;

    protected _onEventReceived(name: string, args: any[]) {
        this.onEventHandler(name, args);
    }

    abstract ipcConnect(timeoutDelay?: number): Promise<string>;
    abstract ipcClose(): void;

    abstract ipcSubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
    abstract ipcUnsubscribe(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
    abstract ipcUnsubscribeAll(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;

    abstract ipcSend(ipcBusEvent: IpcBusEventInternal, args: any[]): void;
    abstract ipcRequest(ipcBusEvent: IpcBusEventInternal, args: any[]): void;

    abstract ipcQueryBrokerState(ipcBusEvent: IpcBusInterfaces.IpcBusEvent): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient extends EventEmitter
                                implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusEventEmitter: IpcBusTransport;
    protected _peerName: string;

    constructor(peerName: string, ipcBusEventEmitter: IpcBusTransport) {
        super();
        this._peerName = peerName;
        this._ipcBusEventEmitter = ipcBusEventEmitter;
        this._ipcBusEventEmitter.onEventHandler = (name: string, args: any[]) => this._onEventReceived(name, args);
    }

    get peerName(): string {
        return this._peerName;
    }

    protected _onEventReceived(name: string, args: any[]) {
        switch(name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE:
                this._onSendEventReceived(args);
                break;
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE:
                this._onRequestEventReceived(args);
                break;
        }
    }

    private _onRequestEventReceived(args: any[]): void {
        const ipcBusEvent: IpcBusEventInternal = args[0];
        IpcBusUtils.Logger.info(`[IpcBusTransport] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusEvent.replyChannel}')`);
        ipcBusEvent.requestResolve = (payload: Object | string) => {
            this._ipcBusEventEmitter.ipcSend({channel: ipcBusEvent.replyChannel, sender: {peerName: this._peerName}}, [{ resolve : payload }]);
        };
        ipcBusEvent.requestReject =  (err: string) => {
            this._ipcBusEventEmitter.ipcSend({channel: ipcBusEvent.replyChannel, sender: {peerName: this._peerName}}, [{ reject : err }]);
        };
        let argsEmit: any[] = [ipcBusEvent.channel].concat(args);
        super.emit.apply(this, argsEmit);
    }

    private _onSendEventReceived(args: any[]): void {
        const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = args[0];
        IpcBusUtils.Logger.info(`[IpcBusTransport] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
        let argsEmit: any[] = [ipcBusEvent.channel].concat(args);
        super.emit.apply(this, argsEmit);
    }

    _request(channel: string, timeoutDelay: number, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (timeoutDelay == null) {
            timeoutDelay = 2000;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const generatedChannel = IpcBusUtils.GenerateReplyChannel();

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback: IpcBusInterfaces.IpcBusChannelHandler = (localIpcBusEvent, payload: any[]) => {
                IpcBusUtils.Logger.info(`[IpcBusTransport] Peer #${localIpcBusEvent.sender.peerName} replied to request on ${generatedChannel}`);
                this.unsubscribe(generatedChannel, localRequestCallback);
                localIpcBusEvent.channel = channel;
                let content = payload as any;
                if (content.hasOwnProperty('resolve')) {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, payload: content.resolve};
                    resolve(response);
                }
                else if (content.hasOwnProperty('reject')) {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: content.reject};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusTransport] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: 'unknown format'};
                    reject(response);
                }
            };

            this.subscribe(generatedChannel, localRequestCallback);

            // Execute request
            this._ipcBusEventEmitter.ipcRequest({channel: channel, replyChannel: generatedChannel, sender: {peerName: this._peerName}}, args);

            // Clean-up
            setTimeout(() => {
                if (this.listenerCount(generatedChannel) > 0) {
                    this.unsubscribe(generatedChannel, localRequestCallback);
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
        return this._ipcBusEventEmitter.ipcConnect(timeoutDelay);
    }

    close() {
        this._ipcBusEventEmitter.ipcClose();
    }

    subscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.addListener(channel, listenCallback);
    }

    unsubscribe(channel: string, listenCallback: IpcBusInterfaces.IpcBusChannelHandler) {
        this.removeListener(channel, listenCallback);
    }

    send(channel: string, data: Object | string) {
        this._ipcBusEventEmitter.ipcSend({channel: channel, sender: {peerName: this._peerName}}, [data]);
    }

    request(channel: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._request(channel, timeoutDelay, [data]);
    }

    queryBrokerState(channel: string) {
        this._ipcBusEventEmitter.ipcQueryBrokerState({channel: channel, sender: {peerName: this._peerName}});
    }

    addListener(channel: string, listener: Function): this {
        super.addListener(channel, listener);
        this._ipcBusEventEmitter.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    removeListener(channel: string, listener: Function): this {
        super.removeListener(channel, listener);
        this._ipcBusEventEmitter.ipcUnsubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    on(channel: string, listener: Function): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: Function): this {
        super.once(channel, listener);
        this._ipcBusEventEmitter.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    off(channel: string, listener: Function): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusEventEmitter.ipcUnsubscribeAll({channel: channel, sender: {peerName: this._peerName}});
            super.removeAllListeners(channel);
        }
        return this;
    }

    emit(channel: string, ...args: any[]): boolean {
        this._ipcBusEventEmitter.ipcSend({channel: channel, sender: {peerName: this._peerName}}, args);
        return true;
    }

    emitRequest(channel: string, timeoutDelay: number, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        return this._request(channel, timeoutDelay, args);
    }

    // Added in Node 6...
    prependListener(channel: string, listener: Function): this {
        super.prependListener(channel, listener);
        this._ipcBusEventEmitter.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    prependOnceListener(channel: string, listener: Function): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusEventEmitter.ipcSubscribe({channel: channel, sender: {peerName: this._peerName}});
        return this;
    }
}
