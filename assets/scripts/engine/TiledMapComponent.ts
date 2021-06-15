
import { _decorator, TiledMap } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TiledMapComponent')
export class TiledMapComponent extends TiledMap {
    _applyFile() {
        if (this._tmxFile) {
            let tmxXmlStr =  this._tmxFile.tmxXmlStr;
            tmxXmlStr = tmxXmlStr.replace(/\.\.\/\.\.\/\.\.\/media\/map\//g, '');
            this._tmxFile.tmxXmlStr = tmxXmlStr;
        }
        super._applyFile();
    }
}
