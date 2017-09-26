// import { Buffer } from 'buffer';

export interface Reader {
    readonly EOF: boolean;
    readonly length: number;
    readonly offset: number;

    seek(offset: number): number;
    skip(offsetStep?: number): number;
    readByte(): number;
    readUInt32(): number;
    readDouble(): number;
    readString(encoding?: string, len?: number): string;
    readBuffer(len?: number): Buffer;
}

