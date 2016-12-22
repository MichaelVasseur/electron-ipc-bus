
import * as IpcBusInterfaces from "./IpcBusInterfaces";
export * from "./IpcBusInterfaces";

import { IpcBusBrokerClient } from "./IpcBusBroker";

export function CreateIpcBusBroker(busPath?: string): IpcBusInterfaces.IpcBusBroker {
    return new IpcBusBrokerClient(busPath) as IpcBusInterfaces.IpcBusBroker;
}
import { IpcBusNodeClient } from "./IpcBusNode";
import { IpcBusMainClient } from "./IpcBusMain";
import { IpcBusRendererClient } from "./IpcBusRenderer";
import * as ElectronUtils from "./ElectronUtils";

export function CreateIpcBusForProcess(processType: string, busPath?: string): IpcBusInterfaces.IpcBusClient {
    console.log("CreateIpcBusForProcess process type = " + processType + ", busPath = " + busPath);
    switch (processType) {
        case "renderer":
            return new IpcBusRendererClient() as IpcBusInterfaces.IpcBusClient;

        case "browser":
            return new IpcBusMainClient(busPath) as IpcBusInterfaces.IpcBusClient;

        case "node":
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;

        default:
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;
    }
}

export function CreateIpcBus(busPath?: string): IpcBusInterfaces.IpcBusClient {
    return CreateIpcBusForProcess(ElectronUtils.GuessElectronProcessType(), busPath);
}