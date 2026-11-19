// TEMPORARY test accounts so the app can be tested before the backend is connected.
// REMOVE this file (and its use in auth.tsx / Auth.tsx) before going live, and change this password.
export type DemoUser = { email: string; password: string; role: 'buyer' | 'seller'; name: string; company: string }

export const DEMO_USERS: DemoUser[] = [
  { email: 'confidenceanyira6@gmail.com', password: 'hujjujjuh1A$', role: 'buyer', name: 'Confidence (Buyer)', company: 'Confidence Imports Ltd' },
  { email: 'confidencein7@gmail.com', password: 'hujjujjuh1A$', role: 'seller', name: 'Confidence (Supplier)', company: 'Confidence Supplies Ltd' },
]

export const matchDemo = (email: string, password: string) =>
  DEMO_USERS.find((u) => u.email === email.trim().toLowerCase() && u.password === password)

export const findDemo = (email: string | null) => DEMO_USERS.find((u) => u.email === email)

export const DEMO_KEY = 'saage_demo_user'
