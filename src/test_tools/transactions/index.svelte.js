import { Tool } from '@/core/Tool.svelte.js'
import TransactionsPanel from './TransactionsPanel.svelte'

class TransactionsTool extends Tool {
  constructor() {
    super('Transactions', '💳', 'topLeft', 'transactions')
  }

  initialize() {
    this.setComponent(TransactionsPanel)
  }
}

export default {
  register(toolManager) {
    const tool = new TransactionsTool()
    toolManager.registerTool(tool)
  }
}
