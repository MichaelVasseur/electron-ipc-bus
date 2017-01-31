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
    unsubscribeAll?: boolean;
}

/** @internal */
export abstract class IpcBusTransport {
    // A bit ugly but efficient ;-)
    public onEventHandler: Function;

    abstract ipcConnect(timeoutDelay?: number): Promise<string>;
    abstract ipcClose(): void;
    abstract ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void;
}

// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient extends EventEmitter
                                implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusTransport: IpcBusTransport;
    protected _peerName: string;

    constructor(peerName: string, ipcBusTransport: IpcBusTransport) {
        super();
        this._peerName = peerName;
        this._ipcBusTransport = ipcBusTransport;
        this._ipcBusTransport.onEventHandler = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
    }

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
                this.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusData.resolve = true;
                        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, {channel: ipcBusData.replyChannel, sender: {peerName: this._peerName}}, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusData.reject = true;
                        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, {channel: ipcBusData.replyChannel, sender: {peerName: this._peerName}}, [err]);
                    }
                };
                this.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
                this.emit(ipcBusEvent.channel, ipcBusData, ipcBusEvent, args);
                break;
            }
        }
    }

    private _request(timeoutDelay: number, channel: string, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if ((timeoutDelay == null) || (timeoutDelay <= 0)) {
            timeoutDelay = 2000;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const generatedChannel = IpcBusUtils.GenerateReplyChannel();
            const ipcBusData: IpcBusData = {replyChannel: generatedChannel};
            const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: {peerName: this._peerName}};

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (localIpcBusData: IpcBusData, localIpcBusEvent: IpcBusInterfaces.IpcBusEvent, responsePromise: any[]) => {
                IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${localIpcBusEvent.sender.peerName} replied to request on ${generatedChannel}`);
                // Unregister locally
                super.removeListener(generatedChannel, localRequestCallback);
                // Unregister remotely
                // this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, IpcBusData, ipcBusEvent);
                // The channel is not generated one
                localIpcBusEvent.channel = channel;
                if (localIpcBusData.resolve) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, payload: responsePromise[0]};
                    resolve(response);
                }
                else if (localIpcBusData.reject) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: responsePromise[0]};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: 'unknown format'};
                    reject(response);
                }
            };

            // Register locally
            super.addListener(generatedChannel, localRequestCallback);
            // Execute request
            this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, ipcBusEvent, args);

            // Clean-up
            setTimeout(() => {
                if (super.listenerCount(generatedChannel) > 0) {
                    // Unregister locally
                    super.removeListener(generatedChannel, localRequestCallback);
                    // Unregister remotely
                    this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, ipcBusData, ipcBusEvent);
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: {channel: channel, sender: {peerName: ''}}, err: 'timeout'};
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    // IpcBusClient API
    get peerName(): string {
        return this._peerName;
    }

    connect(timeoutDelay?: number): Promise<string> {
        return this._ipcBusTransport.ipcConnect(timeoutDelay);
    }

    close() {
        this._ipcBusTransport.ipcClose();
    }

    send(channel: string, ...args: any[]) {
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, {}, {channel: channel, sender: {peerName: this._peerName}}, args);
    }

    request(timeoutDelayOrChannel: number | string, ...args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if (typeof timeoutDelayOrChannel === 'number') {
            // Exception may be raised regarding the args (length must be > 0 and have a string at 1st arg)
            return this._request(timeoutDelayOrChannel, args[0], args.slice(1));
        }
        else {
            return this._request(null, timeoutDelayOrChannel, args);
        }
    }

    // EventEmitter API
    addListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.addListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    removeListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.removeListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    on(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    off(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {unsubscribeAll: true}, {channel: channel, sender: {peerName: this._peerName}});
            super.removeAllListeners(channel);
        }
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: this._peerName}});
        return this;
    }

    prependOnceListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: {peerName: this._peerName}});
        return this;
    }
}
