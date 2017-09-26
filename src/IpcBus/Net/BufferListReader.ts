import { Buffer } from 'buffer';
import { Reader } from './reader';

export class BufferListReader implements Reader {
    private _offset: number;
    private _length: number;
    private _buffers: Buffer[];

    private _curBufferIndex: number;
    private _curOffset: number;
    private _curBuffer: Buffer;

    constructor(buffers: Buffer[], offset?: number) {
        this._buffers = buffers;
        this._offset = 0;
        // Sum all the buffers lengths
        this._length = this._buffers.reduce(function (left: any, right: any) { return (left.length || left) + (right.length || right); }, 0);

        this._curBufferIndex = 0;
        this._curOffset = 0;
        this.seek(offset || 0);
    }

    appendBuffer(buffer: Buffer): void {
        this._buffers.push(buffer);
        this._length += buffer.length;
        this._curBuffer = this._buffers[this._curBufferIndex];
    }

    get EOF(): boolean {
        return (this._offset >= this._length);
    }

    get length(): number {
        return this._length;
    }

    get offset(): number {
        return this._offset;
    }

    seek(offset: number): number {
        this._curOffset += offset - this._offset;
        if (this._curOffset > 0) {
            for (; this._curBufferIndex < this._buffers.length; ++this._curBufferIndex) {
                this._curBuffer = this._buffers[this._curBufferIndex];
                if (this._curOffset < this._curBuffer.length) {
                    break;
                }
                this._curOffset -= this._curBuffer.length;
            }
        }
        else if (this._curOffset < 0) {
            for (; this._curBufferIndex >= 0; --this._curBufferIndex) {
                this._curBuffer = this._buffers[this._curBufferIndex];
                if (this._curOffset >= 0) {
                    break;
                }
                this._curOffset += this._curBuffer.length;
            }
        }
        return (this._offset = offset);
    }

    skip(offsetStep?: number): number {
        offsetStep = offsetStep || 1;
        return this.seek(this._offset + offsetStep);
    }

    reduce() {
        if (this.EOF) {
            this._buffers = [];
            this._offset = 0;
            this._length = 0;
            this._curOffset = 0;
            this._curBufferIndex = 0;
            this._curBuffer = null;
        }
        else {
            if (this._curBufferIndex > 0) {
                this._buffers.splice(0, this._curBufferIndex);
                this._length -= (this._offset - this._curOffset);
                this._offset = this._curOffset;

                this._curBufferIndex = 0;
                this._curBuffer = this._buffers[this._curBufferIndex];
             }
        }
    }

    private _consolidate(newOffset: number): boolean {
        let bufferLength = this._curBuffer.length;
        if (bufferLength > newOffset) {
            return true;
        }
        let buffers = [this._curBuffer];
        let endBufferIndex = this._curBufferIndex + 1;
        for (; endBufferIndex < this._buffers.length; ++endBufferIndex) {
            buffers.push(this._buffers[endBufferIndex]);
            bufferLength += this._buffers[endBufferIndex].length;
            if (bufferLength > newOffset) {
                break;
            }
        }
        if (bufferLength <= newOffset) {
            return false;
        }
        this._curBuffer = this._buffers[this._curBufferIndex] = Buffer.concat(buffers, bufferLength);
        this._buffers.splice(this._curBufferIndex + 1, endBufferIndex - this._curBufferIndex);
        return true;
    }

    readByte(): number {
        if (this._curOffset >= this._curBuffer.length) {
            this._curOffset = 0;
            this._curBuffer = this._buffers[++this._curBufferIndex];
        }

        let start = this._curOffset;
        ++this._offset;
        ++this._curOffset;
        return this._curBuffer[start];
    }

    readUInt32(): number {
        this._consolidate(this._curOffset + 4);
        let start = this._curOffset;
        this._offset += 4;
        this._curOffset += 4;
        return this._curBuffer.readUInt32LE(start);
    }

    readDouble(): number {
        this._consolidate(this._curOffset + 8);
        let start = this._curOffset;
        this._offset += 8;
        this._curOffset += 8;
        return this._curBuffer.readDoubleBE(start);
    }

    readString(encoding?: string, len?: number): string {
        len = (len || (this._length - this._offset));
        encoding = encoding || 'utf8';

        this._consolidate(this._curOffset + len);
        let start = this._curOffset;
        let end = Math.min(start + len, this._curBuffer.length);

        this._offset += len;
        this._curOffset += len;
        return this._curBuffer.toString(encoding, start, end);
    }

    readBuffer(len?: number): Buffer {
        len = (len || (this._length - this._offset));

        let start = this._offset;
        let end = Math.min(start + len, this._length);
        let bufferLen = end - start;

        this._offset += bufferLen;

        let targetBuffer = Buffer.alloc(bufferLen);
        let targetOffset = 0;
        for (; this._curBufferIndex < this._buffers.length; ++this._curBufferIndex) {
            this._curBuffer = this._buffers[this._curBufferIndex];
            let curBufferLen = this._curBuffer.length - this._curOffset;
            if (curBufferLen >= bufferLen) {
                this._curBuffer.copy(targetBuffer, targetOffset, this._curOffset, this._curOffset + bufferLen);
                this._curOffset += bufferLen;
                bufferLen = 0;
                break;
            }
            else {
                this._curBuffer.copy(targetBuffer, targetOffset, this._curOffset, this._curOffset + curBufferLen);
                bufferLen -= curBufferLen;
                targetOffset += curBufferLen;
                this._curOffset = 0;
            }
        }
        return targetBuffer;
    }
}

