/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. http://localhost:8000/api/v1. Defaults to /api/v1. */
  readonly VITE_API_BASE?: string;
  /** Override for the results endpoint. Defaults to `${VITE_API_BASE}/results`. */
  readonly VITE_RESULTS_URL?: string;
  /** Override for the auth endpoints. Defaults to `${VITE_API_BASE}/auth`. */
  readonly VITE_AUTH_URL?: string;
  /** Portal name on the sign-in splash. */
  readonly VITE_PORTAL_NAME?: string;
  /** School name on the sign-in splash, shown before any marks are loaded. */
  readonly VITE_SCHOOL_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
