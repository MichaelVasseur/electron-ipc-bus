// Load modules
const ipcBusModule = require("electron-ipc-bus");
const electronApp = require('electron').app;

// Configuration
const ipcBusPath = 50494;
// const ipcBusPath = '/myfavorite/path';

// Startup
electronApp.on('ready', function () {
    // Create broker
    const ipcBusBrokerNode = ipcBusModule.CreateIpcBusBrokerNode(ipcBusPath);

    // Start broker
    ipcBusBrokerNode.start()

    // Create client
        .then((msg) => {
            const ipcBusClient = ipcBusModule.CreateIpcBusClient(ipcBusPath);
            ipcBusClient.connect()

    // Chatting on channel 'greeting'
                .then((msg) => {
                    ipcBusClient.addListener('greeting', (ipcBusEvent, greetingMsg) => {
                        if (ipcBusEvent.request) {
                            ipcBusEvent.request.resolve('thanks to you, dear #' + ipcBusEvent.sender.peerName);
                        }
                        else {
                            ipcBusClient.send('greeting-reply', 'thanks to all listeners')
                            console.log(greetingMsg);
                        }
                    });

                    ipcBusClient.addListener('greeting-reply', (ipcBusEvent, greetingReplyMsg) => {
                        console.log(greetingReplyMsg);
                    });

                    ipcBusClient.send('greeting', 'hello everyone!');

                    ipcBusClient.request('greeting', 'hello partner!')
                        .then((ipcBusRequestResponse) => {
                            console.log(ipcBusRequestResponse.event.sender.peerName + ' replied ' + ipcBusRequestResponse.payload);
                        })
                        .catch((err) => {
                            console.log('I have no friend :-(');
                        });

                    ipcBusClient.request(1000, 'greeting', 'hello partner, please answer within 1sec!')
                        .then((ipcBusRequestResponse) => {
                            console.log(ipcBusRequestResponse.event.sender.peerName + ' replied ' + ipcBusRequestResponse.payload);
                        })
                        .catch((err) => {
                            console.log('I have no friend :-(');
                        });
                });
        });
});