// Owns the renderer, the den, the pet and the frame loop for the monitor.

import * as THREE from 'three';
import { generateGenome, type Genome } from '../core/genome';
import { Rng } from '../core/rng';
import { createDen, type Den } from './den';
import { PixelPipeline, type PipelineSettings } from './pixelPipeline';
import { buildCreature, type Creature } from './creature/buildCreature';
import { PetController } from './creature/petController';

const FRAME = 1 / 30;

export class MonitorView {
  private pipeline: PixelPipeline;
  private den: Den;
  private camera = new THREE.PerspectiveCamera(36, 0.7, 0.05, 20);
  private creature?: Creature;
  private controller?: PetController;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private resizeObs: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
  onFps?: (fps: number) => void;
  private frames = 0;
  private inspectAngle: number | null = null;
  /** Infrared illuminator on the camera, only used in night vision. */
  private irLamp = new THREE.PointLight(0xffffff, 3, 6, 1);
  private fpsT = 0;

  constructor(private canvas: HTMLCanvasElement, settings: PipelineSettings) {
    this.pipeline = new PixelPipeline(canvas, settings);
    this.den = createDen();
    this.irLamp.visible = false;
    this.camera.add(this.irLamp);
    this.den.scene.add(this.camera);
    this.camera.position.set(0.05, 1.0, 1.85);
    this.camera.lookAt(0, 0.33, -0.2);
    // Dev: ?inspect=<angle in degrees> frames the pet up close and freezes it.
    const inspect = new URLSearchParams(location.search).get('inspect');
    if (inspect !== null) this.inspectAngle = (Number(inspect) * Math.PI) / 180;

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();

    canvas.addEventListener('pointerdown', this.onPointer);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.start();
  }

  /** Swap in a pet built from a seed. Returns the genome and build time. */
  setPet(seed: string): { genome: Genome; ms: number } {
    const t0 = performance.now();
    const genome = generateGenome(seed);
    if (this.creature) {
      this.den.scene.remove(this.creature.group);
      this.creature.dispose();
    }
    this.creature = buildCreature(genome);
    this.creature.group.position.set(-0.05, 0, 0);
    this.creature.group.rotation.y = 0.5;
    this.den.scene.add(this.creature.group);
    this.controller = new PetController(this.creature, this.den.bounds, new Rng(`${seed}:behaviour`));
    if (this.inspectAngle !== null) {
      const a = this.inspectAngle;
      this.creature.group.position.set(0, 0, 0);
      this.creature.group.rotation.y = 0;
      this.controller = undefined;
      this.camera.position.set(Math.sin(a) * 1.5, 0.45, Math.cos(a) * 1.5);
      this.camera.lookAt(0, 0.17, -0.05);
    }
    return { genome, ms: performance.now() - t0 };
  }

  setLights(on: boolean) {
    this.den.setLights(on);
    this.pipeline.ir = !on;
    this.irLamp.visible = !on;
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

  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
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
      const step = this.acc;
      this.acc = 0;
      this.time += step;
      this.controller?.update(step);
      this.den.update(this.time);
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
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.creature?.dispose();
    this.pipeline.dispose();
  }
}
