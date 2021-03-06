var cool = require('cool-ascii-faces');

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
var serve = require('koa-static');
var send = require('koa-send');

app.use(json());

// THUAN: Render template
var render = require('./lib/render');

//var baseUrl = require('./lib/app-base-url.js').baseUrl;

// THUAN: Redis
// var redisURL = 'ec2-54-83-205-71.compute-1.amazonaws.com';
// var redisPort = '12239';

if (process.env.REDISTOGO_URL) {
    var rtg   = require("url").parse(process.env.REDISTOGO_URL);
    var redisClient = require("redis").createClient(rtg.port, rtg.hostname);

    redisClient.auth(rtg.auth.split(":")[1]);
} else {
    var redisClient = require("redis").createClient();
}

var redis = require('redis');
var url = require('url');
var redisURL = url.parse(process.env.REDIS_URL);
var redisClient = redis.createClient(redisURL.port, redisURL.hostname);
redisClient.auth(redisURL.auth.split(":")[1]);

var coRedis = require("co-redis");
// var redisClient = redis.createClient(redisPort, redisURL, { });
// redisClient.auth('p73ka4g0tska24hm0rvtvc6nvu')
var coRedisClient = coRedis(redisClient);

app.use(serve(__dirname + '/public'));

var views = require('koa-views');
app.use(views(__dirname + "/templates", {
  map: {
    html: 'underscore'
  }
}));
var _ = require('underscore-node');

// var baseUrl1 = pkg.development.localBaseUrl;
// var baseUrl = "http://laps-macbook-pro.local:3000";
var baseUrl = "https://hiptunes.herokuapp.com";
var baseUrl1 = "https://hiptunes.herokuapp.com";

var hardcodedRoomId = '00000';

// Now build and mount an AC add-on on the Koa app; we can either pass a full or
// partial descriptor object to the 'addon()' method, or when we provide none, as
// in this example, we can instead create the descriptor using a product-specific
// builder API

var request = require("co-request");
var url = require('url');

var addon = app.addon(
{
  // optional descriptor metas here (taken from package.json when not overridden here)
  capabilities: {
    "webPanel": [
        {
            "key": "hcstandup.sidebar",
            "name": {
                "value": "Music"
            },
            "location": "hipchat.sidebar.right",
            "url": baseUrl + "/page"
        }
    ],
    "glance": [
        {
            "key": "hcstandup.glance",
            "name": {
                "value": "Music"
            },
            "queryUrl": baseUrl + "/glance",
            "target": "hcstandup.sidebar",
            "icon": {
                "url": baseUrl + "/img/icon.png",
                "url@2x": baseUrl + "/img/icon2x.png"
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

addon.webhook('room_message', /^\/music\sadd\s.*$/, function *() {
    var that = this;

    // Get videoId
    var msg = this.message.message;
    var searchParam = msg.substring(11);
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
    var senderName = this.sender.name;

    var storedObject = {
        sender: senderName,
        videoId: videoId
    };

  // Add video to playlist of the room
  // var roomId = 'room-' + this.room.id;
    var roomId = 'room-' + hardcodedRoomId;
    redisClient.lrange(roomId, 0, -1, function(err, reply) {
        if (reply.indexOf(videoId) < 0) {
            redisClient.rpush([roomId, JSON.stringify(storedObject)], function (err, reply) {
                that.roomClient.sendNotification('Added a song into the playlist: "' + title + '"');
            });
        } else {
            that.roomClient.sendNotification('The song "' + title + '" already exsists in the playlist');
        }

        co(function* () {
            var videos = yield * getVideos('00000');
            if (videos.items.length && sync.currentSong) {
                videos.items[0].seekTo = sync.currentSong.current;
            }

            console.log(videos);

            io.sockets.emit('video changeplaylist', videos);
        });
  });
});

addon.webhook('room_message', /^\/music\sclear$/, function *() {
  //https://www.youtube.com/watch?v=501mKjtUe7c&list=PLGnM8QCiRtpCyYBKSk3XANInqhr6dJPEt&index=2

  var that = this;

  // var roomId = 'room-' + this.room.id;
  var roomId = 'room-' + hardcodedRoomId;
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
  // var roomId = 'room-' + this.room.id;
  var roomId = 'room-' + hardcodedRoomId;
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
                  "value": "<strong>Music</strong>"
                }
              };
}));

app.use(route.get('/page', function *(){
    // yield send(this, __dirname + "/templates/index.html");

    var videos = yield * getVideos('00000');
    if (videos.items.length && sync.currentSong) {
        videos.items[0].seekTo = sync.currentSong.current;
    }

    yield this.render('index', {
        videos: JSON.stringify(videos)
    });
}));

app.use(route.get('/img/:img', function *(img){
    yield send(this, __dirname + "/img/" + img);
}));

function * getVideos(id) {
  // var roomId = 'room-' + id;
    var roomId = 'room-' + hardcodedRoomId;

    // var apiKey = process.env.YOUTUBE_API_KEY;
    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';

    var videoIds = '';
    var response;

    var storedSongs = yield coRedisClient.lrange(roomId, 0, -1);
    storedSongs = _.map(storedSongs, function (string) {
        return JSON.parse(string);
    });

    if (typeof storedSongs === "object") {
        videoIds = _.pluck(storedSongs, 'videoId').join(',');
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
    } else {
        return {items: {}};
    }

    var body = JSON.parse(response.body);

    body.items = _.map(body.items, function(tubeSong) {
        var matchingStoredSong = _.find(storedSongs, function(stored) {
            return stored.videoId === tubeSong.id;
        });
        if (matchingStoredSong) {
            tubeSong.sender = matchingStoredSong.sender;
        }
        return tubeSong
    });

    return body;
}

app.use(route.get('/room/:id', function *(id){
    this.body = yield* getVideos(id);
}));

addon.webhook('room_message', /^\/roomid$/, function *() {
  this.roomClient.sendNotification('your room id is: "' + this.room.id + '"');
});

app.use(route.get('/template', function *() {
    yield send(this, __dirname + "/templates/index.html");
}));

app.use(route.get('/results', function *() {
    yield send(this, __dirname + '/templates/results.html');
}));

app.use(route.get('/cool', function *() {
    response.send(cool());
}));

app.use(serve(__dirname + '/public'));

var co = require("co");
var server = require('http').createServer(app.callback());
var io = require('socket.io')(server);

var _ = require('underscore');

var sync = require('./server/sync/sync.js');
sync.init(io, redisClient, coRedisClient, request);

server.listen(process.env.PORT);