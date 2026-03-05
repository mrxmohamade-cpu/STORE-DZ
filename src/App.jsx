import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import algeriaCitiesData from './data/algeria_cities.json';
import { auth } from './lib/firebase';
import {
  hasFirebaseConfig,
  loadStoreBundle,
  saveOrdersRemote,
  saveProductsRemote,
  saveSiteConfigRemote,
  uploadProductImage,
} from './lib/storeService';
import {
  AlertTriangle,
  ArrowUpDown,
  BadgePercent,
  CheckCircle,
  ChevronRight,
  CreditCard,
  Edit3,
  Filter,
  Heart,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Megaphone,
  MoonStar,
  Palette,
  Package,
  Plus,
  Power,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  SunMedium,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';

const CATEGORIES = ['الكل', 'رجال', 'نساء', 'أحذية', 'إكسسوارات'];
const ROUTES = {
  home: 'home',
  offers: 'offers',
  favorites: 'favorites',
  cart: 'cart',
  checkout: 'checkout',
  admin: 'admin',
};

const PAGE_TRANSITION = { duration: 0.35, ease: 'easeOut' };

const CATEGORY_META = {
  الكل: { icon: LayoutDashboard, tone: 'from-slate-600 to-slate-800' },
  رجال: { icon: User, tone: 'from-blue-500 to-indigo-600' },
  نساء: { icon: Heart, tone: 'from-rose-500 to-pink-600' },
  أحذية: { icon: ShoppingBag, tone: 'from-amber-500 to-orange-600' },
  إكسسوارات: { icon: Sparkles, tone: 'from-emerald-500 to-teal-600' },
};

const ORDER_STATUSES = [
  { key: 'pending', label: 'قيد المعالجة', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'shipped', label: 'تم الشحن', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'delivered', label: 'تم التسليم', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'cancelled', label: 'ملغي', className: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const STORAGE_KEYS = {
  products: 'my_store_products_v2',
  orders: 'my_store_orders_v2',
  siteConfig: 'my_store_site_config_v2',
  favorites: 'my_store_favorites_v1',
  adminTheme: 'my_store_admin_theme_v1',
};

const DEFAULT_SITE_CONFIG = {
  name: 'أناقة ستور',
  isOnline: true,
  announcement: '',
  couponCode: '',
  couponDiscount: 0,
  coupons: [],
  whatsappNumber: '',
};

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = Array.from({ length: 9 }, (_, idx) => String(37 + idx));
const COLOR_PRESETS = [
  { name: 'أسود', hex: '#111827' },
  { name: 'أبيض', hex: '#F8FAFC' },
  { name: 'رمادي', hex: '#9CA3AF' },
  { name: 'أزرق', hex: '#2563EB' },
  { name: 'كحلي', hex: '#1E3A8A' },
  { name: 'أخضر', hex: '#059669' },
  { name: 'أحمر', hex: '#DC2626' },
  { name: 'وردي', hex: '#EC4899' },
  { name: 'بيج', hex: '#D6C6A5' },
  { name: 'بني', hex: '#92400E' },
];

const DEFAULT_PRODUCT_VARIANTS = {
  enableSizes: false,
  sizeType: 'clothing',
  sizes: [],
  enableColors: false,
  colors: [],
};

const initialProductsData = [
  {
    id: 1,
    name: 'تيشيرت صيفي قطن',
    price: 2500,
    oldPrice: 3200,
    category: 'رجال',
    stock: 12,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    variants: {
      ...DEFAULT_PRODUCT_VARIANTS,
      enableSizes: true,
      sizeType: 'clothing',
      sizes: ['M', 'L', 'XL'],
      enableColors: true,
      colors: ['أسود', 'أبيض', 'أزرق'],
    },
  },
  { id: 2, name: 'فستان كاجوال مريح', price: 4800, category: 'نساء', stock: 8, image: 'https://images.unsplash.com/photo-1515347619362-ec8cb9eb7a7a?auto=format&fit=crop&w=800&q=80' },
  {
    id: 3,
    name: 'حذاء رياضي يومي',
    price: 5500,
    oldPrice: 6900,
    category: 'أحذية',
    stock: 5,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    variants: {
      ...DEFAULT_PRODUCT_VARIANTS,
      enableSizes: true,
      sizeType: 'shoes',
      sizes: ['40', '41', '42', '43', '44'],
      enableColors: true,
      colors: ['أسود', 'أبيض', 'رمادي'],
    },
  },
  { id: 4, name: 'ساعة يد كلاسيكية', price: 3200, category: 'إكسسوارات', stock: 15, image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=800&q=80' },
];
const ALGERIA_CITIES = Array.isArray(algeriaCitiesData) ? algeriaCitiesData : [];

const WILAYA_OPTIONS = Object.values(
  ALGERIA_CITIES.reduce((acc, item) => {
    const wilayaCode = String(item.wilaya_code ?? '').padStart(2, '0');
    if (!wilayaCode || !item.wilaya_name) return acc;

    if (!acc[wilayaCode]) {
      acc[wilayaCode] = {
        wilaya_code: wilayaCode,
        wilaya_name: item.wilaya_name,
      };
    }

    return acc;
  }, {}),
).sort((a, b) => a.wilaya_code.localeCompare(b.wilaya_code, 'en'));

const COMMUNES_BY_WILAYA = ALGERIA_CITIES.reduce((acc, item) => {
  const wilayaCode = String(item.wilaya_code ?? '').padStart(2, '0');
  if (!wilayaCode || !item.commune_name) return acc;

  if (!acc[wilayaCode]) {
    acc[wilayaCode] = [];
  }

  if (!acc[wilayaCode].some((commune) => commune.commune_name === item.commune_name)) {
    acc[wilayaCode].push({
      id: item.id,
      commune_name: item.commune_name,
      daira_name: item.daira_name,
    });
  }

  return acc;
}, {});

Object.keys(COMMUNES_BY_WILAYA).forEach((wilayaCode) => {
  COMMUNES_BY_WILAYA[wilayaCode].sort((a, b) => a.commune_name.localeCompare(b.commune_name, 'ar'));
});

const DEFAULT_WILAYA_CODE = WILAYA_OPTIONS[0]?.wilaya_code || '';

const getWilayaNameByCode = (wilayaCode) =>
  WILAYA_OPTIONS.find((wilaya) => wilaya.wilaya_code === wilayaCode)?.wilaya_name || '';

const readStorage = (key, fallbackValue) => {
  if (typeof window === 'undefined') return fallbackValue;
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return fallbackValue;
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
};

const writeStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
};

const clampStock = (value) => Math.max(0, Number(value) || 0);
const clampDiscount = (value) => Math.min(90, Math.max(0, Number(value) || 0));
const normalizeCouponCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
const clampUses = (value) => Math.max(1, Number(value) || 1);

const normalizeProductVariants = (variants) => {
  const source = variants || {};
  const sizeType = source.sizeType === 'shoes' ? 'shoes' : 'clothing';
  const allowedSizes = sizeType === 'shoes' ? SHOE_SIZES : CLOTHING_SIZES;
  const uniqueSizes = Array.from(
    new Set((Array.isArray(source.sizes) ? source.sizes : []).map((entry) => String(entry).trim())),
  ).filter((entry) => allowedSizes.includes(entry));
  const uniqueColors = Array.from(
    new Set((Array.isArray(source.colors) ? source.colors : []).map((entry) => String(entry).trim())),
  ).filter(Boolean);

  return {
    enableSizes: Boolean(source.enableSizes) && uniqueSizes.length > 0,
    sizeType,
    sizes: uniqueSizes,
    enableColors: Boolean(source.enableColors) && uniqueColors.length > 0,
    colors: uniqueColors,
  };
};

const buildCartItemKey = (item) =>
  String(item?.id || 'no-id') + '::' + (item?.selectedSize || 'no-size') + '::' + (item?.selectedColor || 'no-color');

const isProductOnSale = (product) =>
  Number(product.oldPrice) > 0 && Number(product.oldPrice) > Number(product.price);

const getDiscountPercent = (product) => {
  if (!isProductOnSale(product)) return 0;
  return Math.round(((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 100);
};

const normalizeCoupons = (coupons, legacyCode, legacyDiscount) => {
  const source = Array.isArray(coupons) ? coupons : [];
  const normalized = source
    .map((coupon, index) => {
      const code = normalizeCouponCode(coupon?.code);
      if (!code) return null;

      const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt).toISOString() : '';
      return {
        id: coupon?.id || String(Date.now()) + '-' + String(index) + '-' + code,
        code,
        discount: clampDiscount(coupon?.discount),
        maxUses: clampUses(coupon?.maxUses),
        usedCount: Math.max(0, Number(coupon?.usedCount) || 0),
        expiresAt,
      };
    })
    .filter(Boolean)
    .filter((coupon) => coupon.discount > 0);

  if (normalized.length > 0) return normalized;

  const fallbackCode = normalizeCouponCode(legacyCode);
  const fallbackDiscount = clampDiscount(legacyDiscount);
  if (!fallbackCode || fallbackDiscount <= 0) return [];

  return [
    {
      id: 'legacy-' + fallbackCode,
      code: fallbackCode,
      discount: fallbackDiscount,
      maxUses: 99999,
      usedCount: 0,
      expiresAt: '',
    },
  ];
};

const normalizeSiteConfig = (siteConfig) => {
  const merged = {
    ...DEFAULT_SITE_CONFIG,
    ...(siteConfig || {}),
  };

  return {
    ...merged,
    coupons: normalizeCoupons(merged.coupons, merged.couponCode, merged.couponDiscount),
  };
};

const isCouponExpired = (coupon) => Boolean(coupon?.expiresAt) && new Date(coupon.expiresAt).getTime() < Date.now();

const isCouponExhausted = (coupon) => (Number(coupon?.usedCount) || 0) >= (Number(coupon?.maxUses) || 0);

const isCouponApplicable = (coupon) =>
  Boolean(coupon?.code) &&
  Number(coupon?.discount) > 0 &&
  !isCouponExpired(coupon) &&
  !isCouponExhausted(coupon);

const normalizeProducts = (items) => {
  if (!Array.isArray(items)) return initialProductsData;

  return items.map((item, index) => ({
    ...item,
    id: item.id ?? Date.now() + index,
    price: Number(item.price) || 0,
    oldPrice: Number(item.oldPrice) > 0 ? Number(item.oldPrice) : 0,
    stock: clampStock(item.stock ?? 0),
    variants: normalizeProductVariants(item.variants),
  }));
};

const normalizeOrders = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? Date.now() + index,
    items: Array.isArray(item.items)
      ? item.items.map((orderItem) => ({
          ...orderItem,
          cartKey: orderItem.cartKey || buildCartItemKey(orderItem),
        }))
      : [],
    subtotal: Number(item.subtotal) || Number(item.totalPrice) || 0,
    discount: Number(item.discount) || 0,
    totalPrice: Number(item.totalPrice) || 0,
    couponCode: item.couponCode || '',
    status: item.status || 'pending',
    date: item.date || new Date().toISOString(),
  }));
};

