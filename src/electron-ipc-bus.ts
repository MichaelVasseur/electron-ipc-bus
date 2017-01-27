export {IpcBusRequest} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResponse} from './IpcBus/IpcBusInterfaces';
export {IpcBusSender} from './IpcBus/IpcBusInterfaces';
export {IpcBusEvent} from './IpcBus/IpcBusInterfaces';
export {IpcBusListener} from './IpcBus/IpcBusInterfaces';

import {IpcBusClient} from './IpcBus/IpcBusInterfaces';
import {IpcBusBroker} from './IpcBus/IpcBusInterfaces';
import {IpcBusService} from './IpcBus/IpcBusInterfaces';

import {_CreateIpcBusBroker} from './IpcBus/IpcBusApi';
import {_CreateIpcBusClient} from './IpcBus/IpcBusApi';
import {_CreateIpcBusService} from './IpcBus/IpcBusApi';
import {_IsIpcBusServiceAvailable} from './IpcBus/IpcBusApi';
import {_CallIpcBusService} from './IpcBus/IpcBusApi';
import {_ActivateIpcBusTrace} from './IpcBus/IpcBusApi';

export const QUERYSTATE_CHANNEL = IpcBusClient.QUERYSTATE_CHANNEL;

export function CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    return _CreateIpcBusBroker(busPath);
}

export function CreateIpcBusClient(busPath?: string): IpcBusClient {
    return _CreateIpcBusClient(busPath);
}

export function CreateIpcBusService(serviceName: string): IpcBusService {
    return _CreateIpcBusService(serviceName);
}

export function IsIpcBusServiceAvailable(serviceName: string): Promise<boolean> {
    return _IsIpcBusServiceAvailable(serviceName);
}

export function CallIpcBusService<T>(serviceName: string, callHandlerName: string, timeout: number, ...callArgs: any[]): Promise<T> {
    return _CallIpcBusService<T>(serviceName, callHandlerName, timeout, ...callArgs);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return _ActivateIpcBusTrace(enable);
}