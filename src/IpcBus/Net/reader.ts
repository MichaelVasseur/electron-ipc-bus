// import { Buffer } from 'buffer';

export interface Reader {
    readonly length: number;
    readonly offset: number;

    checkOffset(ext: number): boolean;
    seek(offset: number): number;
    skip(offsetStep?: number): number;
    readByte(): number;
    readUInt32(): number;
    readDouble(): number;
    readString(encoding?: string, len?: number): string;
    readBuffer(len?: number): Buffer;
}