const getOrderStatusMeta = (status) => {
  const found = ORDER_STATUSES.find((entry) => entry.key === status);
  return found || ORDER_STATUSES[0];
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const stock = Number.isFinite(Number(action.payload.stock))
        ? Number(action.payload.stock)
        : Number.POSITIVE_INFINITY;

      if (stock <= 0) return state;

      const incomingKey = action.payload.cartKey || buildCartItemKey(action.payload);
      const existing = state.find((item) => (item.cartKey || buildCartItemKey(item)) === incomingKey);
      if (existing) {
        if (existing.qty >= stock) return state;
        return state.map((item) =>
          (item.cartKey || buildCartItemKey(item)) === incomingKey ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...state, { ...action.payload, cartKey: incomingKey, qty: 1 }];
    }
    case 'REMOVE_ITEM': {
      const targetKey = action.payload?.cartKey || buildCartItemKey(action.payload || {});
      return state.filter((item) => (item.cartKey || buildCartItemKey(item)) !== targetKey);
    }
    case 'DECREASE': {
      const targetKey = action.payload?.cartKey || buildCartItemKey(action.payload || {});
      return state.map((item) =>
        (item.cartKey || buildCartItemKey(item)) === targetKey && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item,
      );
    }
    case 'CLEAR':
      return [];
    default:
      return state;
  }
};
const Toast = ({ toast }) => (
  <AnimatePresence>
    {toast.show && (
      <Motion.div
        key="toast"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={PAGE_TRANSITION}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex justify-center pointer-events-none"
      >
        <div
          className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold text-white ${
            toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle size={18} />
          ) : (
            <CheckCircle size={18} className="text-emerald-100" />
          )}
          {toast.message}
        </div>
      </Motion.div>
    )}
  </AnimatePresence>
);

const AnnouncementBar = ({ text }) => {
  if (!text) return null;
  return <div className="bg-emerald-500 text-white text-xs md:text-sm font-bold py-2 px-4 text-center">{text}</div>;
};

const normalizeWhatsappNumber = (value) => String(value || '').replace(/[^\d]/g, '');

const ProductsSkeletonGrid = () => (
  <div className="px-4 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="overflow-hidden rounded-[1.5rem] border border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="relative aspect-[4/5] bg-slate-200/80">
          <div className="absolute inset-0 skeleton-shimmer" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 rounded-lg bg-slate-200/80" />
          <div className="h-4 w-2/3 rounded-lg bg-slate-200/80" />
          <div className="h-6 w-1/2 rounded-lg bg-slate-300/80" />
        </div>
      </div>
    ))}
  </div>
);

