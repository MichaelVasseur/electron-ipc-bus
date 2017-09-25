import * as net from 'net';
// import * as util from 'util';
// import { EventEmitter } from 'events';
import { IpcNet } from './ipcNet';
import { IpcPacketBufferDecoder } from './ipcPacketBufferDecoder';
import { IpcPacketBuffer } from './ipcPacketBuffer';

export class IpcPacketNet extends IpcNet {
  constructor(options?: any) {
    super(options);
  }

  //   on(event: 'packet', handler: (buffer: IpcPacketBuffer, socket: net.Socket, server?: net.Server) => void): this;
  //   on(event: string, handler: Function): this {
  //     return super.on(event, handler);
  //   }

  protected _parseStream(socket: net.Socket, server?: net.Server) {
    let ipcPacketDecoder = new IpcPacketBufferDecoder();
    ipcPacketDecoder.on('packet', (buffer: IpcPacketBuffer) => {
      this.emit('packet', buffer, socket, server);
    });

    socket.on('close', (had_error: any) => {
      socket.removeAllListeners('data');
      ipcPacketDecoder = null;
    });
    socket.on('data', (buffer: Buffer) => {
      ipcPacketDecoder.handleData(buffer);
    });
  }

}
