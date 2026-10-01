<script lang="ts">
  import type { FoodKind, Needs } from '../core/care';
  import type { CareAction } from './types';

  interface Props {
    needs: Needs;
    asleep: boolean;
    sick: boolean;
    lightsOn: boolean;
    log: string;
    onFeed: (kind: FoodKind) => void;
    onAction: (a: CareAction) => void;
  }
  let { needs, asleep, sick, lightsOn, log, onFeed, onAction }: Props = $props();
  let feeding = $state(false);

  const meters = $derived([
    { label: 'NUTR', value: needs.hunger },
    { label: 'HYGN', value: needs.hygiene },
    { label: 'ENRG', value: needs.energy },
    { label: 'MOOD', value: needs.mood },
    { label: 'VITL', value: needs.health },
  ]);
  const critical = $derived(needs.health < 15);

  function food(kind: FoodKind) {
    feeding = false;
    onFeed(kind);
  }
</script>

<section class="deck">
  <div class="meters" aria-label="Vital signs">
    {#each meters as m (m.label)}
      <div class="meter">
        <span class="label">{m.label}</span>
        <span class="bar">
          {#each Array(10) as _, i (i)}
            <span class="seg" class:on={i < Math.ceil(m.value / 10)} class:low={m.value <= 30}></span>
          {/each}
        </span>
      </div>
    {/each}
    <div class="status">
      {#if critical}<span class="alarm">CRITICAL</span>{/if}
      {#if sick}<span class="alarm">SICK</span>{/if}
      {#if asleep}<span class="info">ASLEEP</span>{/if}
      {#if !lightsOn}<span class="dim">LIGHTS OFF</span>{/if}
    </div>
  </div>

  <div class="log" aria-live="polite">&gt; {log}<span class="caret">_</span></div>

  {#if feeding}
    <div class="buttons">
      <button onclick={() => food('paste')}>PASTE</button>
      <button onclick={() => food('scraps')}>SCRAPS</button>
      <button onclick={() => food('treat')}>TREAT</button>
      <button class="back" onclick={() => (feeding = false)}>BACK</button>
    </div>
  {:else}
    <div class="buttons five">
      <button class:dimmed={asleep} onclick={() => (feeding = true)}>FEED</button>
      <button onclick={() => onAction('clean')}>CLEAN</button>
      <button class:dimmed={asleep} onclick={() => onAction('play')}>PLAY</button>
      <button class:active={!lightsOn} onclick={() => onAction('lights')}>{lightsOn ? 'LIGHTS' : 'LIGHTS ON'}</button>
      <button class:alert={sick} onclick={() => onAction('meds')}>MEDS</button>
    </div>
  {/if}
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
  .meters { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
  .meter { display: flex; align-items: center; gap: 6px; }
  .label { font-family: var(--font-label); font-size: 9px; width: 34px; color: var(--phosphor-dim); }
  .bar { display: flex; gap: 2px; flex: 1; }
  .seg { flex: 1; height: 9px; background: #2a1512; }
  .seg.on { background: var(--phosphor); box-shadow: 0 0 4px rgba(255, 120, 40, 0.6); }
  .seg.on.low { background: var(--magenta); box-shadow: 0 0 4px rgba(255, 46, 136, 0.6); }
  .status { display: flex; gap: 8px; justify-content: flex-end; align-items: center; font-family: var(--font-label); font-size: 9px; }
  .alarm { color: var(--magenta); animation: blink 1s steps(2) infinite; }
  .info { color: var(--cyan); }
  .dim { color: var(--phosphor-dim); }
  .log {
    font-size: 18px;
    min-height: 20px;
    color: var(--phosphor-hot);
    text-shadow: var(--glow);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .caret { animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .buttons.five { grid-template-columns: repeat(5, 1fr); }
  button {
    min-height: 52px;
    font-family: var(--font-label);
    font-size: 11px;
    color: var(--phosphor);
    background: #1f1210;
    border: 2px solid #3a1f16;
    border-bottom-width: 5px;
    border-radius: 6px;
    text-shadow: var(--glow);
  }
  button:active { transform: translateY(2px); border-bottom-width: 3px; }
  button.dimmed { opacity: 0.5; }
  button.active { color: var(--cyan); border-color: #137a8c; text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
  button.alert { color: var(--magenta); border-color: #8a1450; }
  button.back { color: var(--phosphor-dim); }
  @media (prefers-reduced-motion: reduce) { .alarm, .caret { animation: none; } }
</style>
