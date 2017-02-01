/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onCallReceived(event, <IpcBusInterfaces.IpcBusServiceCall>args[0]);

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient, private _serviceName: string, private _serviceImpl: any = undefined) {

        this._callHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>();

        if (this._serviceImpl) {
            IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' HAS an implementation`);
            // Register handlers for functions of service's Implementation
            for (var memberName in this._serviceImpl) {
                if (typeof this._serviceImpl[memberName] === 'function') {
                    this.registerCallHandler(memberName, (call: IpcBusInterfaces.IpcBusServiceCall, request: IpcBusInterfaces.IpcBusRequest) => {
                        request.resolve(this._serviceImpl[memberName](...call.args));
                    });
                }
            }

            // Setup event emitter hook
        } else {
            IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    start(): void {
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, {});
    }

    stop(): void {
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP, {});
        this._ipcBusClient.removeListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);
    }

    registerCallHandler(name: string, handler: IpcBusInterfaces.IpcBusServiceCallHandler): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(IpcBusUtils.getServiceEventChannel(this._serviceName), eventMsg);
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