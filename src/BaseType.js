module.exports = class BaseType {
  constructor(meta) {
    this._dimensions = null;
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

  discard() {
    return null;
  }

  add(val) {
    return val;
  }

  needMore(val) {
    return this.add(val);
  }

  range(start, end) {
    return [start, end];
  }

  createDimensions(width, height) {
    return { width, height };
  }

  _findDimensions() {}

  findDimensions(buffer, firstByteOffset, lastByteOffset) {
    const dims = this._findDimensions(buffer, firstByteOffset, lastByteOffset);
    if (typeof dims === 'object' && !Array.isArray(dims)) {
      this._dimensions = dims;
      return this.dimensions;
    }

    return dims;
  }

  _destroy() {}

  destroy() {
    this._destroy();
    this._meta = null;
  }
};
