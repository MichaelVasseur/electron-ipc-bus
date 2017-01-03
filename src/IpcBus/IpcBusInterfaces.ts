
export interface IpcBusConnectFunc {
    (eventName: string, conn: any): void;
}

export interface IpcBusListenFunc {
    (topic: string, payload: Object | string, peerName: string, replyTopic?: string): void;
}

export interface IpcBusRequestFunc {
    (topic: string, payload: Object | string, peerName: string): void;
}

export interface IpcBusRequestArgs {
    topic: string;
    payload: Object | string;
    peerName: string;
}


export interface IpcBusClient {
    connect(connectCallback: IpcBusConnectFunc): void;
    subscribe(topic: string, listenCallback: IpcBusListenFunc): void;
    send(topic: string, payload: Object | string): void;
    request(topic: string, payload: Object | string, requestCallback: IpcBusRequestFunc, timeoutDelay: number): void;
    requestPromise(topic: string, data: Object | string, timeoutDelay: number): Promise<IpcBusRequestArgs>;
    unsubscribe(topic: string, listenCallback: IpcBusListenFunc): void;
    queryBrokerState(topic: string): void;
    close(): void;
}

export interface IpcBusBroker {
    start(): void;
    stop(): void;
}

