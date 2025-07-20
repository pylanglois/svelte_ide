<script>
  import FileExplorer from '@tools/explorer/FileExplorer.svelte'

  let { toolId } = $props()
  
  const files = [
    { name: 'Documents', type: 'folder' },
    { name: 'Images', type: 'folder' },
    { name: 'Projets', type: 'folder' },
    { name: 'demo1.txt', type: 'file', content: 'allo bonjour' },
    { name: 'demo2.md', type: 'file', content: 'allo bonjour' },
    { name: 'demo3.js', type: 'file', content: 'allo bonjour' },
    { name: 'test.html', type: 'file', content: 'allo bonjour' },
    { name: 'exemple.json', type: 'file', content: 'allo bonjour' },
    { name: 'fichier.css', type: 'file', content: 'allo bonjour' }
  ]
</script>

<FileExplorer {files} {toolId} />
