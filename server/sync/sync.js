"use strict";

var Sync = function() {
    return {
        currentSong: {},
        numberListeners: 0,
        numberFinish: 0,
        init: init
    }
};

function init(io, _) {
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

            console.log(JSON.stringify(that.currentSong));
        });

        var nextSongTimeout;
        socket.on('video end', function(data) {
            // event fired when song is finish in one player
            that.numberFinish++;

            if (that.numberFinish === that.numberListeners) {
                // move to next song

                if (nextSongTimeout) {
                    clearTimeout(nextSongTimeout);
                }
            } else {
                if(!nextSongTimeout) {
                    nextSongTimeout = setTimeout(function() {
                        // move to next song
                    }, 5000);
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

module.exports = new Sync();
