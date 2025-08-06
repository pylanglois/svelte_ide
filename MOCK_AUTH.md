# MockProvider - Fournisseur d'Authentification de Test

Le `MockProvider` est un fournisseur d'authentification simulé pour faciliter le développement et les tests.

## 🎯 **Activation Automatique**

Le MockProvider s'active automatiquement si **aucun** fournisseur réel (Azure, Google) n'est configuré.

## ⚙️ **Configuration (Optionnelle)**

Vous pouvez personnaliser le comportement via les variables d'environnement :

```bash
# .env.local
VITE_MOCK_AUTH_DELAY=1500  # Délai de simulation en ms (défaut: 1000)
```

## 🧪 **Fonctionnalités**

- ✅ **Connexion simulée** : Retourne toujours un utilisateur fictif
- ✅ **Délai réaliste** : Simule la latence d'un vrai OAuth
- ✅ **Gestion des tokens** : Génère des tokens factices mais cohérents
- ✅ **Refresh token** : Supporte le renouvellement de tokens
- ✅ **Utilisateur personnalisable** : Nom, email, avatar configurables

## 👤 **Utilisateur Mock par Défaut**

```javascript
{
  id: 'mock-dev-user',
  name: 'Développeur Mock', 
  email: 'dev@svelte-ide.local',
  avatar: '👨‍💻',
  provider: 'mock'
}
```

## 🔧 **Test de Connexion**

1. Ouvrez l'application
2. Dans la barre de titre, cliquez sur "Se connecter via Mock Provider"
3. Attendez 1 seconde (simulation)
4. Vous êtes connecté !

## 🚀 **Passage en Production**

Pour désactiver le MockProvider en production :

```bash
# .env.production
VITE_AUTH_PROVIDERS=azure,google
VITE_AZURE_CLIENT_ID=your_real_client_id
# ... autres configs réelles
```

Le MockProvider ne s'activera que si aucun fournisseur réel n'est configuré.
