<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'

  function handleToolClick(tool) {
    ideStore.toggleLeftPanel(tool.id)
  }

  function handleConsoleToggle() {
    ideStore.toggleConsolePanel()
    ideStore.setStatusMessage(ideStore.consolePanelVisible ? 'Console ouverte' : 'Console fermée')
  }

  // Forcer la réactivité avec accès explicite aux propriétés
  $effect(() => {
    // Accès explicite pour forcer la réactivité
    if (ideStore.leftTools) ideStore.leftTools.length
    if (ideStore.focusedPanel) ideStore.focusedPanel
    if (ideStore.consolePanelVisible) ideStore.consolePanelVisible
  })
</script>

<div class="left-toolbar">
  <div class="tools-section">
    {#each ideStore.leftTools as tool (tool.id)}
      <button
        class="tool-button"
        class:active={tool.active}
        class:focused={tool.active && ideStore.focusedPanel === 'left'}
        onclick={() => handleToolClick(tool)}
        title={tool.name}
      >
        <i class="icon">{tool.icon}</i>
      </button>
    {/each}
  </div>
  
  <div class="bottom-section">
    <button
      class="tool-button console-button"
      class:active={ideStore.consolePanelVisible}
      class:focused={ideStore.consolePanelVisible && ideStore.focusedPanel === 'console'}
      onclick={handleConsoleToggle}
      title="Console"
    >
      <i class="icon">></i>
    </button>
  </div>
</div>

<style>
  .left-toolbar {
    width: 48px;
    background: #2d2d30;
    border-right: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .tools-section {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }

  .bottom-section {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #3e3e42;
    padding: 8px 0;
  }

  .tool-button {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #cccccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin: 2px 8px;
    border-radius: 3px;
  }

  .tool-button:hover {
    background: #3e3e42;
  }

  .tool-button.active {
    background: #3e3e42 !important;
  }

  .tool-button.focused {
    background: #007acc !important;
    color: #ffffff;
  }

  .icon {
    font-size: 16px;
    font-style: normal;
  }
</style>
