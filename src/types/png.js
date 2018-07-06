const magicBytes = Buffer.from(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
const pngImageHeaderChunkName = 'IHDR';

function detect(buf) {
  return magicBytes.equals(buf.slice(0, magicBytes.length));
}

function calculate(buf) {

}

module.exports = {
  mime: 'image/png',
  detect,
  calculate,
};
