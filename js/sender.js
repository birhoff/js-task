var Socket = {
    commands: {
        register: "registerFile",
        onRegister: "fileRegistered",
        openTransaction: "openTransaction",
        send: "sendData"}
};

function Sender(socket) {
    "use strict";

    var self = this;
    this._file = null;
    this._parts = null;
    this._socket = socket;
}

Sender.prototype.register = function (file, callback) {
    "use strict";
    var self = this,
        transactionId = null,
        transitMng = null;

    this._file = file;
    this._parts = Sender.slice(file);

    if (!self._file || !self._parts.length) {
        callback("Incorrect file", null);
        return;
    }

    socket.on(Socket.commands.onRegister, function (error, fileId) {
        if (error) {
            console.log(error.message);
        }

        socket.on(Socket.commands.openTransaction, function (id) {
            transactionId = id;
            transitMng = new TransitManager(id, self._socket, self._parts);

            $(transitMng).on("process", function(event, value){
                $(self).trigger("process", value);
            });

            $(transitMng).on("endUpload", function(event, value){
                $(self).trigger("endUpload");
            });

            transitMng.start();
            $(self).trigger("startUpload");
        });
        callback && callback(Sender.idToUrl(fileId));
    });

    socket.emit(Socket.commands.register, { file: self._file, parts: self._parts.length });
};

/** Return array of Blobs with size = partSize or  1024 * 64 as default blob size */
Sender.slice = function (file, /* optional */ partSize) {
    "use strict";
    var chunkSize = partSize || 1024 * 1024,
        result = [],
        currentOffset = 0, parts, bytesLeft;

    if (!file) return result;
    if (file.size < chunkSize) return [
        {blob: file, data: null}
    ];

    parts = Math.floor(file.size / chunkSize);
    bytesLeft = file.size % chunkSize;

    for (var i = 0; i < parts; i++) {
        result.push({blob: file.slice(currentOffset, currentOffset + chunkSize), data: null});
        currentOffset += chunkSize;
    }

    /* */
    if (bytesLeft !== 0) {
        result.push({blob: file.slice(currentOffset, file.size), data: null});
    }
    return result;
}

Sender.idToUrl = function (fileId) {
    "use strict";
    return window.location.origin + '/file/' + fileId;
};

function TransitManager(transactionId, socket, parts) {
    "use strict";
    var self = this;

    this._id = transactionId;
    this._socket = socket;
    this._parts = parts;

    socket.on("closeTransaction", function () {
        console.log("closeTransition");
        $(self).trigger("endUpload");
    });
};

TransitManager.prototype.start = function () {
    "use strict";
    var self = this,
        reader = new FileReader,
        currentIndex = 0,
        readIndex = 0;

    readDataAsync();


    self._socket.on("getData", function sendPart() {
        if (!self._parts[currentIndex]) return;
        if (!self._parts[currentIndex].data) {
            setTimeout(sendPart, 300);
            return;
        }
        console.log((new Date).toTimeString() + " | Send part " + (currentIndex + 1) + " of " + self._parts.length);
        socket.emit(Socket.commands.send, self._id, self._parts[currentIndex].data);
        $(self).trigger("progress", (currentIndex / self._parts.length * 100).toFixed(0));
        self._parts[currentIndex].data = null;
        currentIndex++;
    });

    function readDataAsync() {
        reader.onloadend = function (event) {
            console.log((new Date).toTimeString() + "Part read: " + (readIndex + 1) + " of " + self._parts.length);
            var status = readIndex === self._parts.length - 1 ? "complete" : "process",
                data = event.target.result;
            self._parts[readIndex].data = {status: status, data: data};
            if (status === "complete") return;
            readIndex++;

            /* Max read ahead for 100 parts + 1 */
            checkReadBuffer();

            function checkReadBuffer() {
                if (readIndex > currentIndex + 100) {
                    setTimeout(checkReadBuffer, 2000);
                    return;
                }
                reader.readAsDataURL(self._parts[readIndex].blob);
            }
        };
        reader.readAsDataURL(self._parts[readIndex].blob);
    }
};

if (!window.location.origin)
    window.location.origin = window.location.protocol + "//" + window.location.host;