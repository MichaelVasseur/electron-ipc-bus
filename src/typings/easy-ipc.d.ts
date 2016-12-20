///<reference path="../../node_modules/@types/node/index.d.ts"/>

declare module "easy-ipc" {
  import { Stream } from "stream";

  class EasyIpc extends Stream {
    constructor(options?: any);
    connect(port: any, host?: any, cb?: any): any;
    listen(port: any, host?: any, cb?: any): void;
    start(port: any, host?: any, cb?: any): void;
    static Cmd: EasyIpc.Cmd;
  }

  namespace EasyIpc {
    interface Cli {
      //    constructor(ipc: any, conn: any);
      console(mode: any): void;
      consoleRefresh(): void;
      setConnection(conn: any): void;
      writeToConsole(...args: any[]): void;
    }

    interface Cmd {
      //    constructor(ipc: any, conn: any, ...args: any[]);
      add(name: any, func: any, scope: any, doc: any, sig: any): any;
      set(obj: any): any;
      exec(...args: any[]): any;
      introspect(conn: any): void;
      isCmd(d: any): any;
      line2cmd(line: any): any;
      mkCmd(...args: any[]): any;
    }
  }
  export = EasyIpc;
}
