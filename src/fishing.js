// 钓竿不锁住行动：抛线、咬钩和收线都依附真实水面，离开岸边即可收竿。
export function createFishing({ THREE, kit, scene, camera, walk, water, toast = () => {}, spots = [] }) {
  const locations = (spots.length ? spots : [
    { id: 'sakurami-west', name: '桜見湖・木桟橋', position: [74.2, .44, 8], castTarget: [81, .12, 8] },
    { id: 'sakurami-shore', name: '桜見湖・浅瀬', position: [65.7, .07, -1], castTarget: [75, .12, -1] },
  ]).map(spot => ({ ...spot, position: new THREE.Vector3(...(spot.position?.isVector3 ? spot.position.toArray() : spot.position)),
    castTarget: new THREE.Vector3(...(spot.castTarget?.isVector3 ? spot.castTarget.toArray() : spot.castTarget)) }));
  const group = new THREE.Group();
  group.name = '湖畔的钓竿、浮漂与钓获';
  group.userData.dynamic = true;
  group.userData.walkCollision = false;
  const panel = document.querySelector('#fishing-status');
  const phaseText = document.querySelector('#fishing-phase');
  const hint = document.querySelector('#fishing-hint');
  const countText = document.querySelector('#fishing-count');
  const meters = document.querySelector('#fishing-meters');
  const progressBar = document.querySelector('#fishing-progress');
  const tensionBar = document.querySelector('#fishing-tension');
  const reelButton = document.querySelector('#fishing-reel');
  const cancelButton = document.querySelector('#fishing-cancel');
  const experience = document.querySelector('#experience');
  const pointerIds = new Set();
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const tip = new THREE.Vector3(), origin = new THREE.Vector3(), floatPosition = new THREE.Vector3(), floatVelocity = new THREE.Vector3();
  const castOrigin = new THREE.Vector3(), fishPosition = new THREE.Vector3(), anchor = new THREE.Vector3();
  const temp = new THREE.Vector3();
  let phase = 'idle', phaseTime = 0, time = 0, waitDuration = 5, activeSpot = null, held = false;
  let tension = 0, strain = 0, slackTime = 0, fishDistance = 0, initialDistance = 0, lineLength = 0;
  let castCount = 0, catchCount = 0, biteCount = 0, escapedCount = 0, disturbanceTimer = 0, uiTime = 0;
  let currentFish = null, lastHint = '', resultTime = 0;

  function mesh(parent, geometry, color) {
    const material = kit?.mat?.(color) ?? new THREE.MeshStandardMaterial({ color, roughness: .7 });
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = false; object.receiveShadow = true;
    object.userData.walkCollision = false;
    parent.add(object);
    return object;
  }
  function segment(parent, a, b, radius, color) {
    const delta = new THREE.Vector3().subVectors(b, a);
    const object = mesh(parent, new THREE.CylinderGeometry(radius * .7, radius, delta.length(), 8), color);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  }
  const rod = new THREE.Group();
  const localTip = new THREE.Vector3(-.04, .73, -1.30);
  rod.name = '墨绿钓竿'; group.add(rod);
  segment(rod, new THREE.Vector3(0, -.1, .12), new THREE.Vector3(0, .17, -.23), .027, '#a58c66');
  segment(rod, new THREE.Vector3(0, .08, -.10), localTip, .013, '#3d655d');
  const reel = mesh(rod, new THREE.CylinderGeometry(.046, .046, .045, 10), '#adb9a9');
  reel.rotation.z = Math.PI / 2; reel.position.set(.041, .06, -.07);
  for (let i = 1; i < 6; i++) {
    const ring = mesh(rod, new THREE.TorusGeometry(.019 - i * .0018, .0023, 4, 9), '#b8bfaa');
    ring.position.lerpVectors(new THREE.Vector3(0, .08, -.10), localTip, i / 6);
    ring.position.x += .016; ring.rotation.x = -.6;
  }
  const floatGroup = new THREE.Group();
  floatGroup.name = '随波起伏的浮漂'; group.add(floatGroup);
  const body = mesh(floatGroup, new THREE.SphereGeometry(1, 12, 9), '#efe6bf');
  body.scale.set(.026, .06, .026);
  segment(floatGroup, new THREE.Vector3(0, .025, 0), new THREE.Vector3(0, .145, 0), .004, '#b14f4b');
  segment(floatGroup, new THREE.Vector3(0, -.09, 0), new THREE.Vector3(0, -.025, 0), .003, '#7e8976');
  const lineGeometry = new THREE.BufferGeometry();
  const lineVertices = new Float32Array(31 * 3);
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#ddd5b9', transparent: true, opacity: .78 }));
  line.name = '受张力拉直的钓线'; line.frustumCulled = false; group.add(line);

  const trophy = new THREE.Group();
  trophy.name = '钓获的小鱼'; group.add(trophy);
  const trophyBody = mesh(trophy, new THREE.SphereGeometry(1, 16, 10), '#b8b7a0'); trophyBody.scale.set(.20, .075, .055);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(.13, .08); finShape.lineTo(.10, -.075); finShape.closePath();
  const tail = mesh(trophy, new THREE.ShapeGeometry(finShape), '#a88c71'); tail.position.x = .17;
  tail.material = tail.material.clone(); tail.material.side = THREE.DoubleSide;
  const eye = mesh(trophy, new THREE.SphereGeometry(.008, 8, 6), '#3e4647'); eye.position.set(-.13, .025, .048);
  const otherEye = mesh(trophy, new THREE.SphereGeometry(.008, 8, 6), '#3e4647'); otherEye.position.set(-.13, .025, -.048);
  rod.visible = floatGroup.visible = line.visible = trophy.visible = false;

  function setHint(text) {
    if (text === lastHint) return;
    lastHint = text;
    if (hint) hint.textContent = text;
  }
  function setPhase(next, message) {
    phase = next; phaseTime = 0;
    const active = phase !== 'idle';
    group.visible = active;
    if (panel) panel.hidden = !active;
    if (experience) experience.dataset.fishing = active ? 'active' : 'idle';
    const labels = { idle: '湖畔垂钓', casting: '把线抛向湖心', waiting: '等浮漂轻轻一动', bite: '鱼咬钩了', fighting: '慢慢把鱼带回来', caught: '湖里来的一位客人' };
    if (phaseText) phaseText.textContent = labels[phase];
    if (meters) meters.hidden = phase !== 'fighting';
    if (reelButton) { reelButton.disabled = phase === 'casting'; reelButton.textContent = phase === 'bite' ? '抬竿' : phase === 'fighting' ? '按住收线 · 松手放松' : phase === 'caught' ? '放回湖里' : '收竿'; }
    if (cancelButton) cancelButton.textContent = phase === 'caught' ? '继续散步' : '结束垂钓';
    rod.visible = active; floatGroup.visible = line.visible = active && phase !== 'caught'; trophy.visible = ['waiting', 'bite', 'fighting', 'caught'].includes(phase);
    trophy.scale.setScalar(phase === 'caught' && currentFish ? currentFish.length / 50 : .60);
    setHint(message ?? '');
  }
  function ripple(strength = -.0025, radius = .10) {
    const sample = water.sampleWater(floatPosition.x, floatPosition.z);
    if (sample) water.disturb(sample.id, sample.u, sample.v, strength, radius);
  }
  function cancel(message = '') {
    if (phase === 'idle') return false;
    held = false; pointerIds.clear(); tension = strain = slackTime = 0;
    setPhase('idle'); activeSpot = null;
    if (message) toast(message);
    return true;
  }
  function release() {
    if (phase !== 'caught') return cancel();
    cancel(); toast('小鱼回到湖里，留下一圈涟漪。');
    return true;
  }
  function start(spot) {
    if (!walk.active || !spot || phase !== 'idle') return false;
    const sample = water.sampleWater(spot.castTarget.x, spot.castTarget.z);
    if (!sample) { toast('先找一处开阔的水面。'); return false; }
    activeSpot = spot; anchor.copy(spot.castTarget); anchor.y = sample.height;
    castCount++; held = false; strain = tension = slackTime = 0; disturbanceTimer = 0;
    updateRod();
    castOrigin.copy(tip);
    floatPosition.copy(castOrigin);
    const flight = 1.18;
    floatVelocity.subVectors(anchor, castOrigin).divideScalar(flight);
    floatVelocity.y += .5 * 9.81 * flight;
    waitDuration = 4.5 + (castCount * 1.47 % 3.5);
    setPhase('casting', '钓线划过风，落在远一点的水面。');
    return true;
  }
  function hook() {
    if (phase !== 'bite') return false;
    initialDistance = Math.max(2, Math.hypot(floatPosition.x - camera.position.x, floatPosition.z - camera.position.z));
    fishDistance = initialDistance; lineLength = initialDistance; tension = .38; strain = slackTime = 0;
    held = true;
    setPhase('fighting', '按住 E 或收线按钮；张力变高时松手。');
    ripple(-.010, .24);
    return true;
  }
  function reelAction() {
    if (phase === 'bite') return hook();
    if (phase === 'fighting') { held = true; return true; }
    if (phase === 'caught') return release();
    if (phase === 'waiting') return cancel('这一竿先收回来，再试一次。');
    return false;
  }
  function setReeling(value) { held = Boolean(value) && phase === 'fighting'; }
  function landed() {
    held = false;
    catchCount++;
    currentFish = { species: castCount % 2 ? '湖鲫' : '小鲤鱼', length: 18 + castCount * 7 % 15 };
    if (countText) countText.textContent = `钓获 ${catchCount}`;
    setPhase('caught', `${currentFish.species} · ${currentFish.length} 厘米。按 E 或轻触，把它放回湖里。`);
    resultTime = 0;
    ripple(-.004, .22);
  }
  function updateRod() {
    camera.getWorldDirection(forward);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    rod.position.copy(camera.position).addScaledVector(right, .29).addScaledVector(up, -.55).addScaledVector(forward, .28);
    rod.quaternion.copy(camera.quaternion);
    if (phase === 'fighting') rod.rotateX(-.04 - tension * .12);
    rod.updateWorldMatrix(true, false);
    tip.copy(localTip).applyMatrix4(rod.matrixWorld);
  }
  function updateLine() {
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      temp.lerpVectors(tip, floatPosition, t);
      const sag = phase === 'casting' ? .42 : phase === 'fighting' ? .18 * (1 - tension) : .28;
      temp.y -= Math.sin(t * Math.PI) * sag;
      lineVertices[i * 3] = temp.x; lineVertices[i * 3 + 1] = temp.y; lineVertices[i * 3 + 2] = temp.z;
    }
    lineGeometry.attributes.position.needsUpdate = true;
  }
  function updateFish() {
    if (!trophy.visible || phase === 'caught') return;
    const radius = phase === 'waiting' ? Math.max(.12, 1.2 * (1 - phaseTime / waitDuration)) : .04;
    trophy.position.set(floatPosition.x + Math.cos(time * 1.7) * radius, floatPosition.y - (phase === 'waiting' ? .38 : .16), floatPosition.z + Math.sin(time * 1.7) * radius);
    const dx = floatPosition.x - trophy.position.x, dz = floatPosition.z - trophy.position.z;
    trophy.rotation.set(0, Math.atan2(-dz, -dx), phase === 'bite' ? -.2 : Math.sin(time * 4) * .03);
    tail.rotation.y = Math.sin(time * (phase === 'fighting' ? 13 : 7)) * .45;
  }
  function stepFloat(dt, climate) {
    const sample = water.sampleWater(floatPosition.x, floatPosition.z);
    if (phase === 'casting') {
      floatVelocity.y -= 9.81 * dt;
      floatPosition.addScaledVector(floatVelocity, dt);
      if (sample && floatPosition.y <= sample.height + .025 && floatVelocity.y < 0) {
        floatPosition.y = sample.height + .025;
        floatVelocity.set(0, -.09, 0);
        anchor.copy(floatPosition);
        ripple(-.007, .17);
        setPhase('waiting', '看看浮漂，鱼正在水下慢慢靠近。');
      } else if (phaseTime > 2.4) cancel('这一竿落在岸边了，往水面再试一次。');
      return;
    }
    if (!sample) { cancel('收起钓线，换一处水面。'); return; }
    // 椭球浮漂按浸入比例计算排水量；水的密度、重力和阻尼决定起伏。
    const mass = .036, volume = 4 / 3 * Math.PI * .026 * .06 * .026;
    const submerged = THREE.MathUtils.clamp((sample.height - floatPosition.y + .06) / .12, 0, 1);
    let acceleration = 9.81 * (1000 * volume * submerged / mass - 1) - floatVelocity.y * 9;
    if (phase === 'bite') acceleration -= 22 + 12 * Math.sin(phaseTime * 16);
    if (phase === 'fighting') acceleration -= 2.6 + tension * 6;
    floatVelocity.y = THREE.MathUtils.clamp(floatVelocity.y + acceleration * dt, -.7, .7);
    floatPosition.y += floatVelocity.y * dt;
    if (phase === 'waiting' || phase === 'bite') {
      const wind = climate?.wind ?? [0, 0];
      const windX = Array.isArray(wind) ? wind[0] : wind.x;
      const windZ = Array.isArray(wind) ? wind[1] : wind.y;
      floatVelocity.x += ((anchor.x - floatPosition.x) * 2 + windX * .018 - floatVelocity.x * 2.8) * dt;
      floatVelocity.z += ((anchor.z - floatPosition.z) * 2 + windZ * .018 - floatVelocity.z * 2.8) * dt;
      floatPosition.x += floatVelocity.x * dt; floatPosition.z += floatVelocity.z * dt;
    }
    floatGroup.position.copy(floatPosition);
    floatGroup.rotation.set(sample.slopeZ * .8, 0, -sample.slopeX * .8);
  }
  function fight(dt) {
    const surge = Math.pow(Math.max(0, Math.sin(phaseTime * 1.75 + .4)), 2);
    const target = held ? .48 + surge * .74 : .16 + surge * .32;
    tension += (target - tension) * (1 - Math.exp(-5 * dt));
    strain = Math.max(0, strain + (tension > .86 ? (tension - .86) * 11 * dt : -.65 * dt));
    slackTime = held ? Math.max(0, slackTime - dt * 2) : slackTime + dt;
    fishDistance += held ? -(0.73 - surge * .42) * dt : (.10 + surge * .18) * dt;
    lineLength = Math.max(.75, fishDistance - tension * .10);
    temp.subVectors(anchor, camera.position); temp.y = 0; temp.normalize();
    const sway = Math.sin(phaseTime * 2.4) * (.18 + surge * .24);
    floatPosition.x = camera.position.x + temp.x * fishDistance + temp.z * sway;
    floatPosition.z = camera.position.z + temp.z * fishDistance - temp.x * sway;
    fishPosition.copy(floatPosition); fishPosition.y -= .12;
    if (tension > .83) setHint('鱼在挣扎，松手让钓线放松一点。');
    else setHint('按住 E 或收线按钮，慢慢收线。');
    if (strain > 1.0 || slackTime > 8 || phaseTime > 42) {
      escapedCount++; cancel(strain > 1 ? '钓线太紧，鱼挣脱了。下次收线时多松一会儿。' : '鱼回到了深水里。稍后再试一竿。');
    } else if (fishDistance < .86) landed();
  }
  function update(dt, climate = {}) {
    dt = Math.min(.12, Math.max(0, Number.isFinite(dt) ? dt : 0));
    time += dt;
    if (phase === 'idle') return;
    if (!walk.active) { cancel(); return; }
    if (walk.motionEnabled === false || document.querySelector('#inspection')?.open) { cancel('钓竿已经收好。'); return; }
    const feet = walk.position;
    const nearbyWater = water.sampleWater(feet.x, feet.z);
    if (nearbyWater && feet.y < nearbyWater.waterY - .18) { cancel('先把钓竿收好，再去水里看看。'); return; }
    if (Math.hypot(feet.x - activeSpot.position.x, feet.z - activeSpot.position.z) > 4.1) { cancel('离开码头前，已经替你收好钓竿。'); return; }
    phaseTime += dt; updateRod();
    if (phase === 'caught') {
      resultTime += dt;
      trophy.position.copy(camera.position).addScaledVector(forward, .95).addScaledVector(up, .08);
      trophy.quaternion.copy(camera.quaternion);
      trophy.rotateY(Math.sin(time * 2) * .06);
      if (resultTime > 30) release();
      return;
    }
    if (phase === 'fighting') fight(dt);
    if (phase === 'idle' || phase === 'caught') return;
    const substeps = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < substeps && phase !== 'idle'; i++) stepFloat(dt / substeps, climate);
    if (phase === 'idle') return;
    floatGroup.position.copy(floatPosition);
    if (phase === 'waiting' && phaseTime > waitDuration) { biteCount++; setPhase('bite', '浮漂沉下去了！现在按 E 或轻触抬竿。'); ripple(-.006, .16); }
    else if (phase === 'bite' && phaseTime > 2.7) { escapedCount++; held = false; waitDuration = 4.5; setPhase('waiting', '鱼试探了一口。再耐心等一会儿。'); }
    disturbanceTimer -= dt;
    if ((phase === 'bite' || phase === 'fighting') && disturbanceTimer <= 0) { ripple(-.003 - tension * .003, .12); disturbanceTimer = .25; }
    updateLine();
    updateFish();
    uiTime -= dt;
    if (phase === 'fighting' && uiTime <= 0) {
      if (progressBar) progressBar.style.width = `${THREE.MathUtils.clamp((initialDistance - fishDistance) / (initialDistance - .86), 0, 1) * 100}%`;
      if (tensionBar) { tensionBar.style.width = `${THREE.MathUtils.clamp(tension, 0, 1) * 100}%`; tensionBar.style.background = tension > .83 ? '#b56f6f' : '#a68678'; }
      uiTime = .08;
    }
  }

  const items = locations.map(spot => ({ id: `fishing-${spot.id}`, label: '在湖边钓一会儿鱼', position: spot.position.clone().add(new THREE.Vector3(0, .9, 0)), radius: 3,
    enabled: () => phase === 'idle' && walk.active && !document.querySelector('#inspection')?.open,
    action: () => start(spot) }));
  group.userData.interactions = items;
  function inputAllowed(event) { return !event.target.closest?.('input,textarea,select,[contenteditable="true"]') && !document.querySelector('#inspection')?.open; }
  window.addEventListener('keydown', event => {
    if (phase === 'idle' || !walk.active || !inputAllowed(event)) return;
    if (event.code === 'KeyE') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) reelAction();
    } else if (event.key === 'Escape') cancel();
  }, true);
  window.addEventListener('keyup', event => { if (event.code === 'KeyE') held = false; });
  window.addEventListener('blur', () => { held = false; pointerIds.clear(); });
  document.addEventListener('visibilitychange', () => { held = false; pointerIds.clear(); });
  reelButton?.addEventListener('pointerdown', event => {
    if (phase === 'idle' || phase === 'casting') return;
    event.preventDefault(); pointerIds.add(event.pointerId); reelButton.setPointerCapture(event.pointerId);
    reelAction();
  });
  const stopHolding = event => {
    pointerIds.delete(event.pointerId); held = false;
    if (reelButton?.hasPointerCapture(event.pointerId)) reelButton.releasePointerCapture(event.pointerId);
  };
  reelButton?.addEventListener('pointerup', stopHolding);
  reelButton?.addEventListener('pointercancel', stopHolding);
  reelButton?.addEventListener('click', event => { if (event.detail === 0) { reelAction(); held = false; } });
  cancelButton?.addEventListener('click', () => phase === 'caught' ? release() : cancel('钓竿收好了，继续沿着湖边散步。'));
  group.visible = false;
  return { group, items, update, start: id => start(locations.find(spot => spot.id === id) ?? locations[0]), reel: reelAction, setReeling, release, cancel,
    get snapshot() { return { phase, phaseTime, castCount, catchCount, biteCount, escapedCount, held, tension, strain, slackTime,
      fishDistance, lineLength, progress: initialDistance > 0 ? THREE.MathUtils.clamp((initialDistance - fishDistance) / (initialDistance - .86), 0, 1) : 0,
      spot: activeSpot?.id ?? null, floatPosition: floatPosition.toArray(), floatVelocity: floatVelocity.toArray(), fish: currentFish,
      gravity: 9.81, floatMass: .036, waterDensity: 1000 };
    },
  };
}
