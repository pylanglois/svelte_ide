import { Tool } from '@/core/Tool.svelte.js'
import Console from '@/components/system/console/Console.svelte'
import Notifications from '@/components/system/notifications/Notifications.svelte'

export class ConsoleTool extends Tool {
  constructor() {
    super('Console', '>', 'bottom', 'console')
  }

  initialize() {
    this.setComponent(Console)
  }
}

export class NotificationsTool extends Tool {
  constructor() {
    super('Notifications', '🔔', 'bottomRight', 'notifications')
  }

  initialize() {
    this.setComponent(Notifications)
  }
}
