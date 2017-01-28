
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
//import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusBrokerImpl } from './IpcBusBrokerImpl';
import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusServiceImpl } from './IpcBusServiceImpl';
import { IpcBusService } from './IpcBusInterfaces';
import { IpcBusServiceProxyImpl } from './IpcBusServiceProxyImpl';
import { IpcBusServiceProxy } from './IpcBusInterfaces';

/** @internal */
export function _CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (ipcOptions.isValid()) {
        IpcBusUtils.Logger.info(`CreateIpcBusBroker ipc options = ${ipcOptions}`);
        ipcBusBroker = new IpcBusBrokerImpl(ipcOptions) as IpcBusBroker;
    }
    return ipcBusBroker;
}

import { IpcBusNodeClient } from './IpcBusNode';
import { IpcBusMainClient } from './IpcBusMain';
import { IpcBusRendererClient } from './IpcBusRenderer';
import * as ElectronUtils from './ElectronUtils';

// A single instance per process or webpage
let _ipcBusClient: IpcBusClient = null;

/** @internal */
function CreateIpcBusClientForProcess(processType: string, busPath?: string): IpcBusClient {
    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType}, ipc options = ${ipcOptions}`);

    if (_ipcBusClient == null) {
        switch (processType) {
            case 'renderer':
                _ipcBusClient = new IpcBusRendererClient() as IpcBusClient;
                break;

            case 'browser':
                if (ipcOptions.isValid()) {
                    _ipcBusClient = new IpcBusMainClient(ipcOptions) as IpcBusClient;
                }
                break;

            default:
                if (ipcOptions.isValid()) {
                    _ipcBusClient = new IpcBusNodeClient(ipcOptions) as IpcBusClient;
                }
                break;
        }
    }
    return _ipcBusClient;
}

/** @internal */
export function _CreateIpcBusClient(busPath?: string): IpcBusClient {
    return CreateIpcBusClientForProcess(ElectronUtils.GuessElectronProcessType(), busPath);
}

/** @internal */
export function _CreateIpcBusService(client: IpcBusClient, serviceName: string): IpcBusService {
    return new IpcBusServiceImpl(client, serviceName);
}

/** @internal */
export function _CreateIpcBusServiceProxy(client: IpcBusClient, serviceName: string): IpcBusServiceProxy {
    return new IpcBusServiceProxyImpl(client, serviceName);
}

/** @internal */
export function _ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable(enable);
}
