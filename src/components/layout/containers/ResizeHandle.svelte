<script>
  let { direction = 'vertical', onResizeStart = () => {}, onKeyboardAdjust = null } = $props()

  function handleKeyDown(e) {
    if (direction === 'vertical' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1
      onKeyboardAdjust?.(delta)
    } else if (direction === 'horizontal' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? -1 : 1
      onKeyboardAdjust?.(delta)
    }
  }
</script>

<button
  class="resize-handle"
  class:vertical={direction === 'vertical'}
  class:horizontal={direction === 'horizontal'}
  onmousedown={onResizeStart}
  type="button"
  aria-label={direction === 'vertical' ? 'Redimensionner les panneaux lateraux' : 'Redimensionner les panneaux superieurs et inferieurs'}
  onkeydown={handleKeyDown}
></button>

<style>
  .resize-handle {
    background: rgba(255, 255, 255, 0.03);
    transition: background-color 0.2s;
    flex-shrink: 0;
    border: none;
    padding: 0;
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
