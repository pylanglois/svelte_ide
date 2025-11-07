import calculatorTool from './calculator/index.svelte.js'
import explorerTool from './explorer/index.svelte.js'
import explorer2Tool from './explorer2/index.svelte.js'
import transactionsTool from './transactions/index.svelte.js'
import transactionsV2Tool from './transactions_v2/index.svelte.js'

// Utilitaires de test exposés dans window
import './testAutoRefresh.svelte.js'
import './testReAuth.svelte.js'

const devExternalTools = [calculatorTool, explorerTool, explorer2Tool, transactionsTool, transactionsV2Tool]

export default devExternalTools
