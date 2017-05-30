/// <reference types='node' />
/// <reference types='uuid' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { EventEmitter } from 'events';
import * as uuid from 'uuid';

/** @internal */
function GenerateReplyChannel(): string {
    return '/electron-ipc-bus/request-reply/' + uuid.v1();
}

/** @internal */
export class IpcBusData {
    peerId?: string;
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
}

/** @internal */
export abstract class IpcBusTransport {
    protected _peerId: string;
    protected _ipcBusPeer: IpcBusInterfaces.IpcBusPeer;
    protected _requestFunctions: Map<string, Function>;

    readonly ipcOptions: IpcBusUtils.IpcOptions;
    public eventEmitter: EventEmitter;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcBusPeer = { name: '', process: ipcBusProcess };
        this.ipcOptions = ipcOptions;
        this._peerId = uuid.v1();
        this._requestFunctions = new Map<string, Function>();
    }

    get peer(): IpcBusInterfaces.IpcBusPeer {
        return this._ipcBusPeer;
    }

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.name}`);
                this.eventEmitter.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.name} (replyChannel '${ipcBusData.replyChannel}')`);
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusData.resolve = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, ipcBusData.replyChannel, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusData.reject = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, ipcBusData.replyChannel, [err]);
                    }
                };
                this.eventEmitter.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTRESPONSE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.name} (replyChannel '${ipcBusData.replyChannel}')`);
                let localRequestCallback = this._requestFunctions.get(ipcBusData.replyChannel);
                if (localRequestCallback) {
                    localRequestCallback(ipcBusData, ipcBusEvent, ...args);
                }
                break;
            }
        }
    }

    request(timeoutDelay: number, channel: string, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if ((timeoutDelay == null) || (timeoutDelay <= 0)) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const ipcBusData: IpcBusData = { replyChannel: GenerateReplyChannel() };

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (localIpcBusData: IpcBusData, localIpcBusEvent: IpcBusInterfaces.IpcBusEvent, responsePromise: any) => {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${localIpcBusEvent.sender.name} replied to request on ${ipcBusData.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusData.replyChannel);
                // Unregister remotely
                // this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, IpcBusData, ipcBusEvent);
                // The channel is not generated one
                localIpcBusEvent.channel = channel;
                if (localIpcBusData.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, payload: responsePromise };
                    resolve(response);
                }
                else if (localIpcBusData.reject) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, err: responsePromise };
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, err: 'unknown format' };
                    reject(response);
                }
            };

            // Register locally
            this._requestFunctions.set(ipcBusData.replyChannel, localRequestCallback);
            // Execute request
            this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, channel, args);

            // Clean-up
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusData.replyChannel)) {
                    // Unregister remotely
                    this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, ipcBusData, channel);
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            if (peerName == null) {
                peerName = `${this._ipcBusPeer.process.type}_${this._ipcBusPeer.process.pid}`;
            }
            this._ipcBusPeer.name = peerName;
            resolve('connected');
        });
        return p;
    }

    protected abstract _onClose(): void;
    abstract ipcClose(): void;
    abstract ipcPushCommand(command: string, ipcBusData: IpcBusData, channel: string, args?: any[]): void;
}
