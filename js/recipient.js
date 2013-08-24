"use strict";

function Receiver(socket, fileInfo) {
    this._socket = socket;
    this._fileInfo = fileInfo;
    this._saver = Saver.get();

    this.onStart = null;
    this.onProgress = null;
    this.onEnd = null;
}

Receiver.prototype.start = function (callback) {
    var self = this,
        transitionId = null,
        startTime = null,
        parts = 0;

    this._saver.start(this._fileInfo);

    socket.on("reciveData", function (result) {
        self._saver.add(result.data);
        result.data = null;
        parts++;
        self.onProgress && self.onProgress(parseInt(((parts / self._fileInfo.parts) * 100).toFixed(0)));

        if (result.status === "complete") {
            var endTime = new Date(),
                timeElapsed = new Date(endTime - startTime),
                durationString = timeElapsed.getMinutes() + ":" + timeElapsed.getSeconds() + "." + timeElapsed.getMilliseconds();

            console.log("Downloaded parts: " + parts + ". All parts: " + self._fileInfo.parts + ". In: " + durationString);
            socket.emit("closeTransaction", transitionId);
            self._saver.stop(function (url) {
                callback(null, {duration: timeElapsed, url: url});
                return;
            });
            return;
        }
        socket.emit("getData", transitionId);
    });

    socket.emit("openTransaction", self._fileInfo.id, function (error, id) {
        transitionId = id;
        startTime = new Date();
        socket.emit("getData", transitionId);
    });
};

var Saver = {
    get: function () {
        var saver = window.webkitRequestFileSystem ? new FileSystemSaver : new RamSaver;
        return saver;
    },
    States: {
        readyForWrite: "readyForWrite",
        complete: "complete",
        downloadComplete: "downloadComplete",
        writing: "writing"
    },
    dataURLToBlob: function (dataURL) {
        var BASE64_MARKER = ';base64,',
            parts = null,
            contentType = null,
            raw = null;

        if (dataURL.indexOf(BASE64_MARKER) == -1) {
            parts = dataURL.split(',');
            contentType = parts[0].split(':')[1];
            raw = parts[1];

            return new Blob([raw], {type: contentType});
        }

        parts = dataURL.split(BASE64_MARKER);
        contentType = parts[0].split(':')[1];
        raw = window.atob(parts[1]);
        var rawLength = raw.length;
        var uInt8Array = new Uint8Array(rawLength);

        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], {type: contentType});
    }
};


function FileSystemSaver() {

    this._info = null;
    this._data = [];
    this._fs = null;
    this._state = "";
    this._fileHandler = null;
    this._fileWriter = null;
    this._url = null;
    this._onSave = null;

    this._write = function () {
        if (this._state === Saver.States.readyForWrite)
            this._state = Saver.States.writing;

        if (!this._data.length && this._state === Saver.States.downloadComplete) {
            this._url = this._fileHandler.toURL();
            this._state = Saver.States.complete;
            if (this._onSave) this._onSave(this._url);
            return;
        }
        if (!this._data.length) {
            setTimeout(this._write, FileSystemSaver.settings.writeTimeout)
            return;
        }

        var blobs = [];

        while (this._data.length) {
            var dataItem = this._data.shift();
            blobs.push(Saver.dataURLToBlob(dataItem));
            dataItem = null;
        }

        var bb = new Blob(blobs);
        this._fileWriter.seek(this._fileWriter.length);
        this._fileWriter.write(bb);
        bb = null;
    }
}

FileSystemSaver.prototype.start = function (info) {
    var self = this;

    this._info = info;

    window.webkitRequestFileSystem(window.TEMPORARY, info.length, function (filesystem) {
        self._fs = filesystem;
        initFileWriter(self._info.name, self._fs);
    }, FileSystemSaver.errorHandler);

    function initFileWriter(name, fs) {
        fs.root.getFile(name, {create: true}, function (fileEntry) {
            fileEntry.remove(function () {
                fs.root.getFile(name, {create: true}, function (fileEntry) {
                    self._fileHandler = fileEntry;
                    fileEntry.createWriter(function (fileWriter) {
                        self._fileWriter = fileWriter;

                        fileWriter.onwriteend = function (e) {
                            setTimeout(function () {
                                self._write();
                            }, FileSystemSaver.settings.writeTimeout);
                        };

                        fileWriter.onerror = function (e) {
                            console.log('Write failed: ' + e.toString());
                        };

                        self._state = Saver.States.readyForWrite;
                    }, FileSystemSaver.errorHandler);
                }, FileSystemSaver.errorHandler);
            });
        }, FileSystemSaver.errorHandler);
    };
};

FileSystemSaver.prototype.stop = function (callback) {
    this._state = Saver.States.downloadComplete;
    this._onSave = callback;
}

FileSystemSaver.prototype.add = function (data) {
    this._data.push(data);
    /* if fileSystem ready start writing */
    if (this._state === Saver.States.readyForWrite) {
        this._write();
    }
};

FileSystemSaver.errorHandler = function (e) {
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

FileSystemSaver.settings = {
    writeTimeout: 2000
};

function RamSaver() {
    this._data = [];
    this._url = null;
    this._onSave = null;
    this._blob = null;
    this._state = "";

    this._write = function () {
        if (this._state === Saver.States.readyForWrite)
            this._state = Saver.States.writing;

        if (!this._data.length && this._state === Saver.States.downloadComplete) {
            this._url = URL.createObjectURL(this._blob);
            this._state = Saver.States.complete;
            if (this._onSave) this._onSave(this._url);
            return;
        }
        if (!this._data.length) {
            setTimeout(this._write, FileSystemSaver.settings.writeTimeout)
            return;
        }

        var blobs = [];

        while (this._data.length) {
            var dataItem = this._data.shift();
            blobs.push(Saver.dataURLToBlob(dataItem));
            dataItem = null;
        }
        if (blobs.length) {
            if (this._blob) blobs.unshift(this._blob);
            this._blob = new Blob(blobs);
            blobs = null;
            setTimeout(this._write, 2000);
        }
    };
};

RamSaver.prototype.start = function (info) {
    setTimeout(this._write, 2000);
};

RamSaver.prototype.stop = function (callback) {
    this._state = Saver.States.downloadComplete;
    this._onSave = callback;
};

RamSaver.prototype.add = function (data) {
    this._data.push(data);
};

