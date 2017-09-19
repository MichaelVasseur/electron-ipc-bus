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
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
}

/** @internal */
export class IpcBusCommand {
//    readonly type = 'IpcBusCommand';
    name: string;
    channel: string;
    peer: IpcBusInterfaces.IpcBusPeer;
    data?: IpcBusData;
    args?: any[];
}

/** @internal */
export abstract class IpcBusTransport {
    protected _ipcBusPeer: IpcBusInterfaces.IpcBusPeer;
    protected _requestFunctions: Map<string, Function>;

    readonly ipcOptions: IpcBusUtils.IpcOptions;
    public eventEmitter: EventEmitter;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this._ipcBusPeer = { id: uuid.v1(), name: '', process: ipcBusProcess };
        this.ipcOptions = ipcOptions;
        this._requestFunctions = new Map<string, Function>();
    }

    get peer(): IpcBusInterfaces.IpcBusPeer {
        return this._ipcBusPeer;
    }

    protected _onEventReceived(ipcBusCommand: IpcBusCommand) {
        switch (ipcBusCommand.name) {
            case IpcBusUtils.IPC_BUS_COMMAND_SENDMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit message received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name}`);
                const ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                this.eventEmitter.emit(ipcBusCommand.channel, ipcBusEvent, ...ipcBusCommand.args);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.data.replyChannel}')`);
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                ipcBusEvent.request = {
                    resolve: (payload: Object | string) => {
                        ipcBusCommand.data.resolve = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusCommand.data.replyChannel, ipcBusCommand.data, [payload]);
                    },
                    reject: (err: string) => {
                        ipcBusCommand.data.reject = true;
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE, ipcBusCommand.data.replyChannel, ipcBusCommand.data, [err]);
                    }
                };
                this.eventEmitter.emit(ipcBusCommand.channel, ipcBusEvent, ...ipcBusCommand.args);
                break;
            }
            case IpcBusUtils.IPC_BUS_COMMAND_REQUESTRESPONSE: {
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Emit request response received on channel '${ipcBusCommand.channel}' from peer #${ipcBusCommand.peer.name} (replyChannel '${ipcBusCommand.data.replyChannel}')`);
                const localRequestCallback = this._requestFunctions.get(ipcBusCommand.data.replyChannel);
                if (localRequestCallback) {
                    localRequestCallback(ipcBusCommand);
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
            const localRequestCallback = (ipcBusCommand: IpcBusCommand) => {
                ipcBusCommand.channel = channel;
                let ipcBusEvent: IpcBusInterfaces.IpcBusEvent = { channel: ipcBusCommand.channel, sender: ipcBusCommand.peer };
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] Peer #${ipcBusEvent.sender.name} replied to request on ${ipcBusCommand.data.replyChannel}`);
                // Unregister locally
                this._requestFunctions.delete(ipcBusCommand.data.replyChannel);
                // Unregister remotely
                // this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, IpcBusData, ipcBusEvent);
                // The channel is not generated one
                if (ipcBusCommand.data.resolve) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] resolve`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, payload: ipcBusCommand.args };
                    resolve(response);
                }
                else if (ipcBusCommand.data.reject) {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, err: ipcBusCommand.args[0] };
                    reject(response);
                }
                else {
                    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: unknown format`);
                    let response: IpcBusInterfaces.IpcBusRequestResponse = { event: ipcBusEvent, err: 'unknown format' };
                    reject(response);
                }
            };

            // Register locally
            this._requestFunctions.set(ipcBusData.replyChannel, localRequestCallback);
            // Execute request
            this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTMESSAGE, channel, ipcBusData, args);

            // Clean-up
            // Below zero = infinite
            if (timeoutDelay >= 0) {
                setTimeout(() => {
                    if (this._requestFunctions.delete(ipcBusData.replyChannel)) {
                        // Unregister remotely
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_REQUESTCANCEL, channel, ipcBusData);
                        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusClient] reject: timeout`);
                        let response: IpcBusInterfaces.IpcBusRequestResponse = { event: { channel: channel, sender: this._ipcBusPeer }, err: 'timeout' };
                        reject(response);
                    }
                }, timeoutDelay);
            }
        });
        return p;
    }

    protected abstract _onClose(): void;

    abstract ipcConnect(timeoutDelay: number, peerName?: string): Promise<string>;
    abstract ipcClose(): void;
    abstract ipcPushCommand(command: string, channel: string, ipcBusData: IpcBusData, args?: any[]): void;
}
