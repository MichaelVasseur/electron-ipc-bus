import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';
import {IpcBusNodeClient} from './IpcBusNode';
import {IpcBusBrokerBridge} from './IpcBusBrokerBridge';

// Implementation for Master process
/** @internal */
export class IpcBusMainClient extends IpcBusNodeClient {
    private _ipcBusBrokerBridge: IpcBusBrokerBridge;

    constructor(ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcOptions);
        this._ipcBusBrokerBridge = new IpcBusBrokerBridge(ipcOptions);
        this._peerName = 'Master';
    }

    // Set API
    connect(callback: IpcBusInterfaces.IpcBusConnectHandler) {
        super.connect((eventName: string, conn: any) => {
            this._ipcBusBrokerBridge.connect((eventName: string, conn: any) => {});
            callback(eventName, conn);
        });
    }
}

