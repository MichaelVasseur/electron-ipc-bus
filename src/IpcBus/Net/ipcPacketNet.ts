import * as net from 'net';
// import * as util from 'util';
// import { EventEmitter } from 'events';
import { IpcNet } from './ipcNet';
import { IpcPacketBufferDecoder } from './ipcPacketBufferDecoder';

export class IpcPacketNet extends IpcNet {
  private _ipcPacketDecoders: Map<net.Socket, IpcPacketBufferDecoder>;

  constructor(options?: any) {
    super(options);

    this._ipcPacketDecoders = new Map<net.Socket, IpcPacketBufferDecoder>();
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
    let ipcPacketDecoders = new IpcPacketBufferDecoder();
    this._ipcPacketDecoders.set(socket, ipcPacketDecoders);

    ipcPacketDecoders.on('packet', (buffer: Buffer) => {
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
      this._ipcPacketDecoders.delete(socket);
    });
    socket.on('data', (buffer: Buffer) => {
      ipcPacketDecoders.handleData(buffer);
    });
  }
}
