<script>
  import { explorerStore } from './explorerStore.svelte.js'
  
  let { 
    content: initialContent = "contenu par défaut", 
    fileName = "untitled",
    onContentChange = null,
    onDirtyStateChange = null
  } = $props()
  
  let content = $state("")
  let lastDirtyState = $state(false)
  
  $effect(() => {
    if (!explorerStore.getFileContent(fileName)) {
      explorerStore.setFileContent(fileName, initialContent)
    }
    content = explorerStore.getFileContent(fileName)
  })
  
  function handleInput() {
    explorerStore.setFileContent(fileName, content)
    
    const isDirty = content !== initialContent
    if (isDirty !== lastDirtyState) {
      lastDirtyState = isDirty
      if (onDirtyStateChange) {
        onDirtyStateChange(isDirty)
      }
    }
    
    if (onContentChange) {
      onContentChange(content)
    }
  }
</script>

<div class="file-content">
  <div class="content-body">
    <textarea bind:value={content} oninput={handleInput} class="file-editor"></textarea>
  </div>
</div>

<style>
  .file-content {
    height: 100%;
    background: #1e1e1e;
    color: #cccccc;
    display: flex;
    flex-direction: column;
  }

  .content-body {
    flex: 1;
    padding: 12px;
    overflow: auto;
    user-select: text;
  }

  .file-editor {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    color: #cccccc;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.5;
    border: none;
    resize: none;
    outline: none;
    padding: 0;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
