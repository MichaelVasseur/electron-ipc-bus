
import * as IpcBusInterfaces from "./IpcBusInterfaces";

import { IpcBusBrokerClient } from "./IpcBusBroker";

// tslint:disable-next-line:typedef-whitespace
export function CreateIPCBusBroker(): IpcBusInterfaces.IpcBusBroker {
    const busPath = arguments.length >= 1 ? arguments[1] : null;

    return new IpcBusBrokerClient(busPath) as IpcBusInterfaces.IpcBusBroker;
}

import { IpcBusNodeClient } from "./IpcBusNode";
import { IpcBusMasterClient } from "./IpcBusMaster";
import { IpcBusRendererClient } from "./IpcBusRenderer";

export enum ProcessType {
    Node,
    Browser,
    Renderer
}

export function CreateIPCBusClient(processType: ProcessType, busPath?: string): IpcBusInterfaces.IpcBusClient {
    console.log("CreateIPCBusClient process type = " + processType + ", busPath = " + busPath);
    switch (processType) {
        case ProcessType.Renderer:
            return new IpcBusRendererClient() as IpcBusInterfaces.IpcBusClient;

        case ProcessType.Browser:
            return new IpcBusMasterClient(busPath) as IpcBusInterfaces.IpcBusClient;

        case ProcessType.Node:
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;

        default:
            return new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;
    }
}