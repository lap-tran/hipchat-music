var _ = require('underscore');
var co = require('co');

var Sync = function() {
    return {
        currentSong: {},
        numberListeners: 0,
        numberFinish: 0,
        init: init
    }
};

function init(io, redisClient, coRedisClient, request) {
    var that = this;
    var nextSongTimeout;

    io.on('connection', function(socket) {
        that.numberListeners++;
        that.socket = socket;

        console.log(socket.id);

        console.log('Now ' + that.numberListeners + " is listening!");

        socket.on('register', function(token) {

        });

        socket.on('video timechanged', function(data) {
            if(_.isEmpty(that.currentSong)) {
                that.currentSong.song = data.song;
                that.currentSong.current = data.current;
            } else {
                if (that.currentSong.song === data.song && data.current > that.currentSong.current) {
                    // update the time when user play the same song and new time is greater than the old one
                    that.currentSong.current = data.current;
                }

                if (data.song !== that.currentSong.current) {

                }
            }
        });

        socket.on('video.end', function(data) {
            console.log('end video recieved....');

            // event fired when song is finish in one player
            that.numberFinish++;

            // move to next song
            function nextSong() {
                // move to next song
                co(function *() {
                    clearTimeout(nextSongTimeout);

                    if(!nextSongTimeout) {
                        console.log("timeout cleared");
                    }

                    yield *_removeSongFromRedis(coRedisClient, data.song, 'room-00000', co);

                    var body = yield *_getVideo(coRedisClient, request);
                    console.log(body);
                    io.sockets.emit('video changevideo', body);
                });
            }

            if (that.numberFinish === that.numberListeners) {
                console.log('move to next song');
                //remove the finish one from redis
                // TODO replace hardcode room with right one
                nextSong();
            } else {
                console.log('wait for another end!!');
                //if(!nextSongTimeout) {
                    console.log("counting down now!!!");
                    nextSongTimeout = setTimeout(nextSong, 2000);
                //}
            }
        });

        socket.on('video.change.track', function(data) {
            // send notification to all players
            co(function *() {
                yield *_removeSongFromRedis(coRedisClient, data.currentId, 'room-00000', co);

                var body = yield *_getVideo(coRedisClient, request);

                var items = _.reduce(body.items, function(acc, video) {

                    if (video.id === data.videoId) {
                        return [video].concat(acc);
                    } else {
                        return acc.concat([video]);
                    }
                }, []);

                console.log(items);

                body.items = items;

                that.currentSong = {};
                io.sockets.emit('video changevideo', body);
            });
        });

        socket.on('disconnect', function(){
            that.numberListeners--;

            if (that.numberListeners <= 0) {
                that.currentSong = {};
            }
        });
    });
};

function *_removeSongFromRedis(coRedisClient, video, roomId, co) {
    console.log("remove song " + video);

    var allSongs = yield coRedisClient.lrange(roomId, 0, -1);

    console.log("REPLYxxx ---- " + JSON.stringify(allSongs));

    var videoIndex = -1;
    for (var i = 0; i < allSongs.length; i++) {
        console.log(allSongs[i]);
        var vo = JSON.parse(allSongs[i]);

        if (vo.videoId === video) {
            videoIndex = i;
            break;
        }
    }

    if (videoIndex < 0) {
        console.log('The song "' + video + '" doesn\'t exsists in the playlist');
    } else {
        allSongs.splice(videoIndex, 1);
        var newList = [roomId];
        for (var i = 0; i < allSongs.length; i++) {
            newList.push(allSongs[i]);
        }
        var y = yield coRedisClient.del(roomId);
        console.log("DEL ROOm " + y);
        yield coRedisClient.rpush(newList);
        console.log("REMOVE to " + newList);
    }
}

function *_getVideo(coRedisClient, request) {
    // var roomId = 'room-' + id;
    var roomId = 'room-00000';

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
            return stored.videoId = tubeSong.id;
        });
        if (matchingStoredSong) {
            tubeSong.sender = matchingStoredSong.sender;
        }
        return tubeSong
    });

    return body;
}

module.exports = new Sync();
