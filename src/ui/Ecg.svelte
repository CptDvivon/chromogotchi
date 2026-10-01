<script lang="ts">
  // Scrolling heart-monitor trace. Progress is shown by rhythm, never by a timer.
  import { onMount } from 'svelte';

  interface Props { bpm: number; noise: number }
  let { bpm, noise }: Props = $props();
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(devicePixelRatio, 2);
    let raf = 0;
    let x = 0;
    let lastY = 0;
    let beatPhase = 0;
    let last = performance.now();
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.fillStyle = '#0b0708';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resize();
    // One beat: small P bump, sharp QRS spike, T wave.
    const wave = (t: number) => {
      if (t < 0.08) return Math.sin((t / 0.08) * Math.PI) * 0.12;
      if (t < 0.12) return 0;
      if (t < 0.14) return -0.15;
      if (t < 0.17) return 1;
      if (t < 0.2) return -0.3;
      if (t < 0.3) return 0;
      if (t < 0.42) return Math.sin(((t - 0.3) / 0.12) * Math.PI) * 0.25;
      return 0;
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = canvas.width, h = canvas.height;
      const speed = 70 * dpr; // px per second
      const steps = Math.max(1, Math.round(dt * speed));
      for (let i = 0; i < steps; i++) {
        beatPhase += (dt / steps) * (bpm / 60);
        if (beatPhase > 1) beatPhase -= 1;
        const v = wave(beatPhase) + (Math.random() - 0.5) * noise;
        const y = h * 0.62 - v * h * 0.5;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0b0708';
        ctx.fillRect(x, 0, 6 * dpr, h);
        ctx.strokeStyle = '#ff8c32';
        ctx.lineWidth = 2 * dpr;
        ctx.shadowColor = 'rgba(255,120,40,0.8)';
        ctx.shadowBlur = 4 * dpr;
        ctx.beginPath();
        ctx.moveTo(x - 1, lastY || y);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastY = y;
        x += 1;
        if (x >= w) { x = 0; lastY = 0; }
      }
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>

<canvas bind:this={canvas} aria-label="Heart monitor"></canvas>

<style>
  canvas { display: block; width: 100%; height: 64px; background: #0b0708; border: 1px solid #3a1f16; }
</style>
