'use strict'

// Common modules
const os = require('os')
const path = require('path')
const util = require('util')
const EventEmitter = require('events').EventEmitter
const Module = require('module')
const uuid = require("uuid");

// Constants
const IPC_BUS_TOPIC_SUBSCRIBE = 'IPC_BUS_TOPIC_SUBSCRIBE'
const IPC_BUS_TOPIC_SEND = 'IPC_BUS_TOPIC_SEND'
const IPC_BUS_TOPIC_UNSUBSCRIBE = 'IPC_BUS_TOPIC_UNSUBSCRIBE'

const IPC_BUS_BROKER_STATUS_TOPIC = 'IPC_BUS_BROKER_STATUS_TOPIC'

const IPC_BUS_RENDERER_SUBSCRIBE = 'IPC_BUS_RENDERER_SUBSCRIBE'
const IPC_BUS_RENDERER_SEND = 'IPC_BUS_RENDERER_SEND'
const IPC_BUS_RENDERER_UNSUBSCRIBE = 'IPC_BUS_RENDERER_UNSUBSCRIBE'
const IPC_BUS_RENDERER_RECEIVE = 'IPC_BUS_RENDERER_RECEIVE'
const IPC_BUS_RENDERER_QUERYSTATE = 'IPC_BUS_RENDERER_QUERYSTATE'

const IPC_BUS_COMMAND_SUBSCRIBETOPIC = 'subscribeTopic'
const IPC_BUS_COMMAND_UNSUBSCRIBETOPIC = 'unsubscribeTopic'
const IPC_BUS_COMMAND_SENDTOPICMESSAGE = 'sendTopicMessage'
const IPC_BUS_COMMAND_QUERYSTATE = 'queryState'
const IPC_BUS_EVENT_TOPICMESSAGE = 'onTopicMessage'

const BASE_IPC_MODULE = 'easy-ipc'

function _cleanUpConn(ipcbus, conn) {

    // Unsubscribe topics
    ipcbus._subscriptions.forEach(function(subs, topic) {
        subs.delete(conn)
    })
}

function _brokerListeningProc(ipcbus, baseIpc, busPath, server) {

    const BaseIpc = require(BASE_IPC_MODULE)

    console.log("[IPCBus:Broker] Listening for incoming connections on '" + busPath + "' ...")
    
    baseIpc.on('connection', function (conn, server) {

        console.log("[IPCBus:Broker] Incoming connection !")

        conn.on("error", function(err) {
            
             console.log("[IPCBus:Broker] Error on connection : " + err)
        })
    })

    baseIpc.on('data', function (data, conn, server) {

        if( BaseIpc.Cmd.isCmd(data) == true ) {

            switch(data.name) {
            
            case IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                const subTopic = data.args[0]
                if (ipcbus._subscriptions.has(subTopic) === false) {
                    // This topic has NOT been subscribed yet, add it to the map
                    ipcbus._subscriptions.set(subTopic, new Map())
                    console.log("[IPCBus:Broker] New subscribed topic : " + subTopic)
                }
                if (ipcbus._subscriptions.get(subTopic).has(conn) === false) {
                    // This topic has NOT been already subcribed by this connection
                    ipcbus._subscriptions.get(subTopic).set(conn, 0)
                    console.log("[IPCBus:Broker] Added subscription to '" + subTopic + "'")
                }

                // Add a reference on this connection
                ipcbus._subscriptions.get(subTopic).set(conn, ipcbus._subscriptions.get(subTopic).get(conn) + 1)
                console.log("[IPCBus:Broker] Client #" + conn.id + " subscribed to '" + subTopic + "'")
                break

            case IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                const unsubTopic = data.args[0];
                if (ipcbus._subscriptions.has(unsubTopic) === true) {
                    // This topic is subscribed
                    const topicSubs = ipcbus._subscriptions.get(unsubTopic)
                    if(topicSubs.has(conn) === true) {
                        // This connection has subscribed to this topic
                        const newConnRefCount = topicSubs.get(conn) - 1
                        if(newConnRefCount > 0) {
                            topicSubs.set(conn, newConnRefCount)
                        } else {
                            // The connection is no more referenced
                            topicSubs.delete(conn)
                        }
                    }
                    if(topicSubs.length === 0) {
                        ipcbus._subscriptions.delete(unsubTopic)
                        console.log("[IPCBus:Broker] Topic is no more subscribed : " + unsubTopic)
                    }
                }
                break

            case IPC_BUS_COMMAND_SENDTOPICMESSAGE:
                const msgTopic = data.args[0];
                const msgContent = data.args[1];
                console.log("[IPCBus:Broker] Received message on topic : " + msgTopic)
                if (ipcbus._subscriptions.has(msgTopic) === true) {
                    // Send data to subscribed connections
                    const subscriptions = ipcbus._subscriptions.get(msgTopic)
                    subscriptions.forEach(function(refs, conn) {
                        BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, msgContent, conn)
                        console.log("[IPCBus:Broker] Forwarded ")
                    });
                } else {
                    console.log("[IPCBus:Broker] No subscription on '" + msgTopic + "' !")
                }
                break

            case IPC_BUS_COMMAND_QUERYSTATE:
                const brokerState = []
                ipcbus._subscriptions.forEach(function(connectionMap, topicName) {
                    const topicInfo = { topic: topicName, connCount: connectionMap.size, subCount: 0 }
                    connectionMap.forEach(function(subCount) {
                        topicInfo.subCount += subCount
                    })
                    brokerState.push(topicInfo)
                })
                BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, IPC_BUS_BROKER_STATUS_TOPIC, brokerState, conn)
                break
            }
        }
    })

    baseIpc.on('close', function (err, conn, server) {

        _cleanUpConn(ipcbus, conn)

        console.log("[IPCBus:Broker] Connection closed !")
    })
}

