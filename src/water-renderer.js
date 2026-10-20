import { WaterSimulation } from './water-simulation.js';
import { pondDistance } from './pond-shape.js';

// 补充的毫米级短波与高度场共用法线，不替代可传播的鱼尾和雨滴扰动。
const waveFunctions = `
  vec2 shortGradient(vec2 uv){
    vec2 p=uOrigin+uv*uDimensions-uDimensions*0.5;
    vec2 w=normalize(uWind+vec2(0.001));
    vec2 crossWind=vec2(-w.y,w.x);
    float amplitude=0.00065*clamp(length(uWind),0.2,2.8);
    return w*(amplitude*12.0*cos(dot(p,w)*12.0-uTime*10.85))
      +crossWind*(amplitude*0.6*18.0*cos(dot(p,crossWind)*18.0-uTime*13.29));
  }
  float shortHeight(vec2 uv){
    vec2 p=uOrigin+uv*uDimensions-uDimensions*0.5;
    vec2 w=normalize(uWind+vec2(0.001));
    vec2 c=vec2(-w.y,w.x);
    float amplitude=0.00065*clamp(length(uWind),0.2,2.8);
    return amplitude*(sin(dot(p,w)*12.0-uTime*10.85)+0.6*sin(dot(p,c)*18.0-uTime*13.29));
  }
  vec2 waterSlope(vec2 uv){return texture2D(uWave,clamp(uv,vec2(0.001),vec2(0.999))).gb+shortGradient(uv);}
`;

