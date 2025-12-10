<script>
  let { size = 16, strokeWidth = 2, className = '' } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  focusable="false"
>
  <polyline points="13 2 3 14 10 14 8 22 18 10 11 10 13 2" />
</svg>
