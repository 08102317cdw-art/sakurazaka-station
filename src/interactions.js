// 交互依附真实物件与视线；键盘和手机使用相同的距离条件。
export function createInteractions({ THREE, camera, walk, world, roots, toast, refreshShadows, tower }) {
  const items = roots.flatMap(root => root?.userData.interactions ?? []);
  const button = document.querySelector('#interact-button');
  const label = document.querySelector('#interact-label');
  const dialog = document.querySelector('#inspection');
  const title = document.querySelector('#inspection-title');
  const text = document.querySelector('#inspection-text');
  const direction = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const rideStatus = document.querySelector('#ride-status');
  let current = null;
  let shown = false;
  let scanTime = 0;
  let revision = 0;

  function close() {
    if (!shown) return;
    shown = false;
    dialog.close();
    walk.setPaused(false);
    button.blur();
  }

  function inspect(heading, content) {
    title.textContent = heading;
    text.textContent = content;
    if (!shown) {
      shown = true;
      walk.releasePointer();
      walk.setPaused(true);
      dialog.showModal();
    }
  }

  const context = { walk, toast, refreshShadows, inspect };
  function activate() {
    if (!walk.active || shown || !current || current.enabled?.(context) === false) return false;
    const point = getPoint(current);
    if (!point || camera.position.distanceTo(point) > (current.radius ?? 2.2) + 0.1) return false;
    const result = current.action(context);
    revision++;
    refreshShadows();
    scanTime = 0;
    return result !== false;
  }

  function getPoint(item) {
    const value = typeof item.position === 'function' ? item.position() : item.position;
    if (!value) return null;
    return Array.isArray(value) ? new THREE.Vector3(...value) : value;
  }

  function update(dt) {
    const status = tower?.snapshot;
    rideStatus.hidden = !walk.active || !status?.riding;
    if (!rideStatus.hidden) {
      rideStatus.textContent = `${status.status ?? '观光塔升降舱'} · ${Number(status.height).toFixed(1)} m`;
    }
    scanTime -= dt;
    if (scanTime > 0) return;
    scanTime = 0.12;
    current = null;
    let best = Infinity;
    if (walk.active && !shown) {
      camera.getWorldDirection(direction);
      for (const item of items) {
        if (item.enabled?.(context) === false) continue;
        const point = getPoint(item);
        if (!point) continue;
        offset.subVectors(point, camera.position);
        const distance = offset.length();
        if (distance > (item.radius ?? 2.2)) continue;
        const aim = distance < 0.1 ? 1 : offset.multiplyScalar(1 / distance).dot(direction);
        if (aim < 0.25 || !world.lineClear(camera.position, point)) continue;
        const score = distance + (1 - aim) * 1.8;
        if (score < best) { best = score; current = item; }
      }
    }
    button.hidden = !current;
    document.querySelector('#walk-reticle').classList.toggle('can-interact', Boolean(current));
    if (current) label.textContent = typeof current.label === 'function' ? current.label(context) : current.label;
  }

  button.addEventListener('click', activate);
  document.querySelector('#inspection-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  window.addEventListener('keydown', event => {
    if (shown && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    } else if (event.code === 'KeyE' && walk.active && !event.repeat && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault();
      activate();
    }
  }, true);

  return { update, close, inspect, context, items,
    get current() { return current?.id ?? null; },
    get revision() { return revision; },
    get inspecting() { return shown; },
  };
}
