let capabilities = $state([])
let activeCapability = $state(null)

function registerCapability(capability) {
  if (!capabilities.find(c => c.id === capability.id)) {
    capabilities.push(capability)
  }
}

function setActiveCapability(capabilityId) {
  const capability = capabilities.find(c => c.id === capabilityId)
  if (capability) {
    activeCapability = capability
  }
}

export const sideStore = {
  get capabilities() { return capabilities },
  get activeCapability() { return activeCapability },
  registerCapability,
  setActiveCapability
}
