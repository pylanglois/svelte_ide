<script>
  let { children, class: className = '' } = $props()
  
  let container = $state(null)
  let content = $state(null)
  let scrollbar = $state(null)
  let thumb = $state(null)
  
  let isDragging = $state(false)
  let dragStartX = $state(0)
  let dragStartScrollLeft = $state(0)
  let showScrollbar = $state(true) // Temporairement forcé à true pour debug
  let currentScrollLeft = $state(0) // Track du scroll position
  
  // États réactifs pour les dimensions (problème principal !)
  let containerWidth = $state(0)
  let contentWidth = $state(0)
  
  // Méthode publique pour faire défiler vers un onglet spécifique
  function scrollToTab(tabId) {
    if (content) {
      const activeTabElement = content.querySelector(`[data-tab-id="${tabId}"]`)
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        })
      }
    }
  }
  
  // Exposer la méthode via un attribut global pour le composant parent
  $effect(() => {
    if (container) {
      container._scrollToTab = scrollToTab
    }
  })
  
  // Fonction pour mettre à jour toutes les dimensions réactives
  function updateDimensions() {
    if (container && content) {
      containerWidth = container.clientWidth
      contentWidth = content.scrollWidth
      currentScrollLeft = content.scrollLeft
    }
  }

  // SOLUTION INFAILLIBLE: $effect + $state au lieu de $derived piégeux
  let scrollRatio = $state(1)
  let thumbWidth = $state(20)
  let thumbPosition = $state(0)
  let needsScrollbar = $state(false)
  let maxScrollDistance = $state(0)
  let scrollPercentage = $state(0)

  // $effect pour calculer toutes les valeurs - EXPLICITE et FIABLE
  $effect(() => {
    if (containerWidth > 0 && contentWidth > 0) {
      scrollRatio = containerWidth / contentWidth
      
      const minThumbWidth = 20
      thumbWidth = Math.max(containerWidth * scrollRatio, minThumbWidth)
      
      maxScrollDistance = Math.max(contentWidth - containerWidth, 0)

      if (maxScrollDistance > 0) {
        scrollPercentage = currentScrollLeft / maxScrollDistance
        const availableSpace = containerWidth - thumbWidth
        thumbPosition = scrollPercentage * availableSpace
      } else {
        scrollPercentage = 0
        thumbPosition = 0
      }

      needsScrollbar = contentWidth > containerWidth
    } else {
      maxScrollDistance = 0
      scrollPercentage = 0
      thumbPosition = 0
    }
  })

  // Gérer le scroll avec la molette
  function handleWheel(e) {
    if (!content) return
    e.preventDefault()
    content.scrollLeft += e.deltaY
    updateScrollbarVisibility()
  }
  
  // Ajouter l'événement wheel avec l'option passive
  $effect(() => {
    if (container) {
      const wheelHandler = (e) => {
        if (!content) return
        e.preventDefault()
        content.scrollLeft += e.deltaY
        currentScrollLeft = content.scrollLeft
        updateScrollbarVisibility()
      }
      
      container.addEventListener('wheel', wheelHandler, { passive: false })
      
      return () => {
        container.removeEventListener('wheel', wheelHandler)
      }
    }
  })

  // Gérer le drag du thumb
  function handleThumbMouseDown(e) {
    e.preventDefault()
    isDragging = true
    dragStartX = e.clientX
    dragStartScrollLeft = content.scrollLeft
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e) {
    if (!isDragging || !content || !container) return
    
    const deltaX = e.clientX - dragStartX
    const containerWidth = container.clientWidth
    const contentWidth = content.scrollWidth
    const maxScroll = contentWidth - containerWidth
    const maxThumbPosition = containerWidth - thumbWidth
    
    if (maxThumbPosition <= 0) return
    
    const scrollDelta = (deltaX / maxThumbPosition) * maxScroll
    content.scrollLeft = Math.max(0, Math.min(maxScroll, dragStartScrollLeft + scrollDelta))
    currentScrollLeft = content.scrollLeft // Sync l'état réactif
  }

  function handleMouseUp() {
    isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  function handleThumbKeyDown(e) {
    if (!content || !container) return

    const step = container.clientWidth / 4
    const maxScroll = Math.max(content.scrollWidth - container.clientWidth, 0)
    let target = content.scrollLeft

    switch (e.key) {
      case 'Home':
        target = 0
        break
      case 'End':
        target = maxScroll
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = Math.max(0, content.scrollLeft - step)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        target = Math.min(maxScroll, content.scrollLeft + step)
        break
      default:
        return
    }

    e.preventDefault()
    content.scrollLeft = target
    currentScrollLeft = target
    updateScrollbarVisibility()
  }

  // Gérer le clic sur la track
  function handleTrackClick(e) {
    if (!content || !container || e.target === thumb) return
    if (e.detail === 0) return

    const rect = scrollbar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const containerWidth = container.clientWidth
    const contentWidth = content.scrollWidth
    const maxScroll = contentWidth - containerWidth

    const targetScrollLeft = (clickX / containerWidth) * maxScroll
    content.scrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft))
    currentScrollLeft = content.scrollLeft // Sync l'état réactif
  }

  function handleTrackKeyDown(e) {
    if (!content || !container) return

    const pageStep = container.clientWidth / 2
    const maxScroll = Math.max(content.scrollWidth - container.clientWidth, 0)
    let target = content.scrollLeft

    switch (e.key) {
      case 'Home':
        target = 0
        break
      case 'End':
        target = maxScroll
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = Math.max(0, content.scrollLeft - pageStep)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        target = Math.min(maxScroll, content.scrollLeft + pageStep)
        break
      default:
        return
    }

    e.preventDefault()
    content.scrollLeft = target
    currentScrollLeft = target
    updateScrollbarVisibility()
  }

  // Afficher/masquer le scrollbar
  function updateScrollbarVisibility() {
    showScrollbar = needsScrollbar
    if (showScrollbar) {
      clearTimeout(hideTimeout)
      hideTimeout = setTimeout(() => {
        if (!isDragging) {
          showScrollbar = false
        }
      }, 1500)
    }
  }

  let hideTimeout = null

  // Effet pour surveiller les changements de contenu
  $effect(() => {
    if (content && container) {
      // Initialiser les dimensions au montage
      updateDimensions()
      
      const observer = new ResizeObserver(() => {
        updateDimensions() // Mettre à jour quand la taille change
        updateScrollbarVisibility()
      })
      observer.observe(content)
      observer.observe(container)
      
      // Observer les mutations du DOM pour détecter l'ajout/suppression d'onglets
      const mutationObserver = new MutationObserver(() => {
        setTimeout(() => updateDimensions(), 10)
      })
      mutationObserver.observe(content, { 
        childList: true, 
        subtree: true,
        attributes: true 
      })
      
      // Gérer le scroll
      const handleScroll = () => {
        currentScrollLeft = content.scrollLeft
        updateScrollbarVisibility()
      }
      content.addEventListener('scroll', handleScroll)
      
      return () => {
        observer.disconnect()
        mutationObserver.disconnect()
        content.removeEventListener('scroll', handleScroll)
        if (hideTimeout) clearTimeout(hideTimeout)
      }
    }
  })

  // Effet séparé pour réagir aux changements de children
  $effect(() => {
    if (children && container && content) {
      setTimeout(() => updateDimensions(), 50)
    }
  })

  // Afficher le scrollbar au survol
  function handleMouseEnter() {
    if (needsScrollbar) {
      showScrollbar = true
      if (hideTimeout) clearTimeout(hideTimeout)
    }
  }

  function handleMouseLeave() {
    if (!isDragging && needsScrollbar) {
      hideTimeout = setTimeout(() => {
        showScrollbar = false
      }, 500)
    }
  }
