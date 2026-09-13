import * as THREE from 'three';
import {createWobbleCharacter,animateCharacter} from './models.js';
import {dressPolice,updatePoliceAccessories} from './police-accessories.js';
import {poseAim} from './original/characters.js';
import {PoliceIntro} from './police-intro.js';
import './police-intro.css';

export function createPatrolVisuals(scene) {
  const models=new Map();
  let encounter=null,game=null;
  const intro=new PoliceIntro(scene,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
    onSkip:()=>{if(game?.encounter)game.encounter.elapsed=game.encounter.duration;}});
  return {
    models,
    update(g,dt,time) {
      game=g;
      for(const c of g.patrols) {
        let model=models.get(c.id);
        if(!model){model=createWobbleCharacter('officer');model.userData.patrolId=c.id;models.set(c.id,model);scene.add(model);}
        const rig=model.userData.rig;
        model.visible=!!rig;
        if(!rig)continue;
        if(!rig.police)dressPolice(rig);
        model.position.set(c.x,(c.y||0)+.02,c.z);
        rig.aiming=c.officerActive&&!c.reaction;
        const heading=c.officerActive?Math.atan2(g.player.x-c.x,-(g.player.z-c.z)):c.heading;
        animateCharacter(model,g.mode==='encounter'?0:dt,time,{heading,speed:c.speed,reaction:c.reaction,attack:c.attack,hurt:c.hurt});
        if(rig.aiming){
          rig.aimTarget=new THREE.Vector3(g.player.x,(g.player.y||0)+1.12,g.player.z);
          rig.recoil=c.recoil||0;rig.flashTime=c.flashTime||0;
          poseAim(rig,rig.aimTarget,{recoil:rig.recoil});
        }else{rig.flashTime=0;rig.recoil=0;}
        updatePoliceAccessories(rig);
        if(rig.aiming){c.muzzleOrigin=rig.muzzle.getWorldPosition(new THREE.Vector3());c.muzzleDirection=rig.muzzle.getWorldDirection(new THREE.Vector3());}else {c.muzzleOrigin=null;c.muzzleDirection=null;}
      }
    },
    camera(g,officers,goal,look) {
      document.body.classList.toggle('police-encounter-active',g.mode==='encounter');
      if(g.mode!=='encounter') {if(encounter){intro.cancel();encounter=null;}return;}
      if(encounter!==g.encounter) {
        const i=g.police.findIndex(c=>c.id===g.encounter.copId),rig=officers[i]?.userData.rig;
        if(!rig)return;
        officers[i].updateWorldMatrix(true,true);
        encounter=g.encounter;encounter.duration=intro.duration;intro.start(rig);
      }
      intro.update(Math.max(0,encounter.elapsed-intro.elapsed));
      const shot=intro.camera();
      const blend=Math.min(1,Math.max(0,(encounter.elapsed-encounter.duration)/intro.returnDuration));
      const normalGoal=goal.clone(),normalLook=look.clone();
      goal.set(shot.x,shot.y,shot.z).lerp(normalGoal,blend);
      look.set(shot.lookX,shot.lookY,shot.lookZ).lerp(normalLook,blend);
    },
  };
}
