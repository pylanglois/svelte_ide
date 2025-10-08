const fileContents = $state({})

export const explorerStore = {
  getFileContent(fileName) {
    return fileContents[fileName] || null
  },

  setFileContent(fileName, content) {
    fileContents[fileName] = content
  }
}
