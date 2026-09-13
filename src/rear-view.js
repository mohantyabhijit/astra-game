import * as THREE from 'three';

export function createRearView(renderer, scene) {
  const frame=document.createElement('aside');
  frame.id='rear-view';frame.hidden=true;frame.setAttribute('aria-label','Live rear-view mirror');
  const label=document.createElement('span');label.textContent='REAR VIEW';frame.append(label);document.body.append(frame);
  const camera=new THREE.PerspectiveCamera(68,3,0.15,420);
  const target=new THREE.WebGLRenderTarget(600,200,{depthBuffer:true});
  target.texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Scene(),screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const geometry=new THREE.PlaneGeometry(2,2),uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
  screen.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:target.texture,depthTest:false,depthWrite:false,toneMapped:false})));
  let bounds,lastFrame=-Infinity;
  function resize(){bounds=frame.getBoundingClientRect();camera.aspect=bounds.width/bounds.height;camera.updateProjectionMatrix();target.setSize(Math.min(640,Math.round(bounds.width*renderer.getPixelRatio())),Math.min(240,Math.round(bounds.height*renderer.getPixelRatio())));}
  addEventListener('resize',()=>{if(!frame.hidden)resize();});
  return {camera,frame,update(g,time){
    const visible=g.mode==='driving'&&g.status==='running';
    if(!visible){frame.hidden=true;return;}
    if(frame.hidden){frame.hidden=false;resize();lastFrame=-Infinity;}
    const p=g.player,fx=Math.sin(p.heading),fz=-Math.cos(p.heading),rear=(p.halfL||2.5)+.3;
    camera.position.set(p.x-fx*rear,(p.y||0)+2.25,p.z-fz*rear);
    camera.lookAt(p.x-fx*40,(p.y||0)+1.6,p.z-fz*40);
    const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear,shadows=renderer.shadowMap.autoUpdate;
    try{
      if(time-lastFrame>=1/30){
        renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.autoClear=true;renderer.render(scene,camera);renderer.setRenderTarget(null);lastFrame=time;
      }
      renderer.autoClear=false;renderer.setViewport(bounds.left,innerHeight-bounds.bottom,bounds.width,bounds.height);renderer.setScissor(bounds.left,innerHeight-bounds.bottom,bounds.width,bounds.height);renderer.setScissorTest(true);renderer.clearDepth();renderer.render(screen,screenCamera);
    }finally{
      renderer.setRenderTarget(null);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadows;
    }
  }};
}
