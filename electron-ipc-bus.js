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

// function MapRefCount(cbAddRef, cbRelease, cbForEach)
// {
//     let refCountMap = new Map
//     this.AddRef(key, value)
//     {
//         console.log("[MapRefCount] Add key : " + util.inspect(key) + "  : value " + util.inspect(value))

//         let refCount = refCountMap.get(key)
//         if (refCount === undefined) {
//             refCount = new Map()
//             // This topic has NOT been subscribed yet, add it to the map
//             refCountMap.set(key, refCount)
//             console.log("[IPCBus:Broker] Subscribe : New topic '" + key + "'")
//         }
//         let counter = refCount.get(value)
//         if (counter === undefined) {
//             // This topic has NOT been already subcribed by this connection, by default 1
//             counter = 1
//             console.log("[IPCBus:Broker] Subscribe : Create subscription to '" + key + "'")
//         }
//         else {
//             ++counter
//         }
//         // Add a reference on this connection
//         refCount.set(value, counter)
//         if ((cbAddRef !== undefined) && (counter == 1))
//         {
//             cbAddRef(key, value)
//         }
//         console.log("[IPCBus:Broker] State : Client #" + value.id + " (" + counter + ") subscribed to '" + key + "'")
//     }
//                 case IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
//                     {
//                         const key = data.args[0];
//                         console.log("[IPCBus:Broker] Unsubscribe : Client #" + value.id + " from '" + key + "'")

//                         let refCount = refCountMap.get(key)
//                         if (refCount == undefined) {
//                             console.warn("[IPCBus:Broker] Unsubscribe : Topic is unknown")
//                         }
//                         else {
//                             // This topic is subscribed
//                             let counter = refCount.get(value);
//                             if (counter === undefined) {
//                                 console.warn("[IPCBus:Broker] Unsubscribe : Client has no more subscriptions already")
//                             }
//                             else {
//                                 // This connection has subscribed to this topic
//                                 --counter
//                                 if (counter > 0) {
//                                     refCount.set(value, counter)
//                                 } else {
//                                     // The connection is no more referenced
//                                     refCount.delete(value)
//                                     if (refCount.size === 0) {
//                                         refCountMap.delete(key)
//                                         console.log("[IPCBus:Broker] Unsubscribe : Topic is no more subscribed : " + key)
//                                     }
//                                 }
//                                 console.log("[IPCBus:Broker] State : Client #" + value.id + " (" + counter + ") subscribed to '" + key + "'")
//                             }
//                         }
//                         break
//                     }
//                 case IPC_BUS_COMMAND_SENDTOPICMESSAGE:
//                     {
//                         const key = data.args[0];
//                         const msgContent = data.args[1];
//                         console.log("[IPCBus:Broker] Received message : Client #" + value.id + " from '" + key + "'")

//                         let refCount = refCountMap.get(key)
//                         if (refCount == undefined) {
//                             console.warn("[IPCBus:Broker] Received message : No subscription on '" + key + "' !")
//                         }
//                         else {
//                             // Send data to subscribed connections
//                             refCount.forEach(function (counter, connKey) {
//                                 BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, key, msgContent, connKey)
//                                 console.log("[IPCBus:Broker] Received message : Forwarded to Client#" + connKey.id)
//                             });
//                         }
//                         break
//                     }
//                 case IPC_BUS_COMMAND_QUERYSTATE:
//                     {
//                         const key = data.args[0];
//                         console.log("[IPCBus:Broker] QueryState message reply on topic : " + key)
//                         const brokerState = []
//                         refCountMap.forEach(function (connectionMap, key) {
//                             const topicInfo = { topic: key, connCount: connectionMap.size, subCount: 0 }
//                             connectionMap.forEach(function (subCount) {
//                                 topicInfo.subCount += subCount
//                             })
//                             brokerState.push(topicInfo)
//                         })
//                         BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, key, brokerState, value)
//                         break
//                     }




function _cleanUpConn(ipcbus, conn) {

    // Unsubscribe topics
    ipcbus._subscriptions.forEach(function (subs, topic) {
        subs.delete(conn)
    })
}

