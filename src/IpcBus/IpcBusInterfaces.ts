/// <reference types='node' />
import events = require('events');

export interface IpcBusRequest {
    resolve(payload: Object | string): void;
    reject(err: string): void;
}

export interface IpcBusRequestResponse {
    event: IpcBusEvent;
    payload?: Object | string;
    err?: string;
}

export interface IpcBusSender {
    peerName: string;
}

export interface IpcBusEvent {
    channel: string;
    sender: IpcBusSender;
    request?: IpcBusRequest;
}

export interface IpcBusListener {
    (event: IpcBusEvent, ...args: any[]): void;
}

export interface IpcBusClient extends events.EventEmitter {
    readonly peerName: string;
    connect(timeoutDelay?: number): Promise<string>;
    close(): void;
    send(channel: string, ...args: any[]): void;
    request(timeoutDelay: number, channel: string, ...args: any[]): Promise<IpcBusRequestResponse>;

    // EventEmitter overriden API
    addListener(channel: string, listener: IpcBusListener): this;
    removeListener(channel: string, listener: IpcBusListener): this;
    on(channel: string, listener: IpcBusListener): this;
    once(channel: string, listener: IpcBusListener): this;
    off(channel: string, listener: IpcBusListener): this;

    // Added in Node 6...
    prependListener(channel: string, listener: IpcBusListener): this;
    prependOnceListener(channel: string, listener: IpcBusListener): this;
}

export namespace IpcBusClient {
    export const QUERYSTATE_CHANNEL = '/electron-ipc-bus/queryState';
}

export interface IpcBusBroker {
    start(timeoutDelay?: number): Promise<string>;
    stop(): void;
    queryState(): Object;
}

