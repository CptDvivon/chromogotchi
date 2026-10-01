<script lang="ts">
  // Happiness from broken (left) through stable (centre) to elated (right).
  import { moodLabel } from '../core/care';

  interface Props { mood: number }
  let { mood }: Props = $props();
  const side = $derived(Math.round((mood - 50) / 10)); // -5..+5
</script>

<div class="gauge" aria-label="Mood {moodLabel(mood)}">
  <span class="label">MOOD</span>
  <span class="bar">
    {#each Array(5) as _, i (i)}
      <span class="seg sad" class:on={side < 0 && 4 - i < -side}></span>
    {/each}
    <span class="mid"></span>
    {#each Array(5) as _, i (i)}
      <span class="seg glad" class:on={side > 0 && i < side}></span>
    {/each}
  </span>
  <span class="word" class:low={mood < 35} class:high={mood >= 65}>{moodLabel(mood)}</span>
</div>

<style>
  .gauge { display: flex; align-items: center; gap: 6px; grid-column: 1 / -1; }
  .label { font-family: var(--font-label); font-size: 9px; width: 34px; color: var(--phosphor-dim); }
  .bar { display: flex; gap: 2px; flex: 1; align-items: center; }
  .seg { flex: 1; height: 9px; background: #2a1512; }
  .seg.sad.on { background: var(--magenta); box-shadow: 0 0 4px rgba(255, 46, 136, 0.6); }
  .seg.glad.on { background: var(--phosphor); box-shadow: 0 0 4px rgba(255, 120, 40, 0.6); }
  .mid { width: 2px; height: 13px; background: var(--phosphor-dim); }
  .word { font-size: 16px; min-width: 64px; text-align: right; color: var(--phosphor-hot); text-shadow: var(--glow); }
  .word.low { color: var(--magenta); }
  .word.high { color: var(--cyan); }
</style>
