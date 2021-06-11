
const Fs = require('fs-extra');
const Path = require('path');
const builder = require('xmlbuilder');

function buildTmxContent() {
    const map = builder.create('map', { encoding: 'utf-8' });
    map.att('version', '1.0')
        .att('orientation', 'orthogonal')
        .att('renderorder', 'right-down')
        .att('width', '40')
        .att('height', '40')
        .att('tilewidth', '32')
        .att('tileheight', '32');

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
    const tileset = builder.create('tileset', { encoding: 'utf-8' });
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

(async () => {
    // const content = buildTmxContent();
    const content = buildTsxContent();
    const outPath = Path.join(__dirname, 'out.tmx');
    await Fs.writeFile(outPath, content, { encoding: 'utf-8' });
})();