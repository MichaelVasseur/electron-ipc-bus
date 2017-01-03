
ProcessConnector = (function () {
    function ProcessConnector() {
        var _type = arguments[0];
        var _ipc = arguments[1];
        var _id;
        switch (_type) {
            case "browser":
                break;
            case "renderer":
                _id = arguments[2];
                break;
            case "node":
                _id = arguments[2];
                break;
        };

        function buildChannel(eventName) {
            var channel = "ipcbus/" + _type;
            if (_id != undefined) {
                channel += "-" + _id;
            }
            channel += "/" + eventName;
            return channel;
        }

        this.Type = function _Type() {
            return _type;
        }

        this.Id = function _Id() {
            return _id;
        }

        this.postSubscribe = function _postSubscribe(topicName) {
            this.send("subscribe", topicName);
        }

        this.onSubscribe = function _onSubscribe(callback) {
            this.on("subscribe", callback);
        }

        this.postUnsubscribe = function _postUnsubscribe(topicName) {
            this.send("unsubscribe", topicName);
        }

        this.onUnsubscribe = function _onUnsubscribe(callback) {
            this.on("unsubscribe", callback);
        }

        this.postSubscribeDone = function _postSubscribeDone(topicName) {
            this.send("subscribe-done", topicName);
        }

        this.onSubscribeDone = function _onSubscribeDone(callback) {
            this.on("subscribe-done", callback);
        }

        this.postUnsubscribeDone = function _postUnsubscribeDone(topicName) {
            this.send("unsubscribe-done", topicName);
        }

        this.onUnsubscribeDone = function _onUnsubscribeDone(callback) {
            this.on("unsubscribe-done", callback);
        }

        this.postSendMessage = function _postSendMessage(topicName, topicMsg) {
            _ipc.send(buildChannel("send"), { topic: topicName, msg: topicMsg });
        }

        this.onSendMessage = function _onSendMessage(callback) {
            _ipc.on(buildChannel("send"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response["topic"], response["msg"]);
            });
        }

        this.postSendMessageDone = function _postSendMessageDone(topicName, topicMsg, topicToReply) {
            _ipc.send(buildChannel("sendMessage-done"), { topic: topicName, msg: topicMsg, topicToReply: topicToReply });
        }

        this.onSendMessageDone = function _onSendMessageDone(callback) {
            _ipc.on(buildChannel("sendMessage-done"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response["topic"], response["msg"], response["topicToReply"]);
            });
        }

        this.postRequestMessage = function _postRequestMessage(topicName, topicMsg) {
            _ipc.send(buildChannel("requestMessage"), { topic: topicName, msg: topicMsg });
        }

        this.onRequestMessage = function _onRequestMessage(callback) {
            _ipc.on(buildChannel("requestMessage"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response["topic"], response["msg"]);
            });
        }

        this.postRequestMessageDone = function _postRequestMessageDone(topicName, topicMsg, topicResponse, peerName) {
            _ipc.send(buildChannel("requestMessage-done"), { topic: topicName, msg: topicMsg, peerName: peerName, response: topicResponse });
        }

        this.onRequestMessageDone = function _oonRequestMessageDone(callback) {
            _ipc.on(buildChannel("requestMessage-done"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response["topic"], response["msg"], response["response"], response["peerName"]);
            });
        }

        this.postRequestPromiseMessage = function _postRequestPromiseMessage(topicName, topicMsg) {
            _ipc.send(buildChannel("requestPromiseMessage"), { topic: topicName, msg: topicMsg });
        }

        this.onRequestPromiseMessage = function _onRequestPromiseMessage(callback) {
            _ipc.on(buildChannel("requestPromiseMessage"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response["topic"], response["msg"]);
            });
        }

        this.postRequestPromiseThen = function _postRequestPromiseThen(requestPromiseArgs) {
            _ipc.send(buildChannel("requestPromiseMessage-then"), requestPromiseArgs);
        }

        this.onRequestPromiseThen = function _onRequestPromiseThen(callback) {
            _ipc.on(buildChannel("requestPromiseMessage-then"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        }

        this.postRequestPromiseCatch = function _postRequestPromiseCatch(err) {
            _ipc.send(buildChannel("requestPromiseMessage-catch"), err);
        }

        this.onRequestPromiseCatch = function _onRequestPromiseCatch(callback) {
            _ipc.on(buildChannel("requestPromiseMessage-catch"), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        }


        this.send = function _send(eventName, data) {
            _ipc.send(buildChannel(eventName), data);
        }

        this.on = function _on(eventName, callback) {
            _ipc.on(buildChannel(eventName), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        }
    }

    return ProcessConnector;
})();