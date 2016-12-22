import * as IpcBusApi from "./IpcBus/IpcBusApi";

export function CreateIpcBusBroker(busPath?: string): IpcBusApi.IpcBusBroker {
    return IpcBusApi.CreateIpcBusBroker(busPath);
}

export function CreateIpcBusForProcess(processType: string, busPath?: string): IpcBusApi.IpcBusClient {
    return IpcBusApi.CreateIpcBusForProcess(processType, busPath);
}

export function CreateIpcBus(busPath?: string): IpcBusApi.IpcBusClient {
    return IpcBusApi.CreateIpcBus(busPath);
}