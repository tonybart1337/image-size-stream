const { Transform } = require('stream');

const Errors = require('./errors');
const types = require('./types');

class ImageSizeStream extends Transform {
  static get Errors() {
    return Errors;
  }

  constructor(...args) {
    super(...args);
    
    this._sizeState = {
      buffer: [],
      type: null,
      get mime() {
        return this.type ? this.type.mime : null,
      },
      dimensions: null,
      peekBytes: 0,
      readBytes: 0,
    };
  }
  
  _transform(chunk, enc, cb) {
    try {
      this.push(chunk);
      const state = this._sizeState;

      if (state.mime && state.dimensions) {
        cb();
        return;
      }

      state.buffer.push(chunk);
      state.readBytes += chunk.length;

      if(!state.mime) {
        this._detectType();

        if (!state.mime) {
          cb();
          return;
        }
      }
  
      if (state.readBytes >= state.peekBytes) {
        this._peek(cb);
        return;
      }

      cb();
    } catch (err) {
      cb(err);
    }
  }

  _concatBuffer() {
    const state = this._sizeState;
    state.buffer = [Buffer.concat(state.buffer)];
  }

  _detectType() {
    this._concatBuffer();
    const state = this._sizeState;
    const [buf] = state.buffer;

    const curTypr = types.find(t => t.detect(buf));
    if (!curTypr) return;

    state.type = curTypr;
    this.emit('mime', state.mime);
  }

  _peek(cb) {
    this._concatBuffer();
    const state = this._sizeState;
    const val = state.type.calculate(state.buffer[0]);

    if (typeof val === 'object') {
      state.dimensions = val;
      this.emit('dimensions', state.dimensions);
    } else if (typeof val === 'number') {
      state.peekBytes = this.readBytes + val;
    }

    cb();
  }

  _flush(cb) {
    try {
      const state = this._sizeState;

      if (state) {
        let err = null;
        
        if (!state.mime) {
          err = new Errors.MimeTypeNotFoundError();
        } else if (!state.dimensions) {
          err = new Errors.DimensionsNotFoundError();
        }

        this._cleanUp();

        if (err) {
          cb(err);
          return;
        }
      }

      cb();
    } catch (err) {
      this._cleanUp();
      cb(err);
    }
  }

  _destroy(err, cb) {
    try {
      this._cleanUp();
    } catch (cErr) {
      cb(cErr);
      return;
    }

    super._destroy(err, cb);
  }

  _cleanUp () {
    this._sizeState = null;
  }
}

module.exports = ImageSizeStream;
