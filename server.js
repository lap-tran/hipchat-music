var bunyan = require('bunyan');
var bunyanRequest = require('bunyan-request');
var Hapi = require('hapi');
var Inert = require('inert');

var logger = bunyan.createLogger({
    name: 'micros-workshop',
    level: 'info',
    serializers: {
        req: bunyan.stdSerializers.req,
        err: bunyan.stdSerializers.err
    }
});

var requestLogger = bunyanRequest({
  logger: logger,
  headerName: 'x-request-id'
});

console.error = logger.error.bind(logger);
console.log = logger.info.bind(logger);
console.warn = logger.warn.bind(logger);

var server = new Hapi.Server();
server.connection({ port: 8080 });

server.register(Inert, function() {
    server.route({
        method: 'GET',
        path: '/assets/{param*}',
        handler: {
            directory: {
                path: 'public',
                listing: true
            }
        }
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: {
            file: {
                path: 'templates/index.html'
            }
        }
    });
});

var io = require('socket.io')(server.listener);

io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('video play', function() {
        io.emit('video play', {});
    });

    socket.on('video pause', function() {
        io.emit('video pause', {});
    });
});

server.start(function () {
    console.log('Server running at:', server.info.uri);
});
