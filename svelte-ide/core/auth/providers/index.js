import { AzureProvider } from './AzureProvider.svelte.js'
import { GoogleProvider } from './GoogleProvider.svelte.js'

const providerRegistry = {
  azure: AzureProvider,
  google: GoogleProvider
}
export {
  AzureProvider,
  GoogleProvider,
  providerRegistry
}
