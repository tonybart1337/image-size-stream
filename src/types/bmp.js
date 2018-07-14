const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x42, 0x4D]));
const dimensionsRange = [18, 22];

module.exports = class BmpType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/bmp';
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    if (firstByteOffset <= dimensionsRange[0] && lastByteOffset >= dimensionsRange[1] + 4) {
      return this.createDimensions(
        buf.readInt32LE(dimensionsRange[0] - firstByteOffset),
        Math.abs(buf.readInt32LE(dimensionsRange[1] - firstByteOffset)),
        );
    }

    return this.range(dimensionsRange[0], dimensionsRange[1] + 4);
  }
};
