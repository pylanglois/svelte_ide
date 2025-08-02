export class DragDropService {
  constructor() {
    // État global du drag & drop
    this.draggedTab = $state(null)
    this.sourceGroup = $state(null)
    this.targetGroup = $state(null)
    this.dragOverTab = $state(null)
    this.isDragging = $derived(() => this.draggedTab !== null)
    this.dropZones = $state([])
    
    // Nouveau système de prévisualisation IntelliJ-style
    this.dropPreview = $state(null) // { groupId, zone: 'center'|'top'|'bottom'|'left'|'right', rect }
  }

  // Démarrer un drag
  startDrag(tab, sourceGroupId) {
    this.draggedTab = tab
    this.sourceGroup = sourceGroupId
    this.targetGroup = null
    this.dragOverTab = null
    this.dropPreview = null
    document.body.style.userSelect = 'none'
    
    // Calculer les zones de drop possibles
    this._calculateDropZones()
  }

  // Définir la cible de drag over
  setDragTarget(targetGroupId, targetTab = null) {
    this.targetGroup = targetGroupId
    this.dragOverTab = targetTab
    this.dropPreview = null
  }

  // Nouveau : Calculer et définir la zone de prévisualisation
  setDropPreview(groupId, rect, mouseX, mouseY) {
    const zone = this.calculateDropZone(rect, mouseX, mouseY)
    const previewRect = this.calculatePreviewRect(rect, zone)
    
    this.dropPreview = {
      groupId,
      zone,
      rect: previewRect
    }
    
    // Nettoyer les anciens états
    this.targetGroup = null
    this.dragOverTab = null
  }

  // Nettoyer le drag target
  clearDragTarget() {
    this.targetGroup = null
    this.dragOverTab = null
    this.dropPreview = null
  }

  // Terminer le drag
  endDrag() {
    this.draggedTab = null
    this.sourceGroup = null
    this.targetGroup = null
    this.dragOverTab = null
    this.dropZones = []
    this.dropPreview = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  // Calculer la zone de drop en fonction de la position de la souris (style IntelliJ)
  calculateDropZone(rect, mouseX, mouseY) {
    const { left, right, top, bottom, width, height } = rect
    
    // Normaliser les coordonnées (0 à 1)
    const relativeX = (mouseX - left) / width
    const relativeY = (mouseY - top) / height
    
    // Zones : centre = 40%, bords = 30% chaque côté
    const centerMargin = 0.3 // 30% de chaque côté = 40% au centre
    
    // Vérifier les bords en priorité
    if (relativeX < centerMargin) {
      return 'left'
    } else if (relativeX > (1 - centerMargin)) {
      return 'right'
    } else if (relativeY < centerMargin) {
      return 'top'
    } else if (relativeY > (1 - centerMargin)) {
      return 'bottom'
    } else {
      return 'center'
    }
  }

  // Calculer le rectangle de prévisualisation selon la zone
  calculatePreviewRect(containerRect, zone) {
    const { left, top, width, height } = containerRect
    
    switch (zone) {
      case 'center':
        return { left, top, width, height }
      
      case 'top':
        return { left, top, width, height: height / 2 }
      
      case 'bottom':
        return { left, top: top + height / 2, width, height: height / 2 }
      
      case 'left':
        return { left, top, width: width / 2, height }
      
      case 'right':
        return { left: left + width / 2, top, width: width / 2, height }
      
      default:
        return { left, top, width, height }
    }
  }

  // Vérifier si un groupe est une zone de drop valide
  isValidDropZone(groupId) {
    return this.dropZones.includes(groupId)
  }

  // Vérifier si un tab est en cours de drag
  isTabBeingDragged(tabId) {
    return this.draggedTab?.id === tabId
  }

  // Vérifier si un tab est une cible de drag over
  isTabDragTarget(tabId) {
    return this.dragOverTab?.id === tabId
  }

  // Vérifier si un groupe est la cible actuelle
  isGroupDragTarget(groupId) {
    return this.targetGroup === groupId
  }

  // Vérifier si un groupe a une prévisualisation active
  hasDropPreview(groupId) {
    return this.dropPreview?.groupId === groupId
  }

  // Obtenir la prévisualisation de drop
  getDropPreview(groupId) {
    return this.dropPreview?.groupId === groupId ? this.dropPreview : null
  }

  // Calculer les zones de drop possibles (privé)
  _calculateDropZones() {
    // Pour l'instant, toutes les zones sont valides
    // Plus tard on pourra ajouter des restrictions
    this.dropZones = ['*'] // Wildcard pour "tous les groupes"
  }

  // Obtenir les informations de drag actuel
  getDragInfo() {
    return {
      draggedTab: this.draggedTab,
      sourceGroup: this.sourceGroup,
      targetGroup: this.targetGroup,
      isDragging: this.isDragging,
      dropPreview: this.dropPreview
    }
  }
}

// Instance globale
export const dragDropService = new DragDropService()
