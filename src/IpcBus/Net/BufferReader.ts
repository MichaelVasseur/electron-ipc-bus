// import { Buffer } from 'buffer';

export class BufferReader {
    private _offset: number;
    private _buffer: Buffer;

    constructor(buffer: Buffer, offset?: number) {
        this._buffer = buffer;
        this._offset = offset || 0;
    }

    get length(): number {
        return this._buffer.length;
    }

    get offset(): number {
        return this._offset;
    }

    skip(offset?: number) {
        offset = offset || 1;
        this._offset += offset;
    }

    readByte(): number {
        return this._buffer[this._offset++];
    }

    readUInt32(): number {
        let start = this._offset;
        this._offset += 4;
        return this._buffer.readUInt32LE(start);
    }

    readDouble(): number {
        let start = this._offset;
        this._offset += 8;
        return this._buffer.readDoubleBE(start);
    }

    readString(encoding?: string, len?: number): string {
        encoding = encoding || 'utf8';
        let start = this._offset;
        let end = start + (len || this._buffer.length);
        this._offset = end;
        return this._buffer.toString(encoding, start, end);
    }

    readBuffer(len?: number): Buffer {
        let start = this._offset;
        let end = start + (len || this._buffer.length);
        this._offset = end;
        return this._buffer.slice(start, end);
    }
}

