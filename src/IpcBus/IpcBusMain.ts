import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import {IpcBusNodeEventEmitter} from './IpcBusNode';
import {IpcBusRendererBridge} from './IpcBusRendererBridge';
import {IpcBusCommonClient} from './IpcBusClient';


export class IpcBusMainClient extends IpcBusCommonClient {
    private _ipcBusRendererBridge: IpcBusRendererBridge;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super('Master', new IpcBusNodeEventEmitter(ipcOptions));
        this._ipcBusRendererBridge = new IpcBusRendererBridge(ipcOptions);
    }

    // Set API
    connect(callback: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect((eventName: string, conn: any) => {
            this._ipcBusRendererBridge.connect((eventName: string, conn: any) => {});
            callback(eventName, conn);
        });
    }
}

