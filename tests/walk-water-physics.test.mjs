import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWalkWorld } from '../src/walk-world.js';
import { createWalkController } from '../src/walk.js';
import { pondDistance } from '../src/pond-shape.js';
import { createKit } from '../src/kit.js';
import { createTown } from '../src/town.js';
import { createStation } from '../src/station.js';
import { createShops } from '../src/shops.js';
import { createDailyShops } from '../src/daily-shops.js';

// 以真实碰撞索引和实际输入事件验收物理，不依赖浏览器的帧率。
class Surface extends EventTarget {
  style = {};
  hasPointerCapture() { return false; }
  setPointerCapture() {}
  releasePointerCapture() {}
}
function fixture(roots = []) {
  const input = new Surface(), doc = new Surface(), element = new Surface();
  input.matchMedia = () => ({ matches: false });
  doc.querySelector = () => null;
  doc.pointerLockElement = null;
  globalThis.window = input;
  globalThis.document = doc;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 350);
  camera.position.set(15, 12, 25);
  const orbit = { target: new THREE.Vector3(), enabled: true, update() {} };
  const world = createWalkWorld(THREE, roots);
  const walk = createWalkController({ THREE, camera, orbit, element, world, reducedMotion: true });
  function key(type, code) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'code', { value: code });
    Object.defineProperty(event, 'key', { value: code });
    input.dispatchEvent(event);
  }
  walk.enter();
  return { walk, world, camera, orbit, key, input };
}
function tick(walk, seconds, fps = 120) {
  let peak = -Infinity;
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    walk.update(1 / fps);
    peak = Math.max(peak, walk.position.y);
  }
  return peak;
}
function box(parent, x, y, z, w, h, d, name) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  object.position.set(x, y, z);
  object.name = name;
  parent.add(object);
  return object;
}
const jumpRuns = [];
for (const fps of [30, 60, 120]) {
  const test = fixture();
  test.key('keydown', 'Space');
  test.key('keyup', 'Space');
  const peak = tick(test.walk, 2, fps);
  assert(Math.abs(peak - (0.07 + 4.6 ** 2 / (2 * 9.81))) < 0.006, '跳跃高度符合重力和初速度');
  assert.equal(test.walk.waterState.grounded, true, '跳跃后应真实落地');
  assert(Math.abs(test.walk.position.y - 0.07) < 1e-9);
  assert.equal(test.walk.snapshot.physicalSteps, 240);
  test.key('keydown', 'KeyW');
  tick(test.walk, 1, fps);
  test.key('keyup', 'KeyW');
  jumpRuns.push({ fps, peak, position: test.walk.position.toArray(), steps: test.walk.snapshot.physicalSteps });
}
for (const run of jumpRuns.slice(1)) assert.deepEqual(run.position, jumpRuns[0].position, '陆地轨迹与 FPS 无关');

const indoor = new THREE.Group();
box(indoor, -4, 2.3, 23, 5, 0.2, 5, '低天花板');
box(indoor, 2, 1.5, 0, 0.2, 3, 5, '实墙');
box(indoor, 9, 18.02, 0, 5, 0.1, 5, '高处展望平台');
const collision = fixture([indoor]);
collision.key('keydown', 'Space');
collision.key('keyup', 'Space');
const ceilingPeak = tick(collision.walk, 2);
assert(ceilingPeak < 0.51 && ceilingPeak > 0.48, '头部撞到天花板后停止上升');
const wallStop = collision.world.moveBody(new THREE.Vector3(0, 0.07, 0), 4, 0);
assert(wallStop.x < 1.73 && wallStop.x > 1.6, '实墙仍阻挡身体');
collision.walk.setPosition([9, 18.07, 0]);
collision.key('keydown', 'Space');
collision.key('keyup', 'Space');
assert(tick(collision.walk, 2) > 19, '高平台上也可跳跃');
assert(Math.abs(collision.walk.position.y - 18.07) < 1e-7, '跳跃后落回高平台');

