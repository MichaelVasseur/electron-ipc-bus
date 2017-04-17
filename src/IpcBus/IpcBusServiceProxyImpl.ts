/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';


class CallWrapperEventEmitter extends EventEmitter {
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient,
                private _serviceName: string) {
        super();

        // Register service start/stop events
        _ipcBusClient.addListener(IpcBusUtils.getServiceEventChannel(this._serviceName), this._eventReceivedLamdba);
    }

    // EventEmitter API
    listenerCount(event: string): number {
        return super.listenerCount(event);
    }

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

    private _subscribeToBusIfRequired(): void {
        const channelName = IpcBusUtils.getServiceEventChannel(this._serviceName);
        if (this._ipcBusClient.listenerCount(channelName) === 0) {
            this._ipcBusClient.addListener(channelName, this._eventReceivedLamdba);
        }
    }

    private _unsubscribeFromBusIfPossible(): void {
        const channelName = IpcBusUtils.getServiceEventChannel(this._serviceName);
        if (this._ipcBusClient.listenerCount(channelName) > 0) {
            this._ipcBusClient.removeListener(channelName, this._eventReceivedLamdba);
        }
    }

    private _onEventReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceEvent) {
        IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' emitted event '${msg.eventName}'`);
        this.emit(msg.eventName, ...msg.args);
    }
}

// class CallWrapper {
//     [key: string] : Function;
// }

// Implementation of IPC service
/** @internal */
export class IpcBusServiceProxyImpl extends EventEmitter implements IpcBusInterfaces.IpcBusServiceProxy {
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);
    private _delayedCalls = new Array<Function>();
    private _isStarted: boolean;
    private _wrapper: any = null;

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient,
                private _serviceName: string,
                private _callTimeout: number = 1000) {
        super();

        // Check service availability
        this._isStarted = false;
        this.getStatus();

        // Register service start/stop events
        _ipcBusClient.addListener(IpcBusUtils.getServiceControlChannel(this._serviceName), this._eventReceivedLamdba);
    }

    get isStarted(): boolean {
        return this._isStarted;
    }

    connect(timeoutDelay?: number): Promise<IpcBusInterfaces.ServiceStatus> {
        let p = new Promise<IpcBusInterfaces.ServiceStatus>((resolve, reject) => {
            this.getStatus(timeoutDelay).then((serviceStatus) => {
                if (serviceStatus.started) {
                    resolve(serviceStatus);
                }
                else {
                    reject(false)
                }
            })
            .catch((err) => {
                reject(err);
            });
        });
        return p;
    }

    get wrapper(): Object {
        return this._wrapper;
    }

    getStatus(timeoutDelay?: number): Promise<IpcBusInterfaces.ServiceStatus> {
        return new Promise<IpcBusInterfaces.ServiceStatus>((resolve, reject) => {
            const statusCallMsg = { handlerName: IpcBusInterfaces.IPCBUS_SERVICE_CALL_GETSTATUS };
            this._ipcBusClient.request(this._callTimeout, IpcBusUtils.getServiceCallChannel(this._serviceName), statusCallMsg)
                .then((res: IpcBusInterfaces.IpcBusRequestResponse) => {
                    const serviceStatus = <IpcBusInterfaces.ServiceStatus>res.payload;
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' availability = ${serviceStatus.started}`);
                    if ((this._isStarted !== serviceStatus.started) && serviceStatus.started) {
                        this._isStarted = serviceStatus.started;
                        // Service is started
                        this._onServiceStart(serviceStatus);
                    }
                    resolve(serviceStatus);
                })
                .catch((res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
            });
    }

    call<T>(name: string, ...args: any[]): Promise<T> {
        const callMsg = { handlerName: name, args: args };
        if (this._isStarted) {
            return new Promise<T>((resolve, reject) => {
                this._ipcBusClient
                    .request(this._callTimeout, IpcBusUtils.getServiceCallChannel(this._serviceName), callMsg)
                    .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                            (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
            });
        } else {
            return new Promise<T>((resolve, reject) => {
                IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Call to '${name}' from service '${this._serviceName}' delayed as the service is not available`);

                const delayedCall = () => {
                    IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Executing delayed call to '${name}' from service '${this._serviceName}' ...`);
                    this._ipcBusClient
                        .request(this._callTimeout, IpcBusUtils.getServiceCallChannel(this._serviceName), callMsg)
                        .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                                (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
                };
                this._delayedCalls.push(delayedCall);
            });
        }
    }

    getWrapper<T>(): T {
        const typed_wrapper: any = this._wrapper;
        return <T> typed_wrapper;
    }

    private _updateWrapper(serviceStatus: IpcBusInterfaces.ServiceStatus): void {
        // Setup a new wrapper
//        if (serviceStatus.supportEventEmitter) {
            // A bit ugly the any cast !
            this._wrapper = new CallWrapperEventEmitter(this._ipcBusClient, this._serviceName);
        // }
        // else {
        //     this._wrapper = new CallWrapper();
        // }
        serviceStatus.callHandlers.forEach((handlerName: string) => {
            const proc = (...args: any[]) => {
                return this.call<Object>(handlerName, ...args);
            };
            this._wrapper[handlerName] = proc;
            IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`);
        });
    }

    private _sendDelayedCalls(): void {
        this._delayedCalls.forEach((delayedCall: Function) => {
            delayedCall();
        });
        this._delayedCalls.splice(0, this._delayedCalls.length);
    }

    private _onEventReceived(event: IpcBusInterfaces.IpcBusEvent, msg: IpcBusInterfaces.IpcBusServiceEvent) {
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive control '${msg.eventName}'`);
        switch (msg.eventName) {
            case IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START : 
                this._onServiceStart(msg.args[0] as IpcBusInterfaces.ServiceStatus);
                break;
            case IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP :
                this._onServiceStop();
                break;
        }
        this.emit(msg.eventName, ...msg.args);
    }

    private _onServiceStart(serviceStatus: IpcBusInterfaces.ServiceStatus) {
        this._isStarted = serviceStatus.started;
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
        this._updateWrapper(serviceStatus);

        this._sendDelayedCalls();
    }

    private _onServiceStop() {
        this._isStarted = false;
        IpcBusUtils.Logger.service && IpcBusUtils.Logger.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);
    }
}