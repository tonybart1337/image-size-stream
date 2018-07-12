const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0xFF, 0xD8, 0xFF]));

const types = [
  Buffer.from(new Uint8Array([0xFF, 0xC0])),
  Buffer.from(new Uint8Array([0xFF, 0xC1])),
  Buffer.from(new Uint8Array([0xFF, 0xC2])),
];

const requiredBufDimsSize = 9; // 7 offset + 2 bytes to align Int16

module.exports = class JpgType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }

  static get mime() {
    return 'image/jpeg';
  }

  _findDimensions(buf, firstByteOffset, lastByteOffset) {
    if (!buf.includes(0xFF)) {
      return this.discard();
    }

    // in case buffer has only one byte
    // we keep current 0xFF and ask for next byte
    if (buf.length === 1) {
      return this.keep();
    }

    let SOFmarkerIdx = null;
    types.some(markerBuf => {
      const idx = buf.indexOf(markerBuf);
      if (idx === -1) return false;

      SOFmarkerIdx = idx;
      return true;
    });

    if (SOFmarkerIdx != null) {
      // make sure buffer is big enough to read dimensions
      const bufSize = SOFmarkerIdx + requiredBufDimsSize;

      if (buf.length < bufSize) {
        return this.range(firstByteOffset + SOFmarkerIdx, firstByteOffset + bufSize);
      }

      return this.createDimensions(
        buf.readUInt16BE(SOFmarkerIdx + 7),
        buf.readUInt16BE(SOFmarkerIdx + 5),
      );
    }

    // in case buffer ends with 0xFF we should keep it
    // to check next marker
    if (buf[buf.length - 1] === 0xFF) {
      return this.keep(buf.slice(buf.length - 1));
    }

    return this.discard();
  }
};
