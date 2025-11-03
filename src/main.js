import { mount } from 'svelte'
import App from '@/App.svelte'
import { ideStore } from '@/stores/ideStore.svelte.js'

let externalTools = []

if (import.meta.env.DEV) {
  const module = await import('@/test_tools/devExternalTools.js')
  externalTools = module.default ?? []
}

const app = mount(App, {
  target: document.getElementById('app'),
  props: { externalTools }
})

// Ajouter quelques notifications de démonstration
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

export default app
