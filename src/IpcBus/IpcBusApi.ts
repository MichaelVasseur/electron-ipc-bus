
import * as IpcBusInterfaces from "./IpcBusInterfaces";
export * from "./IpcBusInterfaces";

import { IpcBusBrokerClient } from "./IpcBusBroker";
import * as IpcBusUtils from "./IpcBusUtils";

export function CreateIpcBusBroker(busPath?: string): IpcBusInterfaces.IpcBusBroker {
    let ipcBusBroker: IpcBusInterfaces.IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.GetPortAndHost(busPath);
    if (ipcOptions.isValid()) {
        console.log("CreateIpcBusBroker ipc options = " + JSON.stringify(ipcOptions));
        ipcBusBroker = new IpcBusBrokerClient(ipcOptions) as IpcBusInterfaces.IpcBusBroker;
    }
    return ipcBusBroker;
}

import { IpcBusNodeClient } from "./IpcBusNode";
import { IpcBusMainClient } from "./IpcBusMain";
import { IpcBusRendererClient } from "./IpcBusRenderer";
import * as ElectronUtils from "./ElectronUtils";

// A single instance per process
let _ipcBusClient: IpcBusInterfaces.IpcBusClient = null;

function CreateIpcBusForProcess(processType: string, busPath?: string): IpcBusInterfaces.IpcBusClient {
    let ipcOptions = IpcBusUtils.GetPortAndHost(busPath);
    console.log("CreateIpcBusForProcess process type = " + processType + ", ipc options = " + JSON.stringify(ipcOptions));

    if (_ipcBusClient == null) {
        switch (processType) {
            case "renderer":
                _ipcBusClient = new IpcBusRendererClient() as IpcBusInterfaces.IpcBusClient;
                break;

            case "browser":
                if (ipcOptions.isValid()) {
                    _ipcBusClient = new IpcBusMainClient(ipcOptions) as IpcBusInterfaces.IpcBusClient;
                }
                break;

            case "node":
            default:
                if (ipcOptions.isValid()) {
                    _ipcBusClient = new IpcBusNodeClient(ipcOptions) as IpcBusInterfaces.IpcBusClient;
                }
                break;
        }
    }
    return _ipcBusClient;
}

export function CreateIpcBus(busPath?: string): IpcBusInterfaces.IpcBusClient {
    return CreateIpcBusForProcess(ElectronUtils.GuessElectronProcessType(), busPath);
}