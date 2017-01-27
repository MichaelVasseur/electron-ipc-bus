export {IpcBusRequest} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResponse} from './IpcBus/IpcBusInterfaces';
export {IpcBusSender} from './IpcBus/IpcBusInterfaces';
export {IpcBusEvent} from './IpcBus/IpcBusInterfaces';
export {IpcBusListener} from './IpcBus/IpcBusInterfaces';

import {IpcBusClient} from './IpcBus/IpcBusInterfaces';
import {IpcBusBroker} from './IpcBus/IpcBusInterfaces';

import {_CreateIpcBusBroker} from './IpcBus/IpcBusApi';
import {_CreateIpcBusClient} from './IpcBus/IpcBusApi';
import {_ActivateIpcBusTrace} from './IpcBus/IpcBusApi';

export const QUERYSTATE_CHANNEL = IpcBusClient.QUERYSTATE_CHANNEL;

export function CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    return _CreateIpcBusBroker(busPath);
}

export function CreateIpcBusClient(busPath?: string): IpcBusClient {
    return _CreateIpcBusClient(busPath);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return _ActivateIpcBusTrace(enable);
}