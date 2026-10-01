<script lang="ts">
  import type { HatchStage } from '../core/session';
  import Ecg from './Ecg.svelte';

  interface Props { stage: HatchStage | null; podId: string }
  let { stage, podId }: Props = $props();

  const STAGES: HatchStage[] = ['dormant', 'stirring', 'breaching', 'emergence'];
  const BPM: Record<HatchStage, number> = { dormant: 34, stirring: 78, breaching: 150, emergence: 190 };
  const NOISE: Record<HatchStage, number> = { dormant: 0.02, stirring: 0.05, breaching: 0.25, emergence: 0.4 };
  const LOG: Record<HatchStage, string> = {
    dormant: 'INCUBATION CYCLE ENGAGED // VITALS FAINT',
    stirring: 'NEURAL ACTIVITY DETECTED // SUBJECT STIRRING',
    breaching: 'CONTAINMENT INTEGRITY FAILING',
    emergence: 'SEAL BREACH // SUBJECT EMERGING',
  };
  const s = $derived(stage ?? 'dormant');
  const index = $derived(STAGES.indexOf(s));
</script>

<section class="deck">
  <div class="head">
    <span>POD #{podId} // INCUBATING</span>
    <span class="bpm">♥ {BPM[s]}</span>
  </div>
  <div class="phase" aria-label="Phase {index + 1} of 4">
    <span class="label">PHASE {index + 1}/4 // {s.toUpperCase()}</span>
    <span class="pips">
      {#each STAGES as st, i (st)}
        <span class:done={i < index} class:now={i === index}></span>
      {/each}
    </span>
  </div>
  <Ecg bpm={BPM[s]} noise={NOISE[s]} />
  <div class="log" class:alarm={s === 'breaching' || s === 'emergence'} aria-live="polite">&gt; {LOG[s]}<span class="caret">_</span></div>
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
  .head { display: flex; justify-content: space-between; font-family: var(--font-label); font-size: 12px; text-shadow: var(--glow); }
  .bpm { color: var(--magenta); }
  .phase { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .label { font-size: 19px; color: var(--phosphor-hot); text-shadow: var(--glow); }
  .pips { display: flex; gap: 4px; }
  .pips span { width: 22px; height: 10px; background: #2a1512; }
  .pips span.done { background: var(--phosphor); box-shadow: 0 0 4px rgba(255, 120, 40, 0.6); }
  .pips span.now { background: var(--phosphor); animation: pulse 0.8s steps(2) infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }
  .log { font-size: 18px; min-height: 40px; color: var(--phosphor-hot); text-shadow: var(--glow); }
  .log.alarm { color: var(--magenta); text-shadow: 0 0 6px rgba(255, 46, 136, 0.5); }
  .caret { animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pips span.now, .caret { animation: none; } }
</style>
