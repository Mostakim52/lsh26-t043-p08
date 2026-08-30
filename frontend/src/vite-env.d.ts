/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where marks are fetched from. Defaults to the sample JSON in /public. */
  readonly VITE_RESULTS_URL?: string;
  /** Base path of the backend auth endpoints. Defaults to /api/v1/auth. */
  readonly VITE_AUTH_URL?: string;
  /** Portal name on the sign-in splash. */
  readonly VITE_PORTAL_NAME?: string;
  /** School name on the sign-in splash, shown before any marks are loaded. */
  readonly VITE_SCHOOL_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
