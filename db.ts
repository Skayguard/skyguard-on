import { Recording } from './types';

const DB_NAME = 'VigilanteDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Isso é para evitar a abertura de múltiplas conexões
let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Erro no IndexedDB:', event);
      reject('Erro ao abrir o IndexedDB.');
      dbPromise = null; // Resetar a promessa em caso de erro
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
};

export const addRecordingToDB = async (recording: Omit<Recording, 'videoUrl' | 'id'> & { id: string }, videoBlob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const storedObject = { ...recording, videoBlob };
    const request = store.put(storedObject);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getRecordingsFromDB = async (): Promise<Recording[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    transaction.oncomplete = () => {
      const results = request.result;
      const recordingsWithUrls: Recording[] = results.map(rec => ({
          ...rec,
          videoBlob: undefined, // Não manter o blob na memória após criar a URL
          videoUrl: URL.createObjectURL(rec.videoBlob)
      }));
      // Mostrar os mais novos primeiro
      resolve(recordingsWithUrls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteRecordingFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
