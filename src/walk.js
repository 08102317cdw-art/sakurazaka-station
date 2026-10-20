// 第一人称漫步：键盘、鼠标和触屏共用同一套地面移动与碰撞。
export function createWalkController({ THREE, camera, orbit, element, world, pad, stick, jumpButton, diveButton, reducedMotion = false, onStateChange = () => {}, onWaterMotion = () => {} }) {
  const feet = new THREE.Vector3(-4, 0.07, 23);
  const velocity = new THREE.Vector2();
  const touchAxis = new THREE.Vector2();
  const keys = new Set();
  let eyeHeight = 1.65;
  let bodyHeight = 1.68;
  let verticalVelocity = 0;
  let grounded = true;
  let jumpQueued = false;
  let touchRise = false;
  let touchDive = false;
  let diving = false;
  let swimming = false;
  let waterDriver = null;
  let accumulator = 0;
  let physicalSteps = 0;
  let simulationTime = 0;
  let wakeTimer = 0;
  let lastWaterId = null;
  let lastMode = 'land';
  let currentWater = null;
  const fixedStep = 1 / 120;
  const intent = new THREE.Vector2();
  const waterState = { inWater: false, swimming: false, diving: false, submerged: false, waterId: null, surfaceY: null, depth: 0, grounded: true, verticalVelocity: 0 };
  let active = false;
  let yaw = -0.07;
  let pitch = 0;
  let distance = 0;
  let eyeGround = feet.y;
  let saved = null;
  let lookPointer = null;
  let padPointer = null;
  let dragged = false;
  let motionEnabled = true;
  let uiPaused = false;
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const locked = () => document.pointerLockElement === element;
  const notify = () => onStateChange({ active, locked: locked(), touch: touchDevice, ...waterState });
  jumpButton ??= document.querySelector?.('#jump-button');
  diveButton ??= document.querySelector?.('#dive-button');

  function clearInput() {
    keys.clear();
    velocity.set(0, 0);
    touchAxis.set(0, 0);
    jumpQueued = false;
    touchRise = false;
    touchDive = false;
    padPointer = null;
    lookPointer = null;
    if (stick) stick.style.transform = 'translate(-50%, -50%)';
  }

  function look(dx, dy, sensitivity = 0.0023) {
    yaw -= dx * sensitivity;
    pitch = THREE.MathUtils.clamp(pitch - dy * sensitivity, -1.22, 1.22);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function requestLookLock() {
    if (!active || touchDevice || locked() || !element.requestPointerLock) return;
    try {
      // 内嵌浏览器不支持鼠标锁定时，仍然可以拖动环顾和使用键盘漫步。
      const pending = element.requestPointerLock();
      pending?.catch(() => notify());
    } catch {
      notify();
    }
  }

  function applyCamera(bob = 0) {
    camera.position.set(feet.x, eyeGround + eyeHeight + bob, feet.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function sampleWater() {
    return waterDriver?.sampleWater?.(feet.x, feet.z) ?? world.sampleWater?.(feet.x, feet.z) ?? null;
  }

  function refreshWaterState() {
    currentWater = sampleWater();
    const surface = currentWater?.height;
    const inWater = Number.isFinite(surface) && feet.y < surface - 0.025;
    const bottom = waterDriver?.bottomAt?.(feet.x, feet.z) ?? currentWater?.bottomY;
    const totalDepth = Number.isFinite(bottom) ? Math.max(0, surface - bottom) : 0;
    // 泳姿缩短身体，浅塘也能看见水下；岸边仍按真实池底恢复站姿。
    swimming = Boolean(inWater && totalDepth > 0.75 && (swimming || feet.y < surface - 0.40));
    if (!swimming) diving = false;
    Object.assign(waterState, {
      inWater, swimming, diving,
      submerged: Number.isFinite(surface) && feet.y + eyeHeight < surface - 0.025,
      waterId: currentWater?.id ?? null,
      surfaceY: Number.isFinite(surface) ? surface : null,
      depth: inWater ? Math.max(0, surface - (feet.y + eyeHeight)) : 0,
      grounded, verticalVelocity,
    });
  }

  function disturbWater(strength, radius = 0.22) {
    if (!currentWater || !waterDriver?.disturb) return;
    waterDriver.disturb(currentWater.id, currentWater.u, currentWater.v, strength, radius);
  }

  function enter() {
    if (active) return;
    saved = { position: camera.position.clone(), target: orbit.target.clone(), fov: camera.fov, near: camera.near };
    active = true;
    clearInput();
    orbit.enabled = false;
    const floor = world.groundHeight(feet.x, feet.z, feet.y);
    if (feet.y < floor) feet.y = floor;
    grounded = Math.abs(feet.y - floor) < 0.03;
    verticalVelocity = 0;
    accumulator = 0;
    refreshWaterState();
    eyeGround = feet.y;
    camera.fov = 62;
    camera.near = 0.055;
    camera.updateProjectionMatrix();
    applyCamera();
    notify();
    requestLookLock();
  }

  function exit() {
    if (!active) return;
    active = false;
    clearInput();
    accumulator = 0;
    if (locked()) document.exitPointerLock();
    camera.position.copy(saved.position);
    camera.fov = saved.fov;
    camera.near = saved.near;
    camera.updateProjectionMatrix();
    orbit.target.copy(saved.target);
    orbit.enabled = true;
    orbit.update();
    notify();
  }

  function reset() {
    feet.set(-4, world.groundHeight(-4, 23, 0.07), 23);
    eyeGround = feet.y;
    yaw = -0.07;
    pitch = 0;
    distance = 0;
    eyeHeight = 1.65;
    bodyHeight = 1.68;
    verticalVelocity = 0;
    grounded = true;
    swimming = false;
    diving = false;
    accumulator = 0;
    lastWaterId = null;
    refreshWaterState();
    clearInput();
    motionEnabled = true;
    if (active) applyCamera();
  }

  function physicsStep(dt) {
    refreshWaterState();
    const rise = keys.has('Space') || touchRise;
    const descend = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight') || touchDive;
    if (swimming && descend) diving = true;
    if (swimming && rise && feet.y + eyeHeight > currentWater.height - 0.03) diving = false;
    const targetBody = swimming ? 0.86 : 1.68;
    const proposedBody = bodyHeight + (targetBody - bodyHeight) * (1 - Math.exp(-9 * dt));
    if (proposedBody <= bodyHeight || !world.canOccupy || world.canOccupy(feet, proposedBody)) bodyHeight = proposedBody;
    const targetEye = swimming ? 0.68 : Math.min(1.65, bodyHeight - 0.025);
    eyeHeight += (targetEye - eyeHeight) * (1 - Math.exp(-9 * dt));
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + touchAxis.y;
    const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touchAxis.x;
    intent.set(sideways, forward);
    if (intent.lengthSq() > 1) intent.normalize();
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = swimming ? (sprint ? 2.05 : 1.35) : (sprint ? 3.1 : 1.75);
    const along = swimming ? intent.y * Math.cos(pitch) : intent.y;
    const targetX = (Math.cos(yaw) * intent.x - Math.sin(yaw) * along) * speed;
    const targetZ = (-Math.sin(yaw) * intent.x - Math.cos(yaw) * along) * speed;
    const smoothing = 1 - Math.exp(-(swimming ? 4.8 : 10) * dt);
    if (intent.lengthSq() === 0 && !swimming) velocity.set(0, 0);
    else {
      velocity.x += (targetX - velocity.x) * smoothing;
      velocity.y += (targetZ - velocity.y) * smoothing;
    }
    if (jumpQueued && grounded && !swimming) {
      verticalVelocity = 4.6;
      grounded = false;
    }
    jumpQueued = false;
    const previous = feet.clone();
    const next = world.moveBody
      ? world.moveBody(feet, velocity.x * dt, velocity.y * dt, { bodyHeight, stepUp: grounded || swimming })
      : world.move(feet, velocity.x * dt, velocity.y * dt);
    feet.copy(next);
    refreshWaterState();
    let acceleration = -9.81;
    if (swimming) {
      const verticalIntent = (Number(rise) - Number(descend)) * 1.25 + intent.y * Math.sin(pitch) * speed;
      if (verticalIntent < -0.10) diving = true;
      if (diving && verticalIntent > 0 && !descend && feet.y + eyeHeight > currentWater.height - 0.03) diving = false;
      if (diving) {
        // 潜入后近中性浮力与水阻保持深度，松键不会被吸回平均水面。
        acceleration = (verticalIntent - verticalVelocity) * 4.8;
      } else {
        const equilibrium = currentWater.height - (eyeHeight - 0.22);
        const risingForce = Math.max(0, verticalIntent) * 4.8 * THREE.MathUtils.clamp((equilibrium - feet.y) / 0.4, 0, 1);
        acceleration = (equilibrium - feet.y) * 14 - verticalVelocity * 6 + risingForce;
      }
      acceleration = THREE.MathUtils.clamp(acceleration, -16, 16);
    } else if (waterState.inWater) acceleration -= verticalVelocity * 1.8;
    const dy = verticalVelocity * dt + acceleration * dt * dt * 0.5;
    verticalVelocity += acceleration * dt;
    const vertical = world.moveVertical?.(feet, dy, { bodyHeight });
    if (vertical) {
      feet.copy(vertical.position);
      grounded = vertical.grounded;
      if (vertical.hitCeiling && verticalVelocity > 0) verticalVelocity = 0;
      if (grounded && verticalVelocity < 0) verticalVelocity = 0;
    } else grounded = true;
    if (feet.x === previous.x && feet.z === previous.z && intent.lengthSq() > 0) velocity.multiplyScalar(0.6);
    const travelled = Math.hypot(feet.x - previous.x, feet.z - previous.z);
    distance += travelled;
    const cameraSmoothing = grounded && !swimming ? 14 : 45;
    eyeGround += (feet.y - eyeGround) * (1 - Math.exp(-cameraSmoothing * dt));
    refreshWaterState();
    if (waterState.inWater && lastWaterId !== currentWater.id) disturbWater(Math.min(0.038, 0.010 + Math.abs(verticalVelocity) * 0.005), 0.22);
    lastWaterId = waterState.inWater ? currentWater.id : null;
    wakeTimer -= dt;
    if (waterState.inWater && travelled > 0.0001 && wakeTimer <= 0) {
      disturbWater(Math.min(0.008, 0.002 + travelled / dt * 0.002) * (waterState.submerged ? 0.25 : 1), swimming ? 0.24 : 0.14);
      wakeTimer = 0.18;
    }
    simulationTime += dt;
    physicalSteps += 1;
    return travelled;
  }

  function update(dt) {
    if (!active) return;
    if (!motionEnabled || uiPaused) {
      clearInput();
      accumulator = 0;
      applyCamera();
      return;
    }
    accumulator += Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.07));
    let travelled = 0;
    while (accumulator + 1e-10 >= fixedStep) {
      accumulator = Math.max(0, accumulator - fixedStep);
      travelled += physicsStep(fixedStep);
    }
    const bob = !reducedMotion && grounded && !swimming && travelled > 0.0001 ? Math.sin(distance * 7.5) * 0.012 : 0;
    applyCamera(bob);
    waterState.submerged = Boolean(currentWater && camera.position.y < currentWater.height - 0.025);
    onWaterMotion({ ...waterState, eyeHeight, bodyHeight });
    const mode = swimming ? (waterState.submerged ? 'underwater' : 'swimming') : waterState.inWater ? 'wading' : 'land';
    if (mode !== lastMode) { lastMode = mode; notify(); }
  }

  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyC', 'ControlLeft', 'ControlRight']);
  function keyDown(event) {
    if (!active || !motionEnabled || uiPaused || !movementCodes.has(event.code) || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.code === 'Space' && !keys.has('Space') && !event.repeat) jumpQueued = true;
    keys.add(event.code);
  }
  function keyUp(event) { keys.delete(event.code); }
  function escape(event) {
    if (active && event.key === 'Escape') {
      clearInput();
      if (locked()) document.exitPointerLock();
    }
  }
  function pointerLockChanged() { if (!locked()) clearInput(); notify(); }
  function pointerLockError(event) { event.preventDefault(); notify(); }
  function mouseMove(event) { if (active && locked()) look(event.movementX, event.movementY); }

  function lookDown(event) {
    if (!active || uiPaused || locked() || event.button > 0) return;
    event.preventDefault();
    dragged = false;
    lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType, travel: 0 };
    element.setPointerCapture(event.pointerId);
  }
  function lookMove(event) {
    if (!active || !lookPointer || event.pointerId !== lookPointer.id) return;
    const dx = event.clientX - lookPointer.x;
    const dy = event.clientY - lookPointer.y;
    lookPointer.travel += Math.hypot(dx, dy);
    dragged ||= lookPointer.travel > 4;
    lookPointer.x = event.clientX;
    lookPointer.y = event.clientY;
    look(dx, dy, lookPointer.type === 'touch' ? 0.004 : 0.003);
  }
  function lookUp(event) {
    if (!lookPointer || event.pointerId !== lookPointer.id) return;
    const shouldLock = !dragged && lookPointer.type === 'mouse' && event.type !== 'pointercancel';
    lookPointer = null;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (shouldLock) requestLookLock();
  }

  function padMove(event) {
    if (padPointer !== event.pointerId) return;
    event.preventDefault();
    const bounds = pad.getBoundingClientRect();
    const radius = bounds.width * 0.34;
    const offset = new THREE.Vector2(event.clientX - bounds.x - bounds.width / 2, event.clientY - bounds.y - bounds.height / 2);
    if (offset.length() > radius) offset.setLength(radius);
    touchAxis.set(offset.x / radius, -offset.y / radius);
    if (touchAxis.length() < 0.09) touchAxis.set(0, 0);
    stick.style.transform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`;
  }
  function padDown(event) {
    if (!active || !motionEnabled || uiPaused || padPointer !== null) return;
    event.preventDefault();
    padPointer = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    padMove(event);
  }
  function padUp(event) {
    if (padPointer !== event.pointerId) return;
    padPointer = null;
    touchAxis.set(0, 0);
    stick.style.transform = 'translate(-50%, -50%)';
    if (pad.hasPointerCapture(event.pointerId)) pad.releasePointerCapture(event.pointerId);
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keydown', escape);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  document.addEventListener('pointerlockchange', pointerLockChanged);
  document.addEventListener('pointerlockerror', pointerLockError);
  document.addEventListener('mousemove', mouseMove);
  element.addEventListener('pointerdown', lookDown);
  element.addEventListener('pointermove', lookMove);
  element.addEventListener('pointerup', lookUp);
  element.addEventListener('pointercancel', lookUp);
  pad?.addEventListener('pointerdown', padDown);
  pad?.addEventListener('pointermove', padMove);
  pad?.addEventListener('pointerup', padUp);
  pad?.addEventListener('pointercancel', padUp);
  function bindVerticalButton(button, descend) {
    if (!button) return;
    const release = () => { if (descend) touchDive = false; else touchRise = false; };
    button.addEventListener('pointerdown', event => {
      if (!active || !motionEnabled || uiPaused) return;
      event.preventDefault();
      if (descend) touchDive = true;
      else { touchRise = true; jumpQueued = true; }
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }
  bindVerticalButton(jumpButton, false);
  bindVerticalButton(diveButton, true);

  return {
    enter, exit, reset, update,
    setWaterDriver(driver) { waterDriver = driver; world.setWaterDriver?.(driver); refreshWaterState(); },
    // 电梯携带脚底位置，不替换视角；乘客在升降过程中仍可环顾。
    setPosition(position, options = {}) {
      if (Array.isArray(position)) feet.set(...position);
      else feet.copy(position);
      if (!Number.isFinite(feet.x + feet.y + feet.z)) { reset(); return; }
      if (Number.isFinite(options.yaw)) yaw = options.yaw;
      if (Number.isFinite(options.pitch)) pitch = options.pitch;
      eyeGround = feet.y;
      velocity.set(0, 0);
      verticalVelocity = 0;
      accumulator = 0;
      refreshWaterState();
      grounded = Math.abs(feet.y - world.groundHeight(feet.x, feet.z, feet.y, { allowStep: false })) < 0.035;
      waterState.grounded = grounded;
      if (active) applyCamera();
    },
    setMotionEnabled(value) { motionEnabled = Boolean(value); clearInput(); },
    setPaused(value) { uiPaused = Boolean(value); clearInput(); },
    releasePointer() { if (locked()) document.exitPointerLock(); },
    get motionEnabled() { return motionEnabled && !uiPaused; },
    get active() { return active; },
    get locked() { return locked(); },
    get position() { return feet.clone(); },
    get heading() { return { yaw, pitch }; },
    get waterState() { return { ...waterState, eyeHeight, bodyHeight }; },
    get snapshot() { return { ...waterState, active, position: feet.toArray(), velocity: [velocity.x, verticalVelocity, velocity.y], eyeHeight, bodyHeight, physicalSteps, time: simulationTime, accumulator }; },
  };
}
