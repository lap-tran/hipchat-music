var Duplex = require('stream').Duplex;
var browserChannel = require('browserchannel').server

var livedb = require('livedb');
var connect = require('connect');

var backend = livedb.client(livedb.memory());
var share = require('share').server.createClient({backend: backend});
var app = require('express')();

webserver = connect();

app.use(browserChannel({webserver: webserver}, function(client) {
    var stream = new Duplex({objectMode: true});

    stream._read = function() {};
    stream._write = function(chunk, encoding, callback) {
        if (client.state !== 'closed') {
            client.send(chunk);
        }
        callback();
    };

    client.on('message', function(data) {
        stream.push(data);
    });

    client.on('close', function(reason) {
        stream.push(null);
        stream.emit('close');
    });

    stream.on('end', function() {
        client.close();
    });

    // Give the stream to sharejs
    return share.listen(stream);
}));

webserver.use('/doc', share.rest());
webserver.listen(7007);

console.log("Listening on http://localhost:7007/");