const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x38, 0x42, 0x50, 0x53]));
const dimensionsRange = [14, 18];

module.exports = class GifType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/psd';
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    if (firstByteOffset <= dimensionsRange[0] && lastByteOffset >= dimensionsRange[1]) {
      return this.createDimensions(
        buf.readUInt32BE(dimensionsRange[1] - firstByteOffset),
        buf.readUInt32BE(dimensionsRange[0] - firstByteOffset),
        );
    }

    return this.range(dimensionsRange[0], dimensionsRange[1] + 4);
  }
};
