const env = import.meta.env;

export const API_BASE_URL = env.VITE_API_BASE_URL as string;
export const PORTAL_URL = (env.VITE_PORTAL_URL as string | undefined) || "http://localhost:5175";
export const ADMIN_URL = (env.VITE_ADMIN_URL as string | undefined) || "http://localhost:5173";
export const CONTACT_EMAIL = (env.VITE_CONTACT_EMAIL as string | undefined) || null;
