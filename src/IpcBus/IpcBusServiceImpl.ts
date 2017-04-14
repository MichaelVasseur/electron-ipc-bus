/// <reference types='node' />

import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onCallReceived(event, <IpcBusInterfaces.IpcBusServiceCall>args[0]);
    private _prevImplEmit: Function = null;
    private static _hiddenMethods = new Set([
                                        'constructor',
                                        IpcBusInterfaces.IPCBUS_SERVICE_CALL_GETSTATUS,
                                        '_beforeCallHandler',
                                        'setMaxListeners',
                                        'getMaxListeners',
                                        'emit',
                                        'addListener',
                                        'on',
                                        'off',
                                        'prependListener',
                                        'once',
                                        'prependOnceListener',
                                        'removeListener',
                                        'removeAllListeners',
                                        'listeners',
                                        'listenerCount',
                                        'eventNames']);

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient, private _serviceName: string, private _exposedInstance: any = undefined) {

        this._callHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>();

        //  Register internal call handlers
        this.registerCallHandler(IpcBusInterfaces.IPCBUS_SERVICE_CALL_GETSTATUS, (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => {
            request.resolve(new IpcBusInterfaces.ServiceStatus(true, this._getCallHandlerNames()));
        });

        //  Register call handlers for exposed instance's method
        if (this._exposedInstance) {
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            // Looking in legacy class
            for (let memberName in this._exposedInstance) {
                if (typeof this._exposedInstance[memberName] === 'function'
                    && !IpcBusServiceImpl._hiddenMethods.has(memberName)) {
                    this.registerCallHandler(memberName,
                    (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => this._doCall(call, sender, request));
                }
            }
            // Looking in ES6 class
            for (let memberName of Object.getOwnPropertyNames(Object.getPrototypeOf(this._exposedInstance))) {
                const method = this._exposedInstance[memberName];
                if ( method instanceof Function
                     && !IpcBusServiceImpl._hiddenMethods.has(memberName)
                     && !this._callHandlers.has(memberName) ) {
                    this.registerCallHandler(memberName,
                    (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => this._doCall(call, sender, request));
                }
            }
        } else {
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    start(): void {

        if (this._exposedInstance && this._exposedInstance['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName: string, ...args: any[]) => {

                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(eventName, args);

                // Emit the event as usual
                this._prevImplEmit(eventName, ...args);
            };

            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }

        // The service is started, send available call handlers to clients
        let callHandlerNames = this._callHandlers.keys();
        const registeredHandlerNames = new Array<string>();
        for (let handlerName of callHandlerNames) {
            registeredHandlerNames.push(handlerName);
        }

        // Listening to call messages
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, new IpcBusInterfaces.ServiceStatus(true, this._getCallHandlerNames()));

        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }

    stop(): void {

        if (this._exposedInstance && this._prevImplEmit) {
            // Unhook events emitted by implementation to send them via IPC
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }

        // The service is stopped
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP, {});

        // No more listening to call messages
        this._ipcBusClient.removeListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: IpcBusInterfaces.IpcBusServiceCallHandler): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(IpcBusUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceCall) {
        if (!this._callHandlers.has(msg.handlerName)) {
            event.request.reject(`Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
        } else {

            try {

                this._callHandlers.get(msg.handlerName)(msg, event.sender, event.request);

            } catch (e) {

                event.request.reject(e);
                IpcBusUtils.Logger.enable && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${msg.handlerName}' : ${e}`);
            }
        }
    }

    private _doCall(call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        let callArgs = call.args;
        if (this._exposedInstance['_beforeCallHandler']) {
            callArgs = this._exposedInstance['_beforeCallHandler'](call, sender, request);
        }
        const result = this._exposedInstance[call.handlerName](...callArgs);
        if (result && result['then']) {
            // result is a valid promise
            result.then(request.resolve, request.reject);
        } else {
            // result is "just" a value
            request.resolve(result);
        }
    }

    private _getCallHandlerNames(): Array<string> {
        let keys = this._callHandlers.keys();
        const callHandlerNames = new Array<string>();
        for (let key of keys) {
            callHandlerNames.push(key);
        }
        return callHandlerNames;
    }
}