<script lang="ts">
  import { generateGenome } from '../core/genome';
  import { podReadout } from '../core/podReadout';

  interface Props {
    pods: string[];
    selected: number;
    onSelect: (i: number) => void;
    onIncubate: () => void;
  }
  let { pods, selected, onSelect, onIncubate }: Props = $props();
  const readout = $derived(podReadout(generateGenome(pods[selected])));
</script>

<section class="deck">
  <div class="head">
    <span>POD {selected + 1}/{pods.length} &nbsp;#{readout.id}</span>
    <span class="nav">
      <button aria-label="Previous pod" onclick={() => onSelect((selected + pods.length - 1) % pods.length)}>◄</button>
      <button aria-label="Next pod" onclick={() => onSelect((selected + 1) % pods.length)}>►</button>
    </span>
  </div>
  <dl>
    <dt>MASS</dt><dd>{readout.massKg.toFixed(2)} KG</dd>
    <dt>ACTIVITY</dt>
    <dd class="bars">{#each Array(5) as _, i (i)}<span class:on={i < readout.activity}></span>{/each}</dd>
    <dt>ORIGIN</dt><dd>{readout.origin}</dd>
    <dt>GENOME</dt>
    <dd class:warn={readout.irregular}>{readout.irregular ? '⚠ IRREGULARITY DETECTED' : 'STABLE'}</dd>
  </dl>
  <button class="go" onclick={onIncubate}>INCUBATE POD</button>
</section>

<style>
  .deck {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--panel);
    border: 2px solid var(--bezel);
    border-radius: 10px;
    padding: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-label);
    font-size: 12px;
    text-shadow: var(--glow);
  }
  .nav { display: flex; gap: 6px; }
  .nav button {
    min-width: 44px;
    min-height: 40px;
    font-size: 16px;
    color: var(--phosphor);
    background: #1f1210;
    border: 2px solid #3a1f16;
    border-radius: 6px;
  }
  dl {
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 2px 8px;
    margin: 0;
    font-size: 19px;
    color: var(--phosphor-hot);
    text-shadow: var(--glow);
  }
  dt { color: var(--phosphor-dim); font-family: var(--font-label); font-size: 10px; align-self: center; }
  dd { margin: 0; }
  dd.warn { color: var(--magenta); text-shadow: 0 0 6px rgba(255, 46, 136, 0.5); }
  .bars { display: flex; gap: 3px; align-items: center; }
  .bars span { width: 14px; height: 10px; background: #2a1512; }
  .bars span.on { background: var(--phosphor); box-shadow: 0 0 4px rgba(255, 120, 40, 0.6); }
  .go {
    min-height: 54px;
    font-family: var(--font-label);
    font-size: 13px;
    letter-spacing: 1px;
    color: var(--cyan);
    background: #0e1a1c;
    border: 2px solid #137a8c;
    border-bottom-width: 5px;
    border-radius: 6px;
    text-shadow: 0 0 6px rgba(41, 240, 255, 0.5);
  }
  .go:active { transform: translateY(2px); border-bottom-width: 3px; }
</style>
