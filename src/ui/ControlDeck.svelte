<script lang="ts">
  interface Props {
    lightsOn: boolean;
    log: string;
    onLights: () => void;
    onOffline: (label: string) => void;
  }
  let { lightsOn, log, onLights, onOffline }: Props = $props();

  // Placeholder readings until the care loop lands (M4).
  const meters = [
    { label: 'NUTR', value: 7 },
    { label: 'HYGN', value: 4 },
    { label: 'ENRG', value: 8 },
    { label: 'MOOD', value: 5 },
    { label: 'VITL', value: 9 },
  ];
</script>

<section class="deck">
  <div class="meters" aria-label="Vital signs (simulated)">
    {#each meters as m (m.label)}
      <div class="meter">
        <span class="label">{m.label}</span>
        <span class="bar">
          {#each Array(10) as _, i (i)}
            <span class="seg" class:on={i < m.value} class:low={m.value <= 3}></span>
          {/each}
        </span>
      </div>
    {/each}
    <span class="sim">SIM DATA</span>
  </div>

  <div class="log" aria-live="polite">&gt; {log}<span class="caret">_</span></div>

  <div class="buttons">
    <button onclick={() => onOffline('FEED')}>FEED</button>
    <button onclick={() => onOffline('CLEAN')}>CLEAN</button>
    <button onclick={() => onOffline('PLAY')}>PLAY</button>
    <button class:active={!lightsOn} onclick={onLights}>{lightsOn ? 'LIGHTS' : 'WAKE'}</button>
    <button onclick={() => onOffline('MEDS')}>MEDS</button>
  </div>
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
  .meters {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  .meter { display: flex; align-items: center; gap: 6px; }
  .label { font-family: var(--font-label); font-size: 9px; width: 34px; color: var(--phosphor-dim); }
  .bar { display: flex; gap: 2px; flex: 1; }
  .seg { flex: 1; height: 9px; background: #2a1512; }
  .seg.on { background: var(--phosphor); box-shadow: 0 0 4px rgba(255, 120, 40, 0.6); }
  .seg.on.low { background: var(--magenta); box-shadow: 0 0 4px rgba(255, 46, 136, 0.6); }
  .sim {
    position: absolute;
    right: 0;
    bottom: -2px;
    font-family: var(--font-label);
    font-size: 8px;
    color: var(--phosphor-dim);
  }
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
  .buttons { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
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
  button.active { color: var(--cyan); border-color: #137a8c; text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
</style>