</script>

<div 
  class="tab-scroll-container {className}"
  bind:this={container}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="presentation"
>
  <div 
    class="tab-scroll-content"
    bind:this={content}
  >
    {@render children()}
  </div>
  
  <!-- Zone dédiée pour la scrollbar - TOUJOURS présente -->
  <div class="tab-scrollbar-zone">
    {#if needsScrollbar}
      <button 
        type="button"
        class="tab-scrollbar"
        class:visible={showScrollbar}
        bind:this={scrollbar}
        onclick={handleTrackClick}
        onkeydown={handleTrackKeyDown}
        aria-label="Défiler les onglets"
      >
        <div 
          class="tab-scrollbar-thumb"
          class:dragging={isDragging}
          bind:this={thumb}
          style:width="{thumbWidth}px"
          style:transform="translateX({thumbPosition}px)"
          onmousedown={handleThumbMouseDown}
          onkeydown={handleThumbKeyDown}
          role="slider"
          tabindex="0"
          aria-orientation="horizontal"
          aria-valuemin="0"
          aria-valuemax={maxScrollDistance}
          aria-valuenow={currentScrollLeft}
          aria-valuetext={`${Math.round(scrollPercentage * 100)}%`}
        ></div>
      </button>
    {/if}
  </div>
</div>

<style>
  .tab-scroll-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
  }

  .tab-scroll-content {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
    scrollbar-width: none;
    -ms-overflow-style: none;
    flex: 1;
  }

  .tab-scroll-content::-webkit-scrollbar {
    display: none;
  }

  .tab-scrollbar-zone {
    height: 4px;
    width: 100%;
    background: transparent;
    flex-shrink: 0;
  }

  .tab-scrollbar {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.03);
    opacity: 0;
    transition: opacity 0.2s ease;
    cursor: pointer;
    border: none;
    padding: 0;
    display: block;
    font: inherit;
  }

  .tab-scrollbar.visible {
    opacity: 1;
  }

  .tab-scrollbar:focus-visible {
    outline: 2px solid #007acc;
    outline-offset: 2px;
  }

  .tab-scrollbar-thumb {
    position: absolute;
    top: 0;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    cursor: grab;
    transition: background-color 0.15s ease, transform 0.1s ease;
    min-width: 20px;
    outline: none;
  }

  .tab-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .tab-scrollbar-thumb.dragging {
    background: rgba(255, 255, 255, 0.4);
    cursor: grabbing;
    transition: background-color 0.15s ease;
  }
</style>
