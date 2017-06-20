// Purpose of this is to limit dependencies when ipc-bus is bundled in a renderer.
// If you use browserify, you have to add such field in the package.json of your bundled lib
//     "browser": {
//     "electron-ipc-bus": "electron-ipc-bus/lib/electron-ipc-bus-renderer.js"
// }

export {IpcBusRequest} from './IpcBus/IpcBusInterfaces';
export {IpcBusRequestResponse} from './IpcBus/IpcBusInterfaces';
export {IpcBusPeer} from './IpcBus/IpcBusInterfaces';
export {IpcBusEvent} from './IpcBus/IpcBusInterfaces';
export {IpcBusListener} from './IpcBus/IpcBusInterfaces';

export {IPCBUS_CHANNEL_QUERY_STATE} from './IpcBus/IpcBusInterfaces';
export {IPCBUS_CHANNEL_SERVICE_AVAILABLE} from './IpcBus/IpcBusInterfaces';

export {IPCBUS_SERVICE_EVENT_START} from './IpcBus/IpcBusInterfaces';
export {IPCBUS_SERVICE_EVENT_STOP} from './IpcBus/IpcBusInterfaces';

export {ServiceStatus} from './IpcBus/IpcBusInterfaces';

import {IpcBusClient} from './IpcBus/IpcBusInterfaces';
import {IpcBusService} from './IpcBus/IpcBusInterfaces';
import {IpcBusServiceProxy} from './IpcBus/IpcBusInterfaces';

import {_CreateIpcBusClientRenderer} from './IpcBus/IpcBusApiRenderer';
import {_CreateIpcBusService} from './IpcBus/IpcBusApiRenderer';
import {_CreateIpcBusServiceProxy} from './IpcBus/IpcBusApiRenderer';
import {_ActivateIpcBusTrace} from './IpcBus/IpcBusApiRenderer';
import {_ActivateServiceTrace} from './IpcBus/IpcBusApiRenderer';

export function CreateIpcBusClient(busPath?: string): IpcBusClient {
    return _CreateIpcBusClientRenderer(busPath);
}

export function CreateIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: any = undefined): IpcBusService {
    return _CreateIpcBusService(client, serviceName, serviceImpl);
}

export function CreateIpcBusServiceProxy(client: IpcBusClient, serviceName: string, callTimeout: number = 1000): IpcBusServiceProxy {
    return _CreateIpcBusServiceProxy(client, serviceName, callTimeout);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return _ActivateIpcBusTrace(enable);
}

export function ActivateServiceTrace(enable: boolean): void {
    return _ActivateServiceTrace(enable);
}