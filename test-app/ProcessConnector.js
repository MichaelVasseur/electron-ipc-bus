
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

        this.receivedMessageNotify = function receivedMessageNotify(topicName, topicMsg)
        {
            _ipc.send(buildChannel("receivedMessage-notify"), { topic : topicName, msg : topicMsg } );
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

        this.onReceivedMessageNotify = function _onReceivedMessageNotify(callback)
        {
            _ipc.on(buildChannel("receivedMessage-notify"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response["topic"], response["msg"]);
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