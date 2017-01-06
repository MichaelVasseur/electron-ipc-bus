import * as IpcBusApi from './IpcBus/IpcBusApi';

export function CreateIpcBusBroker(busPath?: string): IpcBusApi.IpcBusBroker {
    return IpcBusApi.CreateIpcBusBroker(busPath);
}

export function CreateIpcBus(busPath?: string): IpcBusApi.IpcBusClient {
    return IpcBusApi.CreateIpcBus(busPath);
}