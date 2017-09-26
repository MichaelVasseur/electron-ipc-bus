import { Buffer } from 'buffer';
import { Writer } from './writer';

export class BufferListWriter implements Writer {
    private _length: number;
    private _buffers: Buffer[];

    constructor() {
        this._buffers = [];
        this._length = 0;
    }

    get buffer(): Buffer {
        return Buffer.concat(this._buffers, this._length);
    }

    get buffers(): Buffer[] {
        return this._buffers;
    }

    get length(): number {
        return this._length;
    }

    writeByte(data: number): number {
        return this.writeBytes([data]);
    }

    writeBytes(dataArray: number[]): number {
        let buff = Buffer.from(dataArray);
        this._length += buff.length;
        this._buffers.push(buff);
        return this.length;
    }

    writeUInt32(data: number): number {
        let buff = Buffer.alloc(4);
        buff.writeUInt32LE(data, 0);
        this._length += buff.length;
        this._buffers.push(buff);
        return this.length;
    }

    writeDouble(data: number): number {
        let buff = Buffer.alloc(8);
        buff.writeDoubleLE(data, 0);
        this._length += buff.length;
        this._buffers.push(buff);
        return this.length;
    }

    writeString(data: string, encoding?: string, len?: number): number {
        if (len && (len < data.length)) {
            data = data.substring(0, len);
        }
        let buff = Buffer.from(data, encoding);
        this._length += buff.length;
        this._buffers.push(buff);
        return this.length;
    }

    writeBuffer(buff: Buffer, sourceStart?: number, sourceEnd?: number): number {
        sourceStart = sourceStart || 0;
        sourceEnd = sourceEnd || buff.length;

        if ((sourceStart > 0) || (sourceEnd < buff.length)) {
            buff = buff.slice(sourceStart, sourceEnd);
        }
        this._length += buff.length;
        this._buffers.push(buff);
        return this.length;
    }
}

