import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

const separator: number = '#'.charCodeAt(0);
const headLength: number = 6;

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

    private static _setLength(buffer: Buffer, len: number) {
        buffer[0] = separator;
        for (let i = 1; (i < 5) && len; ++i) {
            buffer[i] = len & 0xFF;
            len >>= 8;
        }
        buffer[5] = separator;
    }

    private static _getLength(buffer: Buffer, offset: number): number {
        if ((buffer[offset] !== separator) || (buffer[offset + 5] !== separator)) {
            return -1;
        }
        let len = buffer[offset + 4];
        for (let i = offset + 3; i > offset; --i) {
            len <<= 8;
            len += buffer[i];
        }
        return len;
    }

    static fromString(data: string, encoding?: string): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setLength(buffer, len);
        buffer.write(data, headLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setLength(buffer, len);
        data.copy(buffer, headLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        return IpcPacket.fromString(data, 'utf8');
    }

    static toObject(buffer: Buffer): any {
        let packetSize = IpcPacket._getLength(buffer, 0);
        return JSON.parse(buffer.toString('utf8', headLength, packetSize));
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
            let packetSize = IpcPacket._getLength(this._buffers[0], offset);
            // if packet size error
            if (packetSize <= headLength) {
                this._buffers = [];
                this.emit('error', new Error('Get invalid packet size'));
                return;
            }
            // if already get packet
            if ((this._totalLength - offset) >= packetSize) {
                let currentBuffer = this._buffers[0];
                if (currentBuffer.length - offset >= packetSize) {
                    packets.push(currentBuffer.slice(offset, offset + packetSize));
                    offset += packetSize;
                }
                else {
                    if (offset > 0) {
                        currentBuffer.slice(offset);
                    }
                    packets.push(Buffer.concat(this._buffers, packetSize));
                    while (currentBuffer && (currentBuffer.length <= packetSize)) {
                        this._totalLength -= currentBuffer.length;
                        packetSize -= currentBuffer.length;

                        this._buffers.shift();
                        currentBuffer = this._buffers[0];
                    }
                    if (this._buffers.length === 0) {
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
