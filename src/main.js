import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createKit, optimizeStaticGroup } from './kit.js';
import { createStreet } from './street.js';
import { createTown } from './town.js';
import { createStation } from './station.js';
import { createNature } from './nature.js';
import { createShops } from './shops.js';
import { createDailyShops } from './daily-shops.js';
import { createAlleys } from './alleys.js';
import { createAmbientSound } from './audio.js';
import { createWalkWorld } from './walk-world.js';
import { createWalkController } from './walk.js';
import { createInteractions } from './interactions.js';
import { createTower } from './tower.js';
import { createStreetInteractions } from './street-interactions.js';
import { createEnvironment } from './environment.js';
import { createWeatherEffects } from './weather-effects.js';
import { createPonds, POND_LAYOUT } from './ponds.js';
import { createWaterRenderer } from './water-renderer.js';
import { createLake, LAKE_LAYOUT } from './lake.js';
import { prepareWaterBeds, createWaterWorld } from './water-world.js';
import { createUnderwater } from './underwater.js';
import { createFishing } from './fishing.js';
import './style.css';

const container = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d4e4dc', 65, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, .1, 350);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.minDistance = 4.5;
controls.maxDistance = 190;
controls.minPolarAngle = .42;
controls.maxPolarAngle = Math.PI / 2 - .065;
controls.maxTargetRadius = 160;
controls.screenSpacePanning = false;
controls.target.set(0, 2, -3);

const views = {
  street: { position: [40, 27, 52], target: [1.5, 4.5, -4.5] },
  station: { position: [23, 13, 13], target: [5, 2.4, -10] },
  crossing: { position: [-1, 12, 11], target: [-21, 2, -15] },
  shops: { position: [-.5, 7.5, 35], target: [-4.5, 2.4, 17.3] },
  daily: { position: [-6, 4.8, 14], target: [4.5, 1.7, 6.8] },
  counter: { position: [4.125, 2, -1.6], target: [4.125, 1.4, -9.3] },
  tower: { position: [44, 25, 28], target: [27, 10, 3] },
  ponds: { position: [-21, 7.5, 31], target: [-29, -0.2, 23] },
  lake: { position: [72, 13, 32], target: [100, -1.2, -4] },
};
function initialView() {
  const mobile = container.clientWidth < 600;
  return mobile ? { position: [46, 36, 65], target: [7, 7, -4] } : views.street;
}
const initial = initialView();
camera.position.set(...initial.position);
controls.target.set(...initial.target);
controls.update();

const hemisphere = new THREE.HemisphereLight('#b6bcf2', '#c8bdcf', 1.35);
scene.add(hemisphere);
const ambient = new THREE.AmbientLight('#b0a1cb', .28);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffe1b5', 2.45);
sun.position.set(-26, 42, 30);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48; sun.shadow.camera.right = 48;
sun.shadow.camera.top = 44; sun.shadow.camera.bottom = -44;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 130;
sun.shadow.normalBias = .035;
sun.shadow.bias = -.00015;
// 固定方向的小范围过滤让阴影以干净色块为主，边缘略有柔和过渡。
sun.shadow.radius = 1.25;
scene.add(sun, sun.target);

