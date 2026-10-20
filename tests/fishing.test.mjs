import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFishing } from '../src/fishing.js';

// 用可控水面验证真实状态循环与自动退出，不依赖任何渲染诊断开关。
class Element extends EventTarget {
  hidden = false; textContent = ''; disabled = false; open = false; dataset = {}; style = {};
  hasPointerCapture() { return false; }
  setPointerCapture() {}
  releasePointerCapture() {}
}
const elements = new Map();
globalThis.document = new EventTarget();
document.querySelector = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
globalThis.window = new EventTarget();
const position = new THREE.Vector3(74.2, .44, 8);
const camera = new THREE.PerspectiveCamera(62, 1.6, .055, 240);
camera.position.copy(position).y += 1.65;
camera.lookAt(81, .12, 8);
camera.updateMatrixWorld();
const walk = { active: true, get position() { return position.clone(); } };
const waves = [];
const water = {
  sampleWater(x, z) {
    if (x < 75 || x > 100 || z < 0 || z > 20) return null;
    return { id: 'sakurami', waterY: .12, height: .12, slopeX: 0, slopeZ: 0, bottomY: -3, shoreDistance: -1, u: (x - 75) / 25, v: z / 20, width: 25, depth: 20 };
  },
  disturb(...args) { waves.push(args); },
};
const fishing = createFishing({ THREE, kit: { mat: color => new THREE.MeshToonMaterial({ color }) }, scene: new THREE.Scene(), camera, walk, water });
assert.equal(fishing.items.length, 2);
assert.equal(fishing.start(), true);
assert.equal(fishing.snapshot.phase, 'casting');
let highPoint = -Infinity;
for (let i = 0; i < 180; i++) { fishing.update(1 / 60, { wind: [0, 0] }); highPoint = Math.max(highPoint, fishing.snapshot.floatPosition[1]); }
assert.equal(fishing.snapshot.phase, 'waiting');
assert(highPoint > camera.position.y, '浮漂必须有受重力作用的抛物线。');
assert(fishing.snapshot.floatPosition[1] > .12 && fishing.snapshot.floatPosition[1] < .17, '漂体必须在排水量与重量平衡后漂浮。');
for (let i = 0; i < 480 && fishing.snapshot.phase !== 'bite'; i++) fishing.update(1 / 60, { wind: [0, 0] });
assert.equal(fishing.snapshot.phase, 'bite');
assert.equal(fishing.reel(), true);
assert.equal(fishing.snapshot.phase, 'fighting');
let maxTension = 0;
for (let i = 0; i < 2400 && fishing.snapshot.phase === 'fighting'; i++) {
  fishing.setReeling(fishing.snapshot.tension < .80);
  fishing.update(1 / 60, { wind: [0, 0] });
  maxTension = Math.max(maxTension, fishing.snapshot.tension);
}
assert.equal(fishing.snapshot.phase, 'caught');
assert.equal(fishing.snapshot.catchCount, 1);
assert(maxTension > .7 && waves.length > 30);
assert(fishing.release());
assert.equal(fishing.snapshot.phase, 'idle');
assert(fishing.start());
walk.active = false;
fishing.update(1 / 60);
assert.equal(fishing.snapshot.phase, 'idle');
walk.active = true;
assert(fishing.start());
position.set(78, -1, 8);
fishing.update(1 / 60);
assert.equal(fishing.snapshot.phase, 'idle', '进入湖水必须收竿。');
position.set(74.2, .44, 8);
assert(fishing.start());
position.x -= 5;
fishing.update(1 / 60);
assert.equal(fishing.snapshot.phase, 'idle', '远离钓鱼点必须收竿。');
position.set(74.2, .44, 8);
assert(fishing.start());
for (let i = 0; i < 800 && fishing.snapshot.phase !== 'bite'; i++) fishing.update(1 / 60, { wind: [0, 0] });
assert.equal(fishing.snapshot.phase, 'bite');
fishing.reel();
for (let i = 0; i < 2400 && fishing.snapshot.phase === 'fighting'; i++) { fishing.setReeling(true); fishing.update(1 / 60, { wind: [0, 0] }); }
assert.equal(fishing.snapshot.phase, 'idle', '一直硬拉必须让鱼挣脱，控张力不可只是显示。');
assert(fishing.snapshot.escapedCount > 0);
let invalid = 0;
fishing.group.traverse(object => {
  if (!object.geometry) return;
  for (const attribute of Object.values(object.geometry.attributes)) for (const value of attribute.array) if (!Number.isFinite(value)) invalid++;
});
assert.equal(invalid, 0);
console.log(JSON.stringify({ highPoint, maxTension, waves: waves.length, invalid, ...fishing.snapshot }, null, 2));
