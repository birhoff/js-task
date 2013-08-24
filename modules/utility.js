"use strict";

var Utility = {
    getTypedSize: function (size) {
        var fileSize = {};
        if (size < 1024) {
            // size in bytes
            fileSize.value = size;
            fileSize.type = "bytes";
        } else {
            if (size < 1024 * 1024) {
                // in kb
                fileSize.value = (size / 1024).toFixed(2);
                fileSize.type = "kb";
            } else {
                // mb
                fileSize.value = (size / (1024 * 1024)).toFixed(2);
                fileSize.type = "mb";
            }
        }
        fileSize.length = size;
        return fileSize;
    },
    getFileId: function () {
        return 'xxxxxx'.replace(/[x]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

exports.Utility = Utility;