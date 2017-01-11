import * as IpcBusApi from './IpcBus/IpcBusApi';
export * from './IpcBus/IpcBusApi';

export function CreateIpcBusBroker(busPath?: string): IpcBusApi.IpcBusBroker {
    return IpcBusApi.CreateIpcBusBroker(busPath);
}

export function CreateIpcBus(busPath?: string): IpcBusApi.IpcBusClient {
    return IpcBusApi.CreateIpcBus(busPath);
}

export function ActivateIpcBusTrace(enable: boolean): void {
    return IpcBusApi.ActivateIpcBusTrace(enable);
}