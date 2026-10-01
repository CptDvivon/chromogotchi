<script lang="ts">
  // Tiny pixel-art icons for what the pet wants. '#' = main colour, '+' = accent.
  import type { WantKind } from '../core/care';

  interface Props { kind: WantKind; size?: number }
  let { kind, size = 28 }: Props = $props();

  const ART: Record<WantKind, { rows: string[]; main: string; accent: string }> = {
    food: { main: '#d98282', accent: '#e9e2cf', rows: ['..####..', '.######.', '.######.', '..####..', '...++...', '...++...', '..+..+..', '........'] },
    treat: { main: '#ff2e88', accent: '#f2c46b', rows: ['........', '+......+', '++####++', '+######+', '++####++', '+......+', '........', '........'] },
    sleep: { main: '#29f0ff', accent: '#29f0ff', rows: ['#####...', '...#....', '..#.....', '#####...', '.....###', '......#.', '.....###', '........'] },
    dark: { main: '#f2c46b', accent: '#ff2e88', rows: ['..###...', '.#####..', '.#####..', '..###...', '..+++...', '..+++...', '+......+', '.+....+.'] },
    play: { main: '#ff8c32', accent: '#fff6e0', rows: ['..####..', '.#++####', '#++#####', '#+######', '########', '########', '.######.', '..####..'] },
    affection: { main: '#ff2e88', accent: '#ff2e88', rows: ['.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........', '........'] },
    clean: { main: '#b8b04a', accent: '#6f7a2a', rows: ['.#..#..#', '#..#..#.', '.#..#..#', '#..#..#.', '........', '.++++++.', '++++++++', '........'] },
    meds: { main: '#ff2e88', accent: '#e9e2cf', rows: ['...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........', '........'] },
  };
  const art = $derived(ART[kind]);
</script>

<svg width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
  {#each art.rows as row, y (y)}
    {#each [...row] as ch, x (x)}
      {#if ch !== '.'}
        <rect {x} {y} width="1" height="1" fill={ch === '#' ? art.main : art.accent} />
      {/if}
    {/each}
  {/each}
</svg>
