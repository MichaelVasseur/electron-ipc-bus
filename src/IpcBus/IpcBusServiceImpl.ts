/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceImpl implements IpcBusInterfaces.IpcBusService {
    private _callHandlers: Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>;
    private _callReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onCallReceived(event, <IpcBusInterfaces.IpcBusServiceCall>args[0]);
    private _prevImplEmit: Function = null;

    private static _hiddenMethods: Set<string> = null;

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient, private _serviceName: string, private _exposedInstance: any = undefined) {
        if (IpcBusServiceImpl._hiddenMethods == null) {
            IpcBusServiceImpl._hiddenMethods = new Set<string>();
            for (let prop of Object.keys(EventEmitter.prototype)) {
                // Do not care of private methods, supposed to be pre-fixed by one or several underscores
                if (prop[0] !== '_') {
                    IpcBusServiceImpl._hiddenMethods.add(prop);
                }
            }
            IpcBusServiceImpl._hiddenMethods.add('constructor');
            IpcBusServiceImpl._hiddenMethods.add('off');
        }

        this._callHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceCallHandler>();

        //  Register internal call handlers
        this.registerCallHandler(IpcBusInterfaces.IPCBUS_SERVICE_CALL_GETSTATUS, (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => {
            request.resolve(new IpcBusInterfaces.ServiceStatus(true, this._getCallHandlerNames(), (this._prevImplEmit != null)));
        });

        //  Register call handlers for exposed instance's method
        if (this._exposedInstance) {
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            // Looking in legacy class
            for (let memberName in this._exposedInstance) {
                const method = this._exposedInstance[memberName];
                if ((typeof method === 'function')
                    && this._isFunctionVisible(memberName)) {
                    this.registerCallHandler(memberName,
                    (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => this._doCall(call, sender, request));
                }
            }
            // Looking in ES6 class
            for (let memberName of Object.getOwnPropertyNames(Object.getPrototypeOf(this._exposedInstance))) {
                if (!this._callHandlers.has(memberName)) {
                    const method = this._exposedInstance[memberName];
                    if ((method instanceof Function)
                        && this._isFunctionVisible(memberName)) {
                        this.registerCallHandler(memberName,
                        (call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) => this._doCall(call, sender, request));
                    }
                }
            }
        } else {
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    private _isFunctionVisible(memberName: string): boolean {
        if (IpcBusServiceImpl._hiddenMethods.has(memberName)) {
            return false;
        }
        // Hide private methods, supposed to be pre-fixed by one or several underscores
        return (memberName[0] !== '_');
    }

    start(): void {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName: string, ...args: any[]) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                // Emit the event as usual in the context of the _exposedInstance
                this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };

            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`);
        }

        // Listening to call messages
        this._ipcBusClient.addListener(IpcBusUtils.getServiceCallChannel(this._serviceName), this._callReceivedLamdba);

        // The service is started, send available call handlers to clients
        this.sendEvent(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, new IpcBusInterfaces.ServiceStatus(true, this._getCallHandlerNames(), (this._prevImplEmit != null)));

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
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

        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: IpcBusInterfaces.IpcBusServiceCallHandler): void {
        this._callHandlers.set(name, handler);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg = { eventName: name, args: args };
        this._ipcBusClient.send(IpcBusUtils.getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceCall) {
        let callHandler: IpcBusInterfaces.IpcBusServiceCallHandler = this._callHandlers.get(msg.handlerName);
        if (!callHandler) {
            event.request.reject(`Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' does NOT handle calls to '${msg.handlerName}' !`);
        }
        else {
            try {
                callHandler(msg, event.sender, event.request);
            }
            catch (e) {
                event.request.reject(e);
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${msg.handlerName}' : ${e}`);
            }
        }
    }

    private _doCall(call: IpcBusInterfaces.IpcBusServiceCall, sender: IpcBusInterfaces.IpcBusPeer, request: IpcBusInterfaces.IpcBusRequest) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`);
        let callArgs = call.args;
        if (this._exposedInstance['_beforeCallHandler']) {
            callArgs = this._exposedInstance['_beforeCallHandler'](call, sender, request);
        }
        try {
            const result = this._exposedInstance[call.handlerName](...callArgs);
            if (result && result['then']) {
                // result is a valid promise
                result.then(request.resolve, request.reject);
            } else {
                // result is "just" a value
                request.resolve(result);
            }
        }
        catch (e) {
            request.reject(e);
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.error(`[IpcService] Service '${this._serviceName}' encountered an exception while processing call to '${call.handlerName}' : ${e}`);
        }
    }

    private _getCallHandlerNames(): Array<string> {
        // Remove __getServiceStatus and any internal hidden functions
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}