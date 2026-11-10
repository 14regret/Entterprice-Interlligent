/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in dev: requests go through the Vite /api proxy. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
