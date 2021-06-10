
const Path = require('path');

function fixedWidth(value) {
    return value < 10 ? `0${value}` : `${value}`;
}

function parseNinePatch(data, prefix) {
    const result = [];
    const w = data.width + data.left + data.right;
    const h = data.height + data.top + data.bottom;
    const offsets = data.offsets;
    for (var spriteName in offsets) {
        const offset = offsets[spriteName];
        const x = offset.x;
        const y = offset.y;
        const name = `${prefix}-${spriteName}.png`;
        result.push({ name, x, y, w, h });
    }

    return result;
}

function parseTileSheet(atlasData, data, prefix) {
    const src = data.src;
    const offsetX = src.x;
    const offsetY = src.y;
    const w = src.w;
    const h = src.h;
    const xCount = data.xCount;
    const sheetWidth = xCount ? xCount * w : atlasData.width - offsetX;
    const result = [];
    for (let i = 0; i < data.frames; i++) {
        const name = `${prefix}-${fixedWidth(i)}.png`;
        const x = offsetX + (Math.floor(i * w) % sheetWidth);
        const y = offsetY + Math.floor((i * w) / sheetWidth) * h;
        result.push({ name, x, y, w, h });
    }

    return result;
}

function parseByType(atlasData, type, data, prefix, outSprites) {
    let result = null;
    if (type == 'NinePatch') {
        result = parseNinePatch(data, prefix);
    } else if (type == 'TileSheet') {
        result = parseTileSheet(atlasData, data, prefix);
    } else {
        console.error('## not support type:', type);
    }

    if (result) {
        result.forEach(s => outSprites.push(s))
    }
}

async function parse(atlasDataPath) {
    const atlasData = await Fs.readJson(atlasDataPath);
    const result = {};
    result.textureFileName = atlasData.name;
    result.textureWidth = atlasData.width;
    result.textureHeight = atlasData.height;
    
    const spriteDict = atlasData.frames;
    const sprites = [];
    result.frames = sprites;
    for (var spriteName in spriteDict) {
        const info = spriteDict[spriteName];
        if (info.type) {
            parseByType(atlasData, info.type, info, spriteName, sprites);
        } else {
            info.name = spriteName + '.png';
            sprites.push(info);
        }
    }

    return result;
}

exports.parse = parse;