export class PersisterInterface {
  async export() {
    throw new Error('PersisterInterface.export() must be implemented by subclass')
  }

  async import(data) {
    throw new Error('PersisterInterface.import(data) must be implemented by subclass')
  }

  getNamespace() {
    throw new Error('PersisterInterface.getNamespace() must be implemented by subclass')
  }

  getDefaults() {
    return {}
  }

  validate(data) {
    if (!data || typeof data !== 'object') {
      return false
    }
    return true
  }

  sanitize(data) {
    if (!this.validate(data)) {
      return this.getDefaults()
    }
    return data
  }
}

export class SimplePersister extends PersisterInterface {
  constructor(namespace, exportFn, importFn, defaults = {}) {
    super()
    this.namespace = namespace
    this.exportFn = exportFn
    this.importFn = importFn
    this.defaults = defaults
  }

  async export() {
    if (typeof this.exportFn === 'function') {
      return await this.exportFn()
    }
    return this.getDefaults()
  }

  async import(data) {
    const sanitizedData = this.sanitize(data)
    if (typeof this.importFn === 'function') {
      await this.importFn(sanitizedData)
    }
  }

  getNamespace() {
    return this.namespace
  }

  getDefaults() {
    return { ...this.defaults }
  }
}
