export class PreferencesService {
    constructor() {
        this.systemPreferences = $state({
            ide: {
                showStatusBar: true,
                showToolbar: true,
                autoSave: true,
                autoSaveDelay: 500,
                confirmCloseTab: true
            },
            notifications: {
                duration: 5000,
                position: 'bottom-right'
            },
            editor: {
                tabSize: 2,
                insertSpaces: true,
                wordWrap: true,
                lineNumbers: true
            }
        })

        this.toolPreferences = $state({})
        this.userPreferences = $state({})
    }

    getEffectivePreference(key, defaultValue = null) {
        const parts = key.split('.')
        
        if (parts.length !== 2) {
            return defaultValue
        }

        const [namespace, property] = parts

        if (this.userPreferences[namespace] && 
            this.userPreferences[namespace][property] !== undefined) {
            return this.userPreferences[namespace][property]
        }

        if (this.toolPreferences[namespace] && 
            this.toolPreferences[namespace][property] !== undefined) {
            return this.toolPreferences[namespace][property]
        }

        if (this.systemPreferences[namespace] && 
            this.systemPreferences[namespace][property] !== undefined) {
            return this.systemPreferences[namespace][property]
        }

        return defaultValue
    }

    getToolPreference(toolId, property, defaultValue = null) {
        const key = `${toolId}.${property}`
        return this.getEffectivePreference(key, defaultValue)
    }

    setToolPreference(toolId, property, value) {
        if (!this.toolPreferences[toolId]) {
            this.toolPreferences[toolId] = {}
        }
        this.toolPreferences[toolId][property] = value
    }

    getAllPreferences() {
        return {
            system: this.systemPreferences,
            tools: this.toolPreferences,
            user: this.userPreferences
        }
    }
}

export const preferencesService = new PreferencesService()