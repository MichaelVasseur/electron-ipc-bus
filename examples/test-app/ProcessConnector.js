
ProcessConnector = (function () {
    function ProcessConnector() {
        var _type = arguments[0];
        var _ipc = arguments[1];
        var _id;
        switch (_type) {
            case 'browser':
                break;
            case 'renderer':
                _id = arguments[2];
                break;
            case 'node':
                _id = arguments[2];
                break;
        };

        function buildChannel(eventName) {
            var channel = 'ipcbus/' + _type;
            if (_id != undefined) {
                channel += '-' + _id;
            }
            channel += '/' + eventName;
            return channel;
        };

        this.Type = function _Type() {
            return _type;
        }

        this.Id = function _Id() {
            return _id;
        };

        this.postSubscribe = function _postSubscribe(topicName) {
            this.send('subscribe', topicName);
        };

        this.onSubscribe = function _onSubscribe(callback) {
            this.on('subscribe', callback);
        };

        this.postUnsubscribe = function _postUnsubscribe(topicName) {
            this.send('unsubscribe', topicName);
        };

        this.onUnsubscribe = function _onUnsubscribe(callback) {
            this.on('unsubscribe', callback);
        };

        this.postSubscribeDone = function _postSubscribeDone(topicName) {
            this.send('subscribe-done', topicName);
        };

        this.onSubscribeDone = function _onSubscribeDone(callback) {
            this.on('subscribe-done', callback);
        };

        this.postUnsubscribeDone = function _postUnsubscribeDone(topicName) {
            this.send('unsubscribe-done', topicName);
        };

        this.onUnsubscribeDone = function _onUnsubscribeDone(callback) {
            this.on('unsubscribe-done', callback);
        };

        this.postSendMessage = function _postSendMessage(topicName, topicMsg) {
            _ipc.send(buildChannel('send'), { topic: topicName, msg: topicMsg });
        };

        this.onSendMessage = function _onSendMessage(callback) {
            _ipc.on(buildChannel('send'), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response['topic'], response['msg']);
            });
        };

        this.postReceivedMessage = function _postReceivedMessage(event, content) {
            _ipc.send(buildChannel('receivedMessage'), { event: event, content: content });
        };

        this.OnReceivedMessage = function _OnReceivedMessage(callback) {
            _ipc.on(buildChannel('receivedMessage'), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response['event'], response['content']);
            });
        };

        this.postRequestMessage = function _postRequestMessage(topicName, topicMsg) {
            _ipc.send(buildChannel('requestMessage'), { topic: topicName, msg: topicMsg });
        };

        this.onRequestMessage = function _onRequestMessage(callback) {
            _ipc.on(buildChannel('requestMessage'), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response['topic'], response['msg']);
            });
        };

        this.postRequestThen = function _postRequestThen(requestPromiseArgs) {
            _ipc.send(buildChannel('requestMessage-then'), requestPromiseArgs);
        };

        this.onRequestThen = function _onRequestThen(callback) {
            _ipc.on(buildChannel('requestMessage-then'), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        };

        this.postRequestCatch = function _postRequestCatch(requestPromiseArgs) {
            _ipc.send(buildChannel('requestMessage-catch'), requestPromiseArgs);
        };

        this.onRequestCatch = function _onRequestCatch(callback) {
            _ipc.on(buildChannel('requestMessage-catch'), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        };


        this.send = function _send(eventName, data) {
            _ipc.send(buildChannel(eventName), data);
        };

        this.on = function _on(eventName, callback) {
            _ipc.on(buildChannel(eventName), function (event, data) {
                const response = (data !== undefined) ? data : event;
                callback(response);
            });
        };
    }

    return ProcessConnector;
})();

module.exports = ProcessConnector;