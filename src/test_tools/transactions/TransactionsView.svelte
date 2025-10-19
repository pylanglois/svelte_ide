<script>
  import { transactionsState } from './transactionsStore.svelte.js'
  import { accounts } from './TransactionsData.svelte.js'

  let accountLabel = $state('')
  let transactions = $state([])
  let totalAmount = $state(0)
  let currencyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
  let dateFormatter = new Intl.DateTimeFormat('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  $effect(() => {
    transactionsState.selectedAccountId
    const account = accounts[transactionsState.selectedAccountId]
    if (!account) {
      accountLabel = ''
      transactions = []
      totalAmount = 0
      return
    }
    accountLabel = account.name
    transactions = account.transactions
    totalAmount = account.transactions.reduce((sum, item) => sum + item.amount, 0)
  })

  function formatDate(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return dateFormatter.format(date)
  }

  function formatAmount(value) {
    return currencyFormatter.format(value)
  }
</script>

<div class="transactions-view">
  <div class="summary">
    <div class="summary-label">Compte sélectionné</div>
    <div class="summary-value">{accountLabel}</div>
    <div class="summary-total">{formatAmount(totalAmount)}</div>
  </div>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Montant</th>
          <th>Catégorie</th>
        </tr>
      </thead>
      <tbody>
        {#each transactions as transaction (transaction.id)}
          <tr class:debit={transaction.direction === 'debit'} class:credit={transaction.direction === 'credit'}>
            <td>{formatDate(transaction.date)}</td>
            <td>{transaction.description}</td>
            <td class="amount">{formatAmount(transaction.amount)}</td>
            <td>{transaction.category}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .transactions-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    padding: 16px;
    background: #1f1f23;
    color: #f3f3f3;
    font-family: 'Segoe UI', sans-serif;
  }

  .summary {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 12px;
    background: #25252a;
    padding: 12px 16px;
    border-radius: 4px;
    border: 1px solid #34343a;
    align-items: center;
  }

  .summary-label {
    font-size: 14px;
    color: #bbbbc2;
  }

  .summary-value {
    font-size: 16px;
    font-weight: 500;
  }

  .summary-total {
    justify-self: end;
    font-size: 16px;
    font-weight: 600;
    color: #4ec9b0;
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
    border: 1px solid #34343a;
    border-radius: 4px;
    background: #25252a;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    table-layout: fixed;
  }

  thead {
    background: #303035;
  }

  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #34343a;
  }

  th {
    font-weight: 600;
    color: #dcdce3;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.05em;
  }

  th:first-child,
  td:first-child {
    width: 120px;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 140px;
  }

  th:last-child,
  td:last-child {
    width: 160px;
  }

  tbody tr:nth-child(even) {
    background: #2b2b30;
  }

  tbody tr.debit .amount {
    color: #f44747;
  }

  tbody tr.credit .amount {
    color: #4ec9b0;
  }

  .amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
