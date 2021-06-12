
const Walk = require('walk');

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