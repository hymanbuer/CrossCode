
const Fs = require('fs-extra');
const Path = require('path');

const parseAtlasData = require('./src/parse-sprite-atlas-data').parse;
const writePlistData = require('./src/sprites-plist-writer').write;

async function handleFile(atlasDataPath, outDir) {
    const atlasData = await Fs.readJson(atlasDataPath);
    const plistData = parseAtlasData(atlasData);
    const xml = writePlistData(plistData);

    const relativeDir = Path.dirname(atlasData.path);
    const baseName = Path.basename(atlasData.path, '.png');
    const dirName = Path.join(outDir, relativeDir);
    await Fs.ensureDir(dirName);
    await Fs.writeFile(Path.join(dirName, `${baseName}.plist`), xml, { encoding: 'utf-8' });
}

(async () => {
    const outDir = Path.join(__dirname, '..', '..', 'assets');
    // await Fs.emptyDir(outDir);
    await handleFile(Path.join(__dirname, 'data', 'buttons.json'), outDir);
    await handleFile(Path.join(__dirname, 'data', 'lea.json'), outDir);
    await handleFile(Path.join(__dirname, 'data', 'loading.json'), outDir);
})();