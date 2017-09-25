import * as net from 'net';
// import * as util from 'util';
// import { EventEmitter } from 'events';
import { IpcNet } from './ipcNet';
import { IpcPacketBufferDecoder } from './ipcPacketBufferDecoder';
import { IpcPacketBuffer } from './ipcPacketBuffer';

class IpcPacketConsolidator {
  expectedArgs: number;
  packetArgs: IpcPacketBuffer[];
  ipcPacketDecoder: IpcPacketBufferDecoder;

  constructor(ipcPacketNet: IpcPacketNet, socket: net.Socket, server?: net.Server) {
    this.ipcPacketDecoder = new IpcPacketBufferDecoder();
    this.packetArgs = [];
    this.expectedArgs = 0;

    this.ipcPacketDecoder.on('packet', (buffer: IpcPacketBuffer) => {
      if (this.packetArgs.length > 0) {
        this.packetArgs.push(buffer);
        if (buffer.isArray()) {
          this.expectedArgs += buffer.argsLen;
        }
        if (--this.expectedArgs === 0) {
          let buffersLen = 0;
          let buffers = this.packetArgs.map(packet => {
            buffersLen += packet.buffer.length;
            return packet.buffer;
          });
          let packet = IpcPacketBuffer.fromPacketBuffer(this.packetArgs[0], Buffer.concat(buffers, buffersLen));
          this.packetArgs = [];
          ipcPacketNet.emit('packet', packet, socket, server);
        }
        return;
      }
      if (buffer.isArray()) {
        this.packetArgs.push(buffer);
        this.expectedArgs = buffer.argsLen;
        return;
      }
      ipcPacketNet.emit('packet', buffer, socket, server);
    });

    socket.on('close', (had_error: any) => {
      socket.removeAllListeners('data');
      this.ipcPacketDecoder.removeAllListeners();
      this.ipcPacketDecoder = null;
    });
    socket.on('data', (buffer: Buffer) => {
      this.ipcPacketDecoder.handleData(buffer);
    });
  }
}

export class IpcPacketNet extends IpcNet {
  constructor(options?: any) {
    super(options);
  }

  //   on(event: 'packet', handler: (buffer: IpcPacketBuffer, socket: net.Socket, server?: net.Server) => void): this;
  //   on(event: string, handler: Function): this {
  //     return super.on(event, handler);
  //   }

  protected _parseStream(socket: net.Socket, server?: net.Server) {
    let ipcPacketConsolidator = new IpcPacketConsolidator(this, socket, server);
    socket.on('close', (had_error: any) => {
      ipcPacketConsolidator = null;
    });
  }
}
