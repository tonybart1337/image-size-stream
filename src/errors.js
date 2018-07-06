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

module.exports = {
  MimeTypeNotFoundError,
  DimensionsNotFoundError,
};
