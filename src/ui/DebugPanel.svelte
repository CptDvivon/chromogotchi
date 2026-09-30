<script lang="ts">
  import type { Genome } from '../core/genome';
  import { dev, pipeline, save } from './state.svelte';

  interface Props {
    seed: string;
    genome: Genome | undefined;
    onSeed: (seed: string) => void;
    onReroll: () => void;
    onClose: () => void;
  }
  let { seed, genome, onSeed, onReroll, onClose }: Props = $props();
  let input = $state('');
  $effect(() => { input = seed; });

  const SCALES = [1, 60, 600, 3600];
  $effect(() => save('cg.timeScale', dev.timeScale));
</script>

<div class="panel" role="dialog" aria-label="Debug panel">
  <div class="head">
    <span>DEBUG // DEV TOOLS</span>
    <button onclick={onClose}>CLOSE</button>
  </div>

  <label class="row">SEED
    <input bind:value={input} spellcheck="false" autocapitalize="characters" />
  </label>
  <div class="row btns">
    <button onclick={() => onSeed(input.trim().toUpperCase())}>LOAD</button>
    <button onclick={onReroll}>REROLL</button>
  </div>

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

  <div class="stats">
    FPS {dev.fps} · BUILD {dev.buildMs}ms
    {#if genome}
      <br />{genome.coat.pattern.toUpperCase()} · {genome.coat.base} / {genome.coat.secondary} · EYES {genome.coat.eye}
      <br />{genome.temperament.toUpperCase()} · MANGE {(genome.mange * 100).toFixed(0)}% · SCARS {genome.scars}
      <br />SIZE {genome.body.size.toFixed(2)} BULK {genome.body.bulk.toFixed(2)} LEGS {genome.body.legLength.toFixed(2)} TAIL {genome.body.tailLength.toFixed(2)}
    {/if}
  </div>
</div>

<style>
  .panel {
    position: fixed;
    left: 10px;
    right: 10px;
    top: calc(env(safe-area-inset-top) + 40px);
    max-width: 500px;
    margin: 0 auto;
    background: rgba(11, 7, 8, 0.94);
    border: 1px solid var(--phosphor-dim);
    padding: 10px;
    font-size: 17px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
  }
  .head { display: flex; justify-content: space-between; font-family: var(--font-label); font-size: 11px; }
  .row { display: flex; flex-direction: column; gap: 4px; }
  .btns { display: flex; flex-direction: row; gap: 6px; }
  .toggles { flex-direction: row; flex-wrap: wrap; gap: 12px; }
  input:not([type]) {
    font: inherit;
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
  .stats { color: var(--phosphor-dim); font-size: 15px; }
</style>
