const categories = [
  'Alimentation',
  'Transport',
  'Loisir',
  'Logement',
  'Santé',
  'Services',
  'Remboursement',
  'Virement',
  'Abonnement',
  'Achat en ligne'
]

const descriptors = [
  'Paiement carte',
  'Facture',
  'Achat',
  'Virement entrant',
  'Virement sortant',
  'Prélèvement',
  'Transfert',
  'Retrait',
  'Commande',
  'Cotisation'
]

const merchants = [
  'Marché Central',
  'SuperMarché Bleu',
  'Libre Service 24h',
  'Boulangerie du Quai',
  'Station Alpha',
  'Café Rivière',
  'Cinéma Lumière',
  'Librairie Papyrus',
  'Clinique Horizon',
  'Énergie Plus',
  'Assurances Nova',
  'Salle ZenFit',
  'Magasin TechOne',
  'Boutique Éclat',
  'Musée Métropole',
  'Voyages Océane',
  'Optique Vision',
  'Restaurant Soleil',
  'Atelier Créatif',
  'Pressing Express'
]

function createGenerator(seed) {
  let value = seed % 2147483647
  if (value <= 0) {
    value += 2147483646
  }
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function roundAmount(value) {
  return Math.round(value * 100) / 100
}

function buildTransaction(idPrefix, index, date, amount, category, descriptor, merchant) {
  const sign = amount === 0 ? 1 : Math.sign(amount)
  return {
    id: `${idPrefix}-${index}`,
    date,
    description: `${descriptor} - ${merchant}`,
    amount: roundAmount(amount),
    category,
    direction: sign >= 0 ? 'credit' : 'debit'
  }
}

function generateTransactions(seed, idPrefix, count, amountScale) {
  const random = createGenerator(seed)
  const now = Date.now()
  const transactions = []
  for (let index = 0; index < count; index += 1) {
    const dayOffset = Math.floor(random() * 720)
    const timestamp = now - dayOffset * 86400000
    const category = categories[Math.floor(random() * categories.length)]
    const descriptor = descriptors[Math.floor(random() * descriptors.length)]
    const merchant = merchants[Math.floor(random() * merchants.length)]
    const baseAmount = random() * amountScale
    const polarity = random() > 0.45 ? -1 : 1
    const amount = roundAmount(baseAmount * polarity)
    const date = new Date(timestamp).toISOString()
    transactions.push(buildTransaction(idPrefix, index + 1, date, amount, category, descriptor, merchant))
  }
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return transactions
}

const TRANSACTION_COUNT = 320

export const accounts = {
  courant: {
    id: 'courant',
    name: 'Compte courant',
    transactions: generateTransactions(71293, 'courant', TRANSACTION_COUNT, 380)
  },
  epargnes: {
    id: 'epargnes',
    name: 'Compte épargnes',
    transactions: generateTransactions(24957, 'epargnes', TRANSACTION_COUNT, 520)
  },
  credit: {
    id: 'credit',
    name: 'Compte crédit',
    transactions: generateTransactions(98211, 'credit', TRANSACTION_COUNT, 860)
  }
}
