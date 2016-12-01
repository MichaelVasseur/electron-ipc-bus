
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
            if (_id != undefined)
            {
                return _type + "-" + _id + "/" + eventName;
            }
            else
            {
                return _type + "/" + eventName;
            }
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
            _ipc.send(buildChannel("subscribe"), topicName);
        }

        this.sendSubscribeNotify = function _sendSubscribeNotify(topicName)
        {
            _ipc.send(buildChannel("subscribe-notify"), topicName);
        }

        this.sendUnsubscribe = function _sendUnsubscribe(topicName)
        {
            _ipc.send(buildChannel("unsubscribe"), topicName);
        }

        this.sendUnsubscribeNotify = function _sendUnsubscribeNotify(topicName)
        {
            _ipc.send(buildChannel("unsubscribe-notify"), topicName);
        }

        this.sendMessage = function _sendMessage(topicName, topicMsg)
        {
            _ipc.send(buildChannel("sendMessage"), { topic : topicName, msg : topicMsg } );
        }

        this.receivedMessageNotify = function receivedMessageNotify(topicName, topicMsg)
        {
            _ipc.send(buildChannel("receivedMessage-notify"), { topic : topicName, msg : topicMsg } );
        }

        this.send = function _send(topicName, topicMsg)
        {
            _ipc.send(buildChannel("topicName"), { topic : topicName, msg : topicMsg } );
        }

        this.onSubscribe = function _onSubscribe(callback)
        {
            _ipc.on(buildChannel("subscribe"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response);
            });
        }

        this.onSubscribeNotify = function _onSubscribeNotify(callback)
        {
            _ipc.on(buildChannel("subscribe-notify"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response);
            });
        }

        this.onUnsubscribe = function _onUnsubscribe(callback)
        {
            _ipc.on(buildChannel("unsubscribe"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response);
            });
        }

        this.onUnsubscribeNotify = function _onUnsubscribeNotify(callback)
        {
            _ipc.on(buildChannel("unsubscribe-notify"), function (event, data)
            {
                const response = (data !== undefined)? data: event;
                callback(response);
            });
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