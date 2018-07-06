const fs = require('fs');
const path = require('path');
const util = require('util');

const ImageSizeStream = require('../src');

const pipeline = util.promisify(require('stream').pipeline);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

async function iterateFilesRecursive(dirpath, onFile) {
  const curFiles = await readdir(dirpath);

  for (const f of curFiles) {
    const curPath = path.join(dirpath, f);
    const curStats = await stat(curPath);
  
    if (curStats.isDirectory()) {
      await iterateFilesRecursive(curPath, onFile);
      return;
    }

    console.log(`Testing file ${curPath}...`);
    await Promise.resolve(onFile(curPath));
    console.log(`File ${curPath} has been processed`);
  }
}

async function testFile(f) {
  const sizeStream = new ImageSizeStream();
  let mimeType = null;

  sizeStream.on('mime', (type) => {
    mimeType = type;
    console.log(`File ${f} is ${type}`);
  });

  sizeStream.on('dimensions', (dims) => console.log(`File ${f} is ${mimeType} ${dims.width}x${dims.height}`));

  await pipeline(fs.createReadStream(f), sizeStream);
}

async function main() {
  const imagesPath = path.join(process.cwd(), 'test', 'types');
  await iterateFilesRecursive(imagesPath, testFile);
}

main().catch(console.error);
