// import { Buffer } from 'buffer';

export class BufferWriter {
    private _offset: number;
    private _buffer: Buffer;

    constructor(buffer: Buffer, offset?: number) {
        this._buffer = buffer;
        this._offset = offset || 0;
    }

    get buffer(): Buffer {
        return this._buffer;
    }

    get length(): number {
        return this._buffer.length;
    }

    get offset(): number {
        return this._offset;
    }

    writeByte(data: number): number {
        this._buffer[this._offset] = data;
        return ++this._offset;
    }

    writeUInt32(data: number): number {
        this._offset = this._buffer.writeUInt32LE(data, this._offset);
        return this._offset;
    }

    writeDouble(data: number): number {
        this._offset = this._buffer.writeDoubleLE(data, this._offset);
        return this._offset;
    }

    writeString(data: string, encoding?: string, len?: number): number {
        this._offset += this._buffer.write(data, this._offset, len, encoding);
        return this._offset;
    }

    writeBuffer(data: Buffer, sourceStart?: number, sourceEnd?: number): number {
        this._offset += data.copy(this._buffer, this._offset, sourceStart, sourceEnd);
        return this._offset;
    }
}

