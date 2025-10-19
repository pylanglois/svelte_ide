<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let expression = $state('')
  let result = $state('')
  let history = $state([])

  function calculate() {
    if (!expression.trim()) return
    
    try {
      const calcResult = eval(expression)
      result = calcResult.toString()
      
      history.unshift({
        expression,
        result: calcResult,
        timestamp: new Date()
      })
      
      if (history.length > 10) {
        history = history.slice(0, 10)
      }
      
      ideStore.addLog(`Calcul: ${expression} = ${calcResult}`, 'info', 'Calculator')
      ideStore.addNotification(
        'Calcul terminé',
        `${expression} = ${calcResult}`,
        'success',
        'Calculator'
      )
      
      expression = ''
    } catch (error) {
      result = 'Erreur'
      ideStore.addLog(`Erreur de calcul: ${error.message}`, 'error', 'Calculator')
      ideStore.addNotification(
        'Erreur de calcul',
        error.message,
        'error',
        'Calculator'
      )
    }
  }

  function addToExpression(value) {
    expression += value
  }

  function clearExpression() {
    expression = ''
    result = ''
  }

  function clearHistory() {
    history = []
    ideStore.addLog('Historique effacé', 'info', 'Calculator')
  }

  function useHistoryItem(item) {
    expression = item.expression
  }
</script>

<div class="calculator">
  <div class="calculator-header">
    <h3>Calculatrice</h3>
  </div>
  
  <div class="calculator-display">
    <input 
      type="text" 
      bind:value={expression} 
      placeholder="Entrez une expression..."
      onkeydown={(e) => e.key === 'Enter' && calculate()}
    />
    <div class="result">{result}</div>
  </div>

  <div class="calculator-buttons">
    <div class="button-row">
      <button onclick={() => clearExpression()}>C</button>
      <button onclick={() => addToExpression('(')}>(</button>
      <button onclick={() => addToExpression(')')}>)</button>
      <button onclick={() => addToExpression('/')}>/</button>
    </div>
    
    <div class="button-row">
      <button onclick={() => addToExpression('7')}>7</button>
      <button onclick={() => addToExpression('8')}>8</button>
      <button onclick={() => addToExpression('9')}>9</button>
      <button onclick={() => addToExpression('*')}>*</button>
    </div>
    
    <div class="button-row">
      <button onclick={() => addToExpression('4')}>4</button>
      <button onclick={() => addToExpression('5')}>5</button>
      <button onclick={() => addToExpression('6')}>6</button>
      <button onclick={() => addToExpression('-')}>-</button>
    </div>
    
    <div class="button-row">
      <button onclick={() => addToExpression('1')}>1</button>
      <button onclick={() => addToExpression('2')}>2</button>
      <button onclick={() => addToExpression('3')}>3</button>
      <button onclick={() => addToExpression('+')}>+</button>
    </div>
    
    <div class="button-row">
      <button onclick={() => addToExpression('0')}>0</button>
      <button onclick={() => addToExpression('.')}>.</button>
      <button onclick={calculate} class="equals">=</button>
    </div>
  </div>

  {#if history.length > 0}
    <div class="calculator-history">
      <div class="history-header">
        <h4>Historique</h4>
        <button onclick={clearHistory} class="clear-history">Effacer</button>
      </div>
      
      <div class="history-list">
        {#each history as item}
          <button type="button" class="history-item" onclick={() => useHistoryItem(item)}>
            <span class="history-expression">{item.expression}</span>
            <span class="history-result">= {item.result}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .calculator {
    padding: 16px;
    background: #2d2d30;
    border-radius: 4px;
    color: #cccccc;
    font-family: 'Segoe UI', sans-serif;
  }

  .calculator-header h3 {
    margin: 0 0 16px 0;
    color: #ffffff;
    font-size: 16px;
    font-weight: 500;
  }

  .calculator-display {
    margin-bottom: 16px;
  }

  .calculator-display input {
    width: 100%;
    padding: 12px;
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    color: #ffffff;
    border-radius: 4px;
    font-size: 16px;
    margin-bottom: 8px;
  }

  .calculator-display input:focus {
    outline: none;
    border-color: #007acc;
  }

  .result {
    padding: 8px 12px;
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    font-size: 18px;
    font-weight: bold;
    color: #4ec9b0;
    min-height: 24px;
  }

  .calculator-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .button-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 8px;
  }

  .button-row:last-child {
    grid-template-columns: 1fr 1fr 2fr;
  }

  button {
    padding: 12px;
    background: #3c3c3c;
    border: 1px solid #5a5a5a;
    color: #ffffff;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover {
    background: #505050;
  }

  button:active {
    background: #2a2a2a;
  }

  .equals {
    background: #007acc;
    border-color: #007acc;
  }

  .equals:hover {
    background: #005a9e;
  }

  .calculator-history {
    border-top: 1px solid #3e3e42;
    padding-top: 16px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .history-header h4 {
    margin: 0;
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
  }

  .clear-history {
    padding: 4px 8px;
    font-size: 12px;
    background: #d73a49;
    border-color: #d73a49;
  }

  .clear-history:hover {
    background: #b31d28;
  }

  .history-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .history-item:hover {
    background: #252526;
  }

  .history-item:focus-visible {
    outline: 2px solid #007acc;
    outline-offset: 2px;
  }

  .history-expression {
    color: #cccccc;
  }

  .history-result {
    color: #4ec9b0;
    font-weight: bold;
  }
</style>
