// Load modules
const ipcBusModule = require("electron-ipc-bus");
const electronApp = require('electron').app;

// Configuration
const ipcBusPath = 50494;
// const ipcBusPath = '/myfavorite/path';

// Startup
electronApp.on('ready', function () {
    // Create broker
    const ipcBusBroker = ipcBusModule.CreateIpcBusBroker(ipcBusPath);

    // Start broker
    ipcBusBroker.start()

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

                    ipcBusClient.request(2000, 'greeting', 'hello partner!')
                        .then((ipcBusRequestResponse) => {
                            console.log(ipcBusRequestResponse.event.peerName + ' replied ' + ipcBusRequestResponse.payload);
                        });
                });
        });
});