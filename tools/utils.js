
const Path = require('path');
const Walk = require('walk');
const Fs = require('fs-extra');

async function getAllFilesInDirWithExt(dir, targetExtName) {
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
exports.getAllFilesInDirWithExt = getAllFilesInDirWithExt;

function getOutDir(rootInDir, inPath, rootOutDir) {
    const relativePath = Path.relative(rootInDir, inPath);
    const relativeDir = Path.dirname(relativePath);
    return Path.join(rootOutDir, relativeDir);
}
exports.getOutDir = getOutDir;

function getOutPath(rootInDir, inPath, rootOutDir) {
    const outDir = getOutDir(rootInDir, inPath, rootOutDir)
    return Path.join(outDir, Path.basename(inPath));
}
exports.getOutPath = getOutPath;

function getOutPathWithDiffExt(rootInDir, inPath, rootOutDir, inExt, outExt) {
    const outDir = getOutDir(rootInDir, inPath, rootOutDir)
    const baseName = Path.basename(inPath, inExt);
    return Path.join(outDir, `${baseName}${outExt}`);
}
exports.getOutPathWithDiffExt = getOutPathWithDiffExt;

function fixedInteger(value, length) {
    const str = `${value}`;
    return str.length >= length ? str : '0'.repeat(length - str.length) + str;
}
exports.fixedInteger = fixedInteger;