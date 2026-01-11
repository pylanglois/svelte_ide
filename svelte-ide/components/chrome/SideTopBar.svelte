<script>
let { branding = null, rightComponent = null, rightProps = {} } = $props()

let brandingComponent = $state(null)
let brandingProps = $state({})

$effect(() => {
  brandingComponent = branding?.component ?? null
  brandingProps = branding?.props ?? {}
})
</script>

<div class="side-top-bar">
  <div class="side-top-left">
    {#if brandingComponent}
      <div class="side-branding">
        {@render brandingComponent(brandingProps)}
      </div>
    {/if}
  </div>

  <div class="side-top-right">
    {#if rightComponent}
      {@render rightComponent(rightProps)}
    {/if}
  </div>
</div>

<style>
.side-top-bar {
  height: 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 13px;
}

.side-top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.side-branding {
  display: flex;
  align-items: center;
}

.side-top-right {
  display: flex;
  align-items: center;
  position: relative;
}
</style>
