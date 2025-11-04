import { mount } from 'svelte'
import App from '@/App.svelte'
import { applyCsp } from '@/core/security/csp.svelte.js'
import { ConsoleTool, NotificationsTool } from '@/core/SystemTools.js'
import { ideStore, registerDefaultHelpMenu } from '@/stores/ideStore.svelte.js'

applyCsp()

let externalTools = []
let systemTools = []
let statusMessages

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
    statusMessages
  }
})

export default app
