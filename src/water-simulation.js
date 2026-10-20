const GRAVITY = 9.81;

// 波高使用米，速度使用米/秒；每个湿网格是具有真实水深的浅水单元。
export class WaterSimulation {
  constructor({ width, depth, resolutionX = 96, resolutionZ = 64, waterDepth = 1.2, shapeMask = null, depthAt = null, seed = 12873, damping = 0.34 } = {}) {
    if (![width, depth, waterDepth].every((value) => Number.isFinite(value) && value > 0)) {
      throw new RangeError('水面宽度、长度和水深必须是正的有限米数。');
    }
    this.width = width;
    this.depth = depth;
    this.waterDepth = waterDepth;
    this.resolutionX = Math.max(8, Math.min(192, Math.round(resolutionX)));
    this.resolutionZ = Math.max(8, Math.min(128, Math.round(resolutionZ)));
    this.dx = width / (this.resolutionX - 1);
    this.dz = depth / (this.resolutionZ - 1);
    this.heights = new Float32Array(this.resolutionX * this.resolutionZ);
    this.velocity = new Float32Array(this.heights.length);
    this.mask = new Uint8Array(this.heights.length);
    this.localDepth = new Float32Array(this.heights.length);
    this.localDamping = new Float32Array(this.heights.length);
    this.dampingFactors = new Float32Array(this.heights.length);
    this.acceleration = new Float32Array(this.heights.length);
    this.windPatternX = new Float32Array(this.heights.length);
    this.windPatternZ = new Float32Array(this.heights.length);
    this.accumulator = 0;
    this.steps = 0;
    this.droppedTime = 0;
    this.rainAccumulator = 0;
    this.seed = seed >>> 0;
    this.disturbanceCount = 0;
    this.wetCells = 0;
    this.damping = Math.max(0, Number.isFinite(damping) ? damping : 0.34);

    // 二维 CFL 条件决定一次固定积分的上限，微型鱼塘也不会在细网格上失稳。
    const inverseSpacing = Math.sqrt(1 / this.dx ** 2 + 1 / this.dz ** 2);
    this.fixedStep = Math.min(1 / 120, 0.64 / (Math.sqrt(GRAVITY * waterDepth) * inverseSpacing));
    this.cfl = Math.sqrt(GRAVITY * waterDepth) * this.fixedStep * inverseSpacing;
    if (!(this.cfl <= 0.65)) throw new RangeError('水面网格未通过 CFL 稳定性检查。');

    const distance = new Float32Array(this.heights.length);
    const nx = this.resolutionX;
    const nz = this.resolutionZ;
    for (let z = 0; z < nz; z += 1) {
      for (let x = 0; x < nx; x += 1) {
        const i = z * nx + x;
        const u = x / (nx - 1);
        const v = z / (nz - 1);
        const wet = !shapeMask || Boolean(shapeMask(u, v));
        this.mask[i] = wet ? 1 : 0;
        this.wetCells += wet ? 1 : 0;
        distance[i] = wet ? Math.min(x * this.dx + this.dx * 0.5, (nx - 1 - x) * this.dx + this.dx * 0.5, z * this.dz + this.dz * 0.5, (nz - 1 - z) * this.dz + this.dz * 0.5) : 0;
      }
    }
    if (!this.wetCells) throw new RangeError('水面形状没有任何湿网格。');

    // 两遍距离传播让不规则岸线形成较浅的近岸水层，而不是矩形透明贴图。
    for (let z = 0; z < nz; z += 1) {
      for (let x = 0; x < nx; x += 1) {
        const i = z * nx + x;
        if (x > 0) distance[i] = Math.min(distance[i], distance[i - 1] + this.dx);
        if (z > 0) distance[i] = Math.min(distance[i], distance[i - nx] + this.dz);
      }
    }
    for (let z = nz - 1; z >= 0; z -= 1) {
      for (let x = nx - 1; x >= 0; x -= 1) {
        const i = z * nx + x;
        if (x < nx - 1) distance[i] = Math.min(distance[i], distance[i + 1] + this.dx);
        if (z < nz - 1) distance[i] = Math.min(distance[i], distance[i + nx] + this.dz);
        const shore = Math.max(0, Math.min(1, distance[i] / Math.min(1.05, Math.min(width, depth) * 0.22)));
        const measuredDepth = depthAt?.(x/(nx-1),z/(nz-1));
        this.localDepth[i] = this.mask[i] ? Number.isFinite(measuredDepth)
          ? Math.max(0.03,Math.min(waterDepth,measuredDepth)) : waterDepth * (0.24 + 0.76 * shore) : 0;
        this.localDamping[i] = this.damping + (1 - shore) ** 2 * 2.6;
        this.dampingFactors[i] = Math.exp(-this.localDamping[i] * this.fixedStep);
        const worldX = x * this.dx;
        const worldZ = z * this.dz;
        this.windPatternX[i] = Math.sin(worldX * 2.17 + worldZ * 1.19) * 0.65 + Math.sin(worldX * 4.03 - worldZ * 0.93) * 0.35;
        this.windPatternZ[i] = Math.sin(worldX * 1.37 - worldZ * 2.43 + 1.1) * 0.65 + Math.sin(worldX * 0.71 + worldZ * 4.17) * 0.35;
      }
    }
  }

