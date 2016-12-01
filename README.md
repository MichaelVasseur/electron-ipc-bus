# electron-ipc-bus
A safe IPC bus for applications built on Electron.

## How to use
### Initialization in a Renderer (Sandboxed or not) process

    const ipcClient = require('electron-ipc-bus')('renderer')

NOTE : If the renderer is running in sandboxed mode, the code above
must be run from the ***BrowserWindow***'s preload script. Otherwise, the
Electron's ipcRenderer is not accessible and the client cannot work.
The code below to make the client accessible to the the Web page scripts.

    window.ipcClient = ipcClient
 
### Initialization in a Node (Main or Simple) process
 
     const ipcClient = require('electron-ipc-bus')('main', [, busPath])

The require() loads and setup the client with the ***busPath*** that was used to start the broker.
If ***busPath*** is not specified, the framework tries to get it from the command line with switch ***--bus-path***.
 
Ex, busPath set by code:

    const ipcClient = require('electron-ipc-bus')('main', '/my-ipc-bus-path') 

Ex, busPath set by command line: electron . --bus-path=***value***
    
    const ipcClient = require('electron-ipc-bus')('main') 
 
### Common API
#### connect([handler])

Ex:
   
    ipcBus.connect(() => console.log("Connected to IPC bus !")) 

#### subscribe(topic, handler)
Subscribe to the specified topic. Each time a message is received on this topic,
handler is called with the data related to the message.
Ex:

    function HelloHandler(topic, content) {
       console.log("Received Hello! from '" + content.name + "'")
    }
    ipcBus.subscribe("Hello!", HelloHandler)

#### send(topic [, content])
Send a message to every client subscribed to this topic.
Ex:

    ipcBus.send("Hello!", { name: "My Name !"})

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

    npm install
    npm run bundle-preload

To run the application :

    npm run start

To run the application in sandboxed mode :

    npm run start-sandboxed


 
 

 

 
