<script lang="ts">
  // Backup: copy the save as a code, or paste one back in.
  interface Props {
    exportCode: () => string;
    onImport: (code: string) => boolean;
    onClose: () => void;
  }
  let { exportCode, onImport, onClose }: Props = $props();
  let code = $state('');
  let msg = $state('');

  async function doExport() {
    code = exportCode();
    try {
      await navigator.clipboard.writeText(code);
      msg = 'SAVE CODE COPIED TO CLIPBOARD';
    } catch {
      msg = 'COPY THE CODE BELOW';
    }
  }

  function doImport() {
    msg = onImport(code) ? 'SAVE RESTORED' : 'INVALID SAVE CODE';
  }
</script>

<div class="panel" role="dialog" aria-label="System">
  <div class="head">
    <span>SYSTEM // BACKUP</span>
    <button onclick={onClose}>CLOSE</button>
  </div>
  <p>Your pet lives on this device. Export a save code now and then, and paste it back here if anything is lost.</p>
  <div class="btns">
    <button onclick={doExport}>EXPORT SAVE</button>
    <button onclick={doImport} disabled={!code.trim()}>IMPORT SAVE</button>
  </div>
  <textarea bind:value={code} rows="5" spellcheck="false" placeholder="PASTE A SAVE CODE HERE"></textarea>
  {#if msg}<div class="msg">{msg}</div>{/if}
</div>

<style>
  .panel {
    position: fixed;
    left: 10px;
    right: 10px;
    top: calc(env(safe-area-inset-top) + 40px);
    max-width: 500px;
    margin: 0 auto;
    background: rgba(11, 7, 8, 0.96);
    border: 1px solid var(--phosphor-dim);
    padding: 10px;
    font-size: 17px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 10;
  }
  .head { display: flex; justify-content: space-between; font-family: var(--font-label); font-size: 11px; }
  p { margin: 0; color: var(--phosphor-dim); }
  .btns { display: flex; gap: 8px; }
  button {
    font-family: var(--font-label);
    font-size: 10px;
    border: 1px solid var(--phosphor-dim);
    padding: 6px 10px;
    min-height: 40px;
  }
  button:disabled { opacity: 0.4; }
  textarea {
    font-family: var(--font-term);
    font-size: 16px;
    background: #000;
    color: var(--phosphor);
    border: 1px solid var(--phosphor-dim);
    padding: 6px;
    word-break: break-all;
  }
  .msg { color: var(--cyan); font-family: var(--font-label); font-size: 10px; }
</style>
