if (!window.location.origin)
    window.location.origin = window.location.protocol + "//" + window.location.host;

function FileRegister(socket) {
    "use strict";
    this.socket = socket;
}

FileRegister.prototype.register = function (fInfo, onFileRequest, callback) {
    "use strict";

    socket.emit('registerFile', { file: fInfo }, function (uuid) {
        socket.on("openTransaction", onFileRequest);
        callback && callback(window.location.origin + '/file/' + uuid);
    });
};

function Transition(socket, file) {
    "use strict";
    var self = this,
        reader = new FileReader,
        data = null,
        dataCallback = null;


    this.onComplete = null;
    this.chunks = getChunks(file);


    reader.onloadend = function (event) {
        var status = self.chunks.length ? "process" : "complete";

        data = event.target.result;
        dataCallback({status: status, data: data, partsLeft: self.chunks.length});
    };

    socket.on("closeTransaction", function () {
        self.onComplete && self.onComplete();
    });

    socket.on("readData", function (callback) {
        if (!self.chunks.length) return;
        var chunk = self.chunks.shift();
        dataCallback = callback;
        reader.readAsBinaryString(chunk);
    });

    function getChunks(file) {
        //1024 * 64 default value
        var chunkSize = 1024 * 64 * 64,
            result = [],
            parts,
            reminder,
            currentOffset = 0;

        if (file.size < chunkSize) return [file];

        parts = Math.floor(file.size / chunkSize);
        reminder = file.size % chunkSize;

        for (var i = 0; i < parts; i++) {
            result.push(file.slice(currentOffset, currentOffset + chunkSize));
            currentOffset += chunkSize;
        }

        /* Для последнего элемента есть некоторые ограничения */
        if (reminder === 0) return;

        result.push(file.slice(currentOffset, file.size));
        return result;
    };
};