function _clientConnectProc(ipcbus, baseIpc, cmd, busPath, conn, callback) {

    console.log("[IPCBus:Client] Connected to broker on '" + busPath + "'")

    const BaseIpc = require(BASE_IPC_MODULE)

    ipcbus._connection = conn

    if(callback !== undefined) {
        
        callback('connect', ipcbus._connection)
    }

    baseIpc.on('data', function (data, conn) {

        if( BaseIpc.Cmd.isCmd(data) == true ) {

            switch(data.name) {
            
            case IPC_BUS_EVENT_TOPICMESSAGE:
                const msgTopic = data.args[0]
                const msgContent = data.args[1]
                console.log("[IPCBus:Client] Emit message received on topic '" + msgTopic + "'")
                EventEmitter.prototype.emit.call(ipcbus, msgTopic, msgTopic, msgContent)
                break
            }
        }
    })
}

function _rendererSubscribeHandler(target, msgTopic, msgContent) {

    console.log("[IPCBus:Bridge] Forward message received on '" + msgTopic + "' to renderer ID=" + target.id)

    target.send(IPC_BUS_RENDERER_RECEIVE, msgTopic, msgContent)
}

function _startRendererBridge(ipcbus, ipcMain) {
    
    ipcMain.addListener(IPC_BUS_RENDERER_SUBSCRIBE, function (event, topic) {

        console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " susbcribed to '" + topic + "'")

        ipcbus.subscribe(topic, (msgTopic, msgContent) => _rendererSubscribeHandler(event.sender, msgTopic, msgContent)) 
    })

    ipcMain.addListener(IPC_BUS_RENDERER_SEND, function (event, topic, data) { 

        console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " sent message on '" + topic + "'")

        ipcbus.send(topic, data)
    })

    ipcMain.addListener(IPC_BUS_RENDERER_UNSUBSCRIBE, function (event, topic) {

        console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " unsusbcribed from '" + topic + "'")

        ipcbus.unsubscribe(topic, (msgTopic, msgContent) => _rendererSubscribeHandler(event.sender, msgTopic, msgContent))
    })

    ipcMain.addListener(IPC_BUS_RENDERER_QUERYSTATE, function (event, topic, data) { 

        console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " queryed broker's state")

        ipcbus.queryBrokerState()
    })

    console.log("[IPCBus:Bridge] Installed")
}

