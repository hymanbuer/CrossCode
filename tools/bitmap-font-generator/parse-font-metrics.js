
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

async function loadMetrics(imagePath, charHeight) {
    const image = await Jimp.read(imagePath);
    const imageWidth = image.getWidth();
    const imageHeight = image.getHeight();

    const widthMap = [];
	const indicesX = [];
	const indicesY = [];
    
    for (let pixelY = 0; pixelY + charHeight < imageHeight; ) {
        const alphas = getImageRegionAlphas(image, 0, pixelY + charHeight, imageWidth, 1);
        let charWidth = 0;

        for (let pixelX = 0; pixelX < imageWidth; pixelX++) {
            const alpha = alphas[pixelX];
            if (alpha != 0) {
                charWidth++;
            } else if (alpha == 0 && charWidth) {
                widthMap.push(charWidth);
                indicesX.push(pixelX - charWidth);
                indicesY.push(pixelY);
                charWidth = 0;
            }
        }

        if (charWidth) {
            widthMap.push(charWidth);
            indicesX.push(imageWidth - charWidth);
            indicesY.push(pixelY);
        }

        pixelY = pixelY + (charHeight + 1);
    }

    return {
        widthMap, indicesX, indicesY
    };
}

function convertToFrames(metrics, charHeight, firstCharCode) {
    const { widthMap, indicesX, indicesY } = metrics;
    const result = [];
    const total = widthMap.length;
    for (let i = 0; i < total; i++) {
        const frame = {};
        frame.x = indicesX[i];
        frame.y = indicesY[i];
        frame.w = widthMap[i];
        frame.h = charHeight;

        const charCode = firstCharCode + i;
        frame.id = charCode;
        frame.name = `char_${charCode}.png`;
        frame.letter = String.fromCharCode(charCode);

        result.push(frame);
    }

    return result;
}

async function parse(imagePath, charHeight, firstCharCode) {
    firstCharCode = firstCharCode || 32;

    const metrics = await loadMetrics(imagePath, charHeight);

    const frames = convertToFrames(metrics, charHeight, firstCharCode);

    return {
        frames
    };
}

exports.parse = parse;