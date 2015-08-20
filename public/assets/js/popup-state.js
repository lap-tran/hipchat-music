var PopupState = (function() {
    function key(name) {
        return "popup-state:" + name;
    }

    function registerOpen(name) {
        setInterval(function() {
                var time = new Date().getTime();
                localStorage.setItem(key(name), time);
            }, 500);
    }

    function trackClose(name) {
        var closed = $.Deferred();
        setInterval(function() {
                var lastTime = localStorage.getItem(key(name));
                lastTime = lastTime ? parseInt(lastTime) : 0;

                if (new Date().getTime() - lastTime > 1000) {
                    closed.resolve();
                }
            }, 500);

        return closed;
    }
    
    return {
        registerOpen: registerOpen,
        trackClose: trackClose
    };
})();