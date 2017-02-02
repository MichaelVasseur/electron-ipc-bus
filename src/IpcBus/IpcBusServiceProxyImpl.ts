/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

class CallWrapper {
    [key: string]: Function;
}

// Implementation of IPC service
/** @internal */
export class IpcBusServiceProxyImpl extends EventEmitter implements IpcBusInterfaces.IpcBusServiceProxy {
    private _eventHandlers: Map<string, IpcBusInterfaces.IpcBusServiceEventHandler>;
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);
    private _delayedCalls = new Array<Function>();
    private _isAvailable: boolean;
    private _wrapper: CallWrapper = null;

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient,
                private _serviceName: string,
                private _callTimeout: number = 1000) {
        super();
        this._eventHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceEventHandler>();

        // Check service availability
        this._isAvailable = false;
        this.checkAvailability();

        // Register service start/stop events
        this.addListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, (serviceEvent: IpcBusInterfaces.IpcBusServiceEvent) => this._onServiceStart(serviceEvent));
        this.addListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP, () => this._onServiceStop());
    }

    get isAvailable(): boolean {
        return this._isAvailable;
    }

    get wrapper(): Object {
        return this._wrapper;
    }

    checkAvailability(): Promise<boolean> {

        return new Promise<boolean>((resolve, reject) => {

            const self = this;
            this._ipcBusClient
                .request(2000, IpcBusInterfaces.IPCBUS_CHANNEL_SERVICE_AVAILABLE, this._serviceName)
                .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => {
                    self._isAvailable = <boolean>res.payload;
                    IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' availability = ${self._isAvailable}`);
                    resolve(self._isAvailable);
                    if (self._isAvailable === true) {
                        this._sendDelayedCalls();
                    }
                },
                (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.payload));
        });
    }

    call<T>(name: string, ...args: any[]): Promise<T> {
        const self = this;
        const callMsg = { handlerName: name, args: args };
        if (this.isAvailable) {
            return new Promise<T>((resolve, reject) => {
                self._ipcBusClient
                    .request(self._callTimeout, IpcBusUtils.getServiceCallChannel(self._serviceName), callMsg)
                    .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                            (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
            });
        } else {
            return new Promise<T>((resolve, reject) => {
                IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Call to '${name}' from service '${this._serviceName}' delayed as the service is not available`);

                const delayedCall = () => {
                    IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Executing delayed call to '${name}' from service '${this._serviceName}' ...`);
                    this._ipcBusClient
                        .request(self._callTimeout, IpcBusUtils.getServiceCallChannel(this._serviceName), callMsg)
                        .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                                (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
                };
                self._delayedCalls.push(delayedCall);
            });
        }
    }

    // EventEmitter API
    addListener(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        super.addListener(event, listener);
        this._subscribeToBusIfRequired();
        return this;
    }

    removeListener(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        super.removeListener(event, listener);
        this._unsubscribeFromBusIfPossible();
        return this;
    }

    on(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        return this.addListener(event, listener);
    }

    once(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        super.once(event, listener);
        this._subscribeToBusIfRequired();
        return this;
    }

    off(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        return this.removeListener(event, listener);
    }

    removeAllListeners(event?: string): this {
        if (event) {
            super.removeAllListeners(event);
        }
        this._unsubscribeFromBusIfPossible();
        return this;
    }

    // Added in Node 6...
    prependListener(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        super.prependListener(event, listener);
        this._subscribeToBusIfRequired();
        return this;
    }

    prependOnceListener(event: string, listener: IpcBusInterfaces.IpcBusServiceEventHandler): this {
        super.prependOnceListener(event, listener);
        this._subscribeToBusIfRequired();
        return this;
    }

    private _updateWrapper(handlerNames: Array<string>): void {
        // Setup a new wrapper
        this._wrapper = new CallWrapper();
        const self = this;
        handlerNames.forEach((handlerName: string) => {
            const proc = (...args: any[]) => {
                return self.call<Object>(handlerName, ...args);
            };
            this._wrapper[handlerName] = proc;
            IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${self._serviceName}' added '${handlerName}' to its wrapper`);
        });
    }

    private _sendDelayedCalls(): void {
        this._delayedCalls.forEach((delayedCall: Function) => {
            delayedCall();
        });
        this._delayedCalls.splice(0, this._delayedCalls.length);
    }

    private _subscribeToBusIfRequired(): void {
        const channelName = IpcBusUtils.getServiceEventChannel(this._serviceName);
        if (this.eventNames().length > 0 && this._ipcBusClient.listenerCount(channelName) === 0) {
            this._ipcBusClient.addListener(channelName, this._eventReceivedLamdba);
        }
    }

    private _unsubscribeFromBusIfPossible(): void {
        const channelName = IpcBusUtils.getServiceEventChannel(this._serviceName);
        if (this.eventNames().length === 0 && this._ipcBusClient.listenerCount(channelName) > 0) {
            this._ipcBusClient.removeListener(channelName, this._eventReceivedLamdba);
        }
    }

    private _onEventReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceEvent) {
        IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' emitted event '${msg.eventName}'`);
        this.emit(msg.eventName, msg);
    }

    private _onServiceStart(serviceEvent: IpcBusInterfaces.IpcBusServiceEvent) {
        this._isAvailable = true;
        IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' IS available`);
        this._updateWrapper(<Array<string>>serviceEvent.args[0]);

        this._sendDelayedCalls();
    }

    private _onServiceStop() {
        this._isAvailable = false;
        IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' IS NOT available`);
    }
}