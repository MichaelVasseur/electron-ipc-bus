export {IpcBusConnectHandler} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResolve} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestReject} from './IpcBus/IpcBusInterfaces';
export {IpcBusTopicHandler} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResponse} from './IpcBus/IpcBusInterfaces';
export {IpcBusClient} from './IpcBus/IpcBusInterfaces';
export {IpcBusBroker} from './IpcBus/IpcBusInterfaces';

import {IpcBusClient} from './IpcBus/IpcBusInterfaces';
import {IpcBusBroker} from './IpcBus/IpcBusInterfaces';

import {_CreateIpcBusBroker} from './IpcBus/IpcBusApi';
import {_CreateIpcBus} from './IpcBus/IpcBusApi';
import {_ActivateIpcBusTrace} from './IpcBus/IpcBusApi';

export function CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    return _CreateIpcBusBroker(busPath);
}

export function CreateIpcBus(busPath?: string): IpcBusClient {
    return _CreateIpcBus(busPath);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return _ActivateIpcBusTrace(enable);
}