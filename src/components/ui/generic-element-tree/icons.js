export function FolderIcon({ size = 16, class: className = '' } = {}) {
  return {
    size,
    className,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="m4 17 2-10h14l-2 10Z"/><path d="M3 7h5l2 3h11"/><path d="M5 21h14"/></svg>`
  }
}

export function FileIcon({ size = 16, class: className = '' } = {}) {
  return {
    size,
    className,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`
  }
}

export function UploadIcon({ size = 16, class: className = '' } = {}) {
  return {
    size,
    className,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`
  }
}

export function ChevronDownIcon({ size = 16, class: className = '' } = {}) {
  return {
    size,
    className,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="m6 9 6 6 6-6"/></svg>`
  }
}

export function ChevronRightIcon({ size = 16, class: className = '' } = {}) {
  return {
    size,
    className,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="m9 18 6-6-6-6"/></svg>`
  }
}
