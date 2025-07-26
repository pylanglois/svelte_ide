class EventBusService {
  constructor() {
    this.listeners = {}
  }

  /**
   * Publie un événement à tous les abonnés.
   * @param {string} eventName - Le nom de l'événement.
   * @param {*} [data] - Les données à transmettre avec l'événement.
   */
  publish(eventName, data) {
    if (!this.listeners[eventName]) {
      return
    }
    this.listeners[eventName].forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Erreur dans un callback d'événement pour '${eventName}':`, error)
      }
    })
  }

  /**
   * S'abonne à un événement.
   * @param {string} eventName - Le nom de l'événement.
   * @param {function} callback - La fonction à appeler lorsque l'événement est publié.
   * @returns {function} Une fonction pour se désabonner.
   */
  subscribe(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName].push(callback)

    // Retourne une fonction de désabonnement
    return () => {
      this.unsubscribe(eventName, callback)
    }
  }

  /**
   * Se désabonne d'un événement.
   * @param {string} eventName - Le nom de l'événement.
   * @param {function} callback - La fonction de callback à supprimer.
   */
  unsubscribe(eventName, callback) {
    if (!this.listeners[eventName]) {
      return
    }
    this.listeners[eventName] = this.listeners[eventName].filter(
      listener => listener !== callback
    )
  }
}

export const eventBus = new EventBusService()
