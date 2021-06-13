
const Fs = require('fs-extra');
const Path = require('path');
const XmlBuilder = require('xmlbuilder');
const Zlib = require('zlib');
const Base64Js = require('base64-js');
const Jimp = require('jimp');
const Walk = require('walk');

const Utils = require('./../utils');
const remergeSpritesAsync = require('./../sprite-atlas-plist-generator/split-and-merge-sprites').remergeAsync;

const rootDir = __dirname;
const rootOutDir = Path.join(__dirname, 'out');

///////////////

const Layout = require('layout');
const BinPack = require('bin-pack');
// pack(items, {inPlace: true});
Layout.addAlgorithm('pack-tileset', {
    sort(items) {
        return items;
    },

    placeItems(items) {
        const maxWidth = 1024;
        let currentLineHeight = 0;
        let nextX = 0;
        let nextY = 0;
        items.forEach(item => {
            if (nextX + item.width > maxWidth) {
                nextX = 0;
                nextY = nextY + currentLineHeight;
                currentLineHeight = 0;
            }

            item.x = nextX;
            item.y = nextY;

            nextX += item.width;
            if (item.height > currentLineHeight) {
                currentLineHeight = item.height;
            }
        });

        return items;
    }
});

///////////////

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

async function readImageSize(imagePath) {
    const image = await Jimp.read(imagePath);
    
    return {
        width: image.getWidth(),
        height: image.getHeight()
    };
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

async function readTilesetInfo(relativeTilesetPath, tilesize) {
    const tilesetPath = Path.join(rootDir, relativeTilesetPath);
    const imageSize = await readImageSize(tilesetPath);
    const columns = Math.floor(imageSize.width / tilesize);

    return {
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        tilesetName: Path.basename(relativeTilesetPath, '.png'),
        sourceName: Path.basename(relativeTilesetPath),
        columns: columns,
        tilecount: columns * Math.floor(imageSize.height / tilesize),
    };
}

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
    const {
        imageWidth, imageHeight,
        tilesetName, sourceName,
        columns, tilecount,
    } = await readTilesetInfo(relativeTilesetPath, tilesize);

    tmxMap.ele('tileset')
        .att('firstgid', `${firstGid}`)
        .att('name', tilesetName)
        .att('tilewidth', `${tilesize}`)
        .att('tileheight', `${tilesize}`)
        .att('tilecount', `${tilecount}`)
        .att('columns', `${columns}`)

        .ele('image')
            .att('source', sourceName)
            .att('width', `${imageWidth}`)
            .att('height', `${imageHeight}`)
        .up()
    .up();

    return firstGid + tilecount;
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

async function appendExternalTileset(tmxMap, firstGid, tilesetName) {
    tmxMap.ele('tileset')
        .att('firstgid', `${firstGid}`)
        .att('source', `${tilesetName}.tsx`)
    .up();
}

async function createTsxTileset(relativeTilesetPath, tilesize) {
    const {
        imageWidth, imageHeight,
        tilesetName, sourceName,
        columns, tilecount,
    } = await readTilesetInfo(relativeTilesetPath, tilesize);

    const tileset = XmlBuilder.create('tileset', { encoding: 'utf-8' });
    tileset.att('name', tilesetName)
        .att('tilewidth', `${tilesize}`)
        .att('tileheight', `${tilesize}`)
        .att('spacing', '0')
        .att('margin', '0')
        .att('tilecount', `${tilecount}`)
        .att('columns', `${columns}`);

    tileset.ele('image')
        .att('source', sourceName)
        .att('width', `${imageWidth}`)
        .att('height', `${imageHeight}`)
        .up();

    return tileset;
}

async function writeXmlFile(xml, outFilePath) {
    const content = xml.end({ pretty: true });
    await Fs.writeFile(outFilePath, content, { encoding: 'utf-8' });
}

async function handleFile() {
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
}

//////////////////

function getOrCreateTileset(tilesetMap, fullName, tilesize) {
    let tileset = tilesetMap[fullName];
    if (tileset == null) {
        tileset = tilesetMap[fullName] = {
            fullName,
            name: Path.basename(fullName, '.png'),
            tilesize,
            idSet: new Set(),
        };
    }

    return tileset;
}

function addAllTileIdsInLayer(tileset, layerWidth, layerHeight, layerData) {
    const idSet = tileset.idSet;
    for (let col = 0; col < layerWidth; col++) {
        for (let row = 0; row < layerHeight; row++) {
            const id = layerData[row][col];
            if (id != 0) {
                idSet.add(id);
            }
        }
    }
}

async function parseMapFile(file, tmxMapMap, tilesetMap) {
    const mapData = await Fs.readJson(file);

    const tmxMap = tmxMapMap[mapData.name] = {
        name: mapData.name,
        width: mapData.mapWidth,
        height: mapData.mapHeight,
        layers: [],
    };

    mapData.layer.forEach(layer => {
        const tileset = getOrCreateTileset(tilesetMap, layer.tilesetName, layer.tilesize);
        addAllTileIdsInLayer(tileset, layer.width, layer.height, layer.data);

        tmxMap.layers.push({
            id: layer.id,
            name: layer.name,
            width: layer.width,
            height: layer.height,
            data: layer.data,
            tilesetName: layer.tilesetName,
        });

        delete layer['tilesetName'];
        delete layer['data'];
    });

    const outPath = Utils.getOutPath(rootDir, file, rootOutDir);
    await Fs.outputJson(outPath, mapData, { encoding: 'utf-8' });
}

async function proccessTileset(tileset) {
    let oldIds = [];
    for (let id of tileset.idSet.values()) {
        oldIds.push(id);
    }
    oldIds = oldIds.sort();

    const oldIdToNewIdMap = {};
    tileset.oldIdToNewIdMap = oldIdToNewIdMap;
    tileset.tilecount = oldIds.length;

    const tilesize = tileset.tilesize;
    const oldImagePath = Path.join(rootDir, tileset.fullName);
    const oldImageSize = await readImageSize(oldImagePath);
    const oldColumns = Math.floor(oldImageSize.width / tilesize);
    const frames = [];
    oldIds.forEach((oldId, index) => {
        const newId = index + 1;
        oldIdToNewIdMap[oldId] = newId;

        const frame = {};
        frame.name = `tile_${newId}.png`;
        frame.x = (oldId % oldColumns) * tilesize;
        frame.y = Math.floor(oldId / oldColumns) * tilesize;
        frame.w = frame.h = tilesize;
        frames.push(frame);
    });

    const outDir = Utils.getOutDir(rootDir, oldImagePath, rootOutDir);
    const baseName = Path.basename(tileset.fullName, '.png');
    const newImagePath = Path.join(outDir, `${baseName}.png`);
    const plistData = { frames };
    await remergeSpritesAsync(plistData, oldImagePath, newImagePath, 'pack-tileset');

    tileset.name = baseName;
    tileset.imageWidth = plistData.textureWidth;
    tileset.imageHeight = plistData.textureHeight;
    tileset.sourceName = Path.basename(tileset.fullName);
    tileset.columns = Math.floor(plistData.textureWidth / (tilesize + 1));

    const outTsxPath = Path.join(outDir, `${baseName}.tsx`);
    await outputTsxFile(tileset, outTsxPath);
}

async function outputTsxFile(tileset, outTsxPath) {
    const xml = XmlBuilder.create('tileset', { encoding: 'utf-8' });
    xml.att('name', tileset.name)
        .att('tilewidth', `${tileset.tilesize}`)
        .att('tileheight', `${tileset.tilesize}`)
        .att('spacing', '1')
        .att('margin', '1')
        .att('tilecount', `${tileset.tilecount}`)
        .att('columns', `${tileset.columns}`);

        xml.ele('image')
        .att('source', tileset.sourceName)
        .att('width', `${tileset.imageWidth}`)
        .att('height', `${tileset.imageHeight}`)
        .up();

    const content = xml.end({ pretty: true });
    await Fs.outputFile(outTsxPath, content, { encoding: 'utf-8' });
}

async function proccessTmxMap(tmxMap, tilesetMap) {

}

(async () => {
    await Fs.emptyDir(rootOutDir);

    const mapsDir = Path.join(__dirname, 'data', 'maps');
    const mapFiles = await Utils.getAllFilesInDirWithExt(mapsDir, '.json');

    const tmxMapMap = {};
    const tilesetMap = {};

    await Promise.all(mapFiles.map(file => parseMapFile(file, tmxMapMap, tilesetMap)));
    
    await Promise.all(Object.keys(tilesetMap).map(key => proccessTileset(tilesetMap[key])));

    await Promise.all(Object.keys(tmxMapMap).map(key => proccessTmxMap(tmxMapMap[key], tilesetMap)));
})();