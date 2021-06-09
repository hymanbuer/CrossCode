
const Fs = require('fs-extra');
const Path = require('path');
const Jimp = require('jimp');

function getImageRegionAlphas(image, x, y, width, height) {
    const result = [];
    image.scan(x, y, width, height, function(x, y, idx) {
        // const red = this.bitmap.data[idx + 0];
        // const green = this.bitmap.data[idx + 1];
        // const blue = this.bitmap.data[idx + 2];
        const alpha = this.bitmap.data[idx + 3];
        result.push(alpha);
    });

    return result;
}

// (async () => {
//     const imagePath = Path.join(__dirname, 'hall-fetica-bold.png');
//     const image = await Jimp.read(imagePath);

//     const imageWidth = image.getWidth();
//     const imageHeight = image.getHeight();

//     const charHeight = 16;
//     const widthMap = [];
// 	const indicesX = [];
// 	const indicesY = [];
    
//     for (let pixelY = 0; pixelY + charHeight < imageHeight; ) {
//         const alphas = getImageRegionAlphas(image, 0, pixelY + charHeight, imageWidth, 1);
//         let charWidth = 0;

//         for (let pixelX = 0; pixelX < imageWidth; pixelX++) {
//             const alpha = alphas[pixelX];
//             if (alpha != 0) {
//                 charWidth++;
//             } else if (alpha == 0 && charWidth) {
//                 widthMap.push(charWidth);
//                 indicesX.push(pixelX - charWidth);
//                 indicesY.push(pixelY);
//                 charWidth = 0;
//             }
//         }

//         if (charWidth) {
//             widthMap.push(charWidth);
//             indicesX.push(imageWidth - charWidth);
//             indicesY.push(pixelY);
//         }

//         pixelY = pixelY + (charHeight + 1);
//     }

//     console.log(widthMap.length, widthMap);
//     console.log(indicesX.length, indicesX);
//     console.log(indicesY.length, indicesY);
// })();

(async () => {
    const _value = (name, value) => `${name}=${value}`;
    const _string = (name, value) => `${name}="${value}"`;
    const _fixed = (str, length) => str.length < length ? (str + ' '.repeat(length-str.length)) : str;

    const lines = [];

    const info = [];
    info.push('info');
    info.push(_string('face', 'Mikado'));
    info.push(_value('size', 36));
    info.push(_value('bold', 0));
    info.push(_value('italic', 0));
    info.push(_string('charset', ''));
    info.push(_value('unicode', 0));
    info.push(_value('stretchH', 100));
    info.push(_value('smooth', 1));
    info.push(_value('aa', 1));
    info.push(_value('padding', '0,0,0,0'));
    info.push(_value('spacing', '1,1'));
    lines[0] = info.join(' ');

    const common = [];
    common.push('common');
    common.push(_value('lineHeight', 36));
    common.push(_value('base', 36));
    common.push(_value('scaleW', 36));
    common.push(_value('scaleH', 36));
    common.push(_value('pages', 1));
    common.push(_value('packed', 0));
    lines[1] = common.join(' ');

    const page = [];
    page.push('page');
    page.push(_value('id', 0));
    page.push(_string('file', 'mikado_outline_shadow.png'));
    lines[2] = page.join(' ');

    const chars = [];
    chars.push('chars');
    chars.push(_value('count', 95));
    lines[3] = chars.join(' ');

    const char = [];
    char.push('char');
    char.push(_fixed(_value('id', 95), 10));
    char.push(_fixed(_value('x', 95), 8));
    char.push(_fixed(_value('y', 95), 8));
    char.push(_fixed(_value('width', 95), 12));
    char.push(_fixed(_value('height', 95), 13));
    char.push(_fixed(_value('xoffset', 95), 14));
    char.push(_fixed(_value('yoffset', 95), 14));
    char.push(_fixed(_value('xadvance', 95), 15));
    char.push('page=0');
    char.push('chnl=15');
    char.push(_string('letter', '!'));
    lines[4] = char.join(' ');
    
    const content = lines.join('\n');
    await Fs.writeFile(Path.join(__dirname, 'out.fnt'), content, { encoding: 'utf-8' });

})();