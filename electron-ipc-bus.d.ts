/// <reference types="node" />
import { EventEmitter } from 'events';

export function IpcBus(processType: string) : IpcBusClient;

export interface IpcBusClient extends EventEmitter {

    function connect(callback: Function);
    function subscribe(topic: string, handler: Function);
    function send(msg: Object| string);
    function unsubscribe(topic: string, handler: Function);
    function close();
}
