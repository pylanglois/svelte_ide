<script>
  let {
    content: initialContent = "Contenu par défaut de l'Explorateur V2",
    fileName = 'untitled',
    onContentChange = null,
    onDirtyStateChange = null
  } = $props()

  let content = $state('')
  let lastDirtyState = $state(false)

  $effect(() => {
    content = initialContent
    lastDirtyState = false
  })

  function handleInput() {
    const isDirty = content !== initialContent

    if (onDirtyStateChange && isDirty !== lastDirtyState) {
      lastDirtyState = isDirty
      onDirtyStateChange(isDirty)
    }

    if (onContentChange) {
      onContentChange(content)
    }
  }
</script>

<div class="file-content">
  <div class="content-body">
    <textarea
      bind:value={content}
      oninput={handleInput}
      class="file-editor"
      spellcheck="false"
    ></textarea>
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
    overflow: hidden;
    padding: 12px;
    user-select: text;
    min-height: 0;
  }

  .file-editor {
    width: 100%;
    min-height: 100%;
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
    white-space: pre;
  }
</style>