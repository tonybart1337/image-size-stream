const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]));
const magicNumberRiff = magicNumber.slice(0, 4);
const magicNumberWebpVp8 = magicNumber.slice(8, 15);
magicNumber.equals = (buffer) => magicNumberRiff.equals(buffer.slice(0, 4)) && magicNumberWebpVp8.equals(buffer.slice(8));

const types = {
  // https://developers.google.com/speed/webp/docs/riff_container
  LOSSY: {
    chunkHeader: Buffer.from('VP8 '),
    validate(buffer) { return buffer.slice(20, 21) !== 0x2f; },
  },
  LOSSLESS: {
    chunkHeader: Buffer.from('VP8L'),
    validate(buffer) { return !buffer.slice(23, 26).equals(this.signature); },
    signature: Buffer.from(new Uint8Array([0x9d, 0x01, 0x2a])),
  },
  EXTENDED: {
    chunkHeader: Buffer.from('VP8X'),
    validate(buffer) {
      const extendedHeader = buffer.slice(20, 21);
      return (extendedHeader & 0xc0) === 0 && (extendedHeader & 0x01) === 0;
    },
  },
};

module.exports = class WebpType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/webp';
  }

  static get bytesToGetMime() {
    return this.magicNumber.length + 1;
  }

  static _fromBuffer(buffer) {
    const isValid = this.magicNumber.equals(buffer.slice(0, this.magicNumber.length));
    if (!isValid) return null;

    const chunkHeader = buffer.slice(12, 16);
    for (const type of Object.keys(types)) {
      if (!types[type].chunkHeader.equals(chunkHeader)) continue;
      if (!types[type].validate(buffer)) return null;
      return { type };
    }

    return null;
  }

  _findDimensions(buffer, firstByteOffset, lastByteOffset) {
    const rangeStart = 20;
    const rangeEnd = 29;

    if (firstByteOffset <= rangeStart && lastByteOffset >= rangeEnd) {
      this.finish();

      const data = buffer.slice(rangeStart - firstByteOffset, rangeEnd - firstByteOffset + 1);
      switch(this._meta.type) {
        case 'LOSSY':
          return this.createDimensions(
            data.readInt16LE(6) & 0x3fff,
            data.readInt16LE(8) & 0x3fff
          );
        case 'LOSSLESS':
          return this.createDimensions(
            1 + (((data[2] & 0x3F) << 8) | data[1]),
            1 + (((data[4] & 0xF) << 10) | (data[3] << 2) | ((data[2] & 0xC0) >> 6))
          );
        case 'EXTENDED':
          return this.createDimensions(
            1 + data.readUIntLE(4, 3),
            1 + data.readUIntLE(7, 3)
          );
        default:
          return null;
      }
    }

    return this.range(rangeStart, rangeEnd);
  }
};
