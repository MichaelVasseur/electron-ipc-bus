/// <reference types='node' />
import events = require('events');

// Special call handlers
export const IPCBUS_SERVICE_CALL_GETSTATUS: string = '__getServiceStatus';
// Special channels
export const IPCBUS_CHANNEL_QUERY_STATE: string = '/electron-ipc-bus/queryState';
export const IPCBUS_CHANNEL_SERVICE_AVAILABLE = '/electron-ipc-bus/serviceAvailable';
// Special events
export const IPCBUS_SERVICE_EVENT_START = 'service-event-start';
export const IPCBUS_SERVICE_EVENT_STOP = 'service-event-stop';
export const IPCBUS_SERVICE_WRAPPER_EVENT = 'service-wrapper-event';

export interface IpcBusRequest {
    resolve(payload: Object | string): void;
    reject(err: string): void;
}

export interface IpcBusRequestResponse {
    event: IpcBusEvent;
    payload?: Object | string;
    err?: string;
}

export interface IpcBusProcess {
    type: 'browser' | 'renderer' | 'node';
    pid: number;
    rid: number;
}

export interface IpcBusPeer {
    id: string;
    name: string;
    process: IpcBusProcess;
}

export interface IpcBusEvent {
    channel: string;
    sender: IpcBusPeer;
    request?: IpcBusRequest;
}

export interface IpcBusListener {
    (event: IpcBusEvent, ...args: any[]): void;
}

export interface IpcBusClient extends events.EventEmitter {
    peer: IpcBusPeer;

    connect(timeoutDelayOrPeerName?: number | string, peerName?: string): Promise<string>;
    close(): void;

    send(channel: string, ...args: any[]): void;
    request(timeoutDelayOrChannel: number | string, ...args: any[]): Promise<IpcBusRequestResponse>;

    // EventEmitter API
    addListener(channel: string, listener: IpcBusListener): this;
    removeListener(channel: string, listener: IpcBusListener): this;
    on(channel: string, listener: IpcBusListener): this;
    once(channel: string, listener: IpcBusListener): this;
    off(channel: string, listener: IpcBusListener): this;

    // EventEmitter API - Added in Node 6...
    prependListener(channel: string, listener: IpcBusListener): this;
    prependOnceListener(channel: string, listener: IpcBusListener): this;
}

export interface IpcBusBroker {
    start(timeoutDelay?: number): Promise<string>;
    stop(): void;
    queryState(): Object;
    isServiceAvailable(serviceName: string): boolean;
}

export interface IpcBusBridge {
    start(timeoutDelay?: number): Promise<string>;
    stop(): void;
}

export interface IpcBusServiceCall {
    handlerName: string;
    args: any[];
}

export interface IpcBusServiceCallHandler {
    (call: IpcBusServiceCall, sender: IpcBusPeer, request: IpcBusRequest): void;
}
export class ServiceStatus {
    constructor(public started: boolean, public callHandlers: Array<string>, public supportEventEmitter: boolean) {
    }
}

export interface IpcBusService {
    start(): void;
    stop(): void;
    registerCallHandler(name: string, handler: IpcBusServiceCallHandler): void;
    sendEvent(eventName: string, ...args: any[]): void;
}

export interface IpcBusServiceEvent {
    eventName: string;
    args: any[];
}

export interface IpcBusServiceEventHandler {
    (event: IpcBusServiceEvent): void;
}

export interface IpcBusServiceProxy extends events.EventEmitter {
    readonly isStarted: boolean;

    getStatus(): Promise<ServiceStatus>;
    call<T>(handlerName: string, ...args: any[]): Promise<T>;
    getWrapper<T>(): T;
    connect<T>(timeoutDelay?: number): Promise<T>;
}
