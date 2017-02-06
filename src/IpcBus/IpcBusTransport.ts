/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { EventEmitter } from 'events';

/** @internal */
export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
}

/** @internal */
export abstract class IpcBusTransport {
    protected _ipcBusSender: IpcBusInterfaces.IpcBusSender;
    readonly ipcOptions: IpcBusUtils.IpcOptions;
    protected _requestFunctions: Map<string, Function>;

    public eventEmitter: EventEmitter;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcBusSender = { peerName: '', peerProcess: ipcBusProcess };
        this.ipcOptions = ipcOptions;
        this._requestFunctions = new Map<string, Function>();
    }

    get ipcBusSender(): IpcBusInterfaces.IpcBusSender {
        return this._ipcBusSender;
    }

    protected _onEventReceived(name: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args: any[]) {
        switch (name) {
            case IpcBusUtils.IPC_BUS_EVENT_SENDMESSAGE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName}`);
                this.eventEmitter.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
                break;
            }
            case IpcBusUtils.IPC_BUS_EVENT_REQUESTMESSAGE: {
                IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusEvent.channel}' from peer #${ipcBusEvent.sender.peerName} (replyChannel '${ipcBusData.replyChannel}')`);
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusData.resolve = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, { channel: ipcBusData.replyChannel, sender: this._ipcBusSender }, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusData.reject = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusData, { channel: ipcBusData.replyChannel, sender: this._ipcBusSender }, [err]);
                    }
                };
                this.eventEmitter.emit(ipcBusEvent.channel, ipcBusEvent, ...args);
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

    request(timeoutDelay: number, channel: string, args: any[]): Promise<IpcBusInterfaces.IpcBusRequestResponse> {
        if ((timeoutDelay == null) || (timeoutDelay <= 0)) {
            timeoutDelay = IpcBusUtils.IPC_BUS_TIMEOUT;
        }

        let p = new Promise<IpcBusInterfaces.IpcBusRequestResponse>((resolve, reject) => {
            const ipcBusData: IpcBusData = { replyChannel: IpcBusUtils.GenerateReplyChannel() };
            const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: channel, sender: this._ipcBusSender };

            // Prepare reply's handler, we have to change the replyChannel to channel
            const localRequestCallback = (localIpcBusData: IpcBusData, localIpcBusEvent: IpcBusInterfaces.IpcBusEvent, responsePromise: any) => {
                IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${localIpcBusEvent.sender.peerName} replied to request on ${ipcBusData.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusData.replyChannel);
                // Unregister remotely
                // this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, IpcBusData, ipcBusEvent);
                // The channel is not generated one
                localIpcBusEvent.channel = channel;
                if (localIpcBusData.resolve) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, payload: responsePromise };
                    resolve(response);
                }
                else if (localIpcBusData.reject) {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, err: responsePromise };
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: localIpcBusEvent, err: 'unknown format' };
                    reject(response);
                }
            };

            // Register locally
            this._requestFunctions.set(ipcBusData.replyChannel, localRequestCallback);
            // Execute request
            this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, ipcBusData, ipcBusEvent, args);

            // Clean-up
            setTimeout(() => {
                if (this._requestFunctions.delete(ipcBusData.replyChannel)) {
                    // Unregister remotely
                    this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, ipcBusData, ipcBusEvent);
                    IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusSender }, err: 'timeout' };
                    reject(response);
                }
            }, timeoutDelay);
        });
        return p;
    }

    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        let p = new Promise<string>((resolve, reject) => {
            if (peerName == null) {
                peerName = `${this._ipcBusSender.peerProcess.type}_${this._ipcBusSender.peerProcess.pid}`;
            }
            this._ipcBusSender.peerName = peerName;
            resolve('connected');
        });
        return p;
    }

    abstract ipcClose(): void;
    abstract ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void;
}

import { IpcBusTransportNode } from './IpcBusTransportNode';
import { IpcBusTransportRenderer } from './IpcBusTransportRenderer';
import * as ElectronUtils from './ElectronUtils';

/** @internal */
export function CreateIpcBusTransport(ipcOptions: IpcBusUtils.IpcOptions): IpcBusTransport {
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType}, ipc options = ${ipcOptions}`);

    let ipcBusTransport: IpcBusTransport = null;
    switch (processType) {
        case 'renderer':
            ipcBusTransport = new IpcBusTransportRenderer({ type: processType, pid: -1 }, ipcOptions);
            break;
        case 'browser':
        case 'node':
            if (ipcOptions.isValid()) {
                ipcBusTransport = new IpcBusTransportNode({ type: processType, pid: process.pid }, ipcOptions);
            }
            break;
    }
    return ipcBusTransport;
}
