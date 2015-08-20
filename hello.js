var ack = require('ac-koa').require('hipchat');
// Require our package.json file, which doubles as the configuration from which
// we'll generate the add-on descriptor and server's runtime parameters
var pkg = require('./package.json');
// Create the base Koa app, via an 'ac-koa' factory method that helps preconfigure
// and decorate the app object
var app = ack(pkg),
    route = require('koa-route');

app.use(route.get('/page', function *(){
    // this.body = '<html><head><script type="text/javascript" src="https://code.jquery.com/jquery-1.11.3.min.js"></script></head>'
    //   + '<body>This is <b>my page</b> </br> This is line 2.<br/><div id="xxx" /><script> var counter = 1; setInterval(function() {$("#xxx").html(counter++);}, 1000);</script></body></html>';
    this.body = '<iframe width="300" src="https://www.youtube.com/embed/JjDcrUsM7AE" frameborder="0" allowfullscreen></iframe>';
}));

var server = require('http').createServer(app.callback());
var io = require('socket.io')(server);
io.on('connection', function(){ /* … */ });
server.listen(3000);