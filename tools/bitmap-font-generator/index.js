
const Fs = require('fs-extra');
const Path = require('path');
const Walk = require('walk');

const parseFontMetrics = require('./parse-font-metrics').parse;
const remergeSpritesAsync = require('./../sprite-atlas-plist-generator/split-and-merge-sprites').remergeAsync;
const writeBitmapFont = require('./bitmap-font-writer').write;

const rootDir = __dirname;
const outDir = Path.join(__dirname, '..', '..', 'assets');
// const outDir = Path.join(__dirname, 'out');

async function handleFile(fontDataPath) {
    const relativePath = Path.relative(rootDir, fontDataPath);
    const relativeDir = Path.dirname(relativePath);
    const baseName = Path.basename(fontDataPath, '.json');
    const outDirName = Path.join(outDir, relativeDir);

    const fntDataPath = Path.join(outDirName, `${baseName}.fnt`);
    const fntImagePath = Path.join(outDirName, `${baseName}.png`);
    const originImagePath = Path.join(Path.dirname(fontDataPath), `${baseName}.png`);

    await Fs.ensureDir(outDirName);

    const fontData = await Fs.readJson(fontDataPath);
    const plistData = await parseFontMetrics(originImagePath, fontData.lineHeight);

    await remergeSpritesAsync(plistData, originImagePath, fntImagePath);

    const content = writeBitmapFont(fontData, plistData);
    await Fs.writeFile(fntDataPath, content, { encoding: 'utf-8' });
}

(async () => {
    // await Fs.emptyDir(outDir);
    const walker = Walk.walk(Path.join(__dirname, 'media'));
    const fontDataFiles = [];
    walker.on('file', (root, stat, next) => {
        const extName = Path.extname(stat.name);
        if (extName == '.json') {
            fontDataFiles.push(Path.join(root, stat.name));
        }
        next();
    });
    walker.on('end', async () => {
        await Promise.all(fontDataFiles.map(path => handleFile(path)));
    });
    walker.on('error', (err) => console.error(err));
})();