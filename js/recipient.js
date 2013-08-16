var fs = null;

function Receiver(socket) {
    "use strict";
    this._socket = socket;
    this._data = [];
    this._fileInfo = fileInfo;
}

Receiver.prototype.start = function (callback) {
    "use strict";
    var self = this,
        transitionId = null,
        startTime = null;

    socket.on("reciveData", function (result) {
        self._data.push(result.data);
        if (result.status === "complete") {
            var duration = (new Date((new Date) - startTime));
            console.log("Downloaded parts: " + self._data.length + ". All parts: " + fileInfo.parts + ". In: " + duration.getMinutes() + ":" + duration.getSeconds());
            socket.emit("closeTransaction", transitionId);
            callback(null, duration);
            return;
        }
        socket.emit("getData", transitionId);
    });

    socket.emit("openTransaction", fileInfo.id, function (error, id) {
        transitionId = id;
        startTime = new Date;
        socket.emit("getData", transitionId);
    });

};

Receiver.prototype.getData = function () {
    "use strict";
    return {info: this._fileInfo, parts: this._data}
};

function Saver(data) {
    "use strict";
    this._data = data;
}

Saver.prototype.start = function (callback) {
    var info = this._data.info,
        parts = this._data.parts,
        fs = null;

    window.requestFileSystem(window.TEMPORARY, info.length, function (filesystem) {
        fs = filesystem;
        fs.root.getFile(info.name, {create: true}, function (fileEntry) {

            fileEntry.createWriter(function (fileWriter) {
                fileWriter.onwriteend = function (e) {
                    callback(null, fileEntry.toURL());
                };

                fileWriter.onerror = function (e) {
                    console.log('Write failed: ' + e.toString());
                    callback(e.toString(), null);
                };

                var blobs = [];

                for (var i = 0; i < parts.length; i++) {
                    blobs.push(dataURLToBlob(parts[i]));
                    parts[i] = null;
                }
                var bb = new Blob(blobs);
                fileWriter.write(bb);

            });
        });
    }, errorHandler);

    function errorHandler(e) {
        var msg = '';
        switch (e.code) {
            case FileError.QUOTA_EXCEEDED_ERR:
                msg = 'QUOTA_EXCEEDED_ERR';
                break;
            case FileError.NOT_FOUND_ERR:
                msg = 'NOT_FOUND_ERR';
                break;
            case FileError.SECURITY_ERR:
                msg = 'SECURITY_ERR';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                msg = 'INVALID_MODIFICATION_ERR';
                break;
            case FileError.INVALID_STATE_ERR:
                msg = 'INVALID_STATE_ERR';
                break;
            default:
                msg = 'Unknown Error';
                break;
        }
        console.log("Error: " + msg);
    }

    function dataURLToBlob(dataURL) {
        var BASE64_MARKER = ';base64,';
        if (dataURL.indexOf(BASE64_MARKER) == -1) {
            var parts = dataURL.split(',');
            var contentType = parts[0].split(':')[1];
            var raw = parts[1];

            return new Blob([raw], {type: contentType});
        }

        var parts = dataURL.split(BASE64_MARKER);
        var contentType = parts[0].split(':')[1];
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;

        var uInt8Array = new Uint8Array(rawLength);

        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], {type: contentType});
    }
};


function reciveFile() {

    socket.emit("openTransaction", uuid, function (data) {
        console.log("Open transaction status: " + data.status + ". Chunks: " + data.parts);
        var file = "";
        socket.emit("readData", uuid, function readDataCallback(result) {
            if (result.status === "error") {
                //TODO:
                return;
            }

            file += result.data;

            if (result.status == "process") {
                console.log("Part received. Left: " + result.partsLeft);
                /* не дошли до конца запрашиваем дальше */
                socket.emit("readData", uuid, readDataCallback);
                return;
            }

            if (result.status == "complete") {
                socket.emit("closeTransaction", uuid);


            }
        });
    });
}

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