function _getCmdLineArgValue(argName) {
    
    for(let i = 0; i < process.argv.length; i++) {
            
        if(process.argv[i].startsWith("--" + argName))
        {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

// Implementation for Renderer process
function IpcBusRendererClient(ipcObj) {

    EventEmitter.call(this)

    if(ipcObj === undefined || ipcObj === null) {

        ipcObj = require('electron').ipcRenderer
    }
    
    const self = this
    var connected = false

    ipcObj.on(IPC_BUS_RENDERER_RECEIVE, function(topic, content) {

        console.log("[IPCBus:Client] Received message on '" + topic + "'")
        EventEmitter.prototype.emit.call(self, topic, topic, content)
    })

    // Set API
    this.connect = function(callback) {
        // connect can be called multiple times
        self.connected = true
        setTimeout(callback, 1)
    }

    this.close = function() {
        self.connected = false
    }
    
    this.send = function(topic, data) {
        if (self.connected == false)
        {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_SEND, topic, data)
    }

    this.queryBrokerState = function() {
        if (self.connected == false)
        {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_QUERYSTATE)
    }

    this.subscribe = function(topic, handler) {
        if (self.connected == false)
        {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.addListener.call(this, topic, handler)
        ipcObj.send(IPC_BUS_RENDERER_SUBSCRIBE, topic)
    }

    this.unsubscribe = function(topic, handler) {
        if (self.connected == false)
        {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.removeListener.call(this, topic, handler)
        ipcObj.send(IPC_BUS_RENDERER_UNSUBSCRIBE, topic)
    }
}

util.inherits(IpcBusRendererClient, EventEmitter)

// Implementation for Node process
function IpcBusNodeClient(busPath, ipcObj) {
    
    EventEmitter.call(this)

    if(process.type === "browser" && (ipcObj === undefined || ipcObj === null)) {
        ipcObj = require("electron").ipcMain
    }

     // Setup
    const self = this
    if(busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    let busConn = null
    let ipcCmd = null

    if(ipcObj !== undefined && ipcObj !== null) {
        // We are in main process, need to run the renderer bridge
        _startRendererBridge(self, ipcObj)
    }

    // Set API
    this.connect = function(callback) {
        baseIpc.on('connect', function(conn) {
            
            busConn = conn

            _clientConnectProc(self, baseIpc, ipcCmd, busPath, busConn, callback)
        })
        baseIpc.connect(busPath)
    }

    this.close = function() {

        busConn.close()
    }
    
    this.send = function(topic, data) {
        
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SENDTOPICMESSAGE, topic, data, busConn)
    }

    this.queryBrokerState = function() {

        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_QUERYSTATE, busConn)
    }

    this.subscribe = function(topic, handler) {

        EventEmitter.prototype.addListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, busConn)
    }

    this.unsubscribe = function(topic, handler) {

        EventEmitter.prototype.removeListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, busConn)
    }
}

util.inherits(IpcBusNodeClient, EventEmitter)

// Implementation for Broker process
function IpcBusBroker(busPath, brokerProc) {
    
    EventEmitter.call(this)

    if(busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }
    if(brokerProc === undefined || brokerProc === null) {

        brokerProc = _brokerListeningProc
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    const self = this
    let ipcServer = null

    this._subscriptions = new Map()

    // Set API
    this.start = function() {

        baseIpc.on('listening', function(server) {
            ipcServer = server
            brokerProc(self, baseIpc, busPath, server)
        })
        baseIpc.listen(busPath)
    }

    this.stop = function() {
        
        ipcServer.close()
        ipcServer = null
    }
}

// Export instance depending current process type
module.exports = function() {
  const processType = arguments.length >= 1 ? arguments[0] : process.type  
  const arg1 = arguments.length >= 2 ? arguments[1] : null
  const arg2 = arguments.length >= 3 ? arguments[2] : null
  switch(processType) {
      case 'renderer':
        return new IpcBusRendererClient(arg1) // arg1 = ipcRenderer

      case 'main':
        return new IpcBusNodeClient(arg1, arg2) // arg1 = busPath, arg2 = ipcMain

      case 'broker':
        return new IpcBusBroker(arg1, arg2) // arg1 = busPath, arg2 = customBrokerProc

      case 'bus-uuid':
        return '/electron-ipc-bus/' + uuid.v4();

      default:
        return new IpcBusNodeClient(arg1) // arg1 = busPath
  }
}