"use strict";

var _ = require('underscore');

var Sync = function() {
    return {
        currentSong: {},
        numberListeners: 0,
        numberFinish: 0,
        init: init
    }
};

function init(io, redisClient, coRedisClient, co, request) {
    var that = this;

    io.on('connection', function(socket) {
        that.numberListeners++;

        console.log('Now ' + that.numberListeners + " is listening!");

        socket.on('register', function(token) {
            console.log('user has been registed with token ' + token);
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

            //console.log(JSON.stringify(that.currentSong));
        });

        var nextSongTimeout;
        socket.on('video.end', function(data) {
            // event fired when song is finish in one player
            that.numberFinish++;

            if (that.numberFinish === that.numberListeners) {
                // move to next song

                console.log('move to next song');
                //remove the finish one from redis
                // TODO replace hardcode room with right one
                _removeSongFromRedis(coRedisClient, data.song, 'room-00000', co);

                var playlist = _getVideo(coRedisClient, co, request);

                console.log(playlist);

                if (nextSongTimeout) {
                    clearTimeout(nextSongTimeout);
                }
            } else {
                if(!nextSongTimeout) {
                    console.log('wait for another end!!')
                    nextSongTimeout = setTimeout(function() {
                        // move to next song
                        co(function *() {
                            _removeSongFromRedis(coRedisClient, data.song, 'room-00000', co);

                            console.log(JSON.stringify(data));

                            var playlist = _getVideo(coRedisClient, co, request);

                            console.log(playlist);

                        });
                    }, 2000);
                }
            }
        });

        socket.on('video songchanged', function(data) {
            // send notification to all players
        });

        socket.on('disconnect', function(){
            that.numberListeners--;
        });
    });
};

function _removeSongFromRedis(coRedisClient, video, roomId, co) {
    console.log("remove song " + video);

    // coRedisClient.ltrim(roomId, 1, )

    co(function* () {
        return yield coRedisClient.lrange(roomId, 0, -1);
    }).then(function(reply) {
        console.log("REPLY ---- " + JSON.stringify(reply));

        var videoIndex = -1;
        for (var i = 0; i < reply.length; i++) {
            var vo = JSON.parse(reply[i]);
            if (vo.videoId === video) {
                videoIndex = i;
                break;
            }
        }
        if (videoIndex < 0) {
            console.log('The song "' + video + '" doesn\'t exsists in the playlist');
        } else {
            reply.splice(videoIndex, 1);
            var newList = [roomId];
            for (var i = 0; i < reply.length; i++) {
                newList.push(reply[i]);
            }

            co(function* () {
                return yield coRedisClient.del(roomId);
            }).then( function() {
                co(function* () {
                    return yield coRedisClient.rpush(newList);
                }).then(function (reply) {
                    // Get current videos in the room
                    co(function* () {
                        return yield redisClient.lrange(roomId, 0, -1);
                    }).then(function(reply) {
                        console.log('The playlist are now: "' + reply + '"');
                    });
                });
            });
        }
    });
}

function _getVideo(coRedisClient, co, request) {
    var roomId = 'room-00000';

    // var apiKey = process.env.YOUTUBE_API_KEY;
    var apiKey = 'AIzaSyA7Mc1ZQMzlQihPgjYE2v2ktxJ-ODLEl0c';

    var videoIds = '';
    var response;

    var storedSongs = co(function *() {
        return yield coRedisClient.lrange(roomId, 0, -1);
    }).then(function(storedSongs) {
        console.log("11111111 \n" + JSON.stringify(storedSongs));
        return storedSongs;
    });

    console.log("22222222 \n" + JSON.stringify(storedSongs));

    storedSongs = _.map(storedSongs, function (string) {
        return JSON.parse(string);
    });

    if (typeof storedSongs === "object") {
        videoIds = _.pluck(storedSongs, 'videoId').join(',');
    }

    if (videoIds !== '') {
        response = co(function *() {
            return yield request.get({
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
        });
    } else {
        return {items: {}};
    }

    console.log(response);

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
