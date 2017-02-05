
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
// import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusService } from './IpcBusInterfaces';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';
import { IpcBusServiceProxy } from './IpcBusInterfaces';

import { IpcBusBrokerNode } from './IpcBusBrokerNode';
import { IpcBusBrokerRenderer } from './IpcBusBrokerRenderer';

/** @internal */
export function _CreateIpcBusBrokerNode(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (ipcOptions.isValid()) {
        IpcBusUtils.Logger.info(`_CreateIpcBusBrokerNode ipc options = ${ipcOptions}`);
        ipcBusBroker = new IpcBusBrokerNode(ipcOptions) as IpcBusBroker;
    }
    return ipcBusBroker;
}

/** @internal */
export function _CreateIpcBusBrokerRenderer(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (ipcOptions.isValid()) {
        IpcBusUtils.Logger.info(`_CreateIpcBusBrokerRenderer ipc options = ${ipcOptions}`);
        ipcBusBroker = new IpcBusBrokerRenderer(ipcOptions) as IpcBusBroker;
    }
    return ipcBusBroker;
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
    IpcBusUtils.Logger.enable(enable);
}
