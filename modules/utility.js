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
    }
}

exports.Utility = Utility;