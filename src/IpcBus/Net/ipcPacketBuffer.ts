import { Buffer } from 'buffer';
import * as headerHelpers from './ipcPacketBufferHeader';

class BufferReader {
    offset: number;
    buffer: Buffer;

    constructor(buffer: Buffer, offset?: number) {
        this.buffer = buffer;
        this.offset = (offset == null) ? 0 : offset;
    }
}

export class IpcPacketBuffer extends headerHelpers.IpcPacketBufferHeader {
    buffer: Buffer;

    constructor(type: number, size: number) {
        super(type, size);
    }

    static fromNumber(dataNumber: number): Buffer {
        let data = JSON.stringify(dataNumber);
        let len = data.length + headerHelpers.headerLength;
        let buffer = new Buffer(len);
        headerHelpers.IpcPacketBufferHeader.setHeader(buffer, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectNumber, len));
        buffer.write(data, headerHelpers.headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromBoolean(dataBoolean: boolean): Buffer {
        let data = JSON.stringify(dataBoolean);
        let len = data.length + headerHelpers.headerLength;
        let buffer = new Buffer(len);
        headerHelpers.IpcPacketBufferHeader.setHeader(buffer, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectBoolean, len));
        buffer.write(data, headerHelpers.headerLength, data.length, 'utf8');
        return buffer;
    }

    static fromString(data: string, encoding?: string): Buffer {
        let len = data.length + headerHelpers.headerLength;
        let buffer = new Buffer(len);
        headerHelpers.IpcPacketBufferHeader.setHeader(buffer, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectString, len));
        buffer.write(data, headerHelpers.headerLength, data.length, encoding);
        return buffer;
    }

    static fromBuffer(data: Buffer): Buffer {
        let len = data.length + headerHelpers.headerLength;
        let buffer = new Buffer(len);
        headerHelpers.IpcPacketBufferHeader.setHeader(buffer, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectBuffer, len));
        data.copy(buffer, headerHelpers.headerLength);
        return buffer;
    }

    static fromObject(dataObject: Object): Buffer {
        let data = JSON.stringify(dataObject);
        let len = data.length + headerHelpers.headerLength;
        let buffer = new Buffer(len);
        headerHelpers.IpcPacketBufferHeader.setHeader(buffer, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectObject, len));
        buffer.write(data, headerHelpers.headerLength, data.length, 'utf8');
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
        let len = BufferLength + headerHelpers.headerLength;
        let bufferHeader = new Buffer(headerHelpers.headerLength);
        headerHelpers.IpcPacketBufferHeader.setHeader(bufferHeader, 0, new headerHelpers.IpcPacketBufferHeader(headerHelpers.objectArray, len));
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
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        switch (header.type) {
            case headerHelpers.objectArray: {
                arg = IpcPacketBuffer._toArray(bufferReader);
                break;
            }
            case headerHelpers.objectObject: {
                arg = IpcPacketBuffer._toObject(bufferReader);
                break;
            }
            case headerHelpers.objectString: {
                arg = IpcPacketBuffer._toString(bufferReader);
                break;
            }
            case headerHelpers.objectBuffer: {
                arg = IpcPacketBuffer._toBuffer(bufferReader);
                break;
            }
            case headerHelpers.objectNumber: {
                arg = IpcPacketBuffer._toNumber(bufferReader);
                break;
            }
            case headerHelpers.objectBoolean: {
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
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isBoolean() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerHelpers.headerLength, offset + header.size));
    }

    static toNumber(buffer: Buffer, offset?: number): number {
        return IpcPacketBuffer._toNumber(new BufferReader(buffer, offset));
    }

    private static _toNumber(bufferReader: BufferReader): number {
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isNumber() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerHelpers.headerLength, offset + header.size));
    }

    static toObject(buffer: Buffer, offset?: number): any {
        return IpcPacketBuffer._toObject(new BufferReader(buffer, offset));
    }

    private static _toObject(bufferReader: BufferReader): any {
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isObject() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return JSON.parse(bufferReader.buffer.toString('utf8', offset + headerHelpers.headerLength, offset + header.size));
    }

    static toString(buffer: Buffer, offset?: number, encoding?: string): string {
        return IpcPacketBuffer._toString(new BufferReader(buffer, offset), encoding);
    }

    private static _toString(bufferReader: BufferReader, encoding?: string): string {
        encoding = encoding || 'utf8';
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isString() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.toString(encoding, offset + headerHelpers.headerLength, offset + header.size);
    }

    static toBuffer(buffer: Buffer, offset?: number): Buffer {
        return IpcPacketBuffer._toBuffer(new BufferReader(buffer, offset));
    }

    private static _toBuffer(bufferReader: BufferReader): Buffer {
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isBuffer() === false) {
            return null;
        }
        let offset = bufferReader.offset;
        bufferReader.offset += header.size;
        return bufferReader.buffer.slice(offset + headerHelpers.headerLength, offset + header.size);
    }

    static toArrayAt(index: number, buffer: Buffer, offset?: number): any {
        return IpcPacketBuffer._toArrayAt(index, new BufferReader(buffer, offset));
    }

    private static _toArrayAt(index: number, bufferReader: BufferReader): any {
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray() === false) {
            return null;
        }
        bufferReader.offset += header.headerLength;
        while ((index > 0) && (bufferReader.offset < header.size)) {
            let headerArg = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
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
        let header = headerHelpers.IpcPacketBufferHeader.getHeader(bufferReader.buffer, bufferReader.offset);
        if (header.isArray() === false) {
            return null;
        }
        let args = [];
        bufferReader.offset += header.headerLength;
        while (bufferReader.offset < header.size) {
            let arg = IpcPacketBuffer._to(bufferReader);
            args.push(arg);
        }
        return args;
    }
}