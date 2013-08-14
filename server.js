/** require */
/**
 * Created with JetBrains WebStorm.
 * User: КоТ
 * Date: 13.08.13
 * Time: 20:33
 * To change this template use File | Settings | File Templates.
 */

var app = require('express')(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    fs = require('fs'),
    fDataBase = {}; // simple db object that stores data for every link for download

io.set('log level', 1);
server.listen(8080);

// debug part
var args = {};


app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

app.get(/^\/file\/(\w+)/, function (req, res) {
    var uuid = req.params[0],
        pInfo = fDataBase[uuid];

    fs.readFile('reciveFile.html', 'utf8', function (err, data) {
        if (err) {
            return console.log(err);
        }

        res.send(data.replace('[FileName]', pInfo.fileInfo.path).replace('[UUID]', uuid));
    });
});


io.sockets.on('connection', function (socket) {

    socket.on('registerFile', function (fInfo, callback) {
        var uuid = Utility.getFileIdentificator(fDataBase);
        var dbItem = fDataBase[uuid] = {};
        dbItem.socket = socket;
        dbItem.fileInfo = fInfo;
        callback(uuid);
    });

    socket.on("openTransaction", function (uuid, callback) {
        var dbItem = fDataBase[uuid];
        dbItem.socket.emit("openTransaction", function (data) {
            "use strict";
            callback(data);
        });
    });

    socket.on("closeTransaction", function (uuid) {
        var dbItem = fDataBase[uuid];
        dbItem.socket.emit("closeTransaction");
    });

    socket.on("readData", function (uuid, callback) {
        var dbItem = fDataBase[uuid];
        dbItem.socket.emit("readData", function (data) {
            "use strict";
            callback(data);
        });
    });
});


var Utility = {
    getFileIdentificator: function (dataBase) {
        "use strict";
        var result = null;
        while (!result) {
            result = 'xxxxxx'.replace(/[x]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            if (dataBase[result]) result = null;
        }
        return result;
    }
};

/* response for JS files */
app.get(/\/js\/(.+)/, function (req, res) {
    res.sendfile(__dirname + '/js/' + req.params[0]);
});