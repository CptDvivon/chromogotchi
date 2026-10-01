// Owns the renderer, the den, the pods/pet and the frame loop for the monitor.
// Three modes: the pod bay (choose a pod), hatching, and the den (live pet).

import * as THREE from 'three';
import { generateGenome, type Genome } from '../core/genome';
import { SOURCES, type Source } from '../core/mutations';
import { podReadout } from '../core/podReadout';
import { Rng } from '../core/rng';
import { hatchProgress, hatchStage, type HatchStage } from '../core/session';
import { createDen, type Den } from './den';
import { PixelPipeline, type PipelineSettings } from './pixelPipeline';
import { buildCreature, type Creature } from './creature/buildCreature';
import { PetController, type PetCondition } from './creature/petController';
import type { FoodKind } from '../core/care';
import type { Weather } from '../core/world';
import { PALETTE } from '../core/palette';
import { SPECIES_SCALE } from './creature/anatomy';
import { Pod } from './pod';

const FRAME = 1 / 30;
// Kept clear of the mattress (left edge x ≈ 0.58) and the crate.
const POD_X = [-0.4, -0.02, 0.36];
const POD_Z = -0.25;

type Mode =
  | { kind: 'empty' }
  | { kind: 'pods'; pods: Pod[]; selected: number }
  | { kind: 'hatch'; pod: Pod; startedAt: number; stage: HatchStage | null; emergeT: number; hatchMs: number }
  | { kind: 'den' };

export class MonitorView {
  private pipeline: PixelPipeline;
  private den: Den;
  private camera = new THREE.PerspectiveCamera(36, 0.7, 0.05, 20);
  private camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private camTo = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private camT = 1;
  private creature?: Creature;
  private controller?: PetController;
  private mode: Mode = { kind: 'empty' };
  private bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private shake = 0;
  private resizeObs: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
  private frames = 0;
  private fpsT = 0;
  private inspectAngle: number | null = null;

  onFps?: (fps: number) => void;
  /** The player tapped the pet. */
  onPetTap?: () => void;
  /** Called after every rendered frame (e.g. to position overlays). */
  onFrame?: () => void;
  onPodTap?: (index: number) => void;
  onHatchStage?: (stage: HatchStage) => void;
  /** Fired once the creature has fully emerged and is live in the den. */
  onHatched?: (genome: Genome) => void;

