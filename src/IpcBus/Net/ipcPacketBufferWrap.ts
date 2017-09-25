import { Buffer } from 'buffer';
import { BufferReader } from './bufferReader';
import { Writer } from './writer';

const headerSeparator: number = '['.charCodeAt(0);
const footerSeparator: number = ']'.charCodeAt(0);

const MinHeaderLength: number = 2;
// const MaxHeaderLength: number = MinHeaderLength + 4;

const FooterLength: number = 1;
// const StringHeaderLength: number = MinHeaderLength + 4;
// const BufferHeaderLength: number = MinHeaderLength + 4;
// const ArrayHeaderLength: number = MinHeaderLength + 4;
const ObjectHeaderLength: number = MinHeaderLength + 4;
const ArrayHeaderLength: number = MinHeaderLength + 4;

export enum BufferType {
    // 88
    HeaderNotValid = 'X'.charCodeAt(0),
    // 85
    HeaderUnknown = 'U'.charCodeAt(0),
    // 121
    ContentPartial = 'y'.charCodeAt(0),
    // 115
    String = 's'.charCodeAt(0),
    // 66
    Buffer = 'B'.charCodeAt(0),
    // 98
    Boolean = 'b'.charCodeAt(0),
    // 65
    Array = 'A'.charCodeAt(0),
    // 42
    PositiveInteger = '+'.charCodeAt(0),
    // 45
    NegativeInteger = '-'.charCodeAt(0),
    // 100
    Double = 'd'.charCodeAt(0),
    // 79
    Object = 'O'.charCodeAt(0)
};

export class IpcPacketBufferWrap {
    protected _type: BufferType;
    protected _packetSize: number;
    protected _contentSize: number;
    protected _headerSize: number;
    protected _argsLen: number;
    protected _partial: boolean;

    protected constructor() {
        this._type = BufferType.HeaderNotValid;
    }

    static fromType(bufferType: BufferType) {
        let header = new IpcPacketBufferWrap();
        header.type = bufferType;
        return header;
    }

    static fromBufferHeader(bufferReader: BufferReader) {
        let header = new IpcPacketBufferWrap();
        header.readHeader(bufferReader);
        return header;
    }

    get type(): BufferType {
        return this._type;
    }

    set type(bufferType: BufferType) {
        this._type = bufferType;
        switch (this._type) {
            case BufferType.Double:
                this._headerSize = MinHeaderLength;
                this.setContentSize(8);
                break;
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
                this._headerSize = MinHeaderLength;
                this.setContentSize(4);
                break;
            case BufferType.Array:
                this._headerSize = ArrayHeaderLength;
                this.setContentSize(0);
                break;
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this._headerSize = ObjectHeaderLength;
                // Empty by default
                this.setContentSize(0);
                break;
            case BufferType.Boolean:
                this._headerSize = MinHeaderLength;
                this.setContentSize(1);
                break;
            default:
                this._type = BufferType.HeaderNotValid;
                break;
        }
    }

    get argsLen(): number {
        return this._argsLen;
    }

    set argsLen(argsLen: number) {
        this._argsLen = argsLen;
    }

    get packetSize(): number {
        return this._packetSize;
    }

    set packetSize(packetSize: number) {
        if (this._packetSize === packetSize) {
            return;
        }
        switch (this._type) {
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this.setPacketSize(packetSize);
                break;
        }
    }

    protected setPacketSize(packetSize: number) {
        this._packetSize = packetSize;
        this._contentSize = this._packetSize - this._headerSize - FooterLength;
    }

    get contentSize(): number {
        return this._contentSize;
    }

    set contentSize(contentSize: number) {
        if (this._contentSize === contentSize) {
            return;
        }
        switch (this._type) {
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this.setContentSize(contentSize);
                break;
        }
    }

    protected setContentSize(contentSize: number) {
        this._contentSize = contentSize;
        this._packetSize = this._contentSize + this._headerSize + FooterLength;
    }

    get footerSize(): number {
        return FooterLength;
    }

    get headerSize(): number {
        return this._headerSize;
    }

    isValid(): boolean {
        return this._type !== BufferType.HeaderNotValid;
    }

    isUnknown(): boolean {
        return this._type === BufferType.HeaderUnknown;
    }

    isPartial(): boolean {
        return this._partial;
    }

    isArray(): boolean {
        return this._type === BufferType.Array;
    }

    isObject(): boolean {
        return this._type === BufferType.Object;
    }

    isString(): boolean {
        return this._type === BufferType.String;
    }

    isBuffer(): boolean {
        return this._type === BufferType.Buffer;
    }

    isNumber(): boolean {
        switch (this._type) {
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
            case BufferType.Double:
                return true;
            default:
                return false;
        }
    }

    isBoolean(): boolean {
        return this._type === BufferType.Boolean;
    }

    writeHeader(bufferWriter: Writer): number {
        bufferWriter.writeBytes([headerSeparator, this._type]);
        switch (this._type) {
            case BufferType.Array:
                bufferWriter.writeUInt32(this._argsLen);
                break;
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                bufferWriter.writeUInt32(this._packetSize);
                break;
        }
        return bufferWriter.length;
    }

    readHeader(bufferReader: BufferReader): number {
        this._type = BufferType.HeaderUnknown;
        if (bufferReader.EOF) {
            return bufferReader.offset;
        }
        if (bufferReader.readByte() !== headerSeparator) {
            this._type = BufferType.HeaderNotValid;
            return bufferReader.offset;
        }
        if (bufferReader.EOF) {
            return bufferReader.offset;
        }
        this.type = bufferReader.readByte();
        if (bufferReader.offset + (this._headerSize - 2) > bufferReader.length) {
            this._partial = true;
        }
        else {
            this._partial = false;
            switch (this.type) {
                case BufferType.Array:
                    this._argsLen = bufferReader.readUInt32();
                    break;
                case BufferType.Object:
                case BufferType.String:
                case BufferType.Buffer:
                    this.setPacketSize(bufferReader.readUInt32());
                    break;
            }
        }
        return bufferReader.offset;
    }

    readHeaderFromBuffers(buffers: Buffer[], totalLength: number, offset: number): void {
        let buffer = buffers[0];
        const offsetHeaderLength = offset + MinHeaderLength;
        // Buffer is too short for containing a header
        if (buffer.length < offsetHeaderLength) {
            // No hope, there is not enough buffers
            if (totalLength < offsetHeaderLength) {
                this._type = BufferType.HeaderUnknown;
                return;
            }
            // Create a buffer from buffers with the minimum size
            buffer = Buffer.concat(buffers, offsetHeaderLength);
        }
        this.readHeader(new BufferReader(buffer, offset));
        if (this.isPartial()) {
            // No hope, there is not enough buffers
            if (totalLength < this.headerSize) {
                 return;
            }
            buffer = Buffer.concat(buffers, this.headerSize);
            this.readHeader(new BufferReader(buffer, offset));
        }
    }

    writeFooter(bufferWriter: Writer): number {
        return bufferWriter.writeByte(footerSeparator);
    }
}
