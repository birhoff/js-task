var fs = null;

function Receiver(socket) {
    "use strict";
    this._socket = socket;
    this._data = [];
}

Receiver.prototype.start = function () {
    "use strict";
    var self = this,
        transitionId = null;

    socket.on("reciveData", function (result) {
        self._data.push(result.data);
        console.log((new Date).toTimeString() + " | Part: " + self._data.length + " of " + fileInfo.parts);
        if (result.status === "complete") {
            console.log("Downloaded parts: " + self._data.length + ". All parts: " + fileInfo.parts);
            return;
        }
        socket.emit("getData", transitionId);
    });

    socket.emit("openTransaction", fileInfo.id, function (error, id) {
        transitionId = id;
        socket.emit("getData", transitionId);
    });
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


                window.requestFileSystem(window.TEMPORARY, file.length, function (filesystem) {
                    fs = filesystem;
                    fs.root.getFile(uuid + ".tmp", {create: true}, function (fileEntry) {
                        fileEntry.createWriter(function (fileWriter) {

                            fileWriter.onwriteend = function (e) {
                                $("#download-link").attr("href", fileEntry.toURL());
                                $("#download-link").show();
                            };

                            fileWriter.onerror = function (e) {
                                console.log('Write failed: ' + e.toString());
                            };

                            var bb = new Blob([file]);
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
            }
        });
    });
}

window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
