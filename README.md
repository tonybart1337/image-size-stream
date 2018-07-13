# image-dimensions-stream

A [Node](https://nodejs.org/en/) module to get dimensions of any image file stream

## Supported formats

* BMP
* GIF
* JPEG
* PNG
* PSD
* DDS

### Upcoming

* SWF
* CUR
* ICO
* ICNS
* TIFF
* WebP
* SVG

## Programmatic Usage

```
yarn add image-dimensions-stream
```

### Example

```javascript
const ImageDimensionsStream = require('image-dimensions-stream');
const pipeline = util.promisify(require('stream').pipeline);

async function main() {
  const sizeStream = new ImageDimensionsStream();
  let result = {
    mime: null,
    dimensions: null,
  };

  sizeStream.on('mime', (mime) => {
    console.log('mime:', mime);
    result.mime = mime;
  });

  sizeStream.on('dimensions', (dimensions) => {
    console.log('dimensions:', dimensions);
    result.dimensions = dimensions;
  });

  await pipeline(fs.createReadStream('images/funny-cats.png'), sizeStream, fs.createWriteStream('/dev/null'));

  return result;
}

main().then(console.log).catch(console.error);
```

## Options

Key | Type | Default | Description
--- | --- | --- | ---
`requireMime` | `function` | `return true;` | Whether to destroy the stream if mime can't be found
`requireDimensions` | `function` | `return true;` | Whether to destroy the stream if dimensions can't be found
`maxMimeChunkOffset` | `number` | Minimum value possible | Whether to destroy the stream if we couldn't detect mime type after reading this amount of bytes
`maxMimeBufferSize` | `number` in bytes | 4100 | Maximum buffer size when detecting mime type
`maxDimensionsBufferSize` | `number` in bytes | 1000 | Maximum buffer size when detecting dimensions

## Credits

[image-size](https://github.com/image-size/image-size) for test images and file structures
