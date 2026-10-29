import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // O Chrome roda no Windows e o código no WSL: carregamos o build à mão (ver docs/decisions/0000-stack.md).
  webExt: { disabled: true },
  manifest: {
    name: 'Organizar Favoritos',
    description: 'Limpe e organize seus favoritos com backup e desfazer.',
    permissions: ['bookmarks', 'storage', 'unlimitedStorage'],
    optional_host_permissions: ['<all_urls>'],
  },
})
