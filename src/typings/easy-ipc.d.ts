///<reference path="../../node_modules/@types/node/index.d.ts"/>

declare module "easy-ipc" {
  import { Stream } from 'stream';
  export class Ipc extends Stream {
    constructor(options?: any);
    connect(port?: any, host?: any, cb?: any): void;
    listen(port?: any, host?: any, cb?: any): void;
    start(port?: any, host?: any, cb?: any): void;
  }

  export class IpcCmd {
    constructor(ipc: Ipc, conn: any); 
    set(obj: any): this;
    add(name: string, func: Function, scope: any, doc: string, sig: any): this;
    static introspect(conn: any): void;
    static exec(cmdName: string, ...args: any[]): boolean;
    static isCmd(d: any): boolean;
    static mkCmd(cmd: string, ...args: any[]): any;
  }
}

