var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";

var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var timer;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: 'nfWlot6h_JM',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

}

function onPlayerReady(event) {
    event.target.playVideo();
    updateTimeclasp();
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

function updateTimeclasp() {
    var run = function() {
        var current = Math.round(player.getCurrentTime());
        $('.timeclasp').text(current);
    };

    timer = setInterval(run, 1000);
}