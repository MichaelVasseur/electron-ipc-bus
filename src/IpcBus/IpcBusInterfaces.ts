
export interface IpcBusConnectFunc {
    (eventName: string, conn: any): void;
}

export interface IpcBusListenFunc {
    (topic: string, payload: Object | string, peerName: string): void;
}

export interface IpcBusRequestFunc {
    (topic: string, payload: Object | string, peerName: string): void;
}

export interface IpcBusClient {
    connect(callback: IpcBusConnectFunc): void;
    subscribe(topic: string, handler: IpcBusListenFunc): void;
    send(topic: string, payload: Object | string): void;
    request(topic: string, payload: Object | string, replyHandler: IpcBusRequestFunc, timeoutDelay: number): void;
    unsubscribe(topic: string, handler: IpcBusListenFunc): void;
    queryBrokerState(topic: string): void;
    close(): void;
}

export interface IpcBusBroker {
    start(): void;
    stop(): void;
}

