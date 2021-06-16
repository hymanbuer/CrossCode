
const Fs = require('fs-extra');
const Path = require('path');
const Walk = require('walk');

const parseAtlasData = require('./parse-sprite-atlas-data').parse;
const Utils = require('../utils');

const rootDir = __dirname;
const outDir = Path.join(__dirname, '..', '..', 'assets');
// const outDir = Path.join(__dirname, 'out');

async function handleFile(atlasDataPath) {
    const relativePath = Path.relative(rootDir, atlasDataPath);
    const relativeDir = Path.dirname(relativePath);
    const baseName = Path.basename(atlasDataPath, '.json');
    const outDirName = Path.join(outDir, relativeDir);

    const plistImagePath = Path.join(outDirName, `${baseName}.png`);
    const plistDataPath = Path.join(outDirName, `${baseName}.plist`);
    const atlasImagePath = Path.join(Path.dirname(atlasDataPath), `${baseName}.png`);

    await Fs.ensureDir(outDirName);
    
    const plistData = await parseAtlasData(atlasDataPath);
    await Utils.remergeAsync(plistData, atlasImagePath, plistImagePath);

    await Utils.writeAtlasPlistFile(plistData, plistDataPath);
}

(async () => {
    // await Fs.emptyDir(outDir);
    const walker = Walk.walk(Path.join(__dirname, 'media'));
    const atlasDataFiles = [];
    walker.on('file', (root, stat, next) => {
        const extName = Path.extname(stat.name);
        if (extName == '.json') {
            atlasDataFiles.push(Path.join(root, stat.name));
        }
        next();
    });
    walker.on('end', async () => {
        await Promise.all(atlasDataFiles.map(path => handleFile(path)));
    });
    walker.on('error', (err) => console.error(err));
})();