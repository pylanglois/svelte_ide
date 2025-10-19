<script>
  import { Tab } from '@/core/Tab.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { transactionsStore, transactionsState } from './transactionsStore.svelte.js'
  import TransactionsView from './TransactionsView.svelte'

  let { panelId } = $props()
  const accounts = transactionsStore.getAccounts()
  const accountKeys = transactionsStore.getAccountKeys()
  let selectedAccount = $state(transactionsStore.getSelectedAccountId())

  function ensureTab() {
    const storedId = transactionsStore.getTabId()
    let tab = storedId ? ideStore.getTabById(storedId) : null
    if (!tab) {
      const fixedId = 'transactions-tab'
      tab = ideStore.getTabById(fixedId)
      if (!tab) {
        const newTab = new Tab(fixedId, 'Transactions', TransactionsView, true, '💳', 'tool')
        newTab.toolId = 'transactions'
        newTab.setDescriptor({
          type: 'transactions-view',
          resourceId: 'transactions',
          toolId: 'transactions',
          icon: '💳',
          params: {}
        })
        ideStore.addTab(newTab)
        tab = newTab
      }
      transactionsStore.setTabId(fixedId)
    }
    if (tab) {
      ideStore.setActiveTab(tab.id)
    }
  }

  function handleTabClosed(payload) {
    const closedId = payload?.tabId ?? payload
    if (closedId === transactionsStore.getTabId()) {
      transactionsStore.clearTabId()
      ensureTab()
    }
  }

  function selectAccount(id) {
    if (selectedAccount === id) return
    transactionsStore.selectAccount(id)
    const account = accounts[id]
    if (account) {
      ideStore.addLog(`Transactions: ${account.name}`, 'info', 'Transactions')
    }
  }

  ensureTab()

  $effect(() => {
    const unsubscribe = eventBus.subscribe('tabs:closed', handleTabClosed)
    return () => unsubscribe()
  })

  $effect(() => {
    transactionsState.selectedAccountId
    selectedAccount = transactionsState.selectedAccountId
  })
</script>

<div class="panel" data-panel-id={panelId}>
  <div class="header">Transactions</div>
  <div class="accounts">
    {#each accountKeys as key}
      <button
        type="button"
        class:active={selectedAccount === key}
        onclick={() => selectAccount(key)}
      >
        {accounts[key].name}
      </button>
    {/each}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    padding: 16px;
    background: #1f1f23;
    color: #f3f3f3;
    font-family: 'Segoe UI', sans-serif;
  }

  .header {
    font-size: 18px;
    font-weight: 600;
  }

  .accounts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .accounts button {
    border: 1px solid #3b3b40;
    background: #2a2a2f;
    color: #f3f3f3;
    padding: 10px 12px;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .accounts button:hover {
    background: #35353b;
  }

  .accounts button.active {
    background: #007acc;
    border-color: #007acc;
  }
</style>
