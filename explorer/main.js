import { mount } from 'svelte'
import App from './src/App.svelte'
import './src/styles.css'

const app = mount(App, {
  target: document.getElementById('app')
})

export default app
