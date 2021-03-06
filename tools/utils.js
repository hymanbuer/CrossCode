
const Path = require('path');
const Walk = require('walk');
const Fs = require('fs-extra');

const Jimp = require('jimp');
const Spritesmith = require('spritesmith');
const Sharp = require('sharp');

const Plist = require('plist');

exports.getAllFilesInDirWithExt = async function (dir, targetExtName) {
    return new Promise((resolve, reject) => {
        const files = [];
        const walker = Walk.walk(dir);
        walker.on('file', (root, stat, next) => {
            const extName = Path.extname(stat.name);
            if (extName == targetExtName) {
                files.push(Path.join(root, stat.name));
            }
            next();
        });
        walker.on('end', async () => {
            resolve(files);
        });
        walker.on('error', reject);
    });
}

exports.getOutDir = function (rootInDir, inPath, rootOutDir) {
    const relativePath = Path.relative(rootInDir, inPath);
    const relativeDir = Path.dirname(relativePath);
    return Path.join(rootOutDir, relativeDir);
}

exports.getOutPath = function (rootInDir, inPath, rootOutDir) {
    const outDir = exports.getOutDir(rootInDir, inPath, rootOutDir)
    return Path.join(outDir, Path.basename(inPath));
}

exports.getOutPathWithDiffExt = function (rootInDir, inPath, rootOutDir, inExt, outExt) {
    const outDir = exports.getOutDir(rootInDir, inPath, rootOutDir)
    const baseName = Path.basename(inPath, inExt);
    return Path.join(outDir, `${baseName}${outExt}`);
}

exports.fixedInteger = function (value, length) {
    const str = `${value}`;
    return str.length >= length ? str : '0'.repeat(length - str.length) + str;
}

exports.getOrCreateInMapAsync = async function (map, key, defaultValueOrCreateFunc) {
    let value = map[key];
    if (value == null) {
        if (typeof defaultValueOrCreateFunc === 'function') {
            value = map[key] = await defaultValueOrCreateFunc(key);
        } else {
            value = map[key] = defaultValueOrCreateFunc;
        }
    }

    return value;
};

/////////////////////

async function mergeFrames(framePaths, plistData, outAtlasImagePath, algorithm) {
    return new Promise((resolve, reject) => {
        Spritesmith.run({ src: framePaths, padding: 1, exportOpts: {quality: 100}, algorithm }, async (err, result) => {
            if (err) {
                reject(err);
            } else {
                plistData.textureWidth = result.properties.width;
                plistData.textureHeight = result.properties.height;

                const coordinates = result.coordinates;
                const newCoordinates = {};
                for (let key in coordinates) {
                    const name = Path.basename(key);
                    newCoordinates[name] = coordinates[key];
                }

                plistData.frames.forEach(frame => {
                    const newCoordinate = newCoordinates[frame.name];
                    frame.x = newCoordinate.x + 1;
                    frame.y = newCoordinate.y + 1;
                    frame.w = newCoordinate.width;
                    frame.h = newCoordinate.height;
                });

                await Fs.ensureDir(Path.dirname(outAtlasImagePath));

                plistData.textureWidth += 2;
                plistData.textureHeight += 2;
                
                Sharp(result.image)
                    .extend({
                        top: 1,
                        bottom: 1,
                        left: 1,
                        right: 1,
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .toFile(outAtlasImagePath)
                    .then(resolve)
                    .catch(reject);
            }
        });
    });
}

exports.remergeAsync = async function (plistData, inAtlasImagePath, outAtlasImagePath, layoutAlgorithm) {
    const frames = plistData.frames;
    const inAtlasImage = await Jimp.read(inAtlasImagePath);
    const tempDir = await Fs.mkdtemp(`temp_${Path.basename(outAtlasImagePath, '.png')}_`);
    const framePaths = frames.map(frame => Path.join(tempDir, frame.name));
    const promises = frames.map((frame, index) => {
        return inAtlasImage.clone()
            .crop(frame.x, frame.y, frame.w, frame.h)
            .quality(100)
            .writeAsync(framePaths[index]);
    });
    await Promise.all(promises);

    await mergeFrames(framePaths, plistData, outAtlasImagePath, layoutAlgorithm);

    await Fs.remove(tempDir);
}

///////////////////

exports.writeAtlasPlistFile = async function (plistData, plistDataPath) {
    const textureFileName = plistData.textureFileName;
    const textureSize = `{${plistData.textureWidth},${plistData.textureHeight}}`;
    const result = {
        frames: {},
        metadata: {
            format: 3,
            pixelFormat: 'RGBA8888',
            premultiplyAlpha: false,
            realTextureFileName: textureFileName,
            size: textureSize,
            smartupdate: '$TexturePacker:SmartUpdate:9c768fe6828cb6c075550d20fcd572e4:4d9c4c023ac2e79911a281ae6c21e22a:e75714c0871c497b76d71a94e9da90fb$',
            textureFileName: textureFileName
        }
    };

    const frames = result.frames;
    const sprites = plistData.frames;
    sprites.forEach(s => {
        const offset = `{${s.x},${s.y}}`;
        const size = `{${s.w},${s.h}}`;
        frames[s.name] = {
            spriteOffset: '{0,0}',
            spriteSize: size,
            spriteSourceSize: size,
            textureRect: `{${offset},${size}}`,
            textureRotated: false
        };
    });

    const xml = Plist.build(result);
    return Fs.writeFile(plistDataPath, xml, { encoding: 'utf-8' });
}

/////////////////