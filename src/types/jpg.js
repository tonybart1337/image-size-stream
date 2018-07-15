const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0xFF, 0xD8, 0xFF]));

const types = [
  0xC0,
  0xC1,
  0xC2,
];

const requiredBufDimsSize = 9; // 7 offset + 2 bytes to align Int16
const bytesToGetBlockLen = 3;

module.exports = class JpgType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }
  
  static get mime() {
    return 'image/jpeg';
  }

  constructor(...args) {
    super(...args);
  }

  _findDimensions(buf, firstByteOffset) {
    const markerStartIdx = buf.indexOf(0xFF);
    if (markerStartIdx === -1) return this.discard();

    if (buf.length === 1 || markerStartIdx === buf.length - 1) {
      return this.keep(buf.slice(buf.length - 1));
    }

    const currentMarker = buf[markerStartIdx + 1];

    // skip reserved values
    if (currentMarker === 0xFF) {
      return this.skipTo(firstByteOffset + markerStartIdx + 1);
    }

    // skip entropy-coded data and other empty block markers
    if (currentMarker === 0x00 || (currentMarker >= 0xD0 && currentMarker <= 0xD9)) {
      return this.skipTo(firstByteOffset + markerStartIdx + 2);
    }

    // check that buffer is big enough to read block length
    if (buf.length - 1 < markerStartIdx + bytesToGetBlockLen) {
      return this.range(firstByteOffset + markerStartIdx, firstByteOffset + markerStartIdx + bytesToGetBlockLen);
    }

    const blockLength = buf.readUInt16BE(markerStartIdx + 2);

    if (types.some(markerBuf => {
      return currentMarker === markerBuf;
    })) {
      // make sure buffer is big enough to read dimensions
      const bufSize = markerStartIdx + requiredBufDimsSize;

      if (buf.length < bufSize) {
        return this.range(firstByteOffset + markerStartIdx, firstByteOffset + bufSize);
      }

      return this.createDimensions(
          buf.readUInt16BE(markerStartIdx + 7),
          buf.readUInt16BE(markerStartIdx + 5),
      );
    }

    // skip current marker block
    const blockLengthIdx = firstByteOffset + markerStartIdx + blockLength + 2;
    return this.skipTo(blockLengthIdx);
  }
};
