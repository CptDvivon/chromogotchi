// A Vat Pod: scratched glass, murky fluid, rusty caps — and the curled
// silhouette of the actual creature inside. Handles the hatch visuals too.

import * as THREE from 'three';
import { PALETTE } from '../core/palette';
import { Rng } from '../core/rng';
import type { HatchStage } from '../core/session';
import type { Creature } from './creature/buildCreature';

const R = 0.15;
const H = 0.42;
const BASE_H = 0.06;

const glassVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const glassFrag = /* glsl */ `
  uniform sampler2D tCracks;
  uniform float crack;
  uniform float highlight;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - abs(dot(vN, vView)), 2.0);
    vec3 col = vec3(0.05, 0.13, 0.14);
    float a = 0.05 + fres * 0.4;
    // Grime smears.
    a += 0.08 * step(0.7, fract(sin(floor(vUv.x * 24.0) * 12.9898) * 43758.5453)) * step(vUv.y, 0.35);
    vec4 c = texture2D(tCracks, vUv);
    if (c.a > 0.5 && c.r < crack) { col = vec3(0.55, 0.55, 0.5); a = 0.85; }
    // Selection: a cyan scan line sweeping up the glass.
    float scan = highlight * smoothstep(0.03, 0.0, abs(fract(time * 0.35) - vUv.y));
    col = mix(col, vec3(0.16, 0.94, 1.0), scan);
    a = max(a, scan * 0.8);
    gl_FragColor = vec4(col, a);
  }
`;

const fluidVert = /* glsl */ `
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    vPos = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fluidFrag = /* glsl */ `
  uniform float level;
  uniform float time;
  uniform float agitation;
  uniform vec3 tint;
  varying vec3 vPos;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float y01 = vPos.y / ${H.toFixed(3)} + 0.5;
    if (y01 > level) discard;
    float murk = n(vec2(vUv.x * 6.0, y01 * 4.0 - time * 0.05));
    vec3 col = tint * (0.35 + 0.5 * murk);
    // Bubbles rising in columns; more when agitated.
    vec2 g = vec2(vUv.x * 18.0, y01 * 10.0 - time * (0.6 + agitation * 2.0));
    vec2 cell = floor(g);
    float present = step(1.0 - (0.08 + agitation * 0.35), h(cell));
    float d = length(fract(g) - vec2(0.5, 0.5));
    float bubble = present * smoothstep(0.22, 0.12, d);
    col = mix(col, vec3(0.22, 0.3, 0.1), bubble * 0.8);
    gl_FragColor = vec4(col, 0.66 + bubble * 0.2);
  }
