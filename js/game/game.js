import {Engine} from "../engine/engine.js";
export class Game{
 constructor(){this.engine=new Engine();}
 start(){this.engine.start(this.update.bind(this),this.render.bind(this));}
 update(dt){/* TODO: migrate legacy update */ }
 render(alpha){/* TODO: migrate renderer */ }
}