  random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  // 有体积补偿的局部脉冲形成中心起伏与外围低环，水量不会因投喂持续增加。
  disturb(u, v, strength = 0.045, radius = 0.3) {
    if (![u, v, strength, radius].every(Number.isFinite) || radius <= 0) return false;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const nx = this.resolutionX;
    const nz = this.resolutionZ;
    const centerX = u * this.width;
    const centerZ = v * this.depth;
    const reach = Math.max(radius, Math.min(this.dx, this.dz) * 0.75) * 2.8;
    const sigmaSquared = (reach / 2.8) ** 2;
    const x0 = Math.max(0, Math.floor((centerX - reach) / this.dx));
    const x1 = Math.min(nx - 1, Math.ceil((centerX + reach) / this.dx));
    const z0 = Math.max(0, Math.floor((centerZ - reach) / this.dz));
    const z1 = Math.min(nz - 1, Math.ceil((centerZ + reach) / this.dz));
    let count = 0;
    let sum = 0;
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = z * nx + x;
        const r2 = (x * this.dx - centerX) ** 2 + (z * this.dz - centerZ) ** 2;
        if (!this.mask[i] || r2 > reach ** 2) continue;
        sum += (1 - r2 / sigmaSquared) * Math.exp(-r2 / (2 * sigmaSquared));
        count += 1;
      }
    }
    if (!count) return false;
    const correction = sum / count;
    const amplitude = Math.max(-0.22, Math.min(0.22, strength));
    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = z * nx + x;
        const r2 = (x * this.dx - centerX) ** 2 + (z * this.dz - centerZ) ** 2;
        if (!this.mask[i] || r2 > reach ** 2) continue;
        const value = (1 - r2 / sigmaSquared) * Math.exp(-r2 / (2 * sigmaSquared));
        this.heights[i] += amplitude * (value - correction);
      }
    }
    this.disturbanceCount += 1;
    return true;
  }

  step(dt, { windX = 0, windZ = 0, rain = 0 } = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // 浏览器后台恢复时丢弃长暂停的时间，避免瞬间计算几千步及雨滴集中堆积。
    const admitted = Math.min(dt, 0.25);
    this.droppedTime += dt - admitted;
    this.accumulator += admitted;
    const wx = Number.isFinite(windX) ? Math.max(-12, Math.min(12, windX)) : 0;
    const wz = Number.isFinite(windZ) ? Math.max(-12, Math.min(12, windZ)) : 0;
    const rainfall = Number.isFinite(rain) ? Math.max(0, Math.min(1, rain)) : 0;
    while (this.accumulator + 1e-11 >= this.fixedStep) {
      this.integrate(wx, wz, rainfall);
      this.accumulator -= this.fixedStep;
    }
    this.accumulator = Math.max(0, this.accumulator);
  }

  integrate(windX, windZ, rain) {
    const nx = this.resolutionX;
    const nz = this.resolutionZ;
    const h = this.heights;
    const velocity = this.velocity;
    const wet = this.mask;
    const depths = this.localDepth;
    const fixed = this.fixedStep;
    const time = this.steps * fixed;
    const inverseDx2 = 1 / this.dx ** 2;
    const inverseDz2 = 1 / this.dz ** 2;
    const windPhaseX = Math.sin(time * 1.31);
    const windPhaseZ = Math.cos(time * 1.57);
    for (let z = 0; z < nz; z += 1) {
      for (let x = 0; x < nx; x += 1) {
        const i = z * nx + x;
        if (!wet[i]) continue;
        let fluxX = 0;
        let fluxZ = 0;
        // 岸边法向通量为零，既保留反射波，又不向干岸传播高度。
        if (x > 0 && wet[i - 1]) fluxX += (depths[i] + depths[i - 1]) * 0.5 * (h[i - 1] - h[i]);
        if (x < nx - 1 && wet[i + 1]) fluxX += (depths[i] + depths[i + 1]) * 0.5 * (h[i + 1] - h[i]);
        if (z > 0 && wet[i - nx]) fluxZ += (depths[i] + depths[i - nx]) * 0.5 * (h[i - nx] - h[i]);
        if (z < nz - 1 && wet[i + nx]) fluxZ += (depths[i] + depths[i + nx]) * 0.5 * (h[i + nx] - h[i]);
        // 风应力只提供小幅动力；空间波形仍由邻格通量传播而非直接绘制正弦波高。
        const windForce = 0.007 * (windX * this.windPatternX[i] * windPhaseX + windZ * this.windPatternZ[i] * windPhaseZ);
        this.acceleration[i] = GRAVITY * (fluxX * inverseDx2 + fluxZ * inverseDz2) + windForce;
      }
    }
    let verticalFlow = 0;
    for (let i = 0; i < h.length; i += 1) {
      if (!wet[i]) continue;
      velocity[i] = (velocity[i] + this.acceleration[i] * fixed) * this.dampingFactors[i];
      verticalFlow += velocity[i];
    }
    // 封闭鱼塘的整体水量守恒；空间阻尼和风应力不得偷偷抬高平均水位。
    const volumeCorrection = verticalFlow / this.wetCells;
    for (let i = 0; i < h.length; i += 1) {
      if (!wet[i]) continue;
      velocity[i] -= volumeCorrection;
      h[i] += velocity[i] * fixed;
    }
    if (rain > 0) {
      this.rainAccumulator += rain * Math.min(45, this.width * this.depth * 0.34) * fixed;
      while (this.rainAccumulator >= 1) {
        this.disturb(this.random(), this.random(), -0.0017 - this.random() * 0.0025, 0.10 + this.random() * 0.10);
        this.rainAccumulator -= 1;
      }
    }
    this.steps += 1;
  }

  sample(u, v) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) return 0;
    const x = Math.max(0, Math.min(1, u)) * (this.resolutionX - 1);
    const z = Math.max(0, Math.min(1, v)) * (this.resolutionZ - 1);
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = Math.min(this.resolutionX - 1, x0 + 1);
    const z1 = Math.min(this.resolutionZ - 1, z0 + 1);
    const tx = x - x0;
    const tz = z - z0;
    const i = z0 * this.resolutionX + x0;
    return this.heights[i] * (1 - tx) * (1 - tz) + this.heights[z0 * this.resolutionX + x1] * tx * (1 - tz) + this.heights[z1 * this.resolutionX + x0] * (1 - tx) * tz + this.heights[z1 * this.resolutionX + x1] * tx * tz;
  }

  fillTextureData(targetRGBA) {
    if (!(targetRGBA instanceof Float32Array) || targetRGBA.length < this.heights.length * 4) {
      throw new RangeError('水面纹理需要容纳每个网格的四个 Float32 通道。');
    }
    const nx = this.resolutionX;
    const nz = this.resolutionZ;
    const h = this.heights;
    for (let z = 0; z < nz; z += 1) {
      for (let x = 0; x < nx; x += 1) {
        const i = z * nx + x;
        const left = x > 0 && this.mask[i - 1] ? h[i - 1] : h[i];
        const right = x < nx - 1 && this.mask[i + 1] ? h[i + 1] : h[i];
        const back = z > 0 && this.mask[i - nx] ? h[i - nx] : h[i];
        const front = z < nz - 1 && this.mask[i + nx] ? h[i + nx] : h[i];
        targetRGBA[i * 4] = h[i];
        targetRGBA[i * 4 + 1] = this.mask[i] ? (right - left) / (2 * this.dx) : 0;
        targetRGBA[i * 4 + 2] = this.mask[i] ? (front - back) / (2 * this.dz) : 0;
        targetRGBA[i * 4 + 3] = this.mask[i];
      }
    }
    return targetRGBA;
  }

  get snapshot() {
    let maxAmplitude = 0;
    let energy = 0;
    let meanHeight = 0;
    const nx = this.resolutionX;
    for (let i = 0; i < this.heights.length; i += 1) {
      if (!this.mask[i]) continue;
      const h = this.heights[i];
      maxAmplitude = Math.max(maxAmplitude, Math.abs(h));
      meanHeight += h;
      energy += 0.5 * this.velocity[i] ** 2;
      if (i % nx < nx - 1 && this.mask[i + 1]) energy += 0.5 * GRAVITY * (this.localDepth[i] + this.localDepth[i + 1]) * 0.5 * ((this.heights[i + 1] - h) / this.dx) ** 2;
      if (i + nx < this.heights.length && this.mask[i + nx]) energy += 0.5 * GRAVITY * (this.localDepth[i] + this.localDepth[i + nx]) * 0.5 * ((this.heights[i + nx] - h) / this.dz) ** 2;
    }
    return { maxAmplitude, energy: energy * this.dx * this.dz, meanHeight: meanHeight / this.wetCells, steps: this.steps, time: this.steps * this.fixedStep, fixedStep: this.fixedStep, cfl: this.cfl, waveSpeed: Math.sqrt(GRAVITY * this.waterDepth), wetCells: this.wetCells, disturbances: this.disturbanceCount, droppedTime: this.droppedTime };
  }
}
