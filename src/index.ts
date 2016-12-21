
import * as IpcBusInterfaces from "./IpcBus/IpcBusInterfaces";

import { IpcBusBrokerClient } from "./IpcBus/IpcBusBroker";

// tslint:disable-next-line:typedef-whitespace
export function CreateIPCBusBroker(busPath?: string): IpcBusInterfaces.IpcBusBroker {
    return new IpcBusBrokerClient(busPath) as IpcBusInterfaces.IpcBusBroker;
}

import { IpcBusNodeClient } from "./IpcBus/IpcBusNode";
import { IpcBusMainClient } from "./IpcBus/IpcBusMain";
import { IpcBusRendererClient } from "./IpcBus/IpcBusRenderer";
import * as ElectronUtils from "./IpcBus/ElectronUtils";

export enum ProcessType {
    Node,
    Main,
    Renderer
}
export function CreateIPCBusForProcess(processTypeValue: ProcessType, busPath?: string): IpcBusInterfaces.IpcBusClient {
    console.log("CreateIPCBusForClient process type = " + processTypeValue + ", busPath = " + busPath);
    switch (processTypeValue) {
        case ProcessType.Renderer:
            return new IpcBusRendererClient() as IpcBusInterfaces.IpcBusClient;

        case ProcessType.Main:
            return new IpcBusMainClient(busPath) as IpcBusInterfaces.IpcBusClient;

        case ProcessType.Node:
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;

        default:
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;
    }
}

export function CreateIPCBus(busPath?: string): IpcBusInterfaces.IpcBusClient {
    let processTypeValue: ProcessType = ProcessType.Node;
    let processType: string = ElectronUtils.GuessElectronProcessType();
    if (processType === "renderer") {
        processTypeValue = ProcessType.Renderer;
    }
    else if (processType === "browser") {
        processTypeValue = ProcessType.Main;
    }
    console.log("Guess process type = " + ProcessType[processTypeValue]);
    return CreateIPCBusForProcess(processTypeValue, busPath);
}