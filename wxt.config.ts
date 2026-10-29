import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // O Chrome roda no Windows e o código no WSL: carregamos o build à mão (ver docs/decisions/0000-stack.md).
  webExt: { disabled: true },
  manifest: {
    name: 'Organizar Favoritos',
    // Chave pública fixa: o ID da extensão não muda se a pasta do build mudar de lugar, e os backups (IndexedDB) ficam atrelados a esse ID.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt+o9sKOGZMolq5B3JQOXI7rli6Qdo41UTqJTVEeSVPv4Kc7LtXExS6p189NybeKIXsr4PCzhJAJrTj8Am4Bj5gWLR+U1Ed8HobMGM+BOeZsFJRtXokZCokO5GgeuuV8kF6cwe2xzB680XjBH9iwkju4HuN1AS+s8s7oh83dRmMFpBh/pfBszj0+JydDgl+s3ZjPa9GwD+NVXL43ZoNKKQ7fAZTov0oEOlupQwKNtokO4YgG+HXmVwlvXDK10BlagyMb1dOx0jYsDjRn+hvW9rEOwVaojvnuOsHqjUUebblfQvUA+33qdYUG0M1seGjRvf6PBl/qZWMPJKUicAbgz+wIDAQAB',
    description: 'Limpe e organize seus favoritos com backup e desfazer.',
    permissions: ['bookmarks', 'storage', 'unlimitedStorage'],
    optional_host_permissions: ['<all_urls>'],
  },
})
