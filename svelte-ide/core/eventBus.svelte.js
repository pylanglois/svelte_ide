const subscribers = new Map()

function publish(eventName, data) {
  const eventSubscribers = subscribers.get(eventName)
  if (eventSubscribers) {
    eventSubscribers.forEach(callback => callback(data))
  }
}

function subscribe(eventName, callback) {
  if (!subscribers.has(eventName)) {
    subscribers.set(eventName, new Set())
  }
  subscribers.get(eventName).add(callback)

  return () => {
    const eventSubscribers = subscribers.get(eventName)
    if (eventSubscribers) {
      eventSubscribers.delete(callback)
      if (eventSubscribers.size === 0) {
        subscribers.delete(eventName)
      }
    }
  }
}

export const eventBus = {
  publish,
  subscribe
}
