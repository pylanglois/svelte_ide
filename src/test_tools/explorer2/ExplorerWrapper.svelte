<script>
  import FileExplorer from '@tools/explorer2/FileExplorer.svelte'

  let { toolId } = $props()

  const files = [
    { name: 'POuet', type: 'folder' },
    { name: 'Pommes', type: 'folder' },
    { name: 'Nnana', type: 'folder' },
    { name: 'dru.txt', type: 'file', content: 'allo bonjour' },
    { name: 'prois.md', type: 'file', content: 'allo bonjour' },
    { name: 'canna.js', type: 'file', content: 'allo bonjour' },
    { name: 'ououou.html', type: 'file', content: 'allo bonjour' },
  ]
</script>

<FileExplorer {files} {toolId} />
