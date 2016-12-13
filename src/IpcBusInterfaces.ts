
export interface IpcBusClient {
    connect(callback: Function) : void;
    subscribe(topic: string, handler: Function) : void;
    send(topic: string, payload: Object | string) : void;
    request(topic: string, payload: Object | string, replyHandler: Function) : void;
    unsubscribe(topic: string, handler: Function) : void;
    queryBrokerState(topic: string) : void;
    close() : void;
}

export interface IpcBusBroker {
    start() : void;
    stop() : void;
}

//export function CreateIPCBusBroker() : IpcBusBroker;
//export function CreateIPCBusClient() : IpcBusClient;