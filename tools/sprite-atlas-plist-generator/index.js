
const Fs = require('fs-extra');
const Plist = require('plist');
const Path = require('path');

function createEmptyPlist(textureFileName, size) {
    return {
        frames: {},
        metadata: {
            format: 3,
            pixelFormat: 'RGBA8888',
            premultiplyAlpha: false,
            realTextureFileName: textureFileName,
            size: size,
            smartupdate: '$TexturePacker:SmartUpdate:9c768fe6828cb6c075550d20fcd572e4:4d9c4c023ac2e79911a281ae6c21e22a:e75714c0871c497b76d71a94e9da90fb$',
            textureFileName: textureFileName
        }
    };
}

function addSpriteFrame(plist, name, offset, size) {
    plist.frames[name] = {
        spriteOffset: '{0,0}',
        spriteSize: size,
        spriteSourceSize: size,
        textureRect: `{${offset},${size}}`,
        textureRotated: false
    };
}

(async () => {
    const plist = createEmptyPlist('test.png', '{16,24}');
    addSpriteFrame(plist, '0.png', '{0,0}', '{8,24}');
    addSpriteFrame(plist, '1.png', '{8,0}', '{8,24}');

    const xml = Plist.build(plist);
    await Fs.writeFile(Path.join(__dirname, 'out.plist'), xml, { encoding: 'utf-8' });
})();