import { describe, expect, it } from 'vitest';
import { newPetState } from './care';
import { exportSave, importSave, normalize } from './save';

describe('save export/import', () => {
  it('round-trips a den save', () => {
    const data = { v: 1 as const, game: { phase: 'den' as const, seed: 'ABC', hatchedAt: 1, pet: newPetState(5) }, clockSkew: 42 };
    const code = exportSave(data);
    expect(code.startsWith('CHROMO1:')).toBe(true);
    expect(importSave(code)).toEqual(data);
  });

  it('rejects garbage', () => {
    expect(importSave('hello')).toBeNull();
    expect(importSave('CHROMO1:!!!')).toBeNull();
  });

  it('migrates an M3 den state without a pet', () => {
    const s = normalize({ phase: 'den', seed: 'X', hatchedAt: 1 });
    expect(s?.game.phase).toBe('den');
    expect(s?.game.phase === 'den' && s.game.pet.needs.health).toBe(100);
  });
});
