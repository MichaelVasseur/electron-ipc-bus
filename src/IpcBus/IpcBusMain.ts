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
    connect(connectHandler: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect(() => {
            this._ipcBusRendererBridge.connect(() => {});
            connectHandler();
        });
    }
}

