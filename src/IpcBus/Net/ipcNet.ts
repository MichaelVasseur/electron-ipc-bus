import * as net from 'net';
// import * as util from 'util';
import { EventEmitter } from 'events';

export class IpcNet extends EventEmitter {
  private socketPath: string;
  private defaultPort: number;
  private defaultHost: string;

  private reconnect: boolean;
  private delayReconnect: number;

  private numReconnects: number;

  private _socket: net.Socket;

  constructor(options?: any) {
    super();

    options = options || {};

    this.socketPath = options.socketPath != null ? options.socketPath : false;
    this.defaultPort = options.port != null ? options.port : 7100;
    this.defaultHost = options.host != null ? options.host : 'localhost';

    this.numReconnects = 0;
    this.reconnect = options.reconnect != null ? options.reconnect : true;
    this.delayReconnect = options.delayReconnect != null ? options.delayReconnect : 3000;
  }

  // on(event: 'connect', handler: (socket: net.Socket) => void): this;
  // on(event: 'reconnect', handler: (socket: net.Socket) => void): this;
  // on(event: 'connection', handler: (socket: net.Socket, server: net.Server) => void): this;
  // on(event: 'listening', handler: (server: net.Server) => void): this;
  // on(event: 'close', handler: (had_error: boolean, socket: net.Socket, server?: net.Server) => void): this;
  // on(event: 'error', handler: (err: NodeJS.ErrnoException) => void): this;
  // on(event: 'warn', handler: (err: Error) => void): this;
  // on(event: 'data', handler: (buffer: Buffer, socket: net.Socket, server?: net.Server) => void): this;
  // on(event: string, handler: Function): this {
  //   return super.on(event, handler);
  // }

  private _onSocketConnect(socket: net.Socket, port: number, host: string, cb: Function): void {
    socket.removeAllListeners('error');

    this._parseStream(socket);

    socket.on('close', (had_error: any) => {
      this.emit('close', had_error, socket);

      // reconnect
      if (this.reconnect) {
        this._reconnect(port, host);
      }
    });

    cb(null, socket);

    if (this.numReconnects > 0) {
      this.emit('reconnect', socket);
      this.numReconnects = 0;
    }
    else {
      this.emit('connect', socket);
    }
  }

  private _onSocketError(err: NodeJS.ErrnoException, port: number, host: string, cb: Function): void {
    this._socket.removeAllListeners('connect');

    if ((err.code === 'ENOENT') && isNaN(port) && this.defaultPort) {
      this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
      this.connect(this.defaultPort, cb);
      return;
    }
    if ((err.code === 'ECONNREFUSED') && this.numReconnects) {
      this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
      return this._reconnect(port, host);
    }
    cb(err);
    this.emit('error', err);
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

    if (port && host) {
      this._socket = net.connect(port, host);
    }
    else {
      this._socket = net.connect(port);
    }

    this._socket.once('error', (err: NodeJS.ErrnoException) => {
      this._onSocketError(err, port, host, cb);
    });
    this._socket.once('connect', () => {
      this._onSocketConnect(this._socket, port, host, cb);
    });
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

  private _onServerError(err: NodeJS.ErrnoException, port: number, host: string, cb: Function): void {
    if ((err.code === 'EACCES') && isNaN(port) && this.defaultPort) {
      this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
      this.listen(this.defaultPort, cb);
      return;
    }
    cb(err);
    this.emit('error', err);
  }

  private _onServerConnection(socket: net.Socket, server: net.Server, cb: Function): void {
    this._socket = socket;
    this._parseStream(socket, server);

    socket.on('close', (had_error: boolean) => {
      this.emit('close', had_error, socket, server);
    });

    cb(null, socket, server);
    this.emit('connection', socket, server);
  }

  private _onServerListening(server: net.Server): void {
    server.removeAllListeners('error');
    this.emit('listening', server);
  };

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

    server.once('error', (err: NodeJS.ErrnoException) => {
      this._onServerError(err, port, host, cb);
    });
    server.once('listening', () => {
      this._onServerListening(server);
    });
    server.on('connection', (socket) => {
      this._onServerConnection(socket, server, cb);
    });

    if (port && host) {
      server.listen(port, host);
    }
    else {
      server.listen(port);
    }
  }

  // start(port: any, host: any, cb: any) {
  //   if (port instanceof Function) {
  //     cb = port;
  //     port = null;
  //   }
  //   if (host instanceof Function) {
  //     cb = host;
  //     host = null;
  //   }

  //   port = port || this.socketPath || this.defaultPort;
  //   host = host || (!isNaN(port) ? this.defaultHost : null);
  //   cb = cb || function () { };

  //   let onError = (err: any): void => {
  //     if (err.code === 'ECONNREFUSED') {
  //       this.emit('warn', new Error(err.code + ' on ' + port + ', ' + host));
  //       this.listen(port, host);
  //     }
  //     else {
  //       this.removeAllListeners('listening');
  //       this.removeAllListeners('connection');
  //       this.removeAllListeners('connect');
  //       cb(err);
  //       this.emit('error', err);
  //     }
  //   };

  //   let onListening = (server: net.Server): void => {
  //     this.removeAllListeners('error');
  //     this.removeAllListeners('connection');
  //     this.removeAllListeners('connect');
  //     cb(null, true, server);
  //   };

  //   let onConnection = (socket: net.Socket, server: net.Server): void => {
  //     this.removeAllListeners('error');
  //     this.removeListener('listening', onListening);
  //     this.removeListener('connect', onConnect);
  //     cb(null, true, socket, server);
  //   };

  //   let onConnect = (socket: net.Socket): void => {
  //     this.removeListener('error', onError);
  //     this.removeAllListeners('listening');
  //     this.removeAllListeners('connect');
  //     cb(null, false, socket);
  //   };

  //   this.once('error', (err: any) => onError(err));
  //   this.once('listening', (server: net.Server) => onListening(server));
  //   this.once('connection', (socket: net.Socket, server: net.Server) => onConnection(socket, server));
  //   this.once('connect', (socket: net.Socket) => onConnect(socket));

  //   this.connect(port, host);
  // }

  protected _parseStream(socket: net.Socket, server?: net.Server) {
    socket.on('data', (buffer: Buffer) => {
        this.emit('data', buffer, socket, server);
    });
  }
}
