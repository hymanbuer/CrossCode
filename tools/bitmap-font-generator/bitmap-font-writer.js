
const _value = (name, value) => `${name}=${value}`;
const _string = (name, value) => `${name}="${value}"`;
const _fixed = (str, length) => str.length < length ? (str + ' '.repeat(length-str.length)) : str;

function write(fontData, plistData) {
    const frames = plistData.frames || [];
    const lines = new Array(4 + frames.length);
    const extraXAdvance = 1;

    const info = [];
    info.push('info');
    info.push(_string('face', fontData.face || ''));
    info.push(_value('size', fontData.size || 0));
    info.push(_value('bold', fontData.bold || 0));
    info.push(_value('italic', fontData.italic || 0));
    info.push(_string('charset', fontData.charset || ''));
    info.push(_value('unicode', fontData.unicode || 0));
    info.push(_value('stretchH', fontData.stretchH || 100));
    info.push(_value('smooth', fontData.smooth || 1));
    info.push(_value('aa', fontData.aa || 1));
    info.push(_value('padding', fontData.padding || '0,0,0,0'));
    info.push(_value('spacing', fontData.spacing || '1,1'));
    lines[0] = info.join(' ');

    const common = [];
    common.push('common');
    common.push(_value('lineHeight', fontData.lineHeight || 0));
    common.push(_value('base', fontData.base || 0));
    common.push(_value('scaleW', plistData.textureWidth || 0));
    common.push(_value('scaleH', plistData.textureHeight || 0));
    common.push(_value('pages', 1));
    common.push(_value('packed', 0));
    lines[1] = common.join(' ');

    const page = [];
    page.push('page');
    page.push(_value('id', 0));
    page.push(_string('file', fontData.file || ''));
    lines[2] = page.join(' ');

    const chars = [];
    chars.push('chars');
    chars.push(_value('count', frames.length));
    lines[3] = chars.join(' ');

    const char = [];
    char[0] = 'char';
    char[6] = _fixed(_value('xoffset', 0), 14);
    char[7] = _fixed(_value('yoffset', 0), 14);
    char[9] = 'page=0';
    char[10] = 'chnl=15';
    for (let lineIndex = 4, i = 0, length = frames.length; i < length; i++, lineIndex++) {
        const frame = frames[i];
        char[1] = _fixed(_value('id', frame.id), 10);
        char[2] = _fixed(_value('x', frame.x), 8);
        char[3] = _fixed(_value('y', frame.y), 8);
        char[4] = _fixed(_value('width', frame.w), 12);
        char[5] = _fixed(_value('height', frame.h), 13);
        char[8] = _fixed(_value('xadvance', frame.w + extraXAdvance), 15);
        char[11] = _string('letter', frame.letter);
        lines[lineIndex] = char.join(' ');
    }
    
    return lines.join('\n');
}

exports.write = write;