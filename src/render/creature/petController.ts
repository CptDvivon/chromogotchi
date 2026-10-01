// Procedural life: wandering, gait, breathing, blinking, looking around —
// plus care behaviours: sleeping, eating at the bowl, zoomies, sickness.

import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import type { Creature } from './buildCreature';

type Mode = 'idle' | 'turn' | 'walk' | 'eat';

/** What the care sim says about the pet right now. */
export interface PetCondition {
  asleep: boolean;
  sick: boolean;
  /** 0..1: low energy, hunger or health make the pet sluggish. */
  vigor: number;
}

// Lateral-sequence walk: hind-left, fore-left, hind-right, fore-right.
const GAIT: Record<string, number> = { HL: 0, FL: 0.25, HR: 0.5, FR: 0.75 };

export class PetController {
  private mode: Mode = 'idle';
  private modeTime = 0;
  private idleFor = 2;
  private target = new THREE.Vector3();
  private phase = 0;
  private blinkIn = 2;
  private blinkT = -1;
  private lookTarget: THREE.Vector3 | null = null;
  private lookUntil = 0;
  private headYaw = 0;
  private headPitch = 0;
  private wanderYaw = 0;
  private earTwitch = { side: 'earL', t: -1 };
  private time = 0;
  private stride: number;
  private scale: number;
  private readonly tails = new Map<string, THREE.Bone[]>();
  private condition: PetCondition = { asleep: false, sick: false, vigor: 1 };
  /** 0 = standing, 1 = fully lying down asleep. */
  private rest = 0;
  private zoomLeft = 0;
  private hop = -1;
  private meal?: { bowl: THREE.Vector3; onProgress: (p: number) => void; t: number };

  constructor(
    private creature: Creature,
    private bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    private rng: Rng,
  ) {
    this.scale = creature.group.scale.x;
    this.stride = 0.16 * creature.genome.body.legLength * this.scale;
    for (const prefix of ['tail', 'tailB']) {
      const chain: THREE.Bone[] = [];
      for (let i = 0; creature.bones[`${prefix}${i}`]; i++) chain.push(creature.bones[`${prefix}${i}`]);
      if (chain.length) this.tails.set(prefix, chain);
    }
  }

  setCondition(c: PetCondition) {
    if (c.asleep && !this.condition.asleep) {
      this.meal = undefined;
      this.zoomLeft = 0;
      this.setMode('idle');
    }
    this.condition = c;
  }

  /** Look at a world point for a few seconds (e.g. the player's finger). */
  lookAt(point: THREE.Vector3, seconds = 2.5) {
    this.lookTarget = point.clone();
    this.lookUntil = this.time + seconds;
  }

  /** Walk to the bowl and eat; reports eating progress 0..1. */
  goEat(bowl: THREE.Vector3, onProgress: (p: number) => void) {
    if (this.condition.asleep) return;
    this.meal = { bowl: bowl.clone(), onProgress, t: 0 };
    this.zoomLeft = 0;
    const g = this.creature.group.position;
    const away = new THREE.Vector3(g.x - bowl.x, 0, g.z - bowl.z).normalize();
    const reach = this.creature.anatomy.head[2] * this.scale + 0.05 * this.scale;
    this.target.set(bowl.x + away.x * reach, 0, bowl.z + away.z * reach);
    this.setMode('turn');
  }

  /** A burst of frantic running around. */
  zoomies(count = 6) {
    if (this.condition.asleep) return;
    this.meal = undefined;
    this.zoomLeft = count;
    this.pickTarget();
    this.setMode('turn');
  }

  /** Small happy hop + look at the camera (petting). */
  react(camera: THREE.Vector3) {
    if (this.condition.asleep) return;
    this.hop = 0;
    this.lookAt(camera, 2);
  }

