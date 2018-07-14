const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

const types = {
  IHDR: {
    buffer: Buffer.from('IHDR'),
    mimeRange: [12, 16],
    dimensionsRange: [16, 20],
  },
  // http://www.jongware.com/pngdefry.html
  FRIED: {
    buffer: Buffer.from('CgBI'),
    mimeRange: [28, 32],
    dimensionsRange: [32, 36],
  },
};

module.exports = class PngType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/png';
  }

  static get bytesToGetMime() {
    return this.magicNumber.length + 24;
  }

  static _fromBuffer(buf) {
    const isValid = this.magicNumber.equals(buf.slice(0, this.magicNumber.length));
    if (!isValid) return null;

    let ihdrChunk = buf.slice(...types.IHDR.mimeRange);
    let curType = types.IHDR;

    if (types.FRIED.buffer.equals(ihdrChunk)) {
      ihdrChunk = buf.slice(...types.FRIED.mimeRange);
      curType = types.FRIED;
    }

    if (!types.IHDR.buffer.equals(ihdrChunk)) return null;

    return { type: curType };
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    const curType = this._meta.type;

    if (firstByteOffset <= curType.dimensionsRange[0] && lastByteOffset >= curType.dimensionsRange[1] + 4) {
      return this.createDimensions(
          buf.readUInt32BE(curType.dimensionsRange[0] - firstByteOffset),
          buf.readUInt32BE(curType.dimensionsRange[1] - firstByteOffset),
          );
    }

    return this.range(curType.dimensionsRange[0], curType.dimensionsRange[1] + 4);
  }
};
