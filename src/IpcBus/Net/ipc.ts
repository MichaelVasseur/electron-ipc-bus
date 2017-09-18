/// <reference path="../../typings/lazy.d.ts" />

import * as net from 'net';
import { EventEmitter } from 'events';
import { IpcPacket } from './ipcPacket';

export class Ipc extends EventEmitter {
  private socketPath: string;
  private defaultPort: number;
  private defaultHost: string;

  private reconnect: boolean;
  private delayReconnect: number;

  private numReconnects: number;

  private _ipcPacket: IpcPacket;
  private _socket: net.Socket;

  constructor(options?: any) {
    super();

    this._ipcPacket = new IpcPacket();

    options = options || {};

    this.socketPath = options.socketPath != null ? options.socketPath : false;
    this.defaultPort = options.port != null ? options.port : 7100;
    this.defaultHost = options.host != null ? options.host : 'localhost';

    this.numReconnects = 0;
    this.reconnect = options.reconnect != null ? options.reconnect : true;
    this.delayReconnect = options.delayReconnect != null ? options.delayReconnect : 3000;
  }

  connect(port: any, host?: any, cb?: any) {
    if (port instanceof Function) {
      cb = port;
      port = null;
    }
    if (host instanceof Function) {
      cb = host;
      host = null;
    }

    port = port || this.socketPath || this.defaultPort;
    host = host || (!isNaN(port) ? this.defaultHost : null);
    cb = cb || function () { };

    let onError = (err: any): void => {
      this._socket.removeAllListeners('connect');
      if (err.code === 'ENOENT' && isNaN(port) && this.defaultPort) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.connect(this.defaultPort, cb);
        return;
      }
      if (err.code === 'ECONNREFUSED' && this.numReconnects) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        return this._reconnect(port, host);
      }

      cb(err);
      this.emit('error', err);
    };

    let onConnect = (): void => {
      this._socket.removeAllListeners('error');

      this._parseStream(this._socket);

      this._socket.on('close', (had_error: any) => {
        this.emit('close', had_error, this._socket);

        // reconnect
        if (this.reconnect) {
          this._reconnect(port, host);
        }
      });

      cb(null, this._socket);

      if (this.numReconnects > 0) {
        this.emit('reconnect', this._socket);
        this.numReconnects = 0;
      }
      else {
        this.emit('connect', this._socket);
      }
    };

    if (port && host) {
      this._socket = net.connect(port, host);
    }
    else {
      this._socket = net.connect(port);
    }

    this._socket.once('error', (err: any) => onError(err));
    this._socket.once('connect', () => onConnect());
  }

  private _reconnect(port: any, host: any) {
    this.numReconnects += 1;
    if (this.delayReconnect) {
      setTimeout(() => {
        this.connect(port, host);
      }, this.delayReconnect);
    }
    else {
      this.connect(port, host);
    }
  }

  listen(port: any, host?: any, cb?: any) {
    if (port instanceof Function) {
      cb = port;
      port = null;
    }
    if (host instanceof Function) {
      cb = host;
      host = null;
    }

    port = port || this.socketPath || this.defaultPort;
    host = host || (!isNaN(port) ? this.defaultHost : null);
    cb = cb || function () { };

    let server = net.createServer();

    let onError = (err: any): void => {
      if (err.code === 'EACCES' && isNaN(port) && this.defaultPort) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.listen(this.defaultPort, cb);
        return;
      }
      cb(err);
      this.emit('error', err);
    };

    let onConnection = (conn: net.Socket): void => {
      this._socket = conn;
      this._parseStream(conn, server);

      conn.on('close', (had_error: any) => {
        this.emit('close', had_error, conn, server);
      });

      cb(null, conn, server);
      this.emit('connection', conn, server);
    };

    let onListening = () => {
      server.removeAllListeners('error');
      this.emit('listening', server);
    };

    server.once('error', (err) => onError(err));
    server.once('listening', () => onListening());
    server.on('connection', (conn) => onConnection(conn));

    if (port && host) {
      server.listen(port, host);
    }
    else {
      server.listen(port);
    }
  }

  start(port: any, host: any, cb: any) {
    if (port instanceof Function) {
      cb = port;
      port = null;
    }
    if (host instanceof Function) {
      cb = host;
      host = null;
    }

    port = port || this.socketPath || this.defaultPort;
    host = host || (!isNaN(port) ? this.defaultHost : null);
    cb = cb || function () { };

    let onError = (err: any): void => {
      if (err.code === 'ECONNREFUSED') {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.listen(port, host);
      }
      else {
        this.removeAllListeners('listening');
        this.removeAllListeners('connection');
        this.removeAllListeners('connect');
        cb(err);
        this.emit('error', err);
      }
    };

    let onListening = (server: net.Server): void => {
      this.removeAllListeners('error');
      this.removeAllListeners('connection');
      this.removeAllListeners('connect');
      cb(null, true, server);
    };

    let onConnection = (conn: net.Socket, server: net.Server): void => {
      this.removeAllListeners('error');
      this.removeListener('listening', onListening);
      this.removeListener('connect', onConnect);
      cb(null, true, conn, server);
    };

    let onConnect = (conn: net.Socket): void => {
      this.removeListener('error', onError);
      this.removeAllListeners('listening');
      this.removeAllListeners('connect');
      cb(null, false, conn);
    };

    this.once('error', (err: any) => onError(err));
    this.once('listening', (server: net.Server) => onListening(server));
    this.once('connection', (conn: net.Socket, server: net.Server) => onConnection(conn, server));
    this.once('connect', (conn: net.Socket) => onConnect(conn));

    this.connect(port, host);
  }

  private _parseStream(conn: net.Socket, server?: net.Server) {
    conn.removeAllListeners('data');
    this._ipcPacket.on('packet', (buffer: Buffer) => {
      if (server) {
        this.emit('data', buffer, conn, server);
      }
      else {
        this.emit('data', buffer, conn);
      }
    });
    conn.on('data', (buffer: Buffer) => this._ipcPacket.handleData(buffer));
  }
}
