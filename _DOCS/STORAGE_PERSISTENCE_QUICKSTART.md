# Quick Start : Activer la Persistance Durable

## 🚨 Vous voyez cette notification ?

> ⚠️ **"Vos données peuvent être supprimées automatiquement par le navigateur"**

**Pas de panique !** Voici comment protéger vos données en 30 secondes.

---

## ✅ Solution Rapide (Chrome/Edge)

### Étape 1 : Ajouter aux Favoris
1. Appuyez sur **Ctrl+D** (Windows/Linux) ou **Cmd+D** (Mac)
2. Enregistrer le favori (peu importe le dossier)
3. Recharger la page (F5)

### Étape 2 : Vérifier
La notification doit maintenant afficher :
> ✅ **"Vos données sont protégées contre la suppression automatique"**

**C'est tout !** 🎉 Vos données sont maintenant permanentes.

---

## 🦊 Firefox

### Méthode 1 : Autoriser via la Popup
1. Recharger l'application
2. Une notification apparaît en haut : **"Autoriser à stocker des données de façon permanente ?"**
3. Cliquer sur **"Autoriser"**

### Méthode 2 : Via les Paramètres
1. Cliquer sur l'icône 🔒 dans la barre d'adresse
2. **Permissions** > **Persistent Storage** > **Autoriser**
3. Recharger la page

---

## 🍎 Safari

**Rien à faire !** Safari stocke toujours les données de façon permanente par défaut.

---

## 🧪 Vérifier que ça marche

### Méthode 1 : Console Navigateur
1. Ouvrir DevTools (F12)
2. Onglet **Console**
3. Taper :
   ```javascript
   await navigator.storage.persisted()
   ```
4. Si ça retourne `true` → ✅ Protégé !
5. Si ça retourne `false` → ⚠️ Pas protégé (refaire les étapes)

### Méthode 2 : Vérification Visuelle
- ✅ **Notification verte** = Données protégées
- ⚠️ **Notification orange** = Données à risque

---

## ❓ Pourquoi c'est nécessaire ?

Par défaut, les navigateurs peuvent **supprimer silencieusement** les données d'un site web après quelques jours/semaines pour libérer de l'espace disque.

**Avec la persistance durable activée** :
- ✅ Vos fichiers, layouts, préférences sont **garantis permanents**
- ✅ Le navigateur **ne peut plus** les supprimer sans votre permission explicite
- ✅ Équivalent à "installer" l'application localement

---

## 🔧 Tests Avancés

### Voir les Informations de Stockage
```javascript
// Dans la console DevTools
const info = await window.storagePersistenceService.getQuotaInfo()
console.log(`Utilisé : ${info.usageFormatted} / ${info.quotaFormatted}`)
console.log(`Pourcentage : ${info.percentUsed.toFixed(1)}%`)
```

### Forcer une Nouvelle Demande
```javascript
await window.storagePersistenceService.requestPersistence({ force: true })
```

### Invalider le Cache (Debugging)
```javascript
window.storagePersistenceService.invalidateCache()
```

---

## 📚 Plus d'informations

- [Documentation complète](_DOCS/STORAGE_PERSISTENCE.md)
- [Configuration](_GUIDES/ENVIRONMENT_VARIABLES.md#vite_storage_persistence_request)

---

**Résumé en 1 ligne** : **Ctrl+D (ajouter aux favoris) → F5 (recharger) → ✅ Protégé !**
