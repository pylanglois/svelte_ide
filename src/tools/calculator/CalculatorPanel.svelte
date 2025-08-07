<script>
  import Calculator from '@tools/calculator/Calculator.svelte'
  import { panelsManager } from '@/core/PanelsManager.svelte.js'

  let { panelId } = $props()

  function handleClose() {
    panelsManager.deactivatePanel(panelId)
  }
</script>

<div class="calculator-panel">
  <div class="panel-header">
    <div class="panel-title">
      <span class="panel-icon">🧮</span>
      <span class="panel-name">Calculatrice</span>
    </div>
    <button class="close-button" onclick={handleClose}>×</button>
  </div>
  
  <div class="panel-content">
    <Calculator />
  </div>
</div>

<style>
  .calculator-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #252526;
    border: 1px solid #3c3c3c;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #2d2d30;
    border-bottom: 1px solid #3c3c3c;
    min-height: 35px;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #cccccc;
  }

  .panel-icon {
    font-size: 14px;
  }

  .close-button {
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    background: #3c3c3c;
    border-radius: 2px;
  }

  .panel-content {
    flex: 1;
    overflow: auto;
  }
</style>
