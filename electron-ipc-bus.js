'use strict'

// Common modules
const os = require('os')
const path = require('path')
const util = require('util')
const EventEmitter = require('events').EventEmitter
const Module = require('module')
const uuid = require("uuid")

// Constants
const IPC_BUS_TOPIC_SUBSCRIBE = 'IPC_BUS_TOPIC_SUBSCRIBE'
const IPC_BUS_TOPIC_SEND = 'IPC_BUS_TOPIC_SEND'
const IPC_BUS_TOPIC_UNSUBSCRIBE = 'IPC_BUS_TOPIC_UNSUBSCRIBE'

const IPC_BUS_RENDERER_SUBSCRIBE = 'IPC_BUS_RENDERER_SUBSCRIBE'
const IPC_BUS_RENDERER_SEND = 'IPC_BUS_RENDERER_SEND'
const IPC_BUS_RENDERER_UNSUBSCRIBE = 'IPC_BUS_RENDERER_UNSUBSCRIBE'
const IPC_BUS_RENDERER_RECEIVE = 'IPC_BUS_RENDERER_RECEIVE'
const IPC_BUS_RENDERER_QUERYSTATE = 'IPC_BUS_RENDERER_QUERYSTATE'
const IPC_BUS_MASTER_QUERYSTATE = 'IPC_BUS_MASTER_QUERYSTATE'

const IPC_BUS_COMMAND_SUBSCRIBETOPIC = 'subscribeTopic'
const IPC_BUS_COMMAND_UNSUBSCRIBETOPIC = 'unsubscribeTopic'
const IPC_BUS_COMMAND_SENDTOPICMESSAGE = 'sendTopicMessage'
const IPC_BUS_COMMAND_QUERYSTATE = 'queryState'
const IPC_BUS_EVENT_TOPICMESSAGE = 'onTopicMessage'

const BASE_IPC_MODULE = 'easy-ipc'

