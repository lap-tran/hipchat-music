// Require the 'ac-koa' module, and then tell it to load the 'hipchat' adapter
// from 'ac-koa-hipchat'
var ack = require('ac-koa').require('hipchat');
// Require our package.json file, which doubles as the configuration from which
// we'll generate the add-on descriptor and server's runtime parameters
var pkg = require('./package.json');
// Create the base Koa app, via an 'ac-koa' factory method that helps preconfigure
// and decorate the app object
var app = ack(pkg);

var json = require('koa-json');
var route = require('koa-route');

app.use(json());

var send = require('koa-send');
var serve = require('koa-static');

var baseUrl = require('./lib/app-base-url.js').baseUrl;

// THUAN: Redis
var redis = require('redis');
var redisClient = redis.createClient();
// var redisClient = redis.createClient(port, host);

var baseUrl = 'http://10f87af7.ngrok.io';
app.use(serve(__dirname + '/public'));

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

addon.webhook('room_message', /^\/music\sadd\s.*$/, function *() {
  //https://www.youtube.com/watch?v=501mKjtUe7c&list=PLGnM8QCiRtpCyYBKSk3XANInqhr6dJPEt&index=2

  var that = this;

  // Get videoId
  var msg = this.message.message;
  var searchParam = msg.substring(11); // default "/music add videoId"

    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';
    var query = searchParam;
    if (query == null) {
        this.body = 'no search parameter p defined.';
        return;
    }
    var queryUrl = url.parse(query, true);
    var response = null;

    if (queryUrl &&
            queryUrl.host != null &&
            queryUrl.host.indexOf('youtube.com') != -1 &&
            queryUrl.query.v) {

        response = yield request.get({
            url: 'https://www.googleapis.com/youtube/v3/videos',
            qs: {
                key: apiKey,
                part: 'snippet',
                id: queryUrl.query.v
            }
        });
    } else {
        response = yield request.get({
            url: 'https://www.googleapis.com/youtube/v3/search',
            qs: {
                key: apiKey,
                part: 'snippet',
                type: 'video',
                maxResults: 1,
                q: query,
                videoCategoryId: 'music' // not sure if this makes results better or worse
            }
        });
    }

    var responseJson = JSON.parse(response.body);

    if (response.body == null || responseJson.items.length === 0) {
        return;
    }
    var id = responseJson.items[0].id;
    var videoId = id.videoId ? id.videoId : id;
    var title = responseJson.items[0].snippet.title;

  // Add video to playlist of the room
  var roomId = this.room.id;
  redisClient.lrange('room-' + roomId, 0, -1, function(err, reply) {
    if (reply.indexOf(videoId) < 0) {
      redisClient.rpush([roomId, videoId], function (err, reply) {
        that.roomClient.sendNotification('Added a song into the playlist: "' + title + '"');

        // Get current videos in the room
        redisClient.lrange(roomId, 0, -1, function(err, reply) {
          that.roomClient.sendNotification('The playlist is now: "' + reply + '"');
        });
      });
    } else {
      that.roomClient.sendNotification('The song "' + title + '" already exsists in the playlist');
    }
  });
  
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
    yield send(this, __dirname + "/templates/index.html");
}));

app.use(route.get('/room/:id', function *(id){
    var roomId = 'room-' + id;
    // var apiKey = process.env.YOUTUBE_API_KEY;
    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';

    var videoIds = null;

    var response = {body: ''};

    var reply = yield coRedisClient.lrange(roomId, 0, -1);

    if (reply != undefined) {
        videoIds = reply.join(',');
        if (videoIds == null || videoIds == undefined) {
          videoIds = '';
        }
    }

    if (videoIds !== '') {
          response = yield request.get({
              url: 'https://www.googleapis.com/youtube/v3/videos',
              qs: {
                  key: apiKey,
                  part: 'contentDetails,snippet',
                  type: 'video',
                  id: videoIds,
                  fields: 'items(id,snippet(title,thumbnails(default)),contentDetails(duration))',
                  videoCategoryId: 'music' // not sure if this makes results better or worse
              }
          });
        }

    this.body = response.body;
}));

addon.webhook('room_message', /^\/roomid$/, function *() {
  this.roomClient.sendNotification('your room id is: "' + this.room.id + '"');
});

app.use(route.get('/template', function *(){
  yield send(this, __dirname + "/templates/index.html");
}));



// Now that the descriptor has been defined along with a useful webhook handler,
// start the server 
app.listen();
