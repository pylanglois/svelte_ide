import { mount } from 'svelte'
import App from '@/App.svelte'
import AppLogo from '@/components/layout/chrome/AppLogo.svelte'
import { applyCsp } from '@/core/security/csp.svelte.js'
import { ConsoleTool, NotificationsTool } from '@/core/SystemTools.js'
import { statusBarService } from '@/core/StatusBarService.svelte.js'
import StatusMessageItem from '@/components/layout/chrome/statusbar/StatusMessageItem.svelte'
import ActiveTabItem from '@/components/layout/chrome/statusbar/ActiveTabItem.svelte'
import ClockItem from '@/components/layout/chrome/statusbar/ClockItem.svelte'
import { ideStore, registerDefaultHelpMenu } from '@/stores/ideStore.svelte.js'

applyCsp()

let externalTools = []
let systemTools = []
let statusMessages
const branding = {
  component: AppLogo,
  props: { size: 26 }
}

if (import.meta.env.DEV) {
  const module = await import('@/test_tools/devExternalTools.js')
  externalTools = module.default ?? []

  systemTools = [
    () => new ConsoleTool(),
    () => new NotificationsTool()
  ]

  statusMessages = {
    initializing: 'Initialisation du systeme...',
    systemTools: 'Chargement des outils systeme...',
    externalTools: 'Chargement des outils externes...',
    ready: 'IDE pret'
  }

  registerDefaultHelpMenu(ideStore, { ownerId: 'demo' })

  statusBarService.registerItem('left', {
    id: 'status-message',
    component: StatusMessageItem,
    props: { fallback: 'Prêt' },
    order: 0
  }, 'demo')

  statusBarService.registerItem('center', {
    id: 'active-tab',
    component: ActiveTabItem,
    props: { label: 'Fichier actif :' },
    order: 0
  }, 'demo')

  statusBarService.registerItem('right', {
    id: 'clock',
    component: ClockItem,
    props: { },
    order: 0
  }, 'demo')

  setTimeout(() => {
    ideStore.addNotification(
      'Bienvenue dans l\'IDE',
      'Votre environnement de développement est prêt à être utilisé',
      'success',
      'Système'
    )
    
    ideStore.addNotification(
      'Nouveau projet',
      'Un nouveau projet a été créé avec succès',
      'info',
      'Gestionnaire de projet'
    )
    
    ideStore.addNotification(
      'Attention',
      'Pensez à sauvegarder régulièrement votre travail',
      'warning',
      'Système'
    )
  }, 2000)
}

const app = mount(App, {
  target: document.getElementById('app'),
  props: {
    externalTools,
    systemTools,
    statusMessages,
    branding
  }
})

export default app
