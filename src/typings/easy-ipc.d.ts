///<reference types="node"/>

declare module "easy-ipc" {
  import { Stream } from "stream";

  class EasyIpc extends Stream {
    constructor(options?: any);
    connect(port: any, host?: any, cb?: any): any;
    listen(port: any, host?: any, cb?: any): void;
    start(port: any, host?: any, cb?: any): void;
  }

  namespace EasyIpc {
    class Cli {
      constructor(ipc: any, conn: any);
      console(mode: any): void;
      consoleRefresh(): void;
      setConnection(conn: any): void;
      writeToConsole(...args: any[]): void;
    }

    class Cmd {
      constructor(ipc: any, conn: any, ...args: any[]);
      add(name: any, func: any, scope: any, doc: any, sig: any): any;
      set(obj: any): any;
      static exec(...args: any[]): any;
      static introspect(conn: any): void;
      static isCmd(d: any): any;
      static line2cmd(line: any): any;
      static mkCmd(...args: any[]): any;
    }
  }
  export = EasyIpc;
}
