export class UnitSpriteAtlas {
  constructor() {
    this.atlasPaths = {
      UCA: "assets/sprites/uca-units.png",
      EBD: "assets/sprites/ebd-units.png",
      PQC: "assets/sprites/pqc-units.png",
    };
    this.cellByUnitType = {
      worker: [0, 0],
      infLight: [1, 0],
      infHeavy: [1, 0],
      vehLight: [0, 1],
      vehHeavy: [1, 1],
      artillery: [1, 1],
    };
    this.images = new Map();
    this.sprites = new Map();
  }

  load() {
    return Promise.all(Object.entries(this.atlasPaths).map(([faction, path]) => this.loadAtlas(faction, path)));
  }

  getSprite(faction, unitType) {
    const cell = this.cellByUnitType[unitType];
    const image = this.images.get(faction);

    if (!cell || !image) {
      return null;
    }

    const cacheKey = `${faction}:${unitType}`;
    if (!this.sprites.has(cacheKey)) {
      this.sprites.set(cacheKey, this.createSprite(image, cell));
    }

    return this.sprites.get(cacheKey);
  }

  loadAtlas(faction, path) {
    return new Promise(resolve => {
      const image = new Image();
      image.addEventListener("load", () => {
        this.images.set(faction, image);
        resolve();
      });
      image.addEventListener("error", resolve);
      image.src = path;
    });
  }

  createSprite(image, cell) {
    const cellWidth = image.width / 2;
    const cellHeight = image.height / 2;
    const sprite = document.createElement("canvas");

    sprite.width = cellWidth;
    sprite.height = cellHeight;
    sprite.getContext("2d").drawImage(
      image,
      cell[0] * cellWidth,
      cell[1] * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight,
    );

    return sprite;
  }
}
