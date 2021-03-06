
const Fs = require('fs-extra');
const Path = require('path');
const XmlBuilder = require('xmlbuilder');
const Zlib = require('zlib');
const Base64Js = require('base64-js');
const Jimp = require('jimp');
const Walk = require('walk');

const Utils = require('./../utils');

const rootDir = __dirname;
// const rootOutDir = Path.join(__dirname, '..', '..', 'assets');
const rootOutDir = Path.join(__dirname, 'out');

///////////////

const TERRAIN = {
	NORMAL: 1,
	METAL: 2,
	CARDBOARD: 3,
	EARTH: 4,
	GRASS: 5,
	WATER: 6,
	WOOD: 7,
	STONE: 8,
	METALSOLID: 9,
	SNOW: 10,
	ICE: 11,
	NOTHING: 12,
	QUICKSAND: 13,
	SHALLOW_WATER: 14,
	SAND: 15,
	COAL: 16,
	HOLE: 17,
	LASER: 18,
	METAL_HOLLOW: 19,
	SPIDERWEB: 20,
	HIGHWAY: 21,
};
const ID_TO_TERRAIN = {};
Object.keys(TERRAIN).forEach(name => ID_TO_TERRAIN[TERRAIN[name]] = name);

const TILE_PREFIX = '$tile$';
const MAX_SHEET_SIZE = 1024;

///////////////

const Layout = require('layout');
const binPack = require('bin-pack');

function placeTileItemsInPlace(items, maxWidth) {
    maxWidth = maxWidth || MAX_SHEET_SIZE;

    let currentLineHeight = 0;
    let nextX = 0;
    let nextY = 0;
    let maxX = 0;
    items.forEach(item => {
        if (nextX + item.width > maxWidth) {
            nextX = 0;
            nextY += currentLineHeight;
            currentLineHeight = 0;
        }

        item.x = nextX;
        item.y = nextY;

        nextX += item.width;
        if (item.height > currentLineHeight) {
            currentLineHeight = item.height;
        }

        if (nextX > maxX) {
            maxX = nextX;
        }
    });

    return {
        maxX: maxX,
        maxY: nextY + currentLineHeight,
    };
}

Layout.addAlgorithm('pack-tileset', {
    sort(items) {
        return items;
    },

    placeItems(items) {
        const tileItems = [];
        const propItems = [];
        items.forEach(item => {
            const targetItems = item.meta.img._filepath.indexOf(TILE_PREFIX) >= 0 ? tileItems : propItems;
            targetItems.push(item);
        });
        
        let maxWidth = MAX_SHEET_SIZE;
        let propSheetSize = null;
        if (propItems.length) {
            propSheetSize = binPack(propItems, { inPlace: true });
            maxWidth = Math.min(maxWidth, propSheetSize.width);
        }

        const { maxX, maxY } = placeTileItemsInPlace(tileItems, maxWidth);
        if (propItems.length && maxY + propSheetSize.height > MAX_SHEET_SIZE) {
            placeTileItemsInPlace(tileItems, MAX_SHEET_SIZE);
        }

        propItems.forEach(item => item.y += maxY);

        return items;
    }
});

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

