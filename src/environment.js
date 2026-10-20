// 时间驱动天体方向与照明，天气驱动风、湿润过程和空气透视。
export function createEnvironment({ THREE, kit, scene, renderer, camera, sky, sun, hemisphere, ambient, walk, sound, nature, town, shops, dailyShops, station, effects, reducedMotion }) {
  const clock = { hours: 16 + 20 / 60, cycling: false, weather: 'clear' };
  const values = { rain: 0, cloud: 0.05, wetness: 0, daylight: 1, wind: new THREE.Vector2(-0.35, 0.16) };
  const sunDirection = new THREE.Vector3();
  const moonDirection = new THREE.Vector3();
  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  const panel = document.querySelector('#environment-panel');
  const trigger = document.querySelector('#weather-button');
  const slider = document.querySelector('#time-slider');
  const display = document.querySelector('#environment-time');
  const cycleButton = document.querySelector('#cycle-button');
  const timeLabel = document.querySelector('#time-label');
  const weatherName = document.querySelector('#weather-name');
  const temperature = document.querySelector('#temperature');
  const periodLabel = document.querySelector('#period-label');
  const weatherIcon = trigger.querySelector('svg');
  const uniforms = {
    upperColor: { value: new THREE.Color('#b7dce8') }, lowerColor: { value: new THREE.Color('#f3e8ce') },
    uSun: { value: sunDirection }, uDaylight: { value: 1 }, uCloud: { value: 0.05 }, uTime: { value: 0 },
    uInverseProjection: { value: camera.projectionMatrixInverse }, uCameraWorld: { value: camera.matrixWorld },
  };
  sky.material.uniforms = uniforms;
  sky.material.fragmentShader = `
    varying vec2 vUv;
    uniform vec3 upperColor, lowerColor, uSun;
    uniform float uDaylight, uCloud, uTime;
    uniform mat4 uInverseProjection, uCameraWorld;
    float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float skyNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x),f.y);
    }
    void main(){
      vec4 ray=uInverseProjection*vec4(vUv*2.0-1.0,1.0,1.0);
      vec3 d=normalize((uCameraWorld*vec4(ray.xyz/ray.w,0.0)).xyz);
      float horizon=smoothstep(-0.12,0.65,d.y);
      vec3 c=mix(lowerColor,upperColor,horizon);
      float sunDot=max(0.0,dot(d,uSun));
      float sunDisc=smoothstep(0.99962,0.99979,sunDot);
      c+=vec3(1.0,0.64,0.31)*(pow(sunDot,64.0)*0.13+sunDisc*0.74)*uDaylight*(1.0-uCloud);
      float moonDot=max(0.0,dot(d,-uSun));
      c+=vec3(0.77,0.85,0.89)*smoothstep(0.99966,0.99982,moonDot)*(1.0-uDaylight)*(1.0-uCloud*0.92);
      vec2 celestial=vec2(atan(d.z,d.x),asin(clamp(d.y,-1.0,1.0)));
      vec2 starGrid=celestial*vec2(64.0,50.0);
      vec2 starCell=floor(starGrid);
      float seed=skyHash(starCell);
      vec2 starCenter=vec2(skyHash(starCell+3.1),skyHash(starCell+7.8));
      float star=1.0-smoothstep(0.022,0.058,length(fract(starGrid)-starCenter));
      c+=vec3(0.6,0.7,0.82)*star*step(0.965,seed)*(1.0-uDaylight)*(1.0-uCloud)*smoothstep(0.02,0.12,d.y);
      if(d.y>0.01){
        vec2 cp=d.xz/(d.y+0.22)*1.15+vec2(uTime*0.002,-uTime*0.0007);
        float cloud=skyNoise(cp)*0.62+skyNoise(cp*2.05)*0.26+skyNoise(cp*4.0)*0.12;
        float density=smoothstep(0.7-uCloud*0.44,0.88-uCloud*0.43,cloud)*uCloud;
        vec3 cloudColor=mix(vec3(0.11,0.14,0.23),vec3(0.63,0.69,0.72),uDaylight);
        c=mix(c,cloudColor,density*0.88);
      }
      gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
    }`;
  sky.material.needsUpdate = true;

  const moon = new THREE.DirectionalLight('#b3c5e4', 0);
  scene.add(moon);
  const lamps = new THREE.Group();
  lamps.name = '夜色里的站前路灯';
  lamps.userData.dynamic = true;
  lamps.userData.walkCollision = false;
  scene.add(lamps);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const gradient = glowContext.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,229,165,0.65)');
  gradient.addColorStop(0.16, 'rgba(255,219,151,0.23)');
  gradient.addColorStop(1, 'rgba(255,219,151,0)');
  glowContext.fillStyle = gradient; glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const lampPoints = [];
  for (const [x, y, z] of [[-6.85, 8.18, 26], [-6.85, 8.18, 11], [-6.85, 8.18, -6], [-23.6, 8.18, -8], [-23.8, 8.18, -24], [5, 2.65, -3.05]]) {
    const light = new THREE.PointLight('#ffd79b', 0, 13, 2);
    light.position.set(x, y - 0.15, z);
    lamps.add(light);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, color: '#fff3d5', opacity: 0 }));
    // 灯晕属于空气中的光，不参与物件选择或通道射线。
    halo.raycast = () => {};
    halo.position.set(x, y, z); halo.scale.setScalar(0.7); lamps.add(halo);
    lampPoints.push({ light, halo });
  }
  let simulationTime = 0;
  let refreshTime = 0;
  let lastNight = null;
  let lastClockMinute = -1;
  let lightingDirty = true;
  let audioTick = 0;
  const printedMaterials = new Map();
  scene.traverse(object => {
    if (object.material?.isMeshBasicMaterial && object.material.map) printedMaterials.set(object.material, object.material.color.clone());
  });

  function format(hours) {
    const minutes = Math.floor(hours * 60 + 1e-7) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  function setTime(hours) {
    if (!Number.isFinite(hours)) return;
    clock.hours = ((hours % 24) + 24) % 24;
    refreshTime = 0;
    lightingDirty = true;
    updateLabels();
  }
  function setWeather(weather) {
    if (!['clear', 'cloudy', 'rain'].includes(weather)) return;
    clock.weather = weather;
    document.querySelectorAll('[data-weather]').forEach(button => {
      const selected = button.dataset.weather === weather;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    updateLabels();
  }
  function setCycling(value) {
    clock.cycling = Boolean(value);
    cycleButton.setAttribute('aria-pressed', String(clock.cycling));
    cycleButton.textContent = clock.cycling ? '暂停时间' : '让时间流动';
  }
  function updateLabels() {
    const time = format(clock.hours);
    display.textContent = time;
    timeLabel.textContent = time;
    slider.value = Math.floor(clock.hours * 60 + 1e-7);
    slider.setAttribute('aria-valuetext', time);
    weatherName.textContent = { clear: '晴れ', cloudy: '薄云', rain: '春雨' }[clock.weather];
    if (weatherIcon.dataset.weather !== clock.weather) {
      weatherIcon.dataset.weather = clock.weather;
      weatherIcon.innerHTML = {
        clear: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
        cloudy: '<path d="M5 17a4 4 0 0 1 0-8 6 6 0 0 1 11-2 5 5 0 1 1 2 10H5Z"/>',
        rain: '<path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 11-2 5 5 0 1 1 2 10H5Zm2 3-1 3m6-3-1 3m6-3-1 3"/>',
      }[clock.weather];
    }
    temperature.textContent = `${Math.round(19 + 4 * Math.sin((clock.hours - 8) / 24 * Math.PI * 2) - ({ clear: 0, cloudy: 2, rain: 4 }[clock.weather]))}°`;
    periodLabel.textContent = clock.hours < 5 || clock.hours >= 20 ? '夜间' : clock.hours < 11 ? '早晨' : clock.hours < 17.5 ? '午后' : '黄昏';
    const minute = Math.floor(clock.hours * 60 + 1e-7);
    if (minute !== lastClockMinute) { station.setTime?.(clock.hours); lastClockMinute = minute; }
  }
  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    walk.setPaused(false);
  }
  trigger.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    trigger.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) walk.releasePointer();
    walk.setPaused(!panel.hidden);
  });
  document.querySelector('#environment-close').addEventListener('click', closePanel);
  document.querySelectorAll('[data-weather]').forEach(button => button.addEventListener('click', () => setWeather(button.dataset.weather)));
  document.querySelectorAll('[data-hour]').forEach(button => button.addEventListener('click', () => { setCycling(false); setTime(Number(button.dataset.hour)); }));
  slider.addEventListener('input', () => { setCycling(false); setTime(Number(slider.value) / 60); });
  cycleButton.addEventListener('click', () => setCycling(!clock.cycling));
  window.addEventListener('keydown', event => {
    if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePanel(); }
  }, true);

  function update(dt) {
    simulationTime += dt;
    if (clock.cycling) { clock.hours = (clock.hours + dt / 15) % 24; updateLabels(); }
    const targetRain = clock.weather === 'rain' ? 1 : 0;
    const targetCloud = { clear: 0.05, cloudy: 0.62, rain: 0.95 }[clock.weather];
    const blend = 1 - Math.exp(-dt * 1.4);
    values.rain += (targetRain - values.rain) * blend;
    values.cloud += (targetCloud - values.cloud) * blend;
    // 地面吸水快、日照蒸发慢，停雨后不会瞬间恢复干燥。
    values.wetness += values.rain > 0.08 ? (1 - values.wetness) * values.rain * dt * 0.075 : -values.wetness * dt * 0.012;
    values.wetness = THREE.MathUtils.clamp(values.wetness, 0, 1);
    const gust = 1 + 0.17 * Math.sin(simulationTime * 0.73) + 0.08 * Math.sin(simulationTime * 1.9);
    const windSpeed = (0.4 + values.cloud * 0.9 + values.rain * 1.3) * gust;
    values.wind.set(-windSpeed * 0.91, windSpeed * 0.38);
    const solarAngle = (clock.hours - 6) / 12 * Math.PI;
    const elevation = Math.sin(solarAngle);
    values.daylight = THREE.MathUtils.smoothstep(elevation, -0.16, 0.18);
    sunDirection.set(Math.cos(solarAngle) * 52, elevation * 62, 22).normalize();
    sun.position.copy(sunDirection).multiplyScalar(66).add(sun.target.position);
    sun.intensity = 2.45 * Math.max(0, 0.28 + elevation * 0.8) * values.daylight * (1 - values.cloud * 0.82);
    sun.color.copy(colorA.set('#ffe2b6').lerp(colorB.set('#f3a47d'), 1 - THREE.MathUtils.smoothstep(elevation, 0.05, 0.6)));
    hemisphere.intensity = 0.22 + values.daylight * (1.02 + values.cloud * 0.16);
    hemisphere.color.copy(colorA.set('#8a95c7').lerp(colorB.set('#b9c5e8'), values.daylight));
    hemisphere.groundColor.copy(colorA.set('#535273').lerp(colorB.set('#c1b6cb'), values.daylight));
    ambient.intensity = 0.1 + values.daylight * 0.2;
    moon.position.copy(sunDirection).multiplyScalar(-60);
    moon.intensity = (1 - values.daylight) * 0.25 * (1 - values.cloud * 0.5);
    const dusk = (1 - THREE.MathUtils.smoothstep(Math.abs(elevation), 0.03, 0.32)) * values.daylight;
    uniforms.upperColor.value.copy(colorA.set('#182442').lerp(colorB.set('#b7dce8'), values.daylight)).lerp(colorB.set('#858dba'), dusk * 0.45);
    uniforms.lowerColor.value.copy(colorA.set('#3d4562').lerp(colorB.set('#e9e5d0'), values.daylight)).lerp(colorB.set('#efb99a'), dusk * 0.8);
    uniforms.upperColor.value.lerp(colorB.set('#83989e'), values.cloud * values.daylight * 0.5);
    uniforms.lowerColor.value.lerp(colorB.set('#acbab7'), values.cloud * values.daylight * 0.6);
    uniforms.uDaylight.value = values.daylight;
    uniforms.uCloud.value = values.cloud;
    uniforms.uTime.value = simulationTime;
    scene.fog.color.copy(uniforms.lowerColor.value);
    scene.fog.near = 65 - values.rain * 25;
    scene.fog.far = 200 - values.rain * 85;
    renderer.toneMappingExposure = 1.04 + (1 - values.daylight) * 0.08;
    kit.setWetness(values.wetness);
    nature.setEnvironment(values);
    const night = values.daylight < 0.55;
    if (night !== lastNight) {
      document.querySelector('#experience').dataset.light = night ? 'night' : 'day';
      town.userData.setNight?.(night);
      shops.setNight?.(night);
      dailyShops.setNight?.(night);
      station.setNight?.(night);
      lamps.visible = night;
      lastNight = night;
    }
    const lampStrength = 1 - values.daylight;
    for (const { light, halo } of lampPoints) {
      light.intensity = lampStrength * 24;
      halo.material.opacity = lampStrength * 0.6;
    }
    effects.update(dt, { rain: reducedMotion ? values.rain * 0.7 : values.rain, wetness: values.wetness, wind: values.wind, daylight: values.daylight, time: simulationTime });
    for (const [material, original] of printedMaterials) material.color.copy(original).multiplyScalar(0.3 + values.daylight * 0.7);
    audioTick -= dt;
    if (audioTick <= 0) {
      sound.setEnvironment({ rain: values.rain, wind: windSpeed, daylight: values.daylight, sheltered: walk.active && effects.isSheltered(camera.position) });
      audioTick = 0.2;
    }
    refreshTime -= dt;
    if (refreshTime <= 0 && (clock.cycling || lightingDirty)) { renderer.shadowMap.needsUpdate = true; refreshTime = 0.25; lightingDirty = false; }
  }
  updateLabels();
  update(0);
  return { update, setTime, setWeather, setCycling, closePanel,
    get snapshot() { return { ...clock, rain: values.rain, wetness: values.wetness, daylight: values.daylight, wind: values.wind.toArray(), sun: sun.position.toArray(),
      moonDirection: moonDirection.copy(moon.position).sub(moon.target.position).normalize().toArray(), moonColor: moon.color.toArray(), moonPower: moon.intensity }; },
    get windStrength() { return values.wind.length(); },
  };
}
