import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import algeriaCitiesData from './data/algeria_cities.json';
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
  CheckCircle,
  ChevronRight,
  CreditCard,
  Edit3,
  Filter,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Plus,
  Power,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';

const CATEGORIES = ['الكل', 'رجال', 'نساء', 'أحذية', 'إكسسوارات'];

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
};

const DEFAULT_SITE_CONFIG = {
  name: 'أناقة ستور',
  isOnline: true,
  announcement: '',
  couponCode: '',
  couponDiscount: 0,
};

const initialProductsData = [
  { id: 1, name: 'تيشيرت صيفي قطن', price: 2500, category: 'رجال', stock: 12, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80' },
  { id: 2, name: 'فستان كاجوال مريح', price: 4800, category: 'نساء', stock: 8, image: 'https://images.unsplash.com/photo-1515347619362-ec8cb9eb7a7a?auto=format&fit=crop&w=800&q=80' },
  { id: 3, name: 'حذاء رياضي يومي', price: 5500, category: 'أحذية', stock: 5, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80' },
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

const normalizeProducts = (items) => {
  if (!Array.isArray(items)) return initialProductsData;
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? Date.now() + index,
    price: Number(item.price) || 0,
    stock: clampStock(item.stock ?? 0),
  }));
};

const normalizeOrders = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    id: item.id ?? Date.now() + index,
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

      const existing = state.find((item) => item.id === action.payload.id);
      if (existing) {
        if (existing.qty >= stock) return state;
        return state.map((item) =>
          item.id === action.payload.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...state, { ...action.payload, qty: 1 }];
    }
    case 'REMOVE_ITEM':
      return state.filter((item) => item.id !== action.payload.id);
    case 'DECREASE':
      return state.map((item) =>
        item.id === action.payload.id && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item,
      );
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
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex justify-center pointer-events-none"
      >
        <div
          className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold text-white ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle size={18} />
          ) : (
            <CheckCircle size={18} className="text-emerald-400" />
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

const DesktopNavbar = ({
  currentRoute,
  navigateTo,
  cartCount,
  isAdminAuth,
  setAdminAuth,
  siteName,
  searchQuery,
  setSearchQuery,
  favoritesCount,
}) => (
  <div className="hidden md:block bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm transition-all">
    <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center gap-6">
      <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => navigateTo('home')}>
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
            if (currentRoute !== 'home') navigateTo('home');
          }}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="ابحث عن المنتجات..."
          className="w-full bg-gray-50 border border-gray-100 rounded-full py-3 pr-12 pl-4 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-bold"
        />
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigateTo('home')}
          className={`font-bold transition-colors ${
            currentRoute === 'home' ? 'text-emerald-600' : 'text-gray-600 hover:text-slate-900'
          }`}
        >
          الرئيسية
        </button>

        <button
          onClick={() => navigateTo('home')}
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

        <button onClick={() => navigateTo('cart')} className="relative p-2 text-gray-600 hover:text-slate-900 transition-colors">
          <ShoppingCart size={24} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
              {cartCount}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-gray-200" />

        {isAdminAuth ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo('admin')}
              className="text-sm font-bold bg-slate-100 text-slate-700 px-5 py-2.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              لوحة الإدارة
            </button>
            <button
              onClick={() => {
                setAdminAuth(false);
                navigateTo('home');
              }}
              className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigateTo('admin')}
            className="flex items-center gap-2 text-sm font-bold bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-colors shadow-md hover:shadow-lg"
          >
            <User size={16} /> تسجيل الدخول
          </button>
        )}
      </div>
    </div>
  </div>
);

const MobileHeader = ({ title, cartCount, navigateTo }) => (
  <header className="md:hidden bg-white/90 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 px-4 py-3 flex justify-between items-center h-16 shadow-sm">
    <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
    <button onClick={() => navigateTo('cart')} className="relative p-2 text-slate-600 bg-gray-50 rounded-full">
      <ShoppingCart size={20} />
      {cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
          {cartCount}
        </span>
      )}
    </button>
  </header>
);

