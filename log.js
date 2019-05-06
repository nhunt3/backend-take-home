const fs = require('fs');
const os = require('os');

class log {
    constructor() {
        this.logText = null;
    }

    write(str) {
        if (this.logText === null) {
            this.logText = str;
        }
        else {
            fs.appendFile('log.txt', this.logText + os.EOL + str + os.EOL, function (err) {
                if (err) throw err;
            });
            this.logText = null;
        }
    }
};

module.exports = log;