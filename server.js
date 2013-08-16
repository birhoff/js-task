var DbWrapper = function () {
    this._db = {
        files: {},
        transactions: {}
    };
};


var app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    fs = require('fs'),
    db = new DbWrapper;

io.set('log level', 1);
server.listen(8080);

var senderIo = io.of('/sender').on('connection', function (socket) {
    "use strict";

    socket.on('registerFile', function (info) {
        var dbItem = {
            socket: socket,
            file: info.file,
            parts: info.parts
        };
        var fileId = db.add(Tables.Files, dbItem);
        socket.emit("fileRegistered", null, fileId);
    });

    socket.on("sendData", function sendData(transactionId, data) {
        var transaction = db.get(Tables.Transactions, transactionId);
        if (transaction.data) {
            setTimeout(sendData, 100, transactionId, data);
            return;
        }
        transaction.data = data;
    });
});

var recipientIo = io.of('/recipient').on('connection', function (socket) {
    "use strict";

    socket.on("openTransaction", function (fileId, callback) {
        var dbItem = db.get(Tables.Files, fileId);
        var transactionId = db.add(Tables.Transactions, {file: fileId, recipient: socket, sender: dbItem.socket});
        dbItem.socket.emit("openTransaction", transactionId);
        callback(null, transactionId);
        dbItem.socket.emit("getData");
    });

    socket.on("closeTransaction", function (transactionId) {
        var transaction = db.get(Tables.Transactions, transactionId);
        transaction.sender.emit("closeTransaction", transactionId);
        db.set(Tables.Transactions, transactionId, null);
    });

    socket.on("getData", function getData(transactionId) {
        var transaction = db.get(Tables.Transactions, transactionId);
        if (!transaction.data) {
            setTimeout(getData, 300, transactionId);
            return;
        }
        transaction.sender.emit("getData");
        transaction.recipient.emit("reciveData", transaction.data);
        transaction.data = null;
    });
});


/* Request handlers */
app.get(/\/js\/(.+)/, function (req, res) {
    res.sendfile(__dirname + '/js/' + req.params[0]);
});

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/sender.html');
});

app.get(/^\/file\/(\w+)/, function (req, res) {
    var uuid = req.params[0],
        pInfo = db.get(Tables.Files, uuid);

    fs.readFile('recipient.html', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }
        res.send(data.replace('[FileName]', pInfo.file.name).replace('[UUID]', uuid).replace('[Parts]', pInfo.parts).replace("[LENGTH]", pInfo.file.size));
    });
});

var Tables = {
    Files: "files",
    Transactions: "transactions"
};

DbWrapper.prototype.set = function (table, key, value) {
    "use strict";
    this._db[table][key] = value;
};
DbWrapper.prototype.get = function (table, key) {
    "use strict";
    return this._db[table][key];
};
DbWrapper.prototype.add = function (table, value) {
    "use strict";
    var key = DbWrapper.getFileIdentificator(this._db[table]);
    this._db[table][key] = value;
    return key;
};
DbWrapper.getFileIdentificator = function (table) {
    "use strict";
    var result = null;
    while (!result) {
        result = 'xxxxxx'.replace(/[x]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        if (table[result]) result = null;
    }
    return result;
};