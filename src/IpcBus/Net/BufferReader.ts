// import { Buffer } from 'buffer';

export class BufferReader {
    offset: number;
    buffer: Buffer;

    constructor(buffer: Buffer, offset?: number) {
        this.buffer = buffer;
        this.offset = offset || 0;
    }

    get length(): number {
        return this.buffer.length;
    }

    skip(offset?: number) {
        offset = offset || 1;
        this.offset += offset;
    }

    readByte(): number {
        return this.buffer[this.offset++];
    }

    readUInt32(): number {
        let start = this.offset;
        this.offset += 4;
        return this.buffer.readUInt32LE(start);
    }

    readDouble(): number {
        let start = this.offset;
        this.offset += 8;
        return this.buffer.readDoubleBE(start);
    }

    readString(encoding?: string, len?: number): string {
        encoding = encoding || 'utf8';
        let start = this.offset;
        let end = start + (len || this.buffer.length);
        this.offset = end;
        return this.buffer.toString(encoding, start, end);
    }

    readBuffer(len?: number): Buffer {
        let start = this.offset;
        let end = start + (len || this.buffer.length);
        this.offset = end;
        return this.buffer.slice(start, end);
    }
}

