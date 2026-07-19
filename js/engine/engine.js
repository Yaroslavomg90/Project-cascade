export class Engine {
  constructor(options = {}) {
    this.fixedDelta = options.fixedDelta ?? 1 / 60;
    this.maxFrameDelta = options.maxFrameDelta ?? 0.25;
    this.maxUpdatesPerFrame = options.maxUpdatesPerFrame ?? 5;
    this.requestFrame = options.requestFrame ?? globalThis.requestAnimationFrame?.bind(globalThis);
    this.cancelFrame = options.cancelFrame ?? globalThis.cancelAnimationFrame?.bind(globalThis);

    this.running = false;
    this.lastTime = null;
    this.accumulator = 0;
    this.frameId = null;
    this.updateCallback = null;
    this.renderCallback = null;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsStartTime = null;

    this.loop = this.loop.bind(this);
  }

  start(updateCallback, renderCallback) {
    if (typeof updateCallback !== "function" || typeof renderCallback !== "function") {
      throw new TypeError("Engine requires update and render callbacks.");
    }

    if (typeof this.requestFrame !== "function") {
      throw new Error("requestAnimationFrame is not available.");
    }

    this.stop();
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.running = true;
    this.resetTiming();
    this.scheduleNextFrame();
  }

  stop() {
    this.running = false;

    if (this.frameId !== null && typeof this.cancelFrame === "function") {
      this.cancelFrame(this.frameId);
    }

    this.frameId = null;
  }

  resetTiming() {
    this.lastTime = null;
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsStartTime = null;
  }

  loop(timestamp) {
    if (!this.running) {
      return;
    }

    this.updateFrameTiming(timestamp);
    this.runUpdates();

    if (!this.running) {
      return;
    }

    this.renderCallback(this.accumulator / this.fixedDelta);
    this.updateFps(timestamp);
    this.scheduleNextFrame();
  }

  updateFrameTiming(timestamp) {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
    }

    const elapsed = Math.max(0, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    this.accumulator += Math.min(elapsed, this.maxFrameDelta);
  }

  runUpdates() {
    let updateCount = 0;

    while (this.accumulator >= this.fixedDelta && updateCount < this.maxUpdatesPerFrame) {
      this.updateCallback(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      updateCount += 1;
    }

    if (updateCount === this.maxUpdatesPerFrame) {
      this.accumulator %= this.fixedDelta;
    }
  }

  updateFps(timestamp) {
    if (this.fpsStartTime === null) {
      this.fpsStartTime = timestamp;
    }

    this.frameCount += 1;
    const elapsed = timestamp - this.fpsStartTime;

    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.fpsStartTime = timestamp;
    }
  }

  scheduleNextFrame() {
    this.frameId = this.requestFrame(this.loop);
  }
}
