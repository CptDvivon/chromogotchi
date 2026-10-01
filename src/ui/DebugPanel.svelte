<script lang="ts">
  import { generateGenome, type Genome } from '../core/genome';
  import { SOURCES, TIERS, labelOf, type Tier } from '../core/mutations';
  import { randomSeed } from '../core/rng';
  import { SPECIES, type Species } from '../core/species';
  import { dev, pipeline, save } from './state.svelte';

  interface Props {
    seed: string;
    genome: Genome | undefined;
    phase: string;
    onSeed: (seed: string) => void;
    onReroll: () => void;
    onRestart: () => void;
    onSkipHatch: () => void;
    onClose: () => void;
  }
  let { seed, genome, phase, onSeed, onReroll, onRestart, onSkipHatch, onClose }: Props = $props();
  let input = $state('');
  $effect(() => { input = seed; });

  let wantSpecies: Species | 'any' = $state('any');
  let wantTier: Tier | 'any' = $state('any');
  let searchMsg = $state('');

  /** Gallery search: roll seeds until one matches the filters. */
  function findNext() {
    const src = SOURCES[dev.source];
    for (let i = 0; i < 50000; i++) {
      const s = randomSeed();
      const g = generateGenome(s, src);
      if ((wantSpecies === 'any' || g.species === wantSpecies) && (wantTier === 'any' || g.tier === wantTier)) {
        searchMsg = `FOUND AFTER ${i + 1} PODS`;
        onSeed(s);
        return;
      }
    }
    searchMsg = 'NO MATCH IN 50000 PODS (TRY DEALER SOURCE)';
  }

  const SCALES = [1, 60, 600, 3600];
  $effect(() => save('cg.timeScale', dev.timeScale));
</script>

<div class="panel" role="dialog" aria-label="Debug panel">
  <div class="head">
    <span>DEBUG // DEV TOOLS</span>
    <button onclick={onClose}>CLOSE</button>
  </div>

  <div class="row">GAME FLOW ({phase.toUpperCase()})
    <div class="btns">
      <button onclick={onRestart}>NEW GAME (PODS)</button>
      {#if phase === 'hatching'}<button onclick={onSkipHatch}>SKIP HATCH</button>{/if}
    </div>
  </div>

  <label class="row">SEED
    <input bind:value={input} spellcheck="false" autocapitalize="characters" />
  </label>
  <div class="row btns">
    <button onclick={() => onSeed(input.trim().toUpperCase())}>LOAD</button>
    <button onclick={onReroll}>REROLL</button>
  </div>

  <div class="row">GALLERY
    <div class="btns wrap">
      <select bind:value={dev.source} aria-label="Pod source">
        <option value="starter">STARTER POD</option>
        <option value="dealer">DEALER POD</option>
      </select>
      <select bind:value={wantSpecies} aria-label="Species">
        <option value="any">ANY SPECIES</option>
        {#each SPECIES as s (s)}<option value={s}>{s.toUpperCase()}</option>{/each}
      </select>
      <select bind:value={wantTier} aria-label="Tier">
        <option value="any">ANY TIER</option>
        {#each TIERS as t (t)}<option value={t}>{t.toUpperCase()}</option>{/each}
      </select>
      <button onclick={findNext}>FIND NEXT</button>
    </div>
    {#if searchMsg}<span class="dim">{searchMsg}</span>{/if}
  </div>

  {#if genome}
    <div class="stats">
      {genome.species.toUpperCase()} · {genome.tier.toUpperCase()} · LOAD {genome.load} · {genome.source.toUpperCase()}
      <br />MUTATIONS: {genome.mutations.length ? genome.mutations.map(labelOf).join(', ') : 'NONE'}
      {#if genome.outliers.length}<br />FREAK GENES: {genome.outliers.join(', ').toUpperCase()}{/if}
      <br />{genome.coat.pattern.toUpperCase()} · {genome.coat.base} / {genome.coat.secondary} · EYES {genome.coat.eye}{genome.coat.eye2 !== genome.coat.eye ? ` / ${genome.coat.eye2}` : ''}
      <br />{genome.temperament.toUpperCase()} · MANGE {(genome.mange * 100).toFixed(0)}% · SCARS {genome.scars}
      <br />SIZE {genome.body.size.toFixed(2)} BULK {genome.body.bulk.toFixed(2)} LEGS {genome.body.legLength.toFixed(2)} TAIL {genome.body.tailLength.toFixed(2)}
    </div>
  {/if}

  <label class="row">PIXEL HEIGHT {pipeline.lowHeight}
    <input type="range" min="144" max="400" step="8" bind:value={pipeline.lowHeight} />
  </label>
  <div class="row toggles">
    <label><input type="checkbox" bind:checked={pipeline.quantize} /> PALETTE</label>
    <label><input type="checkbox" bind:checked={pipeline.dither} /> DITHER</label>
    <label><input type="checkbox" bind:checked={pipeline.crt} /> CRT</label>
    <label><input type="checkbox" bind:checked={pipeline.flicker} /> FLICKER</label>
  </div>

  <div class="row">TIME SCALE (FROM M4)
    <div class="btns">
      {#each SCALES as s (s)}
        <button class:on={dev.timeScale === s} onclick={() => (dev.timeScale = s)}>{s}x</button>
      {/each}
    </div>
  </div>

  <div class="dim">FPS {dev.fps} · BUILD {dev.buildMs}ms</div>
</div>

<style>
  .panel {
    position: fixed;
    left: 10px;
    right: 10px;
    top: calc(env(safe-area-inset-top) + 40px);
    bottom: calc(env(safe-area-inset-bottom) + 10px);
    overflow-y: auto;
    max-width: 500px;
    margin: 0 auto;
    background: rgba(11, 7, 8, 0.94);
    border: 1px solid var(--phosphor-dim);
    padding: 10px;
    font-size: 17px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 10;
  }
  .head { display: flex; justify-content: space-between; font-family: var(--font-label); font-size: 11px; }
  .row { display: flex; flex-direction: column; gap: 4px; }
  .btns { display: flex; flex-direction: row; gap: 6px; }
  .wrap { flex-wrap: wrap; }
  .toggles { flex-direction: row; flex-wrap: wrap; gap: 12px; }
  input:not([type]), select {
    font: inherit;
    font-size: 16px;
    background: #000;
    color: var(--phosphor);
    border: 1px solid var(--phosphor-dim);
    padding: 4px 6px;
  }
  input[type='range'] { accent-color: var(--phosphor); }
  input[type='checkbox'] { accent-color: var(--phosphor); }
  button {
    font-family: var(--font-label);
    font-size: 10px;
    border: 1px solid var(--phosphor-dim);
    padding: 6px 10px;
    min-height: 32px;
  }
  button.on { color: var(--cyan); border-color: var(--cyan); }
  .stats { color: var(--phosphor-hot); font-size: 15px; line-height: 1.15; }
  .dim { color: var(--phosphor-dim); font-size: 15px; }
</style>
