// Require the 'ac-koa' module, and then tell it to load the 'hipchat' adapter
// from 'ac-koa-hipchat'
var ack = require('ac-koa').require('hipchat');
// Require our package.json file, which doubles as the configuration from which
// we'll generate the add-on descriptor and server's runtime parameters
var pkg = require('./package.json');
// Create the base Koa app, via an 'ac-koa' factory method that helps preconfigure
// and decorate the app object
var app = ack(pkg);

// THUAN: JSON & Route
var json = require('koa-json');
var route = require('koa-route');
app.use(json());

// THUAN: Render template
var render = require('./lib/render');

var baseUrl = 'http://c8932945.ngrok.io';

// Now build and mount an AC add-on on the Koa app; we can either pass a full or
// partial descriptor object to the 'addon()' method, or when we provide none, as
// in this example, we can instead create the descriptor using a product-specific
// builder API
var addon = app.addon(
{
  // optional descriptor metas here (taken from package.json when not overridden here)
  capabilities: {
    "webPanel": [
        {
            "key": "hcstandup.sidebar",
            "name": {
                "value": "Standup reports"
            },
            "location": "hipchat.sidebar.right",
            "url": baseUrl + "/page"
        }
    ],
    "glance": [
        {
            "key": "hcstandup.glance",
            "name": {
                "value": "Standup"
            },
            "queryUrl": baseUrl + "/glance",
            "target": "hcstandup.sidebar",
            "icon": {
                "url": baseUrl + "/static/info.png",
                "url@2x": baseUrl + "/static/info@2x.png"
            }
        }
    ]
  }
}
)
  // Use the hipchat descriptor builder
  // .hipchat()
  // Indicate that the descriptor should mark this as installable in rooms
  .allowRoom(true)
  // Provide the list of permissions scopes the add-on requires
  .scopes('send_notification');

// Subscribe to the 'room_enter' webhook, and provide an event listener.  Under
// the covers, this adds a webhook entry to the add-on descriptor, mounts a common
// webhook endpoint on the Koa app, and brokers webhook POST requests to the event
// listener as appropriate
addon.webhook('room_enter', function *() {
  // 'this' is a Koa context object, containing standard Koa request and response
  // contextual information as well as hipchat-specific models and services that
  // make handling the webhook as simple as possible
  yield this.roomClient.sendNotification('Hi, ' + this.sender.name + '!');
});

addon.webhook('room_message', /^\/hello$/, function *() {
  yield this.roomClient.sendNotification('Hi, ' + this.sender.name + '!');
});

app.use(route.get('/glance', function *(next){
  this.body = {
                "label": {
                  "type": "html",
                  "value": "<strong>4</strong> tasks"
                },
                "status": {
                  "type": "lozenge",
                  "value": {
                    "label": "Late",
                    "type": "error"
                  }
                }
              };
}));

app.use(route.get('/page', function *(){
    // this.body = '<html><head><script type="text/javascript" src="https://code.jquery.com/jquery-1.11.3.min.js"></script></head>'
    //   + '<body>This is <b>my page</b> </br> This is line 2.<br/><div id="xxx" /><script> var counter = 1; setInterval(function() {$("#xxx").html(counter++);}, 1000);</script></body></html>';
    this.body = '<iframe width="300" src="https://www.youtube.com/embed/JjDcrUsM7AE" frameborder="0" allowfullscreen></iframe>';
}));

app.use(route.get('/template', function *(next){
  this.body = yield render('index');
}));

// Now that the descriptor has been defined along with a useful webhook handler,
// start the server 
app.listen();
