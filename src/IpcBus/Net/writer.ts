// import { Buffer } from 'buffer';

export interface Writer {
    readonly buffer: Buffer;
    readonly buffers: Buffer[];
    readonly length: number;

    writeByte(data: number): number;
    writeBytes(dataArray: number[]): number;
    writeUInt32(data: number): number;
    writeDouble(data: number): number;
    writeString(data: string, encoding?: string, len?: number): number;
    writeBuffer(data: Buffer, sourceStart?: number, sourceEnd?: number): number;
}

