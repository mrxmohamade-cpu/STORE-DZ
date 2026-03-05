import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, hasFirebaseConfig, storage } from './firebase';

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
  if (!hasFirebaseConfig || !storage) {
    throw new Error('Firebase Storage is not configured');
  }

  const safeName = `${Date.now()}-${file.name}`.replace(/\s+/g, '-').toLowerCase();
  const imageRef = ref(storage, `products/${safeName}`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
};

export {
  hasFirebaseConfig,
  loadStoreBundle,
  saveOrdersRemote,
  saveProductsRemote,
  saveSiteConfigRemote,
  uploadProductImage,
};
