# electron-ipc-bus
A safe Ipc bus for applications built on Electron. 
Dispatching of messages is managed by a broker. A broker can be instanciated in a node or in a the master process (not in renderer).
For performance purpose, it is better to instanciate the broker in an independent process node instance.
This Ipc bus works in sandbox mode and in affinity case (several webpages hosted in the same renderer process)

# How to use
## Ipc Bus Broker
### Initialization of the Broker (in a node process)
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker([busPath]);

The require() loads the module and CreateIpcBusBroker setups the broker with the ***busPath***.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    // Socket path
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker('/my-ipc-bus-path');

    // Port number
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker(58666);

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker();

### API
#### start()

Ex:
   
    ipcBusBroker.start() 
        .then((msg) => console.log(msg))
        .catch((err) => console.log(err));

Start the messages dispatcher

#### stop()

Ex:
   
    ipcBusBroker.stop() 


## Ipc Bus client

### Initialization in the Main/Browser Node process
 
    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBus([busPath]);

The require() loads the module. CreateIpcBus setups the client with the ***busPath*** that was used to start the broker.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBus();

### Initialization in a Node single process
 
Ex, busPath set by code:

    const ipcBus = ipcBusModule.CreateIpcBus('/my-ipc-bus-path');

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcBus = ipcBusModule.CreateIpcBus();

### Initialization in a Renderer (Sandboxed or not) process

    const ipcBusModule = require("electron-ipc-bus");
    const ipcBus = ipcBusModule.CreateIpcBus();

NOTE : If the renderer is running in sandboxed mode, the code above
must be run from the ***BrowserWindow***'s preload script. Otherwise, the
Electron's ipcRenderer is not accessible and the client cannot work.
The code below to make the client accessible to the the Web page scripts.

    window.ipcBus = ipcBus;

### Common API
#### connect([handler])

Ex:
   
    ipcBus.connect((eventName, conn) => console.log("Connected to Ipc bus !")) 

#### subscribe(topic, handler)
Subscribe to the specified topic. Each time a message is received on this topic,
handler is called with the data related to the message.
Ex:

    function HelloHandler(topic, content, peerName) {
       console.log("Received '" + content + "' on topic '" + topic +"' from #" + peerName)
    }
    ipcBus.subscribe("Hello!", HelloHandler)

#### send(topic [, content])
Send a message to every client subscribed to this topic.
Ex:

    ipcBus.send("Hello!", { name: "My Name !"})

#### request(topic, content, [, timeoutDelay]) : Promise<IpcBusRequestResponse>
Send a request message on specified topic. promise is settled when a result is available.
Ex:

    ipcBus.request("compute", "2*PI*9")
        .then(ipcBusRequestResponse) {
            console.log("topic = " + ipcBusRequestResponse.topic + ", response = " + ipcBusRequestResponse.payload + ", from = " + ipcBusRequestResponse.peerName);
        }
        .catch(ipcBusRequestResponse) {
            console.log("err = " + ipcBusRequestResponse.payload);
        }

To identify and manage such request, the clients must check the ***resolveCallback*** parameter

    function ComputeHandler(topic, content, peerName, resolveCallback, rejectCallback) {
       console.log("Received '" + content + "' on topic '" + topic +"' from #" + peerName)
       if (resolveCallback) {
           resolveCallback(eval(content))
       }
    }

    ipcBus.subscribe("compute", ComputeHandler)


#### unsubscribe(topic, handler)
Unsubscribe from the specified topic. handler won't be called anymore when
a message will be received on topic.
Ex:

    ipcBus.unsubscribe("Hello!", HelloHandler)

#### close()

Ex:

    ipcBus.close()

## Test application

The test-app folder contains all sources of the testing application.
NOTE : This folder is not packaged by NPM.

To build the application :

    cd examples
    cd test-app
    npm install
    npm run build

To run the application :

    npm run start

To run the application in sandboxed mode :

    npm run start-sandboxed

 
