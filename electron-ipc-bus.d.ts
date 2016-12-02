/// <reference types="node" />
import { EventEmitter } from 'events';

export default function (... args: any[]) : IpcBusClient;

export interface IpcBusClient extends EventEmitter {

    connect(callback: Function);
    subscribe(topic: string, handler: Function);
    send(msg: Object| string);
    unsubscribe(topic: string, handler: Function);
    close();

    start();
    stop();
}
