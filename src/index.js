const { Transform } = require('stream');

const Errors = require('./errors');
const types = require('./types');

let maxMimeChunkOffset = 0;

types.forEach(t => {
  maxMimeChunkOffset = Math.max(t.bytesToGetMime, maxMimeChunkOffset);
});

const defaultOpts = {
  requireMime: () => true,
  requireDimensions: () => true,
  maxMimeChunkOffset,
  maxMimeBufferSize: 4100,
  maxDimensionsBufferSize: 1000,
};

class ImageSizeStream extends Transform {
  static get Errors() {
    return Errors;
  }

  static get Types() {
    return types;
  }

  constructor(opts = {}, ...args) {
    super(...args);

    this._sizeState = {
      options: Object.assign({}, defaultOpts, opts),
      buffer: [],
      type: null,
      get mime() {
        return this.type ? this.type.mime : null;
      },
      get dimensions() {
        return this.type ? this.type.dimensions : null;
      },
      bufferSize: 0,
      peekBytes: 0,
      peekRangeBytes: null,
      readBytes: 0,
    };
  }
  
  _transform(chunk, enc, cb) {
    try {
      this.push(chunk);
      const state = this._sizeState;
      if (!state) {
        cb();
        return;
      }

      if (state.mime && state.dimensions) {
        cb();
        return;
      }

      state.readBytes += chunk.length;

      if (state.peekRangeBytes) {
        const [start] = state.peekRangeBytes;
        if (state.readBytes < start) {
          cb();
          return;
        }
      }

      state.buffer.push(chunk);
      state.bufferSize += chunk.length;
  
      if (state.peekRangeBytes) {
        const [, end] = state.peekRangeBytes;
        if (state.readBytes < end) {
          cb();
          return;
        }
      }

      if (!state.mime) {
        this._detectType();

        if (!state.mime) {
          cb();
          return;
        }
      }

      if (state.bufferSize >= state.peekBytes) {
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
    const state = this._sizeState;
    if (!state) return;

    this._concatBuffer();

    let curType = null;
    this.constructor.Types.some(t => {
      curType = t.fromBuffer(state.buffer[0], state.readBytes - state.bufferSize, state.readBytes + 1);
      return curType;
    });
    if (!curType) {
      if (state.options.maxMimeChunkOffset <= state.readBytes || state.options.maxMimeBufferSize <= state.bufferSize) {
        throw new Errors.MimeTypeNotFoundError();
      }

      return;
    }

    state.type = curType;
    this.emit('mime', state.mime);
  }

  _peek(cb) {
    const state = this._sizeState;
    if (!state) {
      cb();
      return;
    }

    this._concatBuffer();
    const { type, value } = state.type.findDimensions(state.buffer[0], state.readBytes - state.bufferSize, state.readBytes + 1);

    state.peekBytes = 0;
    state.peekRangeBytes = null;

    if (type === 'dimensions') {
      this.emit('dimensions', value);
    } else if (type === 'discard') { // discard buffer and request next chunk
      state.buffer = [];
      state.bufferSize = 0;
      state.peekBytes = 0;
    } else if (type === 'keep') { // keep output buffer and request next chunk
      if (value) {
        state.buffer = [value];
        state.bufferSize = value.length;
      }

      state.peekBytes = 0;
    } else if (type === 'range') { // request exact range
      const { start, end } = value;
      const current = state.readBytes - state.bufferSize;

      if (start < current || start > end) {
        throw new Errors.RequestRangeBytesError({ start, end, current });
      }

      // we don't need current buffer
      // if we haven't reached the starting point yet
      if (state.readBytes < start) {
        state.buffer = [];
        state.bufferSize = 0;
      }

      state.peekBytes = end - start;
      state.peekRangeBytes = [start, end];
    } else if (type === 'add') { // ask for more bytes
      if (value < 0) {
        throw new Errors.RequestNegativeBytesError(value);
      }

      state.peekBytes = state.bufferSize + value;
    }
    
    if (!state.dimensions && state.options.maxDimensionsBufferSize <= state.bufferSize) {
      throw new Errors.DimensionsNotFoundError();
    }

    cb();
  }

  _flush(cb) {
    try {
      const state = this._sizeState;

      if (state) {
        let err = null;
        
        if (state.options.requireMime({
          mime: state.mime,
          readBytes: state.readBytes,
        }) && !state.mime) {
          err = new Errors.MimeTypeNotFoundError();
        } else if (state.options.requireDimensions({
          dimensions: state.dimensions,
          mime: state.mime,
          readBytes: state.readBytes,
        }) && !state.dimensions) {
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
    if (this._sizeState.type) {
      this._sizeState.type.destroy();
    }

    this._sizeState = null;
  }
}

module.exports = ImageSizeStream;
