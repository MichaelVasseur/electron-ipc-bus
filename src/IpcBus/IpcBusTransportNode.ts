import { Ipc as BaseIpc } from './Net/ipc';

import * as IpcBusUtils from './IpcBusUtils';
import * as IpcBusInterfaces from './IpcBusInterfaces';

import { IpcBusTransport, IpcBusData } from './IpcBusTransport';
import { IpcPacket } from './Net/ipcPacket';

// Implementation for Node process
/** @internal */
export class IpcBusTransportNode extends IpcBusTransport {
    protected _baseIpc: BaseIpc;
    protected _busConn: any;
    private _promiseConnected: Promise<string>;

    constructor(ipcBusProcess: IpcBusInterfaces.IpcBusProcess, ipcOptions: IpcBusUtils.IpcOptions) {
        super(ipcBusProcess, ipcOptions);
    }

    protected _onClose() {
        this._reset();
    }

    private _reset() {
        this._promiseConnected = null;
        if (this._busConn) {
            this._busConn.end();
            this._busConn = null;
        }
        if (this._baseIpc) {
            this._baseIpc.removeAllListeners();
            this._baseIpc = null;
        }
    }

    /// IpcBusTransport API
    ipcConnect(timeoutDelay: number, peerName?: string): Promise<string> {
        // Store in a local variable, in case it is set to null (paranoid code as it is asynchronous!)
        let p = this._promiseConnected;
        if (!p) {
            p = this._promiseConnected = new Promise<string>((resolve, reject) => {
                if (peerName == null) {
                    peerName = `${this._ipcBusPeer.process.type}_${this._ipcBusPeer.process.pid}`;
                }
                this._ipcBusPeer.name = peerName;
                let timer: NodeJS.Timer;
                // Below zero = infinite
                if (timeoutDelay >= 0) {
                    timer = setTimeout(() => {
                        this._reset();
                        reject('timeout');
                    }, timeoutDelay);
                }
                this._baseIpc = new BaseIpc();
                this._baseIpc.on('connect', (conn: any) => {
                    this._busConn = conn;
                    if (this._baseIpc) {
                        clearTimeout(timer);
                        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CONNECT, {}, '');
                        resolve('connected');
                    }
                    else {
                        this._reset();
                    }
                });
                this._baseIpc.on('data', (buffer: Buffer) => {
                    let data = JSON.parse(buffer.toString());
                    if (data && (data.type === 'cmd')) {
                        this._onEventReceived(data.name, data.args[0], data.args[1], data.args[2]);
                    }
                });
                this._baseIpc.on('close', (conn: any) => {
                    this._onClose();
                    reject('server close');
                });
                this._baseIpc.connect(this.ipcOptions.port, this.ipcOptions.host);
            });
        }
        return p;
    }

    ipcClose() {
        this.ipcPushCommand(IpcBusUtils.IPC_BUS_COMMAND_CLOSE, {}, '');
        this._reset();
    }

    ipcPushCommand(command: string, ipcBusData: IpcBusData, channel: string, args?: any[]): void {
        ipcBusData.peerId = this._peerId;
        this._ipcPushCommand(command, ipcBusData, { channel: channel, sender: this.peer }, args);
    }

    protected _ipcPushCommand(command: string, ipcBusData: IpcBusData, ipcBusEvent: IpcBusInterfaces.IpcBusEvent, args?: any[]): void {
        if (this._busConn) {
            if (args) {
                const cmd = {type: 'cmd', name: command, args: [ipcBusData, ipcBusEvent, args]};
                let buffer = IpcPacket.fromObject(cmd);
                this._busConn.write(buffer);
            }
            else {
                const cmd = {type: 'cmd', name: command, args: [ipcBusData, ipcBusEvent]};
                let buffer = IpcPacket.fromObject(cmd);
                this._busConn.write(buffer);
            }
            // if (args) {
            //     BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, args, this._busConn);
            // }
            // else {
            //     BaseIpc.Cmd.exec(command, ipcBusData, ipcBusEvent, this._busConn);
            // }
        }
    }
}
