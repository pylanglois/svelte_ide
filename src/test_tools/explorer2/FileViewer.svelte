<script>
  let { content = "Contenu par défaut de l'Explorateur V2" } = $props()
</script>

<div class="file-content">
  <div class="content-body">
    <pre>{content}</pre>
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
    overflow: auto;
    padding: 12px;
    user-select: text;
  }

  pre {
    margin: 0;
    font-family: 'Cascadia Code', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
