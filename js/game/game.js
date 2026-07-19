import { Engine } from "../engine/engine.js";
import { renderLegacyGame, updateLegacyGame } from "./legacy-game.js";

export class Game {
  constructor() {
    this.engine = new Engine();
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
  }

  start() {
    this.engine.start(this.update, this.render);
  }

  stop() {
    this.engine.stop();
  }

  update(deltaTime) {
    updateLegacyGame(deltaTime);
  }

  render() {
    renderLegacyGame();
  }
}