export function createWaterRenderer({ THREE, renderer, scene, camera, sky, ponds, weatherEffects }) {
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const floatLinear = renderer.extensions.has('OES_texture_float_linear');
  const waterY = ponds[0].waterY;
  const projectionBias = new THREE.Matrix4().set(.5,0,0,.5, 0,.5,0,.5, 0,0,.5,.5, 0,0,0,1);
  const reflectionMatrix = new THREE.Matrix4();
  const refractionMatrix = new THREE.Matrix4();
  const refractInverseProjection = new THREE.Matrix4();
  const refractWorld = new THREE.Matrix4();
  const reflectionCamera = new THREE.PerspectiveCamera();
  const refractionCamera = new THREE.PerspectiveCamera();
  const targetType = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const reflectionTarget = new THREE.WebGLRenderTarget(1, 1, { type: targetType, depthBuffer: true });
  const refractionTarget = new THREE.WebGLRenderTarget(1, 1, { type: targetType, depthBuffer: true });
  reflectionTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  refractionTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  refractionTarget.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  refractionTarget.depthTexture.minFilter = refractionTarget.depthTexture.magFilter = THREE.NearestFilter;
  const sunDirection = new THREE.Vector3(-.6, .6, .5);
  const wind = new THREE.Vector2(-.35, .16);
  const shared = {
    uReflection: { value: reflectionTarget.texture }, uRefraction: { value: refractionTarget.texture },
    uDepth: { value: refractionTarget.depthTexture }, uReflectionMatrix: { value: reflectionMatrix }, uRefractionMatrix: { value: refractionMatrix },
    uRefractionInverseProjection: { value: refractInverseProjection }, uRefractionWorld: { value: refractWorld },
    uSunDirection: { value: sunDirection }, uSunColor: { value: new THREE.Color('#ffe2b6') }, uSunPower: { value: 1.4 }, uDaylight: { value: 1 },
    uMoonDirection: { value: new THREE.Vector3() }, uMoonColor: { value: new THREE.Color('#b3c5e4') }, uMoonPower: { value: 0 },
    uWind: { value: wind }, uTime: { value: 0 }, uCaptured: { value: 0 },
  };
  const states = [];
  let captureCount = 0;
  let clipSkips = 0;
  let causticReceivers = 0;
  let captureTimer = 0;
  let elapsed = 0;
  let lastAspect = 0;
  const frustum = new THREE.Frustum();
  const projectionView = new THREE.Matrix4();
  const forward = new THREE.Vector3();
  const target = new THREE.Vector3();
  const up = new THREE.Vector3();
  const clipPlane = new THREE.Plane();
  const clipVector = new THREE.Vector4();
  const corner = new THREE.Vector4();

  function createGrid(width, depth, nx, nz) {
    const positions = [], uvs = [], indices = [];
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
      positions.push((ix / nx - .5) * width, 0, (iz / nz - .5) * depth);
      uvs.push(ix / nx, iz / nz);
      if (ix < nx && iz < nz) {
        const a = iz * (nx + 1) + ix, b = a + nx + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }

  const parameterDeclarations = `
    uniform sampler2D uWave;
    uniform vec2 uDimensions,uOrigin,uWind,uTexel;
    uniform float uTime,uWaterY,uWaterDepth,uDaylight,uSunPower,uMoonPower;
    uniform vec3 uSunDirection,uSunColor,uMoonDirection,uMoonColor;
  `;
  for (const pond of ponds) {
    const lake = pond.width > 30;
    const nx = lake ? (mobile ? 96 : 144) : (mobile ? 72 : 96);
    const nz = lake ? (mobile ? 80 : 112) : (mobile ? 52 : 64);
    const simulation = new WaterSimulation({ width: pond.width, depth: pond.depth, resolutionX: nx, resolutionZ: nz, waterDepth: pond.waterY - pond.bottomY,
      depthAt: pond.bottomAt ? (u,v) => pond.waterY - pond.bottomAt(pond.x+(u-.5)*pond.width,pond.z+(v-.5)*pond.depth) : null,
      shapeMask(u, v) {
        const x = (u - .5) * pond.width, z = (v - .5) * pond.depth;
        if (pondDistance(x + pond.x, z + pond.z, pond) > -.04) return false;
        return !(pond.waterObstacles ?? []).some(part => Math.hypot(x - part.x, z - part.z) < part.radius);
      },
    });
    const data = new Float32Array(simulation.resolutionX * simulation.resolutionZ * 4);
    simulation.fillTextureData(data);
    const texture = new THREE.DataTexture(data, simulation.resolutionX, simulation.resolutionZ, THREE.RGBAFormat, THREE.FloatType);
    texture.minFilter = texture.magFilter = floatLinear ? THREE.LinearFilter : THREE.NearestFilter;
    texture.generateMipmaps = false; texture.needsUpdate = true;
    const uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...shared,
      uWave: { value: texture }, uDimensions: { value: new THREE.Vector2(pond.width, pond.depth) },
      uOrigin: { value: new THREE.Vector2(pond.x, pond.z) }, uTexel: { value: new THREE.Vector2(1 / (simulation.resolutionX - 1), 1 / (simulation.resolutionZ - 1)) },
      uWaterY: { value: pond.waterY }, uWaterDepth: { value: pond.waterY - pond.bottomY }, uCornerRadius: { value: pond.cornerRadius },
      uWaterColor: { value: new THREE.Color(pond.id === 'spring' ? '#4e9283' : pond.id === 'satoyama' ? '#477765' : '#538b77') },
    };
    const material = new THREE.ShaderMaterial({ uniforms, fog: true, side: THREE.DoubleSide,
      vertexShader: `${parameterDeclarations}
        uniform mat4 uReflectionMatrix,uRefractionMatrix;
        varying vec2 vWaterUv; varying vec3 vWorld; varying vec4 vReflect,vRefract;
        ${waveFunctions}
        #include <fog_pars_vertex>
        void main(){
          vWaterUv=uv;
          vec3 p=position;
          p.y+=texture2D(uWave,uv).r+shortHeight(uv);
          vec4 world=modelMatrix*vec4(p,1.0);
          vWorld=world.xyz; vReflect=uReflectionMatrix*world; vRefract=uRefractionMatrix*world;
          vec4 mvPosition=viewMatrix*world;
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `${parameterDeclarations}
        uniform sampler2D uReflection,uRefraction,uDepth;
        uniform mat4 uRefractionMatrix,uRefractionInverseProjection,uRefractionWorld;
        uniform vec3 uWaterColor; uniform float uCornerRadius,uCaptured;
        varying vec2 vWaterUv; varying vec3 vWorld; varying vec4 vReflect,vRefract;
        #include <common>
        #include <fog_pars_fragment>
        ${waveFunctions}
        float dielectric(float cosI,float eta){
          float sinT2=eta*eta*(1.0-cosI*cosI);
          if(sinT2>=1.0)return 1.0;
          float cosT=sqrt(1.0-sinT2);
          float rs=(eta*cosI-cosT)/max(0.0001,eta*cosI+cosT);
          float rp=(cosI-eta*cosT)/max(0.0001,cosI+eta*cosT);
          return 0.5*(rs*rs+rp*rp);
        }
        float ggx(float nDotH,float roughness){
          float a=roughness*roughness,a2=a*a;
          float d=nDotH*nDotH*(a2-1.0)+1.0;
          return a2/max(3.14159265*d*d,0.00000001);
        }
        float smith(float cosine,float roughness){
          float a2=pow(roughness,4.0);
          return 2.0*cosine/max(0.0001,cosine+sqrt(a2+(1.0-a2)*cosine*cosine));
        }
        vec3 lightHighlight(vec3 n,vec3 v,vec3 direction,vec3 color,float power,float roughness){
          vec3 l=normalize(direction),h=normalize(l+v);
          float nl=max(0.0,dot(n,l)),nv=max(0.001,dot(n,v));
          float spec=ggx(max(0.0,dot(n,h)),roughness)*smith(nv,roughness)*smith(nl,roughness)
            *dielectric(max(0.0,dot(v,h)),1.0/1.333)/max(0.0001,4.0*nv*nl);
          return color*min(spec*nl*power,3.0);
        }
        float shoreline(vec2 point){
          vec2 q=abs(point-uOrigin)-uDimensions*0.5+uCornerRadius;
          return length(max(q,vec2(0)))+min(max(q.x,q.y),0.0)-uCornerRadius;
        }
        bool submergedHit(vec3 point,out vec2 imageUv,out vec3 worldHit){
          vec4 projected=uRefractionMatrix*vec4(point,1.0);
          if(projected.w<=0.00001)return false;
          imageUv=projected.xy/projected.w;
          if(any(lessThan(imageUv,vec2(0.001)))||any(greaterThan(imageUv,vec2(0.999))))return false;
          float depth=texture2D(uDepth,imageUv).r;
          if(depth>=0.9999)return false;
          vec4 viewHit=uRefractionInverseProjection*vec4(imageUv*2.0-1.0,depth*2.0-1.0,1.0);
          if(abs(viewHit.w)<0.00001)return false;
          viewHit/=viewHit.w;
          worldHit=(uRefractionWorld*viewHit).xyz;
          return worldHit.y<uWaterY+0.025&&shoreline(worldHit.xz)<0.04;
        }
        void main(){
          vec2 p=(vWaterUv-0.5)*uDimensions;
          vec2 q=abs(p)-uDimensions*0.5+uCornerRadius;
          float shore=length(max(q,vec2(0)))+min(max(q.x,q.y),0.0)-uCornerRadius;
          if(shore>0.0)discard;
          vec2 slope=waterSlope(vWaterUv);
          bool underwater=cameraPosition.y<uWaterY;
          vec3 n=normalize(vec3(-slope.x,1.0,-slope.y))*(underwater?-1.0:1.0);
          vec3 eye=cameraPosition-vWorld; vec3 v=normalize(eye);
          float eta=underwater?1.333:1.0/1.333;
          float cosI=clamp(dot(n,v),0.001,1.0),f=dielectric(cosI,eta);
          vec3 refracted=refract(-v,n,eta);
          vec3 absorption=vec3(0.32,0.13,0.075);
          vec3 tint=uWaterColor*(0.2+0.7*uDaylight);
          vec3 through=tint*0.65;
          if(!underwater){
            float path=max(0.05,uWaterDepth*smoothstep(0.0,0.85,-shore))/max(0.18,-refracted.y);
            float bestPath=uWaterDepth*4.0,bestError=1000.0;
            vec2 bestUv=vec2(0.5); bool found=false;
            // 深度图只作有限次落点修正，拒绝天空、出屏和不在折射射线附近的几何。
            for(int i=0;i<3;i++){
              vec2 imageUv;vec3 hit;
              if(submergedHit(vWorld+refracted*path,imageUv,hit)){
                float candidate=(vWorld.y-hit.y)/max(0.18,-refracted.y);
                float error=length(hit-(vWorld+refracted*candidate));
                float tolerance=0.08+candidate*0.10;
                if(candidate>0.015&&candidate<uWaterDepth*4.0&&error<tolerance
                  &&(!found||candidate<bestPath-0.025||abs(candidate-bestPath)<0.025&&error<bestError)){
                  bestUv=imageUv;bestPath=candidate;bestError=error;found=true;
                }
                path=clamp(candidate,0.02,uWaterDepth*4.0);
              }
            }
            if(found){
              vec3 transmission=exp(-absorption*bestPath);
              through=texture2D(uRefraction,bestUv).rgb*transmission+tint*(1.0-transmission)*0.72;
            }
          }else if(f<0.999){
            // 水下从向上折射的方向观察天空，临界角之外由全反射接管。
            vec4 projected=uRefractionMatrix*vec4(vWorld+refracted*24.0,1.0);
            vec2 imageUv=projected.xy/max(0.00001,projected.w);
            if(projected.w>0.00001&&all(greaterThan(imageUv,vec2(0.001)))&&all(lessThan(imageUv,vec2(0.999))))
              through=texture2D(uRefraction,imageUv).rgb;
          }
          vec2 reflectedUv=vReflect.xy/max(0.00001,vReflect.w)+slope*0.025;
          vec3 reflected=tint;
          if(vReflect.w>0.00001&&all(greaterThan(reflectedUv,vec2(0.001)))&&all(lessThan(reflectedUv,vec2(0.999))))
            reflected=texture2D(uReflection,reflectedUv).rgb;
          vec3 c=mix(through,reflected,f);
          if(uCaptured<0.5)c=tint;
          float variance=max(dot(dFdx(n),dFdx(n)),dot(dFdy(n),dFdy(n)));
          float roughness=clamp(sqrt(0.17*0.17+variance*0.35),0.17,0.34);
          if(!underwater){
            c+=lightHighlight(n,v,uSunDirection,uSunColor,uSunPower,roughness);
            c+=lightHighlight(n,v,uMoonDirection,uMoonColor,uMoonPower,roughness);
          }
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const surface = new THREE.Mesh(createGrid(pond.width, pond.depth, nx - 1, nz - 1), material);
    surface.name = `${pond.name} · 有体积位移的水面`;
    surface.userData.dynamic = true; surface.userData.walkCollision = false;
    surface.renderOrder = 1;
    pond.waterGroup.add(surface);
    states.push({ pond, simulation, data, texture, uniforms, surface,
      sphere: new THREE.Sphere(new THREE.Vector3(pond.x, pond.waterY, pond.z), Math.hypot(pond.width, pond.depth) / 2) });
    addCaustics(pond, uniforms);
  }

  function addCaustics(pond, uniforms) {
    const decoratedMaterials = new Map();
    pond.root.updateWorldMatrix(true, true);
    pond.root.traverse(object => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some(material => material?.isMeshToonMaterial)) return;
      for (let node = object; node && node !== pond.root; node = node.parent) if (node.userData.dynamic) return;
      const bounds = new THREE.Box3().setFromObject(object);
      if (!object.userData.waterCaustics && (bounds.max.y > pond.waterY + .01 || bounds.min.y > -.08)) return;
      function decorate(source) {
      if (!source.isMeshToonMaterial) return source;
      if (decoratedMaterials.has(source.uuid)) return decoratedMaterials.get(source.uuid);
      const material = source.clone();
      const originalCompile = source.onBeforeCompile;
      material.onBeforeCompile = shader => {
        originalCompile.call(source, shader);
        for (const key of ['uWave','uDimensions','uOrigin','uTexel','uTime','uWaterY','uWaterDepth','uWind','uDaylight','uSunPower','uSunDirection']) shader.uniforms[key] = uniforms[key];
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCausticWorld;');
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 causticPosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            causticPosition=instanceMatrix*causticPosition;
          #endif
          vCausticWorld=(modelMatrix*causticPosition).xyz;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vCausticWorld;
          ${parameterDeclarations}
          ${waveFunctions}
          vec2 photonOffset(vec2 uv,float depth){
            vec2 slope=waterSlope(uv);
            vec3 n=normalize(vec3(-slope.x,1.0,-slope.y));
            vec3 ray=refract(-normalize(uSunDirection),n,1.0/1.333);
            return ray.xz*depth/max(0.18,-ray.y);
          }
          float focusAt(vec3 position){
            float depth=max(0.05,uWaterY-position.y);
            vec2 uv=(position.xz-uOrigin)/uDimensions+0.5;
            uv-=photonOffset(uv,depth)/uDimensions;
            vec2 x=(photonOffset(uv+vec2(uTexel.x,0),depth)-photonOffset(uv-vec2(uTexel.x,0),depth))/(2.0*uTexel.x*uDimensions.x);
            vec2 z=(photonOffset(uv+vec2(0,uTexel.y),depth)-photonOffset(uv-vec2(0,uTexel.y),depth))/(2.0*uTexel.y*uDimensions.y);
            float jacobian=abs((1.0+x.x)*(1.0+z.y)-x.y*z.x);
            float focusing=clamp(1.0/max(0.26,jacobian),0.4,3.6);
            float submerged=smoothstep(0.025,0.15,depth)*texture2D(uWave,clamp(uv,0.0,1.0)).a;
            return (focusing-1.0)*submerged*exp(-depth*0.24)*smoothstep(0.04,0.25,uSunDirection.y)*clamp(uSunPower/2.0,0.0,1.0);
          }
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.directDiffuse*=1.0+focusAt(vCausticWorld)*0.65;
        `);
      };
      material.customProgramCacheKey = () => '桜坂鱼塘的折射聚焦-v2';
      decoratedMaterials.set(source.uuid, material);
      return material;
      }
      object.material = Array.isArray(object.material) ? materials.map(decorate) : decorate(materials[0]);
      causticReceivers++;
    });
  }

  // 斜截近平面使用 Three.js Reflector/Refractor 的标准投影方法，反射和透射分别裁掉相反半空间。
  function clipCamera(virtual, normalY) {
    clipPlane.set(new THREE.Vector3(0, normalY, 0), -normalY * waterY);
    clipPlane.applyMatrix4(virtual.matrixWorldInverse);
    clipVector.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
    const p = virtual.projectionMatrix.elements;
    corner.set((Math.sign(clipVector.x) + p[8]) / p[0], (Math.sign(clipVector.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    const denominator = clipVector.dot(corner);
    if (!Number.isFinite(denominator) || denominator <= 0.00001) return false;
    clipVector.multiplyScalar(2 / denominator);
    p[2]=clipVector.x; p[6]=clipVector.y; p[10]=clipVector.z+1-0.0002; p[14]=clipVector.w;
    virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
    return true;
  }

  function resizeTargets() {
    if (Math.abs(lastAspect - camera.aspect) < .0001) return;
    lastAspect = camera.aspect;
    const longest = mobile ? 512 : 768;
    const width = Math.round(camera.aspect >= 1 ? longest : longest * camera.aspect);
    const height = Math.round(camera.aspect >= 1 ? longest / camera.aspect : longest);
    reflectionTarget.setSize(Math.max(160,width),Math.max(160,height));
    refractionTarget.setSize(Math.max(160,width),Math.max(160,height));
    captureTimer = 0;
  }

  function capture() {
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    reflectionCamera.position.copy(camera.position); reflectionCamera.position.y=2*waterY-camera.position.y;
    target.copy(camera.position).add(forward); target.y=2*waterY-target.y;
    up.set(0,1,0).applyQuaternion(camera.quaternion); up.y=-up.y;
    reflectionCamera.up.copy(up); reflectionCamera.lookAt(target);
    reflectionCamera.near=camera.near; reflectionCamera.far=camera.far;
    reflectionCamera.updateMatrixWorld(); reflectionCamera.projectionMatrix.copy(camera.projectionMatrix);
    reflectionCamera.userData.skyProjectionInverse = camera.projectionMatrixInverse;
    refractionCamera.position.copy(camera.position); refractionCamera.quaternion.copy(camera.quaternion);
    refractionCamera.near=camera.near; refractionCamera.far=camera.far;
    refractionCamera.updateMatrixWorld(); refractionCamera.projectionMatrix.copy(camera.projectionMatrix);
    refractionCamera.userData.skyProjectionInverse = camera.projectionMatrixInverse;
    const underwater=camera.position.y<waterY;
    if(!clipCamera(reflectionCamera,underwater?-1:1)||!clipCamera(refractionCamera,underwater?1:-1)){clipSkips++;return;}
    reflectionMatrix.copy(projectionBias).multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
    refractionMatrix.copy(projectionBias).multiply(refractionCamera.projectionMatrix).multiply(refractionCamera.matrixWorldInverse);
    refractInverseProjection.copy(refractionCamera.projectionMatrixInverse);
    refractWorld.copy(refractionCamera.matrixWorld);
    const savedTarget=renderer.getRenderTarget(),savedXr=renderer.xr.enabled;
    const savedShadowUpdate=renderer.shadowMap.needsUpdate,savedShadowAuto=renderer.shadowMap.autoUpdate;
    const savedColor=renderer.getClearColor(new THREE.Color()),savedAlpha=renderer.getClearAlpha();
    const visible=states.map(state=>state.pond.waterGroup.visible);
    const skyVisible=sky.visible,weatherVisible=weatherEffects.group.visible;
    try {
      states.forEach(state=>{state.pond.waterGroup.visible=false;});
      renderer.xr.enabled=false; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=false;
      sky.visible=skyVisible&&!underwater;
      weatherEffects.group.visible=weatherVisible&&!underwater;
      renderer.setRenderTarget(reflectionTarget); renderer.clear(); renderer.render(scene,reflectionCamera);
      sky.visible=skyVisible&&underwater; weatherEffects.group.visible=weatherVisible&&underwater;
      renderer.setClearColor('#20483e',1);
      renderer.setRenderTarget(refractionTarget); renderer.clear(); renderer.render(scene,refractionCamera);
      captureCount++; shared.uCaptured.value=1;
    } finally {
      states.forEach((state,i)=>{state.pond.waterGroup.visible=visible[i];});
      sky.visible=skyVisible; weatherEffects.group.visible=weatherVisible;
      renderer.setClearColor(savedColor,savedAlpha); renderer.setRenderTarget(savedTarget); renderer.xr.enabled=savedXr;
      renderer.shadowMap.autoUpdate=savedShadowAuto; renderer.shadowMap.needsUpdate=savedShadowUpdate;
    }
  }

  function update(dt, environment, sun) {
    elapsed += dt;
    shared.uTime.value=elapsed;
    shared.uDaylight.value=environment.daylight;
    wind.set(...environment.wind);
    sunDirection.copy(sun.position).sub(sun.target.position).normalize();
    shared.uSunPower.value=sun.intensity;
    shared.uSunColor.value.copy(sun.color);
    shared.uMoonDirection.value.fromArray(environment.moonDirection ?? [0,1,0]);
    shared.uMoonColor.value.fromArray(environment.moonColor ?? [0.45,0.56,0.78]);
    shared.uMoonPower.value=environment.moonPower ?? 0;
    for (const state of states) {
      state.simulation.step(dt,{windX:wind.x,windZ:wind.y,rain:environment.rain*0.35});
      state.simulation.fillTextureData(state.data); state.texture.needsUpdate=true;
    }
  }
  function render() {
    resizeTargets();
    camera.updateMatrixWorld();
    projectionView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionView);
    const visible = states.some(state=>frustum.intersectsSphere(state.sphere));
    if (!visible || Math.abs(camera.position.y-waterY) < .035) return;
    const now=performance.now()/1000;
    if(now<captureTimer)return;
    captureTimer=now+(mobile ? 0.22 : 0.12);
    capture();
  }
  function disturb(id,u,v,strength=.035,radius=.25) {
    states.find(state=>state.pond.id===id)?.simulation.disturb(u,v,strength,radius);
  }
  function sampleSurface(id,u,v) {
    const state=states.find(state=>state.pond.id===id);
    if(!state||!Number.isFinite(u+v))return {height:0,slopeX:0,slopeZ:0};
    const nx=state.simulation.resolutionX,nz=state.simulation.resolutionZ;
    // 像素中心与 GPU 线性纹理过滤一致，浮漂、鱼食与显示法线共享采样。
    const gx=Math.max(0,Math.min(nx-1,u*nx-.5)),gz=Math.max(0,Math.min(nz-1,v*nz-.5));
    const ix=Math.floor(gx),iz=Math.floor(gz),ix1=Math.min(nx-1,ix+1),iz1=Math.min(nz-1,iz+1);
    const tx=gx-ix,tz=gz-iz;
    const sample=channel=>state.data[(iz*nx+ix)*4+channel]*(1-tx)*(1-tz)+state.data[(iz*nx+ix1)*4+channel]*tx*(1-tz)
      +state.data[(iz1*nx+ix)*4+channel]*(1-tx)*tz+state.data[(iz1*nx+ix1)*4+channel]*tx*tz;
    const length=Math.hypot(wind.x+.001,wind.y+.001),wx=(wind.x+.001)/Math.max(length,1e-8),wz=(wind.y+.001)/Math.max(length,1e-8);
    const x=state.pond.x+(u-.5)*state.pond.width,z=state.pond.z+(v-.5)*state.pond.depth;
    const phase=(x*wx+z*wz)*12-elapsed*10.85,cross=(-x*wz+z*wx)*18-elapsed*13.29;
    const amplitude=.00065*Math.max(.2,Math.min(2.8,wind.length()));
    return {height:sample(0)+amplitude*(Math.sin(phase)+.6*Math.sin(cross)),
      slopeX:sample(1)+amplitude*(wx*12*Math.cos(phase)-wz*.6*18*Math.cos(cross)),
      slopeZ:sample(2)+amplitude*(wz*12*Math.cos(phase)+wx*.6*18*Math.cos(cross))};
  }
  return { update, render, disturb, sampleSurface,
    sampleHeight(id,u,v) { return sampleSurface(id,u,v).height; },
    get snapshot() { return { captures:captureCount,clipSkips,reflectionSize:[reflectionTarget.width,reflectionTarget.height],causticReceivers,
      ior:1.333,gravity:9.81,ponds:states.map(state=>({id:state.pond.id,...state.simulation.snapshot})) }; },
    get states() { return states; },
    get targets() { return { reflection:reflectionTarget,refraction:refractionTarget }; },
  };
}
