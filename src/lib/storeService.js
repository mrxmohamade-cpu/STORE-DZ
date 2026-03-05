import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, hasFirebaseConfig } from './firebase';

const STORE_COLLECTION = 'store_data';
const STORE_DOCS = {
  products: 'products',
  orders: 'orders',
  siteConfig: 'site_config',
};

const getStoreDocRef = (docKey) => doc(db, STORE_COLLECTION, docKey);

const readRemotePart = async (docKey, fallback) => {
  if (!hasFirebaseConfig || !db) return fallback;

  try {
    const snapshot = await getDoc(getStoreDocRef(docKey));
    if (!snapshot.exists()) return fallback;

    const payload = snapshot.data()?.value;
    return payload ?? fallback;
  } catch {
    return fallback;
  }
};

const writeRemotePart = async (docKey, value) => {
  if (!hasFirebaseConfig || !db) return;

  await setDoc(
    getStoreDocRef(docKey),
    {
      value,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

const loadStoreBundle = async ({ products, orders, siteConfig }) => {
  const [remoteProducts, remoteOrders, remoteSiteConfig] = await Promise.all([
    readRemotePart(STORE_DOCS.products, products),
    readRemotePart(STORE_DOCS.orders, orders),
    readRemotePart(STORE_DOCS.siteConfig, siteConfig),
  ]);

  return {
    products: remoteProducts,
    orders: remoteOrders,
    siteConfig: remoteSiteConfig,
  };
};

const saveProductsRemote = async (products) => writeRemotePart(STORE_DOCS.products, products);
const saveOrdersRemote = async (orders) => writeRemotePart(STORE_DOCS.orders, orders);
const saveSiteConfigRemote = async (siteConfig) => writeRemotePart(STORE_DOCS.siteConfig, siteConfig);

const uploadProductImage = async (file) => {
  if (!(file instanceof File)) {
    throw new Error('A valid image file is required');
  }

  const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY?.trim();
  if (!imgbbApiKey) {
    throw new Error('ImgBB API key is missing. Set VITE_IMGBB_API_KEY');
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('name', `${Date.now()}-${file.name}`.replace(/\s+/g, '-').toLowerCase());

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ImgBB upload failed with status ${response.status}`);
  }

  const payload = await response.json();
  const imageUrl = payload?.data?.url;

  if (!payload?.success || !imageUrl) {
    throw new Error(payload?.error?.message || 'ImgBB did not return image URL');
  }

  return imageUrl;
};

export {
  hasFirebaseConfig,
  loadStoreBundle,
  saveOrdersRemote,
  saveProductsRemote,
  saveSiteConfigRemote,
  uploadProductImage,
};
