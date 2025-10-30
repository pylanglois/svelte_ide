import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'

const workspaceFiles = [
  {
    name: 'roadmap-v2.md',
    type: 'file',
    category: 'documentation',
    icon: '🧭',
    content: `# Roadmap V2

## Objectifs trimestriels
- Stabiliser la nouvelle API (Q1)
- Ajouter la synchronisation multi-appareils (Q2)
- Préparer la bêta publique (Q3)

## Suivi hebdomadaire
| Semaine | Responsable | État |
| ------ | ----------- | ---- |
| 12 | Alice M. | ✅ Terminé |
| 13 | Julien D. | 🔄 En cours |
| 14 | À planifier | ⏳ |
`
  },
  {
    name: 'analytics-v2.json',
    type: 'file',
    category: 'data',
    icon: '📊',
    content: `{
  "version": "2.4.0",
  "funnel": {
    "signup": 1240,
    "onboarding": 983,
    "activation": 712
  },
  "retention": {
    "day_1": 0.61,
    "day_7": 0.43,
    "day_30": 0.28
  },
  "cohorts": [
    { "month": "2025-01", "users": 412 },
    { "month": "2025-02", "users": 503 },
    { "month": "2025-03", "users": 547 }
  ]
}
`
  },
  {
    name: 'customer-feedback.csv',
    type: 'file',
    category: 'support',
    icon: '💬',
    content: `date,client,priorité,commentaire
2025-03-02,AgriPulse,haute,"Il manque un export XLSX depuis la vue V2."
2025-03-05,Cobalt Security,moyenne,"Dashboard V2 plus lent que V1 sur Safari."
2025-03-09,Studio Laki,haute,"Dark mode superbe, mais besoin d'une doc API mise à jour."
2025-03-11,Foodies,faible,"Merci pour les templates de rapports V2 🥐"
`
  },
  {
    name: 'pipeline-ci.yml',
    type: 'file',
    category: 'devops',
    icon: '⚙️',
    content: `name: CI V2

on:
  push:
    branches: [ "main", "release/*" ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - run: pnpm build
`
  },
  {
    name: 'personas/',
    type: 'folder',
    icon: '🧑‍🤝‍🧑',
    children: [
      {
        name: 'ops-manager.md',
        type: 'file',
        icon: '🛠️',
        content: `# Persona: Responsable Opérations

## Besoins clés
- Rapports consolidés quotidiens
- Alertes en cas de dérive d'indicateurs
- Export rapide vers Excel

## Pain points
- Enchaînement entre V1 et V2 pénible
- Veut des filtres sauvegardés
`
      },
      {
        name: 'cto.md',
        type: 'file',
        icon: '💡',
        content: `# Persona: CTO SaaS

## Motivation
- Simplifier la supervision multi-équipes
- Donner plus d'autonomie aux product managers

## Notes
- Très sensible aux performances
- Adore les dashboards personnalisables
`
      }
    ]
  },
  {
    name: 'assets/',
    type: 'folder',
    icon: '🗂️',
    children: [
      {
        name: 'logo-v2.svg',
        type: 'file',
        icon: '🎨',
        content: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#14b8a6" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="32" fill="#0f172a" />
  <path d="M60 140L100 40l40 100" stroke="url(#accent)" stroke-width="18" stroke-linecap="round" fill="none" />
  <circle cx="100" cy="140" r="10" fill="#f8fafc" />
</svg>
`
      },
      {
        name: 'hero-v2.html',
        type: 'file',
        icon: '🌐',
        content: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Hero V2</title>
</head>
<body>
  <section style="font-family: 'Inter', sans-serif; background: linear-gradient(135deg,#0f172a,#312e81); color:white; padding: 64px;">
    <h1>Plateforme Analytics V2</h1>
    <p>Suivez vos indicateurs, automatisez vos rapports et partagez vos insights en un clin d'œil.</p>
    <button style="padding: 12px 24px; border:none; border-radius: 999px; background:#22d3ee; color:#0f172a; font-weight:600; cursor:pointer;">Demander une démo</button>
  </section>
</body>
</html>
`
      }
    ]
  }
]

function flattenFiles(list, parent = '') {
  return list.flatMap(item => {
    const qualifiedName = parent ? `${parent}/${item.name}` : item.name

    if (item.type === 'folder' && Array.isArray(item.children)) {
      return [
        { name: qualifiedName, type: 'folder', icon: item.icon || '🗂️' },
        ...flattenFiles(item.children, qualifiedName)
      ]
    }

    return [{
      name: qualifiedName,
      type: 'file',
      icon: item.icon || getFileIcon(item.name),
      size: item.content.length,
      content: item.content,
      category: item.category
    }]
  })
}

const flattened = flattenFiles(workspaceFiles)

export function getFileListV2() {
  return flattened.map(({ name, type, icon, size }) => ({ name, type, icon, size }))
}

export function getFileContentV2(fileName) {
  const entry = flattened.find(file => file.name === fileName)
  if (entry?.type === 'file') {
    return entry.content
  }
  return 'Contenu non disponible pour ce fichier ou dossier.'
}

export function openFileInIDEv2(fileName, ideStore, FileViewer, toolId = 'explorer2') {
  const entry = flattened.find(file => file.name === fileName)
  const content = entry?.content ?? 'Contenu non disponible'

  return ideStore.openFile({
    fileName: `V2: ${fileName}`,
    content,
    component: FileViewer,
    icon: entry?.icon || getFileIcon(fileName),
    toolId,
    scrollMode: SCROLL_MODES.tool
  })
}

function getFileIcon(fileName) {
  const extension = fileName.split('.').pop()
  const icons = {
    txt: '📄',
    md: '📝',
    js: '🧠',
    json: '📊',
    csv: '🗂️',
    yml: '⚙️',
    svg: '🎨',
    html: '🌐'
  }
  return icons[extension] || '📁'
}
