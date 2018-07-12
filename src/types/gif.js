const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x47, 0x49, 0x46]));
const dimensionsRange = [6, 8];

module.exports = class GifType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/gif';
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    if (firstByteOffset <= dimensionsRange[0] && lastByteOffset >= dimensionsRange[1]) {
      return this.createDimensions(
        buf.readUInt16LE(dimensionsRange[0] - firstByteOffset),
        buf.readUInt16LE(dimensionsRange[1] - firstByteOffset),
        );
    }

    return this.range(dimensionsRange[0], dimensionsRange[1] + 2);
  }
};
