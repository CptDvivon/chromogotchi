import { mount } from 'svelte';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/vt323/400.css';
import './ui/app.css';
import App from './ui/App.svelte';

export default mount(App, { target: document.getElementById('app')! });
