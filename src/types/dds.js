const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0x44, 0x44, 0x53, 0x20]));
const dimensionsRange = [12, 16];

module.exports = class DdsType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/dds';
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    if (firstByteOffset <= dimensionsRange[0] && lastByteOffset >= dimensionsRange[1] + 4) {
      this.finish();

      return this.createDimensions(
        buf.readUInt32LE(dimensionsRange[1] - firstByteOffset),
        buf.readUInt32LE(dimensionsRange[0] - firstByteOffset),
        );
    }

    return this.range(dimensionsRange[0], dimensionsRange[1] + 4);
  }
};
