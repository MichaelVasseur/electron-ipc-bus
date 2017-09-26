import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import { IpcPacketBufferWrap, BufferType } from './ipcPacketBufferWrap';
import { IpcPacketBuffer } from './ipcPacketBuffer';
import { BufferListReader } from './BufferListReader';

export class IpcPacketBufferDecoder extends EventEmitter {
    private _bufferListReader: BufferListReader;
    private _header: IpcPacketBufferWrap;

    expectedArgs: number;
    packetArgs: IpcPacketBuffer[];

    constructor() {
        super();
        this._bufferListReader = new BufferListReader([]);
        this._header = IpcPacketBufferWrap.fromType(BufferType.HeaderNotValid);

        this.packetArgs = [];
        this.expectedArgs = 0;
    }

    on(event: 'packet', handler: (buffer: IpcPacketBuffer) => void): this;
    on(event: 'packet[]', handler: (buffer: IpcPacketBuffer[]) => void): this;
    on(event: 'error', handler: (err: Error) => void): this;
    on(event: string, handler: Function): this {
        return super.on(event, handler);
    }

    handlePacket(packet: IpcPacketBuffer): IpcPacketBuffer | null {
        if (this.packetArgs.length > 0) {
            this.packetArgs.push(packet);
            if (packet.isArrayLen()) {
                this.expectedArgs += packet.argsLen;
            }
            if (--this.expectedArgs === 0) {
                let buffersLen = 0;
                let buffers = this.packetArgs.map(packet => {
                    buffersLen += packet.buffer.length;
                    return packet.buffer;
                });
                let packet = IpcPacketBuffer.fromPacketBuffer(this.packetArgs[0], Buffer.concat(buffers, buffersLen));
                this.packetArgs = [];
                this.expectedArgs = 0;
                return packet;
            }
            return null;
        }
        if (packet.isArrayLen()) {
            this.packetArgs.push(packet);
            this.expectedArgs = packet.argsLen;
            return null;
        }
        return packet;
    }

    handleData(data: Buffer): void {
        this._bufferListReader.appendBuffer(data);

        let packets: IpcPacketBuffer[] = [];

        while (this._bufferListReader.length > 0) {
            let offset = this._bufferListReader.offset;
            this._header.readHeader(this._bufferListReader);
            // if packet size error
            if (!this._header.isValid()) {
                this.emit('error', new Error('Get invalid packet header'));
                break;
            }
            this._bufferListReader.seek(offset);
            // if not enough data accumulated for reading the header, exit
            if (this._header.isPartial() || this._header.isUnknown()) {
                break;
            }
            let packetSize = this._header.packetSize;
            // if not enough data accumulated for reading the packet, exit
            if (this._bufferListReader.length - this._bufferListReader.offset  < packetSize) {
                break;
            }

            let buffer = this._bufferListReader.readBuffer(packetSize);

            let packet = IpcPacketBuffer.fromPacketBuffer(this._header, buffer);
            packets.push(packet);
            this.emit('packet', packet);
            // let packet = this.handlePacket(IpcPacketBuffer.fromPacketBuffer(this._header, buffer));
            // if (packet) {
            //     packets.push(packet);
            //     this.emit('packet', packet);
            // }
        }
        this._bufferListReader.reduce();
        this.emit('packet[]', packets);
    }
}
