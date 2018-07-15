const fs = require('fs');
const path = require('path');
const util = require('util');

const ImageSizeStream = require('../src');

const pipeline = util.promisify(require('stream').pipeline);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const supportedTypes = new Set(ImageSizeStream.Types.map(t => t.mime.split('/')[1]));
const chunkSize = parseInt(process.env.CHUNK_SIZE || 10, 10);

// needed to close stream when we got everything we need
// as there is no way (as of node 10.6.0) that I'm aware of
// to close the stream before hand w/o raising an error
class IgnorePrematureCloseError extends Error {}

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

async function testFile(f, { mime, dimensions, options = {} }) {
  const sizeStream = new ImageSizeStream(options);
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
      return;
    }

    sizeStream.destroy(new IgnorePrematureCloseError());
  });

  try {
    await pipeline(fs.createReadStream(f, { highWaterMark: chunkSize }), sizeStream, fs.createWriteStream('/dev/null'));
  } catch (err) {
    if (err instanceof IgnorePrematureCloseError) return;

    throw err;
  }
}

async function main() {
  const imagesPath = path.join(process.cwd(), 'test', 'types');
  await iterateFilesRecursive(imagesPath, testFile);
}

main().catch(console.error);
