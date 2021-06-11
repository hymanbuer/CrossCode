
const Fs = require('fs-extra');
const Path = require('path');
const XmlBuilder = require('xmlbuilder');
const Zlib = require('zlib');
const Base64Js = require('base64-js');
const Jimp = require('jimp');

const rootDir = __dirname;

async function readImageSize(imagePath) {
    const image = await Jimp.read(imagePath);
    
    return {
        width: image.getWidth(),
        height: image.getHeight()
    };
}

function buildTmxContent() {
    const map = XmlBuilder.create('map', { encoding: 'utf-8' });
    map.att('version', '1.4')
        .att('orientation', 'orthogonal')
        .att('renderorder', 'right-down')
        .att('width', '40')
        .att('height', '40')
        .att('tilewidth', '16')
        .att('tileheight', '16');

    map.ele('tileset')
        .att('firstgid', '1')
        .att('name', 'outdoor')
        .att('tilewidth', '16')
        .att('tileheight', '16')
        .att('tilecount', '288')
        .att('columns', '24')

        .ele('image')
            .att('source', 'buch-outdoor.png')
            .att('width', '384')
            .att('height', '192')
        .up()
    .up();

    map.ele('tileset')
        .att('firstgid', '1')
        .att('source', 'desert.tsx')
    .up();

    map.ele('layer')
        .att('id', '1')
        .att('name', 'Ground')
        .att('width', '40')
        .att('height', '40')

        .ele('data')
            .att('encoding', 'base64')
            .att('compression', 'zlib')
            .text('eJztmNkKwjAQRaN9cAPrAq5Yq3Xf6v9/nSM2VIbQJjEZR+nDwQ')
        .up()
    .up();

    return map.end({ pretty: true });
}

function buildTsxContent() {
    const tileset = XmlBuilder.create('tileset', { encoding: 'utf-8' });
    tileset.att('name', 'Desert')
        .att('tilewidth', '32')
        .att('tileheight', '32')
        .att('spacing', '1')
        .att('margin', '1')
        .att('tilecount', '48')
        .att('columns', '8');

    tileset.ele('image')
        .att('source', 'tmw_desert_spacing.png')
        .att('width', '265')
        .att('height', '199')
        .up();

    return tileset.end({ pretty: true });
}

//////////////

function createTmxMap(mapWidth, mapHeight) {
    return XmlBuilder.create('map', { encoding: 'utf-8' })
        .att('version', '1.4')
        .att('orientation', 'orthogonal')
        .att('renderorder', 'right-down')
        .att('width', `${mapWidth}`)
        .att('height', `${mapHeight}`)
        .att('tilewidth', '16')
        .att('tileheight', '16');
}

async function appendEmbededTileset(tmxMap, firstGid, relativeTilesetPath, tilesize) {
    const tilesetPath = Path.join(rootDir, relativeTilesetPath);
    const imageSize = await readImageSize(tilesetPath);
    const tilesetName = Path.basename(relativeTilesetPath, '.png');
    const sourceName = Path.basename(relativeTilesetPath);
    const columns = Math.floor(imageSize.width / tilesize);
    const tilecount = columns * Math.floor(imageSize.height / tilesize);

    tmxMap.ele('tileset')
        .att('firstgid', `${firstGid}`)
        .att('name', tilesetName)
        .att('tilewidth', `${tilesize}`)
        .att('tileheight', `${tilesize}`)
        .att('tilecount', `${tilecount}`)
        .att('columns', `${columns}`)

        .ele('image')
            .att('source', sourceName)
            .att('width', `${imageSize.width}`)
            .att('height', `${imageSize.height}`)
        .up()
    .up();

    return firstGid + tilecount;
}

async function zlibCompressAndEncodeByBase64(buffer) {
    return new Promise((resolve, reject) => {
        Zlib.deflate(buffer, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(Base64Js.fromByteArray(new Uint8Array(result)));
            }
        });
    });
}

async function appendLayer(tmxMap, id, name, width, height, data, firstGid) {
    const byteLength = width * height * 4;
    const buffer = new ArrayBuffer(byteLength);
    const uint32Array = new Uint32Array(buffer);
    for (let col = 0; col < width; col++) {
        for (let row = 0; row < height; row++) {
            const index = col + row * width;
            const gid = data[row][col] != 0 ? firstGid + data[row][col] - 1 : 0;
            uint32Array[index] = gid;
        }
    }

    const base64Content = await zlibCompressAndEncodeByBase64(buffer);

    tmxMap.ele('layer')
        .att('id', `${id}`)
        .att('name', `${name}`)
        .att('width', `${width}`)
        .att('height', `${height}`)

        .ele('data')
            .att('encoding', 'base64')
            .att('compression', 'zlib')
            .text(base64Content)
        .up()
    .up();
}

async function writeXmlFile(xml, outFilePath) {
    const content = xml.end({ pretty: true });
    await Fs.writeFile(outFilePath, content, { encoding: 'utf-8' });
}

(async () => {
    const testPath = Path.join(__dirname, 'data/maps/hideout/inner-test.json');

    let nextFirstGid = 1;
    const addedTilesetMap = {};
    const mapData = await Fs.readJson(testPath);
    const layers = mapData.layer;
    const tmxMap = createTmxMap(mapData.mapWidth, mapData.mapHeight);

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!addedTilesetMap[layer.tilesetName]) {
            addedTilesetMap[layer.tilesetName] = nextFirstGid;
            nextFirstGid = await appendEmbededTileset(tmxMap, nextFirstGid, layer.tilesetName, layer.tilesize);
        }
    }

    await Promise.all(layers.map(async layer => {
        const firstGid = addedTilesetMap[layer.tilesetName];
        await appendLayer(tmxMap, layer.id, layer.name, layer.width, layer.height, layer.data, firstGid);
    }));

    await writeXmlFile(tmxMap, Path.join(__dirname, 'inner-test.tmx'));
})();