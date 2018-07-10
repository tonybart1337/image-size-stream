const fs = require('fs');
const path = require('path');
const util = require('util');

const ImageSizeStream = require('../src');

const pipeline = util.promisify(require('stream').pipeline);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

async function iterateFilesRecursive(dirpath, onFile) {
  const curFiles = await readdir(dirpath);

  for (const f of curFiles) {
    if (f.endsWith('json')) continue;
    const curPath = path.join(dirpath, f);
    const curStats = await stat(curPath);

    if (curStats.isDirectory()) {
      await iterateFilesRecursive(curPath, onFile);
      return;
    }

    console.log(`Testing file ${curPath}...`);
    const assertData = JSON.parse(await readFile(`${curPath}.json`));
    await Promise.resolve(onFile(curPath, assertData));
    console.log(`File ${curPath} has been processed`);
  }
}

async function testFile(f, { mime, dimensions }) {
  const sizeStream = new ImageSizeStream();
  let curMime = null;
  let curDims = null;

  sizeStream.on('mime', (type) => {
    console.log(`File ${f} is ${type}`);
    curMime = type;
    
    if (type !== mime) {
      sizeStream.destroy(new Error(`Mime type ${type} doesn't match ${mime}`));
    }
  });

  sizeStream.on('dimensions', (dims) => {
    console.log(`File ${f} is ${curMime} ${dims.width}x${dims.height}`);
    curDims = dims;

    if (dims.width !== dimensions.width || dims.height !== dimensions.height) {
      sizeStream.destroy(new Error(`Dimensions ${dims} doesn't match ${dimensions}`));
    }
  });

  await pipeline(fs.createReadStream(f, { highWaterMark: 10 }), sizeStream, fs.createWriteStream('/dev/null'));
}

async function main() {
  const imagesPath = path.join(process.cwd(), 'test', 'types');
  await iterateFilesRecursive(imagesPath, testFile);
}

main().catch(console.error);
