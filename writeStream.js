const {Writable} = require('stream');

class writeStream extends Writable {
    constructor() {
        super();
    }

    _write(chunk, encoding, callback) {
        
    }
}