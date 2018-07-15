class ExtendedError extends Error {
  constructor(opts = {}) {
    const curOpts = { message: '' };
    let message = null;

    if (typeof opts === 'string') {
      message = opts;
    } else {
      Object.assign(curOpts, opts);
      ({ message } = curOpts);
    }

    super(message);

    delete curOpts.message;

    // Assign additional fields
    Object.assign(this, curOpts);

    this.name = this.constructor.name;

    this.message = message || this.defaultMessage;
    this.message = this.formatMessage();

    // Capturing stack trace, excluding constructor call from it.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  get defaultMessage() {
    return '';
  }

  formatMessage() {
    return this.message;
  }
}

class MimeTypeNotFoundError extends ExtendedError {
  get defaultMessage() {
    return 'Couldn\'t determine mime type';
  }
}

class DimensionsNotFoundError extends ExtendedError {
  get defaultMessage() {
    let msg = 'Couldn\'t determine dimensions';
    
    if (this.bufferSize >= this.maxBufferSize) {
      msg = `${msg}. Buffer ${this.bufferSize} bytes exceeded max size of ${this.maxBufferSize} bytes`;
    } else if (this.requestedSize >= this.maxBufferSize) {
      msg = `${msg}. Requested buffer size ${this.requestedSize} bytes exceeded max size of ${this.maxBufferSize} bytes`;
    }

    return msg;
  }
}

class RequestNegativeBytesError extends ExtendedError {
  constructor(bytes, ...args) {
    super({ bytes }, ...args);
  }

  get defaultMessage() {
    return `Got request for ${this.bytes} bytes. You can't request for negative amount of bytes`;
  }
}

class RequestRangeBytesError extends ExtendedError {
  get defaultMessage() {
    let msg = `Got request for range (${this.start}, ${this.end}) bytes`;

    if (this.start === this.current) {
      msg = `${msg}.
      "start" offset equals current (${this.start} == ${this.current}) and "end" offset equals buffer size.
      You requested the same offsets that you received on the previous step.
      This will cause an infinite loop that has been prevented for you`;
    } else if (this.start < this.current) {
      msg = `${msg}.
      Start less than current (${this.start} < ${this.current}).
      You can't request for the bytes that have been already drained`;
    } else if (this.start > this.end) {
      msg = `${msg}.
      Start bigger than end`;
    }

    return msg;
  }
}

class InvalidEXIFError extends ExtendedError {}

module.exports = {
  MimeTypeNotFoundError,
  DimensionsNotFoundError,
  RequestNegativeBytesError,
  RequestRangeBytesError,
  InvalidEXIFError,
};
