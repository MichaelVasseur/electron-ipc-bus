import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

const separator: number = '#'.charCodeAt(0);
const headLength: number = 6;

export class IpcPacket extends EventEmitter {

    private _buf: Buffer;

    constructor() {
        super();
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
            return 0;
        }
        let len = buffer[offset + 4];
        for (let i = offset + 3; i > offset; --i) {
            len <<= 8;
            len += buffer[i];
        }
        return len;
    }

    static fromString(data: string): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setLength(buffer, len);
        buffer.write(data, headLength);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacket._setLength(buffer, len);
        data.copy(buffer, headLength, 0);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        return IpcPacket.fromString(data);
    }

    handleData(data: Buffer) {
        // assert(data instanceof Buffer, 'data should be a buffer');
        if (!this._buf) {
            this._buf = data;
        }
        else {
            let length = this._buf.length + data.length;
            this._buf = Buffer.concat([this._buf, data], length);
        }

        let offset = 0;
        while ((this._buf.length - offset) >= headLength) {
            let packetSize = IpcPacket._getLength(this._buf, offset);
            // if packet size error
            if (packetSize <= headLength) {
                this._buf = null;
                this.emit('error', new Error('Get invalid packet size'));
                return;
            }
            // if already get packet
            if ((this._buf.length - offset) >= packetSize) {
                packetSize -= headLength;
                offset += headLength;
                // if already get packet
                let packet = this._buf.slice(offset, offset + packetSize);
                // move the offset
                offset += packetSize;
                this.emit('packet', packet);
            }
            else {
                break;
            }
        }

        if (offset === 0) {
            // nothing to do.
        }
        else if (offset < this._buf.length) {
            this._buf = this._buf.slice(offset, this._buf.length);
        }
        else {
            this._buf = null;
        }
    }
}
