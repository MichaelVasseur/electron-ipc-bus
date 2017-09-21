import { Buffer } from 'buffer';
import { BufferReader } from './bufferReader';
import { BufferWriter } from './bufferWriter';

const headerSeparator: number = '['.charCodeAt(0);
export const footerSeparator: number = ']'.charCodeAt(0);

const MinHeaderLength: number = 2;
const MaxHeaderLength: number = MinHeaderLength + 4;

export const FooterLength: number = 1;
export const IntegerHeaderLength: number = MinHeaderLength;
export const DoubleHeaderLength: number = MinHeaderLength;
export const StringHeaderLength: number = MinHeaderLength + 4;
export const BufferHeaderLength: number = MinHeaderLength + 4;
export const ArrayHeaderLength: number = MinHeaderLength + 4;
export const ObjectHeaderLength: number = MinHeaderLength + 4;
export const BooleanHeaderLength: number = MinHeaderLength;

export const DoublePacketSize = DoubleHeaderLength + 8 + FooterLength;
export const IntegerPacketSize = DoubleHeaderLength + 4 + FooterLength;
export const BooleanPacketSize = DoubleHeaderLength + 1 + FooterLength;

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
    type: BufferType;
    packetSize: number;
    contentSize: number;
    headerSize: number;

    constructor(bufferReader?: BufferReader) {
        this.type = BufferType.HeaderNotValid;
        if (bufferReader) {
            this.readHeader(bufferReader);
        }
    }

    readHeader(bufferReader: BufferReader): number {
        this.type = BufferType.HeaderNotValid;
        if (bufferReader.readByte() !== headerSeparator) {
            return 0;
        }
        this.type = bufferReader.readByte();
        switch (this.type) {
            case BufferType.Double:
                this.headerSize = DoubleHeaderLength;
                if (bufferReader.offset + this.headerSize >= bufferReader.length) {
                    this.type = BufferType.HeaderPartial;
                }
                else {
                    this.packetSize = DoublePacketSize;
                    this.contentSize = 8;
                }
                break;
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
                this.headerSize = IntegerHeaderLength;
                if (bufferReader.offset + this.headerSize >= bufferReader.length) {
                    this.type = BufferType.HeaderPartial;
                }
                else {
                    this.packetSize = IntegerPacketSize;
                    this.contentSize = 4;
                }
                break;
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
                this.headerSize = ObjectHeaderLength;
                if (bufferReader.offset + this.headerSize >= bufferReader.length) {
                    this.type = BufferType.HeaderPartial;
                }
                else {
                    this.packetSize = bufferReader.readUInt32();
                    this.contentSize = this.packetSize - this.headerSize - FooterLength;
                }
                break;
            case BufferType.Boolean: {
                this.headerSize = BooleanHeaderLength;
                if (bufferReader.offset + this.headerSize >= bufferReader.length) {
                    this.type = BufferType.HeaderPartial;
                }
                else {
                    this.packetSize = BooleanPacketSize;
                    this.contentSize = 1;
                }
                break;
            }
            default :
                this.type = BufferType.HeaderNotValid;
                break;
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
                this.type = BufferType.HeaderPartial;
            }
            // Create a buffer buffers with the minimum size
            buffer = Buffer.concat(buffers, offsetHeaderLength);
            // Still not enough !
            if (buffer.length < offsetHeaderLength) {
                this.type = BufferType.HeaderPartial;
            }
        }
        this.readHeader(new BufferReader(buffer, offset));
    }

    isValid(): boolean {
        return this.type !== BufferType.HeaderNotValid;
    }

    isPartial(): boolean {
        return this.type === BufferType.HeaderPartial;
    }

    isArray(): boolean {
        return this.type === BufferType.Array;
    }

    isObject(): boolean {
        return this.type === BufferType.Object;
    }

    isString(): boolean {
        return this.type === BufferType.String;
    }

    isBuffer(): boolean {
        return this.type === BufferType.Buffer;
    }

    isNumber(): boolean {
        switch(this.type) {
            case BufferType.NegativeInteger:
            case BufferType.PositiveInteger:
            case BufferType.Double:
                return true;
            default :
                return false;
        }
    }

    isBoolean(): boolean {
        return this.type === BufferType.Boolean;
    }

    static writeHeader(bufferWriter: BufferWriter, bufferType: BufferType): number {
        bufferWriter.writeByte(headerSeparator);
        return bufferWriter.writeByte(bufferType);
    }
}
