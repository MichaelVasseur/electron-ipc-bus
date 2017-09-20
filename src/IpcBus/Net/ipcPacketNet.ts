import * as net from 'net';
// import * as util from 'util';
// import { EventEmitter } from 'events';
import { IpcNet } from './ipcNet';
import { IpcPacket } from './ipcPacket';

export class IpcPacketNet extends IpcNet {
  private _ipcPackets: Map<net.Socket, IpcPacket>;

  constructor(options?: any) {
    super(options);

    this._ipcPackets = new Map<net.Socket, IpcPacket>();
  }

//   on(event: 'connect', handler: (socket: net.Socket) => void): this;
//   on(event: 'reconnect', handler: (socket: net.Socket) => void): this;
//   on(event: 'connection', handler: (socket: net.Socket, server: net.Server) => void): this;
//   on(event: 'listening', handler: (server: net.Server) => void): this;
//   on(event: 'close', handler: (err: Error, socket: net.Socket, server?: net.Server) => void): this;
//   on(event: 'error', handler: (err: Error) => void): this;
//   on(event: 'warn', handler: (err: Error) => void): this;
//   on(event: 'packet', handler: (buffer: Buffer, socket: net.Socket, server?: net.Server) => void): this;
//   on(event: string, handler: Function): this {
//     return super.on(event, handler);
//   }

  protected _parseStream(socket: net.Socket, server?: net.Server) {
    let ipcPacket = new IpcPacket();
    this._ipcPackets.set(socket, ipcPacket);

    ipcPacket.on('packet', (buffer: Buffer) => {
      if (server) {
        this.emit('packet', buffer, socket, server);
        // console.log('data-server', util.inspect(JSON.parse(buffer.toString())));
      }
      else {
        this.emit('packet', buffer, socket);
        // console.log('data', util.inspect(JSON.parse(buffer.toString())));
      }
    });
    socket.on('close', (had_error: any) => {
      this._ipcPackets.delete(socket);
    });
    socket.on('data', (buffer: Buffer) => {
      ipcPacket.handleData(buffer);
    });
  }
}
