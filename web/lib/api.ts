import type { Product, Order, Review, ReviewSummary, User } from "./types";
import { medusa } from "./medusa";

const BASE = typeof window === "undefined"
  ? (process.env.API_URL || "http://localhost:4000")
  : ""; // browser uses Next rewrites at /api/*

// Product reads come from Medusa v2 (P1); orders/auth stay on Express until P3.
const USE_MEDUSA = process.env.NEXT_PUBLIC_USE_MEDUSA !== "0";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Editable homepage content (admin → Контент). Resolves to null rather than
  // throwing, so an unreachable CMS leaves the page on its built-in copy
  // instead of taking the homepage down with it.
  cms: {
    homepage: () => medusa.homepageContent(),
  },
  products: {
    list: async (params: Record<string, string | undefined> = {}) => {
      if (USE_MEDUSA) return medusa.products.list(params);
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString();
      const r = await fetch(`${BASE}/api/products${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      return json<{ data: Product[]; total: number }>(r);
    },
    featured: async () => {
      if (USE_MEDUSA) return medusa.products.featured();
      const r = await fetch(`${BASE}/api/products/featured`, { cache: "no-store" });
      return json<{ data: Product[] }>(r);
    },
    get: async (idOrSlug: string) => {
      if (USE_MEDUSA) return medusa.products.get(idOrSlug);
      const r = await fetch(`${BASE}/api/products/${idOrSlug}`, { cache: "no-store" });
      return json<{ data: Product; related: Product[] }>(r);
    },
  },
  // Reviews are Medusa-only: the legacy Express API never had them.
  reviews: {
    forProduct: (productId: string): Promise<ReviewSummary> =>
      USE_MEDUSA ? medusa.reviews.forProduct(productId) : Promise.resolve({ rating: null, count: 0, reviews: [] }),
    latest: (limit?: number): Promise<Review[]> =>
      USE_MEDUSA ? medusa.reviews.latest(limit) : Promise.resolve([]),
    create: (input: { product_id: string; rating: number; body: string; title?: string; name?: string }, token: string) => {
      if (!USE_MEDUSA) throw new Error("Reviews require the Medusa backend");
      return medusa.reviews.create(input, token);
    },
  },

  newsletter: {
    subscribe: async (email: string, lang?: string) => {
      if (!USE_MEDUSA) throw new Error("Not supported");
      return medusa.newsletter.subscribe(email, lang);
    },
  },

  auth: {
    login: async (email: string, password: string) => {
      if (USE_MEDUSA) return medusa.auth.login(email, password);
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return json<{ token: string; user: User }>(r);
    },
    signup: async (data: { firstName: string; lastName: string; email: string; password: string }) => {
      if (USE_MEDUSA) return medusa.auth.signup(data);
      const r = await fetch(`${BASE}/api/auth/signup`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      return json<{ token: string; user: User }>(r);
    },
    me: async (token: string) => {
      if (USE_MEDUSA) return medusa.auth.me(token);
      const r = await fetch(`${BASE}/api/auth/me`, { headers: { authorization: `Bearer ${token}` }});
      return json<{ user: User }>(r);
    },
    refresh: async (token: string) => {
      if (!USE_MEDUSA) throw new Error("Not supported");
      return medusa.auth.refresh(token);
    },
    resetRequest: async (email: string) => {
      if (USE_MEDUSA) return medusa.auth.resetRequest(email);
      throw new Error("Not supported");
    },
    resetConfirm: async (token: string, password: string) => {
      if (USE_MEDUSA) return medusa.auth.resetConfirm(token, password);
      throw new Error("Not supported");
    },
  },
  orders: {
    create: async (data: { email: string; items: { id: string; qty: number }[]; shippingMethod?: "standard" | "express" }) => {
      const r = await fetch(`${BASE}/api/orders`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      return json<{ data: Order }>(r);
    },
    list: async (email?: string) => {
      const r = await fetch(`${BASE}/api/orders${email ? `?email=${email}` : ""}`, { cache: "no-store" });
      return json<{ data: Order[] }>(r);
    },
  },
  // Authenticated customer data (Medusa customer).
  customers: {
    orders: async (token: string) => {
      if (USE_MEDUSA) return medusa.customers.orders(token);
      return { data: [] as Awaited<ReturnType<typeof medusa.customers.orders>>["data"] };
    },
    addresses: async (token: string) => {
      if (USE_MEDUSA) return medusa.customers.addresses(token);
      return { data: [] as any[] };
    },
    update: async (token: string, patch: { firstName?: string; lastName?: string; phone?: string }) => {
      if (USE_MEDUSA) return medusa.customers.update(token, patch);
      throw new Error("Not supported");
    },
    createReturn: async (input: { token?: string; orderId: string; items: { id: string; quantity: number }[]; note?: string }) => {
      if (USE_MEDUSA) return medusa.customers.createReturn(input);
      throw new Error("Not supported");
    },
    requestDeletion: async (token: string) => {
      if (USE_MEDUSA) return medusa.customers.requestDeletion(token);
      throw new Error("Not supported");
    },
  },
};

export const money = (n: number) => `₮${Math.round(n).toLocaleString("en-US")}`;
