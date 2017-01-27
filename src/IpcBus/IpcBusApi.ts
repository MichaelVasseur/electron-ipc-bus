
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
import { IpcBusBroker } from './IpcBusInterfaces';
import { IpcBusRequestResponse } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';

import { IpcBusBrokerServer } from './IpcBusBroker';
import * as IpcBusUtils from './IpcBusUtils';

import { IpcBusServiceImpl } from './IpcBusService';
import { IpcBusService } from './IpcBusInterfaces';

/** @internal */
export function _CreateIpcBusBroker(busPath?: string): IpcBusBroker {
    let ipcBusBroker: IpcBusBroker = null;

    let ipcOptions = IpcBusUtils.ExtractIpcOptions(busPath);
    if (ipcOptions.isValid()) {
        IpcBusUtils.Logger.info(`CreateIpcBusBroker ipc options = ${ipcOptions}`);
        ipcBusBroker = new IpcBusBrokerServer(ipcOptions) as IpcBusBroker;
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
export function _CreateIpcBusService(serviceName: string): IpcBusService {
    return new IpcBusServiceImpl(_ipcBusClient, serviceName);
}

/** @internal */
export function _IsIpcBusServiceAvailable(serviceName: string): Promise<boolean> {

    return new Promise<boolean>((resolve, reject) => {

        return _ipcBusClient
            .request(1000, '/electron-ipc-bus/ipc-service-available', { name : serviceName })
            .then(  (res: IpcBusRequestResponse) => resolve(<boolean>res.payload),
                    (res: IpcBusRequestResponse) => reject(res.payload));
    });
}

/** @internal */
export function _CallIpcBusService<T>(serviceName: string, callHandlerName: string, timeout: number, ...callArgs: any[]): Promise<T> {

    return new Promise<T>((resolve, reject) => {

        const serviceMsg = { callHandlerName: callHandlerName, callArgs: callArgs };
        _ipcBusClient
            .request(timeout, IpcBusServiceImpl.getServiceChannel(serviceName), serviceMsg)
            .then((res: IpcBusRequestResponse) => resolve(<T>res.payload), (res: IpcBusRequestResponse) => reject(res.err));
    });
}

/** @internal */
export function _ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable(enable);
}
