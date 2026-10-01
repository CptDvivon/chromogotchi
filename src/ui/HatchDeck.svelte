<script lang="ts">
  import type { HatchStage } from '../core/session';
  import Ecg from './Ecg.svelte';

  interface Props { stage: HatchStage | null; podId: string }
  let { stage, podId }: Props = $props();

  const BPM: Record<HatchStage, number> = { dormant: 34, stirring: 78, breaching: 150, emergence: 190 };
  const NOISE: Record<HatchStage, number> = { dormant: 0.02, stirring: 0.05, breaching: 0.25, emergence: 0.4 };
  const LOG: Record<HatchStage, string> = {
    dormant: 'INCUBATION CYCLE ENGAGED // VITALS FAINT',
    stirring: 'NEURAL ACTIVITY DETECTED // SUBJECT STIRRING',
    breaching: 'CONTAINMENT INTEGRITY FAILING',
    emergence: 'SEAL BREACH // SUBJECT EMERGING',
  };
  const s = $derived(stage ?? 'dormant');
</script>

<section class="deck">
  <div class="head">
    <span>POD #{podId} // INCUBATING</span>
    <span class="bpm">♥ {BPM[s]}</span>
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
  .log { font-size: 18px; min-height: 40px; color: var(--phosphor-hot); text-shadow: var(--glow); }
  .log.alarm { color: var(--magenta); text-shadow: 0 0 6px rgba(255, 46, 136, 0.5); }
  .caret { animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
</style>
