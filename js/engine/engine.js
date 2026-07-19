export class Engine{
constructor(){this.running=false;this.lastTime=0;this.accumulator=0;this.fixedDelta=1/60;
this.updateCallback=null;this.renderCallback=null;this.fps=0;this.frames=0;this.fpsTimer=0;}
start(update,render){this.updateCallback=update;this.renderCallback=render;this.running=true;requestAnimationFrame(this.loop.bind(this));}
stop(){this.running=false;}
loop(time){
 if(!this.running)return;
 if(!this.lastTime)this.lastTime=time;
 let frameTime=(time-this.lastTime)/1000;
 if(frameTime>0.25)frameTime=0.25;
 this.lastTime=time;
 this.accumulator+=frameTime;
 while(this.accumulator>=this.fixedDelta){
   if(this.updateCallback)this.updateCallback(this.fixedDelta);
   this.accumulator-=this.fixedDelta;
 }
 const alpha=this.accumulator/this.fixedDelta;
 if(this.renderCallback)this.renderCallback(alpha);
 this.frames++;
 if(time-this.fpsTimer>=1000){this.fps=this.frames;this.frames=0;this.fpsTimer=time;}
 requestAnimationFrame(this.loop.bind(this));
}}