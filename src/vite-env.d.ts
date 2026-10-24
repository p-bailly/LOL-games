/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Numéro du build GitHub Actions (absent en local). */
  readonly VITE_BUILD?: string
}
