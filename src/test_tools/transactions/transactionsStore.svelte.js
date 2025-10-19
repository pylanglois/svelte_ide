import { accounts } from './TransactionsData.svelte.js'

const state = $state({
  selectedAccountId: Object.keys(accounts)[0] || '',
  tabId: null
})

export const transactionsState = state

export const transactionsStore = {
  getAccounts() {
    return accounts
  },

  getAccountKeys() {
    return Object.keys(accounts)
  },

  getSelectedAccountId() {
    return state.selectedAccountId
  },

  selectAccount(id) {
    if (!accounts[id]) return
    state.selectedAccountId = id
  },

  getTabId() {
    return state.tabId
  },

  setTabId(id) {
    state.tabId = id
  },

  clearTabId() {
    state.tabId = null
  }
}
