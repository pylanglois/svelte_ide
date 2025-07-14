import { LeftTool } from '../../core/Tool.svelte.js'
import { ideStore } from '../../stores/ideStore.svelte.js'
import Calculator from './Calculator.svelte'

class CalculatorTool extends LeftTool {
  constructor() {
    super('calculator', 'Calculatrice', '🧮')
  }

  initialize() {
    this.setComponent(Calculator)
    ideStore.addLog('Calculatrice initialisée', 'info', 'Calculator')
  }

  activate() {
    super.activate()
    ideStore.setStatusMessage('Calculatrice active')
  }

  deactivate() {
    super.deactivate()
    ideStore.setStatusMessage('')
  }

  calculate(expression) {
    try {
      const result = eval(expression)
      ideStore.addNotification(
        'Calcul terminé',
        `${expression} = ${result}`,
        'success',
        'Calculator'
      )
      return result
    } catch (error) {
      ideStore.addLog(`Erreur de calcul: ${error.message}`, 'error', 'Calculator')
      return null
    }
  }

  destroy() {
    ideStore.addLog('Calculatrice détruite', 'info', 'Calculator')
  }
}

export default {
  register(toolManager) {
    const tool = new CalculatorTool()
    toolManager.registerTool(tool)
  }
}
