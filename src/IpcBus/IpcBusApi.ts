
// import * as IpcBusInterfaces from './IpcBusInterfaces';
import { IpcBusClient } from './IpcBusInterfaces';
import { IpcBusBroker } from './IpcBusInterfaces';
// export * from './IpcBusInterfaces';

import { IpcBusBrokerServer } from './IpcBusBroker';
import * as IpcBusUtils from './IpcBusUtils';

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
function CreateIpcBusForProcess(processType: string, busPath?: string): IpcBusClient {
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
export function _CreateIpcBus(busPath?: string): IpcBusClient {
    return CreateIpcBusForProcess(ElectronUtils.GuessElectronProcessType(), busPath);
}

/** @internal */
export function _ActivateIpcBusTrace(enable: boolean): void {
    IpcBusUtils.Logger.enable(enable);
}