import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
// import { IpcPacketArgs } from './ipcPacketArgs';
// import * as net from 'net';

const headerLength: number = 7;
const separator: number = '#'.charCodeAt(0);
// const arrayS: number = '['.charCodeAt(0);
// const arrayE: number = ']'.charCodeAt(0);
const objectO: number = 'O'.charCodeAt(0);
const objectS: number = 'S'.charCodeAt(0);
const objectB: number = 'B'.charCodeAt(0);
const objectA: number = 'A'.charCodeAt(0);

class BufferReader {
    offset: number;
    buffer: Buffer;

    constructor(buffer: Buffer, offset?: number) {
        this.buffer = buffer;
        this.offset = (offset == null) ? 0 : offset;
    }
}

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
        // assert(incr === offset + headerLength - 1);
    }

    static _getPacketHeader(buffers: Buffer[], offset: number): IpcPacketBufferHeader {
        let buffer = buffers[0];
        if (offset + buffer.length < headerLength) {
            buffer = Buffer.concat(buffers, offset + headerLength);
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
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectS, len));
        buffer.write(data, headerLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectB, len));
        data.copy(buffer, headerLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferDecoder._setHeader(buffer, 0, new IpcPacketBufferHeader(objectO, len));
        buffer.write(data, headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromArray(args: any[]): Buffer {
        let buffers: Buffer[] = [];
        let BufferLength = 0;
        args.forEach((arg) => {
            let buffer = IpcPacketBufferDecoder.from(arg);
            BufferLength += buffer.length;
            buffers.push(buffer);
        });
        let len = BufferLength + headerLength;
        let bufferHeader = new Buffer(headerLength);
        IpcPacketBufferDecoder._setHeader(bufferHeader, 0, new IpcPacketBufferHeader(objectA, len));
        buffers.unshift(bufferHeader);
        return Buffer.concat(buffers, len);
    }

    static from(data: any): Buffer {
        if (Array.isArray(data)) {
            return IpcPacketBufferDecoder.fromArray(data);
        }
        switch (typeof data) {
            case 'object' :
                return IpcPacketBufferDecoder.fromObject(data);
            case 'string' :
                return IpcPacketBufferDecoder.fromString(data);
        }
        if (Buffer.isBuffer(data)) {
            return IpcPacketBufferDecoder.fromBuffer(data);
        }
        return null;
    }

    static to(buffer: Buffer, offset?: number): any {
        return IpcPacketBufferDecoder._to(new BufferReader(buffer, offset));
    }

    private static _to(bufferReader: BufferReader): any {
        let arg: any;
        let header = IpcPacketBufferDecoder._getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray()) {
            arg = IpcPacketBufferDecoder._toArray(bufferReader);
        }
        else if (header.isObject()) {
            arg = IpcPacketBufferDecoder._toObject(bufferReader);
        }
        else if (header.isString()) {
            arg = IpcPacketBufferDecoder._toString(bufferReader);
        }
        else if (header.isBuffer()) {
            arg = IpcPacketBufferDecoder._toBuffer(bufferReader);
        }
        return arg;
    }

    static toObject(buffer: Buffer, offset?: number): any {
        return IpcPacketBufferDecoder._toObject(new BufferReader(buffer, offset));
    }

    private static _toObject(bufferReader: BufferReader): any {
        let header = IpcPacketBufferDecoder._getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isObject() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerLength, offset + header.size));
    }

    static toString(buffer: Buffer, offset?: number, encoding?: string): string {
        return IpcPacketBufferDecoder._toString(new BufferReader(buffer, offset), encoding);
    }

    private static _toString(bufferReader: BufferReader, encoding?: string): string {
        encoding = encoding || 'utf8';
        let header = IpcPacketBufferDecoder._getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isString() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.toString(encoding, offset + headerLength, offset + header.size);
    }

    static toBuffer(buffer: Buffer, offset?: number): Buffer {
        return IpcPacketBufferDecoder._toBuffer(new BufferReader(buffer, offset));
    }

    private static _toBuffer(bufferReader: BufferReader): Buffer {
        let header = IpcPacketBufferDecoder._getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isBuffer() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.slice(offset + headerLength, offset + header.size);
    }

    static toArray(buffer: Buffer, offset?: number): any[] {
        return IpcPacketBufferDecoder._toArray(new BufferReader(buffer, offset));
    }

    private static _toArray(bufferReader: BufferReader): any[] {
        let header = IpcPacketBufferDecoder._getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray() === false) {
            return null;
        }
        let args = [];
        bufferReader.offset += headerLength;
        while (bufferReader.offset < header.size) {
            let arg = IpcPacketBufferDecoder._to(bufferReader);
            args.push(arg);
        }
        return args;
    }

    // static toArgs(buffer: Buffer, offset?: number): any[] {
    //     if (offset == null) {
    //         offset = 0;
    //     }
    //     let header = IpcPacketBufferDecoder._getHeader(buffer, offset);
    //     if (header.type !== objectA) {
    //         return null;
    //     }
    //     offset += headerLength;
    //     let args: any[];
    //     while (false) {
    //         let header = IpcPacketBufferDecoder._getHeader(buffer, offset);
    //         args.push()
    //     }
    //     return args;
    // }

    handleData(data: Buffer): void {
        // assert(data instanceof Buffer, 'data should be a buffer');
        this._totalLength += data.length;
        this._buffers.push(data);

        let packets: Buffer[] = [];

        let offset = 0;
        while (this._totalLength >= headerLength) {
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
