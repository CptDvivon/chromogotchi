<script lang="ts">
  import { onMount } from 'svelte';
  import { CONFIG } from '../core/config';
  import {
    clean, feed, medicate, newPetState, pet as petAction, play, playCooldown, setLights, simulate,
    type ActionResult, type CareEvent, type FoodKind, type Needs, type PetState, type WantKind,
  } from '../core/care';
  import type { Genome } from '../core/genome';
  import { SOURCES } from '../core/mutations';
  import { buildReport, needDeltas, type ReportLine } from '../core/report';
  import { randomSeed } from '../core/rng';
  import { exportSave, freshSave, importSave, loadSave, requestPersistence, writeSave, type SaveData } from '../core/save';
  import { newGame, type GameState, type HatchStage } from '../core/session';
  import { dayPhase, hourOf, weatherOn } from '../core/world';
  import { MonitorView } from '../render/monitorView';
  import ControlDeck from './ControlDeck.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import HatchDeck from './HatchDeck.svelte';
  import PodDeck from './PodDeck.svelte';
  import ReportCard from './ReportCard.svelte';
  import SysPanel from './SysPanel.svelte';
  import type { CareAction } from './types';
  import WantIcon from './WantIcon.svelte';
  import { dev, pipeline, save } from './state.svelte';

  let canvas: HTMLCanvasElement;
  let view: MonitorView | undefined = $state();
  /** The save is a plain object: the sim mutates it every tick. UI reads snapshots. */
  let data: SaveData = freshSave();
  let ready = $state(false);
  let game: GameState = $state.raw(data.game);
  let selected = $state(1);
  let stage: HatchStage | null = $state(null);
  let genome: Genome | undefined = $state.raw();
  let reveal = $state(false);
  let log = $state('LINK ESTABLISHED // SUBJECT FEED LIVE');
  let clock = $state('');
  let worldLabel = $state('');
  let sysOpen = $state(false);
  let report: { awayMs: number; lines: ReportLine[]; deltas: { key: keyof Needs; delta: number }[] } | null = $state(null);
  /** Snapshot of the pet for the UI (refreshed every tick and after actions). */
  let snap = $state({
    needs: { hunger: 0, hygiene: 0, energy: 0, mood: 0, health: 0 } as Needs,
    asleep: false, sick: false, lightsOn: true, eating: false,
    bowl: { kind: null as FoodKind | null, amount: 0 }, playWait: 0, want: null as WantKind | null,
  });
  let bubbleEl: HTMLDivElement | undefined = $state();

  const now = () => Date.now() + data.clockSkew;
  const petState = (): PetState | undefined => (data.game.phase === 'den' ? data.game.pet : undefined);

  function persist() {
    void writeSave(data);
  }

  function setGame(g: GameState) {
    data.game = g;
    game = g;
    persist();
  }

  function refresh() {
    const p = petState();
    if (!p) return;
    snap = {
      needs: { ...p.needs }, asleep: p.asleep, sick: p.sick, lightsOn: p.lightsOn, eating: p.eating,
      bowl: { ...p.bowl }, playWait: playCooldown(p, now()), want: p.want?.kind ?? null,
    };
    const n = p.needs;
    view?.setCare({
      asleep: p.asleep,
      sick: p.sick,
      vigor: Math.max(0, Math.min(1, (Math.min(n.energy, n.hunger, n.health) - 5) / 45)),
      waste: p.waste,
      lightsOn: p.lightsOn,
      eating: p.eating,
      bowl: p.bowl,
    });
  }

  const EVENT_LOG: Partial<Record<CareEvent['kind'], string>> = {
    fellAsleep: 'SUBJECT ASLEEP // DIM THE LIGHTS',
    napped: 'SUBJECT COLLAPSED INTO A NAP',
    wokeUp: 'SUBJECT AWAKE',
    pooped: 'WASTE DEPOSITED // CLEAN REQUIRED',
    ate: 'SUBJECT EATING',
    finishedBowl: 'BOWL EMPTY',
    wantIgnored: 'SUBJECT GAVE UP WAITING',
    gotSick: 'INFECTION DETECTED // MEDS REQUIRED',
    starving: 'NUTRITION CRITICAL',
    filthy: 'HYGIENE CRITICAL',
    exhausted: 'SUBJECT EXHAUSTED',
    miserable: 'SUBJECT MISERABLE',
    critical: 'VITALS CRITICAL // INTERVENE',
  };

  /** Advance the sim to now; live events go to the log line. */
  function tick() {
    const t = now();
    const hour = hourOf(t);
    const weather = weatherOn(t);
    view?.setWorld(hour, weather);
    worldLabel = `${weather.toUpperCase()} · ${dayPhase(hour).toUpperCase()}`;
    clock = new Date(t).toTimeString().slice(0, 8);
    const p = petState();
    if (p && genome) {
      const events = simulate(p, genome, t);
      const last = events.at(-1);
      if (last && EVENT_LOG[last.kind]) log = EVENT_LOG[last.kind]!;
      refresh();
    }
  }

  /** On opening: catch up on everything that happened while away. */
  function catchUp() {
    const p = petState();
    if (!p || !genome) return;
    const before = { ...p.needs };
    const from = p.simTime;
    const events = simulate(p, genome, now());
    const away = now() - from;
    if (away > 10 * 60000) report = { awayMs: away, lines: buildReport(events, genome.seed), deltas: needDeltas(before, p.needs) };
    refresh();
    persist();
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
      catchUp();
    }
    tick();
  }

  /** Dev tools: drop a specific pet straight into the den. */
  function loadPet(seed: string) {
    setGame({ phase: 'den', seed, hatchedAt: now(), source: dev.source, pet: newPetState(now()) });
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

  function result(r: ActionResult) {
    log = r.message;
    refresh();
    persist();
  }

  function onFeed(kind: FoodKind) {
    const p = petState();
    if (!p) return;
    result(feed(p, kind));
  }

  function onAction(a: CareAction) {
    const p = petState();
    if (!p || !genome) return;
    if (a === 'clean') {
      const r = clean(p);
      if (r.ok) view?.clean();
      result(r);
    } else if (a === 'play') {
      const r = play(p, genome, now());
      if (r.ok) view?.play();
      result(r);
    } else if (a === 'lights') {
      result({ ok: true, message: setLights(p, !p.lightsOn) });
    } else {
      result(medicate(p));
    }
  }

  onMount(() => {
    if (new URLSearchParams(location.search).get('source') === 'dealer') dev.source = 'dealer';
    view = new MonitorView(canvas, { ...pipeline });
    view.onFps = (fps) => (dev.fps = fps);
    view.onPodTap = selectPod;
    view.onHatchStage = (s) => (stage = s);
    view.onPetTap = () => {
      const p = petState();
      if (p && genome) result(petAction(p, genome, now()));
    };
    view.onFrame = () => {
      if (!bubbleEl) return;
      const pos = snap.want && game.phase === 'den' && !report && !reveal ? view!.headScreenPos() : null;
      if (pos) {
        bubbleEl.style.display = 'block';
        bubbleEl.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)`;
      } else {
        bubbleEl.style.display = 'none';
      }
    };
    view.onHatched = (g) => {
      genome = g;
      setGame({ phase: 'den', seed: g.seed, hatchedAt: now(), pet: newPetState(now()) });
      reveal = true;
      log = `SUBJECT ${g.designation} VIABLE // FEED LIVE`;
      refresh();
    };

    let last = performance.now();
    let ticks = 0;
    const id = setInterval(() => {
      const t = performance.now();
      // Dev fast-forward: the game clock runs `timeScale` times faster.
      if (dev.timeScale > 1) data.clockSkew += (dev.timeScale - 1) * (t - last);
      last = t;
      tick();
      if (++ticks % 15 === 0) persist();
    }, 1000);
    const onHide = () => document.visibilityState === 'hidden' ? persist() : catchUp();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persist);

    void (async () => {
      data = await loadSave();
      game = data.game;
      ready = true;
      void requestPersistence();
      const urlSeed = new URLSearchParams(location.search).get('seed');
      if (urlSeed) {
        const r = view!.setPet(urlSeed.toUpperCase(), SOURCES[dev.source]);
        genome = r.genome;
        tick();
      } else {
        enterPhase();
      }
    })();

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persist);
      persist();
      view?.dispose();
    };
  });

  $effect(() => {
    const s = { ...pipeline };
    view?.updateSettings(s);
    save('cg.pipeline', s);
  });

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

  function resetClock() {
    data.clockSkew = 0;
    persist();
    tick();
  }

  function doImport(code: string): boolean {
    const d = importSave(code);
    if (!d) return false;
    data = d;
    game = d.game;
    persist();
    enterPhase();
    return true;
  }
