// 水下画面按实际光程吸收颜色；出水后恢复正常主渲染，截图共用这条渲染路径。
export function createUnderwater({ THREE, renderer, scene, camera, walk, water, weatherEffects }) {
  const target=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType});
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={uColor:{value:target.texture},uDepth:{value:target.depthTexture},uInverseProjection:{value:camera.projectionMatrixInverse},
    uCameraWorld:{value:camera.matrixWorld},uImmersion:{value:0},uDaylight:{value:1},uWaterTint:{value:new THREE.Color('#285a57')}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`
      uniform sampler2D uColor,uDepth;
      uniform mat4 uInverseProjection,uCameraWorld;
      uniform float uImmersion,uDaylight;
      uniform vec3 uWaterTint;
      varying vec2 vUv;
      void main(){
        float depth=texture2D(uDepth,vUv).r;
        vec4 point=uInverseProjection*vec4(vUv*2.0-1.0,depth*2.0-1.0,1.0);
        vec3 viewPoint=point.xyz/point.w;
        float distance=min(length(viewPoint),80.0);
        vec3 direction=normalize((uCameraWorld*vec4(viewPoint,0.0)).xyz);
        // 向上观察时，光只在到达水面的那一段经过水，水面之外不额外计入吸收。
        float waterPath=direction.y>0.001?min(distance,uImmersion/direction.y):distance;
        vec3 transmission=exp(-vec3(0.19,0.075,0.048)*waterPath);
        vec3 scatter=uWaterTint*(0.16+uDaylight*0.64)*exp(-uImmersion*0.045);
        vec3 color=texture2D(uColor,vUv).rgb*transmission+scatter*(1.0-transmission);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const postScene=new THREE.Scene();
  const postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;postScene.add(quad);
  const group=new THREE.Group();group.name='入水飞溅与潜泳气泡';group.userData.dynamic=true;group.userData.walkCollision=false;scene.add(group);
  const count=160,particles=Array.from({length:count},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,bubble:false,scale:0}));
  const bubbles=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:'#b4d5cd',transparent:true,opacity:.32,depthWrite:false}),count);
  bubbles.frustumCulled=false;group.add(bubbles);
  const transform=new THREE.Object3D();
  let previousWater=false,lastVertical=0,bubbleTime=0,splashCount=0,bubbleCount=0,elapsed=0;
  let seed=14281;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function emit(x,y,z,bubble,speed=1){
    const p=particles.find(item=>item.life<=0);if(!p)return;
    const angle=random()*Math.PI*2;
    Object.assign(p,{life:bubble?3.8:1.7,x,y,z,bubble,scale:bubble?.012+random()*.018:.012+random()*.014,
      vx:Math.cos(angle)*(bubble?.08:speed*(.25+random()*.6)),
      vy:bubble?.22+random()*.3:speed*(.45+random()*.8),
      vz:Math.sin(angle)*(bubble?.08:speed*(.25+random()*.6))});
  }
  function update(dt,climate){
    elapsed+=dt;
    const location=water.sampleWater(camera.position.x,camera.position.z);
    const state=walk.waterState;
    const inWater=walk.active&&Boolean(state?.inWater);
    const immersed=walk.active&&location&&camera.position.y<location.height-.025;
    if(inWater&&!previousWater&&location){
      const speed=Math.max(.8,Math.min(3.8,Math.abs(lastVertical)*.65+.8));
      for(let i=0;i<28;i++)emit(camera.position.x,location.height+.025,camera.position.z,false,speed);
      splashCount++;
    }
    previousWater=inWater;lastVertical=state?.verticalVelocity??0;
    bubbleTime-=dt;
    if(immersed&&bubbleTime<=0){
      emit(camera.position.x+Math.sin(elapsed)*.18,camera.position.y-.16,camera.position.z+.18,true);
      bubbleCount++;bubbleTime=.14;
    }
    for(let i=0;i<count;i++){
      const p=particles[i];p.life-=dt;
      if(p.life>0){
        const surface=water.sampleWater(p.x,p.z);
        if(p.bubble){
          const verticalDrag=Math.exp(-dt*3),lateralDrag=Math.exp(-dt*.8);
          p.y+=.34*dt+(p.vy-.34)*(1-verticalDrag)/3;
          p.x+=p.vx*(1-lateralDrag)/.8;p.z+=p.vz*(1-lateralDrag)/.8;
          p.vy=.34+(p.vy-.34)*verticalDrag;p.vx*=lateralDrag;p.vz*=lateralDrag;
        }else{
          p.x+=p.vx*dt;p.y+=p.vy*dt-.5*9.81*dt*dt;p.z+=p.vz*dt;p.vy-=9.81*dt;
        }
        if(surface&&((p.bubble&&p.y>=surface.height)||(!p.bubble&&p.vy<0&&p.y<=surface.height))){
          water.disturb(surface.id,surface.u,surface.v,p.bubble?.0004:-.0018,p.bubble?.075:.11);p.life=0;
        }
      }
      transform.position.set(p.x,p.y,p.z);transform.scale.setScalar(p.life>0?p.scale:0);transform.updateMatrix();bubbles.setMatrixAt(i,transform.matrix);
    }
    bubbles.instanceMatrix.needsUpdate=true;
    uniforms.uDaylight.value=climate.daylight;
    uniforms.uImmersion.value=immersed?Math.max(0,location.height-camera.position.y):0;
    const status=document.querySelector('#water-status');
    if(status){status.hidden=!inWater;status.textContent=immersed?`${location?.name??'水下'} · 深度 ${uniforms.uImmersion.value.toFixed(1)} m · 空格上浮 / C 下潜`
      :state?.swimming?'水面游泳 · 空格上浮 / C 下潜':'浅水漫步 · 空格跳跃';}
    const jump=document.querySelector('#jump-button');
    if(jump?.querySelector('span'))jump.querySelector('span').textContent=state?.swimming?'上浮':'跳跃';
    document.querySelector('#experience').dataset.water=immersed?'underwater':inWater?'surface':'land';
  }
  function render(){
    if(uniforms.uImmersion.value<=0){renderer.render(scene,camera);return;}
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
    const savedTarget=renderer.getRenderTarget(),weatherVisible=weatherEffects.group.visible;
    const shadowAuto=renderer.shadowMap.autoUpdate,shadowUpdate=renderer.shadowMap.needsUpdate;
    try{
      weatherEffects.group.visible=false;
      renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(savedTarget);
      renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
      renderer.render(postScene,postCamera);
    }finally{
      renderer.setRenderTarget(savedTarget);weatherEffects.group.visible=weatherVisible;
      renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowUpdate;
    }
  }
  return {group,update,render,get snapshot(){return {immersion:uniforms.uImmersion.value,splashes:splashCount,bubbles:bubbleCount,activeParticles:particles.filter(p=>p.life>0).length};}};
}
