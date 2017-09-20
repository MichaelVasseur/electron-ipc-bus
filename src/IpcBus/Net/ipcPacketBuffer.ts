import { Buffer } from 'buffer';

export const headerLength: number = 7;
const separator: number = '#'.charCodeAt(0);
// const arrayS: number = '['.charCodeAt(0);
// const arrayE: number = ']'.charCodeAt(0);
const objectObject: number = 'O'.charCodeAt(0);
const objectString: number = 's'.charCodeAt(0);
const objectBuffer: number = 'B'.charCodeAt(0);
const objectArray: number = 'A'.charCodeAt(0);
const objectBoolean: number = 'b'.charCodeAt(0);
const objectNumber: number = 'n'.charCodeAt(0);
const objectNotAvailable: number = 'x'.charCodeAt(0);

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

    isAvailable(): boolean {
        return this.type !== objectNotAvailable;
    }

    isArray(): boolean {
        return this.type === objectArray;
    }

    isObject(): boolean {
        return this.type === objectObject;
    }

    isString(): boolean {
        return this.type === objectString;
    }

    isBuffer(): boolean {
        return this.type === objectBuffer;
    }

    isNumber(): boolean {
        return this.type === objectNumber;
    }

    isBoolean(): boolean {
        return this.type === objectBoolean;
    }

    static setHeader(buffer: Buffer, offset: number, header: IpcPacketBufferHeader) {
        let incr = offset;
        buffer[incr++] = separator;
        buffer[incr++] = header.type;
        buffer.writeUInt32LE(header.size, incr);
        incr += 4;
        buffer[incr] = separator;
        // assert(incr === offset + headerLength - 1);
    }

    static getPacketHeader(buffers: Buffer[], offset: number): IpcPacketBufferHeader {
        let buffer = buffers[0];
        const offsetHeaderLength =  offset + headerLength;
        // Buffer is too short for containing a header
        if (buffer.length < offsetHeaderLength) {
            // No hope, there is only one buffer
            if (buffers.length === 1) {
                return new IpcPacketBufferHeader(objectNotAvailable, -1);
            }
            // Create a buffer buffers with the minium size
            buffer = Buffer.concat(buffers, offsetHeaderLength);
            // Still not enough !
            if (buffer.length < offsetHeaderLength) {
                return new IpcPacketBufferHeader(objectNotAvailable, -1);
            }
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

    static getHeader(buffer: Buffer, offset: number): IpcPacketBufferHeader {
        return IpcPacketBufferHeader.getPacketHeader([buffer], offset);
    }
}

export class IpcPacketBuffer extends IpcPacketBufferHeader {
    buffer: Buffer;

    constructor(type: number, size: number) {
        super(type, size);
    }

    static fromNumber(dataNumber: number): Buffer {
        let data = JSON.stringify(dataNumber);
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferHeader.setHeader(buffer, 0, new IpcPacketBufferHeader(objectNumber, len));
        buffer.write(data, headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromBoolean(dataBoolean: boolean): Buffer {
        let data = JSON.stringify(dataBoolean);
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferHeader.setHeader(buffer, 0, new IpcPacketBufferHeader(objectBoolean, len));
        buffer.write(data, headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromString(data: string, encoding?: string): Buffer {
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferHeader.setHeader(buffer, 0, new IpcPacketBufferHeader(objectString, len));
        buffer.write(data, headerLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferHeader.setHeader(buffer, 0, new IpcPacketBufferHeader(objectBuffer, len));
        data.copy(buffer, headerLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        let len = data.length + headerLength;
        let buffer = new Buffer(len);
        IpcPacketBufferHeader.setHeader(buffer, 0, new IpcPacketBufferHeader(objectObject, len));
        buffer.write(data, headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromArray(args: any[]): Buffer {
        let buffers: Buffer[] = [];
        let BufferLength = 0;
        args.forEach((arg) => {
            let buffer = IpcPacketBuffer.from(arg);
            BufferLength += buffer.length;
            buffers.push(buffer);
        });
        let len = BufferLength + headerLength;
        let bufferHeader = new Buffer(headerLength);
        IpcPacketBufferHeader.setHeader(bufferHeader, 0, new IpcPacketBufferHeader(objectArray, len));
        buffers.unshift(bufferHeader);
        return Buffer.concat(buffers, len);
    }

    static from(data: any): Buffer {
        let buffer: Buffer;
        if (Array.isArray(data)) {
            buffer = IpcPacketBuffer.fromArray(data);
        }
        else if (Buffer.isBuffer(data)) {
            buffer = IpcPacketBuffer.fromBuffer(data);
        }
        else {
            switch (typeof data) {
                case 'object':
                    buffer = IpcPacketBuffer.fromObject(data);
                    break;
                case 'string':
                    buffer = IpcPacketBuffer.fromString(data);
                    break;
                case 'number':
                    buffer = IpcPacketBuffer.fromNumber(data);
                    break;
                case 'boolean':
                    buffer = IpcPacketBuffer.fromBoolean(data);
                    break;
            }
        }
        return buffer;
    }

    static to(buffer: Buffer, offset?: number): any {
        return IpcPacketBuffer._to(new BufferReader(buffer, offset));
    }

    private static _to(bufferReader: BufferReader): any {
        let arg: any;
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        switch (header.type) {
            case objectArray: {
                arg = IpcPacketBuffer._toArray(bufferReader);
                break;
            }
            case objectObject: {
                arg = IpcPacketBuffer._toObject(bufferReader);
                break;
            }
            case objectString: {
                arg = IpcPacketBuffer._toString(bufferReader);
                break;
            }
            case objectBuffer: {
                arg = IpcPacketBuffer._toBuffer(bufferReader);
                break;
            }
            case objectNumber: {
                arg = IpcPacketBuffer._toNumber(bufferReader);
                break;
            }
            case objectBoolean: {
                arg = IpcPacketBuffer._toBoolean(bufferReader);
                break;
            }
        }
        return arg;
    }

    static toBoolean(buffer: Buffer, offset?: number): boolean {
        return IpcPacketBuffer._toBoolean(new BufferReader(buffer, offset));
    }

    private static _toBoolean(bufferReader: BufferReader): boolean {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isBoolean() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerLength, offset + header.size));
    }

    static toNumber(buffer: Buffer, offset?: number): number {
        return IpcPacketBuffer._toNumber(new BufferReader(buffer, offset));
    }

    private static _toNumber(bufferReader: BufferReader): number {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isNumber() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerLength, offset + header.size));
    }

    static toObject(buffer: Buffer, offset?: number): any {
        return IpcPacketBuffer._toObject(new BufferReader(buffer, offset));
    }

    private static _toObject(bufferReader: BufferReader): any {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isObject() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerLength, offset + header.size));
    }

    static toString(buffer: Buffer, offset?: number, encoding?: string): string {
        return IpcPacketBuffer._toString(new BufferReader(buffer, offset), encoding);
    }

    private static _toString(bufferReader: BufferReader, encoding?: string): string {
        encoding = encoding || 'utf8';
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isString() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.toString(encoding, offset + headerLength, offset + header.size);
    }

    static toBuffer(buffer: Buffer, offset?: number): Buffer {
        return IpcPacketBuffer._toBuffer(new BufferReader(buffer, offset));
    }

    private static _toBuffer(bufferReader: BufferReader): Buffer {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isBuffer() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.slice(offset + headerLength, offset + header.size);
    }

    static toArrayAt(index: number, buffer: Buffer, offset?: number): any {
        return IpcPacketBuffer._toArrayAt(index, new BufferReader(buffer, offset));
    }

    private static _toArrayAt(index: number, bufferReader: BufferReader): any {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray() === false) {
            return null;
        }
        bufferReader.offset += headerLength;
        while ((index > 0) && (bufferReader.offset < header.size)) {
            let headerArg = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
            bufferReader.offset += headerArg.size;
            --index;
        }
        let arg: any;
        if (index === 0) {
            arg = IpcPacketBuffer._to(bufferReader);
        }
        return arg;
    }

    static toArray(buffer: Buffer, offset?: number): any[] {
        return IpcPacketBuffer._toArray(new BufferReader(buffer, offset));
    }

    private static _toArray(bufferReader: BufferReader): any[] {
        let header = IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray() === false) {
            return null;
        }
        let args = [];
        bufferReader.offset += headerLength;
        while (bufferReader.offset < header.size) {
            let arg = IpcPacketBuffer._to(bufferReader);
            args.push(arg);
        }
        return args;
    }
}