const elevator = new THREE.Group();
const cabin = new THREE.Group();
cabin.position.x = 20;
cabin.userData.dynamic = true;
cabin.userData.walkCollision = false;
elevator.add(cabin);
const liftFloor = box(cabin, 0, 0.02, 0, 2.5, 0.14, 2.5, '舱底运动踏面');
liftFloor.userData.walkSurface = true;
const lift = fixture([elevator]);
lift.walk.setPosition([20, 0.09, 0]);
lift.walk.setMotionEnabled(false);
for (let i = 0; i < 120; i++) {
  cabin.position.y = (i + 1) / 120 * 17.8;
  lift.walk.setPosition([20, cabin.position.y + 0.09, 0]);
  lift.walk.update(1 / 120);
}
lift.walk.setMotionEnabled(true);
tick(lift.walk, 1);
assert(Math.abs(lift.walk.position.y - 17.89) < 1e-9, '舱门开启后重力仍由运动舱底支撑');
assert.equal(lift.world.stats.dynamicSurfaces, 1);

const lake = { id: 'lake', x: 100, z: -4, width: 68, depth: 54, cornerRadius: 24, waterY: 0.12, bottomY: -9.5 };
const waterHits = [];
const waterDriver = {
  sampleWater(x, z) {
    const shoreDistance = pondDistance(x, z, lake);
    if (shoreDistance > 0) return null;
    const inward = Math.max(0, -shoreDistance);
    const bottomY = THREE.MathUtils.lerp(0.12, -9.5, Math.min(1, inward / 5));
    return { ...lake, height: 0.12, bottomY, shoreDistance, u: 0.5 + (x - lake.x) / lake.width, v: 0.5 + (z - lake.z) / lake.depth, slopeX: 0, slopeZ: 0 };
  },
  bottomAt(x, z) { return this.sampleWater(x, z)?.bottomY ?? null; },
  disturb(...hit) { waterHits.push(hit); },
};
const swimRuns = [];
for (const fps of [30, 60, 120]) {
  const swim = fixture();
  swim.walk.setWaterDriver(waterDriver);
  swim.walk.setPosition([100, -0.6, -4], { yaw: Math.PI / 2, pitch: 0 });
  tick(swim.walk, 3, fps);
  assert(swim.walk.waterState.swimming);
  assert(Math.abs(swim.camera.position.y - 0.34) < 0.008, '浮泳眼睛在真实水位上方约22厘米');
  assert(swim.walk.position.y > -9.5, '脚底不会穿过池底');
  swim.key('keydown', 'KeyC');
  tick(swim.walk, 3, fps);
  swim.key('keyup', 'KeyC');
  tick(swim.walk, 2, fps);
  const diveY = swim.walk.position.y;
  assert(swim.walk.waterState.submerged && diveY < -3.5, 'C可潜到湖中水下');
  tick(swim.walk, 2, fps);
  assert(Math.abs(swim.walk.position.y - diveY) < 0.0001, '潜水松键后保持自由深度');
  swim.key('keydown', 'KeyW');
  swim.walk.setPosition(swim.walk.position, { yaw: 0, pitch: -0.5 });
  tick(swim.walk, 1, fps);
  swim.key('keyup', 'KeyW');
  assert(swim.walk.position.y < diveY - 0.35, '向下看时前游随视线下潜');
  swim.key('keydown', 'Space');
  tick(swim.walk, 6, fps);
  swim.key('keyup', 'Space');
  tick(swim.walk, 2, fps);
  assert(!swim.walk.waterState.submerged, 'Space上浮回水面');
  assert(Math.abs(swim.camera.position.y - 0.34) < 0.015, '持续上浮不把泳者推出水面悬浮');
  swim.walk.setPosition([68, -0.34, -4], { yaw: Math.PI / 2, pitch: 0 });
  swim.key('keydown', 'KeyW');
  tick(swim.walk, 4, fps);
  swim.key('keyup', 'KeyW');
  tick(swim.walk, 1, fps);
  assert(swim.walk.position.x < 66, '沿实际缓坡走上湖岸');
  assert(!swim.walk.waterState.inWater && !swim.walk.waterState.swimming, '出水恢复陆地模式');
  assert(Math.abs(swim.walk.waterState.eyeHeight - 1.65) < 0.005, '出水平滑恢复站姿');
  for (const value of [...swim.walk.snapshot.position, ...swim.walk.snapshot.velocity]) assert(Number.isFinite(value));
  swimRuns.push({ fps, position: swim.walk.position.toArray(), diveY, steps: swim.walk.snapshot.physicalSteps });
}
for (const run of swimRuns.slice(1)) {
  assert.deepEqual(run.position, swimRuns[0].position, '水中和出岸轨迹与FPS无关');
  assert.equal(run.diveY, swimRuns[0].diveY);
}
assert(waterHits.length > 0, '玩家入水与游动驱动真实水面扰动');
const paused = fixture();
paused.key('keydown', 'Space');
paused.walk.setPaused(true);
tick(paused.walk, 1);
assert.equal(paused.walk.position.y, 0.07, '暂停释放排队跳跃');
paused.walk.setPaused(false);
paused.key('keydown', 'KeyW');
paused.input.dispatchEvent(new Event('blur'));
const stop = paused.walk.position.toArray();
tick(paused.walk, 1);
assert.deepEqual(paused.walk.position.toArray(), stop, '失焦释放运动输入');
// 用已有建筑实体检查重力改动没有堵住楼梯、门洞和检票通道。
globalThis.document.createElement = () => ({ width: 1, height: 1, getContext() { return { fillRect() {}, strokeRect() {}, fillText() {}, measureText(text) { return { width: text.length * 90 }; } }; } });
const kit = createKit();
const town = createTown(kit), station = createStation(kit), shops = createShops(kit), daily = createDailyShops(kit);
const real = fixture([town, station.group, shops.group, daily.group]);
function follow(route, label) {
  real.walk.setPosition(route[0]);
  for (const target of route.slice(1)) {
    const p = real.walk.position;
    real.walk.setPosition(p, { yaw: Math.atan2(-(target[0] - p.x), -(target[2] - p.z)), pitch: 0 });
    real.key('keydown', 'KeyW');
    let distance = Infinity;
    for (let step = 0; step < 1000; step++) {
      real.walk.update(1 / 120);
      const next = real.walk.position;
      distance = Math.hypot(next.x - target[0], next.z - target[2]);
      if (distance < 0.045) break;
    }
    real.key('keyup', 'KeyW');
    assert(distance < 0.05, `${label} 通行失败：${JSON.stringify(real.walk.position.toArray())} -> ${JSON.stringify(target)} ${JSON.stringify(real.world.stats.lastCollision)}`);
  }
  tick(real.walk, 0.3);
  return real.walk.position.toArray();
}
const stationRoutes = [
  follow([[4.125, 0.07, -3], [4.125, 0.905, -12.5]], '第一检票通道'),
  follow([[5.575, 0.07, -3], [5.575, 0.845, -12.5]], '第二检票通道'),
];
assert(stationRoutes.every(p => p[1] > 0.8));
const buildingRoutes = [...town.userData.enterableBuildings.filter(building => building.upper).slice(0, 3), ...(shops.group.userData.enterableBuildings ?? []).filter(building => building.upper)];
const stairs = buildingRoutes.map(building => {
  const end = follow(building.route, building.name);
  const returned = follow([...building.route].reverse(), `${building.name}下楼`);
  return { id: building.id, end, returned };
});
assert(stairs.length >= 4, '验收住宅和商店两种真实二层楼梯');
console.log(JSON.stringify({ jumpRuns, ceilingPeak, wallStop: wallStop.toArray(), elevatorHeight: lift.walk.position.y, swimRuns, waterDisturbances: waterHits.length, stationRoutes, stairs, finite: true, passed: true }, null, 2));
