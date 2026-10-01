<script lang="ts">
  import { onMount } from 'svelte';
  import { CONFIG } from '../core/config';
  import type { Genome } from '../core/genome';
  import { SOURCES } from '../core/mutations';
  import { randomSeed } from '../core/rng';
  import { loadGame, newGame, saveGame, type GameState, type HatchStage } from '../core/session';
  import { MonitorView } from '../render/monitorView';
  import ControlDeck from './ControlDeck.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import HatchDeck from './HatchDeck.svelte';
  import PodDeck from './PodDeck.svelte';
  import { dev, pipeline, save } from './state.svelte';

  let canvas: HTMLCanvasElement;
  let view: MonitorView | undefined = $state();
  let game: GameState = $state(loadGame());
  let selected = $state(1);
  let stage: HatchStage | null = $state(null);
  let genome: Genome | undefined = $state();
  let reveal = $state(false);
  let lightsOn = $state(true);
  let log = $state('LINK ESTABLISHED // SUBJECT FEED LIVE');
  let clock = $state('');

  function setGame(g: GameState) {
    game = g;
    saveGame(g);
  }

  function enterPhase() {
    if (!view) return;
    stage = null;
    reveal = false;
    if (game.phase === 'select') {
      genome = undefined;
      void view.showPods(game.pods, selected);
    } else if (game.phase === 'hatching') {
      genome = undefined;
      view.startHatch(game.seed, game.startedAt, CONFIG.hatchMs);
    } else {
      const r = view.setPet(game.seed, SOURCES[game.source ?? 'starter']);
      genome = r.genome;
      dev.buildMs = Math.round(r.ms);
    }
  }

  /** Dev tools: drop a specific pet straight into the den. */
  function loadPet(seed: string) {
    setGame({ phase: 'den', seed, hatchedAt: Date.now(), source: dev.source });
    enterPhase();
  }

  function selectPod(i: number) {
    selected = i;
    view?.selectPod(i);
  }

  function incubate() {
    if (game.phase !== 'select' || !view) return;
    const seed = game.pods[selected];
    const startedAt = Date.now();
    setGame({ phase: 'hatching', seed, startedAt });
    view.startHatch(seed, startedAt, CONFIG.hatchMs, selected);
  }

  onMount(() => {
    if (new URLSearchParams(location.search).get('source') === 'dealer') dev.source = 'dealer';
    view = new MonitorView(canvas, { ...pipeline });
    view.onFps = (fps) => (dev.fps = fps);
    view.onPodTap = selectPod;
    view.onHatchStage = (s) => (stage = s);
    view.onHatched = (g) => {
      genome = g;
      setGame({ phase: 'den', seed: g.seed, hatchedAt: Date.now() });
      reveal = true;
      log = `SUBJECT ${g.designation} VIABLE // FEED LIVE`;
    };
    const urlSeed = new URLSearchParams(location.search).get('seed');
    if (urlSeed) {
      const r = view.setPet(urlSeed.toUpperCase(), SOURCES[dev.source]);
      genome = r.genome;
    } else {
      enterPhase();
    }
    const tick = () => (clock = new Date().toTimeString().slice(0, 8));
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

  function restart() {
    selected = 1;
    setGame(newGame());
    enterPhase();
    dev.open = false;
  }

  function skipHatch() {
    const t = view?.skipHatch();
    if (t && game.phase === 'hatching') setGame({ ...game, startedAt: t });
    dev.open = false;
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
      <span><span class="rec">●</span> REC CAM-01{game.phase === 'den' ? '' : ' // POD BAY'}</span>
      <span>{clock}</span>
    </div>
    <div class="osd bottom">
      {#if game.phase === 'select'}
        <span>{game.pods.length} PODS DETECTED</span>
        <span>TAP A POD TO SCAN</span>
      {:else if game.phase === 'hatching'}
        <span>INCUBATION IN PROGRESS</span>
        <span>DO NOT DISTURB</span>
      {:else if genome}
        <span>SUBJECT {genome.designation} "{genome.streetName.toUpperCase()}"</span>
        <span>{genome.species.toUpperCase()} // <span class="tier {genome.tier}">{genome.tier.toUpperCase()}</span></span>
      {/if}
    </div>
    {#if reveal && genome}
      <div class="reveal" role="dialog" aria-label="Subject viable">
        <div class="title">SUBJECT VIABLE</div>
        <div class="name">{genome.designation} "{genome.streetName.toUpperCase()}"</div>
        <div>{genome.species.toUpperCase()} // <span class="tier {genome.tier}">{genome.tier.toUpperCase()}</span></div>
        <button onclick={() => (reveal = false)}>ACKNOWLEDGE</button>
      </div>
    {/if}
  </section>

  {#if game.phase === 'select'}
    <PodDeck pods={game.pods} {selected} onSelect={selectPod} onIncubate={incubate} />
  {:else if game.phase === 'hatching'}
    <HatchDeck {stage} podId={game.seed.slice(-4)} />
  {:else}
    <ControlDeck {lightsOn} {log} onLights={toggleLights} onOffline={offline} />
  {/if}

  {#if dev.open}
    <DebugPanel
      seed={genome?.seed ?? ''}
      {genome}
      phase={game.phase}
      onSeed={(s) => loadPet(s)}
      onReroll={() => loadPet(randomSeed())}
      onRestart={restart}
      onSkipHatch={skipHatch}
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
  .reveal {
    position: absolute;
    left: 50%;
    top: 22%;
    transform: translateX(-50%);
    min-width: 70%;
    padding: 12px 14px;
    background: rgba(11, 7, 8, 0.88);
    border: 1px solid var(--phosphor-dim);
    text-align: center;
    font-size: 19px;
    color: var(--phosphor-hot);
    text-shadow: var(--glow);
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: crt-in 0.5s steps(6);
  }
  .reveal .title { font-family: var(--font-label); font-size: 14px; color: var(--cyan); text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
  .reveal .name { font-size: 24px; }
  .reveal button {
    margin-top: 6px;
    min-height: 44px;
    font-family: var(--font-label);
    font-size: 11px;
    color: var(--phosphor);
    border: 2px solid #3a1f16;
    background: #1f1210;
    border-radius: 6px;
  }
  @keyframes crt-in { from { transform: translateX(-50%) scaleY(0.02); } to { transform: translateX(-50%) scaleY(1); } }
  .tier.uncommon { color: var(--cyan); text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
  .tier.rare, .tier.epic { color: var(--magenta); text-shadow: 0 0 6px rgba(255, 46, 136, 0.5); }
  .tier.legendary, .tier.mythical { color: var(--white-hot); text-shadow: 0 0 8px rgba(255, 246, 224, 0.7); }
  .rec { color: var(--magenta); animation: blink 1.6s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .rec { animation: none; } .reveal { animation: none; } }
</style>
