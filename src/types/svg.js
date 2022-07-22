const BaseType = require('../BaseType');

module.exports = class SvgType extends BaseType {
  static get bytesToGetMime() {
    return 200
  }
  
  static _fromBuffer(buffer) {
    const str = buffer.toString()
    if (/^(<\?xml\s.*<svg|<svg)/i.test(str.replace(/[\n\r]/g, ' '))){
      return {}
    }
    return null;    
  }
  
  static get mime() {
    return 'image/svg+xml';
  }

  _findDimensions(buf) {
    const reRes = /viewBox="(\d+)\s(\d+)\s(\d+)\s(\d+)"/g.exec(buf.toString())
    
    if (!reRes && buf.length < 500) {
      return this.needMore(500);
    }

    if (!reRes) {
      return this.createDimensions(0,0)
    }
    const x1 = Number(reRes[1])
    const y1 = Number(reRes[2])
    const x2 = Number(reRes[3])
    const y2 = Number(reRes[4])

    return this.createDimensions(x2-x1, y2-y1)
  }

  constructor(...args) {
    super(...args);
    
    this._meta = {};
  } 
};
