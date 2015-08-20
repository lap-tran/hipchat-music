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
        var handler = setInterval(function() {
                var lastTime = localStorage.getItem(key(name));
                lastTime = lastTime ? parseInt(lastTime) : 0;

                var current = new Date().getTime();
                if (current - lastTime > 1000) {
                    clearInterval(handler);
                    closed.resolve();
                }
            }, 500);

        return closed;
    }
    
    function isOpen(name) {
        var lastTime = localStorage.getItem(key(name));
        lastTime = lastTime ? parseInt(lastTime) : 0;
        return new Date().getTime() - lastTime < 1000;
    }

    return {
        registerOpen: registerOpen,
        trackClose: trackClose,
        isOpen: isOpen
    };
})();