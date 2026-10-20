import assert from 'node:assert/strict';
import { createKit } from '../src/kit.js';
import { createPonds } from '../src/ponds.js';

// 只验收受力和时步，不启动渲染器，也不重复街区碰撞验收。
globalThis.document = { createElement() { return { width: 1, height: 1, getContext() { return { fillRect() {}, strokeRect() {}, fillText() {}, measureText(text) { return { width: text.length * 90 }; } }; } }; } };
const near = (actual, expected, tolerance = 1e-9, label = '') => assert(Math.abs(actual - expected) < tolerance, `${label} ${actual} != ${expected}`);
const quiet = { wind: { x: 0, y: 0 }, daylight: 1 };
function fixture() {
  const system = createPonds(createKit());
  const hits = [];
  system.setWaterDriver({ sampleSurface() { return { height: 0.027, slopeX: 0, slopeZ: 0 }; }, disturb(...hit) { hits.push(hit); } });
  return { system, pond: system.ponds[0], hits };
}
function isolatePellet(system, pond, options) {
  system.feed(pond.id);
  pond.feedTime = 0;
  pond.pellets.forEach(pellet => { pellet.alive = false; pellet.mesh.visible = false; });
  pond.fish.forEach(fish => { fish.x = -2.7; fish.z = -1.8; fish.y = -0.8; });
  const pellet = pond.pellets[0];
  Object.assign(pellet, { alive: true, floating: false, age: 0, x: 0, y: 1.2, z: 0, vx: 0, vy: 0.5, vz: 0, ...options });
  pellet.mesh.visible = true;
  return pellet;
}

const fall = fixture();
const fallingPellet = isolatePellet(fall.system, fall.pond);
for (let i = 0; i < 24; i++) fall.system.update(1 / 120, quiet);
const fallExpected = 1.2 + 0.5 * 0.2 - 0.5 * 9.81 * 0.2 ** 2;
near(fallingPellet.y, fallExpected, 0.0006, '重力落体距离');
near(fallingPellet.vy, 0.5 - 9.81 * 0.2, 0.003, '落体速度');
assert.equal(fallingPellet.floating, false);

const floating = fixture();
const floatPellet = isolatePellet(floating.system, floating.pond, { y: 0.152, vy: -0.35 });
floating.system.update(1 / 120, quiet);
assert.equal(floatPellet.floating, true, '落水应撞击抬高后的波面');
assert(floatPellet.y < 0.155 && floatPellet.y > 0.125, '落水不跳回平均水位，也不瞬移到漂浮平衡点');
assert(floatPellet.vy < 0, '落水瞬间保留下沉动量');
for (let i = 0; i < 600; i++) floating.system.update(1 / 120, quiet);
near(floatPellet.y, floating.pond.waterY + 0.027 + 0.012, 0.00003, '浮力平衡高度');
near(floatPellet.vy, 0, 0.00003, '浮水阻尼收敛');
assert(floating.hits.some(hit => hit[0] === floating.pond.id && hit[4] === 0.055), '食粒撞击应传递波面动量');
floating.system.setWaterDriver({ sampleSurface() { return { height: 0.057, slopeX: 0.14, slopeZ: -0.10 }; }, disturb() {} });
const heightBefore = floatPellet.y;
floating.system.update(1 / 120, quiet);
assert(floatPellet.y > heightBefore && floatPellet.y < heightBefore + 0.001, '水位突变通过连续浮力响应，不硬贴水面');
for (let i = 0; i < 600; i++) floating.system.update(1 / 120, quiet);
near(floatPellet.y, floating.pond.waterY + 0.057 + 0.012, 0.00004, '较高波面平衡');
assert(floatPellet.x < -0.03 && floatPellet.z > 0.02, '食粒应随水坡和水阻缓慢漂移');
const physicsThree = createKit().THREE;
const floatingUp = new physicsThree.Vector3(0, 1, 0).applyQuaternion(floatPellet.mesh.quaternion);
const waterNormal = new physicsThree.Vector3(-0.14, 1, 0.10).normalize();
assert(floatingUp.dot(waterNormal) > 0.9999, '浮物姿态响应法线，而非只绕竖轴旋转');

const climate = { wind: { x: 0.7, y: -0.3 }, daylight: 0.8 };
const runs = [];
for (const fps of [30, 60, 120]) {
  const { system, pond, hits } = fixture();
  system.feed(pond.id);
  for (let i = 0; i < fps * 20; i++) system.update(1 / fps, climate);
  assert.equal(system.snapshot.physicalSteps, 2400);
  near(system.snapshot.time, 20, 1e-9, '固定物理时钟');
  assert(pond.consumed > 0, '鱼群应实际食用颗粒');
  assert.equal(system.snapshot.fishCount, 23);
  for (const item of system.ponds) {
    for (const fish of item.fish) {
      for (const name of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'stroke']) assert(Number.isFinite(fish[name]), `鱼状态非有限 ${name}`);
      assert(fish.y > item.bottomY && fish.y < item.waterY, '鱼保持在水体内部');
    }
    for (const pellet of item.pellets) {
      for (const name of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert(Number.isFinite(pellet[name]), `食粒状态非有限 ${name}`);
      assert(pellet.mesh.quaternion.toArray().every(Number.isFinite));
    }
  }
  runs.push({ fps, system, pond, hits });
}
const reference = runs[0];
for (const run of runs.slice(1)) {
  for (let p = 0; p < reference.system.ponds.length; p++) {
    const source = reference.system.ponds[p], candidate = run.system.ponds[p];
    assert.equal(source.consumed, candidate.consumed);
    assert.equal(source.disturbanceCount, candidate.disturbanceCount);
    source.fish.forEach((fish, i) => {
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'stroke']) near(candidate.fish[i][key], fish[key], 1e-10, `跨帧率鱼 ${key}`);
    });
    source.pellets.forEach((pellet, i) => {
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'age']) near(candidate.pellets[i][key], pellet[key], 1e-10, `跨帧率食粒 ${key}`);
      assert.equal(candidate.pellets[i].alive, pellet.alive);
    });
  }
}
const slow = fixture().system;
slow.update(1, { wind: { x: NaN, y: Infinity }, daylight: NaN });
assert.equal(slow.snapshot.physicalSteps, 8, '长帧只做有限小步，不能一次大积分');
near(slow.snapshot.droppedTime, 0.93, 1e-9);
const steps = slow.snapshot.physicalSteps;
slow.update(-1);
slow.update(NaN);
assert.equal(slow.snapshot.physicalSteps, steps, '无效时长不能推进物理');
console.log(JSON.stringify({ fallingY: fallingPellet.y, analyticFallY: fallExpected, settledY: floatPellet.y, fixedStep: 1 / 120, fps: runs.map(run => ({ fps: run.fps, consumed: run.pond.consumed, disturbances: run.hits.length, physicalSteps: run.system.snapshot.physicalSteps })), frameRateAgreement: true, finite: true, suspendedFrameSteps: slow.snapshot.physicalSteps }, null, 2));
