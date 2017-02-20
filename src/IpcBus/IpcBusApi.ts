
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusBridge } from './IpcBusInterfaces';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusService } from './IpcBusInterfaces';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';
import { IpcBusServiceProxy } from './IpcBusInterfaces';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

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

import { IpcBusCommonClient } from './IpcBusClient';
import {CreateIpcBusTransport, IpcBusTransport} from './IpcBusTransport';

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

/** @internal */
export function _CreateIpcBusService(client: IpcBusClient, serviceName: string, serviceImpl: any = undefined): IpcBusService {
    return new IpcBusServiceImpl(client, serviceName, serviceImpl);
}

/** @internal */
export function _CreateIpcBusServiceProxy(client: IpcBusClient, serviceName: string, callTimeout: number = 1000): IpcBusServiceProxy {
    return new IpcBusServiceProxyImpl(client, serviceName, callTimeout);
}

/** @internal */
export function _ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable = enable;
}