`;

function crackTexture(seed: string): THREE.DataTexture {
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  const rng = new Rng(`${seed}:cracks`);
  // Random-walk cracks; red channel = when (0..1) that pixel cracks.
  for (let c = 0; c < 9; c++) {
    let x = rng.range(0, S), y = rng.range(S * 0.2, S * 0.9);
    let angle = rng.range(0, Math.PI * 2);
    const start = rng.range(0, 0.5);
    const len = rng.int(80, 190);
    for (let i = 0; i < len; i++) {
      angle += rng.range(-0.6, 0.6);
      x = (x + Math.cos(angle) + S) % S;
      y = Math.max(0, Math.min(S - 1, y + Math.sin(angle)));
      const o = (Math.floor(y) * S + Math.floor(x)) * 4;
      data[o] = Math.floor(255 * Math.min(1, start + (i / len) * 0.5));
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, S, S);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Soft round puff for steam sprites. */
function steamTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

interface Shard { mesh: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3 }

export class Pod {
  readonly group = new THREE.Group();
  private glassMat: THREE.ShaderMaterial;
  private fluidMat: THREE.ShaderMaterial;
  private glass: THREE.Mesh;
  private fluid: THREE.Mesh;
  private topCap: THREE.Group;
  private lamp?: THREE.Mesh;
  private shards: Shard[] = [];
  /** Acid-green outline shown around the selected pod. */
  private outline: THREE.Mesh;
  private outlineMat: THREE.MeshBasicMaterial;
  private steam: THREE.Sprite[] = [];
  private rng: Rng;
  private disposables: { dispose(): void }[] = [];
  /** Creature scale while curled up inside the pod. */
  readonly embryoScale: number;
  private embryoOffset = new THREE.Vector3();
  burst = false;

  constructor(readonly creature: Creature, irregular: boolean) {
    this.rng = new Rng(`${creature.genome.seed}:pod`);
    const lambert = (color: string) => {
      const m = new THREE.MeshLambertMaterial({ color });
      this.disposables.push(m);
      return m;
    };
    const geo = <T extends THREE.BufferGeometry>(g: T) => {
      this.disposables.push(g);
      return g;
    };

    // Base and lid: rusted steel, a dented collar.
    const base = new THREE.Mesh(geo(new THREE.CylinderGeometry(R + 0.025, R + 0.04, BASE_H, 14)), lambert(PALETTE.rust));
    base.position.y = BASE_H / 2;
    base.castShadow = base.receiveShadow = true;
    this.group.add(base);
    this.topCap = new THREE.Group();
    const lid = new THREE.Mesh(geo(new THREE.CylinderGeometry(R + 0.02, R + 0.025, 0.06, 14)), lambert(PALETTE.rustDark));
    lid.castShadow = true;
    const valve = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8)), lambert(PALETTE.concrete));
    valve.position.y = 0.05;
    this.topCap.add(lid, valve);
    this.topCap.position.y = BASE_H + H + 0.03;
    this.group.add(this.topCap);
    if (irregular) {
      const lampMat = new THREE.MeshBasicMaterial({ color: PALETTE.amber });
      this.disposables.push(lampMat);
      this.lamp = new THREE.Mesh(geo(new THREE.SphereGeometry(0.018, 8, 6)), lampMat);
      this.lamp.position.set(0.09, 0.04, 0.09);
      this.topCap.add(this.lamp);
    }
    // Struts and duct tape.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const strut = new THREE.Mesh(geo(new THREE.BoxGeometry(0.02, H, 0.02)), lambert(PALETTE.tar));
      strut.position.set(Math.cos(a) * (R + 0.012), BASE_H + H / 2, Math.sin(a) * (R + 0.012));
      this.group.add(strut);
    }
    for (let i = 0; i < 2; i++) {
      const tape = new THREE.Mesh(geo(new THREE.BoxGeometry(0.09, 0.035, 0.005)), lambert(PALETTE.dust));
      const a = this.rng.range(-0.6, 0.6);
      tape.position.set(Math.sin(a) * (R + 0.003), BASE_H + this.rng.range(0.08, H - 0.05), Math.cos(a) * (R + 0.003));
      tape.rotation.set(0, a, this.rng.range(-0.5, 0.5));
      this.group.add(tape);
    }

    // The creature, curled and darkened inside the fluid.
    const a = creature.anatomy.bounds;
    const len = Math.max(a.max[2] - a.min[2], a.max[0] - a.min[0]) * 0.75;
    const ht = a.max[1] - a.min[1];
    this.embryoScale = Math.min((R * 1.6) / len, (H * 0.6) / ht);
    creature.group.scale.setScalar(this.embryoScale);
    this.embryoOffset.set(0, BASE_H + H * 0.5 - ((a.min[1] + a.max[1]) / 2) * this.embryoScale, -((a.min[2] + a.max[2]) / 2) * this.embryoScale * 0.6);
    creature.group.position.copy(this.embryoOffset);
    this.setSilhouette(true);
    this.group.add(creature.group);

    this.fluidMat = new THREE.ShaderMaterial({
      // Writes depth so the selection outline behind the pod is hidden through the fluid.
      vertexShader: fluidVert, fragmentShader: fluidFrag, transparent: true, depthWrite: true,
      uniforms: { level: { value: 1 }, time: { value: 0 }, agitation: { value: 0 }, tint: { value: new THREE.Color(PALETTE.bile) } },
    });
    this.fluid = new THREE.Mesh(geo(new THREE.CylinderGeometry(R - 0.005, R - 0.005, H, 18, 1)), this.fluidMat);
    this.fluid.position.y = BASE_H + H / 2;
    this.fluid.renderOrder = 1;
    this.group.add(this.fluid);

    const cracks = crackTexture(creature.genome.seed);
    this.disposables.push(cracks, this.fluidMat);
    this.glassMat = new THREE.ShaderMaterial({
      vertexShader: glassVert, fragmentShader: glassFrag, transparent: true, depthWrite: false,
      uniforms: { tCracks: { value: cracks }, crack: { value: 0 }, highlight: { value: 0 }, time: { value: 0 } },
    });
    this.disposables.push(this.glassMat);
    this.glass = new THREE.Mesh(geo(new THREE.CylinderGeometry(R, R, H, 18, 1, true)), this.glassMat);
    this.glass.position.y = BASE_H + H / 2;
    this.glass.renderOrder = 2;
    this.group.add(this.glass);

    // Selection outline: a slightly larger back-faced shell, drawn after the fluid
    // so only a thin rim around the pod's silhouette shows.
    this.outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.acid, side: THREE.BackSide, transparent: true });
    this.disposables.push(this.outlineMat);
    const shellH = BASE_H + H + 0.1;
    this.outline = new THREE.Mesh(geo(new THREE.CylinderGeometry(R + 0.02, R + 0.022, shellH - 0.02, 18)), this.outlineMat);
    this.outline.position.y = shellH / 2;
    this.outline.renderOrder = 3;
    this.outline.visible = false;
    this.group.add(this.outline);
  }

  /** Darken the creature into a silhouette (and hide its eyes) while inside. */
  setSilhouette(on: boolean) {
    const mat = this.creature.mesh.material as THREE.MeshLambertMaterial;
    mat.color.setScalar(on ? 0.12 : 1);
    for (const e of this.creature.eyes) e.visible = !on;
  }

  /** Curled foetal pose, with twitching scaled by `twitch` (0..1). */
  private pose(time: number, twitch: number) {
    const b = this.creature.bones;
    const j = (k: number) => (twitch > 0 ? Math.sin(time * (9 + k * 3.1) + k) * Math.max(0, Math.sin(time * 1.7 + k)) * twitch * 0.35 : 0);
    b.head.rotation.set(0.75 + j(1), j(2), 0);
    for (const leg of ['FL', 'FR']) {
      b[`leg${leg}U`].rotation.x = -1.0 + j(3);
      b[`leg${leg}L`].rotation.x = 1.6;
    }
    for (const leg of ['HL', 'HR']) {
      b[`leg${leg}U`].rotation.x = -0.9 + j(4);
      b[`leg${leg}L`].rotation.x = -1.4;
    }
    for (let i = 0; b[`tail${i}`]; i++) b[`tail${i}`].rotation.y = 0.5 + j(5 + i) * 0.5;
    for (let i = 0; b[`tailB${i}`]; i++) b[`tailB${i}`].rotation.y = -0.5;
    b.chest.scale.setScalar(1 + Math.sin(time * (twitch > 0.5 ? 3 : 1.2)) * 0.02);
  }

  /**
   * Per-frame update. `progress` is the hatch progress (null while just on display).
   */
  update(dt: number, time: number, selected: boolean, progress: number | null, stage: HatchStage | null) {
    this.glassMat.uniforms.time.value = time;
    this.fluidMat.uniforms.time.value = time;
    this.glassMat.uniforms.highlight.value = selected ? 1 : 0;
    this.outline.visible = selected;
    this.outlineMat.color.set(PALETTE.acid).multiplyScalar(0.75 + 0.25 * Math.sin(time * 5));
    if (this.lamp) this.lamp.visible = Math.sin(time * 5) > 0;

    if (!this.burst) {
      const p = progress ?? 0;
      const twitch = stage === 'stirring' ? 0.5 : stage === 'breaching' ? 1 : 0;
      this.pose(time, twitch);
      this.creature.group.position.y = this.embryoOffset.y + Math.sin(time * 0.8) * 0.006;
      this.fluidMat.uniforms.agitation.value = stage === 'stirring' ? 0.4 : stage === 'breaching' ? 1 : 0;
      // Breaching: glass cracks, fluid drains.
      const breach = Math.max(0, Math.min(1, (p - 0.6) / 0.32));
      this.glassMat.uniforms.crack.value = breach * 1.05;
      this.fluidMat.uniforms.level.value = 1 - breach * 0.55;
      if (stage === 'breaching') this.group.rotation.z = Math.sin(time * 40) * 0.01 * breach;
    }

    // Debris after the burst.
    for (const s of this.shards) {
      s.v.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.v, dt);
      if (s.mesh.position.y < 0.01) { s.mesh.position.y = 0.01; s.v.multiplyScalar(0.3); s.v.y = Math.abs(s.v.y) * 0.3; }
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.z += s.spin.z * dt;
    }
    for (const st of this.steam) {
      st.scale.multiplyScalar(1 + dt * 0.6);
      st.position.y += dt * 0.2;
      st.material.opacity = Math.max(0, st.material.opacity - dt * 0.2);
    }
    if (this.burst) {
      this.topCap.position.y += this.topCapV * dt;
      this.topCapV -= 9.8 * dt;
      if (this.topCap.position.y < 0.03) { this.topCap.position.y = 0.03; this.topCapV = 0; this.topCap.rotation.z = 1.2; }
    }
  }

  private topCapV = 0;

  /** The seal bursts: glass shatters, fluid gone, steam, lid pops. */
  shatter() {
    if (this.burst) return;
    this.burst = true;
    this.glass.visible = false;
    this.fluid.visible = false;
    this.topCapV = 1.6;
    this.topCap.position.x += 0.05;
    const shardMat = new THREE.MeshLambertMaterial({ color: PALETTE.dust, side: THREE.DoubleSide });
    const shardGeo = new THREE.PlaneGeometry(0.022, 0.04);
    this.disposables.push(shardMat, shardGeo);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(shardGeo, shardMat);
      const a = this.rng.range(0, Math.PI * 2);
      m.position.set(Math.cos(a) * R, BASE_H + this.rng.range(0.05, H), Math.sin(a) * R);
      this.group.add(m);
      this.shards.push({
        mesh: m,
        v: new THREE.Vector3(Math.cos(a) * this.rng.range(0.4, 1.4), this.rng.range(0.5, 2), Math.sin(a) * this.rng.range(0.4, 1.4)),
        spin: new THREE.Vector3(this.rng.range(-12, 12), 0, this.rng.range(-12, 12)),
      });
    }
    const puff = steamTexture();
    this.disposables.push(puff);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({ map: puff, color: PALETTE.dust, transparent: true, opacity: 0.4, depthWrite: false });
      this.disposables.push(mat);
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(this.rng.range(0.08, 0.14));
      s.position.set(this.rng.range(-0.1, 0.1), BASE_H + this.rng.range(0.1, 0.35), this.rng.range(-0.1, 0.1));
      this.group.add(s);
      this.steam.push(s);
    }
  }

  /** Detach the creature (it now belongs to the den). */
  releaseCreature(): Creature {
    this.setSilhouette(false);
    this.group.remove(this.creature.group);
    return this.creature;
  }

  /** Raycast target for taps. */
  get hitTarget(): THREE.Object3D {
    return this.glass;
  }

  dispose(disposeCreature: boolean) {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
    if (disposeCreature) this.creature.dispose();
  }
}
