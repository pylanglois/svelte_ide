const mockFiles = [
  { name: 'demo1.txt', content: 'Contenu du fichier demo1.txt\nLigne 2\nLigne 3' },
  { name: 'demo2.md', content: '# Fichier Markdown\n\nCeci est un **fichier markdown**.' },
  { name: 'demo3.js', content: 'console.log("Hello from demo3.js");\nfunction test() {\n  return "test";\n}' },
  { name: 'test.html', content: '<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body><h1>Hello World</h1></body>\n</html>' },
  { name: 'exemple.json', content: '{\n  "name": "exemple",\n  "version": "1.0.0",\n  "description": "Un exemple de JSON"\n}' },
  { name: 'fichier.css', content: 'body {\n  background-color: #1e1e1e;\n  color: #cccccc;\n  font-family: Arial, sans-serif;\n}' }
]

export function getFileContent(fileName) {
  const fileData = mockFiles.find(file => file.name === fileName)
  return fileData ? fileData.content : 'Contenu par défaut'
}

export function getFileList() {
  return mockFiles.map(file => ({
    name: file.name,
    type: 'file',
    size: file.content.length
  }))
}

export function openFileInIDE(fileName, ideStore, FileViewer) {
  const content = getFileContent(fileName)
  
  return ideStore.openFile({
    fileName,
    content,
    component: FileViewer,
    icon: getFileIcon(fileName),
    toolId: 'explorer'
  })
}

function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()
  const iconMap = {
    'txt': '📄',
    'md': '📝',
    'js': '📜',
    'html': '🌐',
    'json': '📋',
    'css': '🎨'
  }
  return iconMap[ext] || '📄'
}
