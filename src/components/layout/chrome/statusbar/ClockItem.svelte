<script>
  const props = $props()
  const defaultLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'fr-CA'
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  const locale = $derived(props.locale ?? defaultLocale)
  const options = $derived(props.options ?? defaultOptions)
  const className = $derived(props.className ?? '')

  let now = $state(new Date())

  $effect(() => {
    const interval = setInterval(() => {
      now = new Date()
    }, 1000)

    return () => clearInterval(interval)
  })

</script>

<span class={`status-clock ${className}`}>
  {now.toLocaleTimeString(locale, options)}
</span>
