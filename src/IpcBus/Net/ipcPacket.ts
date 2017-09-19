import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
// import * as net from 'net';

const separator: number = '#'.charCodeAt(0);
// const arrayS: number = '['.charCodeAt(0);
// const arrayE: number = ']'.charCodeAt(0);
const objectO: number = 'O'.charCodeAt(0);
const objectS: number = 'S'.charCodeAt(0);
const objectB: number = 'B'.charCodeAt(0);
const headLength: number = 7;

interface IpcPacketHeader {
    type: number;
    size: number;
}

export class IpcPacket extends EventEmitter {

    private _buffers: Buffer[];
    private _totalLength: number;

    constructor() {
        super();
        this._totalLength = 0;
        this._buffers = [];
    }

    on(event: 'packet', handler: (buffer: Buffer) => void): this;
    on(event: 'error', handler: (err: Error) => void): this;
    on(event: string, handler: Function): this {
        return super.on(event, handler);
    }

    private static _setHeader(buffer: Buffer, offset: number, ipcPacketHeader: IpcPacketHeader) {
        let incr = offset;
        buffer[incr++] = separator;
        buffer[incr++] = ipcPacketHeader.type;
        buffer.writeUInt32LE(ipcPacketHeader.size, incr);
        incr += 4;
        buffer[incr] = separator;
        // assert(incr === offset + headLength - 1);
    }

    private static _getPacketHeader(buffers: Buffer[], offset: number): IpcPacketHeader {
        let buffer = buffers[0];
        if (offset + buffer.length < headLength) {
            buffer = Buffer.concat(buffers, offset + headLength);
        }
        let incr = offset;
        if (buffer[incr++] !== separator) {
            return null;
        }
        let type = buffer[incr++];
        let len = buffer.readUInt32LE(incr);
        incr += 4;
        if (buffer[incr] !== separator) {
            return null;
        }
        return {type: type, size: len};
    }

    private static _getHeader(buffer: Buffer, offset: number): IpcPacketHeader {
        return IpcPacket._getPacketHeader([buffer], offset);
    }

    static fromString(data: string, encoding?: string): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setHeader(buffer, 0, { type: objectS, size: len });
        buffer.write(data, headLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setHeader(buffer, 0, { type: objectB, size: len });
        data.copy(buffer, headLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setHeader(buffer, 0, { type: objectO, size: len });
        buffer.write(data, headLength, data.length, 'utf8');
        return buffer;
    }

    static toObject(buffer: Buffer): any {
        let ipcPacketHeader = IpcPacket._getHeader(buffer, 0);
        if (ipcPacketHeader.type !== objectO) {
            return null;
        }
        return JSON.parse(buffer.toString('utf8', headLength, ipcPacketHeader.size));
    }

    handleData(data: Buffer) {
        // assert(data instanceof Buffer, 'data should be a buffer');
        this._totalLength += data.length;
        this._buffers.push(data);

        let packets: Buffer[] = [];

        let offset = 0;
        while (this._totalLength >= headLength) {
            let ipcPacketHeader = IpcPacket._getPacketHeader(this._buffers, offset);
            // if packet size error
            if (!ipcPacketHeader) {
                this._buffers = [];
                this.emit('error', new Error('Get invalid packet size'));
                break;
            }
            let packetSize = ipcPacketHeader.size;
            // if already get packet
            if (this._totalLength >= packetSize) {
                // Revaluate _totalLength before packetSize is modified
                this._totalLength -= packetSize;
                let currentBuffer = this._buffers[0];
                if (currentBuffer.length - offset >= packetSize) {
                    packets.push(currentBuffer.slice(offset, offset + packetSize));
                }
                else {
                    if (offset > 0) {
                        this._buffers[0] = currentBuffer = currentBuffer.slice(offset);
                        offset = 0;
                    }
                    packets.push(Buffer.concat(this._buffers, packetSize));
                    if (this._totalLength > 0) {
                        while (currentBuffer && (currentBuffer.length <= packetSize)) {
                            packetSize -= currentBuffer.length;

                            this._buffers.shift();
                            currentBuffer = this._buffers[0];
                        }
                    }
                }
                offset += packetSize;
            }
            else {
                break;
            }
        }
        if ((this._buffers.length === 0) || (this._totalLength === 0)) {
            this._totalLength = 0;
            this._buffers = [];
        }
        else if (offset > 0) {
            this._buffers[0] = this._buffers[0].slice(offset);
        }
        packets.forEach((packet) => {
            this.emit('packet', packet);
        });
    }
}
