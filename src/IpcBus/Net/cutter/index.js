/*!
 * cutter - lib/cutter.js
 * Copyright(c) 2012-2016 dead-horse<dead_horse@qq.com>
 */

/**
 * Module dependencies.
 */
var EventEmitter = require('events');
var util = require('util');
var assert = require('assert');

/**
 * Cutter for buffer
 * @param  {Number}      headLength
 * @param  {Function}    getLength
 */
var Cutter = function(headLength, getLength) {
  assert(typeof getLength === 'function', 'getLength must be type of Function!');
  assert(typeof headLength === 'number', 'headLength must be type of Number!');
  EventEmitter.call(this);
  this.getLength = getLength;
  this.headLength = headLength;
  this.buf = null;
}

util.inherits(Cutter, EventEmitter);

/**
 * handle data events
 * @param  {Buffer} data
 */
Cutter.prototype.handleData = function (data) {
  assert(data instanceof Buffer, 'data should be a buffer');
  if (!this.buf) {
    this.buf = data;
  } else {
    var length = this.buf.length + data.length;
    this.buf = Buffer.concat([this.buf, data], length);
  }
  this.handlePacket();
};

Cutter.prototype.handlePacket = function () {
  if (!this.buf || this.buf.length < this.headLength) {
    return;
  }

  var offset = 0;
  var head = this.buf.slice(offset, offset + this.headLength);

  while (this.buf.length - offset >= this.headLength) {
    var packetSize = this.getLength(head);

    // if packet size error
    if (packetSize <= this.headLength) {
      this.buf = null;
      this.emit('error', new Error('Get invalid packet size'));
      return;
    }

    // if already get packet
    if (this.buf.length - offset >= packetSize) {
      var packet = this.buf.slice(offset, offset + packetSize);
      // move the offset
      offset += packetSize;
      head = this.buf.slice(offset, offset + this.headLength);
      this.emit('packet', packet);
    } else {
      break;
    }
  }

  if (offset === 0) {
    // nothing to do.
  } else if (offset < this.buf.length) {
    this.buf = this.buf.slice(offset, this.buf.length);
  } else {
    this.buf = null;
  }
}

/**
 * destroy the cutter
 */
Cutter.prototype.destroy = function() {
  this.removeAllListeners();
  this.buf = null;
}

Cutter.create = function(headLength, getLength) {
  return new Cutter(headLength, getLength);
}

module.exports = Cutter;
