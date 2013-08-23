"use strict";

var DbWrapper = function () {
    this._db = {
        files: {},
        transactions: {}
    };
};

DbWrapper.prototype.set = function (table, key, value) {
    this._db[table][key] = value;
};
DbWrapper.prototype.get = function (table, key) {
    return this._db[table][key];
};
DbWrapper.prototype.add = function (table, value) {
    var key = DbWrapper.getFileIdentificator(this._db[table]);
    this._db[table][key] = value;
    return key;
};
DbWrapper.getFileIdentificator = function (table) {
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

exports.DbWrapper =  DbWrapper;