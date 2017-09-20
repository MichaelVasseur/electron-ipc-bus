import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import { IpcPacketBuffer, headerLength } from './ipcPacketBuffer';

export class IpcPacketBufferDecoder extends EventEmitter {
    private _buffers: Buffer[];
    private _totalLength: number;

    constructor() {
        super();
        this._totalLength = 0;
        this._buffers = [];
    }

    on(event: 'packet', handler: (buffer: Buffer) => void): this;
    on(event: 'packet[]', handler: (buffer: Buffer[]) => void): this;
    on(event: 'error', handler: (err: Error) => void): this;
    on(event: string, handler: Function): this {
        return super.on(event, handler);
    }

    handleData(data: Buffer): void {
        // assert(data instanceof Buffer, 'data should be a buffer');
        this._totalLength += data.length;
        this._buffers.push(data);

        let packets: Buffer[] = [];

        let offset = 0;
        while (this._totalLength >= headerLength) {
            let header = IpcPacketBuffer._getPacketHeader(this._buffers, offset);
            // if packet size error
            if (!header) {
                this._buffers = [];
                this.emit('error', new Error('Get invalid packet size'));
                break;
            }
            let packetSize = header.size;
            let packet: Buffer;
            // if already get packet
            if (this._totalLength >= packetSize) {
                let currentBuffer = this._buffers[0];
                if (currentBuffer.length - offset >= packetSize) {
                    packet = currentBuffer.slice(offset, offset + packetSize);
                }
                else {
                    if (offset > 0) {
                        this._buffers[0] = currentBuffer = currentBuffer.slice(offset);
                        offset = 0;
                    }
                    packet = Buffer.concat(this._buffers, packetSize);
                    // Don't waste your time to clean buffers if there are all used !
                    if (this._totalLength > 0) {
                        while (currentBuffer && (currentBuffer.length <= packetSize)) {
                            packetSize -= currentBuffer.length;

                            this._buffers.shift();
                            currentBuffer = this._buffers[0];
                        }
                    }
                }
                packets.push(packet);
                this.emit('packet', packet);

                // Beware, take the original size here
                this._totalLength -= header.size;
                offset += packetSize;
            }
            else {
                break;
            }
        }
        if ((this._buffers.length === 0) || (this._totalLength === 0)) {
            this._totalLength = 0;
            this._buffers = [];
        }
        else if (offset > 0) {
            this._buffers[0] = this._buffers[0].slice(offset);
        }
        this.emit('packet[]', packets);
    }
}
