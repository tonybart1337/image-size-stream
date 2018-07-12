const fs = require('fs');
const path = require('path');
const util = require('util');

const ImageSizeStream = require('../src');

const pipeline = util.promisify(require('stream').pipeline);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const supportedTypes = new Set(ImageSizeStream.Types.map(t => t.mime.split('/')[1]));

async function iterateFilesRecursive(dirpath, onFile) {
  const curFiles = await readdir(dirpath);

  for (const f of curFiles) {
    const curPath = path.join(dirpath, f);
    const curStats = await stat(curPath);

    if (curStats.isDirectory()) {
      await iterateFilesRecursive(curPath, onFile);
      continue;
    }

    if (!supportedTypes.has(path.extname(f).substring(1))) continue;

    let assertData = null;

    try {
      assertData = JSON.parse(await readFile(`${curPath}.json`));
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`File ${curPath} has been skipped because no data file (${curPath}.json) was found`);
        continue;
      }

      throw err;
    }

    console.log(`Testing file ${curPath}...`);
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
      sizeStream.destroy(new Error(`Dimensions ${dims.width}x${dims.height} doesn't match ${dimensions.width}x${dimensions.height}`));
    }
  });

  await pipeline(fs.createReadStream(f, { highWaterMark: 10 }), sizeStream, fs.createWriteStream('/dev/null'));
}

async function main() {
  const imagesPath = path.join(process.cwd(), 'test', 'types');
  await iterateFilesRecursive(imagesPath, testFile);
}

main().catch(console.error);
