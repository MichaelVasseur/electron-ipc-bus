/// <reference types='node' />
import events = require('events');

export interface IpcBusRequestResolve {
    (payload: Object | string) : void;
}

export interface IpcBusRequestReject {
    (err: string) : void;
}

export interface IpcBusSender {
    peerName: string;
}

export interface IpcBusEvent {
    channel: string;
    requestResolve?: IpcBusRequestResolve;
    requestReject?: IpcBusRequestReject;
    sender: IpcBusSender;
}

export interface IpcBusRequestResponse {
    event: IpcBusEvent;
    payload?: Object | string;
    err?: string;
}

export interface IpcBusChannelHandler {
    (event: IpcBusEvent, payload: Object | string): void;
}

export interface IpcBusClient extends events.EventEmitter {
    readonly peerName: string;
    connect(timeoutDelay?: number): Promise<string>;
    close(): void;
    subscribe(channel: string, channelHandler: IpcBusChannelHandler): void;
    unsubscribe(channel: string, channelHandler: IpcBusChannelHandler): void;
    send(channel: string, payload: Object | string): void;
    request(channel: string, data: Object | string, timeoutDelay?: number): Promise<IpcBusRequestResponse>;
    queryBrokerState(channel: string): void;
}

export interface IpcBusBroker {
    start(timeoutDelay?: number): Promise<string>;
    stop(): void;
}