const FloatingWhatsAppButton = ({ phoneNumber }) => {
  const normalized = normalizeWhatsappNumber(phoneNumber);
  if (!normalized) return null;

  const message = encodeURIComponent('مرحباً، أريد الاستفسار عن منتجات المتجر.');

  return (
    <Motion.a
      href={`https://wa.me/${normalized}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={PAGE_TRANSITION}
      className="fixed left-4 md:left-6 bottom-24 md:bottom-6 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-600 transition-all"
      aria-label="تواصل واتساب"
      title="تواصل عبر واتساب"
    >
      <MessageCircle size={20} />
      <span className="text-xs md:text-sm font-black">واتساب</span>
    </Motion.a>
  );
};
const DesktopNavbar = ({
  currentRoute,
  navigateTo,
  cartCount,
  isAdminAuth,
  isCartAnimating,
  onAdminLogout,
  siteName,
  searchQuery,
  setSearchQuery,
  favoritesCount,
}) => (
  <div className="hidden md:block bg-white/70 backdrop-blur-xl sticky top-0 z-50 border-b border-white/60 shadow-lg shadow-slate-900/5 transition-all">
    <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center gap-6">
      <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => navigateTo(ROUTES.home)}>
        <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg">
          <ShoppingBag size={24} />
        </div>
        <span className="text-2xl font-black text-slate-900 tracking-tight">{siteName}</span>
      </div>

      <div className="flex-1 max-w-xl relative">
        <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => {
            if (currentRoute !== ROUTES.home && currentRoute !== ROUTES.offers) navigateTo(ROUTES.home);
          }}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="ابحث عن المنتجات..."
          className="w-full bg-gray-50 border border-gray-100 rounded-full py-3 pr-12 pl-4 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-bold"
        />
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigateTo(ROUTES.home)}
          className={`font-bold transition-colors ${
            currentRoute === ROUTES.home ? 'text-emerald-600' : 'text-gray-600 hover:text-slate-900'
          }`}
        >
          الرئيسية
        </button>

        <button
          onClick={() => navigateTo(ROUTES.offers)}
          className={`font-bold inline-flex items-center gap-1 transition-colors ${
            currentRoute === ROUTES.offers ? 'text-rose-500' : 'text-gray-600 hover:text-rose-500'
          }`}
        >
          <BadgePercent size={16} /> العروض
        </button>

        <button
          onClick={() => navigateTo(ROUTES.favorites)}
          className="relative p-2 text-gray-600 hover:text-rose-500 transition-colors"
          title="المفضلة"
        >
          <Heart size={22} className={favoritesCount > 0 ? 'fill-rose-100 text-rose-500' : ''} />
          {favoritesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
              {favoritesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigateTo(ROUTES.cart)}
          className={`relative p-2 text-gray-600 hover:text-slate-900 transition-colors ${isCartAnimating ? 'animate-cart-shake' : ''}`}
        >
          <ShoppingCart size={24} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
              {cartCount}
            </span>
          )}
          <AnimatePresence>
            {isCartAnimating && (
              <Motion.span
                initial={{ scale: 0.5, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: 6 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-black"
              >
                +1
              </Motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="w-px h-6 bg-gray-200" />

        {isAdminAuth ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo(ROUTES.admin)}
              className="text-sm font-bold bg-slate-100 text-slate-700 px-5 py-2.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              لوحة الإدارة
            </button>
            <button
              onClick={() => {
                onAdminLogout();
                navigateTo(ROUTES.home);
              }}
              className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigateTo(ROUTES.admin)}
            className="flex items-center gap-2 text-sm font-bold bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-colors shadow-md hover:shadow-lg"
          >
            <User size={16} /> تسجيل الدخول
          </button>
        )}
      </div>
    </div>
  </div>
);

const MobileHeader = ({ title, cartCount, navigateTo, isCartAnimating }) => (
  <header className="md:hidden bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-white/60 px-4 py-3 flex justify-between items-center h-16 shadow-sm">
    <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
    <button
      onClick={() => navigateTo(ROUTES.cart)}
      className={`relative p-2 text-slate-600 bg-gray-50 rounded-full ${isCartAnimating ? 'animate-cart-shake' : ''}`}
    >
      <ShoppingCart size={20} />
      {cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
          {cartCount}
        </span>
      )}
    </button>
  </header>
);

const BottomNav = ({ currentRoute, navigateTo, cartCount, isCartAnimating, favoritesCount }) => (
  <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/60 pb-safe pt-2 px-4 flex justify-between items-center z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
    <button
      onClick={() => navigateTo(ROUTES.home)}
      className={`flex flex-col items-center p-2 transition-colors ${currentRoute === ROUTES.home ? 'text-emerald-600' : 'text-gray-400'}`}
    >
      <Home size={22} className={currentRoute === ROUTES.home ? 'fill-emerald-50' : ''} />
      <span className="text-[10px] mt-1 font-bold">الرئيسية</span>
    </button>
    <button
      onClick={() => navigateTo(ROUTES.offers)}
      className={`flex flex-col items-center p-2 transition-colors ${currentRoute === ROUTES.offers ? 'text-rose-500' : 'text-gray-400'}`}
    >
      <BadgePercent size={22} />
      <span className="text-[10px] mt-1 font-bold">العروض</span>
    </button>
    <button
      onClick={() => navigateTo(ROUTES.favorites)}
      className={`flex flex-col items-center p-2 relative transition-colors ${currentRoute === ROUTES.favorites ? 'text-rose-500' : 'text-gray-400'}`}
    >
      <Heart size={22} className={currentRoute === ROUTES.favorites ? 'fill-rose-100' : ''} />
      {favoritesCount > 0 && (
        <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
          {favoritesCount}
        </span>
      )}
      <span className="text-[10px] mt-1 font-bold">المفضلة</span>
    </button>
    <button
      onClick={() => navigateTo(ROUTES.cart)}
      className={`flex flex-col items-center p-2 relative transition-colors ${isCartAnimating ? 'animate-cart-shake' : ''} ${
        currentRoute === ROUTES.cart || currentRoute === ROUTES.checkout ? 'text-emerald-600' : 'text-gray-400'
      }`}
    >
      <ShoppingBag size={22} className={currentRoute === ROUTES.cart ? 'fill-emerald-50' : ''} />
      {cartCount > 0 && (
        <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
          {cartCount}
        </span>
      )}
      <span className="text-[10px] mt-1 font-bold">السلة</span>
    </button>
    <button
      onClick={() => navigateTo(ROUTES.admin)}
      className={`flex flex-col items-center p-2 transition-colors ${currentRoute === ROUTES.admin ? 'text-emerald-600' : 'text-gray-400'}`}
    >
      <User size={22} className={currentRoute === ROUTES.admin ? 'fill-emerald-50' : ''} />
      <span className="text-[10px] mt-1 font-bold">حسابي</span>
    </button>
  </div>
);

const MaintenanceView = ({ siteName, onOpenAdmin }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900/80 flex flex-col items-center justify-center p-4 text-center text-white">
    <Motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={PAGE_TRANSITION}
      className="relative overflow-hidden bg-white/10 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/20 max-w-xl w-full"
    >
      <div className="absolute -top-20 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 w-48 h-48 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative z-10">
        <div className="w-24 h-24 bg-orange-400/20 text-orange-300 rounded-full flex items-center justify-center mx-auto mb-6 border border-orange-200/30">
          <Power size={42} />
        </div>
        <h2 className="text-3xl md:text-4xl font-black mb-4">{siteName}</h2>
        <p className="text-base md:text-lg font-bold text-slate-200 mb-8">المتجر الآن في وضع الصيانة لتحسين الأداء وتجربة التسوق. سنعود خلال وقت قصير.</p>

        <div className="flex items-center justify-center gap-2 text-sm text-slate-100 font-bold bg-white/10 py-3 px-6 rounded-full w-fit mx-auto border border-white/20 mb-6">
          <ShieldCheck size={16} /> تحديثات جارية بشكل آمن
        </div>

        <button
          onClick={onOpenAdmin}
          className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-full font-black hover:bg-slate-100 transition"
        >
          <Lock size={18} /> دخول الإدارة
        </button>
      </div>
    </Motion.div>
  </div>
);

const OrderStatusPill = ({ status }) => {
  const meta = getOrderStatusMeta(status);
  return <span className={`text-xs font-black px-3 py-1 rounded-full border ${meta.className}`}>{meta.label}</span>;
};
const HomeView = ({
  products,
  onAddToCart,
  showToast,
  searchQuery,
  setSearchQuery,
  favorites,
  toggleFavorite,
  orders,
  isLoadingProducts,
  currentRoute,
  navigateTo,
}) => {
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [sortBy, setSortBy] = useState('newest');
  const [variantSelections, setVariantSelections] = useState({});

  const isOffersPage = currentRoute === ROUTES.offers;

  const maxProductPrice = useMemo(
    () => products.reduce((max, product) => Math.max(max, Number(product.price) || 0), 0),
    [products],
  );
  const sliderMax = Math.max(maxProductPrice, 1000);
  const [maxPrice, setMaxPrice] = useState(sliderMax);

  useEffect(() => {
    setMaxPrice(sliderMax);
  }, [sliderMax]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = products.filter((product) => {
      const inCategory = activeCategory === 'الكل' || product.category === activeCategory;
      const inSearch = !query || product.name.toLowerCase().includes(query);
      const inPrice = Number(product.price) <= maxPrice;
      const inOffers = !isOffersPage || isProductOnSale(product);
      return inCategory && inSearch && inPrice && inOffers;
    });

    switch (sortBy) {
      case 'price-low':
        return [...result].sort((a, b) => a.price - b.price);
      case 'price-high':
        return [...result].sort((a, b) => b.price - a.price);
      case 'discount':
        return [...result].sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
      default:
        return [...result].sort((a, b) => Number(b.id) - Number(a.id));
    }
  }, [products, activeCategory, searchQuery, maxPrice, sortBy, isOffersPage]);

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);

  const setProductSelection = (productId, nextValue) => {
    setVariantSelections((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        ...nextValue,
      },
    }));
  };

  const handleAddProduct = (product) => {
    const variants = normalizeProductVariants(product.variants);
    const selected = variantSelections[product.id] || {};

    if (variants.enableSizes && !selected.size) {
      showToast('اختر المقاس أولاً قبل الإضافة', 'error');
      return;
    }

    if (variants.enableColors && !selected.color) {
      showToast('اختر اللون أولاً قبل الإضافة', 'error');
      return;
    }

    onAddToCart({
      ...product,
      selectedSize: selected.size || '',
      selectedColor: selected.color || '',
    });
    showToast('تمت الإضافة للسلة', 'success');
  };

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={PAGE_TRANSITION} className="pb-24 md:pb-10 max-w-7xl mx-auto w-full">
      <div className="px-4 py-4 md:py-8">
        <div className="bg-slate-900 rounded-[2rem] p-8 md:p-16 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center min-h-[200px] md:min-h-[360px]">
          <div className="relative z-10 max-w-2xl">
            <span className="bg-emerald-500 text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mb-4 inline-block shadow-lg shadow-emerald-500/30">
              {isOffersPage ? 'خصومات مباشرة' : 'توصيل لـ 58 ولاية'}
            </span>
            <h2 className="text-3xl md:text-6xl font-black mb-4 leading-tight">
              {isOffersPage ? 'أفضل العروض' : 'أحدث صيحات'}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-300 to-teal-200">
                {isOffersPage ? 'تخفيضات اليوم' : 'الموضة بين يديك'}
              </span>
            </h2>
            <p className="text-slate-300 text-sm md:text-xl font-medium">تسوق الآن وادفع عند الاستلام بكل أمان وسهولة.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigateTo(ROUTES.home)}
                className={`px-4 py-2 rounded-full text-xs font-black border ${!isOffersPage ? 'bg-white text-slate-900 border-white' : 'bg-white/10 text-white border-white/20'}`}
              >
                كل المنتجات
              </button>
              <button
                onClick={() => navigateTo(ROUTES.offers)}
                className={`px-4 py-2 rounded-full text-xs font-black border inline-flex items-center gap-1 ${isOffersPage ? 'bg-rose-500 text-white border-rose-500' : 'bg-white/10 text-white border-white/20'}`}
              >
                <BadgePercent size={14} /> العروض
              </button>
            </div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80"
            className="absolute left-0 top-0 w-2/3 md:w-1/2 h-full object-cover opacity-40 mix-blend-luminosity"
            alt="Banner"
          />
        </div>
      </div>

      {recentOrders.length > 0 && !isOffersPage && (
        <div className="px-4 mb-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900">آخر طلباتك</h3>
              <span className="text-xs font-bold text-gray-500">{orders.length} طلب</span>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <p className="font-black text-slate-900">طلب #{String(order.id).slice(-5)}</p>
                    <p className="text-xs text-gray-500 font-bold">{new Date(order.date).toLocaleDateString('ar-DZ')}</p>
                  </div>
                  <OrderStatusPill status={order.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 md:hidden mb-4">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ابحث عن المنتجات..."
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pr-11 pl-4 outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
          />
        </div>
      </div>

      <div className="px-4 py-2 overflow-x-auto no-scrollbar flex gap-2 md:gap-4 md:justify-center md:mb-6 md:mt-2">
        {CATEGORIES.map((category) => {
          const categoryMeta = CATEGORY_META[category] || CATEGORY_META['الكل'];
          const CategoryIcon = categoryMeta.icon;

          return (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-300 inline-flex items-center gap-2 ${
                activeCategory === category
                  ? `bg-gradient-to-r ${categoryMeta.tone} text-white shadow-md transform scale-105`
                  : 'bg-white/80 backdrop-blur-xl border border-white text-slate-600 hover:bg-white'
              }`}
            >
              <CategoryIcon size={16} /> {category}
            </button>
          );
        })}
      </div>

      <div className="px-4 mb-3">
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center shadow-sm">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-3">
            <Filter size={18} className="text-slate-500" />
            <div className="w-full">
              <p className="text-xs text-gray-500 font-bold mb-1">السعر الأقصى</p>
              <p className="text-sm font-black text-slate-900">{maxPrice} د.ج</p>
            </div>
          </div>
          <div>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={100}
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-3">
            <ArrowUpDown size={18} className="text-slate-500" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full bg-transparent font-bold text-sm outline-none"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="price-low">السعر: من الأقل للأعلى</option>
              <option value="price-high">السعر: من الأعلى للأقل</option>
              <option value="discount">أعلى نسبة خصم</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 flex items-center justify-between text-xs md:text-sm mb-2">
        <p className="font-bold text-gray-500">{filteredProducts.length} منتج مطابق</p>
        <p className="font-bold text-gray-500">المفضلة: {favorites.length}</p>
      </div>

      {isLoadingProducts ? (
        <ProductsSkeletonGrid />
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold">
          <Package size={48} className="mx-auto mb-4 opacity-20" /> لا توجد منتجات بهذه المواصفات.
        </div>
      ) : (
        <div className="px-4 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => {
              const stock = clampStock(product.stock);
              const isFavorite = favorites.includes(product.id);
              const variants = normalizeProductVariants(product.variants);
              const selected = variantSelections[product.id] || {};
              const productOnSale = isProductOnSale(product);

              return (
                <Motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={PAGE_TRANSITION}
                  key={product.id}
                  className="group bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-white/60 overflow-hidden flex flex-col shadow-sm hover:shadow-2xl transition-all duration-300"
                >
                  <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm"
                    >
                      <Heart size={16} className={isFavorite ? 'text-rose-500 fill-rose-500' : 'text-slate-400'} />
                    </button>

                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md text-[10px] md:text-xs font-bold text-slate-800 shadow-sm">
                      {product.category}
                    </div>

                    {productOnSale && (
                      <div className="absolute bottom-14 left-2 bg-rose-500 text-white px-2 py-1 rounded-md text-[10px] md:text-xs font-black shadow-sm">
                        -{getDiscountPercent(product)}%
                      </div>
                    )}

                    <div
                      className={`absolute bottom-14 right-2 px-2 py-1 rounded-md text-[10px] md:text-xs font-bold shadow-sm ${
                        stock === 0
                          ? 'bg-red-100 text-red-700'
                          : stock <= 3
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {stock === 0 ? 'نفد المخزون' : `متوفر: ${stock}`}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1 gap-3">
                    <h3 className="font-bold text-slate-900 text-sm md:text-base line-clamp-2">{product.name}</h3>
                    <div>
                      <p className="font-black text-emerald-600 text-lg md:text-xl mt-1">{product.price} <span className="text-xs text-gray-400">د.ج</span></p>
                      {productOnSale && (
                        <p className="text-xs font-bold text-gray-400 line-through">{product.oldPrice} د.ج</p>
                      )}
                    </div>

                    {variants.enableSizes && (
                      <div>
                        <p className="text-[11px] font-black text-slate-500 mb-1 inline-flex items-center gap-1"><Ruler size={12} /> المقاس</p>
                        <div className="flex flex-wrap gap-1.5">
                          {variants.sizes.map((size) => (
                            <button
                              key={size}
                              onClick={() => setProductSelection(product.id, { size })}
                              className={`px-2 py-1 rounded-md border text-[11px] font-black ${selected.size === size ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {variants.enableColors && (
                      <div>
                        <p className="text-[11px] font-black text-slate-500 mb-1 inline-flex items-center gap-1"><Palette size={12} /> اللون</p>
                        <div className="flex flex-wrap gap-2">
                          {variants.colors.map((colorName) => {
                            const preset = COLOR_PRESETS.find((entry) => entry.name === colorName);
                            const isSelected = selected.color === colorName;
                            return (
                              <button
                                key={colorName}
                                onClick={() => setProductSelection(product.id, { color: colorName })}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-black ${isSelected ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 bg-white'}`}
                              >
                                <span className="inline-block w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: preset?.hex || '#e5e7eb' }} />
                                {colorName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleAddProduct(product)}
                      disabled={stock <= 0}
                      className={`w-full text-sm font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors active:scale-95 ${
                        stock <= 0
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white/90 backdrop-blur text-slate-900 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      <Plus size={18} />
                      <span>{stock <= 0 ? 'غير متوفر' : 'أضف للسلة'}</span>
                    </button>
                  </div>
                </Motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Motion.div>
  );
};

const FavoritesView = ({ products, favorites, toggleFavorite, onAddToCart, navigateTo, showToast }) => {
  const [variantSelections, setVariantSelections] = useState({});

  const favoriteProducts = useMemo(
    () => products.filter((product) => favorites.includes(product.id)),
    [products, favorites],
  );

  const setProductSelection = (productId, nextValue) => {
    setVariantSelections((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        ...nextValue,
      },
    }));
  };

  const handleAddFavoriteProduct = (product) => {
    const variants = normalizeProductVariants(product.variants);
    const selected = variantSelections[product.id] || {};

    if (variants.enableSizes && !selected.size) {
      showToast('اختر المقاس أولاً قبل الإضافة', 'error');
      return;
    }

    if (variants.enableColors && !selected.color) {
      showToast('اختر اللون أولاً قبل الإضافة', 'error');
      return;
    }

    onAddToCart({
      ...product,
      selectedSize: selected.size || '',
      selectedColor: selected.color || '',
    });
    showToast('تمت الإضافة للسلة', 'success');
  };

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={PAGE_TRANSITION} className="pb-24 md:pb-10 max-w-7xl mx-auto w-full px-4 md:px-6 pt-4 md:pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900">المفضلة</h2>
        <span className="text-xs md:text-sm font-black text-rose-500">{favoriteProducts.length} عنصر</span>
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 md:p-12 text-center">
          <Heart size={44} className="mx-auto mb-4 text-rose-200" />
          <p className="font-black text-slate-900 mb-2">لا توجد منتجات في المفضلة</p>
          <p className="text-sm font-bold text-gray-500 mb-5">أضف منتجاتك المفضلة للعودة إليها بسرعة.</p>
          <button onClick={() => navigateTo(ROUTES.home)} className="bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-black">
            تصفح المنتجات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {favoriteProducts.map((product) => {
              const variants = normalizeProductVariants(product.variants);
              const selected = variantSelections[product.id] || {};

              return (
                <Motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                >
                  <img src={product.image} loading="lazy" decoding="async" className="w-full h-48 object-cover" alt={product.name} />
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-slate-900 text-sm line-clamp-2">{product.name}</h3>
                      <button onClick={() => toggleFavorite(product.id)} className="text-rose-500">
                        <Heart size={18} className="fill-rose-500" />
                      </button>
                    </div>
                    <div>
                      <p className="font-black text-emerald-600">{product.price} د.ج</p>
                      {isProductOnSale(product) && <p className="text-xs text-gray-400 line-through font-bold">{product.oldPrice} د.ج</p>}
                    </div>

                    {variants.enableSizes && (
                      <div className="flex flex-wrap gap-1">
                        {variants.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setProductSelection(product.id, { size })}
                            className={`px-2 py-1 rounded-md border text-[11px] font-black ${selected.size === size ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    )}

                    {variants.enableColors && (
                      <div className="flex flex-wrap gap-1">
                        {variants.colors.map((colorName) => (
                          <button
                            key={colorName}
                            onClick={() => setProductSelection(product.id, { color: colorName })}
                            className={`px-2 py-1 rounded-md border text-[11px] font-black ${selected.color === colorName ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                          >
                            {colorName}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleAddFavoriteProduct(product)}
                      className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-black"
                    >
                      إضافة للسلة
                    </button>
                  </div>
                </Motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Motion.div>
  );
};

const CartView = ({
  cart,
  dispatchCart,
  navigateTo,
  siteConfig,
  showToast,
  setCheckoutPricing,
  onAddToCart,
  onRemoveFromCart,
  onCouponApplied,
}) => {
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);

  const availableCoupons = useMemo(
    () => normalizeCoupons(siteConfig.coupons, siteConfig.couponCode, siteConfig.couponDiscount),
    [siteConfig.coupons, siteConfig.couponCode, siteConfig.couponDiscount],
  );

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const activeCoupon = useMemo(() => {
    if (!appliedCoupon || cart.length === 0) return null;
    const linked = availableCoupons.find(
      (coupon) => coupon.id === appliedCoupon.id || normalizeCouponCode(coupon.code) === normalizeCouponCode(appliedCoupon.code),
    );
    if (!linked || !isCouponApplicable(linked)) return null;
    return linked;
  }, [appliedCoupon, availableCoupons, cart.length]);

  const discountValue = activeCoupon ? Math.round((subtotal * activeCoupon.discount) / 100) : 0;
  const total = Math.max(0, subtotal - discountValue);

  useEffect(() => {
    if (cart.length === 0) {
      setAppliedCoupon(null);
      setCouponInput('');
    }
  }, [cart.length]);

  useEffect(() => {
    if (appliedCoupon && !activeCoupon) {
      setAppliedCoupon(null);
      showToast('تم إلغاء الكوبون تلقائياً لانتهاء الصلاحية أو نفاد الاستخدام', 'error');
    }
  }, [appliedCoupon, activeCoupon, showToast]);

  const applyCoupon = () => {
    const normalizedInput = normalizeCouponCode(couponInput);
    if (!normalizedInput) {
      showToast('أدخل رمز كوبون صحيح', 'error');
      return;
    }

    const coupon = availableCoupons.find((entry) => normalizeCouponCode(entry.code) === normalizedInput);

    if (!coupon) {
      showToast('كود الخصم غير صحيح', 'error');
      return;
    }

    if (isCouponExpired(coupon)) {
      showToast('هذا الكوبون منتهي الصلاحية', 'error');
      return;
    }

    if (isCouponExhausted(coupon)) {
      showToast('تم استهلاك هذا الكوبون بالكامل', 'error');
      return;
    }

    setAppliedCoupon(coupon);
    onCouponApplied();
    showToast(`تم تطبيق خصم ${coupon.discount}% بنجاح`, 'success');
  };

  const cancelCoupon = () => {
    setAppliedCoupon(null);
    showToast('تم إلغاء الكوبون', 'success');
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={PAGE_TRANSITION}
      className="pb-32 md:pb-12 min-h-screen bg-gray-50 md:bg-white max-w-7xl mx-auto w-full md:pt-10"
    >
      <div className="hidden md:flex justify-between items-end px-6 mb-8">
        <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <ShoppingCart /> سلة المشتريات
        </h2>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 px-4">
          <Package size={80} className="mb-6 opacity-20" />
          <p className="font-bold text-2xl mb-6 text-slate-800">سلتك فارغة تماماً</p>
          <button
            onClick={() => navigateTo(ROUTES.home)}
            className="bg-slate-900 text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all"
          >
            ابدأ التسوق الآن
          </button>
        </div>
      ) : (
        <div className="px-4 md:px-6 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <AnimatePresence>
              {cart.map((item) => {
                const stock = Number.isFinite(Number(item.stock)) ? Number(item.stock) : Number.POSITIVE_INFINITY;

                return (
                  <Motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.94, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -8 }}
                    key={item.cartKey || buildCartItemKey(item)}
                    className="bg-white p-3 md:p-6 rounded-2xl flex gap-4 shadow-sm border border-gray-100"
                  >
                    <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="w-24 h-28 md:w-32 md:h-32 object-cover rounded-xl bg-gray-50" />
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm md:text-lg line-clamp-2 mb-1">{item.name}</h3>
                          {(item.selectedSize || item.selectedColor) && (
                            <p className="text-xs font-black text-slate-500">
                              {item.selectedSize ? `المقاس: ${item.selectedSize}` : ''}
                              {item.selectedSize && item.selectedColor ? ' | ' : ''}
                              {item.selectedColor ? `اللون: ${item.selectedColor}` : ''}
                            </p>
                          )}
                          <p className="font-black text-emerald-600 text-lg mt-2">{item.price} د.ج</p>
                        </div>
                        <button
                          onClick={() => onRemoveFromCart(item)}
                          className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 bg-gray-50 w-fit rounded-xl p-1 border border-gray-100 mt-4">
                        <button
                          onClick={() => dispatchCart({ type: 'DECREASE', payload: item })}
                          className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg text-slate-600 shadow-sm font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold text-sm md:text-base w-6 text-center">{item.qty}</span>
                        <button
                          onClick={() => {
                            if (item.qty >= stock) {
                              showToast('وصلت للكمية المتاحة من هذا المنتج', 'error');
                              return;
                            }
                            onAddToCart(item);
                          }}
                          className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg text-slate-600 shadow-sm font-bold"
                          disabled={item.qty >= stock}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </Motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="lg:w-96">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] md:shadow-xl border border-gray-100 fixed bottom-[70px] md:sticky md:top-28 left-0 w-full md:w-auto z-30 pb-safe md:pb-8">
              <h3 className="hidden md:block font-black text-xl mb-6">ملخص الطلب</h3>

              <div className="mb-4 md:pt-4">
                <p className="text-xs font-bold text-gray-500 mb-2">كوبون الخصم</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value)}
                    placeholder="COUPON"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button onClick={applyCoupon} className="bg-slate-900 text-white px-4 rounded-xl font-bold text-sm">
                    تطبيق
                  </button>
                </div>

                {availableCoupons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableCoupons.slice(0, 3).map((coupon) => {
                      const disabled = isCouponExpired(coupon) || isCouponExhausted(coupon);
                      return (
                        <button
                          key={coupon.id}
                          onClick={() => setCouponInput(coupon.code)}
                          disabled={disabled}
                          className={`text-[11px] px-2 py-1 rounded-full border font-black ${disabled ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                        >
                          {coupon.code}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeCoupon && (
                  <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center justify-between">
                    <span>تم تطبيق {activeCoupon.code}</span>
                    <button onClick={cancelCoupon} className="text-rose-500">
                      إلغاء
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4 md:border-t md:pt-4 border-gray-100">
                <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                  <span>المجموع الفرعي</span>
                  <span>{subtotal} د.ج</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                    <span>الخصم</span>
                    <span>-{discountValue} د.ج</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-gray-500 md:text-slate-900 font-medium md:font-black text-sm md:text-xl">الإجمالي</span>
                  <span className="text-2xl md:text-3xl font-black text-emerald-600">
                    {total} <span className="text-sm">د.ج</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setCheckoutPricing({
                    subtotal,
                    discount: discountValue,
                    total,
                    couponCode: activeCoupon?.code || '',
                    couponId: activeCoupon?.id || '',
                  });
                  navigateTo(ROUTES.checkout);
                }}
                className="w-full bg-slate-900 text-white font-black py-4 md:py-5 rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl hover:bg-emerald-500 active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                إتمام الطلب <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Motion.div>
  );
};

const CheckoutView = ({ cart, checkoutPricing, onAddOrder, navigateTo }) => {
  const [formData, setFormData] = useState(() => {
    const initialWilayaCode = DEFAULT_WILAYA_CODE;
    const initialWilayaName = getWilayaNameByCode(initialWilayaCode);
    const initialCommunes = COMMUNES_BY_WILAYA[initialWilayaCode] || [];

    return {
      name: '',
      phone: '',
      wilayaCode: initialWilayaCode,
      wilayaName: initialWilayaName,
      communeName: initialCommunes[0]?.commune_name || '',
    };
  });

  const communesForSelectedWilaya = useMemo(
    () => COMMUNES_BY_WILAYA[formData.wilayaCode] || [],
    [formData.wilayaCode],
  );

  const subtotalFromCart = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.min(Number(checkoutPricing.discount) || 0, subtotalFromCart);
  const total = Number(checkoutPricing.total) || Math.max(0, subtotalFromCart - discount);

  const handleWilayaChange = (event) => {
    const nextWilayaCode = event.target.value;
    const nextWilayaName = getWilayaNameByCode(nextWilayaCode);
    const nextCommunes = COMMUNES_BY_WILAYA[nextWilayaCode] || [];

    setFormData((prev) => ({
      ...prev,
      wilayaCode: nextWilayaCode,
      wilayaName: nextWilayaName,
      communeName: nextCommunes[0]?.commune_name || '',
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.wilayaCode || !formData.wilayaName || !formData.communeName) {
      return;
    }

    const customerAddressData = {
      ...formData,
      wilaya: formData.wilayaName,
      commune: formData.communeName,
      city: formData.communeName,
      wilaya_name: formData.wilayaName,
      commune_name: formData.communeName,
    };

    onAddOrder(customerAddressData, cart, {
      subtotal: subtotalFromCart,
      discount,
      total,
      couponCode: checkoutPricing.couponCode || '',
      couponId: checkoutPricing.couponId || '',
    });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Package size={70} className="text-gray-300 mb-4" />
        <p className="text-2xl font-black text-slate-900 mb-2">لا يوجد منتجات للشراء</p>
        <p className="text-gray-500 font-bold mb-6">أضف منتجات أولاً ثم عد لإتمام الطلب.</p>
        <button onClick={() => navigateTo(ROUTES.home)} className="bg-slate-900 text-white px-8 py-4 rounded-full font-bold">
          العودة للتسوق
        </button>
      </div>
    );
  }

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={PAGE_TRANSITION} className="pb-24 min-h-screen bg-white max-w-4xl mx-auto w-full md:pt-12">
      <div className="hidden md:flex items-center gap-3 mb-8 px-6">
        <button onClick={() => navigateTo(ROUTES.cart)} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-slate-600 rotate-180">
          <ChevronRight size={24} />
        </button>
        <h1 className="text-3xl font-black text-slate-900">معلومات التوصيل الآمنة</h1>
      </div>
      <div className="px-4 md:px-6">
        <form onSubmit={handleSubmit} className="bg-white md:shadow-2xl md:p-10 md:rounded-[2rem] md:border border-gray-50 space-y-6 mt-6 md:mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">الاسم واللقب</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">رقم الهاتف</label>
              <input
                required
                type="tel"
                dir="ltr"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">الولاية</label>
              <select
                required
                value={formData.wilayaCode}
                onChange={handleWilayaChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {WILAYA_OPTIONS.map((wilaya) => (
                  <option key={wilaya.wilaya_code} value={wilaya.wilaya_code}>
                    {wilaya.wilaya_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">البلدية</label>
              <select
                required
                value={formData.communeName}
                onChange={(event) => setFormData({ ...formData, communeName: event.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 px-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={communesForSelectedWilaya.length === 0}
              >
                {communesForSelectedWilaya.length === 0 && <option value="">لا توجد بلديات</option>}
                {communesForSelectedWilaya.map((commune) => (
                  <option key={`${formData.wilayaCode}-${commune.id}`} value={commune.commune_name}>
                    {commune.commune_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100 space-y-3">
            <div className="flex justify-between items-center text-sm font-bold text-gray-500">
              <span>المجموع الفرعي</span>
              <span>{subtotalFromCart} د.ج</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                <span>الخصم</span>
                <span>-{discount} د.ج</span>
              </div>
            )}
            {checkoutPricing.couponCode && (
              <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                <span>الكوبون المستخدم</span>
                <span dir="ltr">{checkoutPricing.couponCode}</span>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2 border-t border-gray-100">
              <div className="text-center md:text-right w-full md:w-auto">
                <p className="text-gray-500 text-sm font-bold mb-1">المبلغ المطلوب:</p>
                <p className="text-3xl font-black text-slate-900">
                  {total} <span className="text-emerald-500">د.ج</span>
                </p>
              </div>
              <button
                type="submit"
                className="w-full md:w-auto md:px-12 bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:shadow-2xl hover:bg-emerald-500 transition-all flex justify-center items-center gap-3 text-lg"
              >
                تأكيد الطلب نهائياً <CheckCircle size={24} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </Motion.div>
  );
};

const AdminLogin = ({ showToast, onBackToStore }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!auth) {
      showToast('Firebase Authentication غير مهيأ. تحقق من إعدادات البيئة.', 'error');
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      showToast('أدخل البريد الإلكتروني وكلمة المرور', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      showToast('تم تسجيل الدخول بنجاح');
    } catch (error) {
      const errorCode = error?.code || '';
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
        showToast('بيانات تسجيل الدخول غير صحيحة', 'error');
      } else if (errorCode === 'auth/too-many-requests') {
        showToast('محاولات كثيرة. حاول لاحقاً', 'error');
      } else {
        showToast('تعذر تسجيل الدخول حالياً', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!auth) {
      showToast('Firebase Authentication غير مهيأ', 'error');
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      showToast('أدخل البريد الإلكتروني أولاً لإرسال رابط الاستعادة', 'error');
      return;
    }

    try {
      setIsSendingReset(true);
      await sendPasswordResetEmail(auth, normalizedEmail);
      showToast('تم إرسال رابط استعادة كلمة المرور إلى البريد الإلكتروني');
    } catch {
      showToast('تعذر إرسال رابط الاستعادة. تحقق من البريد الإلكتروني.', 'error');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-emerald-50/40 to-teal-100/40 flex items-center justify-center p-4 md:p-8">
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={PAGE_TRANSITION}
        className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-white shadow-2xl rounded-[2rem] p-6 md:p-8"
      >
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-600 text-white flex items-center justify-center shadow-xl mb-4">
            <ShieldCheck size={30} />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">بوابة الإدارة الآمنة</h2>
          <p className="text-sm text-slate-500 font-bold mt-2">تسجيل دخول عبر Firebase Authentication</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني</label>
            <div className="relative">
              <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@store.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pr-11 pl-4 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
            <div className="relative">
              <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-3.5 pr-11 pl-4 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !auth}
            className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-slate-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isSendingReset || !auth}
            className="w-full text-sm font-bold text-emerald-700 hover:text-emerald-600 py-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingReset ? 'جاري إرسال الرابط...' : 'نسيت كلمة المرور؟'}
          </button>
        </form>
        <button
          type="button"
          onClick={onBackToStore}
          className="w-full text-sm font-bold text-slate-600 hover:text-slate-900 py-2 transition"
        >
          العودة إلى واجهة المتجر
        </button>
        {!auth && (
          <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-3 text-xs font-bold text-orange-700 text-center">
            لا يمكن تسجيل الدخول قبل إكمال متغيرات Firebase في ملف `.env`.
          </div>
        )}
      </Motion.div>
    </div>
  );
};

const AdminCMS = ({
  orders,
  setOrders,
  products,
  setProducts,
  siteConfig,
  setSiteConfig,
  onLogout,
  showToast,
  syncStatus,
  adminUser,
  adminTheme,
  setAdminTheme,
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    oldPrice: '',
    category: CATEGORIES[1],
    image: '',
    stock: 10,
    variants: { ...DEFAULT_PRODUCT_VARIANTS },
  });
  const [productQuery, setProductQuery] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discount: 10, maxUses: 100, expiresAt: '' });
  const isDarkMode = adminTheme === 'dark';

  const revenue = useMemo(
    () =>
      orders
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0),
    [orders],
  );

  const pendingOrdersCount = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders],
  );

  const deliveredOrdersCount = useMemo(
    () => orders.filter((order) => order.status === 'delivered').length,
    [orders],
  );

  const lowStockProducts = useMemo(() => products.filter((product) => clampStock(product.stock) <= 3), [products]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const statusOk = orderStatusFilter === 'all' || order.status === orderStatusFilter;
      const customerWilayaName = (order.customer?.wilaya_name || order.customer?.wilaya || '').toLowerCase();
      const customerCommuneName = (order.customer?.commune_name || order.customer?.commune || order.customer?.city || '').toLowerCase();
      const queryOk =
        !query ||
        order.customer?.name?.toLowerCase().includes(query) ||
        order.customer?.phone?.toLowerCase().includes(query) ||
        customerWilayaName.includes(query) ||
        customerCommuneName.includes(query);
      return statusOk && queryOk;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query),
    );
  }, [products, productQuery]);

  const adminCoupons = useMemo(
    () => normalizeCoupons(siteConfig.coupons, siteConfig.couponCode, siteConfig.couponDiscount),
    [siteConfig.coupons, siteConfig.couponCode, siteConfig.couponDiscount],
  );

  const sizeOptions = productForm.variants.sizeType === 'shoes' ? SHOE_SIZES : CLOTHING_SIZES;

  const handleSaveProduct = (event) => {
    event.preventDefault();

    const normalizedVariants = normalizeProductVariants(productForm.variants);

    const normalizedProduct = {
      ...productForm,
      name: productForm.name.trim(),
      image: productForm.image.trim(),
      price: Number(productForm.price) || 0,
      oldPrice: Number(productForm.oldPrice) > 0 ? Number(productForm.oldPrice) : 0,
      stock: clampStock(productForm.stock),
      variants: normalizedVariants,
    };

    if (!normalizedProduct.name || !normalizedProduct.image || normalizedProduct.price <= 0) {
      showToast('أدخل بيانات منتج صحيحة', 'error');
      return;
    }

    if (normalizedProduct.oldPrice > 0 && normalizedProduct.oldPrice <= normalizedProduct.price) {
      showToast('السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي', 'error');
      return;
    }

    if (editingProduct) {
      setProducts(
        products.map((product) =>
          product.id === editingProduct.id ? { ...normalizedProduct, id: editingProduct.id } : product,
        ),
      );
      showToast('تم تعديل المنتج بنجاح');
    } else {
      setProducts([{ ...normalizedProduct, id: Date.now() }, ...products]);
      showToast('تم نشر المنتج الجديد في المتجر');
    }

    setShowProductForm(false);
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: '',
      oldPrice: '',
      category: CATEGORIES[1],
      image: '',
      stock: 10,
      variants: { ...DEFAULT_PRODUCT_VARIANTS },
    });
  };

  const handleDeleteProduct = (id) => {
    if (window.confirm('هل تريد حذف هذا المنتج من المتجر؟')) {
      setProducts(products.filter((product) => product.id !== id));
      showToast('تم حذف المنتج', 'error');
    }
  };


  const handleUploadProductImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    

    try {
      setUploadingImage(true);
      const imageUrl = await uploadProductImage(file);
      setProductForm((prev) => ({ ...prev, image: imageUrl }));
      showToast('تم رفع الصورة عبر ImgBB بنجاح');
    } catch {
      showToast('فشل رفع الصورة. تحقق من VITE_IMGBB_API_KEY', 'error');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleCreateCoupon = (event) => {
    event.preventDefault();

    const code = normalizeCouponCode(couponForm.code);
    const discount = clampDiscount(couponForm.discount);
    const maxUses = clampUses(couponForm.maxUses);
    const expiresAt = couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : '';

    if (!code || discount <= 0) {
      showToast('أدخل كود كوبون ونسبة خصم صحيحة', 'error');
      return;
    }

    if (adminCoupons.some((coupon) => normalizeCouponCode(coupon.code) === code)) {
      showToast('هذا الكود موجود مسبقاً', 'error');
      return;
    }

    setSiteConfig({
      ...siteConfig,
      coupons: [
        {
          id: String(Date.now()) + '-' + code,
          code,
          discount,
          maxUses,
          usedCount: 0,
          expiresAt,
        },
        ...adminCoupons,
      ],
    });

    setCouponForm({ code: '', discount: 10, maxUses: 100, expiresAt: '' });
    showToast('تم إنشاء الكوبون بنجاح', 'success');
  };

  const handleDeleteCoupon = (couponId) => {
    setSiteConfig({
      ...siteConfig,
      coupons: adminCoupons.filter((coupon) => coupon.id !== couponId),
    });
    showToast('تم حذف الكوبون', 'error');
  };

  const handleOrderStatusChange = (orderId, nextStatus) => {
    setOrders(
      orders.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order)),
    );
    showToast('تم تحديث حالة الطلب');
  };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={PAGE_TRANSITION}
      className={`admin-cms ${isDarkMode ? 'admin-theme-dark' : 'bg-gradient-to-br from-slate-100 via-white to-emerald-50/60'} pb-24 md:pb-10 min-h-screen`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        body { font-family: 'Tajawal', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        input, select, button { -webkit-tap-highlight-color: transparent; }
        @keyframes cart-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          50% { transform: translateX(2px); }
          75% { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        .animate-cart-shake { animation: cart-shake 0.38s ease-in-out; }
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: skeleton-shimmer 1.2s infinite;
        }
      `}</style>
      <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${isDarkMode ? "border-slate-700/70 bg-slate-900/80" : "border-slate-200/70 bg-white/90"}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black admin-title flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" /> لوحة التحكم المركزية
            </h1>
            <p className={`text-xs font-bold mt-1 ${isDarkMode ? "text-slate-300" : "text-slate-500"}`} dir="ltr">{adminUser?.email || 'admin'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                siteConfig.isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-orange-50 text-orange-700 border-orange-200'
              }`}
            >
              {siteConfig.isOnline ? 'المتجر مفتوح' : 'وضع الصيانة'}
            </span>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                syncStatus === 'online'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {syncStatus === 'online' ? 'Firebase متصل' : syncStatus === 'syncing' ? 'جاري المزامنة' : 'وضع محلي'}
            </span>
            <div className={`inline-flex items-center rounded-xl border p-1 ${isDarkMode ? 'admin-soft' : 'bg-white border-slate-200'}`}>
              <button
                onClick={() => setAdminTheme('dark')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition ${
                  isDarkMode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MoonStar size={14} /> وضع ليل
              </button>
              <button
                onClick={() => setAdminTheme('light')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition ${
                  !isDarkMode ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <SunMedium size={14} /> وضع صباح
              </button>
            </div>
            <button
              onClick={() => onLogout()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition"
              title="خروج"
            >
              <LogOut size={16} /> خروج
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row mt-6 md:mt-8 px-4 md:px-6 gap-6 md:gap-8">
        <aside className="lg:w-72 shrink-0">
          <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-sm">
            <div className="rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white p-4 mb-3">
              <div className="flex items-center gap-2 font-black text-sm">
                <Sparkles size={16} /> Dashboard Modern
              </div>
              <p className="text-[11px] text-emerald-50 mt-1">تنقل سريع بين الأقسام الأساسية</p>
            </div>

            <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl whitespace-nowrap transition-colors font-bold ${
                  activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard size={18} /> نظرة عامة
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl whitespace-nowrap transition-colors font-bold ${
                  activeTab === 'orders' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingCart size={18} /> الطلبات
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl whitespace-nowrap transition-colors font-bold ${
                  activeTab === 'products' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store size={18} /> المنتجات
              </button>
              <button
                onClick={() => setActiveTab('marketing')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl whitespace-nowrap transition-colors font-bold ${
                  activeTab === 'marketing' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Megaphone size={18} /> التسويق
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl whitespace-nowrap transition-colors font-bold ${
                  activeTab === 'settings' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Settings size={18} /> الإعدادات
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 w-full overflow-hidden">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in">
              <h2 className="text-2xl font-black text-slate-900 mb-6">الإحصائيات الرئيسية</h2>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-50 p-5 rounded-3xl border border-gray-100">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                    <Package size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">الطلبات</p>
                  <p className="text-2xl font-black">{orders.length}</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-3xl border border-gray-100">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mb-3">
                    <ShoppingCart size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">قيد المعالجة</p>
                  <p className="text-2xl font-black">{pendingOrdersCount}</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-3xl border border-gray-100">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-3">
                    <CheckCircle size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">تم التسليم</p>
                  <p className="text-2xl font-black">{deliveredOrdersCount}</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-3xl border border-gray-100">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                    <CreditCard size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">الإيرادات</p>
                  <p className="text-xl font-black text-emerald-600">{revenue} د.ج</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-3xl border border-gray-100">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-3">
                    <AlertTriangle size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">مخزون منخفض</p>
                  <p className="text-2xl font-black">{lowStockProducts.length}</p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-center">
                <p className="font-black text-slate-900 mb-2">عرض الطلبات أصبح في قسم مستقل</p>
                <p className="text-sm font-bold text-gray-500 mb-4">اضغط على تبويب "الطلبات" لإدارة جميع الطلبات بالتفصيل.</p>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-black"
                >
                  <ShoppingCart size={16} /> فتح قسم الطلبات
                </button>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="text-2xl font-black text-slate-900">إدارة الطلبات</h2>
                <div className="text-sm font-bold text-gray-500">{filteredOrders.length} طلب</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="بحث بالاسم أو الهاتف أو الولاية"
                  className="md:col-span-2 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="all">كل الحالات</option>
                  {ORDER_STATUSES.map((status) => (
                    <option value={status.key} key={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 font-bold">
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900 text-lg">{order.customer.name}</p>
                          <p className="text-sm text-gray-500 font-bold">{order.customer.wilaya_name || order.customer.wilaya} • {order.customer.commune_name || order.customer.commune || order.customer.city}</p>
                          <p className="text-sm text-gray-500 font-bold">{order.customer.phone}</p>
                          <p className="text-xs text-gray-400 mt-1">#{String(order.id).slice(-6)} • {new Date(order.date).toLocaleString('ar-DZ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={order.status}
                            onChange={(event) => handleOrderStatusChange(order.id, event.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-bold outline-none"
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status.key} value={status.key}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                          <OrderStatusPill status={order.status} />
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-xs font-black text-gray-500 mb-2">المنتجات</p>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={`${order.id}-${item.cartKey || buildCartItemKey(item)}`} className="flex items-center justify-between text-sm font-bold text-slate-700">
                              <span>
                                {item.name}
                                {(item.selectedSize || item.selectedColor) && (
                                  <span className="text-[10px] text-slate-500 mr-2">
                                    {item.selectedSize ? 'مقاس: ' + item.selectedSize : ''}
                                    {item.selectedSize && item.selectedColor ? ' | ' : ''}
                                    {item.selectedColor ? 'لون: ' + item.selectedColor : ''}
                                  </span>
                                )}
                              </span>
                              <span>x{item.qty}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm font-bold">
                        <span className="text-gray-500">فرعي: {order.subtotal} د.ج</span>
                        {order.discount > 0 && <span className="text-emerald-600">خصم: -{order.discount} د.ج</span>}
                        {order.couponCode && <span className="text-gray-500" dir="ltr">{order.couponCode}</span>}
                        <span className="text-slate-900">الإجمالي: {order.totalPrice} د.ج</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                <h2 className="text-2xl font-black text-slate-900">إدارة المنتجات والمخزون</h2>
                <button
                  onClick={() => {
                    setProductForm({
                      name: '',
                      price: '',
                      oldPrice: '',
                      category: CATEGORIES[1],
                      image: '',
                      stock: 10,
                      variants: { ...DEFAULT_PRODUCT_VARIANTS },
                    });
                    setEditingProduct(null);
                    setShowProductForm(true);
                  }}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                >
                  <Plus size={18} /> إضافة منتج
                </button>
              </div>

              <input
                type="text"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="بحث عن منتج..."
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
              />

              {showProductForm ? (                <form onSubmit={handleSaveProduct} className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-gray-200">
                  <h3 className="font-black text-xl mb-6">{editingProduct ? 'تعديل المنتج' : 'نشر منتج جديد'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold mb-2">اسم المنتج</label>
                      <input
                        required
                        type="text"
                        value={productForm.name}
                        onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">القسم</label>
                      <select
                        required
                        value={productForm.category}
                        onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      >
                        {CATEGORIES.filter((category) => category !== 'الكل').map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold mb-2">السعر الحالي (د.ج)</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={productForm.price}
                        onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">السعر قبل الخصم (اختياري)</label>
                      <input
                        type="number"
                        min="0"
                        value={productForm.oldPrice}
                        onChange={(event) => setProductForm({ ...productForm, oldPrice: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-2">المخزون</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={productForm.stock}
                        onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold mb-2">رابط الصورة (URL)</label>
                      <input
                        required
                        type="url"
                        dir="ltr"
                        value={productForm.image}
                        onChange={(event) => setProductForm({ ...productForm, image: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                      <label className="block text-xs font-bold text-gray-500 mt-3 mb-2">أو ارفع صورة مباشرة عبر ImgBB</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadProductImage}
                        disabled={uploadingImage}
                        className="w-full p-2 rounded-xl border border-dashed border-gray-300 bg-white text-xs font-bold"
                      />
                      <p className="text-[11px] text-slate-500 font-bold mt-1">يتطلب المتغير `VITE_IMGBB_API_KEY` في `.env`.</p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                      <p className="font-black text-sm">السمات الديناميكية</p>

                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold inline-flex items-center gap-1"><Ruler size={14} /> تفعيل المقاسات</label>
                        <input
                          type="checkbox"
                          checked={productForm.variants.enableSizes}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setProductForm({
                              ...productForm,
                              variants: {
                                ...productForm.variants,
                                enableSizes: enabled,
                                sizes: enabled ? productForm.variants.sizes : [],
                              },
                            });
                          }}
                          className="w-5 h-5 accent-emerald-500"
                        />
                      </div>

                      {productForm.variants.enableSizes && (
                        <div className="space-y-2">
                          <select
                            value={productForm.variants.sizeType}
                            onChange={(event) =>
                              setProductForm({
                                ...productForm,
                                variants: {
                                  ...productForm.variants,
                                  sizeType: event.target.value,
                                  sizes: [],
                                },
                              })
                            }
                            className="w-full p-2 rounded-lg border border-gray-300 text-sm font-bold"
                          >
                            <option value="clothing">مقاسات ملابس (S-XXL)</option>
                            <option value="shoes">مقاسات أحذية (37-45)</option>
                          </select>

                          <div className="flex flex-wrap gap-2">
                            {sizeOptions.map((size) => {
                              const isActive = productForm.variants.sizes.includes(size);
                              return (
                                <button
                                  type="button"
                                  key={size}
                                  onClick={() => {
                                    const nextSizes = isActive
                                      ? productForm.variants.sizes.filter((entry) => entry !== size)
                                      : [...productForm.variants.sizes, size];
                                    setProductForm({
                                      ...productForm,
                                      variants: { ...productForm.variants, sizes: nextSizes },
                                    });
                                  }}
                                  className={`px-2 py-1 rounded-md border text-xs font-black ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold inline-flex items-center gap-1"><Palette size={14} /> تفعيل الألوان</label>
                        <input
                          type="checkbox"
                          checked={productForm.variants.enableColors}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setProductForm({
                              ...productForm,
                              variants: {
                                ...productForm.variants,
                                enableColors: enabled,
                                colors: enabled ? productForm.variants.colors : [],
                              },
                            });
                          }}
                          className="w-5 h-5 accent-emerald-500"
                        />
                      </div>

                      {productForm.variants.enableColors && (
                        <div className="flex flex-wrap gap-2">
                          {COLOR_PRESETS.map((colorEntry) => {
                            const isActive = productForm.variants.colors.includes(colorEntry.name);
                            return (
                              <button
                                type="button"
                                key={colorEntry.name}
                                onClick={() => {
                                  const nextColors = isActive
                                    ? productForm.variants.colors.filter((entry) => entry !== colorEntry.name)
                                    : [...productForm.variants.colors, colorEntry.name];
                                  setProductForm({
                                    ...productForm,
                                    variants: { ...productForm.variants, colors: nextColors },
                                  });
                                }}
                                className={`px-2 py-1 rounded-md border text-xs font-black inline-flex items-center gap-1 ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}
                              >
                                <span className="w-3 h-3 rounded-full border border-white/50" style={{ backgroundColor: colorEntry.hex }} />
                                {colorEntry.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl shadow-md">
                      {editingProduct ? 'حفظ التعديلات' : 'نشر المنتج'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="px-6 bg-white border border-gray-300 text-gray-600 font-bold rounded-xl"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => {
                    const stock = clampStock(product.stock);
                    return (
                      <div key={product.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm group">
                        <img src={product.image} loading="lazy" decoding="async" className="w-full h-40 object-cover bg-gray-50" alt={product.name} />
                        <div className="p-4">
                          <p className="font-bold text-sm truncate mb-1">{product.name}</p>
                          <p className="font-black text-emerald-600 mb-1">{product.price} د.ج</p>
                          <p
                            className={`text-xs font-black mb-4 ${
                              stock === 0 ? 'text-red-600' : stock <= 3 ? 'text-orange-600' : 'text-gray-500'
                            }`}
                          >
                            المخزون: {stock}
                          </p>
                          <div className="mb-3 flex flex-wrap gap-1">
                            {normalizeProductVariants(product.variants).enableSizes && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-black">مقاسات</span>
                            )}
                            {normalizeProductVariants(product.variants).enableColors && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-black">ألوان</span>
                            )}
                            {isProductOnSale(product) && (
                              <span className="text-[10px] px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-black">خصم {getDiscountPercent(product)}%</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setProductForm({
                                  ...product,
                                  stock: clampStock(product.stock),
                                  oldPrice: Number(product.oldPrice) > 0 ? product.oldPrice : '',
                                  variants: normalizeProductVariants(product.variants),
                                });
                                setEditingProduct(product);
                                setShowProductForm(true);
                              }}
                              className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                            >
                              <Edit3 size={14} /> تعديل
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="bg-red-50 text-red-600 p-2 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in max-w-2xl">
              <h2 className="text-2xl font-black text-slate-900 mb-6">إعدادات المتجر الأساسية</h2>

              <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-[2rem] space-y-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المتجر</label>
                  <input
                    type="text"
                    value={siteConfig.name}
                    onChange={(event) => setSiteConfig({ ...siteConfig, name: event.target.value })}
                    className="w-full p-4 rounded-xl border border-gray-300 font-black text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all"
                  />
                </div>


                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم واتساب المتجر</label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={siteConfig.whatsappNumber || ''}
                    onChange={(event) =>
                      setSiteConfig({
                        ...siteConfig,
                        whatsappNumber: event.target.value,
                      })
                    }
                    placeholder="213555000000"
                    className="w-full p-4 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all"
                  />
                  <p className="text-xs font-bold text-gray-500 mt-2">سيظهر في الزر العائم للتواصل عبر واتساب.</p>
                </div>
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-gray-700">حالة المتجر (إغلاق / فتح)</label>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        siteConfig.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {siteConfig.isOnline ? 'نشط الآن' : 'مغلق للصيانة'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSiteConfig({ ...siteConfig, isOnline: !siteConfig.isOnline });
                      showToast(siteConfig.isOnline ? 'تم إغلاق المتجر للزبائن' : 'تم فتح المتجر للزبائن');
                    }}
                    className={`w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${
                      siteConfig.isOnline
                        ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                        : 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-600'
                    }`}
                  >
                    <Power size={20} /> {siteConfig.isOnline ? 'تفعيل وضع الصيانة' : 'فتح المتجر'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="space-y-6 animate-in fade-in max-w-3xl">
              <h2 className="text-2xl font-black text-slate-900 mb-6">التسويق والإعلانات</h2>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2rem] text-white shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <Megaphone size={32} className="text-emerald-100" />
                  <h3 className="text-xl font-black">شريط الإعلانات العلوي</h3>
                </div>

                <input
                  type="text"
                  value={siteConfig.announcement}
                  onChange={(event) => setSiteConfig({ ...siteConfig, announcement: event.target.value })}
                  placeholder="مثال: توصيل مجاني هذا الأسبوع"
                  className="w-full p-4 rounded-xl bg-white/20 border border-white/30 text-white placeholder-emerald-200 font-bold outline-none focus:bg-white/30 transition-all mb-4"
                />

                <div className="flex gap-3">
                  <button onClick={() => showToast('تم تحديث شريط الإعلانات')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black shadow-lg">
                    حفظ الإعلان
                  </button>
                  <button
                    onClick={() => {
                      setSiteConfig({ ...siteConfig, announcement: '' });
                      showToast('تم إخفاء الإعلان');
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all border border-white/20"
                  >
                    إخفاء الإعلان
                  </button>
                </div>
              </div>

                            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-[2rem] space-y-6">
                <h3 className="text-xl font-black text-slate-900">كوبونات الخصم المتقدمة</h3>

                <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رمز الكوبون</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={couponForm.code}
                      onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })}
                      placeholder="WELCOME10"
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نسبة الخصم %</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={couponForm.discount}
                      onChange={(event) => setCouponForm({ ...couponForm, discount: clampDiscount(event.target.value) })}
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">عدد الاستخدامات المسموحة</label>
                    <input
                      type="number"
                      min="1"
                      value={couponForm.maxUses}
                      onChange={(event) => setCouponForm({ ...couponForm, maxUses: clampUses(event.target.value) })}
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الانتهاء (اختياري)</label>
                    <input
                      type="date"
                      value={couponForm.expiresAt}
                      onChange={(event) => setCouponForm({ ...couponForm, expiresAt: event.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black shadow-lg">
                      إنشاء كوبون
                    </button>
                    <button
                      type="button"
                      onClick={() => setCouponForm({ code: '', discount: 10, maxUses: 100, expiresAt: '' })}
                      className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold"
                    >
                      تفريغ الحقول
                    </button>
                  </div>
                </form>

                {adminCoupons.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm font-bold text-gray-400">
                    لا توجد كوبونات مضافة حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminCoupons.map((coupon) => {
                      const expired = isCouponExpired(coupon);
                      const exhausted = isCouponExhausted(coupon);
                      return (
                        <div key={coupon.id} className="rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-black text-slate-900" dir="ltr">{coupon.code}</p>
                            <p className="text-xs font-bold text-gray-500">خصم {coupon.discount}% • الاستخدام {coupon.usedCount}/{coupon.maxUses}</p>
                            {coupon.expiresAt && (
                              <p className="text-xs font-bold text-gray-500">ينتهي: {new Date(coupon.expiresAt).toLocaleDateString('ar-DZ')}</p>
                            )}
                            <p className={`text-xs font-black ${expired || exhausted ? 'text-red-600' : 'text-emerald-600'}`}>
                              {expired ? 'منتهي الصلاحية' : exhausted ? 'نفد الاستخدام' : 'فعّال'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold"
                          >
                            حذف
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Motion.div>
  );
};
export default function App() {
  const [currentRoute, setCurrentRoute] = useState(ROUTES.home);
  const [cart, dispatchCart] = useReducer(cartReducer, []);
  const [orders, setOrders] = useState(() => normalizeOrders(readStorage(STORAGE_KEYS.orders, [])));
  const [adminUser, setAdminUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(!auth);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [siteConfig, setSiteConfig] = useState(() => normalizeSiteConfig(readStorage(STORAGE_KEYS.siteConfig, {})));

  const [products, setProducts] = useState(() =>
    normalizeProducts(readStorage(STORAGE_KEYS.products, initialProductsData)),
  );

  const [favorites, setFavorites] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.favorites, []);
    return Array.isArray(stored) ? stored : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutPricing, setCheckoutPricing] = useState({ subtotal: 0, discount: 0, total: 0, couponCode: '', couponId: '' });
  const [isRemoteBootstrapped, setIsRemoteBootstrapped] = useState(false);
  const [syncStatus, setSyncStatus] = useState(hasFirebaseConfig ? 'syncing' : 'local');
  const [adminTheme, setAdminTheme] = useState(() => (readStorage(STORAGE_KEYS.adminTheme, 'light') === 'dark' ? 'dark' : 'light'));
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const cartAnimationTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const isAdminAuth = Boolean(adminUser);
  const isProductsLoading = hasFirebaseConfig && !isRemoteBootstrapped;

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrapRemoteData = async () => {
      if (!hasFirebaseConfig) {
        setIsRemoteBootstrapped(true);
        return;
      }

      try {
        const remoteData = await loadStoreBundle({
          products: normalizeProducts(readStorage(STORAGE_KEYS.products, initialProductsData)),
          orders: normalizeOrders(readStorage(STORAGE_KEYS.orders, [])),
          siteConfig: normalizeSiteConfig(readStorage(STORAGE_KEYS.siteConfig, {})),
        });
        if (!active) return;

        setProducts(normalizeProducts(remoteData.products));
        setOrders(normalizeOrders(remoteData.orders));
        setSiteConfig(normalizeSiteConfig(remoteData.siteConfig || {}));
        setSyncStatus('online');
      } catch {
        if (active) {
          setSyncStatus('local');
        }
      } finally {
        if (active) {
          setIsRemoteBootstrapped(true);
        }
      }
    };

    bootstrapRemoteData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.orders, orders);
  }, [orders]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.products, products);
  }, [products]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.siteConfig, siteConfig);
  }, [siteConfig]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.adminTheme, adminTheme);
  }, [adminTheme]);

  useEffect(() => () => {
    if (cartAnimationTimeoutRef.current) {
      window.clearTimeout(cartAnimationTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig || !isRemoteBootstrapped) return;

    let active = true;
    setSyncStatus('syncing');

    saveOrdersRemote(orders)
      .then(() => {
        if (active) setSyncStatus('online');
      })
      .catch(() => {
        if (active) setSyncStatus('local');
      });

    return () => {
      active = false;
    };
  }, [orders, isRemoteBootstrapped]);

  useEffect(() => {
    if (!hasFirebaseConfig || !isRemoteBootstrapped) return;

    let active = true;
    setSyncStatus('syncing');

    saveProductsRemote(products)
      .then(() => {
        if (active) setSyncStatus('online');
      })
      .catch(() => {
        if (active) setSyncStatus('local');
      });

    return () => {
      active = false;
    };
  }, [products, isRemoteBootstrapped]);

  useEffect(() => {
    if (!hasFirebaseConfig || !isRemoteBootstrapped) return;

    let active = true;
    setSyncStatus('syncing');

    saveSiteConfigRemote(siteConfig)
      .then(() => {
        if (active) setSyncStatus('online');
      })
      .catch(() => {
        if (active) setSyncStatus('local');
      });

    return () => {
      active = false;
    };
  }, [siteConfig, isRemoteBootstrapped]);

  const cartCount = cart.reduce((total, item) => total + item.qty, 0);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const navigateTo = (route) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const playUiSound = (type = 'success') => {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const tones = {
        add: [680, 920, 0.16],
        remove: [420, 220, 0.18],
        coupon: [760, 1040, 0.2],
        order: [520, 860, 0.24],
        success: [620, 900, 0.18],
      };

      const [startFreq, endFreq, duration] = tones[type] || tones.success;
      oscillator.type = type === 'remove' ? 'sawtooth' : 'triangle';
      oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration * 0.45);

      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.085, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration + 0.02);
    } catch {
      // optional enhancement only
    }
  };

  const triggerCartFeedback = () => {
    setIsCartAnimating(true);

    if (cartAnimationTimeoutRef.current) {
      window.clearTimeout(cartAnimationTimeoutRef.current);
    }

    cartAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsCartAnimating(false);
    }, 450);

    playUiSound('add');
  };

  const handleAddToCart = (item) => {
    dispatchCart({ type: 'ADD_ITEM', payload: item });
    triggerCartFeedback();
  };

  const handleRemoveFromCart = (item) => {
    dispatchCart({ type: 'REMOVE_ITEM', payload: item });
    playUiSound('remove');
    showToast('تم حذف المنتج من السلة', 'error');
  };

  const handleAdminLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      } else {
        setAdminUser(null);
      }
      showToast('تم تسجيل الخروج من لوحة الإدارة');
    } catch {
      showToast('تعذر تسجيل الخروج حالياً', 'error');
    }
  };

  const toggleFavorite = (productId) => {
    setFavorites((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [productId, ...previous],
    );
  };

  const sendOrderToTelegram = async (order) => {
    try {
      await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    } catch {
      // non-blocking notification
    }
  };

  const handleAddOrder = (customerData, cartItems, pricing) => {
    if (!cartItems.length) {
      showToast('السلة فارغة', 'error');
      return;
    }

    const subtotal = Number(pricing?.subtotal) || cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = Math.min(Number(pricing?.discount) || 0, subtotal);
    const totalPrice = Math.max(0, Number(pricing?.total) || subtotal - discount);

    const newOrder = {
      id: Date.now(),
      customer: customerData,
      items: cartItems,
      subtotal,
      discount,
      couponCode: pricing?.couponCode || '',
      couponId: pricing?.couponId || '',
      totalPrice,
      status: 'pending',
      date: new Date().toISOString(),
    };

    setOrders((previous) => [newOrder, ...previous]);
    sendOrderToTelegram(newOrder);

    setProducts((previousProducts) =>
      previousProducts.map((product) => {
        const orderedItem = cartItems.find((item) => item.id === product.id);
        if (!orderedItem) return product;

        return {
          ...product,
          stock: Math.max(0, clampStock(product.stock) - orderedItem.qty),
        };
      }),
    );

    if (pricing?.couponCode) {
      setSiteConfig((previousSiteConfig) => {
        const nextCoupons = normalizeCoupons(previousSiteConfig.coupons, previousSiteConfig.couponCode, previousSiteConfig.couponDiscount).map((coupon) => {
          const byId = pricing?.couponId && coupon.id === pricing.couponId;
          const byCode = normalizeCouponCode(coupon.code) === normalizeCouponCode(pricing.couponCode);
          if (!byId && !byCode) return coupon;
          return { ...coupon, usedCount: (Number(coupon.usedCount) || 0) + 1 };
        });

        return {
          ...previousSiteConfig,
          coupons: nextCoupons,
        };
      });
    }

    dispatchCart({ type: 'CLEAR' });
    setCheckoutPricing({ subtotal: 0, discount: 0, total: 0, couponCode: '', couponId: '' });
    playUiSound('order');
    showToast('تم إرسال طلبك بنجاح! شكراً لثقتك.', 'success');
    navigateTo(ROUTES.home);
  };

  if (!siteConfig.isOnline && currentRoute !== ROUTES.admin && !isAdminAuth) {
    return (
      <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');`}</style>
        <MaintenanceView siteName={siteConfig.name} onOpenAdmin={() => navigateTo(ROUTES.admin)} />
      </div>
    );
  }

  const isCheckoutOrAdmin = currentRoute === ROUTES.checkout || currentRoute === ROUTES.admin;

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-right selection:bg-emerald-200" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        body { font-family: 'Tajawal', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        input, select, button { -webkit-tap-highlight-color: transparent; }
        @keyframes cart-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          50% { transform: translateX(2px); }
          75% { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        .animate-cart-shake { animation: cart-shake 0.38s ease-in-out; }
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: skeleton-shimmer 1.2s infinite;
        }
      `}</style>

      <Toast toast={toast} />

      {currentRoute !== ROUTES.admin && (
        <>
          <AnnouncementBar text={siteConfig.announcement} />
          <DesktopNavbar
            currentRoute={currentRoute}
            navigateTo={navigateTo}
            cartCount={cartCount}
            isAdminAuth={isAdminAuth}
            isCartAnimating={isCartAnimating}
            onAdminLogout={handleAdminLogout}
            siteName={siteConfig.name}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            favoritesCount={favorites.length}
          />
          {currentRoute === ROUTES.home && <MobileHeader title={siteConfig.name} cartCount={cartCount} navigateTo={navigateTo} isCartAnimating={isCartAnimating} />}
          {currentRoute === ROUTES.offers && <MobileHeader title="العروض" cartCount={cartCount} navigateTo={navigateTo} isCartAnimating={isCartAnimating} />}
          {currentRoute === ROUTES.favorites && <MobileHeader title="المفضلة" cartCount={cartCount} navigateTo={navigateTo} isCartAnimating={isCartAnimating} />}
          {currentRoute === ROUTES.cart && <MobileHeader title="السلة" cartCount={cartCount} navigateTo={navigateTo} isCartAnimating={isCartAnimating} />}
        </>
      )}

      <main className="relative w-full">
        <AnimatePresence mode="wait">
          {(currentRoute === ROUTES.home || currentRoute === ROUTES.offers) && (
            <HomeView
              key={currentRoute}
              products={products}
              onAddToCart={handleAddToCart}
              showToast={showToast}
              syncStatus={syncStatus}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              orders={orders}
              isLoadingProducts={isProductsLoading}
              currentRoute={currentRoute}
              navigateTo={navigateTo}
            />
          )}

          {currentRoute === ROUTES.cart && (
            <CartView
              key="cart"
              cart={cart}
              dispatchCart={dispatchCart}
              navigateTo={navigateTo}
              siteConfig={siteConfig}
              showToast={showToast}
              setCheckoutPricing={setCheckoutPricing}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
              onCouponApplied={() => playUiSound('coupon')}
            />
          )}

          {currentRoute === ROUTES.favorites && (
            <FavoritesView
              key="favorites"
              products={products}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              onAddToCart={handleAddToCart}
              navigateTo={navigateTo}
              showToast={showToast}
            />
          )}

          {currentRoute === ROUTES.checkout && (
            <CheckoutView
              key="checkout"
              cart={cart}
              checkoutPricing={checkoutPricing}
              onAddOrder={handleAddOrder}
              navigateTo={navigateTo}
            />
          )}

          {currentRoute === ROUTES.admin && !isAuthReady && (
            <Motion.div key="auth-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[70vh] flex items-center justify-center">
              <div className="bg-white border border-slate-200 rounded-3xl px-8 py-6 shadow-sm text-center">
                <p className="text-slate-600 font-black">جاري التحقق من الجلسة...</p>
              </div>
            </Motion.div>
          )}

          {currentRoute === ROUTES.admin && isAuthReady && !isAdminAuth && (
            <AdminLogin key="login" showToast={showToast} onBackToStore={() => navigateTo(ROUTES.home)} />
          )}

          {currentRoute === ROUTES.admin && isAuthReady && isAdminAuth && (
            <AdminCMS
              key="admin"
              orders={orders}
              setOrders={setOrders}
              products={products}
              setProducts={setProducts}
              siteConfig={siteConfig}
              setSiteConfig={setSiteConfig}
              onLogout={async () => {
                await handleAdminLogout();
                navigateTo(ROUTES.home);
              }}
              adminUser={adminUser}
              syncStatus={syncStatus}
              adminTheme={adminTheme}
              setAdminTheme={setAdminTheme}
              showToast={showToast}
            />
          )}
        </AnimatePresence>
      </main>

      {currentRoute !== ROUTES.admin && <FloatingWhatsAppButton phoneNumber={siteConfig.whatsappNumber} />}
      {!isCheckoutOrAdmin && (
        <BottomNav currentRoute={currentRoute} navigateTo={navigateTo} cartCount={cartCount} isCartAnimating={isCartAnimating} favoritesCount={favorites.length} />
      )}
    </div>
  );
}
























































































