</script>

<div class="device">
  <header class="topbar">
    <span class="brand">CHROMOGOTCHI</span>
    <span class="sub">VET-LINK v0.1 [JAILBROKEN]</span>
    <button class="dbg" onclick={() => (sysOpen = !sysOpen)} aria-label="System and backup">SYS</button>
    <button class="dbg" onclick={() => (dev.open = !dev.open)} aria-label="Toggle debug panel">DBG</button>
  </header>

  <section class="monitor">
    <canvas bind:this={canvas}></canvas>
    <div class="osd top">
      <span><span class="rec">●</span> REC CAM-01{game.phase === 'den' ? '' : ' // POD BAY'}</span>
      <span class="right">{clock}<br /><span class="world">{worldLabel}</span></span>
    </div>
    <div class="osd bottom">
      {#if !ready}
    <section class="boot">BOOTING VET-LINK…</section>
  {:else if game.phase === 'select'}
        <span>{game.pods.length} PODS DETECTED</span>
        <span>TAP A POD TO SCAN</span>
      {:else if game.phase === 'hatching'}
        <span>INCUBATION IN PROGRESS</span>
        <span>DO NOT DISTURB</span>
      {:else if genome}
        <span>SUBJECT {genome.designation} "{genome.streetName.toUpperCase()}"</span>
        <span>{genome.species.toUpperCase()} // <span class="tier {genome.tier}">{genome.tier.toUpperCase()}</span>{snap.asleep ? ' // ZZZ' : ''}</span>
      {/if}
    </div>
    <div class="bubble" bind:this={bubbleEl} aria-label="The pet wants {snap.want ?? 'nothing'}">
      {#if snap.want}<WantIcon kind={snap.want} />{/if}
      <span class="tail"></span>
    </div>
    {#if report && game.phase === 'den'}
      <ReportCard awayMs={report.awayMs} lines={report.lines} deltas={report.deltas} onClose={() => (report = null)} />
    {/if}
    {#if reveal && genome}
      <div class="reveal" role="dialog" aria-label="Subject viable">
        <div class="title">SUBJECT VIABLE</div>
        <div class="name">{genome.designation} "{genome.streetName.toUpperCase()}"</div>
        <div>{genome.species.toUpperCase()} // <span class="tier {genome.tier}">{genome.tier.toUpperCase()}</span></div>
        <button onclick={() => (reveal = false)}>ACKNOWLEDGE</button>
      </div>
    {/if}
  </section>

  {#if !ready}
    <section class="boot">BOOTING VET-LINK…</section>
  {:else if game.phase === 'select'}
    <PodDeck pods={game.pods} {selected} onSelect={selectPod} onIncubate={incubate} />
  {:else if game.phase === 'hatching'}
    <HatchDeck {stage} podId={game.seed.slice(-4)} />
  {:else}
    <ControlDeck
      needs={snap.needs} asleep={snap.asleep} sick={snap.sick} lightsOn={snap.lightsOn}
      eating={snap.eating} bowl={snap.bowl} playWait={snap.playWait} {log} {onFeed} {onAction}
    />
  {/if}

  {#if sysOpen}
    <SysPanel exportCode={() => exportSave(data)} onImport={doImport} onClose={() => (sysOpen = false)} />
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
      onResetClock={resetClock}
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
  .osd.top { top: 12px; align-items: flex-start; }
  .right { text-align: right; }
  .world { font-size: 14px; color: var(--phosphor-dim); }
  .boot { flex: 0 0 auto; padding: 20px; font-size: 20px; text-shadow: var(--glow); }
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
  .bubble {
    position: absolute;
    left: 0;
    top: 0;
    display: none;
    padding: 5px;
    background: rgba(11, 7, 8, 0.85);
    border: 2px solid var(--phosphor);
    border-radius: 10px;
    box-shadow: 0 0 8px rgba(255, 120, 40, 0.4);
    pointer-events: none;
    line-height: 0;
    animation: bob 1.6s ease-in-out infinite;
  }
  .bubble .tail {
    position: absolute;
    left: 50%;
    bottom: -9px;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    background: var(--phosphor);
    border-radius: 50%;
  }
  @keyframes bob { 50% { margin-top: -4px; } }
  @media (prefers-reduced-motion: reduce) { .bubble { animation: none; } }
  .rec { color: var(--magenta); animation: blink 1.6s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .rec { animation: none; } .reveal { animation: none; } }
</style>
