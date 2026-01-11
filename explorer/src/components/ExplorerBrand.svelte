<script>
let { label = 'SIDE Explorer', className = '' } = $props()
</script>

<div class={`explorer-brand ${className}`}>{label}</div>

<style>
.explorer-brand {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.03em;
  color: var(--primary);
}
</style>
