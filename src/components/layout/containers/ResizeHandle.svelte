<script>
  let { direction = 'vertical', onResizeStart = () => {} } = $props()
</script>

<div
  class="resize-handle"
  class:vertical={direction === 'vertical'}
  class:horizontal={direction === 'horizontal'}
  onmousedown={onResizeStart}
  role="separator"
></div>

<style>
  .resize-handle {
    background: rgba(255, 255, 255, 0.03);
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .resize-handle:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .resize-handle:active {
    background: #007acc;
  }

  .vertical {
    width: 4px;
    cursor: ew-resize;
    height: 100%;
  }

  .horizontal {
    height: 4px;
    cursor: ns-resize;
    width: 100%;
  }
</style>
