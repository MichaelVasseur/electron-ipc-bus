import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

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
        let len = ipcPacketHeader.size;
        for (let i = 0; i < 4 && len; ++i) {
            buffer[incr++] = len & 0xFF;
            len >>= 8;
        }
        buffer[offset + headLength - 1] = separator;
        // assert(incr === offset + headLength - 1);
    }

    private static _getHeader(buffer: Buffer, offset: number): IpcPacketHeader {
        let incr = offset + headLength;
        if (buffer[--incr] !== separator) {
            return null;
        }
        let len = 0;
        for (let i = 0; i < 4; ++i) {
            len <<= 8;
            len += buffer[--incr];
        }
        let type = buffer[--incr];
        if (buffer[--incr] !== separator) {
            return null;
        }
        return {type: type, size: len};
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
        let buffer: Buffer;
        if (this._totalLength < headLength) {
            buffer = this._buffers.pop();
            if (buffer) {
                let length = buffer.length + data.length;
                buffer = Buffer.concat([buffer, data], length);
            }
            else {
                buffer = data;
            }
        }
        else {
            buffer = data;
        }
        this._totalLength += data.length;
        this._buffers.push(buffer);

        let packets: Buffer[] = [];

        let offset = 0;
        while ((this._totalLength - offset) >= headLength) {
            let ipcPacketHeader = IpcPacket._getHeader(this._buffers[0], offset);
            // if packet size error
            if (!ipcPacketHeader) {
                this._buffers = [];
                this.emit('error', new Error('Get invalid packet size'));
                return;
            }
            let packetSize = ipcPacketHeader.size;
            // if already get packet
            if ((this._totalLength - offset) >= packetSize) {
                let currentBuffer = this._buffers[0];
                if (currentBuffer.length - offset >= packetSize) {
                    packets.push(currentBuffer.slice(offset, offset + packetSize));
                    offset += packetSize;
                }
                else {
                    if (offset > 0) {
                        this._totalLength -= offset;
                        this._buffers[0] = currentBuffer.slice(offset);
                    }
                    packets.push(Buffer.concat(this._buffers, packetSize));
                    while (currentBuffer && (currentBuffer.length <= packetSize)) {
                        this._totalLength -= currentBuffer.length;
                        packetSize -= currentBuffer.length;

                        this._buffers.shift();
                        currentBuffer = this._buffers[0];
                    }
                    if (this._buffers.length === 0) {
                        // assert(this._totalLength === 0);
                        break;
                    }
                    offset = packetSize;
                }
            }
            else {
                break;
            }
        }
        if (offset === 0) {
            // nothing to do.
        }
        else if (offset < this._totalLength) {
            this._totalLength -= offset;
            this._buffers[0] = this._buffers[0].slice(offset);
        }
        else {
            this._totalLength = 0;
            this._buffers = [];
        }
        packets.forEach((packet) => {
            this.emit('packet', packet);
        });
    }
}
