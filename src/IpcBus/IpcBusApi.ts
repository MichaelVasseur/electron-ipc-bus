
import * as IpcBusInterfaces from "./IpcBusInterfaces";
export * from "./IpcBusInterfaces";

import { IpcBusBrokerClient } from "./IpcBusBroker";
import * as IpcBusUtils from "./IpcBusUtils";

export function CreateIpcBusBroker(busPath?: string): IpcBusInterfaces.IpcBusBroker {
    if (busPath == null) {
        busPath = IpcBusUtils.GetCmdLineArgValue("bus-path");
    }
    else {
        busPath = busPath;
    }
    console.log("CreateIpcBusBroker busPath = " + busPath);

    let ipcBusBroker: IpcBusInterfaces.IpcBusBroker = null;
    if ((busPath != null) && (busPath.length > 0)) {
        ipcBusBroker = new IpcBusBrokerClient(busPath) as IpcBusInterfaces.IpcBusBroker;
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
    if (busPath == null) {
        busPath = IpcBusUtils.GetCmdLineArgValue("bus-path");
    }
    else {
        busPath = busPath;
    }
    console.log("CreateIpcBusForProcess process type = " + processType + ", busPath = " + busPath);

    if (_ipcBusClient == null) {
        switch (processType) {
            case "renderer":
                _ipcBusClient = new IpcBusRendererClient() as IpcBusInterfaces.IpcBusClient;
                break;

            case "browser":
                if ((busPath != null) && (busPath.length > 0)) {
                    _ipcBusClient = new IpcBusMainClient(busPath) as IpcBusInterfaces.IpcBusClient;
                }
                break;

            case "node":
            default:
                if ((busPath != null) && (busPath.length > 0)) {
                    _ipcBusClient = new IpcBusNodeClient(busPath) as IpcBusInterfaces.IpcBusClient;
                }
                break;
        }
    }
    return _ipcBusClient;
}

export function CreateIpcBus(busPath?: string): IpcBusInterfaces.IpcBusClient {
    return CreateIpcBusForProcess(ElectronUtils.GuessElectronProcessType(), busPath);
}