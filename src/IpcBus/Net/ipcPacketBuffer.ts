import { Buffer } from 'buffer';
import { BufferReader } from './bufferReader';
import { BufferWriter } from './bufferWriter';
import * as wrap from './ipcPacketBufferWrap';

export class IpcPacketBuffer extends wrap.IpcPacketBufferWrap {
    private _buffer: Buffer;

    private constructor() {
        super();
    }

    protected setContentSize(contentSize: number) {
        super.setContentSize(contentSize);
        this._buffer = Buffer.alloc(this.packetSize);
    }

    protected setPacketSize(packetSize: number) {
        super.setPacketSize(packetSize);
        this._buffer = Buffer.alloc(this.packetSize);
    }

    get buffer(): Buffer {
        return this._buffer;
    }

    static fromPacketBuffer(wrap: wrap.IpcPacketBufferWrap, buffer: Buffer) {
        let packet = new IpcPacketBuffer();
        packet._type = wrap.type;
        packet._packetSize = wrap.packetSize;
        packet._contentSize = wrap.contentSize;
        packet._headerSize = wrap.headerSize;
        packet._buffer = buffer;
        return packet;
    }

    // Thanks to https://github.com/tests-always-included/buffer-serializer/
    static fromNumber(dataNumber: number): IpcPacketBuffer {
        let packet = new IpcPacketBuffer();
        // An integer
        if (Math.floor(dataNumber) === dataNumber) {
            let absDataNumber = Math.abs(dataNumber);
            // 32-bit integer
            if (absDataNumber <= 0xFFFFFFFF) {
                // Negative integer
                if (dataNumber < 0) {
                    packet.type = wrap.BufferType.NegativeInteger;
                }
                // Positive integer
                else {
                    packet.type = wrap.BufferType.PositiveInteger;
                }
                let bufferWriter = new BufferWriter(packet.buffer);
                packet.writeHeader(bufferWriter);
                bufferWriter.writeUInt32(absDataNumber);
                packet.writeFooter(bufferWriter);
                return packet;
            }
        }
        // Either this is not an integer or it is outside of a 32-bit integer.
        // Store as a double.
        packet.type = wrap.BufferType.Double;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);
        bufferWriter.writeDouble(dataNumber);
        packet.writeFooter(bufferWriter);
        return packet;
    }

    static fromBoolean(dataBoolean: boolean): IpcPacketBuffer {
        let packet = new IpcPacketBuffer();
        packet.type = wrap.BufferType.Boolean;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);
        bufferWriter.writeByte(dataBoolean ? 0xFF : 0x00);
        packet.writeFooter(bufferWriter);
        return packet;
    }

    static fromString(data: string, encoding?: string): IpcPacketBuffer {
        let packet = new IpcPacketBuffer();
        packet.type = wrap.BufferType.String;
        packet.contentSize = data.length;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);
        bufferWriter.writeString(data, encoding);
        packet.writeFooter(bufferWriter);
        return packet;
    }

    static fromObject(dataObject: Object): IpcPacketBuffer {
        let data = JSON.stringify(dataObject);

        let packet = new IpcPacketBuffer();
        packet.type = wrap.BufferType.Object;
        packet.contentSize = data.length;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);
        bufferWriter.writeString(data, 'utf8');
        packet.writeFooter(bufferWriter);
        return packet;
    }

    static fromBuffer(data: Buffer): IpcPacketBuffer {
        let packet = new IpcPacketBuffer();
        packet.type = wrap.BufferType.Buffer;
        packet.contentSize = data.length;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);
        bufferWriter.writeBuffer(data);
        packet.writeFooter(bufferWriter);
        return packet;
    }

    static fromArray(args: any[]): IpcPacketBuffer {
        let buffers: Buffer[] = [];
        let buffersLength = 0;
        args.forEach((arg) => {
            let bufferArg = IpcPacketBuffer.from(arg);
            buffersLength += bufferArg.buffer.length;
            buffers.push(bufferArg.buffer);
        });

        let packet = new IpcPacketBuffer();
        packet.type = wrap.BufferType.Array;
        packet.contentSize = buffersLength;

        let bufferWriter = new BufferWriter(packet.buffer);
        packet.writeHeader(bufferWriter);

        buffers.forEach((buffer) => {
            bufferWriter.writeBuffer(buffer);
        });

        packet.writeFooter(bufferWriter);
        return packet;
    }

    static from(data: any): IpcPacketBuffer {
        let buffer: IpcPacketBuffer;
        if (Buffer.isBuffer(data)) {
            buffer = IpcPacketBuffer.fromBuffer(data);
        }
        else if (Array.isArray(data)) {
            buffer = IpcPacketBuffer.fromArray(data);
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

    to(): any {
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._to(this, bufferReader);
    }

    private static _to(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): any {
        let arg: any;
        switch (header.type) {
            case wrap.BufferType.Array: {
                arg = IpcPacketBuffer._toArray(header, bufferReader);
                break;
            }
            case wrap.BufferType.Object: {
                arg = IpcPacketBuffer._toObject(header, bufferReader);
                break;
            }
            case wrap.BufferType.String: {
                arg = IpcPacketBuffer._toString(header, bufferReader);
                break;
            }
            case wrap.BufferType.Buffer: {
                arg = IpcPacketBuffer._toBuffer(header, bufferReader);
                break;
            }
            case wrap.BufferType.PositiveInteger:
            case wrap.BufferType.NegativeInteger:
            case wrap.BufferType.Double: {
                arg = IpcPacketBuffer._toNumber(header, bufferReader);
                break;
            }
            case wrap.BufferType.Boolean: {
                arg = IpcPacketBuffer._toBoolean(header, bufferReader);
                break;
            }
        }
        return arg;
    }

    toBoolean(): boolean {
        if (this.isBoolean() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toBoolean(this, bufferReader);
    }

    private static _toBoolean(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): boolean {
        let data: boolean = (bufferReader.readByte() === 0xFF);
        bufferReader.skip(header.footerSize);
        return data;
    }

    toNumber(): number {
        if (this.isNumber() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toNumber(this, bufferReader);
    }

    private static _toNumber(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): number {
        let data: number;
        switch (header.type) {
            case wrap.BufferType.Double:
                data = bufferReader.readDouble();
                break;
            case wrap.BufferType.NegativeInteger:
                data = -bufferReader.readUInt32();
                break;
            case wrap.BufferType.PositiveInteger:
                data = +bufferReader.readUInt32();
                break;
            default:
                data = null;
                break;
        }
        bufferReader.skip(header.footerSize);
        return data;
    }

    toObject(): any {
        if (this.isObject() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toObject(this, bufferReader);
    }

    private static _toObject(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): any {
        let data = bufferReader.readString('utf8', header.contentSize);
        bufferReader.skip(header.footerSize);
        return JSON.parse(data);
    }

    toString(encoding?: string): string {
        if (this.isString() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toString(this, bufferReader, encoding);
    }

    private static _toString(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader, encoding?: string): string {
        let data = bufferReader.readString(encoding, header.contentSize);
        bufferReader.skip(header.footerSize);
        return data;
    }

    toBuffer(): Buffer {
        if (this.isBuffer() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toBuffer(this, bufferReader);
    }

    private static _toBuffer(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): Buffer {
        let data = bufferReader.readBuffer(header.contentSize);
        bufferReader.skip(header.footerSize);
        return data;
    }

    toArrayAt(index: number): any {
        if (this.isArray() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toArrayAt(index, this, bufferReader);
    }

    private static _toArrayAt(index: number, header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): any {
        let offsetContentSize = bufferReader.offset + header.contentSize;
        let headerArg = wrap.IpcPacketBufferWrap.fromType(wrap.BufferType.HeaderNotValid);
        while ((index > 0) && (bufferReader.offset < offsetContentSize)) {
            headerArg.readHeader(bufferReader);
            bufferReader.skip(headerArg.contentSize + header.footerSize);
            --index;
        }
        let arg: any;
        if (index === 0) {
            headerArg.readHeader(bufferReader);
            arg = IpcPacketBuffer._to(headerArg, bufferReader);
        }
        return arg;
    }

    toArray(): any[] {
        if (this.isArray() === false) {
            return null;
        }
        let bufferReader = new BufferReader(this._buffer, this.headerSize);
        return IpcPacketBuffer._toArray(this, bufferReader);
    }

    private static _toArray(header: wrap.IpcPacketBufferWrap, bufferReader: BufferReader): any[] {
        let offsetContentSize = bufferReader.offset + header.contentSize;
        let args = [];
        let headerArg = wrap.IpcPacketBufferWrap.fromType(wrap.BufferType.HeaderNotValid);
        while (bufferReader.offset < offsetContentSize) {
            headerArg.readHeader(bufferReader);
            let arg = IpcPacketBuffer._to(headerArg, bufferReader);
            args.push(arg);
        }
        bufferReader.skip(header.footerSize);
        return args;
    }
}