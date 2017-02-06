/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import {EventEmitter} from 'events';
import {IpcBusTransport} from './IpcBusTransport';
import {IpcBusData} from './IpcBusTransport';


// Implementation for a common IpcBusClient
/** @internal */
export class IpcBusCommonClient extends EventEmitter
                                implements IpcBusInterfaces.IpcBusClient {
    protected _ipcBusTransport: IpcBusTransport;
    protected _ipcBusSender: IpcBusInterfaces.IpcBusSender;
    protected _requestFunctions: Map<string, Function>;

    constructor(ipcBusTransport: IpcBusTransport) {
        super();
        this._ipcBusTransport = ipcBusTransport;
        this._ipcBusTransport._onEventReceived = (name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onEventReceived(name, ipcBusData, ipcBusEvent, args);
        this._requestFunctions = new Map<string, Function>();
    }

    private _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
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
                        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, {channel: ipcBusData.replyChannel, sender: this._ipcBusSender}, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusData.reject = true;
                        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, {channel: ipcBusData.replyChannel, sender: this._ipcBusSender}, [err]);
                    }
                };
                this.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
                let localRequestCallback = this._requestFunctions.get(ipcBusData.replyChannel);
                if (localRequestCallback) {
                    localRequestCallback(ipcBusData, ipcBusEvent, ...args);
                }
                break;
            }
        }
    }

    private _request(timeoutDelay: number, channel: string, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if ((timeoutDelay == null) || (timeoutDelay <= 0)) {
            timeoutDelay = 2000;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const ipcBusData: IpcBusData = {replyChannel: IpcBusUtils.GenerateReplyChannel()};
            const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = {channel: channel, sender: this._ipcBusSender};

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (localIpcBusData: IpcBusData, localIpcBusEvent: IpcBusInterfaces.IpcBusEvent, responsePromise: any) => {
                IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${localIpcBusEvent.sender.peerName} replied to request on ${ipcBusData.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusData.replyChannel);
                // Unregister remotely
                // this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, IpcBusData, ipcBusEvent);
                // The channel is not generated one
                localIpcBusEvent.channel = channel;
                if (localIpcBusData.resolve) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, payload: responsePromise};
                    resolve(response);
                }
                else if (localIpcBusData.reject) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: responsePromise};
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: localIpcBusEvent, err: 'unknown format'};
                    reject(response);
                }
            };

            // Register locally
            this._requestFunctions.set(ipcBusData.replyChannel, localRequestCallback);
            // Execute request
            this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, ipcBusEvent, args);

            // Clean-up
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusData.replyChannel)) {
                    // Unregister remotely
                    this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, ipcBusData, ipcBusEvent);
                    IpcBusUtils.Logger.error(`[IpcBusClient] Request on '${channel}' failed: Timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = {event: {channel: channel, sender: this._ipcBusSender}, err: 'timeout'};
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    // IpcBusClient API
    get peerName(): string {
        return this._ipcBusSender.peerName;
    }

    connect(timeoutDelayOrPeerName?: number | string, peerName?: string): Promise<string> {
        let timeoutDelay: number = 2000;
        if ((typeof timeoutDelayOrPeerName === 'number') && (timeoutDelayOrPeerName > 0)) {
            timeoutDelay = timeoutDelayOrPeerName;
        }
        else if (typeof timeoutDelayOrPeerName === 'string') {
            peerName = timeoutDelayOrPeerName;
        }
        let p = new Promise<string>((resolve, reject) => {
            this._ipcBusTransport.ipcConnect(timeoutDelay)
                .then((msg) => {
                    if (peerName) {
                        this._ipcBusSender = {
                            peerName: peerName,
                            peerProcess: this._ipcBusTransport.ipcBusProcess
                        };
                    }
                    else {
                        this._ipcBusSender = {
                            peerName: `${this._ipcBusTransport.ipcBusProcess.type}_${this._ipcBusTransport.ipcBusProcess.pid}`,
                            peerProcess: this._ipcBusTransport.ipcBusProcess
                        };
                    }
                    resolve(msg);
                })
                .catch((err) => {
                    reject(err);
                });
        });
        return p;
    }

    close() {
        this._ipcBusTransport.ipcClose();
    }

    send(channel: string, ...args: any[]) {
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE, {}, {channel: channel, sender: this._ipcBusSender}, args);
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
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: this._ipcBusSender});
        return this;
    }

    removeListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.removeListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {}, {channel: channel, sender: this._ipcBusSender});
        return this;
    }

    on(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.addListener(channel, listener);
    }

    once(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.once(channel, listener);
        // removeListener will be automatically called by NodeJS when callback has been triggered
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: this._ipcBusSender});
        return this;
    }

    off(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        return this.removeListener(channel, listener);
    }

    removeAllListeners(channel?: string): this {
        if (channel) {
            this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_UNSUBSCRIBE_CHANNEL, {unsubscribeAll: true}, {channel: channel, sender: this._ipcBusSender});
            super.removeAllListeners(channel);
        }
        return this;
    }

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: this._ipcBusSender});
        return this;
    }

    prependOnceListener(channel: string, listener: IpcBusInterfaces.IpcBusListener): this {
        super.prependOnceListener(channel, listener);
        this._ipcBusTransport.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_SUBSCRIBE_CHANNEL, {}, {channel: channel, sender: this._ipcBusSender});
        return this;
    }
}