  constructor(private canvas: HTMLCanvasElement, settings: PipelineSettings) {
    this.pipeline = new PixelPipeline(canvas, settings);
    this.den = createDen();
    this.frameFor(1, false);
    // Dev: ?inspect=<angle in degrees> frames the pet up close and freezes it.
    const inspect = new URLSearchParams(location.search).get('inspect');
    if (inspect !== null) this.inspectAngle = (Number(inspect) * Math.PI) / 180;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointer);
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.start();
  }

  // ---------------------------------------------------------------- camera

  /**
   * Frames the camera for a pet of the given scale: small pets get a closer
   * camera (a rat's-eye room), big ones a wider view.
   */
  private frameFor(scale: number, animate = true) {
    const look = new THREE.Vector3(0, 0.33 * Math.min(1, scale * 1.1), -0.2);
    const pos = look.clone().add(new THREE.Vector3(0.05, 0.67, 2.05).multiplyScalar(scale));
    this.camFrom.pos.copy(this.camera.position);
    this.camFrom.look.copy(this.camTo.look);
    this.camTo.pos.copy(pos);
    this.camTo.look.copy(look);
    this.camT = animate ? 0 : 1;
    if (!animate) {
      this.camera.position.copy(pos);
      this.camera.lookAt(look);
    }
    const b = this.den.baseBounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    this.bounds = {
      minX: cx + (b.minX - cx) * scale, maxX: cx + (b.maxX - cx) * scale,
      minZ: cz + (b.minZ - cz) * scale, maxZ: cz + (b.maxZ - cz) * scale,
    };
  }

  private updateCamera(dt: number) {
    if (this.camT < 1) {
      this.camT = Math.min(1, this.camT + dt / 1.6);
      const k = this.camT * this.camT * (3 - 2 * this.camT);
      this.camera.position.lerpVectors(this.camFrom.pos, this.camTo.pos, k);
      this.camera.lookAt(new THREE.Vector3().lerpVectors(this.camFrom.look, this.camTo.look, k));
    }
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.02;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.02;
    }
  }

  // ---------------------------------------------------------------- modes

  private clear(keepCreature = false) {
    const m = this.mode;
    if (m.kind === 'pods') for (const p of m.pods) p.dispose(true);
    if (m.kind === 'hatch') m.pod.dispose(!keepCreature);
    if (!keepCreature && this.creature) {
      this.den.scene.remove(this.creature.group);
      this.creature.dispose();
      this.creature = undefined;
    }
    this.controller = undefined;
    this.stopLaser();
    this.mode = { kind: 'empty' };
    // A fresh room: no leftover waste, food or dimmed lights from a previous pet.
    this.den.setWaste(0);
    this.den.setBowl(null, 0);
    this.den.setLights(true);
    this.condition = { asleep: false, sick: false, vigor: 1 };
  }

  /** Pod bay: three pods to choose from. Built one per frame to avoid a stall. */
  async showPods(seeds: string[], selected = 1): Promise<void> {
    this.clear();
    this.frameFor(1, false);
    const pods: Pod[] = [];
    this.mode = { kind: 'pods', pods, selected };
    for (let i = 0; i < seeds.length; i++) {
      await new Promise((r) => setTimeout(r, 0));
      if (this.mode.kind !== 'pods' || this.mode.pods !== pods) return;
      const g = generateGenome(seeds[i]);
      const pod = new Pod(buildCreature(g), podReadout(g).irregular);
      pod.group.position.set(POD_X[i], 0, POD_Z);
      pod.group.rotation.y = (i - 1) * -0.25;
      this.den.scene.add(pod.group);
      pods.push(pod);
    }
  }

  selectPod(index: number) {
    if (this.mode.kind === 'pods') this.mode.selected = index;
  }

  /** Start (or resume) hatching a pod. Other pods are removed. */
  startHatch(seed: string, startedAt: number, hatchMs: number, fromIndex?: number) {
    let pod: Pod | undefined;
    if (this.mode.kind === 'pods' && fromIndex !== undefined && this.mode.pods[fromIndex]) {
      pod = this.mode.pods[fromIndex];
      this.mode.pods.forEach((p, i) => i !== fromIndex && p.dispose(true));
      this.mode = { kind: 'empty' };
    } else {
      this.clear();
      const g = generateGenome(seed);
      pod = new Pod(buildCreature(g), podReadout(g).irregular);
      pod.group.position.set(0, 0, POD_Z);
      this.den.scene.add(pod.group);
    }
    this.mode = { kind: 'hatch', pod, startedAt, stage: null, emergeT: -1, hatchMs };
  }

  /** Den mode with a pet built from a seed (dev tools / returning players). */
  setPet(seed: string, source: Source = SOURCES.starter): { genome: Genome; ms: number } {
    const t0 = performance.now();
    this.clear();
    const genome = generateGenome(seed, source);
    this.adopt(buildCreature(genome), false);
    return { genome, ms: performance.now() - t0 };
  }

  private adopt(creature: Creature, animate: boolean) {
    const genome = creature.genome;
    this.creature = creature;
    const scale = SPECIES_SCALE[genome.species] * genome.body.size;
    if (!animate) {
      creature.group.position.set(-0.05, 0, 0);
      creature.group.rotation.y = 0.5;
      creature.group.scale.setScalar(scale);
    }
    if (!creature.group.parent) this.den.scene.add(creature.group);
    this.mode = { kind: 'den' };
    if (this.inspectAngle !== null) {
      const a = this.inspectAngle;
      creature.group.position.set(0, 0, 0);
      creature.group.rotation.y = 0;
      const zoom = Number(new URLSearchParams(location.search).get('zoom') ?? 1);
      const look = new THREE.Vector3(0, 0.17 * scale, -0.05);
      if (zoom < 1) look.set(0, creature.anatomy.head[1] * scale, creature.anatomy.head[2] * scale);
      this.camera.position.set(Math.sin(a) * 1.5 * scale * zoom, 0.45 * scale * zoom + look.y * (1 - zoom), look.z + Math.cos(a) * 1.5 * scale * zoom);
      this.camera.lookAt(look);
      this.camT = 1;
      return;
    }
    this.frameFor(scale, animate);
    this.den.setFrame(scale);
    this.controller = new PetController(creature, this.bounds, new Rng(`${genome.seed}:behaviour`));
    this.controller.setCondition(this.condition);
  }

  private updateHatch(dt: number) {
    const m = this.mode;
    if (m.kind !== 'hatch') return;
    const p = hatchProgress(m.startedAt, Date.now(), m.hatchMs);
    const stage = hatchStage(p);
    if (stage !== m.stage) {
      m.stage = stage;
      this.onHatchStage?.(stage);
    }
    this.shake = stage === 'breaching' ? 0.15 + ((p - 0.6) / 0.32) * 0.5 : 0;
    this.den.setFlicker(stage === 'breaching' ? 0.5 : 0);
    m.pod.update(dt, this.time, false, p, stage);
    // Slide the chosen pod to centre stage.
    const g = m.pod.group;
    g.position.x += (0 - g.position.x) * Math.min(1, dt * 2);
    g.rotation.y += (0 - g.rotation.y) * Math.min(1, dt * 2);

    if (stage !== 'emergence') return;
    // Emergence: burst, then the creature unfolds onto the floor at full size.
    if (m.emergeT < 0) {
      m.emergeT = 0;
      m.pod.shatter();
      this.shake = 1;
    }
    m.emergeT += dt;
    const c = m.pod.creature;
    const k = Math.min(1, m.emergeT / 2.2);
    const ease = 1 - (1 - k) ** 3;
    const full = SPECIES_SCALE[c.genome.species] * c.genome.body.size;
    c.group.scale.setScalar(m.pod.embryoScale + (full - m.pod.embryoScale) * ease);
    c.group.position.y *= 1 - Math.min(1, dt * 6);
    c.group.position.z += (0.15 - c.group.position.z) * Math.min(1, dt * 2);
    for (const bone of Object.values(c.bones)) {
      bone.rotation.x *= 1 - Math.min(1, dt * 3);
      bone.rotation.y *= 1 - Math.min(1, dt * 3);
      bone.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 3));
    }
    if (m.emergeT > 0.4) m.pod.setSilhouette(false);
    if (m.emergeT > 2.6 && p >= 1) {
      // Hand the creature over to the den.
      const creature = m.pod.releaseCreature();
      const world = new THREE.Vector3();
      creature.group.getWorldPosition(world);
      creature.group.position.set(world.x, 0, world.z);
      creature.group.scale.setScalar(full);
      this.den.scene.add(creature.group);
      const pod = m.pod;
      this.mode = { kind: 'empty' };
      this.leftovers.push(pod);
      setTimeout(() => {
        pod.dispose(false);
        this.leftovers = this.leftovers.filter((x) => x !== pod);
      }, 20000);
      this.den.setFlicker(0);
      this.adopt(creature, true);
      this.onHatched?.(creature.genome);
    }
  }

  /** Pod debris (shards, lid, base) lingers for a while after hatching. */
  private leftovers: Pod[] = [];

  /** Dev: jump a running hatch to just before emergence. Returns the new start time. */
  skipHatch(): number | null {
    if (this.mode.kind !== 'hatch') return null;
    this.mode.startedAt = Date.now() - this.mode.hatchMs * 0.9;
    return this.mode.startedAt;
  }

  setLights(on: boolean) {
    this.den.setLights(on);
  }

  private condition: PetCondition = { asleep: false, sick: false, vigor: 1 };

  /** Push the care sim's view of the pet into the scene. */
  setCare(c: PetCondition & {
    waste: number; lightsOn: boolean; eating: boolean; bowl: { kind: FoodKind | null; amount: number };
  }) {
    this.condition = { asleep: c.asleep, sick: c.sick, vigor: c.vigor };
    this.controller?.setCondition(this.condition);
    this.controller?.setEating(c.eating, this.den.bowlPos);
    this.den.setWaste(c.waste);
    this.den.setLights(c.lightsOn);
    this.den.setBowl(c.bowl.kind, c.bowl.amount);
  }

  setWorld(hour: number, weather: Weather) {
    this.den.setTime(hour, weather);
  }

  // ------------------------------------------------------------ laser play

  private laser?: { group: THREE.Group; pos: THREE.Vector3; goal: THREE.Vector3; until: number; steered: number; next: number };

  /** A laser dot the pet chases; the player can drag it with a finger. */
  play(seconds = 16) {
    if (!this.controller || this.condition.asleep) return;
    this.stopLaser();
    const group = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), new THREE.MeshBasicMaterial({ color: PALETTE.magenta }));
    dot.rotation.x = -Math.PI / 2;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), new THREE.MeshBasicMaterial({
      color: PALETTE.magenta, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.rotation.x = -Math.PI / 2;
    group.add(dot, glow);
    group.position.y = 0.004;
    const start = this.creature!.group.position.clone().add(new THREE.Vector3(0.15, 0, 0.1));
    group.position.x = start.x;
    group.position.z = start.z;
    this.den.scene.add(group);
    this.laser = { group, pos: group.position, goal: start.clone(), until: this.time + seconds, steered: -10, next: 0 };
    this.controller.chase(() => this.laser?.pos ?? this.creature!.group.position, seconds);
  }

  private stopLaser() {
    if (!this.laser) return;
    this.laser.group.removeFromParent();
    this.laser.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.laser = undefined;
  }

  private updateLaser(dt: number) {
    const l = this.laser;
    if (!l) return;
    if (this.time > l.until || this.condition.asleep) {
      this.stopLaser();
      return;
    }
    // Wander erratically unless the player steered it recently.
    if (this.time - l.steered > 1.5 && this.time > l.next) {
      const b = this.bounds;
      l.goal.set(b.minX + Math.random() * (b.maxX - b.minX), 0, b.minZ + Math.random() * (b.maxZ - b.minZ));
      l.next = this.time + 0.5 + Math.random() * 1.2;
    }
    l.pos.x += (l.goal.x - l.pos.x) * Math.min(1, dt * 6);
    l.pos.z += (l.goal.z - l.pos.z) * Math.min(1, dt * 6);
    l.group.visible = Math.random() > 0.04; // cheap laser flicker
  }

  /** Where the pet's head is on screen (CSS px within the canvas), for the thought bubble. */
  headScreenPos(): { x: number; y: number } | null {
    if (!this.creature || this.mode.kind !== 'den') return null;
    const h = this.creature.anatomy.head;
    const p = new THREE.Vector3(h[0], h[1] + 0.09, h[2]);
    this.creature.group.localToWorld(p);
    p.project(this.camera);
    if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return null;
    return { x: ((p.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - p.y) / 2) * this.canvas.clientHeight };
  }

  clean() {
    this.den.setWaste(0);
  }

  updateSettings(s: PipelineSettings) {
    const resChanged = s.lowHeight !== this.pipeline.settings.lowHeight;
    this.pipeline.settings = { ...s };
    if (resChanged) this.resize();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.camera.aspect = this.pipeline.resize(w, h);
    this.camera.updateProjectionMatrix();
  }

  private floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointerDown = false;

  /** While playing, dragging on the monitor steers the laser dot. */
  private steerLaser(e: PointerEvent): boolean {
    if (!this.laser) return false;
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floor, hit)) return false;
    const b = this.bounds;
    this.laser.goal.set(THREE.MathUtils.clamp(hit.x, b.minX - 0.1, b.maxX + 0.1), 0, THREE.MathUtils.clamp(hit.z, b.minZ - 0.1, b.maxZ + 0.25));
    this.laser.steered = this.time;
    void e;
    return true;
  }

  private setRay(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown || !this.laser) return;
    this.setRay(e);
    this.steerLaser(e);
  };

  private onPointerUp = () => {
    this.pointerDown = false;
  };

  private onPointer = (e: PointerEvent) => {
    this.pointerDown = true;
    this.setRay(e);
    if (this.steerLaser(e)) return;
    if (this.mode.kind === 'pods') {
      const targets = this.mode.pods.map((p) => p.hitTarget);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      if (hit) this.onPodTap?.(targets.indexOf(hit.object));
      return;
    }
    if (this.creature && this.controller && this.raycaster.intersectObject(this.creature.mesh, false).length) {
      this.controller.react(this.camera.position);
      this.onPetTap?.();
      return;
    }
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.lookPlane, hit)) this.controller?.lookAt(hit);
  };

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      if (this.acc < FRAME) return; // cap at ~30 fps to save battery
      const step = Math.min(this.acc, 0.1);
      this.acc = 0;
      this.time += step;
      if (this.mode.kind === 'pods') {
        const sel = this.mode.selected;
        this.mode.pods.forEach((p, i) => p.update(step, this.time, i === sel, null, null));
      }
      this.updateHatch(step);
      for (const p of this.leftovers) p.update(step, this.time, false, 1, 'emergence');
      this.updateLaser(step);
      this.controller?.update(step);
      this.onFrame?.();
      this.den.update(this.time);
      this.updateCamera(step);
      this.pipeline.render(this.den.scene, this.camera, this.time);
      this.frames++;
      this.fpsT += step;
      if (this.fpsT >= 1) {
        this.onFps?.(Math.round(this.frames / this.fpsT));
        this.frames = 0;
        this.fpsT = 0;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.resizeObs.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.clear();
    this.pipeline.dispose();
  }
}
