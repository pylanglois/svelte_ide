<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  function formatTime(timestamp) {
    const now = new Date()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "À l'instant"
    if (minutes < 60) return `Il y a ${minutes}m`
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${days}j`
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'error': return '⚠️'
      case 'warning': return '⚠️'
      case 'success': return '✅'
      default: return 'ℹ️'
    }
  }

  function handleNotificationClick(notification) {
    if (!notification.read) {
      ideStore.markNotificationAsRead(notification.id)
    }
  }

  function handleNotificationKeydown(e, notification) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleNotificationClick(notification)
    }
  }

  function handleRemoveNotification(e, notificationId) {
    e.stopPropagation()
    ideStore.removeNotification(notificationId)
  }

  function handleMarkAllAsRead() {
    ideStore.markAllNotificationsAsRead()
  }

  function handleClearAll() {
    ideStore.clearAllNotifications()
  }
</script>

<div class="notifications-panel">
  <div class="notifications-header">
    <h3>Notifications</h3>
    <div class="header-actions">
      {#if ideStore.notifications.length > 0}
        <button class="action-btn" onclick={handleMarkAllAsRead} title="Marquer tout comme lu">
          ✓
        </button>
        <button class="action-btn" onclick={handleClearAll} title="Effacer tout">
          🗑️
        </button>
      {/if}
    </div>
  </div>

  <ul class="notifications-content" role="list">
    {#if ideStore.notifications.length === 0}
      <li class="empty-notifications">
        <div class="empty-icon">🔔</div>
        <p>Aucune notification</p>
      </li>
    {:else}
      {#each ideStore.notifications as notification (notification.id)}
        <li class="notification-item {notification.type}" class:unread={!notification.read}>
          <div
            class="notification-button"
            role="button"
            tabindex="0"
            aria-pressed={notification.read}
            onclick={() => handleNotificationClick(notification)}
            onkeydown={(e) => handleNotificationKeydown(e, notification)}
          >
            <div class="notification-content">
              <div class="notification-header">
                <span class="notification-icon" aria-hidden="true">{getNotificationIcon(notification.type)}</span>
                <span class="notification-title">{notification.title}</span>
                <button 
                  class="remove-btn"
                  onclick={(e) => handleRemoveNotification(e, notification.id)}
                  title="Supprimer"
                  type="button"
                  aria-label={`Supprimer la notification ${notification.title}`}
                >
                  ×
                </button>
              </div>
              <div class="notification-message">{notification.message}</div>
              <div class="notification-meta">
                <span class="notification-source">{notification.source}</span>
                <span class="notification-time">{formatTime(notification.timestamp)}</span>
              </div>
            </div>
          </div>
          {#if !notification.read}
            <div class="unread-indicator"></div>
          {/if}
        </li>
      {/each}
    {/if}
  </ul>
</div>

<style>
  .notifications-panel {
    height: 100%;
    background: #252526;
    color: #cccccc;
    display: flex;
    flex-direction: column;
  }

  .notifications-header {
    padding: 12px 16px;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #2d2d30;
  }

  .notifications-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #cccccc;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: #cccccc;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    font-size: 12px;
  }

  .action-btn:hover {
    background: #3e3e42;
  }

  .notifications-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    list-style: none;
    margin: 0;
  }

  .empty-notifications {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #858585;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #3e3e42;
    cursor: pointer;
    position: relative;
    transition: background-color 0.2s;
  }

  .notification-item:hover {
    background: #2d2d30;
  }

  .notification-item.unread {
    background: #1e3a8a10;
  }

  .notification-item.error {
    border-left: 3px solid #f87171;
  }

  .notification-item.warning {
    border-left: 3px solid #fbbf24;
  }

  .notification-item.success {
    border-left: 3px solid #34d399;
  }

  .notification-item.info {
    border-left: 3px solid #60a5fa;
  }

  .notification-button {
    display: block;
    width: 100%;
    height: 100%;
    text-align: left;
    cursor: pointer;
  }

  .notification-button:focus-visible {
    outline: 2px solid #007acc;
    outline-offset: 2px;
  }

  .notification-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .notification-icon {
    font-size: 14px;
  }

  .notification-title {
    font-weight: 500;
    font-size: 13px;
    flex: 1;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: #858585;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 16px;
    line-height: 1;
  }

  .remove-btn:hover {
    background: #3e3e42;
    color: #cccccc;
  }

  .notification-message {
    font-size: 12px;
    color: #cccccc;
    margin-bottom: 6px;
    line-height: 1.4;
  }

  .notification-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #858585;
  }

  .unread-indicator {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    background: #007acc;
    border-radius: 50%;
  }
</style>
