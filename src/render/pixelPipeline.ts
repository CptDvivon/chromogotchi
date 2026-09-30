// Low-res render → palette quantize + ordered dither → CRT upscale.
// This is what turns plain 3D into the CHROMOGOTCHI look.

import * as THREE from 'three';
import { PALETTE_LIST, hexToRgb } from '../core/palette';

export interface PipelineSettings {
  /** Internal vertical resolution in pixels. */
  lowHeight: number;
  dither: boolean;
  quantize: boolean;
  crt: boolean;
  flicker: boolean;
}

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const quantizeFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 lowSize;
  uniform vec3 palette[${PALETTE_LIST.length}];
  uniform float ditherOn;
  uniform float quantizeOn;
  uniform float irOn;
  varying vec2 vUv;

  float bayer4(vec2 p) {
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i]) / 16.0 - 0.47;
  }

  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec3 c = toSRGB(clamp(texture2D(tScene, vUv).rgb, 0.0, 1.0));
    if (irOn > 0.5) {
      // Night-vision CCTV: luminance only, boosted, tinted to the phosphor ramp.
      float l = clamp(pow(dot(c, vec3(0.3, 0.59, 0.11)) * 1.9, 0.8), 0.0, 1.0);
      c = mix(vec3(0.04, 0.02, 0.02), vec3(1.0, 0.62, 0.3), l) * (0.35 + 0.75 * l);
    }
    if (quantizeOn < 0.5) { gl_FragColor = vec4(c, 1.0); return; }
    c += ditherOn * bayer4(floor(vUv * lowSize)) * 0.11;
    float best = 1e9; vec3 pick = palette[0];
    for (int i = 0; i < ${PALETTE_LIST.length}; i++) {
      vec3 d = c - palette[i];
      // Weighted distance: the eye is most sensitive to green.
      float dist = dot(d * d, vec3(0.3, 0.59, 0.11));
      if (dist < best) { best = dist; pick = palette[i]; }
    }
    gl_FragColor = vec4(pick, 1.0);
  }
`;

const crtFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D tLow;
  uniform vec2 lowSize;
  uniform float time;
  uniform float crtOn;
  uniform float flicker;
  varying vec2 vUv;

  vec2 curve(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 o = abs(uv.yx) / vec2(7.0, 6.0);
    uv = uv + uv * o * o;
    return uv * 0.5 + 0.5;
  }

  vec3 tap(vec2 uv) { return texture2D(tLow, uv).rgb; }

  void main() {
    if (crtOn < 0.5) { gl_FragColor = vec4(tap(vUv), 1.0); return; }
    vec2 uv = curve(vUv);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.02, 0.012, 0.012, 1.0); return; }

    // Slight colour fringing towards the edges.
    vec2 ca = (uv - 0.5) * 0.0035;
    vec3 col = vec3(tap(uv + ca).r, tap(uv).g, tap(uv - ca).b);

    // Phosphor glow: bright neighbours bleed a little.
    vec2 px = 1.0 / lowSize;
    vec3 glow = vec3(0.0);
    glow += max(tap(uv + vec2(px.x, 0.0)) - 0.55, 0.0);
    glow += max(tap(uv - vec2(px.x, 0.0)) - 0.55, 0.0);
    glow += max(tap(uv + vec2(0.0, px.y)) - 0.55, 0.0);
    glow += max(tap(uv - vec2(0.0, px.y)) - 0.55, 0.0);
    col += glow * 0.35;

    // Scanlines locked to the low-res rows.
    float row = fract(uv.y * lowSize.y);
    col *= 0.78 + 0.22 * smoothstep(0.0, 0.35, row) * smoothstep(1.0, 0.65, row);

    // Vignette + gentle flicker + a slow rolling band.
    vec2 v = uv * (1.0 - uv.yx);
    col *= pow(v.x * v.y * 18.0, 0.22);
    col *= 1.0 - flicker * (0.025 * sin(time * 53.0) + 0.04 * smoothstep(0.96, 1.0, sin(uv.y * 3.0 - time * 1.3)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class PixelPipeline {
  readonly renderer: THREE.WebGLRenderer;
  private low: THREE.WebGLRenderTarget;
  private quant: THREE.WebGLRenderTarget;
  private quantMat: THREE.ShaderMaterial;
  private crtMat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  settings: PipelineSettings;
  /** Night-vision mode (lights off). */
  ir = false;
  lowSize = new THREE.Vector2(1, 1);

  constructor(canvas: HTMLCanvasElement, settings: PipelineSettings) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;

    const rt = () => new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType,
    });
    this.low = rt();
    this.quant = rt();
    this.quant.depthBuffer = false;

    const palette = PALETTE_LIST.map((h) => {
      const [r, g, b] = hexToRgb(h);
      return new THREE.Vector3(r / 255, g / 255, b / 255);
    });
    this.quantMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert, fragmentShader: quantizeFrag,
      uniforms: {
        tScene: { value: this.low.texture }, lowSize: { value: this.lowSize },
        palette: { value: palette }, ditherOn: { value: 1 }, quantizeOn: { value: 1 }, irOn: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });
    this.crtMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert, fragmentShader: crtFrag,
      uniforms: {
        tLow: { value: this.quant.texture }, lowSize: { value: this.lowSize },
        time: { value: 0 }, crtOn: { value: 1 }, flicker: { value: 1 },
      },
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quantMat);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);
  }

  /** Resize to the canvas' CSS size; returns the low-res aspect ratio. */
  resize(width: number, height: number): number {
    this.renderer.setSize(width, height, false);
    const h = this.settings.lowHeight;
    const w = Math.max(1, Math.round((h * width) / height));
    this.lowSize.set(w, h);
    this.low.setSize(w, h);
    this.quant.setSize(w, h);
    return width / height;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number) {
    const s = this.settings;
    const r = this.renderer;
    r.setRenderTarget(this.low);
    r.render(scene, camera);

    this.quantMat.uniforms.ditherOn.value = s.dither ? 1 : 0;
    this.quantMat.uniforms.quantizeOn.value = s.quantize ? 1 : 0;
    this.quantMat.uniforms.irOn.value = this.ir ? 1 : 0;
    this.quad.material = this.quantMat;
    r.setRenderTarget(this.quant);
    r.render(this.postScene, this.postCam);

    this.crtMat.uniforms.time.value = time;
    this.crtMat.uniforms.crtOn.value = s.crt ? 1 : 0;
    this.crtMat.uniforms.flicker.value = s.flicker ? 1 : 0;
    this.quad.material = this.crtMat;
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }

  dispose() {
    this.low.dispose();
    this.quant.dispose();
    this.quantMat.dispose();
    this.crtMat.dispose();
    this.renderer.dispose();
  }
}
