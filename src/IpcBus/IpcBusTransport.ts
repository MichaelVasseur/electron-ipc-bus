import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

/** @internal */
export class IpcBusData {
    replyChannel?: string;
    resolve?: boolean;
    reject?: boolean;
    unsubscribeAll?: boolean;
}

/** @internal */
export abstract class IpcBusTransport {
    readonly ipcBusProcess: IpcBusInterfaces.IpcBusProcess;
    readonly ipcOptions: IpcBusUtils.IpcOptions;

    public _onEventReceived: Function;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        this.ipcBusProcess = ipcBusProcess;
        this.ipcOptions = ipcOptions;
    }

    abstract ipcConnect(timeoutDelay: number): Promise<string>;
    abstract ipcClose(): void;
    abstract ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void;
}

import { IpcBusTransportNode } from './IpcBusTransportNode';
import { IpcBusTransportRenderer } from './IpcBusTransportRenderer';
import * as ElectronUtils from './ElectronUtils';

/** @internal */
export function CreateIpcBusTransport(ipcOptions: IpcBusUtils.IpcOptions): IpcBusTransport {
    let processType = ElectronUtils.GuessElectronProcessType();
    IpcBusUtils.Logger.info(`CreateIpcBusForProcess process type = ${processType}, ipc options = ${ipcOptions}`);

    let ipcBusTransport: IpcBusTransport = null;
    switch (processType) {
        case 'renderer':
            ipcBusTransport = new IpcBusTransportRenderer({type: processType, pid: -1}, ipcOptions);
            break;
        case 'browser':
        case 'node':
            if (ipcOptions.isValid()) {
                ipcBusTransport = new IpcBusTransportNode({type: processType, pid: process.pid}, ipcOptions);
            }
            break;
    }
    return ipcBusTransport;
}