  update(dt: number) {
    this.time += dt;
    this.modeTime += dt;
    const g = this.creature.group;
    const b = this.creature.bones;
    const c = this.condition;
    const zoom = this.zoomLeft > 0 ? 2.6 : 1;
    const speed = 0.2 * this.scale * (0.45 + 0.55 * c.vigor) * (c.sick ? 0.7 : 1) * zoom;
    let moving = 0;

    // Lying down / getting up.
    this.rest = this.approach(this.rest, c.asleep ? 1 : 0, dt * 1.5);
    const asleep = this.rest > 0.05;

    if (!asleep) {
      if (this.mode === 'idle' && this.modeTime > this.idleFor) {
        this.pickTarget();
        this.setMode('turn');
      }
      if (this.mode === 'turn' || this.mode === 'walk') {
        const dx = this.target.x - g.position.x, dz = this.target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = want - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.2 * zoom);
        if (this.mode === 'turn') {
          moving = 0.5;
          if (Math.abs(diff) < 0.25) this.setMode('walk');
        } else {
          const step = Math.min(dist, speed * dt);
          g.position.x += Math.sin(g.rotation.y) * step;
          g.position.z += Math.cos(g.rotation.y) * step;
          moving = 1;
          if (dist < 0.02) this.arrive();
        }
      }
      if (this.mode === 'eat' && this.meal) {
        // Face the bowl, head down, chew.
        const m = this.meal;
        const want = Math.atan2(m.bowl.x - g.position.x, m.bowl.z - g.position.z);
        let diff = want - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 4);
        m.t += dt;
        m.onProgress(Math.min(1, m.t / 5));
        if (m.t >= 5) {
          this.meal = undefined;
          this.setMode('idle');
          this.idleFor = this.rng.range(2, 5);
        }
      }
    }
    this.phase += (moving * speed * dt) / this.stride + (moving > 0 && moving < 1 ? dt * 0.8 : 0);

    // Legs: gait while moving, folded when lying down.
    for (const [leg, off] of Object.entries(GAIT)) {
      const a = (this.phase + off) * Math.PI * 2;
      const hind = leg[0] === 'H';
      const swing = Math.sin(a) * 0.45 * (moving > 0 ? 1 : 0);
      const lift = Math.max(0, Math.cos(a)) * 0.6 * (moving > 0 ? 1 : 0);
      const foldU = hind ? -0.9 : -1.1;
      const foldL = hind ? -1.5 : 1.7;
      b[`leg${leg}U`].rotation.x = this.approach(b[`leg${leg}U`].rotation.x, swing * (1 - this.rest) + foldU * this.rest, dt * 12);
      b[`leg${leg}L`].rotation.x = this.approach(b[`leg${leg}L`].rotation.x, (hind ? -lift : lift) * (1 - this.rest) + foldL * this.rest, dt * 12);
    }

    // Body: bob when walking, sink when lying, hop when petted, shiver when sick.
    const restY = this.creature.anatomy.bones[1].pos[1];
    let y = restY + (moving ? Math.abs(Math.sin(this.phase * Math.PI * 2)) * 0.006 : 0);
    y -= this.rest * restY * 0.55;
    if (this.hop >= 0) {
      this.hop += dt;
      y += Math.sin(Math.min(1, this.hop / 0.35) * Math.PI) * 0.03;
      if (this.hop > 0.35) this.hop = -1;
    }
    b.body.position.y = y;
    b.body.position.x = c.sick && Math.sin(this.time * 0.9) > 0.6 ? Math.sin(this.time * 60) * 0.002 : 0;
    const breath = Math.sin(this.time * (asleep ? 0.9 : 1.7));
    b.chest.scale.set(1 + breath * 0.025, 1 + breath * (asleep ? 0.05 : 0.035), 1);

    // Tail(s): slow sway, livelier when walking, curled when asleep.
    for (const [prefix, bones] of this.tails) {
      bones.forEach((t, i) => {
        const off = prefix === 'tailB' ? 1.7 : 0;
        const sway = Math.sin(this.time * (1.1 + moving * zoom) - i * 0.6 + off) * (0.1 + i * 0.04);
        t.rotation.y = sway * (1 - this.rest) + 0.45 * this.rest;
        t.rotation.x = Math.sin(this.time * 0.6 + i + off) * 0.05 * (1 - this.rest) - 0.15 * this.rest;
      });
    }

    // Head: idle glances, track the look target, head down to eat, rest when asleep.
    let yaw = 0, pitch = 0;
    if (this.mode === 'eat') {
      pitch = 0.75 + Math.sin(this.time * 8) * 0.1;
    } else if (this.lookTarget && this.time < this.lookUntil) {
      const local = this.creature.group.worldToLocal(this.lookTarget.clone());
      const h = this.creature.anatomy.head;
      yaw = Math.atan2(local.x - h[0], local.z - h[2]);
      pitch = -Math.atan2(local.y - h[1], Math.hypot(local.x - h[0], local.z - h[2]));
    } else if (!moving) {
      if (this.modeTime % 4 < dt) this.wanderYaw = this.rng.range(-0.7, 0.7);
      yaw = this.wanderYaw;
      pitch = Math.sin(this.time * 0.4) * 0.1 + (c.vigor < 0.4 ? 0.25 : 0);
    }
    yaw *= 1 - this.rest;
    pitch = pitch * (1 - this.rest) + 0.45 * this.rest;
    this.headYaw = this.approach(this.headYaw, THREE.MathUtils.clamp(yaw, -0.9, 0.9), dt * 4);
    this.headPitch = this.approach(this.headPitch, THREE.MathUtils.clamp(pitch, -0.5, 0.9), dt * 4);
    b.head.rotation.set(this.headPitch + (moving ? Math.sin(this.phase * Math.PI * 4) * 0.03 : 0), this.headYaw, 0);

    // Eyes: blink; closed while asleep.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blinkT = 0; this.blinkIn = this.rng.range(2, 6); }
    let lid = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      lid = this.blinkT < 0.14 ? 0.1 : 1;
      if (this.blinkT > 0.14) this.blinkT = -1;
    }
    for (const eye of this.creature.eyes) {
      eye.scale.y = eye.scale.x * lid;
      eye.visible = !asleep;
    }

    // Ear twitch (also in sleep, occasionally).
    if (this.earTwitch.t < 0 && this.rng.chance(dt * (asleep ? 0.08 : 0.25))) this.earTwitch = { side: this.rng.pick(['earL', 'earR']), t: 0 };
    b.earL.rotation.z = b.earR.rotation.z = 0;
    if (this.earTwitch.t >= 0) {
      this.earTwitch.t += dt;
      const k = Math.sin(Math.min(1, this.earTwitch.t / 0.25) * Math.PI);
      b[this.earTwitch.side].rotation.z = (this.earTwitch.side === 'earL' ? 1 : -1) * k * 0.5;
      if (this.earTwitch.t > 0.25) this.earTwitch.t = -1;
    }
  }

  private arrive() {
    if (this.meal) {
      this.setMode('eat');
      return;
    }
    if (this.zoomLeft > 0) {
      this.zoomLeft--;
      if (this.zoomLeft > 0) {
        this.pickTarget();
        this.setMode('turn');
        return;
      }
    }
    this.setMode('idle');
    // Sluggish pets loiter longer.
    this.idleFor = this.rng.range(2, 7) * (1.5 - this.condition.vigor * 0.5);
  }

  private setMode(m: Mode) {
    this.mode = m;
    this.modeTime = 0;
  }

  private pickTarget() {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const g = this.creature.group.position;
    for (let i = 0; i < 10; i++) {
      this.target.set(this.rng.range(minX, maxX), 0, this.rng.range(minZ, maxZ));
      if (this.target.distanceTo(g) > 0.2 * this.scale) return;
    }
  }

  private approach(v: number, to: number, rate: number) {
    return v + (to - v) * Math.min(1, rate);
  }
}
