/// <reference path="../../typings/lazy.d.ts" />

import * as net from 'net';
// import * as stream from 'stream';
import * as Lazy from 'lazy';
import { EventEmitter } from 'events';

export class Ipc extends EventEmitter {
  private socketPath: string;
  private port: number;
  private host: string;

  private reconnect: boolean;
  private delayReconnect: number;

  private dataType: string;

  private numReconnects: number;

  constructor(options?: any) {
    super();

    options = options || {};

    this.socketPath = options.socketPath != null ? options.socketPath : false;
    this.port = options.port != null ? options.port : 7100;
    this.host = options.host != null ? options.host : 'localhost';

    this.reconnect = options.reconnect != null ? options.reconnect : true;
    this.delayReconnect = options.delayReconnect != null ? options.delayReconnect : 3000;

    this.dataType = options.dataType != null ? options.dataType : 'json';

    this.numReconnects = 0;
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

    port = port || this.socketPath || this.port;
    host = host || (!isNaN(port) ? this.host : null);
    cb = cb || function () { };

    let conn: any;

    let onError = (err: any): void => {
      conn.removeAllListeners('connect');
      if (err.code === 'ENOENT' && isNaN(port) && this.port) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.connect(this.port, cb);
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
      conn.removeAllListeners('error');

      this._parseStream(conn);

      conn.on('close', (had_error: any) => {
        this.emit('close', had_error, conn);

        // reconnect
        if (this.reconnect) {
          this._reconnect(port, host);
        }
      });

      cb(null, conn);

      if (this.numReconnects > 0) {
        this.emit('reconnect', conn);
        this.numReconnects = 0;
      }
      else {
        this.emit('connect', conn);
      }
    };

    if (port && host) {
      conn = net.connect(port, host);
    }
    else {
      conn = net.connect(port);
    }

    conn.once('error', (err: any) => onError(err));
    conn.once('connect', () => onConnect());
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

    port = port || this.socketPath || this.port;
    host = host || (!isNaN(port) ? this.host : null);
    cb = cb || function () { };

    let server = net.createServer();

    let onError = (err: any): void => {
      if (err.code === 'EACCES' && isNaN(port) && this.port) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.listen(this.port, cb);
        return;
      }
      cb(err);
      this.emit('error', err);
    };

    let onConnection = (conn: any): void => {
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

    port = port || this.socketPath || this.port;
    host = host || (!isNaN(port) ? this.host : null);
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

    let onListening = (server: any): void => {
      this.removeAllListeners('error');
      this.removeAllListeners('connection');
      this.removeAllListeners('connect');
      cb(null, true, server);
    };

    let onConnection = (conn: any, server: any): void => {
      this.removeAllListeners('error');
      this.removeListener('listening', onListening);
      this.removeListener('connect', onConnect);
      cb(null, true, conn, server);
    };

    let onConnect = (conn: any): void => {
      this.removeListener('error', onError);
      this.removeAllListeners('listening');
      this.removeAllListeners('connect');
      cb(null, false, conn);
    };

    this.once('error', (err: any) => onError(err));
    this.once('listening', (server: any) => onListening(server));
    this.once('connection', (conn: any, server: any) => onConnection(conn, server));
    this.once('connect', (conn: any) => onConnect(conn));

    this.connect(port, host);
  }

  private _parseStream(conn: any, server?: any) {
    // each line of the stream is one unit of data
    Lazy(conn, null).lines.map(String).forEach(this._onData.bind(this, conn, server));

    // overwrite .write() of the connection
    let old_write = conn.write;
    conn.write = (...args: any[]) => {
      if (conn.writable) {
        if (this.dataType === 'json') {
          args[0] = JSON.stringify(args[0]) + '\n';
        }
        return old_write.apply(conn, args);
      }
      else {
        this.emit('warn', new Error('Connection is not writable.'));
      }
    };
  }

  private _onData(conn: any, server: any, data: any) {
    if (this.dataType === 'json') {
      data = JSON.parse(data);
    }

    if (server) {
      this.emit('data', data, conn, server);
    }
    else {
      this.emit('data', data, conn);
    }
  }
}