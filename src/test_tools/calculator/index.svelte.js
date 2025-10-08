import { Tool } from '@/core/Tool.svelte.js'
import Calculator from '@tools/calculator/Calculator.svelte'

class CalculatorTool extends Tool {
  constructor() {
    super('Calculatrice', '🧮', 'topLeft')
  }

  initialize() {
    this.setComponent(Calculator)
  }
}

export default {
  register(toolManager) {
    const tool = new CalculatorTool()
    toolManager.registerTool(tool)
  }
}
