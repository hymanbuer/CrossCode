
const Fs = require('fs-extra');
const Path = require('path');
const Jimp = require('jimp');
const Spritesmith = require('spritesmith');

async function mergeFrames(framePaths, plistData, outAtlasImagePath) {
    return new Promise((resolve, reject) => {
        Spritesmith.run({ src: framePaths, padding: 2, exportOpts: {quality: 100} }, async (err, result) => {
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
                    frame.x = newCoordinate.x;
                    frame.y = newCoordinate.y;
                    frame.w = newCoordinate.width;
                    frame.h = newCoordinate.height;
                });

                await Fs.outputFile(outAtlasImagePath, result.image);

                resolve()
            }
        });
    });
}

async function remergeAsync(plistData, inAtlasImagePath, outAtlasImagePath) {
    const frames = plistData.frames;
    const inAtlasImage = await Jimp.read(inAtlasImagePath);
    const tempDir = await Fs.mkdtemp('frames_');
    const framePaths = frames.map(frame => Path.join(tempDir, frame.name));
    const promises = frames.map((frame, index) => {
        return inAtlasImage.clone()
            .crop(frame.x, frame.y, frame.w, frame.h)
            .quality(100)
            .writeAsync(framePaths[index]);
    });
    await Promise.all(promises);

    await mergeFrames(framePaths, plistData, outAtlasImagePath);

    await Fs.remove(tempDir);
}

exports.remergeAsync = remergeAsync;