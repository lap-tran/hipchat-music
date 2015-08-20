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

var redis = require('redis');
var redisClient = redis.createClient();

var baseUrl = 'http://10f87af7.ngrok.io';

// Now build and mount an AC add-on on the Koa app; we can either pass a full or
// partial descriptor object to the 'addon()' method, or when we provide none, as
// in this example, we can instead create the descriptor using a product-specific
// builder API

var request = require("co-request");

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
  var videoId = msg.substring(11); // default "/music add videoId"
  var vIndex = videoId.indexOf("v=");
  if (vIndex >= 0) {
    var andIndex = videoId.indexOf("&", vIndex);
    if (andIndex <= 0) {
      videoId = videoId.substring(vIndex + 2);
    } else {
      videoId = videoId.substring(vIndex + 2, andIndex);
    }
  }

  // Add video to playlist of the room
  var roomId = 'room-' + this.room.id;
  redisClient.lrange(roomId, 0, -1, function(err, reply) {
    if (reply.indexOf(videoId) < 0) {
      redisClient.rpush([roomId, videoId], function (err, reply) {
        that.roomClient.sendNotification('Added youtude id into the playlist: "' + videoId + '"');

        // Get current videos in the room
        redisClient.lrange(roomId, 0, -1, function(err, reply) {
          that.roomClient.sendNotification('The playlist are now: "' + reply + '"');
        });
      });
    } else {
      that.roomClient.sendNotification('The song "' + videoId + '" already exsists in the playlist');
    }
  });
  
});

addon.webhook('room_message', /^\/music\sclear$/, function *() {
  //https://www.youtube.com/watch?v=501mKjtUe7c&list=PLGnM8QCiRtpCyYBKSk3XANInqhr6dJPEt&index=2

  var that = this;

  var roomId = 'room-' + this.room.id;
  redisClient.del(roomId, function(err, reply) {
    that.roomClient.sendNotification('The playlist are now cleared');
  });
});

addon.webhook('room_message', /^\/music\sremove\s.*$/, function *() {
  //https://www.youtube.com/watch?v=501mKjtUe7c&list=PLGnM8QCiRtpCyYBKSk3XANInqhr6dJPEt&index=2

  var that = this;

  // Get videoId
  var msg = this.message.message;
  var videoId = msg.substring(14); // default "/music remove videoId"
  var vIndex = videoId.indexOf("v=");
  if (vIndex >= 0) {
    var andIndex = videoId.indexOf("&", vIndex);
    if (andIndex <= 0) {
      videoId = videoId.substring(vIndex + 2);
    } else {
      videoId = videoId.substring(vIndex + 2, andIndex);
    }
  }

  // Add video to playlist of the room
  var roomId = 'room-' + this.room.id;
  redisClient.lrange(roomId, 0, -1, function(err, reply) {
    videoIndex = reply.indexOf(videoId);
    if (videoIndex < 0) {
      that.roomClient.sendNotification('The song "' + videoId + '" doesn\'t exsists in the playlist');
    } else {
      reply.splice(videoIndex, 1);
      var newList = [roomId];
      for (var i = 0; i < reply.length; i++) {
        newList.push(reply[i]);
      }
      redisClient.del(roomId, function(err, reply) {
        redisClient.rpush(newList, function (err, reply) {
          // Get current videos in the room
          redisClient.lrange(roomId, 0, -1, function(err, reply) {
            that.roomClient.sendNotification('The playlist are now: "' + reply + '"');
          });
        });
      });
    }
  });
  
});

app.use(route.get('/glance', function *(next){
  this.body = {
                "label": {
                  "type": "html",
                  "value": "<strong>2</strong> tasks"
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

app.use(route.get('/search/:query', function *(query){
    // var apiKey = process.env.YOUTUBE_API_KEY;
    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';

    var response = yield request.get({
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
    this.body = response.body
}));

app.use(route.get('/room/:id', function *(id){
    var roomId = 'room-' + id;
    // var apiKey = process.env.YOUTUBE_API_KEY;
    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';

    var videoIds = null;

    var response = '';

    redisClient.lrange(roomId, 0, -1, function (err, reply) {
      if (reply != undefined) {
        videoIds = reply.join(',');
        if (videoIds == null || videoIds == undefined) {
          videoIds = '';
        }
      }
    });

    if (videoIds !== '') {
          response = yield request.get({
              url: 'https://www.googleapis.com/youtube/v3/videos',
              qs: {
                  key: apiKey,
                  part: 'snippet',
                  type: 'video',
                  id: videoIds,
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

app.use(serve(__dirname + '/public'));

// Now that the descriptor has been defined along with a useful webhook handler,
// start the server 
app.listen();
