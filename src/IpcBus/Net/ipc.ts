/// <reference path="../../typings/lazy.d.ts" />

import * as net from 'net';
import * as stream from 'stream';
import * as Lazy from 'lazy';

export class Ipc extends stream.Stream {
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
      conn.removeListener('connect', onConnect);

      if (err.code === 'ENOENT' && isNaN(port) && this.port) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.connect(this.port, cb);
        return;
      } else if (err.code === 'ECONNREFUSED' && this.numReconnects) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        return this._reconnect(port, host);
      }

      cb(err);
      this.emit('error', err);
    }

    let onConnect = (): void => {
      conn.removeListener('error', onError);

      this._parseStream(conn);

      conn.on('close', (had_error: any) => {
        this.emit('close', had_error, conn);

        // reconnect
        if (this.reconnect) {
          this._reconnect(port, host);
        }
      })

      cb(null, conn);

      if (this.numReconnects > 0) {
        this.emit('reconnect', conn);
        this.numReconnects = 0;
      } else {
        this.emit('connect', conn);
      }
    }

    if (port && host) {
      conn = net.connect(port, host);
    } else {
      conn = net.connect(port);
    }

    conn.once('error', onError);
    conn.once('connect', onConnect);
  }

  private _reconnect(port: any, host: any) {
    this.numReconnects += 1;
    if (this.delayReconnect) {
      setTimeout(() => {
        this.connect(port, host);
      }, this.delayReconnect);
    } else {
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

    let onError = (err: any): void => {
      if (err.code === 'EACCES' && isNaN(port) && this.port) {
        this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
        this.listen(this.port, cb);
        return;
      }
      cb(err);
      this.emit('error', err);
    }

    let onConnection = (conn: any): void => {
      this._parseStream(conn, server);

      conn.on('close', (had_error: any) => {
        this.emit('close', had_error, conn, server);
      })

      cb(null, conn, server)
      this.emit('connection', conn, server);
    }

    let server = net.createServer();

    server.once('error', onError);

    server.once('listening', () => {
      server.removeListener('error', onError);
      this.emit('listening', server);
    });

    server.on('connection', onConnection);

    if (port && host) {
      server.listen(port, host);
    } else {
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
      } else {
        this.removeListener('listening', onListening);
        this.removeListener('connection', onConnection);
        this.removeListener('connect', onConnect);
        cb(err);
        this.emit('error', err);
      }
    }

    let onListening = (server: any): void => {
      this.removeListener('error', onError);
      this.removeListener('connection', onConnection);
      this.removeListener('connect', onConnect);
      cb(null, true, server);
    }

    let onConnection = (conn: any, server: any): void => {
      this.removeListener('error', onError);
      this.removeListener('listening', onListening);
      this.removeListener('connect', onConnect);
      cb(null, true, conn, server);
    }

    let onConnect = (conn: any): void => {
      this.removeListener('error', onError);
      this.removeListener('listening', onListening);
      this.removeListener('connection', onConnection);
      cb(null, false, conn);
    }

    this.once('error', onError);
    this.once('listening', onListening);
    this.once('connection', onConnection);
    this.once('connect', onConnect);

    this.connect(port, host);
  }

  private _parseStream(conn: any, server?: any) {
    // each line of the stream is one unit of data
    Lazy(conn, null).lines.map(String).forEach(this._onData.bind(this, conn, server));

    // overwrite .write() of the connection
    let old_write = conn.write;
    conn.write = function () {
      if (conn.writable) {
        if (this.dataType === 'json') {
          arguments[0] = JSON.stringify(arguments[0]) + '\n';
        }
        return old_write.apply(conn, arguments);
      } else {
        this.emit('warn', new Error('Connection is not writable.'));
      }
    }
  }

  private _onData(conn: any, server: any, data: any) {
    if (this.dataType === 'json') {
      data = JSON.parse(data)
    }

    if (server) {
      this.emit('data', data, conn, server)
    } else {
      this.emit('data', data, conn)
    }
  }
}