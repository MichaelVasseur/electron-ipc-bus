
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusBridge } from './IpcBusInterfaces';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

import { IpcBusTransportNode } from './IpcBusTransportNode';
import { IpcBusTransportRenderer } from './IpcBusTransportRenderer';

import { IpcBusCommonClient } from './IpcBusClient';
import { IpcBusTransport} from './IpcBusTransport';

import * as ElectronUtils from './ElectronUtils';

/** @internal */
export function _CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBroker process type = ${processType}, ipc options = ${ipcOptions}`);
    switch (processType) {
        case 'browser':
        case 'node':
            if (ipcOptions.isValid()) {
                ipcBusBroker = new IpcBusBrokerImpl({ type: processType, pid: process.pid }, ipcOptions);
            }
            break;
        // not supported process
        case 'renderer':
        default:
            break;
    }
    return ipcBusBroker;
}

/** @internal */
export function _CreateIpcBusBridge(busPath?: string): IpcBusBridge {
    let ipcBusBridge: IpcBusBridge = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`_CreateIpcBusBridge process type = ${processType}, ipc options = ${ipcOptions}`);
    switch (processType) {
        case 'browser':
            if (ipcOptions.isValid()) {
                ipcBusBridge = new IpcBusBridgeImpl({ type: processType, pid: process.pid }, ipcOptions);
            }
            break;
        // not supported process
        case 'renderer':
        case 'node':
        default:
            break;
    }
    return ipcBusBridge;
}

function CreateIpcBusTransport(ipcOptions: IpcBusUtils.IpcOptions): IpcBusTransport {
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType}, ipc options = ${ipcOptions}`);

    let ipcBusTransport: IpcBusTransport = null;
    switch (processType) {
        case 'renderer':
            ipcBusTransport = new IpcBusTransportRenderer({ type: processType, pid: -1 }, ipcOptions);
            break;
        case 'browser':
        case 'node':
            if (ipcOptions.isValid()) {
                ipcBusTransport = new IpcBusTransportNode({ type: processType, pid: process.pid }, ipcOptions);
            }
            break;
    }
    return ipcBusTransport;
}

/** @internal */
export function _CreateIpcBusClient(busPath?: string): IpcBusClient {
    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    let ipcBusTransport: IpcBusTransport = CreateIpcBusTransport(ipcOptions);
    let ipcBusClient: IpcBusClient = null;
    if (ipcBusTransport != null) {
        ipcBusClient = new IpcBusCommonClient(ipcBusTransport) as IpcBusClient;
    }
    return ipcBusClient;
}
