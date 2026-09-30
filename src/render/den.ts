// The den: a cramped corner of a squat apartment, built entirely in code.

import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { PALETTE } from '../core/palette';
import { Rng } from '../core/rng';

export interface Den {
  scene: THREE.Scene;
  /** Area the pet may walk in (x/z rectangle on the floor). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  setLights(on: boolean): void;
  update(time: number): void;
}

const rng = new Rng('den-v1');
const noise = createNoise2D(() => rng.float());

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** Noisy grime: base colour with blotches and drips. */
function grime(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, dark: string, light: string, drips: boolean) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = noise(x / 18, y / 18) * 0.6 + noise(x / 5, y / 5) * 0.4;
      if (n > 0.45) { ctx.fillStyle = light; ctx.fillRect(x, y, 1, 1); }
      else if (n < -0.4) { ctx.fillStyle = dark; ctx.fillRect(x, y, 1, 1); }
    }
  if (drips) {
    ctx.fillStyle = dark;
    for (let i = 0; i < 14; i++) {
      const x = rng.int(0, w), len = rng.int(h * 0.2, h * 0.8), y0 = rng.int(0, h * 0.3);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y0, 1, len);
    }
    ctx.globalAlpha = 1;
  }
}

export function createDen(): Den {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.void);

  const lambert = (opts: THREE.MeshLambertMaterialParameters) => new THREE.MeshLambertMaterial(opts);

  // Floor: stained concrete.
  const floorTex = canvasTexture(96, 96, (ctx) => {
    grime(ctx, 96, 96, PALETTE.soot, PALETTE.tar, PALETTE.mold, false);
    ctx.fillStyle = PALETTE.rustDark;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(rng.int(0, 96), rng.int(0, 96), rng.int(4, 12), rng.int(3, 8), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), lambert({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.4;
  floor.receiveShadow = true;
  scene.add(floor);

  // Walls: water-stained, peeling.
  const wallTex = canvasTexture(128, 96, (ctx) => {
    grime(ctx, 128, 96, PALETTE.mold, PALETTE.soot, PALETTE.concrete, true);
    // A scrawled tag.
    ctx.strokeStyle = PALETTE.magentaDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let x = 92, y = 30;
    ctx.moveTo(x, y);
    for (let i = 0; i < 9; i++) { x += rng.range(-3, 6); y += rng.range(-8, 8); ctx.lineTo(x, y); }
    ctx.stroke();
  });
  const wallMat = lambert({ map: wallTex });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-0.85, 1, 0.5);
  left.receiveShadow = true;
  scene.add(left);

  // Window: a hole in the back wall looking out at the city.
  const frameMat = lambert({ color: PALETTE.tar });
  const winX = -0.18, winY = 0.95, winW = 0.62, winH = 0.62;
  const cityTex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = PALETTE.night; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 9; i++) {
      const bx = i * 7 + rng.int(-2, 2), bw = rng.int(6, 10), bh = rng.int(20, 58);
      ctx.fillStyle = i % 2 ? PALETTE.tar : PALETTE.soot;
      ctx.fillRect(bx, 64 - bh, bw, bh);
      for (let wy = 64 - bh + 2; wy < 62; wy += 3)
        for (let wx = bx + 1; wx < bx + bw - 1; wx += 2)
          if (rng.chance(0.18)) { ctx.fillStyle = rng.pick([PALETTE.amber, PALETTE.amberPale, PALETTE.cyanDeep]); ctx.fillRect(wx, wy, 1, 1); }
    }
  });
  const city = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: cityTex }));
  city.position.set(winX, 0.9, -2.6);
  scene.add(city);
  // Back wall with a window hole: four slabs around it.
  const slab = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, -0.9);
    m.receiveShadow = true;
    scene.add(m);
  };
  const wl = winX - winW / 2, wr = winX + winW / 2, wb = winY - winH / 2, wt = winY + winH / 2;
  slab(wl + 1.5, 2, (-1.5 + wl) / 2, 1);
  slab(1.5 - wr, 2, (wr + 1.5) / 2, 1);
  slab(winW, wb, winX, wb / 2);
  slab(winW, 2 - wt, winX, (wt + 2) / 2);
  for (const [w, h, x, y] of [[winW + 0.06, 0.04, winX, wb], [winW + 0.06, 0.04, winX, wt], [0.04, winH, wl, winY], [0.04, winH, wr, winY], [0.025, winH, winX, winY]] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameMat);
    f.position.set(x, y, -0.88);
    scene.add(f);
  }

  // Neon sign outside: "LIVE MEAT", flickering.
  const signTex = canvasTexture(64, 16, (ctx) => {
    ctx.fillStyle = PALETTE.tar; ctx.fillRect(0, 0, 64, 16);
    ctx.font = 'bold 11px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillText('LIVE MEAT', 3, 8);
  });
  signTex.wrapS = signTex.wrapT = THREE.ClampToEdgeWrapping;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), signMat);
  sign.position.set(winX + 0.05, 0.86, -1.5);
  sign.rotation.y = -0.25;
  scene.add(sign);

  // Rain on the glass.
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float time; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float col = floor(vUv.x * 40.0);
        float speed = 0.6 + h(col) * 0.8;
        float y = fract(vUv.y + time * speed + h(col * 7.0));
        float streak = step(0.93, y) * step(0.5, h(col * 3.1));
        gl_FragColor = vec4(vec3(0.6, 0.75, 0.8), streak * 0.5);
      }`,
  });
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), rainMat);
  rain.position.set(winX, winY, -0.905);
  scene.add(rain);

  // Mattress with a filthy blanket.
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.2), lambert({ color: PALETTE.concrete }));
  mattress.position.set(0.8, 0.06, -0.25);
  mattress.castShadow = mattress.receiveShadow = true;
  scene.add(mattress);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.6), lambert({ color: PALETTE.rust }));
  blanket.position.set(0.76, 0.135, 0.0);
  blanket.rotation.y = 0.15;
  blanket.castShadow = blanket.receiveShadow = true;
  scene.add(blanket);

  // Food bowl (dented steel) and a crate.
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.04, 12, 1, true), lambert({ color: PALETTE.concrete, side: THREE.DoubleSide }));
  bowl.position.set(-0.52, 0.02, 0.3);
  bowl.castShadow = true;
  scene.add(bowl);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), lambert({ color: PALETTE.rustDark }));
  crate.position.set(-0.62, 0.15, -0.66);
  crate.rotation.y = 0.3;
  crate.castShadow = crate.receiveShadow = true;
  scene.add(crate);

  // Cable sagging along the wall.
  const cablePts = Array.from({ length: 12 }, (_, i) => new THREE.Vector3(-0.84, 1.5 - Math.sin((i / 11) * Math.PI) * 0.25, -0.85 + i * 0.12));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 20, 0.008, 4), lambert({ color: PALETTE.tar }));
  scene.add(cable);

  // Fluorescent tube on the back wall.
  const tubeMat = new THREE.MeshBasicMaterial({ color: PALETTE.whiteHot });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), tubeMat);
  tube.position.set(0.35, 1.45, -0.87);
  scene.add(tube);

  // Lights.
  const ambient = new THREE.AmbientLight(0x3a4a58, 0.45);
  scene.add(ambient);
  const fluoro = new THREE.SpotLight(0xdff5e6, 5, 5, 1.1, 0.6, 1.2);
  fluoro.position.set(0.35, 1.42, -0.8);
  fluoro.target.position.set(0, 0, 0.1);
  fluoro.castShadow = true;
  fluoro.shadow.mapSize.set(512, 512);
  fluoro.shadow.bias = -0.002;
  scene.add(fluoro, fluoro.target);
  const neon = new THREE.PointLight(PALETTE.magenta, 1.4, 4, 0.8);
  neon.position.set(winX, 0.95, -0.7);
  scene.add(neon);
  // Warm fill from a bare bulb somewhere behind the camera, so faces read.
  const bulb = new THREE.PointLight(0xffb070, 2.2, 5, 1.2);
  bulb.position.set(0.5, 1.1, 1.6);
  scene.add(bulb);
  const cyanSpill = new THREE.PointLight(PALETTE.cyan, 0.5, 3, 1.5);
  cyanSpill.position.set(-0.8, 0.6, 0.9);
  scene.add(cyanSpill);

  let lightsOn = true;

  return {
    scene,
    bounds: { minX: -0.26, maxX: 0.22, minZ: -0.5, maxZ: 0.22 },
    setLights(on) {
      lightsOn = on;
      fluoro.visible = on;
      tube.material.color.set(on ? PALETTE.whiteHot : PALETTE.soot);
      ambient.intensity = on ? 0.45 : 0.3;
      bulb.visible = on;
    },
    update(time) {
      rainMat.uniforms.time.value = time;
      // Neon: mostly steady, with occasional stutters.
      const stutter = Math.sin(time * 2.1) > 0.97 || Math.sin(time * 13.7 + 1.3) > 0.995;
      const neonOn = stutter ? 0.15 : 1;
      signMat.color.setScalar(neonOn);
      neon.intensity = 1.4 * neonOn;
      if (lightsOn) {
        const buzz = Math.sin(time * 0.7) > 0.985 ? 0.35 : 1;
        fluoro.intensity = 5 * buzz;
      }
    },
  };
}
