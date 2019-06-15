const BaseType = require('../BaseType');
const { InvalidEXIFError } = require('../errors');

const magicNumber = Buffer.from(new Uint8Array([0xFF, 0xD8, 0xFF]));
const exifMagicNumber = Buffer.from(new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]));

const types = [
  0xC0,
  0xC1,
  0xC2,
];

const requiredBufDimsSize = 9; // 7 offset + 2 bytes to align Int16
const bytesToGetBlockLen = 3;

function readUInt(buf, offset, byteLength, isBigEndian = true) {
  return isBigEndian ? buf.readUIntBE(offset, byteLength) : buf.readUIntLE(offset, byteLength);
}

// http://www.exif.org/Exif2-2.PDF
function getOrientationFromEXIF(buffer, offset, isBigEndian) {
  let curOffset = offset;
  
  // every tag is 12 bytes long
  const tagsCount = readUInt(buffer, curOffset, 2, isBigEndian);
  if (tagsCount * 12 > buffer.length) return null;

  curOffset += 2;
  
  let orientationVal = null;

  for (let i = 0; i < tagsCount; ++i) {
    const tagId = readUInt(buffer, curOffset, 2, isBigEndian);
    curOffset += 2;

    // Orientation tag
    if (tagId === 0x112) {
      // Orientation tag (page 22 from PDF above)
      // type = 3 SHORT (UInt16)
      // count = 1
      orientationVal = readUInt(buffer, curOffset + 6, 2, isBigEndian);
      break;
    }

    curOffset += 10;
  }
  
  return orientationVal;
}

function applyOrientation(orient, dims) {
  return orient >= 5
      ? { width: dims.height, height: dims.width }
      : dims;
}

// todo (optimization): make this streamy
function processExif(buf, firstByteOffset) {
  const { exif } = this._meta;

  try {
    if (exif.localOffset === 0) {
      const isValid = exifMagicNumber.equals(buf.slice(0, exifMagicNumber.length));
      if (!isValid) return exif.fail('Invalid EXIF header');
    
      exif.localOffset += exifMagicNumber.length;
    }
  
    if (exif.localOffset === 0x6) {
      const endiannes = buf.readUInt16BE(exif.localOffset);
    
      if (endiannes === 0x4D4D) {
        exif.isBigEndian = true;
      } else if (endiannes === 0x4949) {
        exif.isBigEndian = false;
      } else {
        return exif.fail('Couldn\'t determine endiannes');
      }
    
      exif.localOffset += 0x2;
    }
  
    if (exif.localOffset === 0x8) {
      const tiffHeader = buf.readUInt16BE(exif.localOffset);
      const realTiffHeader = exif.isBigEndian ? 0x002A : 0x2A00;
    
      if (realTiffHeader !== tiffHeader) {
        return exif.fail('Invalid TIFF header');
      }
    
      exif.localOffset += 0x2;
    }
  
    if (exif.localOffset === 0xA) {
      const ifdOffset = readUInt(buf, exif.localOffset, 4, exif.isBigEndian) + 0x6;
      if (ifdOffset < 8) {
        return exif.fail('Invalid ifdOffset offset');
      }

      exif.ifd0Offset = firstByteOffset + exif.localOffset + ifdOffset;
      exif.localOffset = ifdOffset;
    }

    if (exif.ifd0Offset != null) {
      const orientation = getOrientationFromEXIF(buf, exif.localOffset, exif.isBigEndian);
      if (orientation >= 1 && orientation <= 8) {
        exif.orientation = orientation;

        if (this.dimensions) {
          const dims = applyOrientation(orientation, this.dimensions);
          this.finish();

          return this.createDimensions(dims.width, dims.height, { orientation });
        }
      }
    }

    return exif.finish();
  } catch (err) {
    return exif.fail(err);
  }
}

module.exports = class JpgType extends BaseType {
  static get magicNumber() {
    return magicNumber;
  }
  
  static get mime() {
    return 'image/jpeg';
  }

  constructor(...args) {
    super(...args);
    
    this._meta = {};
  }
  
  _findDimensions(buf, firstByteOffset) {
    let valToFind = 0xFF;

    if (this._meta.exif && !this._meta.exif.finished) {
      return processExif.call(this, buf, firstByteOffset);
    }

    const markerStartIdx = buf.indexOf(valToFind);
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

    if (this.exif && currentMarker === 0xE1) {
      this._meta.exif = {
        offset: firstByteOffset + markerStartIdx + 4,
        localOffset: 0,
        length: blockLength,
        isBigEndian: null,
        ifd0Offset: null,
        finished: false,
        finish: () => {
          this._meta.exif.finished = true;
          return this.skipTo(firstByteOffset + blockLength + 2);
        },
        fail: (msg) => {
          const curErr = new InvalidEXIFError(msg);
          const shouldThrow = this.requireValidExif(curErr, this.mime);

          if (shouldThrow) {
            throw curErr;
          }

          if (this.dimensions) {
            this.finish();
          }
  
          return this._meta.exif.finish();
        },
      };

      return this.range(this._meta.exif.offset, this._meta.exif.offset + blockLength);
    }

    const hasSOFMarker = types.some(markerBuf => currentMarker === markerBuf);

    if (hasSOFMarker) {
      // make sure buffer is big enough to read dimensions
      const bufSize = markerStartIdx + requiredBufDimsSize;

      if (buf.length < bufSize) {
        return this.range(firstByteOffset + markerStartIdx, firstByteOffset + bufSize);
      }

      let dims = {
        width: buf.readUInt16BE(markerStartIdx + 7),
        height: buf.readUInt16BE(markerStartIdx + 5),
      };
      
      const meta = {};

      if (!this.exif || (this._meta.exif && this._meta.exif.finished)) {
        if (this._meta.exif) {
          meta.orientation = this._meta.exif.orientation;
          dims = applyOrientation(this._meta.exif.orientation, dims);
        }

        this.finish();
      }

      return this.createDimensions(dims.width, dims.height, meta);
    }

    // skip current marker block
    const blockLengthIdx = firstByteOffset + markerStartIdx + blockLength + 2;
    return this.skipTo(blockLengthIdx);
  }
};