const BottomNav = ({ currentRoute, navigateTo, cartCount }) => (
  <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 pb-safe pt-2 px-6 flex justify-between items-center z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
    <button
      onClick={() => navigateTo('home')}
      className={`flex flex-col items-center p-2 transition-colors ${currentRoute === 'home' ? 'text-emerald-600' : 'text-gray-400'}`}
    >
      <Home size={24} className={currentRoute === 'home' ? 'fill-emerald-50' : ''} />
      <span className="text-[10px] mt-1 font-bold">الرئيسية</span>
    </button>
    <button
      onClick={() => navigateTo('cart')}
      className={`flex flex-col items-center p-2 relative transition-colors ${
        currentRoute === 'cart' || currentRoute === 'checkout' ? 'text-emerald-600' : 'text-gray-400'
      }`}
    >
      <ShoppingBag size={24} className={currentRoute === 'cart' ? 'fill-emerald-50' : ''} />
      {cartCount > 0 && (
        <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">
          {cartCount}
        </span>
      )}
      <span className="text-[10px] mt-1 font-bold">السلة</span>
    </button>
    <button
      onClick={() => navigateTo('admin')}
      className={`flex flex-col items-center p-2 transition-colors ${currentRoute === 'admin' ? 'text-emerald-600' : 'text-gray-400'}`}
    >
      <User size={24} className={currentRoute === 'admin' ? 'fill-emerald-50' : ''} />
      <span className="text-[10px] mt-1 font-bold">حسابي</span>
    </button>
  </div>
);

