import { Buffer } from 'buffer';
import { BufferReader } from './bufferReader';
import { BufferWriter } from './bufferWriter';

const headerSeparator: number = '['.charCodeAt(0);
const footerSeparator: number = ']'.charCodeAt(0);

const MinHeaderLength: number = 2;
const MaxHeaderLength: number = MinHeaderLength + 4;

const FooterLength: number = 1;
const IntegerHeaderLength: number = MinHeaderLength;
const DoubleHeaderLength: number = MinHeaderLength;
// const StringHeaderLength: number = MinHeaderLength + 4;
// const BufferHeaderLength: number = MinHeaderLength + 4;
// const ArrayHeaderLength: number = MinHeaderLength + 4;
const ObjectHeaderLength: number = MinHeaderLength + 4;
const BooleanHeaderLength: number = MinHeaderLength;

export enum BufferType {
    HeaderNotValid = 'X'.charCodeAt(0),
    HeaderPartial = 'x'.charCodeAt(0),
    String = 's'.charCodeAt(0),
    Buffer = 'B'.charCodeAt(0),
    Boolean = 'b'.charCodeAt(0),
    Array = 'A'.charCodeAt(0),
    PositiveInteger = '+'.charCodeAt(0),
    NegativeInteger = '-'.charCodeAt(0),
    Double = 'd'.charCodeAt(0),
    Object = 'O'.charCodeAt(0)
};

export class IpcPacketBufferHeader {
    private _type: BufferType;
    private _packetSize: number;
    private _contentSize: number;
    private _headerSize: number;

    private constructor() {
        this._type = BufferType.HeaderNotValid;
    }

    static fromType(bufferType: BufferType) {
        let header = new IpcPacketBufferHeader();
        header.type = bufferType;
        return header;
    }

    static fromBufferHeader(bufferReader: BufferReader) {
        let header = new IpcPacketBufferHeader();
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
                this._headerSize = DoubleHeaderLength;
                this.setContentSize(8);
                break;
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
                this._headerSize = IntegerHeaderLength;
                this.setContentSize(4);
                break;
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this._headerSize = ObjectHeaderLength;
                break;
            case BufferType.Boolean:
                this._headerSize = BooleanHeaderLength;
                this.setContentSize(1);
                break;
            default :
                this._type = BufferType.HeaderNotValid;
                break;
        }
    }

    get packetSize(): number {
        return this._packetSize;
    }

    set packetSize(packetSize: number) {
        switch (this._type) {
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this.setPacketSize(packetSize);
                break;
            }
    }

    private setPacketSize(packetSize: number) {
        this._packetSize = packetSize;
        this._contentSize = this._packetSize - this._headerSize - FooterLength;
    }

    get contentSize(): number {
        return this._contentSize;
    }

    set contentSize(contentSize: number) {
        switch (this._type) {
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this.setContentSize(contentSize);
                break;
        }
    }

    private setContentSize(contentSize: number){
        this._contentSize = contentSize;
        this._packetSize = this._contentSize + this._headerSize + FooterLength;
    }

    get footerSize(): number {
        return FooterLength;
    }

    get headerSize(): number {
        return this._headerSize;
    }

    readHeader(bufferReader: BufferReader): number {
        this._type = BufferType.HeaderNotValid;
        if (bufferReader.readByte() !== headerSeparator) {
            return 0;
        }
        this.type = bufferReader.readByte();
        if (bufferReader.offset + this._headerSize >= bufferReader.length) {
            this._type = BufferType.HeaderPartial;
        }
        else {
            switch (this.type) {
                case BufferType.Array:
                case BufferType.Object:
                case BufferType.String:
                case BufferType.Buffer:
                    this.setPacketSize(bufferReader.readUInt32());
                    break;
            }
        }
        return bufferReader.offset;
    }

    readHeaderFromBuffers(buffers: Buffer[], offset: number): void {
        let buffer = buffers[0];
        const offsetHeaderLength = offset + MaxHeaderLength;
        // Buffer is too short for containing a header
        if (buffer.length < offsetHeaderLength) {
            // No hope, there is only one buffer
            if (buffers.length === 1) {
                this._type = BufferType.HeaderPartial;
            }
            // Create a buffer buffers with the minimum size
            buffer = Buffer.concat(buffers, offsetHeaderLength);
            // Still not enough !
            if (buffer.length < offsetHeaderLength) {
                this._type = BufferType.HeaderPartial;
            }
        }
        this.readHeader(new BufferReader(buffer, offset));
    }

    isValid(): boolean {
        return this._type !== BufferType.HeaderNotValid;
    }

    isPartial(): boolean {
        return this._type === BufferType.HeaderPartial;
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
        switch(this._type) {
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
            case BufferType.Double:
                return true;
            default :
                return false;
        }
    }

    isBoolean(): boolean {
        return this._type === BufferType.Boolean;
    }

    writeHeader(bufferWriter: BufferWriter): number {
        bufferWriter.writeByte(headerSeparator);
        bufferWriter.writeByte(this._type);
        switch (this._type) {
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                bufferWriter.writeUInt32(this._packetSize);
                break;
        }
        return bufferWriter.offset;
    }

    writeFooter(bufferWriter: BufferWriter): number {
        return bufferWriter.writeByte(footerSeparator);
    }
}
