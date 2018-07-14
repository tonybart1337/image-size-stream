const BaseType = require('../BaseType');

const magicNumber = Buffer.from(new Uint8Array([0xFF, 0xD8, 0xFF]));

const types = [
  0xC0,
  0xC1,
  0xC2,
];

const requiredBufDimsSize = 9; // 7 offset + 2 bytes to align Int16

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
    let markerStartIdx = null;
    let curFirstByteOffset = firstByteOffset;
    let curBuf = buf;

    while (curBuf.length) {
      markerStartIdx = curBuf.indexOf(0xFF);
      if (markerStartIdx === -1) break;
      
      if (curBuf.length === 1 || markerStartIdx === curBuf.length - 1) {
        return this.keep(curBuf.slice(curBuf.length - 1));
      }
      
      const currentMarker = curBuf[markerStartIdx + 1];
      
      // skip reserved values
      if (currentMarker === 0xFF) {
        markerStartIdx += 1;
        curFirstByteOffset += markerStartIdx;
        
        curBuf = curBuf.slice(markerStartIdx);
        continue;
      }
      
      // skip entropy-coded data and other empty block markers
      if (currentMarker === 0x00 || (currentMarker >= 0xD0 && currentMarker <= 0xD9)) {
        markerStartIdx += 2;
        curFirstByteOffset += markerStartIdx;

        curBuf = curBuf.slice(markerStartIdx);
        continue;
      }

      let bytesToGetBlockLen = 3;

      // define restart interval marker has 4 bytes block length
      if (currentMarker === 0xDD) {
        bytesToGetBlockLen += 2;
      }

      // check that buffer is big enough to read block length
      if (curBuf.length - 1 < markerStartIdx + bytesToGetBlockLen) {
        return this.range(curFirstByteOffset + markerStartIdx, curFirstByteOffset + markerStartIdx + bytesToGetBlockLen);
      }

      let blockLength = null;
  
      if (currentMarker === 0xDD) {
        blockLength = curBuf.readUInt32BE(markerStartIdx + 2);
      } else {
        blockLength = curBuf.readUInt16BE(markerStartIdx + 2);
      }

      if (types.some(markerBuf => {
        return currentMarker === markerBuf;
      })) {
        // make sure buffer is big enough to read dimensions
        const bufSize = markerStartIdx + requiredBufDimsSize;

        if (curBuf.length < bufSize) {
          return this.range(curFirstByteOffset + markerStartIdx, curFirstByteOffset + bufSize);
        }

        return this.createDimensions(
            curBuf.readUInt16BE(markerStartIdx + 7),
            curBuf.readUInt16BE(markerStartIdx + 5),
        );
      }

      // skip current marker block

      const blockLengthIdx = markerStartIdx + blockLength + 2;
      curFirstByteOffset += blockLengthIdx;

      if (curBuf.length - 1 < blockLengthIdx) {
        return this.skipTo(curFirstByteOffset);
      }

      curBuf = curBuf.slice(blockLengthIdx);
    }

    return this.discard();
  }
};
