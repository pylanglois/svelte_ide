<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'

  function handleToolClick(tool) {
    ideStore.toggleTool(tool.id)
  }
</script>

<div class="left-toolbar">
  <div class="tools-section">
    <div class="quadrant-group">
      {#each ideStore.topLeftTools as tool (tool.id)}
        <button
          class="tool-button"
          class:active={tool.active}
          class:focused={tool.active && ideStore.focusedPanel === tool.position}
          onclick={() => handleToolClick(tool)}
          title={tool.name}
        >
          <i class="icon">{tool.icon}</i>
        </button>
      {/each}
    </div>
    <div class="quadrant-group bottom">
      {#each ideStore.bottomLeftTools as tool (tool.id)}
        <button
          class="tool-button"
          class:active={tool.active}
          class:focused={tool.active && ideStore.focusedPanel === tool.position}
          onclick={() => handleToolClick(tool)}
          title={tool.name}
        >
          <i class="icon">{tool.icon}</i>
        </button>
      {/each}
    </div>
  </div>

  <div class="bottom-section">
    {#each ideStore.bottomTools as tool (tool.id)}
      <button
        class="tool-button"
        class:active={tool.active}
        class:focused={tool.active && ideStore.focusedPanel === tool.position}
        onclick={() => handleToolClick(tool)}
        title={tool.name}
      >
        <i class="icon">{tool.icon}</i>
      </button>
    {/each}
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
    flex: 1;
  }

  .quadrant-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .quadrant-group.bottom {
    margin-top: auto;
  }

  .bottom-section {
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
    background: #3e3e42;
  }

  .tool-button.focused {
    background: #007acc;
    color: #ffffff;
  }

  .icon {
    font-size: 16px;
    font-style: normal;
  }
</style>