async function parseMapFile(filePath, tmxMapMap, tilesetMap) {
    const mapData = await Fs.readJson(filePath);

    const tmxMap = tmxMapMap[mapData.name] = {
        path: filePath,
        name: mapData.name,
        width: mapData.mapWidth,
        height: mapData.mapHeight,
        layers: [],
    };

    const nameCached = {};
    mapData.layer.forEach(layer => {
        const tileset = getOrCreateTileset(tilesetMap, layer.tilesetName, layer.tilesize);
        addAllTileIdsInLayer(tileset, layer.width, layer.height, layer.data);

        // protect from same name
        if (layer.name == 'Coll' || nameCached[layer.name]) {
            layer.name = layer.name + layer.id;
        }
        nameCached[layer.name] = true;

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

    const outPath = Utils.getOutPath(rootDir, filePath, rootOutDir);
    await Fs.outputJson(outPath, mapData, { encoding: 'utf-8' });
}

async function proccessTileset(tileset) {
    const idSet = tileset.idSet;
    const animationMap = {};
    tileset.animations.forEach(animation => {
        animation.forEach(frame => idSet.add(frame));
        animationMap[animation[0]] = animation;
    });

    let oldIds = [];
    for (let id of idSet.values()) {
        oldIds.push(id);
    }
    oldIds = oldIds.sort();

    const oldIdToNewIdMap = {};
    const tileInfos = [];
    tileset.oldIdToNewIdMap = oldIdToNewIdMap;
    tileset.tileInfos = tileInfos;
    tileset.tilecount = oldIds.length;

    const terrains = tileset.terrains;
    const tilesize = tileset.tilesize;
    const oldImagePath = Path.join(rootDir, tileset.fullName);
    const oldImageSize = await readImageSize(oldImagePath);
    const oldColumns = Math.floor(oldImageSize.width / tilesize);
    const tileFrames = [];
    oldIds.forEach((oldId, index) => {
        const newId = index + 1;
        oldIdToNewIdMap[oldId] = newId;

        const frame = {};
        frame.name = `${TILE_PREFIX}_${oldId}_${Utils.fixedInteger(newId, 4)}.png`;
        frame.x = Math.round(((oldId-1) % oldColumns)) * tilesize;
        frame.y = Math.round(Math.floor((oldId-1) / oldColumns)) * tilesize;
        frame.w = frame.h = tilesize;
        tileFrames.push(frame);

        tileInfos.push({
            oldId: oldId,
            terrain: Number(terrains[oldId - 1] || 0),
            animation: animationMap[oldId],
        });
    });

    const propSheet = tileset.propSheet;
    const outDir = Utils.getOutDir(rootDir, oldImagePath, rootOutDir);
    const baseName = Path.basename(tileset.fullName, '.png');
    const newImagePath = Path.join(outDir, `${baseName}.png`);
    const plistData = { frames: tileFrames.concat(propSheet.frames) };
    await Utils.remergeAsync(plistData, oldImagePath, newImagePath, 'pack-tileset');

    propSheet.textureFileName = `${baseName}.png`;
    tileset.name = baseName;
    tileset.imageWidth = propSheet.textureWidth = plistData.textureWidth;
    tileset.imageHeight = propSheet.textureHeight = plistData.textureHeight;
    tileset.sourceName = Path.basename(tileset.fullName);
    tileset.columns = Math.floor(plistData.textureWidth / (tilesize + 1));

    const outTsxPath = Path.join(outDir, `${baseName}.tsx`);
    await outputTsxFile(tileset, outTsxPath);

    if (propSheet.frames.length > 0) {
        const outPlistPath = Path.join(outDir, `${baseName}.plist`);
        await Utils.writeAtlasPlistFile(propSheet, outPlistPath);
    }
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

    const oldIdToNewIdMap = tileset.oldIdToNewIdMap;
    tileset.tileInfos.forEach(tileInfo => {
        if (!tileInfo.terrain && !tileInfo.animation) {
            return;
        }

        // tileset's id count from 0
        const tileXml = xml.ele('tile').att('id', `${oldIdToNewIdMap[tileInfo.oldId] - 1}`);

        if (tileInfo.terrain) {
            tileXml.ele('properties')
                .ele('property')
                    .att('name', 'Terrain')
                    .att('value', `${ID_TO_TERRAIN[tileInfo.terrain]}`)
                .up()
            .up();
        };

        if (tileInfo.animation) {
            const frames = tileInfo.animation.map(oldId => oldIdToNewIdMap[oldId] - 1);
            const animationXml = tileXml.ele('animation');
            frames.forEach(frame => animationXml.ele('frame')
                .att('tileid', `${frame}`)
                .att('duration', `200`)
                .up());
            animationXml.up();
        }
        
        tileXml.up();
    });

    const content = xml.end({ pretty: true });
    await Fs.outputFile(outTsxPath, content, { encoding: 'utf-8' });
}

async function proccessTmxMap(tmxMap, tilesetMap) {
    const xml = XmlBuilder.create('map', { encoding: 'utf-8' })
        .att('version', '1.0')
        .att('orientation', 'orthogonal')
        .att('renderorder', 'right-down')
        .att('width', `${tmxMap.width}`)
        .att('height', `${tmxMap.height}`)
        .att('tilewidth', '16')
        .att('tileheight', '16');

    const layers = tmxMap.layers;
    const firstGidMap = {};
    let nextFirstGid = 1;
    layers.forEach(layer => {
        const tilesetName = layer.tilesetName;
        if (!firstGidMap[tilesetName]) {
            firstGidMap[tilesetName] = nextFirstGid;
            nextFirstGid += tilesetMap[tilesetName].tilecount;
        }
    });

    const tmxMapDir = Path.dirname(tmxMap.path);
    for (let tilesetName in firstGidMap) {
        const tilesetDir = Path.dirname(Path.join(rootDir, tilesetName));
        const relative = Path.relative(tmxMapDir, tilesetDir);
        const baseName = Path.basename(tilesetName, '.png');
        const source = Path.join(relative, `${baseName}.tsx`).replace(/\\/g, '/');
        xml.ele('tileset')
            .att('firstgid', `${firstGidMap[tilesetName]}`)
            .att('source', source)
        .up();
    }

    await Promise.all(layers.map(layer => {
        const tilesetName = layer.tilesetName;
        return appendLayer(xml, layer, firstGidMap[tilesetName], tilesetMap[tilesetName].oldIdToNewIdMap);
    }));
    
    const content = xml.end({ pretty: true });
    const outTmxPath = Utils.getOutPathWithDiffExt(rootDir, tmxMap.path, rootOutDir, '.json', '.tmx');
    await Fs.outputFile(outTmxPath, content, { encoding: 'utf-8' });
}

async function appendLayer(xml, layer, firstGid, oldIdToNewIdMap) {
    const width = layer.width;
    const height = layer.height;
    const data = layer.data;
    const byteLength = width * height * 4;
    const buffer = new ArrayBuffer(byteLength);
    const uint32Array = new Uint32Array(buffer);
    for (let col = 0; col < width; col++) {
        for (let row = 0; row < height; row++) {
            const index = col + row * width;
            const oldLocalId = data[row][col];
            if (oldLocalId == 0) {
                uint32Array[index] = 0;
            } else {
                const newLocalId = oldIdToNewIdMap[oldLocalId];
                uint32Array[index] = firstGid + newLocalId - 1;
            }
        }
    }

    const base64Content = await zlibCompressAndEncodeByBase64(buffer);

    xml.ele('layer')
        .att('id', `${layer.id}`)
        .att('name', `${layer.name}`)
        .att('width', `${width}`)
        .att('height', `${height}`)

        .ele('data')
            .att('encoding', 'base64')
            .att('compression', 'zlib')
            .text(base64Content)
        .up()
    .up();
}

async function parsePropsFile(filePath, propSheetMap) {
    const propsData = await Fs.readJson(filePath);
    const props = propsData.props;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        await checkParsePropAnims(prop, propSheetMap);
        await checkParsePropFix(prop, propSheetMap);
    }
}

async function checkParsePropAnims(prop, propSheetMap) {
    // prop.anims.namedSheets ??
    if (!prop || !prop.anims || !prop.anims.sheet) {
        return false;
    }

    const propName = prop.name;
    const anims = prop.anims;
    const sheet = anims.sheet;
    const propSheet = await Utils.getOrCreateInMapAsync(propSheetMap, sheet.src, createPropSheet);
    const propFrames = propSheet.frames;

    if (propFrames.find(frame => frame.propName == propName)) {
        throw new Error('There is same prop name in save sheet.');
    }

    let maxFrameIndex = 0;
    anims.SUB.forEach(subAnim => maxFrameIndex = Math.max(maxFrameIndex, Math.max(...subAnim.frames)));
    
    const frameCount = maxFrameIndex + 1;
    const w = sheet.width;
    const h = sheet.height;
    const offX = sheet.offX;
    const offY = sheet.offY;
    const xCount = sheet.xCount;
    const sheetWidth = xCount ? xCount * w : propSheet.width - offX;
    for (let i = 0; i < frameCount; i++) {
        propFrames.push({
            propName,
            name: `${propName}_${Utils.fixedInteger(i, 2)}.png`,
            x: offX + (Math.floor(i * w) % sheetWidth),
            y: offY + Math.floor((i * w) / sheetWidth) * h,
            w, h,
        });
    }
}

async function checkParsePropFix(prop, propSheetMap) {
    if (!prop || !prop.fix || prop.fix.flipX || prop.fix.flipY) {
        return false;
    }

    const propName = prop.name;
    const fix = prop.fix;
    const propSheet = await Utils.getOrCreateInMapAsync(propSheetMap, fix.gfx, createPropSheet);
    const propFrames = propSheet.frames;

    if (propFrames.find(frame => frame.propName == propName)) {
        throw new Error('There is same prop name in save sheet.');
    }

    const propFrame = {
        propName,
        name: `${propName}.png`,
        x: fix.x,
        y: fix.y,
        w: fix.w,
        h: fix.h,
    };
    checkFixPropFrameSize(propFrame, propSheet.width, propSheet.height)
    propFrames.push(propFrame);
}

async function createPropSheet(sheetName) {
    const imageSize = await readImageSize(Path.join(rootDir, sheetName));
    return {
        width: imageSize.width,
        height: imageSize.height,
        frames: [],
    };
}

function checkFixPropFrameSize(item, imageWidth, imageHeight) {
    if (item.x + item.w > imageWidth) {
        item.w = Math.max(0, imageWidth - item.x);
    }
    if (item.y + item.h > imageHeight) {
        item.h = Math.max(0, imageHeight - item.y);
    }
}

(async () => {
    await Fs.emptyDir(rootOutDir);

    const [mapFiles, propsFiles] = await Promise.all([
        Utils.getAllFilesInDirWithExt(Path.join(rootDir, 'data', 'maps'), '.json'),
        Utils.getAllFilesInDirWithExt(Path.join(rootDir, 'data', 'props'), '.json'),
    ]);

    const tmxMapMap = {};
    const tilesetMap = {};
    const propSheetMap = {};
    await Promise.all([
        Promise.all(mapFiles.map(file => parseMapFile(file, tmxMapMap, tilesetMap))),
        Promise.all(propsFiles.map(file => parsePropsFile(file, propSheetMap))),
    ]);
    
    const tileInfosMap = await Fs.readJson(Path.join(rootDir, 'data', 'tile-infos.json'));
    const terrainMap = await Fs.readJson(Path.join(rootDir, 'data', 'terrain.json'));
    await Promise.all(Object.keys(tilesetMap).map(key => {
        const tileset = tilesetMap[key];
        const tileInfos = tileInfosMap[key];
        const propSheet = propSheetMap[key];
        tileset.animations = tileInfos && tileInfos.animations || [];
        tileset.terrains = terrainMap[key] || [];
        tileset.propSheet = propSheet || { frames: [] };
        return proccessTileset(tileset);
    }));

    await Promise.all(Object.keys(tmxMapMap).map(key => proccessTmxMap(tmxMapMap[key], tilesetMap)));
})();