function _brokerListeningProc(ipcbus, baseIpc, busPath, server) {

    const BaseIpc = require(BASE_IPC_MODULE)

    console.log("[IPCBus:Broker] Listening for incoming connections on '" + busPath + "' ...")

    baseIpc.on('connection', function (conn, server) {

        console.log("[IPCBus:Broker] Incoming connection !")

        conn.on("error", function (err) {

            console.log("[IPCBus:Broker] Error on connection : " + err)
        })
    })

    baseIpc.on('data', function (data, conn, server) {

        if (BaseIpc.Cmd.isCmd(data) == true) {

            switch (data.name) {

                case IPC_BUS_COMMAND_SUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0]
                        console.log("[IPCBus:Broker] Subscribe : Client #" + conn.id + " to '" + msgTopic + "'")

                        let topicSubs = ipcbus._subscriptions.get(msgTopic)
                        if (topicSubs === undefined) {
                            topicSubs = new Map()
                            // This topic has NOT been subscribed yet, add it to the map
                            ipcbus._subscriptions.set(msgTopic, topicSubs)
                            console.log("[IPCBus:Broker] Subscribe : New topic '" + msgTopic + "'")
                        }
                        let connRefsCounter = topicSubs.get(conn)
                        if (connRefsCounter === undefined) {
                            // This topic has NOT been already subcribed by this connection, by default 1
                            connRefsCounter = 1
                            console.log("[IPCBus:Broker] Subscribe : Create subscription to '" + msgTopic + "'")
                        }
                        else {
                            ++connRefsCounter
                        }
                        // Add a reference on this connection
                        topicSubs.set(conn, connRefsCounter)
                        console.log("[IPCBus:Broker] State : Client #" + conn.id + " (" + connRefsCounter + ") subscribed to '" + msgTopic + "'")
                        break
                    }
                case IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0];
                        console.log("[IPCBus:Broker] Unsubscribe : Client #" + conn.id + " from '" + msgTopic + "'")

                        let topicSubs = ipcbus._subscriptions.get(msgTopic)
                        if (topicSubs == undefined) {
                            console.warn("[IPCBus:Broker] Unsubscribe : Topic is unknown")
                        }
                        else {
                            // This topic is subscribed
                            let connRefsCounter = topicSubs.get(conn);
                            if (connRefsCounter === undefined) {
                                console.warn("[IPCBus:Broker] Unsubscribe : Client has no more subscriptions already")
                            }
                            else {
                                // This connection has subscribed to this topic
                                --connRefsCounter
                                if (connRefsCounter > 0) {
                                    topicSubs.set(conn, connRefsCounter)
                                } else {
                                    // The connection is no more referenced
                                    topicSubs.delete(conn)
                                    if (topicSubs.size === 0) {
                                        ipcbus._subscriptions.delete(msgTopic)
                                        console.log("[IPCBus:Broker] Unsubscribe : Topic is no more subscribed : " + msgTopic)
                                    }
                                }
                                console.log("[IPCBus:Broker] State : Client #" + conn.id + " (" + connRefsCounter + ") subscribed to '" + msgTopic + "'")
                            }
                        }
                        break
                    }
                case IPC_BUS_COMMAND_SENDTOPICMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        console.log("[IPCBus:Broker] Received message : Client #" + conn.id + " from '" + msgTopic + "'")

                        let topicSubs = ipcbus._subscriptions.get(msgTopic)
                        if (topicSubs == undefined) {
                            console.warn("[IPCBus:Broker] Received message : No subscription on '" + msgTopic + "' !")
                        }
                        else {
                            // Send data to subscribed connections
                            topicSubs.forEach(function (connRefsCounter, connKey) {
                                BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, msgContent, connKey)
                                console.log("[IPCBus:Broker] Received message : Forwarded to Client#" + connKey.id)
                            });
                        }
                        break
                    }
                case IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0];
                        console.log("[IPCBus:Broker] QueryState message reply on topic : " + msgTopic)
                        const brokerState = []
                        ipcbus._subscriptions.forEach(function (connectionMap, msgTopic) {
                            const topicInfo = { topic: msgTopic, connCount: connectionMap.size, subCount: 0 }
                            connectionMap.forEach(function (subCount) {
                                topicInfo.subCount += subCount
                            })
                            brokerState.push(topicInfo)
                        })
                        BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, brokerState, conn)
                        break
                    }
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

    if (callback !== undefined) {

        callback('connect', ipcbus._connection)
    }

    baseIpc.on('data', function (data, conn) {

        if (BaseIpc.Cmd.isCmd(data) == true) {

            switch (data.name) {

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

function _getCmdLineArgValue(argName) {

    for (let i = 0; i < process.argv.length; i++) {

        if (process.argv[i].startsWith("--" + argName)) {
            const argValue = process.argv[i].split("=")[1];
            return argValue;
        }
    }
    return null;
}

// Implementation for Renderer process
function IpcBusRendererClient(ipcObj) {

    EventEmitter.call(this)

    if (ipcObj === undefined || ipcObj === null) {

        ipcObj = require('electron').ipcRenderer
    }

    const self = this
    let connected = null

    ipcObj.on(IPC_BUS_RENDERER_RECEIVE, function (eventOrTopic, topicOrContent, contentOrUndefined) {
        // In sandbox mode, 1st parameter is no more the event, but the 2nd argument !!!
        if (contentOrUndefined === undefined) {
            console.log("[IPCBus:Client] Received message on '" + eventOrTopic + "'")
            EventEmitter.prototype.emit.call(self, eventOrTopic, eventOrTopic, topicOrContent)
        }
        else {
            console.log("[IPCBus:Client] Received message on '" + topicOrContent + "'")
            EventEmitter.prototype.emit.call(self, topicOrContent, topicOrContent, contentOrUndefined)
        }
    })

    // Set API
    this.connect = function (callback) {
        if (connected == false) {
            throw new Error("Connection is closed")
        }
        // connect can be called multiple times
        connected = true
        setTimeout(function () {
            callback('connect')
        }, 1)
    }

    this.close = function () {
        connected = false
    }

    this.send = function (topic, data) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_SEND, topic, data)
    }

    this.queryBrokerState = function (topic) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_RENDERER_QUERYSTATE, topic)
    }

    this.subscribe = function (topic, handler) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        EventEmitter.prototype.addListener.call(this, topic, handler)
        ipcObj.send(IPC_BUS_RENDERER_SUBSCRIBE, topic)
    }

    this.unsubscribe = function (topic, handler) {
        if (connected != true) {
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

    if (process.type === "browser" && (ipcObj === undefined || ipcObj === null)) {
        ipcObj = require("electron").ipcMain
    }

    // Setup
    const self = this
    if (busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    let busConn = null
    let ipcCmd = null

    let topicRendererRefs = new Map

    let rendererSubscribeHandler = function _rendererSubscribeHandler(msgTopic, msgContent) {
         var topicRendererRef = topicRendererRefs.get(msgTopic)
         if (topicRendererRef === undefined) {
            console.warn("[IPCBus:Bridge] No subscription to topic '" + msgTopic + "'")
         }
         else {
             topicRendererRef.forEach(function(rendererCount, renderer) {
                 console.log("[IPCBus:Bridge] Forward message received on '" + msgTopic + "' to renderer ID=" + renderer.id)
                 renderer.send(IPC_BUS_RENDERER_RECEIVE, msgTopic, msgContent)
             })
         }
    }

    let startRendererBridge = function _startRendererBridge(ipcbus, ipcMain) {
        ipcMain.addListener(IPC_BUS_RENDERER_SUBSCRIBE, function (event, topic) {
            console.log("[IPCBus:Bridge] Subscribe renderer ID=" + event.sender.id + " to topic '" + topic + "'")
            var topicRendererRef = topicRendererRefs.get(topic)
            if (topicRendererRef === undefined) {
                topicRendererRef = new Map
                topicRendererRef.set(event.sender, 1)
                topicRendererRefs.set(topic, topicRendererRef)
                console.log("[IPCBus:Bridge] Subscribe forward subscribe to IPC Broker")
                ipcbus.subscribe(topic, rendererSubscribeHandler)
            }
            else {
                var rendererRef = topicRendererRef.get(event.sender)
                if (rendererRef === undefined) {
                    rendererRef = 1;
                }
                else {
                    ++rendererRef
                }
                topicRendererRef.set(event.sender, rendererRef)
            }
            //            console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " susbcribed to '" + topic + "' (" + ipcbus.listenerCount(topic) + " listeners)")
        })

        ipcMain.addListener(IPC_BUS_RENDERER_SEND, function (event, topic, data) {
            console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " sent message on '" + topic + "'")
            ipcbus.send(topic, data)
        })

        ipcMain.addListener(IPC_BUS_RENDERER_UNSUBSCRIBE, function (event, topic) {
            console.log("[IPCBus:Bridge] Unsubscribe renderer ID=" + event.sender.id + " from topic : '" + topic + "'")
            var topicRendererRef = topicRendererRefs.get(topic)
            if (topicRendererRef === undefined) {
            }
            else {
                var rendererRef = topicRendererRef.get(event.sender)
                if (rendererRef === undefined) {
                }
                else {
                    --rendererRef
                    if (rendererRef > 0) {
                        topicRendererRef.set(event.sender, rendererRef)
                    }
                    else {
                        topicRendererRef.delete(event.sender)
                    }
                    if (topicRendererRef.size == 0) {
                        topicRendererRefs.delete(topic)
                        console.log("[IPCBus:Bridge] Unsubscribe forward unsubscribe to IPC Broker")
                        ipcbus.unsubscribe(topic, rendererSubscribeHandler)
                    }
                }
            }
            console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " unsusbcribed from '" + topic + "'")
        })

        ipcMain.addListener(IPC_BUS_RENDERER_QUERYSTATE, function (event, topic, data) {
            console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " queryed broker's state")
            ipcbus.queryBrokerState(topic)
        })
    }

    if (ipcObj !== undefined && ipcObj !== null) {
        // We are in main process, need to run the renderer bridge
        startRendererBridge(self, ipcObj)
    }

    // Set API
    this.connect = function (callback) {
        baseIpc.on('connect', function (conn) {

            busConn = conn

            _clientConnectProc(self, baseIpc, ipcCmd, busPath, busConn, callback)
        })
        baseIpc.connect(busPath)
    }

    this.close = function () {

        busConn.end()
    }

    this.send = function (topic, data) {

        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SENDTOPICMESSAGE, topic, data, busConn)
    }

    this.queryBrokerState = function (topic) {

        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_QUERYSTATE, topic, busConn)
    }

    this.subscribe = function (topic, handler) {

        EventEmitter.prototype.addListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_SUBSCRIBETOPIC, topic, busConn)
    }

    this.unsubscribe = function (topic, handler) {

        EventEmitter.prototype.removeListener.call(this, topic, handler)
        BaseIpc.Cmd.exec(IPC_BUS_COMMAND_UNSUBSCRIBETOPIC, topic, busConn)
    }

    console.log("[IPCBus:Bridge] Installed")
}

util.inherits(IpcBusNodeClient, EventEmitter)

// Implementation for Broker process
function IpcBusBroker(busPath, brokerProc) {

    EventEmitter.call(this)

    if (busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }
    if (brokerProc === undefined || brokerProc === null) {

        brokerProc = _brokerListeningProc
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    const self = this
    let ipcServer = null

    this._subscriptions = new Map()

    // Set API
    this.start = function () {

        baseIpc.on('listening', function (server) {
            ipcServer = server
            brokerProc(self, baseIpc, busPath, server)
        })
        baseIpc.listen(busPath)
    }

    this.stop = function () {

        ipcServer.close()
        ipcServer = null
    }
}

// Export instance depending current process type
module.exports = function () {
    const processType = arguments.length >= 1 ? arguments[0] : process.type
    const arg1 = arguments.length >= 2 ? arguments[1] : null
    const arg2 = arguments.length >= 3 ? arguments[2] : null
    switch (processType) {
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