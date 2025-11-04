<script>
  const props = $props()
  const defaultLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'fr-CA'
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
  let locale = defaultLocale
  let options = defaultOptions
  let className = ''

  $effect(() => {
    ({ locale = defaultLocale, options = defaultOptions, className = '' } = props)
  })

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
