export {IpcBusRequest} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResponse} from './IpcBus/IpcBusInterfaces';
export {IpcBusSender} from './IpcBus/IpcBusInterfaces';
export {IpcBusEvent} from './IpcBus/IpcBusInterfaces';
export {IpcBusListener} from './IpcBus/IpcBusInterfaces';

import {IpcBusClient} from './IpcBus/IpcBusInterfaces';
import {IpcBusBroker} from './IpcBus/IpcBusInterfaces';
import {IpcBusService} from './IpcBus/IpcBusInterfaces';
import {IpcBusServiceProxy} from './IpcBus/IpcBusInterfaces';

import {_CreateIpcBusBroker} from './IpcBus/IpcBusApi';
import {_CreateIpcBusClient} from './IpcBus/IpcBusApi';
import {_CreateIpcBusService} from './IpcBus/IpcBusApi';
import {_CreateIpcBusServiceProxy} from './IpcBus/IpcBusApi';
import {_ActivateIpcBusTrace} from './IpcBus/IpcBusApi';

//export const QUERYSTATE_CHANNEL = IpcBusInterClient.QUERYSTATE_CHANNEL;

export function CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    return _CreateIpcBusBroker(busPath);
}

export function CreateIpcBusClient(busPath?: string): IpcBusClient {
    return _CreateIpcBusClient(busPath);
}

export function CreateIpcBusService(serviceName: string): IpcBusService {
    return _CreateIpcBusService(serviceName);
}

export function CreateIpcBusServiceProxy(serviceName: string): IpcBusServiceProxy {
    return _CreateIpcBusServiceProxy(serviceName);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return _ActivateIpcBusTrace(enable);
}