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
    return 'Couldn\'t determine dimensions';
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
  constructor({ start, end, current }, ...args) {
    super({ start, end, current }, ...args);
  }
  
  get defaultMessage() {
    if (this.start < this.current) {
      return `Got request for range (${this.start}, ${this.end}) bytes. Start less than current (${this.start} < ${this.current}). You can't request for the bytes that have been already drained`;
    } else if (this.start > this.end) {
      return `Got request for range (${this.start}, ${this.end}) bytes. Start bigger than end`;
    }

    return '';
  }
}

module.exports = {
  MimeTypeNotFoundError,
  DimensionsNotFoundError,
  RequestNegativeBytesError,
  RequestRangeBytesError,
};
