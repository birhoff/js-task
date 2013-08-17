var fs = null;

function Receiver(socket) {
    "use strict";
    this._socket = socket;
    this._fileInfo = fileInfo;
    this._saver = Saver.get();
}

Receiver.prototype.start = function (callback) {
    "use strict";
    var self = this,
        transitionId = null,
        startTime = null,
        parts = 0;

    self._saver.start(window.fileInfo);

    socket.on("reciveData", function (result) {
        self._saver.add(result.data);
        result.data = null;
        parts++;

        if (result.status === "complete") {
            var duration = (new Date((new Date) - startTime));
            console.log("Downloaded parts: " + parts + ". All parts: " + fileInfo.parts + ". In: " + duration.getMinutes() + ":" + duration.getSeconds());
            socket.emit("closeTransaction", transitionId);
            self._saver.stop(function (url) {
                callback(null, {duration: duration, url: url});
                return;
            });
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


function Saver() {
    "use strict";

};

Saver.get = function () {
    "use strict";
    var saver = window.webkitRequestFileSystem ? new FileSystemSaver : new RamSaver;
    return saver;
};

Saver.States = {
    readyForWrite: "readyForWrite",
    complete: "complete",
    downloadComplete: "downloadComplete",
    writing: "writing"
}

Saver.dataURLToBlob = function (dataURL) {
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
};


function FileSystemSaver() {
    "use strict";
    var self = this;

    this._info = null;
    this._data = [];
    this._fs = null;
    this._state = "";
    this._fileHandler = null;
    this._fileWriter = null;
    this._url = null;
    this._onSave = null;

    this._write = function () {
        if (self._state === Saver.States.readyForWrite)
            self._state = Saver.States.writing;

        if (!self._data.length && self._state === Saver.States.downloadComplete) {
            self._url = self._fileHandler.toURL();
            self._state = Saver.States.complete;
            if (self._onSave) self._onSave(self._url);
            return;
        }
        if (!self._data.length) {
            setTimeout(self._write, FileSystemSaver.settings.writeTimeout)
            return;
        }

        var blobs = [];

        while (self._data.length) {
            var dataItem = self._data.shift();
            blobs.push(Saver.dataURLToBlob(dataItem));
            dataItem = null;
        }

        var bb = new Blob(blobs);
        self._fileWriter.seek(self._fileWriter.length);
        self._fileWriter.write(bb);
        bb = null;
    }
}

FileSystemSaver.prototype.start = function (info) {
    "use strict";
    var self = this;

    self._info = info;

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
    "use strict";
    this._state = Saver.States.downloadComplete;
    this._onSave = callback;
}

FileSystemSaver.prototype.add = function (data) {
    "use strict";
    var self = this;

    self._data.push(data);
    /* if fileSystem ready start writing */
    if (self._state === Saver.States.readyForWrite) {
        self._write();
    }
};

FileSystemSaver.prototype.getUrl = function () {
    "use strict";
    return this._url;
}

FileSystemSaver.errorHandler = function (e) {
    debugger;
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
    "use strict";
    this._data = [];
    this._url = null;
    this._onSave = null;
    this._blob = null;
};

RamSaver.prototype.start = function (info) {
    "use strict";

};

RamSaver.prototype.stop = function (callback) {
    "use strict";
    var self = this;
    var blobs = [];

    while (self._data.length) {
        var dataItem = self._data.shift();
        blobs.push(Saver.dataURLToBlob(dataItem));
        dataItem = null;
    }
    self._blob = new Blob(blobs);
    self._url = URL.createObjectURL(self._blob);
    blobs = null;
    callback(self._url);
};

RamSaver.prototype.add = function (data) {
    "use strict";
    this._data.push(data);
};

RamSaver.prototype.getUrl = function () {
};