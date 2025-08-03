<script>
  import FileExplorer from '@tools/explorer/FileExplorer.svelte'

  let { toolId } = $props()
  
  const files = [
    { name: 'Documents', type: 'folder' },
    { name: 'Images', type: 'folder' },
    { name: 'Projets', type: 'folder' },
    { name: 'demo1.txt', type: 'file', content: 'Contenu du fichier demo1.txt\nLigne 2\nLigne 3' },
    { name: 'demo2.md', type: 'file', content: '# Fichier Markdown\n\nCeci est un **fichier markdown**.' },
    { name: 'demo3.js', type: 'file', content: 'console.log("Hello from demo3.js");\nfunction test() {\n  return "test";\n}' },
    { name: 'test.html', type: 'file', content: '<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body><h1>Hello World</h1></body>\n</html>' },
    { name: 'exemple.json', type: 'file', content: '{\n  "name": "exemple",\n  "version": "1.0.0",\n  "description": "Un exemple de JSON"\n}' },
    { name: 'fichier.css', type: 'file', content: 'body {\n  background-color: #1e1e1e;\n  color: #cccccc;\n  font-family: Arial, sans-serif;\n}' }
  ]
</script>

<FileExplorer {files} {toolId} />
