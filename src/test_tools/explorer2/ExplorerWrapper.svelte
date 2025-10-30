<script>
  import FileExplorer from './FileExplorer.svelte'
  import { getFileListV2 } from './fileService.svelte.js'

  let { toolId } = $props()

  const files = getFileListV2()
</script>

<FileExplorer {files} {toolId} />
