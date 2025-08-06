<script>
  import AuthUserMenu from './AuthUserMenu.svelte'
</script>

<div class="title-bar">
  <div class="title">
    <h1>IDE Svelte</h1>
  </div>

  <AuthUserMenu />
</div>

<style>
  .title-bar {
    height: 32px;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    color: #cccccc;
    font-size: 13px;
    position: relative;
    z-index: 1000;
  }

  .title h1 {
    font-size: 13px;
    font-weight: 400;
    margin: 0;
  }
</style>
