import assert from 'node:assert/strict';
import { WaterSimulation } from '../src/water-simulation.js';

const advance = (water, duration, options = {}) => {
  for (let frame = 0; frame < Math.round(duration * 60); frame += 1) water.step(1 / 60, options);
};
const reports = {};

// 远处测点必须在扰动之后收到传播波，初始脉冲无法直接覆盖此处。
const propagation = new WaterSimulation({ width: 12, depth: 8, resolutionX: 81, resolutionZ: 55 });
propagation.disturb(0.3, 0.5, 0.08, 0.16);
assert.equal(propagation.sample(0.55, 0.5), 0);
let reachedAmplitude = 0;
let arrivalTime = null;
for (let frame = 0; frame < 120; frame += 1) {
  propagation.step(1 / 60);
  const amplitude = Math.abs(propagation.sample(0.55, 0.5));
  reachedAmplitude = Math.max(reachedAmplitude, amplitude);
  if (arrivalTime === null && amplitude > 0.00003) arrivalTime = (frame + 1) / 60;
}
assert(reachedAmplitude > 0.0002, '投喂的局部扰动必须向三米外传播。');
assert(arrivalTime > 0.4 && arrivalTime < 1.4, '传播速度必须在重力浅水波的合理时间范围。');
reports.propagation = { reachedAmplitude, arrivalTime };

// 相同距离、不同真实水深，浅水波必须更晚抵达。
const arrival = (waterDepth) => {
  const water = new WaterSimulation({ width: 12, depth: 8, resolutionX: 81, resolutionZ: 55, waterDepth, damping: 0.1 });
  water.disturb(0.3, 0.5, 0.08, 0.16);
  for (let frame = 0; frame < 240; frame += 1) {
    water.step(1 / 60);
    if (Math.abs(water.sample(0.55, 0.5)) > 0.00003) return (frame + 1) / 60;
  }
  return Infinity;
};
const deepArrival = arrival(1.2);
const shallowArrival = arrival(0.3);
assert(shallowArrival > deepArrival * 1.65 && shallowArrival < deepArrival * 2.35, '水深改变必须通过 sqrt(g·水深) 改变实际传播。');
reports.depth = { deepArrival, shallowArrival };

// 不规则干岸始终保持零高度，边界附近可观察到返回湿区的反射波。
const shaped = new WaterSimulation({ width: 10, depth: 7, resolutionX: 81, resolutionZ: 57, shapeMask: (u, v) => ((u - 0.5) / 0.49) ** 2 + ((v - 0.5) / 0.49) ** 2 <= 1 });
shaped.disturb(0.77, 0.5, 0.06, 0.16);
advance(shaped, 3);
assert(shaped.heights.every((height, index) => shaped.mask[index] || height === 0), '波浪不得越过干燥岸线。');
assert(shaped.snapshot.maxAmplitude > 0.0001, '岸边反射后仍有衰减中的波浪。');
const texture = shaped.fillTextureData(new Float32Array(shaped.heights.length * 4));
assert(texture.every(Number.isFinite), '所有纹理高度及法线梯度必须有限。');
assert.equal(texture[3], 0, '干岸的水纹理标记必须为零。');
reports.shore = { ...shaped.snapshot };

// 振动能量在没有继续施力时衰减，不能成为永动正弦图案。
const decay = new WaterSimulation({ width: 12, depth: 8, resolutionX: 81, resolutionZ: 55 });
decay.disturb(0.5, 0.5, 0.08, 0.24);
const initialEnergy = decay.snapshot.energy;
advance(decay, 12);
const finalEnergy = decay.snapshot.energy;
assert(finalEnergy < initialEnergy * 0.08, '平静后能量应被黏性及岸边阻尼逐渐耗散。');
reports.decay = { initialEnergy, finalEnergy, ...decay.snapshot };

// 不同屏幕帧率应得到相同的固定物理步，包括风驱动与确定性雨滴。
const sixty = new WaterSimulation({ width: 9, depth: 6, resolutionX: 64, resolutionZ: 48, seed: 42 });
const oneTwenty = new WaterSimulation({ width: 9, depth: 6, resolutionX: 64, resolutionZ: 48, seed: 42 });
const forcing = { windX: 2.5, windZ: -1.2, rain: 0.75 };
for (let frame = 0; frame < 180; frame += 1) sixty.step(1 / 60, forcing);
for (let frame = 0; frame < 360; frame += 1) oneTwenty.step(1 / 120, forcing);
assert.equal(sixty.steps, oneTwenty.steps);
assert.deepEqual(sixty.heights, oneTwenty.heights, '60/120 帧率切换不得改变固定物理结果。');
assert(sixty.snapshot.disturbances > 20, '春雨必须实际注入局部水滴扰动。');
assert(sixty.snapshot.maxAmplitude > 0.001 && sixty.snapshot.maxAmplitude < 0.03, '普通微风春雨应生成厘米以下的小波。');
assert(Math.abs(sixty.snapshot.meanHeight) < 0.000001, '风与雨滴不得改变封闭水塘的整体水量。');
reports.forcing = sixty.snapshot;

// 持续天气压力不会无限积累能量或平均水位。
advance(sixty, 40, { windX: 12, windZ: -8, rain: 1 });
assert(sixty.heights.every(Number.isFinite) && sixty.velocity.every(Number.isFinite));
assert(sixty.snapshot.maxAmplitude < 0.08 && Math.abs(sixty.snapshot.meanHeight) < 0.000001);
reports.sustainedWeather = sixty.snapshot;

// 极小高分辨率水池会自动降低固定步长，长暂停恢复也不得爆炸。
const small = new WaterSimulation({ width: 1.3, depth: 1.1, waterDepth: 2, resolutionX: 96, resolutionZ: 64 });
small.disturb(0.5, 0.5, 0.08, 0.08);
advance(small, 4, { windX: 3, windZ: 1, rain: 1 });
small.step(600, { rain: 1 });
assert(small.snapshot.cfl <= 0.65 && small.fixedStep < 1 / 120);
assert(small.heights.every(Number.isFinite) && small.velocity.every(Number.isFinite));
assert(small.snapshot.maxAmplitude < 0.2 && small.snapshot.droppedTime > 599);
reports.stability = small.snapshot;

console.log(JSON.stringify({ passed: true, ...reports }, null, 2));
