/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onCallReceived(event, <IpcBusInterfaces.IpcBusServiceCall>args[0]);
    private _prevImplEmit: Function = null;
    private static _emitterFunctions = ['setMaxListeners',
                                        'getMaxListeners',
                                        'emit',
                                        'addListener',
                                        'on',
                                        'prependListener',
                                        'once',
                                        'prependOnceListener',
                                        'removeListener',
                                        'removeAllListeners',
                                        'listeners',
                                        'listenerCount',
                                        'eventNames'];

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient, private _serviceName: string, private _serviceImpl: any = undefined) {

        this._callHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>();

        const self = this;
        if (this._serviceImpl) {
            IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' HAS an implementation`);
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            for (let memberName in this._serviceImpl) {
                if (typeof this._serviceImpl[memberName] === 'function' && IpcBusServiceImpl._emitterFunctions.indexOf(memberName) === -1) {
                    this.registerCallHandler(memberName, (call: IpcBusInterfaces.IpcBusServiceCall, request: IpcBusInterfaces.IpcBusRequest) => {
                        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${memberName}'`);
                        const result = self._serviceImpl[memberName](...call.args);
                        request.resolve(result);
                    });
                }
            }
        } else {
            IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    start(): void {

        if (this._serviceImpl && this._serviceImpl['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._serviceImpl['emit'];
            this._serviceImpl['emit'] = (eventName: string, ...args: any[]) => {

                IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(eventName, args);

                // Emit the event as usual
                this._prevImplEmit(eventName, ...args);
            };

            IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }

        // Listening to call messages
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        // The service is started
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, {});

        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }

    stop(): void {

        if (this._serviceImpl && this._prevImplEmit) {
            // Unhook events emitted by implementation to send them via IPC
            this._serviceImpl['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }

        // The service is stopped
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP, {});

        // No more listening to call messages
        this._ipcBusClient.removeListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: IpcBusInterfaces.IpcBusServiceCallHandler): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(IpcBusUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceCall) {
        if (!this._callHandlers.has(msg.handlerName)) {
            event.request.reject(`Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
            IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
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