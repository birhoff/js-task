"use strict";

var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    jade = require("jade"),
    db = new (require('./modules/simple.database').DbWrapper)(),
    Utility = require('./modules/utility').Utility;

app.configure('all', function () {
    app.use('/js', express.static(__dirname + '/public/js'));
    app.use('/images', express.static(__dirname + '/public/images'));
    app.use('/styles', express.static(__dirname + '/public/styles'));
    app.use('/libs', express.static(__dirname + '/public/libs'));
    app.use('/', express.static(__dirname + "/public"));
});

server.listen(8080);

io.set('log level', 1);

io.of('/sender').on('connection', function (socket) {
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

io.of('/recipient').on('connection', function (socket) {
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

app.get('/', function (req, res) {
    res.send(jade.renderFile('./templates/sender.jade'));
});

app.get(/^\/file\/(\w+)/, function (req, res) {
    var uuid = req.params[0],
        pInfo = db.get(Tables.Files, uuid),
        fileInfo = {
            id: uuid,
            name: pInfo.file.name,
            parts: pInfo.parts,
            size: Utility.getTypedSize(pInfo.file.size)
        },
        locals = {fileInfo: fileInfo};

    res.send(jade.renderFile('./templates/recipient.jade', locals));
});

var Tables = {
    Files: "files",
    Transactions: "transactions"
};