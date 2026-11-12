"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product, User } from "./types";
import { isExpired } from "./session";

type AddOpts = { size?: string; variantId?: string };
type CartState = {
  items: CartItem[];
  add: (p: Product, qty?: number, opts?: AddOpts) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p, qty = 1, opts = {}) => set(s => {
        const size = opts.size ?? p.variants?.[0]?.size;
        const variantId = opts.variantId ?? p.variants?.find(v => v.size === size)?.id ?? p.variants?.[0]?.id;
        const key = variantId || p.id;
        const existing = s.items.find(i => (i.variantId || i.id) === key);
        if (existing) {
          return { items: s.items.map(i => (i.variantId || i.id) === key ? { ...i, qty: i.qty + qty } : i) };
        }
        return { items: [...s.items, { id: p.id, name: p.name, price: p.price, qty, accent: p.accent, category: p.category, shape: p.shape, image: p.image, size, variantId }] };
      }),
      remove: key => set(s => ({ items: s.items.filter(i => (i.variantId || i.id) !== key) })),
      setQty: (key, qty) => set(s => ({
        items: s.items.map(i => (i.variantId || i.id) === key ? { ...i, qty: Math.max(1, qty) } : i),
      })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((a, b) => a + b.qty, 0),
      subtotal: () => get().items.reduce((a, b) => a + b.price * b.qty, 0),
    }),
    { name: "nitec-cart" }
  )
);

type WishState = { ids: string[]; toggle: (id: string) => void; has: (id: string) => boolean; clear: () => void };
export const useWish = create<WishState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: id => set(s => ({ ids: s.ids.includes(id) ? s.ids.filter(x => x !== id) : [...s.ids, id] })),
      has: id => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    { name: "nitec-wish" }
  )
);

// Marks the current browser session. A sign-in made without "remember me"
// still survives a reload (the flag is there), but not a browser restart
// (sessionStorage is gone, so rehydrate signs them out).
const SESSION_FLAG = "nitec-session";

type AuthState = {
  user: User | null;
  token: string | null;
  remember: boolean;
  setSession: (u: User, t: string, remember?: boolean) => void;
  signOut: () => void;
};
export const useAuth = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      remember: true,
      setSession: (user, token, remember = true) => {
        try { if (!remember) sessionStorage.setItem(SESSION_FLAG, "1"); } catch { /* private mode */ }
        set({ user, token, remember });
      },
      signOut: () => set({ user: null, token: null }),
    }),
    {
      name: "nitec-auth",
      onRehydrateStorage: () => (state) => {
        // A Medusa customer token is good for 24 hours. Keeping a dead one
        // meant the nav showed the shopper's name while every signed-in
        // action answered 401 — so the storefront told them to sign in while
        // insisting they already were.
        if (state?.token && isExpired(state.token)) { state.signOut(); return; }
        if (!state?.token || state.remember) return;
        let sameSession = false;
        try { sameSession = sessionStorage.getItem(SESSION_FLAG) === "1"; } catch { /* private mode */ }
        if (!sameSession) state.signOut();
      },
    }
  )
);

type ToastState = { msg: string | null; show: (m: string) => void; hide: () => void };
export const useToast = create<ToastState>(set => ({
  msg: null,
  show: m => { set({ msg: m }); setTimeout(() => set({ msg: null }), 2200); },
  hide: () => set({ msg: null }),
}));

// Slide-in cart drawer open/close state.
type UIState = { cartOpen: boolean; openCart: () => void; closeCart: () => void };
export const useUI = create<UIState>(set => ({
  cartOpen: false,
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
}));

// Quick-view modal: holds the product being previewed (null = closed).
type QuickViewState = { product: Product | null; open: (p: Product) => void; close: () => void };
export const useQuickView = create<QuickViewState>(set => ({
  product: null,
  open: p => set({ product: p }),
  close: () => set({ product: null }),
}));

// "Fly to cart" animation: each add launches a short-lived flight that the
// global FlyLayer renders from the source element to the cart icon.
type Flight = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; color: string };
type FlyState = {
  flights: Flight[];
  launch: (from: { x: number; y: number }, to: { x: number; y: number }, color: string) => void;
  land: (id: number) => void;
};
export const useFly = create<FlyState>(set => ({
  flights: [],
  launch: (from, to, color) =>
    set(s => ({ flights: [...s.flights, { id: Date.now() + Math.random(), from, to, color }] })),
  land: id => set(s => ({ flights: s.flights.filter(f => f.id !== id) })),
}));

// Find the visible cart icon (mobile or desktop Nav marks it with data-cart-anchor).
function cartAnchorRect(): DOMRect | null {
  if (typeof document === "undefined") return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-anchor]"));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.offsetParent !== null) return r;
  }
  return els[0]?.getBoundingClientRect() ?? null;
}

// Launch a fly animation from a source element to the cart icon. No-op if either is missing.
export function flyToCart(fromEl: HTMLElement | null | undefined, color: string) {
  if (!fromEl || typeof window === "undefined") return;
  const to = cartAnchorRect();
  if (!to) return;
  const r = fromEl.getBoundingClientRect();
  useFly.getState().launch(
    { x: r.left + r.width / 2, y: r.top + r.height / 2 },
    { x: to.left + to.width / 2, y: to.top + to.height / 2 },
    color,
  );
}

export type OrderRecord = {
  id: string;
  email: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
  status: "processing" | "shipped" | "delivered";
  createdAt: string;
  estimatedDelivery: string;
};
type OrdersState = { orders: OrderRecord[]; addOrder: (o: OrderRecord) => void };
export const useOrders = create<OrdersState>()(
  persist(
    set => ({
      orders: [],
      addOrder: o => set(s => ({ orders: [...s.orders, o] })),
    }),
    { name: "nitec-orders" }
  )
);
