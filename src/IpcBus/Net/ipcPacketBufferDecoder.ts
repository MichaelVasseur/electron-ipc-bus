import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
// import { IpcPacketArgs } from './ipcPacketArgs';
// import * as net from 'net';

const headLength: number = 7;
const separator: number = '#'.charCodeAt(0);
// const arrayS: number = '['.charCodeAt(0);
// const arrayE: number = ']'.charCodeAt(0);
const objectO: number = 'O'.charCodeAt(0);
const objectS: number = 'S'.charCodeAt(0);
const objectB: number = 'B'.charCodeAt(0);
const objectA: number = 'A'.charCodeAt(0);


export class IpcPacketBufferHeader {
    type: number;
    size: number;

    constructor(type: number, size: number) {
        this.type = type;
        this.size = size;
    }

    isArray(): boolean {
        return this.type === objectA;
    }

    isObject(): boolean {
        return this.type === objectO;
    }

    isString(): boolean {
        return this.type === objectS;
    }

    isBuffer(): boolean {
        return this.type === objectB;
    }
}

export class IpcPacketBufferDecoder extends EventEmitter {
    private _buffers: Buffer[];
    private _totalLength: number;

    constructor() {
        super();
        this._totalLength = 0;
        this._buffers = [];
    }

    on(event: 'packet', handler: (buffer: Buffer) => void): this;
    on(event: 'packet[]', handler: (buffer: Buffer[]) => void): this;
    on(event: 'error', handler: (err: Error) => void): this;
    on(event: string, handler: Function): this {
        return super.on(event, handler);
    }

    static _setHeader(buffer: Buffer, offset: number, header: IpcPacketBufferHeader) {
        let incr = offset;
        buffer[incr++] = separator;
        buffer[incr++] = header.type;
        buffer.writeUInt32LE(header.size, incr);
        incr += 4;
        buffer[incr] = separator;
        // assert(incr === offset + headLength - 1);
    }

    static _getPacketHeader(buffers: Buffer[], offset: number): IpcPacketBufferHeader {
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
        return new IpcPacketBufferHeader(type, len);
    }

    static _getHeader(buffer: Buffer, offset: number): IpcPacketBufferHeader {
        return IpcPacketBufferDecoder._getPacketHeader([buffer], offset);
    }

    static fromString(data: string, encoding?: string): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectS, len));
        buffer.write(data, headLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectB, len));
        data.copy(buffer, headLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        let len = data.length + headLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectO, len));
        buffer.write(data, headLength, data.length, 'utf8');
        return buffer;
    }

    static fromArray(args: any[]): Buffer[] {
        let buffers: Buffer[] = [];
        args.forEach((arg) => {
            buffers.push(IpcPacketBufferDecoder.from(args));
        });
        return buffers;
    }

    static from(data: any): Buffer {
        if (Array.isArray(data)) {
            let buffers =  IpcPacketBufferDecoder.fromArray(data);
            let BufferLength = buffers.reduce(function(left: any, right: any) { return (left.length || left) + (right.length || right); }, 0);
            let len = BufferLength + headLength;
            let bufferHeader = new Buffer(headLength);
            IpcPacketBufferDecoder._setHeader(bufferHeader, 0, new IpcPacketBufferHeader(objectA, len));
            buffers.unshift(bufferHeader);
            return Buffer.concat(buffers, len);
        }
        switch (typeof data) {
            case 'object' :
                return IpcPacketBufferDecoder.fromObject(data);
            case 'string' :
                return IpcPacketBufferDecoder.fromString(data);
        }
        if (data instanceof Buffer) {
            return IpcPacketBufferDecoder.fromBuffer(data);
        }
        return null;
    }

    static to(buffer: Buffer): any {
        let header = IpcPacketBufferDecoder._getHeader(buffer, 0);
        if (header.isArray()) {
            let buffers =  IpcPacketBufferDecoder.fromArray(data);
            let BufferLength = buffers.reduce(function(left: any, right: any) { return (left.length || left) + (right.length || right); }, 0);
            let len = BufferLength + headLength;
            let bufferHeader = new Buffer(headLength);
            IpcPacketBufferDecoder._setHeader(bufferHeader, 0, { type: objectA, size: len });
            buffers.unshift(bufferHeader);
            return Buffer.concat(buffers, len);
        }
        else if (header.isObject()) {
            return IpcPacketBufferDecoder.toObject(buffer);
        }
        else if (header.isString()) {
            return IpcPacketBufferDecoder.toString(buffer);
        }
        else if (header.isBuffer()) {
            return IpcPacketBufferDecoder.toBuffer(buffer);
        }
        return null;
    }

    static fromArgs(...args: any[]): Buffer[] {
        return IpcPacketBufferDecoder.fromArray(args);
    }

    static toObject(buffer: Buffer): any {
        let header = IpcPacketBufferDecoder._getHeader(buffer, 0);
        if (header.isObject()) {
            return null;
        }
        return JSON.parse(buffer.toString('utf8', headLength, header.size));
    }

    static toString(buffer: Buffer, encoding?: string): string {
        let header = IpcPacketBufferDecoder._getHeader(buffer, 0);
        if (header.isString()) {
            return null;
        }
        return buffer.toString(encoding, headLength);
    }

    static toBuffer(buffer: Buffer): Buffer {
        let header = IpcPacketBufferDecoder._getHeader(buffer, 0);
        if (header.isBuffer()) {
            return null;
        }
        return buffer.slice(headLength);
    }

    static toArgs(buffer: Buffer): any[] {
        let header = IpcPacketBufferDecoder._getHeader(buffer, 0);
        if (header.type !== objectA) {
            return null;
        }
        let offset = headLength;
        let args: any[];
        while (false) {
            let header = IpcPacketBufferDecoder._getHeader(buffer, offset);
            args.push()
        }
        return args;
    }

    handleData(data: Buffer): void {
        // assert(data instanceof Buffer, 'data should be a buffer');
        this._totalLength += data.length;
        this._buffers.push(data);

        let packets: Buffer[] = [];

        let offset = 0;
        while (this._totalLength >= headLength) {
            let header = IpcPacketBufferDecoder._getPacketHeader(this._buffers, offset);
            // if packet size error
            if (!header) {
                this._buffers = [];
                this.emit('error', new Error('Get invalid packet size'));
                break;
            }
            let packetSize = header.size;
            let packet: Buffer;
            // if already get packet
            if (this._totalLength >= packetSize) {
                let currentBuffer = this._buffers[0];
                if (currentBuffer.length - offset >= packetSize) {
                    packet = currentBuffer.slice(offset, offset + packetSize);
                }
                else {
                    if (offset > 0) {
                        this._buffers[0] = currentBuffer = currentBuffer.slice(offset);
                        offset = 0;
                    }
                    packet = Buffer.concat(this._buffers, packetSize);
                    // Don't waste your time to clean buffers if there are all used !
                    if (this._totalLength > 0) {
                        while (currentBuffer && (currentBuffer.length <= packetSize)) {
                            packetSize -= currentBuffer.length;

                            this._buffers.shift();
                            currentBuffer = this._buffers[0];
                        }
                    }
                }
                packets.push(packet);
                this.emit('packet', packet);

                // Beware, take the original size here
                this._totalLength -= header.size;
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
        this.emit('packet[]', packets);
    }
}