const kit = createKit();
// 屏幕空间渐变天空也参与截图，保存的 PNG 保留完整的春日背景。
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { upperColor: { value: new THREE.Color('#b7dce8') }, lowerColor: { value: new THREE.Color('#f3e8ce') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform vec3 upperColor; uniform vec3 lowerColor;
    void main(){
      gl_FragColor = vec4(mix(lowerColor, upperColor, smoothstep(0.05, 1.0, vUv.y)), 1.0);
      #include <colorspace_fragment>
    }`,
  depthWrite: false, depthTest: false,
}));
sky.frustumCulled = false;
sky.renderOrder = -1000;
scene.add(sky);
const waterLayout = [...POND_LAYOUT, ...LAKE_LAYOUT];
const street = createStreet(kit, waterLayout);
const town = createTown(kit);
const station = createStation(kit);
const nature = createNature(kit);
const shops = createShops(kit);
const dailyShops = createDailyShops(kit);
const alleys = createAlleys(kit);
const tower = createTower(kit);
const streetLife = createStreetInteractions(kit);
const pondSystem = createPonds(kit);
const lakeSystem = createLake(kit);
views.lake = lakeSystem.view;
const scenery = new THREE.Group();
scenery.name = '桜坂小镇';
scene.add(scenery);
const worldRoots = [street, town, station.group, nature.group, shops.group, dailyShops.group, alleys, tower.group, streetLife.group, pondSystem.group, lakeSystem.group];
scenery.add(...worldRoots);
const waterBodies = [...pondSystem.ponds, ...lakeSystem.ponds];
prepareWaterBeds(THREE, waterBodies);
let pondWater;
const weatherEffects = createWeatherEffects({ kit, roots: worldRoots, camera, waterSurfaces: waterLayout,
  onWaterImpact(pond, x, z, speed) {
    pondWater?.disturb(pond.id, (x - pond.x) / pond.width + .5, (z - pond.z) / pond.depth + .5, -Math.min(.006, speed * .0004), .085);
  },
});
scene.add(weatherEffects.group);
pondWater = createWaterRenderer({ THREE, renderer, scene, camera, sky, ponds: waterBodies, weatherEffects });
const waterWorld = createWaterWorld({ waters: waterBodies, renderer: pondWater });
pondSystem.setWaterDriver(pondWater);
lakeSystem.setWaterDriver(pondWater);
// 离屏镜像使用它自己的天空视线，天空颜色仍共享同一套昼夜状态。
sky.onBeforeRender = (_renderer, _scene, viewCamera) => {
  if (!sky.material.uniforms.uCameraWorld) return;
  sky.material.uniforms.uCameraWorld.value = viewCamera.matrixWorld;
  sky.material.uniforms.uInverseProjection.value = viewCamera.userData.skyProjectionInverse ?? viewCamera.projectionMatrixInverse;
};
// 在静态合并之前，从真实墙体、地面与家具生成可步行的碰撞索引。
scenery.updateMatrixWorld(true);
const dynamicRoots = [station.train, ...worldRoots.flatMap(root => root.userData.dynamicRoots ?? [])];
const walkWorld = createWalkWorld(THREE, worldRoots, dynamicRoots);
optimizeStaticGroup(scenery, dynamicRoots);
optimizeStaticGroup(station.train);
// 静态树冠保持实例绘制；飘樱由独立实例矩阵更新。
scene.updateMatrixWorld(true);

const state = { petals: !motionPreference.matches, trainMoving: false, sound: false, walking: false };
nature.setPetalsVisible(state.petals);
const petalsButton = document.querySelector('#petals-button');
petalsButton.classList.toggle('is-on', state.petals);
petalsButton.setAttribute('aria-pressed', String(state.petals));
const sound = createAmbientSound();
let flight = null;
let toastTimer;
function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove('show'), 2700);
}
const walkButton = document.querySelector('#walk-button');
const walk = createWalkController({
  THREE, camera, orbit: controls, element: renderer.domElement, world: walkWorld,
  pad: document.querySelector('#walk-pad'), stick: document.querySelector('#walk-stick'),
  jumpButton: document.querySelector('#jump-button'), diveButton: document.querySelector('#dive-button'),
  reducedMotion: motionPreference.matches,
  onStateChange({ active, locked, touch }) {
    state.walking = active;
    document.querySelector('#experience').dataset.mode = active ? 'walk' : 'overview';
    walkButton.classList.toggle('is-on', active);
    walkButton.setAttribute('aria-pressed', String(active));
    walkButton.setAttribute('title', active ? '返回俯瞰视角' : '进入第一人称漫步');
    walkButton.querySelector('span').textContent = active ? '俯瞰' : '漫步';
    document.querySelector('#walk-instructions').textContent = touch
      ? '摇杆移动 · 拖动环顾 · 跳跃 / 上浮 · 下潜 · 轻触互动'
      : locked ? 'WASD 移动 · 鼠标环顾 · 空格跳跃 / 上浮 · C 下潜 · E 互动'
        : 'WASD 移动 · 拖动环顾 · 空格跳跃 / 上浮 · C 下潜 · E 互动';
    if (active) document.querySelector('#scene-note').textContent = '沿着街道，走进四月的午后。';
    else document.querySelector('#scene-note').textContent = '慢一点，听听春天。';
  },
});
walk.setWaterDriver(waterWorld);
const fishing = createFishing({ THREE, kit, scene, camera, walk, water: waterWorld, toast, spots: lakeSystem.fishingSpots });
scenery.add(fishing.group);
worldRoots.push(fishing.group);
const underwater = createUnderwater({ THREE, renderer, scene, camera, walk, water: waterWorld, weatherEffects });
const refreshShadows = () => { renderer.shadowMap.needsUpdate = true; };
const interactions = createInteractions({ THREE, camera, walk, world: walkWorld, roots: worldRoots, toast, refreshShadows, tower });
const environment = createEnvironment({ THREE, kit, scene, renderer, camera, sky, sun, hemisphere, ambient, walk, sound, nature, town, shops, dailyShops, station, effects: weatherEffects, reducedMotion: motionPreference.matches });
function finishActivity() {
  environment.closePanel();
  interactions.close();
  tower.cancelRide(interactions.context);
  fishing.cancel();
}
walkButton.addEventListener('click', () => {
  flight = null;
  if (walk.active) { finishActivity(); walk.exit(); toast('回到小镇的俯瞰视角'); }
  else {
    environment.closePanel();
    const view=document.querySelector('#experience').dataset.view;
    if(view==='lake'){
      const entry=lakeSystem.entry,center=lakeSystem.ponds[0];
      walk.setPosition(entry,{yaw:Math.atan2(-(center.x-entry[0]),-(center.z-entry[2])),pitch:-.06});
    }else if(view==='ponds'){
      const pond=pondSystem.ponds[0];
      walk.setPosition(pond.deckView,{yaw:0,pitch:-.28});
    }
    walk.enter();toast(view==='lake'?'沿浅滩入水，空格上浮，C 下潜':'从这里开始，慢慢走一走');
  }
});
function flyTo(view, name) {
  if (walk.active) { finishActivity(); walk.exit(); }
  document.querySelector('#experience').dataset.view = name;
  if (motionPreference.matches) {
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.update();
  } else {
    flight = { start: performance.now(), from: camera.position.clone(), to: new THREE.Vector3(...view.position), targetFrom: controls.target.clone(), targetTo: new THREE.Vector3(...view.target) };
  }
  document.querySelectorAll('.view-button').forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
controls.addEventListener('start', () => { flight = null; });
document.querySelectorAll('.view-button').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.dataset.view;
    flyTo(views[name], name);
    document.querySelector('#scene-note').textContent = { street: '慢一点，听听春天。', station: '下一站，也有好天气。', crossing: '叮，春天经过了道口。', shops: '咖啡香，和刚出炉的面包。', daily: '买瓶汽水，再向小巷里看一眼。', counter: '穿过检票口，就是樱花与站台。', tower: '在树梢之上，看看这座小镇。', ponds: '涟漪散开，鲤鱼游进春天的倒影。', lake:'走向桜見湖，在水面与水下之间。' }[name];
  });
});
document.querySelector('#reset-button').addEventListener('click', () => {
  if (walk.active) { finishActivity(); walk.reset(); toast('回到站前街道，继续散步'); return; }
  flyTo(initialView(), 'street');
  document.querySelector('#scene-note').textContent = '慢一点，听听春天。';
  toast('回到那条通往车站的街道');
});
petalsButton.addEventListener('click', () => {
  state.petals = !state.petals;
  nature.setPetalsVisible(state.petals);
  petalsButton.classList.toggle('is-on', state.petals);
  petalsButton.setAttribute('aria-pressed', String(state.petals));
  toast(state.petals ? '一阵风，樱花又飘起来了' : '让这一刻安静下来');
});
document.querySelector('#sound-button').addEventListener('click', async event => {
  const button = event.currentTarget;
  try {
    state.sound = await sound.toggle();
    button.classList.toggle('is-on', state.sound);
    button.setAttribute('aria-pressed', String(state.sound));
    toast(state.sound ? '风声和鸟鸣，来自小镇的午后' : '环境音已关闭');
  } catch {
    toast('浏览器暂时无法播放环境音');
  }
});
document.querySelector('#train-button').addEventListener('click', event => {
  state.trainMoving = !state.trainMoving;
  renderer.shadowMap.needsUpdate = true;
  event.currentTarget.classList.toggle('is-on', state.trainMoving);
  event.currentTarget.setAttribute('aria-pressed', String(state.trainMoving));
  event.currentTarget.querySelector('span').textContent = state.trainMoving ? '返回停靠' : '电车出发';
  toast(state.trainMoving ? '电车即将出发，请留意道口' : '电车回到桜坂駅');
});
document.querySelector('#photo-button').addEventListener('click', () => {
  underwater.render();
  renderer.domElement.toBlob(blob => {
    if (!blob) { toast('画面保存失败，请重试'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = '桜坂駅-四月的风.png'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('把这一刻的春天带走了');
  }, 'image/png');
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !walk.active) { flight = null; flyTo(initialView(), 'street'); document.querySelector('#scene-note').textContent = '慢一点，听听春天。'; }
});
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

let lastTime = performance.now();
let elapsed = 0;
let firstFrame = true;
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - lastTime) / 1000, .07);
  lastTime = now;
  if (document.hidden) return;
  elapsed += dt;
  if (flight) {
    const progress = Math.min((now - flight.start) / 1300, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(flight.from, flight.to, eased);
    controls.target.lerpVectors(flight.targetFrom, flight.targetTo, eased);
    if (progress === 1) flight = null;
  }
  if (state.petals) nature.update(elapsed, dt);
  environment.update(dt);
  if (!motionPreference.matches) {
    town.userData.update?.(elapsed, environment.windStrength);
    shops.update(elapsed, environment.windStrength);
  }
  station.update(elapsed, { trainMoving: state.trainMoving });
  streetLife.update(dt);
  tower.update(dt, interactions.context);
  const climate = environment.snapshot;
  pondSystem.update(dt, { ...climate, wind: { x: climate.wind[0], y: climate.wind[1] } });
  lakeSystem.update(dt, climate);
  pondWater.update(dt, climate, sun);
  if (state.trainMoving) renderer.shadowMap.needsUpdate = true;
  if (walk.active) walk.update(dt);
  else controls.update();
  fishing.update(dt, climate);
  underwater.update(dt, climate);
  interactions.update(dt);
  pondWater.render();
  underwater.render();
  if (firstFrame) {
    firstFrame = false;
    window.setTimeout(() => { loading.classList.add('done'); }, 400);
  }
});

// 保留只读诊断，便于核对真实渲染和交互状态。
window.__sakurazaka = {
  THREE, renderer, scene, camera, controls, state, station, shops, town, dailyShops, alleys, nature, walk, walkWorld, tower, interactions, streetLife, environment, weatherEffects, pondSystem, pondWater, waterWorld, lakeSystem, underwater, fishing, street,
  buildings: worldRoots.flatMap(root => root.userData.enterableBuildings ?? []),
  get stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, objects: scene.children.length }; },
};
