
const Plist = require('plist');

function write(plistData) {
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

    return Plist.build(result);
}

exports.write = write;