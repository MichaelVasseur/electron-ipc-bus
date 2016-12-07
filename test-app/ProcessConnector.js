
ProcessConnector = (function()
{
    function ProcessConnector()
    {
        var _type = arguments[0];
        var _id;
        var _ipc;
        switch(_type)
        {
            case "main" : 
                 _ipc = arguments[1];
                break;
            case "renderer" : 
                 _id = arguments[1];
                 _ipc = arguments[2];
                break;
            case "node" :
                 _id = arguments[1];
                 _ipc = arguments[2];
                break;
        };
        
        function buildChannel(eventName)
        {
            var channel = "ipcbus/" + _type;
            if (_id != undefined)
            {
                channel += "-" + _id;
            }
            channel +=  "/" + eventName;
            return channel;
        }

        this.Type = function _Type()
        {
            return _type;
        }

        this.Id = function _Id()
        {
            return _id;
        }

        this.sendSubscribe = function _sendSubscribe(topicName)
        {
            this.send("subscribe", topicName);
        }

        this.sendSubscribeNotify = function _sendSubscribeNotify(topicName)
        {
            this.send("subscribe-notify", topicName);
        }

        this.sendUnsubscribe = function _sendUnsubscribe(topicName)
        {
            this.send("unsubscribe", topicName);
        }

        this.sendUnsubscribeNotify = function _sendUnsubscribeNotify(topicName)
        {
            this.send("unsubscribe-notify", topicName);
        }

        this.sendMessage = function _sendMessage(topicName, topicMsg)
        {
            _ipc.send(buildChannel("sendMessage"), { topic : topicName, msg : topicMsg } );
        }

        this.receivedSendNotify = function _receivedSendNotify(topicName, topicMsg)
        {
            _ipc.send(buildChannel("receivedSend-notify"), { topic : topicName, msg : topicMsg } );
        }

        this.requestMessage = function _sendMessage(topicName, topicMsg)
        {
            _ipc.send(buildChannel("requestMessage"), { topic : topicName, msg : topicMsg } );
        }

        this.receivedRequestNotify = function _receivedRequestNotify(topicName, topicMsg, topicResponse, peerName)
        {
            _ipc.send(buildChannel("receivedRequest-notify"), { topic:topicName, msg:topicMsg, peerName : peerName, response : topicResponse } );
        }

        this.send = function _send(eventName, data)
        {
            _ipc.send(buildChannel(eventName), data );
        }

        this.onSubscribe = function _onSubscribe(callback)
        {
            this.on("subscribe", callback);
        }

        this.onSubscribeNotify = function _onSubscribeNotify(callback)
        {
            this.on("subscribe-notify", callback);
        }

        this.onUnsubscribe = function _onUnsubscribe(callback)
        {
            this.on("unsubscribe", callback);
        }

        this.onUnsubscribeNotify = function _onUnsubscribeNotify(callback)
        {
            this.on("unsubscribe-notify", callback);
        }

        this.onSendMessage = function _onSendMessage(callback)
        {
            _ipc.on(buildChannel("sendMessage"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response["topic"],response["msg"]);
            });
        }

        this.onReceivedSendNotify = function _onReceivedSendNotify(callback)
        {
            _ipc.on(buildChannel("receivedSend-notify"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response["topic"], response["msg"]);
            });
        }

        this.onRequestMessage = function _onRequestMessage(callback)
        {
            _ipc.on(buildChannel("requestMessage"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response["topic"],response["msg"]);
            });
        }

        this.onReceivedRequestNotify = function _oonReceivedRequestNotify(callback)
        {
            _ipc.on(buildChannel("requestMessage-notify"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response["topic"],response["msg"],response["response"],response["peerName"]);
            });
        }

        this.on = function _on(eventName, callback)
        {
            _ipc.on(buildChannel(eventName), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response);
            });
        }
    }

    return ProcessConnector;
})();