function MapRefCount() {
    let keyValueCountMap = new Map

    this.AddRef = function _AddRef(key, value, callback) {
        console.log("[MapRefCount] AddRef : " + key + "  : value " + value)

        let valueCountMap = keyValueCountMap.get(key)
        if (valueCountMap === undefined) {
            valueCountMap = new Map()
            // This topic has NOT been subscribed yet, add it to the map
            keyValueCountMap.set(key, valueCountMap)
            console.log("[MapRefCount] AddRef : key is added")
        }
        let count = valueCountMap.get(value)
        if (count === undefined) {
            // This topic has NOT been already subcribed by this connection, by default 1
            count = 1
        }
        else {
            ++count
        }
        valueCountMap.set(value, count)
        console.log("[MapRefCount] AddRef : count = " + count)
        if (callback !== null) {
            callback(key, value, count)
        }
    }

    this.Release = function _Release(key, value, callback) {
        console.log("[MapRefCount] Release : " + key + " value " + value)

        let valueCountMap = keyValueCountMap.get(key)
        if (valueCountMap == undefined) {
            console.warn("[MapRefCount] Release : key '" + key + "' is unknown")
        }
        else {
            // This topic is subscribed
            let count = valueCountMap.get(value);
            if (count === undefined) {
                console.warn("[MapRefCount] Release : value is undefined")
            }
            else {
                // This connection has subscribed to this topic
                --count
                if (count > 0) {
                    valueCountMap.set(value, count)
                } else {
                    // The connection is no more referenced
                    valueCountMap.delete(value)
                    if (valueCountMap.size === 0) {
                        keyValueCountMap.delete(key)
                        console.log("[MapRefCount] Release : key '" + key + "' is released")
                    }
                }
                console.log("[MapRefCount] Release : count = " + count)
                if (callback !== null) {
                    callback(key, value, count)
                }
            }
        }
    }

    this.ForEach = function _ForEach(callback) {
        console.log("[MapRefCount] ForEach : " + key)

        if (callback === null) {
            console.warn("[MapRefCount] ForEach : No callback provided !")
            return;
        }

        // Send data to subscribed connections
        keyValueCountMap.forEach(function (valuesMap, key) {
            //            console.warn("[MapRefCount] ForEachValue : '" + key + "' = " + valuesMap + " (" + count + ")")
            callback(valuesMap, key)
        });
    }

    this.ForEachKey = function _ForEachKey(key, callback) {
        console.log("[MapRefCount] ForEachKey : " + key)

        if (callback === null) {
            console.warn("[MapRefCount] ForEachKey : No callback provided !")
            return;
        }

        let valueCountMap = keyValueCountMap.get(key)
        if (valueCountMap == undefined) {
            console.warn("[MapRefCount] ForEachKey : No key '" + key + "' !")
        }
        else {
            valueCountMap.forEach(function (count, value) {
                console.warn("[MapRefCount] ForEachKey : '" + key + "' = " + value + " (" + count + ")")
                callback(count, value, key)
            });
        }
    }

    this.QueryState = function _QueryState(callback) {
        console.log("[MapRefCount] QueryState")
        if (callback === null) {
            console.warn("[MapRefCount] QueryState : No callback provided !")
            return;
        }

        const queryStateResult = []
        keyValueCountMap.forEach(function (valueCountMap, key) {
            const keyValueInfo = { key: key, valueCount: valueCountMap.size, subCount: 0 }
            valueCountMap.forEach(function (subCount) {
                keyValueInfo.subCount += subCount
            })
            queryStateResult.push(keyValueInfo)
        })
        callback(queryStateResult)
    }
}


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
                        ipcbus._subscriptions.AddRef(msgTopic, conn, function (keyTopic, valueConn, count) {
                            console.log("[IPCBus:Broker] State : Client #" + valueConn + " (" + count + ") subscribed to '" + keyTopic + "'")
                        })
                        break
                    }
                case IPC_BUS_COMMAND_UNSUBSCRIBETOPIC:
                    {
                        const msgTopic = data.args[0]
                        console.log("[IPCBus:Broker] Unsubscribe : Client #" + conn.id + " from '" + msgTopic + "'")
                        ipcbus._subscriptions.Release(msgTopic, conn, function (keyTopic, valueConn, count) {
                            console.log("[IPCBus:Broker] State : Client #" + valueConn.id + " (" + count + ") subscribed to '" + keyTopic + "'")
                        })
                        break
                    }
                case IPC_BUS_COMMAND_SENDTOPICMESSAGE:
                    {
                        const msgTopic = data.args[0];
                        const msgContent = data.args[1];
                        console.log("[IPCBus:Broker] Received message : Client #" + conn.id + " from '" + msgTopic + "'")

                        ipcbus._subscriptions.ForEachKey(msgTopic, function (count, valueConn, keyTopic) {
                            // Send data to subscribed connections
                            BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, keyTopic, msgContent, valueConn)
                            console.log("[IPCBus:Broker] Received message : Forwarded to Client#" + keyTopic + ":" + valueConn.id)
                        })
                        break
                    }
                case IPC_BUS_COMMAND_QUERYSTATE:
                    {
                        const msgTopic = data.args[0];
                        console.log("[IPCBus:Broker] QueryState message reply on topic : " + msgTopic)

                        ipcbus._subscriptions.QueryState(function (results) {
                            BaseIpc.Cmd.exec(IPC_BUS_EVENT_TOPICMESSAGE, msgTopic, results, conn)
                        })
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

    this.queryMasterState = function (topic) {
        if (connected != true) {
            throw new Error("Please connect first")
        }
        ipcObj.send(IPC_BUS_MASTER_QUERYSTATE, topic)
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

    // Setup
    const self = this
    if (busPath === undefined || busPath === null) {

        busPath = _getCmdLineArgValue('bus-path')
    }

    const BaseIpc = require(BASE_IPC_MODULE)
    const baseIpc = new BaseIpc()
    let busConn = null
    let ipcCmd = null

    if (process.type === "browser" && (ipcObj === undefined || ipcObj === null)) {
        const ipcObj = require("electron").ipcMain
        const {webContents} = require("electron")

        let topicRendererRefs = new MapRefCount

        let rendererSubscribeHandler = function _rendererSubscribeHandler(msgTopic, msgContent) {
            topicRendererRefs.ForEachKey(msgTopic, function (count, valueId, keyTopic) {
                console.log("[IPCBus:Bridge] Forward message received on '" + keyTopic + "' to renderer ID=" + valueId)
                var webContent = webContents.fromId(valueId)
                if (webContent != undefined) {
                    webContent.send(IPC_BUS_RENDERER_RECEIVE, keyTopic, msgContent)
                }
            })
        }

        let startRendererBridge = function _startRendererBridge(ipcbus, ipcMain) {
            ipcMain.addListener(IPC_BUS_RENDERER_SUBSCRIBE, function (event, topic) {
                console.log("[IPCBus:Bridge] Subscribe renderer ID=" + event.sender.id + " to topic '" + topic + "'")
                topicRendererRefs.AddRef(topic, event.sender.id, function (keyTopic, valueId, count) {
                    if (count == 1) {
                        console.log("[IPCBus:Bridge] forward subscribe '" + keyTopic + "' to IPC Broker")
                        ipcbus.subscribe(keyTopic, rendererSubscribeHandler)
                    }
                })
            })

            ipcMain.addListener(IPC_BUS_RENDERER_SEND, function (event, topic, data) {
                console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " sent message on '" + topic + "'")
                ipcbus.send(topic, data)
            })

            ipcMain.addListener(IPC_BUS_RENDERER_UNSUBSCRIBE, function (event, topic) {
                console.log("[IPCBus:Bridge] Unsubscribe renderer ID=" + event.sender.id + " from topic : '" + topic + "'")
                topicRendererRefs.Release(topic, event.sender.id, function (keyTopic, valueId, count) {
                    if (count == 0) {
                        console.log("[IPCBus:Bridge] forward unsubscribe '" + keyTopic + "' to IPC Broker")
                        ipcbus.unsubscribe(keyTopic, rendererSubscribeHandler)
                    }
                })
            })

            ipcMain.addListener(IPC_BUS_RENDERER_QUERYSTATE, function (event, topic, data) {
                console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " queryed broker's state")
                ipcbus.queryBrokerState(topic)
            })

            ipcMain.addListener(IPC_BUS_MASTER_QUERYSTATE, function (event, topic, data) {
                console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " queryed master's state")
                topicRendererRefs.QueryState(function (queryStateResult) {
                    ipcbus.send(topic, queryStateResult)
                })
            })
        }

        this.queryMasterState = function (topic) {
            console.log("[IPCBus:Bridge] Renderer ID=" + event.sender.id + " queryed master's state")
            topicRendererRefs.QueryState(function (queryStateResult) {
                ipcbus.send(topic, queryStateResult)
            })
        }

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

    this._subscriptions = new MapRefCount()

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