const MaintenanceView = ({ siteName }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
    <Motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 max-w-md w-full"
    >
      <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <Power size={40} />
      </div>
      <h2 className="text-3xl font-black text-slate-900 mb-4">{siteName}</h2>
      <p className="text-lg font-bold text-gray-500 mb-8">المتجر حالياً في وضع الصيانة. سنعود قريباً جداً.</p>
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400 font-bold bg-gray-50 py-3 px-6 rounded-full w-fit mx-auto">
        <ShieldCheck size={16} /> جاري تحسين التجربة
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
  dispatchCart,
  showToast,
  searchQuery,
  setSearchQuery,
  favorites,
  toggleFavorite,
  orders,
}) => {
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [sortBy, setSortBy] = useState('newest');

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
      return inCategory && inSearch && inPrice;
    });

    switch (sortBy) {
      case 'price-low':
        return [...result].sort((a, b) => a.price - b.price);
      case 'price-high':
        return [...result].sort((a, b) => b.price - a.price);
      default:
        return [...result].sort((a, b) => Number(b.id) - Number(a.id));
    }
  }, [products, activeCategory, searchQuery, maxPrice, sortBy]);

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pb-24 md:pb-10 max-w-7xl mx-auto w-full">
      <div className="px-4 py-4 md:py-8">
        <div className="bg-slate-900 rounded-[2rem] p-8 md:p-16 text-white relative overflow-hidden shadow-2xl flex flex-col justify-center min-h-[200px] md:min-h-[360px]">
          <div className="relative z-10 max-w-2xl">
            <span className="bg-emerald-500 text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-full uppercase tracking-wider mb-4 inline-block shadow-lg shadow-emerald-500/30">
              توصيل لـ 58 ولاية
            </span>
            <h2 className="text-3xl md:text-6xl font-black mb-4 leading-tight">
              أحدث صيحات
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-300 to-teal-200">الموضة بين يديك</span>
            </h2>
            <p className="text-slate-300 text-sm md:text-xl font-medium">تسوق الآن وادفع عند الاستلام بكل أمان وسهولة.</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80"
            className="absolute left-0 top-0 w-2/3 md:w-1/2 h-full object-cover opacity-40 mix-blend-luminosity"
            alt="Banner"
          />
        </div>
      </div>

      {recentOrders.length > 0 && (
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
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
              activeCategory === category
                ? 'bg-slate-900 text-white shadow-md transform scale-105'
                : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="px-4 mb-3">
        <div className="bg-white border border-gray-100 rounded-3xl p-4 md:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
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
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 flex items-center justify-between text-xs md:text-sm mb-2">
        <p className="font-bold text-gray-500">{filteredProducts.length} منتج مطابق</p>
        <p className="font-bold text-gray-500">المفضلة: {favorites.length}</p>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold">
          <Package size={48} className="mx-auto mb-4 opacity-20" /> لا توجد منتجات بهذه المواصفات.
        </div>
      ) : (
        <div className="px-4 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => {
              const stock = clampStock(product.stock);
              const isFavorite = favorites.includes(product.id);

              return (
                <Motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                  className="group bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden flex flex-col shadow-sm hover:shadow-2xl transition-all duration-300"
                >
                  <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />

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

                    <div className="absolute bottom-2 left-2 right-2 md:opacity-0 md:translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (stock <= 0) {
                            showToast('المنتج غير متوفر حالياً', 'error');
                            return;
                          }
                          dispatchCart({ type: 'ADD_ITEM', payload: product });
                          showToast('تمت الإضافة للسلة');
                        }}
                        disabled={stock <= 0}
                        className={`w-full text-sm font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors active:scale-95 ${
                          stock <= 0
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-white/90 backdrop-blur text-slate-900 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <Plus size={18} />
                        <span className="hidden md:inline">{stock <= 0 ? 'غير متوفر' : 'أضف للسلة'}</span>
                        <span className="md:hidden">{stock <= 0 ? 'نفد' : 'أضف'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1">
                    <h3 className="font-bold text-slate-900 text-sm md:text-base mb-1 line-clamp-2">{product.name}</h3>
                    <p className="font-black text-emerald-600 text-lg md:text-xl mt-2">
                      {product.price} <span className="text-xs text-gray-400">د.ج</span>
                    </p>
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
const CartView = ({ cart, dispatchCart, navigateTo, siteConfig, showToast, setCheckoutPricing }) => {
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);

  const configuredCouponCode = (siteConfig.couponCode || '').trim().toLowerCase();
  const configuredCouponDiscount = clampDiscount(siteConfig.couponDiscount);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const activeCoupon =
    cart.length > 0 &&
    appliedCoupon &&
    configuredCouponCode &&
    configuredCouponDiscount > 0 &&
    activeCoupon.code.toLowerCase() === configuredCouponCode
      ? { ...appliedCoupon, discount: configuredCouponDiscount }
      : null;

  const discountValue = activeCoupon ? Math.round((subtotal * activeCoupon.discount) / 100) : 0;
  const total = Math.max(0, subtotal - discountValue);

  const applyCoupon = () => {
    if (!configuredCouponCode || configuredCouponDiscount <= 0) {
      showToast('لا يوجد كوبون مفعل حالياً', 'error');
      return;
    }

    if (couponInput.trim().toLowerCase() !== configuredCouponCode) {
      showToast('كود الخصم غير صحيح', 'error');
      return;
    }

    setAppliedCoupon({ code: siteConfig.couponCode.trim().toUpperCase(), discount: configuredCouponDiscount });
    showToast(`تم تطبيق خصم ${configuredCouponDiscount}% بنجاح`);
  };

  return (
    <Motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
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
            onClick={() => navigateTo('home')}
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
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.id}
                    className="bg-white p-3 md:p-6 rounded-2xl flex gap-4 shadow-sm border border-gray-100"
                  >
                    <img src={item.image} alt={item.name} className="w-24 h-28 md:w-32 md:h-32 object-cover rounded-xl bg-gray-50" />
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm md:text-lg line-clamp-2 mb-1">{item.name}</h3>
                          <p className="font-black text-emerald-600 text-lg mt-2">{item.price} د.ج</p>
                        </div>
                        <button
                          onClick={() => dispatchCart({ type: 'REMOVE_ITEM', payload: item })}
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
                            dispatchCart({ type: 'ADD_ITEM', payload: item });
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
                {activeCoupon && (
                  <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center justify-between">
                    <span>تم تطبيق {activeCoupon.code}</span>
                    <button
                      onClick={() => {
                        setAppliedCoupon(null);
                        showToast('تم إلغاء الكوبون');
                      }}
                      className="text-rose-500"
                    >
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
                  });
                  navigateTo('checkout');
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
    });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Package size={70} className="text-gray-300 mb-4" />
        <p className="text-2xl font-black text-slate-900 mb-2">لا يوجد منتجات للشراء</p>
        <p className="text-gray-500 font-bold mb-6">أضف منتجات أولاً ثم عد لإتمام الطلب.</p>
        <button onClick={() => navigateTo('home')} className="bg-slate-900 text-white px-8 py-4 rounded-full font-bold">
          العودة للتسوق
        </button>
      </div>
    );
  }

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-24 min-h-screen bg-white max-w-4xl mx-auto w-full md:pt-12">
      <div className="hidden md:flex items-center gap-3 mb-8 px-6">
        <button onClick={() => navigateTo('cart')} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-slate-600 rotate-180">
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

const AdminLogin = ({ setAdminAuth, showToast }) => {
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 w-full max-w-sm text-center">
        <ShieldCheck size={48} className="mx-auto text-slate-900 mb-6" />
        <h2 className="text-2xl font-black mb-6">تسجيل الدخول للإدارة</h2>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center text-xl font-bold tracking-[0.5em] mb-4 outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          onClick={() => {
            if (password === 'admin123') {
              setAdminAuth(true);
              showToast('تم الدخول للإدارة');
            } else {
              showToast('كلمة سر خاطئة', 'error');
            }
          }}
          className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg"
        >
          فتح النظام
        </button>
      </div>
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
  setAdminAuth,
  showToast,
  syncStatus,
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', category: CATEGORIES[1], image: '', stock: 10 });
  const [productQuery, setProductQuery] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const handleSaveProduct = (event) => {
    event.preventDefault();

    const normalizedProduct = {
      ...productForm,
      name: productForm.name.trim(),
      image: productForm.image.trim(),
      price: Number(productForm.price) || 0,
      stock: clampStock(productForm.stock),
    };

    if (!normalizedProduct.name || !normalizedProduct.image || normalizedProduct.price <= 0) {
      showToast('أدخل بيانات منتج صحيحة', 'error');
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
    setProductForm({ name: '', price: '', category: CATEGORIES[1], image: '', stock: 10 });
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

    if (!hasFirebaseConfig) {
      showToast('فعّل إعدادات Firebase أولاً ثم أعد رفع الصورة', 'error');
      return;
    }

    try {
      setUploadingImage(true);
      const imageUrl = await uploadProductImage(file);
      setProductForm((prev) => ({ ...prev, image: imageUrl }));
      showToast('تم رفع الصورة إلى Firebase بنجاح');
    } catch {
      showToast('فشل رفع الصورة إلى Firebase', 'error');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleOrderStatusChange = (orderId, nextStatus) => {
    setOrders(
      orders.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order)),
    );
    showToast('تم تحديث حالة الطلب');
  };

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24 md:pb-10 min-h-screen bg-white">
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-40">
        <h1 className="text-xl font-black flex items-center gap-2">
          <ShieldCheck /> لوحة التحكم المركزية
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={`hidden md:flex px-3 py-1 rounded-full text-xs font-bold ${
              siteConfig.isOnline
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
            }`}
          >
            {siteConfig.isOnline ? 'المتجر مفتوح' : 'وضع الصيانة'}
          </span>
          <span
            className={`hidden md:flex px-3 py-1 rounded-full text-xs font-bold border ${
              syncStatus === 'online'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-500/20 text-slate-200 border-slate-400/40'
            }`}
          >
            {syncStatus === 'online' ? 'Firebase متصل' : syncStatus === 'syncing' ? 'جاري المزامنة' : 'وضع محلي'}
          </span>
          <button
            onClick={() => setAdminAuth(false)}
            className="bg-white/10 hover:bg-red-500 hover:text-white p-2 rounded-full transition-all text-slate-300"
            title="خروج"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row mt-6 md:mt-10 px-4 md:px-6 gap-6 md:gap-10">
        <div className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-2 md:pb-0 border-b md:border-b-0 border-gray-100 md:w-72 md:border-l shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 md:py-4 rounded-xl md:rounded-r-none md:rounded-l-2xl whitespace-nowrap transition-colors font-bold ${
              activeTab === 'dashboard' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard size={20} /> نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-3 px-4 py-3 md:py-4 rounded-xl md:rounded-r-none md:rounded-l-2xl whitespace-nowrap transition-colors font-bold ${
              activeTab === 'orders' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart size={20} /> إدارة الطلبات
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-3 px-4 py-3 md:py-4 rounded-xl md:rounded-r-none md:rounded-l-2xl whitespace-nowrap transition-colors font-bold ${
              activeTab === 'products' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Store size={20} /> إدارة المنتجات
          </button>
          <button
            onClick={() => setActiveTab('marketing')}
            className={`flex items-center gap-3 px-4 py-3 md:py-4 rounded-xl md:rounded-r-none md:rounded-l-2xl whitespace-nowrap transition-colors font-bold ${
              activeTab === 'marketing' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Megaphone size={20} /> التسويق والإعلانات
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 md:py-4 rounded-xl md:rounded-r-none md:rounded-l-2xl whitespace-nowrap transition-colors font-bold ${
              activeTab === 'settings' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Settings size={20} /> إعدادات المتجر
          </button>
        </div>

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

              <div className="mt-8">
                <h3 className="font-black text-lg mb-4">أحدث الطلبات</h3>
                {orders.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 font-bold">
                    لا يوجد طلبات حالياً
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="bg-white border border-gray-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-shadow"
                      >
                        <div>
                          <p className="font-black text-slate-900 text-lg">{order.customer.name}</p>
                          <p className="text-sm text-gray-500 mt-1 font-bold">{order.customer.wilaya_name || order.customer.wilaya} • {order.customer.phone}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(order.date).toLocaleString('ar-DZ')}</p>
                        </div>
                        <div className="flex flex-col md:items-end gap-2">
                          <OrderStatusPill status={order.status} />
                          <p className="font-black text-emerald-600 text-xl">{order.totalPrice} د.ج</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                            <div key={`${order.id}-${item.id}`} className="flex items-center justify-between text-sm font-bold text-slate-700">
                              <span>{item.name}</span>
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
                    setProductForm({ name: '', price: '', category: CATEGORIES[1], image: '', stock: 10 });
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

              {showProductForm ? (
                <form onSubmit={handleSaveProduct} className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-gray-200">
                  <h3 className="font-black text-xl mb-6">{editingProduct ? 'تعديل المنتج' : 'نشر منتج جديد'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
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
                      <label className="block text-sm font-bold mb-2">السعر (د.ج)</label>
                      <input
                        required
                        type="number"
                        min="1"
                        value={productForm.price}
                        onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                        className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                      <label className="block text-xs font-bold text-gray-500 mt-3 mb-2">أو ارفع صورة مباشرة (Firebase Storage)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadProductImage}
                        disabled={uploadingImage || !hasFirebaseConfig}
                        className="w-full p-2 rounded-xl border border-dashed border-gray-300 bg-white text-xs font-bold"
                      />
                      {!hasFirebaseConfig && (
                        <p className="text-[11px] text-orange-600 font-bold mt-1">اربط Firebase عبر env لتفعيل رفع الصور.</p>
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
                        <img src={product.image} className="w-full h-40 object-cover bg-gray-50" alt={product.name} />
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setProductForm({ ...product, stock: clampStock(product.stock) });
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
                <h3 className="text-xl font-black text-slate-900">كوبونات الخصم</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">كود الخصم</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={siteConfig.couponCode}
                      onChange={(event) =>
                        setSiteConfig({
                          ...siteConfig,
                          couponCode: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="WELCOME10"
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نسبة الخصم %</label>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={siteConfig.couponDiscount}
                      onChange={(event) =>
                        setSiteConfig({
                          ...siteConfig,
                          couponDiscount: clampDiscount(event.target.value),
                        })
                      }
                      className="w-full p-3 rounded-xl border border-gray-300 font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => showToast('تم حفظ إعدادات الكوبون')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black shadow-lg">
                    حفظ الكوبون
                  </button>
                  <button
                    onClick={() => {
                      setSiteConfig({ ...siteConfig, couponCode: '', couponDiscount: 0 });
                      showToast('تم إيقاف الكوبون');
                    }}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold"
                  >
                    تعطيل الكوبون
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Motion.div>
  );
};
export default function App() {
  const [currentRoute, setCurrentRoute] = useState('home');
  const [cart, dispatchCart] = useReducer(cartReducer, []);
  const [orders, setOrders] = useState(() => normalizeOrders(readStorage(STORAGE_KEYS.orders, [])));
  const [isAdminAuth, setAdminAuth] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [siteConfig, setSiteConfig] = useState(() => ({
    ...DEFAULT_SITE_CONFIG,
    ...readStorage(STORAGE_KEYS.siteConfig, {}),
  }));

  const [products, setProducts] = useState(() =>
    normalizeProducts(readStorage(STORAGE_KEYS.products, initialProductsData)),
  );

  const [favorites, setFavorites] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.favorites, []);
    return Array.isArray(stored) ? stored : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutPricing, setCheckoutPricing] = useState({ subtotal: 0, discount: 0, total: 0, couponCode: '' });
  const [isRemoteBootstrapped, setIsRemoteBootstrapped] = useState(false);
  const [syncStatus, setSyncStatus] = useState(hasFirebaseConfig ? 'syncing' : 'local');

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
          siteConfig: { ...DEFAULT_SITE_CONFIG, ...readStorage(STORAGE_KEYS.siteConfig, {}) },
        });
        if (!active) return;

        setProducts(normalizeProducts(remoteData.products));
        setOrders(normalizeOrders(remoteData.orders));
        setSiteConfig({
          ...DEFAULT_SITE_CONFIG,
          ...(remoteData.siteConfig || {}),
        });
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

    dispatchCart({ type: 'CLEAR' });
    setCheckoutPricing({ subtotal: 0, discount: 0, total: 0, couponCode: '' });
    showToast('تم إرسال طلبك بنجاح! شكراً لثقتك.');
    navigateTo('home');
  };

  if (!siteConfig.isOnline && currentRoute !== 'admin' && !isAdminAuth) {
    return (
      <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');`}</style>
        <MaintenanceView siteName={siteConfig.name} />
        <button
          onClick={() => navigateTo('admin')}
          className="fixed bottom-4 left-4 p-4 opacity-10 hover:opacity-100 transition-opacity bg-slate-900 text-white rounded-full"
        >
          <ShieldCheck size={20} />
        </button>
      </div>
    );
  }

  const isCheckoutOrAdmin = currentRoute === 'checkout' || currentRoute === 'admin';

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-right selection:bg-emerald-200" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        body { font-family: 'Tajawal', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
        input, select, button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <Toast toast={toast} />

      {currentRoute !== 'admin' && (
        <>
          <AnnouncementBar text={siteConfig.announcement} />
          <DesktopNavbar
            currentRoute={currentRoute}
            navigateTo={navigateTo}
            cartCount={cartCount}
            isAdminAuth={isAdminAuth}
            setAdminAuth={setAdminAuth}
            siteName={siteConfig.name}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            favoritesCount={favorites.length}
          />
          {currentRoute === 'home' && <MobileHeader title={siteConfig.name} cartCount={cartCount} navigateTo={navigateTo} />}
          {currentRoute === 'cart' && <MobileHeader title="السلة" cartCount={cartCount} navigateTo={navigateTo} />}
        </>
      )}

      <main className="relative w-full">
        <AnimatePresence mode="wait">
          {currentRoute === 'home' && (
            <HomeView
              key="home"
              products={products}
              dispatchCart={dispatchCart}
              showToast={showToast}
              syncStatus={syncStatus}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              orders={orders}
            />
          )}

          {currentRoute === 'cart' && (
            <CartView
              key="cart"
              cart={cart}
              dispatchCart={dispatchCart}
              navigateTo={navigateTo}
              siteConfig={siteConfig}
              showToast={showToast}
              setCheckoutPricing={setCheckoutPricing}
            />
          )}

          {currentRoute === 'checkout' && (
            <CheckoutView
              key="checkout"
              cart={cart}
              checkoutPricing={checkoutPricing}
              onAddOrder={handleAddOrder}
              navigateTo={navigateTo}
            />
          )}

          {currentRoute === 'admin' && !isAdminAuth && (
            <AdminLogin key="login" setAdminAuth={setAdminAuth} showToast={showToast} />
          )}

          {currentRoute === 'admin' && isAdminAuth && (
            <AdminCMS
              key="admin"
              orders={orders}
              setOrders={setOrders}
              products={products}
              setProducts={setProducts}
              siteConfig={siteConfig}
              setSiteConfig={setSiteConfig}
              setAdminAuth={setAdminAuth}
              showToast={showToast}
            />
          )}
        </AnimatePresence>
      </main>

      {!isCheckoutOrAdmin && (
        <BottomNav currentRoute={currentRoute} navigateTo={navigateTo} cartCount={cartCount} />
      )}
    </div>
  );
}





















