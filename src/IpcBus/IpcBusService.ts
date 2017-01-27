/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

/** @internal */
class IpcBusServiceCallMsg {

    constructor(public callHandlerName: string, public callArgs: any[]) {
    }
}

// Implementation of IPC service
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _ipcBusClient: IpcBusInterfaces.IpcBusClient;
    private _serviceName: string;
    private _callHandlers: Map<string, Function>;

    static getServiceChannel(serviceName: string): string {

        return `/electron-ipc-bus/ipc-service/${serviceName}`;
    }

    constructor(ipcBusClient: IpcBusInterfaces.IpcBusClient, serviceName: string) {

        this._ipcBusClient = ipcBusClient;
        this._serviceName = serviceName;
        this._callHandlers = new Map<string, Function>();
    }

    start(): void {
        this._ipcBusClient.addListener(IpcBusServiceImpl.getServiceChannel(this._serviceName), (event: IpcBusInterfaces.IpcBusEvent, args: any[]) => {

            this._onMessageReceived(event, args[0]);
        });
    }

    stop(): void {
        this._ipcBusClient.removeListener(IpcBusServiceImpl.getServiceChannel(this._serviceName), (event: IpcBusInterfaces.IpcBusEvent, args: any[]) => {

            this._onMessageReceived(event, args[0]);
        });
    }

    registerCallHandler(name: string, handler: Function): void {

        this._callHandlers.set(name, handler);
    }

    private _onMessageReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusServiceCallMsg) {

        if (!this._callHandlers.has(msg.callHandlerName)) {
            event.request.reject(`Service '${this._serviceName}' does handle calls to '${msg.callHandlerName}' !`);
            IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does handle calls to '${msg.callHandlerName}' !`);
        } else {

            try {

                event.request.resolve(this._callHandlers.get(msg.callHandlerName)(...msg.callArgs));

            } catch (e) {

                event.request.reject(e);
                IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${msg.callHandlerName}' : ${e}`);
            }
        }
    }
}