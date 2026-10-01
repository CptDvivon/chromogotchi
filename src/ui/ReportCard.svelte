<script lang="ts">
  import type { Needs } from '../core/care';
  import type { ReportLine } from '../core/report';

  interface Props {
    awayMs: number;
    lines: ReportLine[];
    deltas: { key: keyof Needs; delta: number }[];
    onClose: () => void;
  }
  let { awayMs, lines, deltas, onClose }: Props = $props();

  const LABEL: Record<keyof Needs, string> = { hunger: 'NUTR', hygiene: 'HYGN', energy: 'ENRG', mood: 'MOOD', health: 'VITL' };
  const fmtAway = (ms: number) => {
    const m = Math.round(ms / 60000);
    const h = Math.floor(m / 60);
    return h >= 24 ? `${Math.floor(h / 24)}D ${h % 24}H` : h ? `${h}H ${m % 60}M` : `${m}M`;
  };
  const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5);
</script>

<div class="card" role="dialog" aria-label="While you were gone">
  <div class="title">WHILE YOU WERE GONE // {fmtAway(awayMs)}</div>
  <div class="deltas">
    {#each deltas as d (d.key)}
      <span class:bad={d.delta < -5} class:good={d.delta > 5}>{LABEL[d.key]} {d.delta > 0 ? '+' : ''}{d.delta}</span>
    {/each}
  </div>
  <ol>
    {#each lines as l, i (i)}
      <li><span class="t">{hhmm(l.at)}</span> {l.text}</li>
    {:else}
      <li>Nothing of note. Subject stared at the wall.</li>
    {/each}
  </ol>
  <button onclick={onClose}>ACKNOWLEDGE</button>
</div>

<style>
  .card {
    position: absolute;
    left: 8px;
    right: 8px;
    top: 40px;
    max-height: calc(100% - 80px);
    overflow-y: auto;
    padding: 10px 12px;
    background: rgba(11, 7, 8, 0.93);
    border: 1px solid var(--phosphor-dim);
    color: var(--phosphor-hot);
    text-shadow: var(--glow);
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: crt-in 0.5s steps(6);
    z-index: 2;
  }
  .title { font-family: var(--font-label); font-size: 11px; color: var(--cyan); text-shadow: 0 0 6px rgba(41, 240, 255, 0.5); }
  .deltas { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 17px; color: var(--phosphor-dim); }
  .deltas .bad { color: var(--magenta); }
  .deltas .good { color: var(--cyan); }
  ol { list-style: none; margin: 0; padding: 0; font-size: 17px; line-height: 1.15; display: flex; flex-direction: column; gap: 3px; }
  .t { color: var(--phosphor-dim); }
  button {
    margin-top: 4px;
    min-height: 44px;
    font-family: var(--font-label);
    font-size: 11px;
    color: var(--phosphor);
    border: 2px solid #3a1f16;
    background: #1f1210;
    border-radius: 6px;
  }
  @keyframes crt-in { from { transform: scaleY(0.02); } to { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
</style>
