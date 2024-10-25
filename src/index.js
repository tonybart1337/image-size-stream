const { Transform } = require('stream');

const Errors = require('./errors');
const types = require('./types');

let maxMimeChunkOffset = 0;

types.forEach(t => {
  maxMimeChunkOffset = Math.max(t.bytesToGetMime, maxMimeChunkOffset);
});

const defaultOpts = {
  requireMime: true,
  requireDimensions: true,
  exif: false,
  requireValidExif: false,
  maxMimeChunkOffset,
  maxMimeBufferSize: 4100,
  maxDimensionsBufferSize: 64000,
};

function toFn(val) {
  return typeof val === 'function' ? val : () => val;
}

function mergeOpts(opts) {
  const curOpts = Object.assign({}, defaultOpts, opts);

  [
    'requireMime',
    'requireDimensions',
    'exif',
    'requireValidExif',
  ].forEach(k => {
    curOpts[k] = toFn(curOpts[k]);
  });

  return curOpts;
}

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
      options: mergeOpts(opts),
      buffer: [],
      type: null,
      get mime() {
        return this.type ? this.type.mime : null;
      },
      get dimensions() {
        return this.type ? this.type.dimensions : null;
      },
      bufferSize: 0,
      peekBytes: 0, // min buffer size required to exec peek
      peekRangeBytes: null, // array of offsets [start, end] in the file to exec peek on
      readBytes: 0, // bytes read so far
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

      if (state.mime && state.type.finished) {
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
        if (state.readBytes <= end) {
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
    if (state.buffer.length <= 1) return;

    state.buffer = [Buffer.concat(state.buffer)];
  }

  _detectType() {
    const state = this._sizeState;
    if (!state) return;

    this._concatBuffer();

    let curType = null;

    this.constructor.Types.some(t => {
      curType = t.fromBuffer(state.buffer[0], state.readBytes - state.bufferSize, state.readBytes - 1);

      return curType;
    });

    if (!curType) {
      if (state.options.maxMimeChunkOffset <= state.readBytes || state.options.maxMimeBufferSize <= state.bufferSize) {
        if (state.options.requireMime({
          mime: state.mime,
          readBytes: state.readBytes,
        })) {
          throw new Errors.MimeTypeNotFoundError();
        } else {
          this._sizeState = null;
        }
      }

      return;
    }

    curType.exif = state.options.exif(state.mime, state.readBytes);
    curType.requireValidExif = state.options.requireValidExif;

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
    const prevPeekRange = state.peekRangeBytes;

    if (state.peekRangeBytes) {
      const [curBuf] = state.buffer;
      state.buffer = [curBuf.slice(
        state.bufferSize - (state.readBytes - state.peekRangeBytes[0]),
      )];

      state.bufferSize = state.buffer[0].length;
    }

    const { type, value, meta } = state.type.findDimensions(state.buffer[0], state.readBytes - state.bufferSize, state.readBytes - 1);

    state.peekBytes = 0;
    state.peekRangeBytes = null;

    if (type === 'dimensions') {
      this.emit('dimensions', value, meta);
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
      const { start, end = start + 1 } = value;
      const current = state.readBytes - state.bufferSize;

      if (start < current || start > end
          || (prevPeekRange && start === prevPeekRange[0] && end === prevPeekRange[1])
      ) {
        throw new Errors.RequestRangeBytesError({ start, end, current });
      }

      state.peekBytes = end - start;
      state.peekRangeBytes = [start, end];

      // we don't need current buffer
      // if we haven't reached the starting point yet
      if (state.readBytes < start) {
        state.buffer = [];
        state.bufferSize = 0;
      } else if (state.readBytes - 1 >= end) { // requested size is within our buffer
        this._peek(cb);
        return;
      }
    } else if (type === 'add') { // ask for more bytes
      if (value < 0) {
        throw new Errors.RequestNegativeBytesError(value);
      }

      state.peekBytes = state.bufferSize + value;
    }

    if (!state.dimensions &&
      (state.options.maxDimensionsBufferSize <= state.bufferSize) // buffer size limit reached
      || (state.options.maxDimensionsBufferSize < state.peekBytes) // requested buffer size exceeds the limit
    ) {
      if (state.options.requireDimensions({
        dimensions: state.dimensions,
        mime: state.mime,
        readBytes: state.readBytes,
      })) {
        throw new Errors.DimensionsNotFoundError({
          maxBufferSize: state.options.maxDimensionsBufferSize,
          bufferSize: state.bufferSize,
          requestedSize: state.peekBytes,
        });
      } else {
        this._sizeState = null;

        cb();
        return;
      }
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

  _cleanUp () {
    if (this._sizeState.type) {
      this._sizeState.type.destroy();
    }

    this._sizeState = null;
  }
}

module.exports = ImageSizeStream;
