<script lang="ts">
  import { onMount } from 'svelte';
  import type { Genome } from '../core/genome';
  import { randomSeed } from '../core/rng';
  import { SOURCES } from '../core/mutations';
  import { MonitorView } from '../render/monitorView';
  import ControlDeck from './ControlDeck.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import { dev, pipeline, save } from './state.svelte';

  let canvas: HTMLCanvasElement;
  let view: MonitorView | undefined = $state();
  let genome: Genome | undefined = $state();
  let lightsOn = $state(true);
  let log = $state('LINK ESTABLISHED // SUBJECT FEED LIVE');
  let clock = $state('');

  function initialSeed(): string {
    const fromUrl = new URLSearchParams(location.search).get('seed');
    if (fromUrl) return fromUrl.toUpperCase();
    try {
      return localStorage.getItem('cg.seed') ?? randomSeed();
    } catch {
      return randomSeed();
    }
  }

  function loadPet(seed: string) {
    if (!view) return;
    const r = view.setPet(seed, SOURCES[dev.source]);
    genome = r.genome;
    dev.buildMs = Math.round(r.ms);
    try { localStorage.setItem('cg.seed', seed); } catch { /* ignore */ }
  }

  onMount(() => {
    if (new URLSearchParams(location.search).get('source') === 'dealer') dev.source = 'dealer';
    view = new MonitorView(canvas, { ...pipeline });
    view.onFps = (fps) => (dev.fps = fps);
    loadPet(initialSeed());
    const tick = () => {
      const d = new Date();
      clock = d.toTimeString().slice(0, 8);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      view?.dispose();
    };
  });

  $effect(() => {
    const s = { ...pipeline };
    view?.updateSettings(s);
    save('cg.pipeline', s);
  });

  function toggleLights() {
    lightsOn = !lightsOn;
    view?.setLights(lightsOn);
    log = lightsOn ? 'LIGHTS ON // SUBJECT AWAKE' : 'LIGHTS OFF // SUBJECT RESTING';
  }

  function offline(label: string) {
    log = `${label} MODULE OFFLINE // PENDING FIRMWARE`;
  }
</script>

<div class="device">
  <header class="topbar">
    <span class="brand">CHROMOGOTCHI</span>
    <span class="sub">VET-LINK v0.1 [JAILBROKEN]</span>
    <button class="dbg" onclick={() => (dev.open = !dev.open)} aria-label="Toggle debug panel">DBG</button>
  </header>

  <section class="monitor">
    <canvas bind:this={canvas}></canvas>
    <div class="osd top">
      <span><span class="rec">●</span> REC CAM-01</span>
      <span>{clock}</span>
    </div>
    {#if genome}
      <div class="osd bottom">
        <span>SUBJECT {genome.designation} "{genome.streetName.toUpperCase()}"</span>
        <span>{genome.species.toUpperCase()} // <span class="tier {genome.tier}">{genome.tier.toUpperCase()}</span></span>
      </div>
    {/if}
  </section>

  <ControlDeck {lightsOn} {log} onLights={toggleLights} onOffline={offline} />

  {#if dev.open}
    <DebugPanel
      seed={genome?.seed ?? ''}
      {genome}
      onSeed={(s) => loadPet(s)}
      onReroll={() => loadPet(randomSeed())}
      onClose={() => (dev.open = false)}
    />
  {/if}
</div>

<style>
  .device {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 10px)
      calc(env(safe-area-inset-bottom) + 10px) calc(env(safe-area-inset-left) + 10px);
    gap: 8px;
    max-width: 520px;
    margin: 0 auto;
  }
  .topbar {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: var(--font-label);
    text-shadow: var(--glow);
  }
  .brand { font-weight: 700; font-size: 15px; letter-spacing: 1px; }
  .sub { color: var(--phosphor-dim); font-size: 9px; flex: 1; }
  .dbg {
    font-family: var(--font-label);
    font-size: 10px;
    color: var(--phosphor-dim);
    border: 1px solid var(--phosphor-dim);
    padding: 3px 6px;
    min-height: 28px;
  }
  .monitor {
    position: relative;
    flex: 1 1 62%;
    min-height: 0;
    background: #000;
    border: 6px solid var(--bezel);
    border-radius: 14px;
    box-shadow: inset 0 0 0 2px #2a1c1a, 0 0 24px rgba(255, 90, 30, 0.08);
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
  .osd {
    position: absolute;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    font-size: 17px;
    line-height: 1;
    color: var(--phosphor);
    text-shadow: var(--glow);
    pointer-events: none;
    opacity: 0.9;
  }
  .osd.top { top: 12px; }
  .osd.bottom { bottom: 12px; flex-direction: column; gap: 2px; }
  .tier.uncommon { color: var(--cyan); text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
  .tier.rare, .tier.epic { color: var(--magenta); text-shadow: 0 0 6px rgba(255, 46, 136, 0.5); }
  .tier.legendary, .tier.mythical { color: var(--white-hot); text-shadow: 0 0 8px rgba(255, 246, 224, 0.7); }
  .rec { color: var(--magenta); animation: blink 1.6s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .rec { animation: none; } }
</style>
