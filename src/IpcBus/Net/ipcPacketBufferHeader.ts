import { Buffer } from 'buffer';

export const headerLength: number = 7;
export const separator: number = '#'.charCodeAt(0);
// const arrayS: number = '['.charCodeAt(0);
// const arrayE: number = ']'.charCodeAt(0);
export const objectObject: number = 'O'.charCodeAt(0);
export const objectString: number = 's'.charCodeAt(0);
export const objectBuffer: number = 'B'.charCodeAt(0);
export const objectArray: number = 'A'.charCodeAt(0);
export const objectBoolean: number = 'b'.charCodeAt(0);
export const objectNumber: number = 'n'.charCodeAt(0);
export const objectNotAvailable: number = 'x'.charCodeAt(0);

export class IpcPacketBufferHeader {
    type: number;
    private _size: number;

    get headerLength(): number {
        return headerLength;
    }

    get size(): number {
        switch (this.type) {
            case objectNotAvailable :
                return -1;
            case objectBoolean :
                return headerLength;
            default :
                return this._size;
        }
    }

    constructor(type: number, size: number) {
        this.type = type;
        this._size = size;
    }

    isAvailable(): boolean {
        return this.type !== objectNotAvailable;
    }

    isArray(): boolean {
        return this.type === objectArray;
    }

    isObject(): boolean {
        return this.type === objectObject;
    }

    isString(): boolean {
        return this.type === objectString;
    }

    isBuffer(): boolean {
        return this.type === objectBuffer;
    }

    isNumber(): boolean {
        return this.type === objectNumber;
    }

    isBoolean(): boolean {
        return this.type === objectBoolean;
    }

    static setHeader(buffer: Buffer, offset: number, header: IpcPacketBufferHeader) {
        let incr = offset;
        buffer[incr++] = separator;
        buffer[incr++] = header.type;
        buffer.writeUInt32LE(header.size, incr);
        incr += 4;
        buffer[incr] = separator;
        // assert(incr === offset + headerLength - 1);
    }

    static getPacketHeader(buffers: Buffer[], offset: number): IpcPacketBufferHeader {
        let buffer = buffers[0];
        const offsetHeaderLength =  offset + headerLength;
        // Buffer is too short for containing a header
        if (buffer.length < offsetHeaderLength) {
            // No hope, there is only one buffer
            if (buffers.length === 1) {
                return new IpcPacketBufferHeader(objectNotAvailable, -1);
            }
            // Create a buffer buffers with the minium size
            buffer = Buffer.concat(buffers, offsetHeaderLength);
            // Still not enough !
            if (buffer.length < offsetHeaderLength) {
                return new IpcPacketBufferHeader(objectNotAvailable, -1);
            }
        }
        let incr = offset;
        if (buffer[incr++] !== separator) {
            return null;
        }
        let type = buffer[incr++];
        let len = buffer.readUInt32LE(incr);
        incr += 4;
        if (buffer[incr] !== separator) {
            return null;
        }
        return new IpcPacketBufferHeader(type, len);
    }

    static getHeader(buffer: Buffer, offset: number): IpcPacketBufferHeader {
        return IpcPacketBufferHeader.getPacketHeader([buffer], offset);
    }
}
