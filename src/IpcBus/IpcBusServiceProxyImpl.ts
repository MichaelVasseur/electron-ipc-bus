/// <reference types='node' />

import {EventEmitter} from 'events';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

// Implementation of IPC service
/** @internal */
export class IpcBusServiceProxyImpl extends EventEmitter implements IpcBusInterfaces.IpcBusServiceProxy {
    private _eventHandlers: Map<string, IpcBusInterfaces.IpcBusServiceEventHandler>;
    private _eventReceivedLamdba: IpcBusInterfaces.IpcBusListener = (event: IpcBusInterfaces.IpcBusEvent, ...args: any[]) => this._onEventReceived(event, <IpcBusInterfaces.IpcBusServiceEvent>args[0]);
    private _isAvailable: boolean;

    constructor(private _ipcBusClient: IpcBusInterfaces.IpcBusClient,
                private _serviceName: string) {
        super();
        this._eventHandlers = new Map<string, IpcBusInterfaces.IpcBusServiceEventHandler>();

        // Check service availability
        this._isAvailable = false;
        this.checkAvailability();

        // Register service start/stop events
        const self = this;
        this.addListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, () => self._onServiceStart());
        this.addListener(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_STOP, () => self._onServiceStop());
    }

    get isAvailable(): boolean {
        return this._isAvailable;
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
                },
                (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.payload));
        });
    }

    call<T>(name: string, timeout: number, ...args: any[]): Promise<T> {
        const self = this;
        const callMsg = { handlerName: name, args: args };
        if (this.isAvailable) {
            return new Promise<T>((resolve, reject) => {
                self._ipcBusClient
                    .request(timeout, IpcBusUtils.getServiceCallChannel(self._serviceName), callMsg)
                    .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                            (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
            });
        } else {
            return new Promise<T>((resolve, reject) => {
                self.once(IpcBusInterfaces.IPCBUS_SERVICE_EVENT_START, () => {
                        this._ipcBusClient
                            .request(timeout, IpcBusUtils.getServiceCallChannel(this._serviceName), callMsg)
                            .then(  (res: IpcBusInterfaces.IpcBusRequestResponse) => resolve(<T>res.payload),
                                    (res: IpcBusInterfaces.IpcBusRequestResponse) => reject(res.err));
                    });
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
        this.emit(msg.eventName, ...msg.args);
    }

    private _onServiceStart() {
        this._isAvailable = true;
    }

    private _onServiceStop() {
        this._isAvailable = false;
    }
}