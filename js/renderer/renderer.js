export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.minimapCanvas = minimapCanvas;
    this.minimapContext = minimapCanvas.getContext("2d");
  }

  render(state) {
    const context = this.context;
    const offsetX = state.shake ? state.random(-state.shake, state.shake) : 0;
    const offsetY = state.shake ? state.random(-state.shake, state.shake) : 0;

    context.save();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.translate(-state.camera.x + offsetX, -state.camera.y + offsetY);

    state.drawTerrain();
    state.nodes.forEach(state.drawNode);
    state.buildings.slice().sort((first, second) => first.y - second.y).forEach(state.drawBuilding);
    state.units.slice().sort((first, second) => first.y - second.y).forEach(state.drawUnit);
    state.drawParticles();
    state.drawFog();
    state.drawPlacementGhost();
    context.restore();

    state.drawDragBox();
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const context = this.minimapContext;
    const canvas = this.minimapCanvas;
    const scaleX = canvas.width / state.worldWidth;
    const scaleY = canvas.height / state.worldHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#04070a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,0.04)";

    for (let column = 0; column < state.columns; column += 1) {
      for (let row = 0; row < state.rows; row += 1) {
        if (state.isCellVisited(column, row)) {
          context.fillRect(
            column * state.tileSize * scaleX,
            row * state.tileSize * scaleY,
            state.tileSize * scaleX + 1,
            state.tileSize * scaleY + 1,
          );
        }
      }
    }

    state.nodes.forEach(node => {
      if (!state.isTileVisited(node.x, node.y)) return;
      context.fillStyle = "#3ea0c9";
      context.fillRect(node.x * scaleX - 1, node.y * scaleY - 1, 3, 3);
    });

    state.buildings.forEach(building => {
      if (building.owner === 1 && !state.isTileVisited(building.x, building.y)) return;
      context.fillStyle = building.owner === 0 ? state.playerFaction.accent : "#e05a5a";
      context.fillRect(
        building.x * scaleX,
        building.y * scaleY,
        Math.max(2, building.w * state.tileSize * scaleX),
        Math.max(2, building.h * state.tileSize * scaleY),
      );
    });

    state.units.forEach(unit => {
      if (unit.owner === 1 && !state.isTileVisible(unit.x, unit.y)) return;
      context.fillStyle = unit.owner === 0 ? state.playerFaction.glow : "#ff8b7a";
      context.fillRect(unit.x * scaleX - 1, unit.y * scaleY - 1, 2, 2);
    });

    context.strokeStyle = "#fff";
    context.lineWidth = 1;
    context.strokeRect(
      state.camera.x * scaleX,
      state.camera.y * scaleY,
      this.canvas.width * scaleX,
      this.canvas.height * scaleY,
    );
  }
}
