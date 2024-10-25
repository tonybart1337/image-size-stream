module.exports = class BaseType {
  constructor(meta) {
    this._dimensions = null;
    this._finished = false;
    this._meta = meta;
  }

  static get magicNumber() {
    return Buffer.from('');
  }

  static get mime() {
    return '';
  }

  static get bytesToGetMime() {
    return this.magicNumber.length;
  }

  static _fromBuffer(buffer) {
    return this.magicNumber.equals(buffer.slice(0, this.magicNumber.length));
  }

  static fromBuffer(buffer, firstByteOffset, lastByteOffset) {
    if (buffer.length < this.bytesToGetMime) return null;

    const meta = this._fromBuffer(buffer, firstByteOffset, lastByteOffset);
    if (!meta) return null;

    return new this(meta);
  }

  get magicNumber() {
    return this.constructor.magicNumber;
  }

  get mime() {
    return this.constructor.mime;
  }

  get dimensions() {
    return this._dimensions;
  }

  get finished() {
    return this._finished;
  }

  _finish() {}

  finish() {
    this._finish();
    this._finished = true;
  }

  discard() {
    return { type: 'discard', value: null };
  }

  add(val) {
    return { type: 'add', value: val };
  }

  needMore(val) {
    return this.add(val);
  }

  range(start, end) {
    return { type: 'range', value: { start, end } };
  }

  skipTo(start) {
    return { type: 'range', value: { start } };
  }

  keep(val) {
    return { type: 'keep', value: val };
  }

  createDimensions(width, height, meta = {}) {
    return { type: 'dimensions', value: { width, height }, meta };
  }

  _findDimensions() {}

  findDimensions(buffer, firstByteOffset, lastByteOffset) {
    const val = this._findDimensions(buffer, firstByteOffset, lastByteOffset);
    if (val.type === 'dimensions') {
      this._dimensions = val.value;
    }

    return val;
  }

  _destroy() {}

  destroy() {
    this._destroy();
    this._meta = null;
  }
};
