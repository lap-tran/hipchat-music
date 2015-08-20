var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";

var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var timer;

var socket = io();

socket.emit('register', {token: '1234'});

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: '-aEhUyrkDto',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

    addListener();
}

function addListener() {
    $('.controls .mute').click(function() {
        if (player.isMuted()) {
            $(this).attr('aria-pressed', false);
            player.unMute()
        } else {
            $(this).attr('aria-pressed', true);
            player.mute();
        }
    });
}

function onPlayerReady(event) {
    event.target.playVideo();
    player.setPlaybackQuality('small');
    updateClipInfo();
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        // Here we can start next one
        console.log(player.getCurrentTime());
    }
}

function stopVideo() {
    player.stopVideo();
    clearinterval(timer);
}

function updateClipInfo() {
    updateTimeclasp();
    updateDuration();
    $('.playing .box-title').text(player.getVideoData().title);
}

function updateTimeclasp() {
    var run = function() {
        var current = secondsToTime(player.getCurrentTime());
        $('.playing .timeclasp').text(current.m +':'+ current.s);

        socket.emit('video timechanged', {
            token: '1234',
            song: player.getVideoData().video_id,
            current: player.getCurrentTime()
        });
    };

    timer = setInterval(run, 1000);
}

function updateDuration() {
    var duration = secondsToTime(player.getDuration());
    $('.playing .duration').text(duration.m +':'+ duration.s);
}

function secondsToTime(secs)
{
    secs = Math.round(secs);
    var hours = Math.floor(secs / (60 * 60));

    var divisor_for_minutes = secs % (60 * 60);
    var minutes = Math.floor(divisor_for_minutes / 60);

    var divisor_for_seconds = divisor_for_minutes % 60;
    var seconds = Math.ceil(divisor_for_seconds);

    var obj = {
        "h": (hours + '').length <= 1 ? '0' + hours : hours,
        "m": (minutes + '').length <= 1 ? '0' + minutes : minutes,
        "s": (seconds + '').length <= 1 ? '0' + seconds : seconds
    };
    return obj;
}

function mute() {

}
