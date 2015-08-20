var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";

var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var timer;
var currentTrack;

var socket = io();

socket.emit('register', {token: '1234'});

var isLivePlayer = window.location.href.indexOf("livePlayerId=") != -1;
if (isLivePlayer) {
    PopupState.registerOpen("livePlayer");
} else if (PopupState.isOpen("livePlayer")) {
    enableLivePlayer(false);
    PopupState.trackClose("livePlayer").done(function() {
        enableLivePlayer(true);
        player && player.unMute();
    });
}

$(".live-player").click(function() {
    window.open("/page?livePlayerId=1234", "livePlayer", "'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=420, height=600");
    enableLivePlayer(false);
    player && player.mute();
    setTimeout(function() {
        PopupState.trackClose("livePlayer").done(function() {
            enableLivePlayer(true);
            player && player.unMute();
        });
    }, 5000);

});

function enableLivePlayer(enable) {
    if (enable) {
        $(".group-content .controls").parent().parent().show();
    } else {
        $(".group-content .controls").parent().parent().hide();
    }
}

function onYouTubeIframeAPIReady() {
    var items = VIDEO_LIST.items;
    currentTrack = items.shift();
    player = createFirstPlay(currentTrack.id);

    createPlaylist(items);
}

function createPlaylist(items) {
    var tmpItem = $('#queue-item').html();
    var tempArr = [];
    $.each(items, function(index, value) {
        var dur = secondsToTime(convert_time(value.contentDetails.duration) * 1000 + '');
        tempArr.push(Mustache.render(tmpItem, {
            title: value.snippet.title,
            thumb: value.snippet.thumbnails.default.url,
            duration: dur.m +':'+ dur.s,
            sender: value.sender
        }));
    });

    $('.playlist .group-content').html(tempArr.join(' '));
}

function createFirstPlay(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        return player;
    }

    return new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: videoId,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
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

    if (!$(".group-content .controls").is(":visible")) {
        player.mute();
    }
    
    if (currentTrack.seekTo) {
        player.seekTo(currentTrack.seekTo);
    }
    updateClipInfo();
    addListener();
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {

    } else if (event.data == YT.PlayerState.ENDED) {
        console.log('end song ====================');
        socket.emit('video.end', {
            song: player.getVideoData().video_id
        });
    }
}

function stopVideo() {
    player.stopVideo();
    clearinterval(timer);
}

function updateClipInfo() {
    updateTimeclasp();
    updateDuration();
    var data = player.getVideoData();
    $('.playing .box-title').text(data.title);
    $('.playing .img').attr('src', '//img.youtube.com/vi/'+ data.video_id +'/0.jpg');
    $('.playing .sender').text(currentTrack.sender);
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

function convert_time(duration) {
    var a = duration.match(/\d+/g);

    if (duration.indexOf('M') >= 0 && duration.indexOf('H') == -1 && duration.indexOf('S') == -1) {
        a = [0, a[0], 0];
    }

    if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1) {
        a = [a[0], 0, a[1]];
    }
    if (duration.indexOf('H') >= 0 && duration.indexOf('M') == -1 && duration.indexOf('S') == -1) {
        a = [a[0], 0, 0];
    }

    duration = 0;

    if (a.length == 3) {
        duration = duration + parseInt(a[0]) * 3600;
        duration = duration + parseInt(a[1]) * 60;
        duration = duration + parseInt(a[2]);
    }

    if (a.length == 2) {
        duration = duration + parseInt(a[0]) * 60;
        duration = duration + parseInt(a[1]);
    }

    if (a.length == 1) {
        duration = duration + parseInt(a[0]);
    }
    return duration
}

socket.on('video changevideo', function(body){
    console.log(body);
    var items = body.items;
    currentTrack = items.shift();
    player = createFirstPlay(currentTrack.id);

    createPlaylist(items);
});

