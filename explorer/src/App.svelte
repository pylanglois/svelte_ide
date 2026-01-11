<script>
import { BootGate, SideAppShell, i18nService } from '@svelte-ide/core'
import bonjourCapability from './capabilities/bonjour/index.svelte.js'
import { bonjourTranslations } from './capabilities/bonjour/translations.js'
import ExplorerBrand from './components/ExplorerBrand.svelte'

i18nService.registerTranslations('fr', bonjourTranslations.fr)
i18nService.registerTranslations('en', bonjourTranslations.en)
i18nService.setLocale('fr')

const capabilities = [bonjourCapability]
const branding = {
  component: ExplorerBrand,
  props: {
    label: 'SIDE Explorer'
  }
}
</script>

<BootGate>
  <SideAppShell {capabilities} {branding} />
</BootGate>
