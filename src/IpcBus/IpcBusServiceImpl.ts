/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, args: any[]) => this._onCallReceived(event, <IpcBusInterfaces.IpcBusServiceCall>args[0]);

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient, private _serviceName: string) {

        this._callHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>();
    }

    start(): void {
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);
    }

    stop(): void {
        this._ipcBusClient.removeListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);
    }

    registerCallHandler(name: string, handler: IpcBusInterfaces.IpcBusServiceCallHandler): void {

        this._callHandlers.set(name, handler);
    }

    private _onCallReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceCall) {

        if (!this._callHandlers.has(msg.handlerName)) {
            event.request.reject(`Service '${this._serviceName}' does handle calls to '${msg.handlerName}' !`);
            IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does handle calls to '${msg.handlerName}' !`);
        } else {

            try {

                this._callHandlers.get(msg.handlerName)(msg, event.request);

            } catch (e) {

                event.request.reject(e);
                IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${msg.handlerName}' : ${e}`);
            }
        }
    }
}