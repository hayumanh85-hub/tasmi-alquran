/* Data SDK backed by Firebase Firestore for real-time synchronization of all collections. */
(function () {
  if (window.dataSdk) return;

  // Firebase Configuration
  const firebaseConfig = { 
    apiKey: "AIzaSyCt8OgF8TPWnDp-wqYEG5kxhN_bsJcldXc", 
    authDomain: "tasmi-alquran-app.firebaseapp.com", 
    projectId: "tasmi-alquran-app", 
    storageBucket: "tasmi-alquran-app.firebasestorage.app", 
    messagingSenderId: "951122307444", 
    appId: "1:951122307444:web:13fcd7cca810670629e421", 
    measurementId: "G-6QRFEFQZ9Q" 
  }; 

  // Initialize Firebase (Compat mode)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const db = firebase.firestore();
  const storage = firebase.storage();

  const unsubscribers = new Map();

  window.dataSdk = {
    /**
     * @param {string} collectionName - Nama koleksi (e.g., 'registrations', 'students', 'schedules')
     * @param {Object} handler - Object dengan fungsi onDataChanged
     */
    async subscribe(collectionName, handler) {
      // Stop existing listener for this collection if any
      if (unsubscribers.has(collectionName)) {
        unsubscribers.get(collectionName)();
      }

      const unsub = db.collection(collectionName)
        .onSnapshot((snapshot) => {
          const data = [];
          snapshot.forEach((doc) => {
            data.push({ ...doc.data(), id: doc.id });
          });
          if (handler && typeof handler.onDataChanged === 'function') {
            handler.onDataChanged(data);
          }
        }, (error) => {
          console.error(`Firestore Subscription Error [${collectionName}]:`, error);
        });

      unsubscribers.set(collectionName, unsub);
      return { isOk: true };
    },

    /**
     * Upload a file to Firebase Storage
     * @param {string} path - Storage path (e.g., 'certificates/student_id.png')
     * @param {string} base64OrBlob - Base64 data string or Blob object
     * @returns {Promise<{isOk: boolean, url?: string, error?: string}>}
     */
    async uploadFile(path, base64OrBlob) {
      try {
        const ref = storage.ref().child(path);
        let task;
        if (typeof base64OrBlob === 'string' && base64OrBlob.startsWith('data:')) {
          task = ref.putString(base64OrBlob, 'data_url');
        } else {
          task = ref.put(base64OrBlob);
        }
        const snapshot = await task;
        const url = await snapshot.ref.getDownloadURL();
        return { isOk: true, url };
      } catch (error) {
        console.error(`Firebase Storage Upload Error [${path}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    /**
     * Delete a file from Firebase Storage
     * @param {string} path - Storage path
     * @returns {Promise<{isOk: boolean, error?: string}>}
     */
    async removeFile(path) {
      try {
        await storage.ref().child(path).delete();
        return { isOk: true };
      } catch (error) {
        console.error(`Firebase Storage Remove Error [${path}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async create(collectionName, record) {
      try {
        const docId = record.id || `${collectionName.substring(0,3).toUpperCase()}-${Date.now()}`;
        await db.collection(collectionName).doc(docId).set({
          ...record,
          id: docId,
          created_at: record.created_at || new Date().toISOString()
        });
        return { isOk: true, id: docId };
      } catch (error) {
        console.error(`Firestore Create Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async update(collectionName, id, partial) {
      try {
        await db.collection(collectionName).doc(id).update(partial || {});
        return { isOk: true };
      } catch (error) {
        console.error(`Firestore Update Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async remove(collectionName, id) {
      try {
        await db.collection(collectionName).doc(id).delete();
        return { isOk: true };
      } catch (error) {
        console.error(`Firestore Remove Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async list(collectionName) {
      try {
        const snapshot = await db.collection(collectionName).get();
        const data = [];
        snapshot.forEach(doc => data.push({ ...doc.data(), id: doc.id }));
        return { isOk: true, value: data };
      } catch (error) {
        console.error(`Firestore List Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async set(collectionName, id, data) {
      try {
        await db.collection(collectionName).doc(id).set(data);
        return { isOk: true };
      } catch (error) {
        console.error(`Firestore Set Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    },

    async get(collectionName, id) {
      try {
        const doc = await db.collection(collectionName).doc(id).get();
        if (doc.exists) {
          return { isOk: true, value: doc.data() };
        }
        return { isOk: false, error: 'Not found' };
      } catch (error) {
        console.error(`Firestore Get Error [${collectionName}]:`, error);
        return { isOk: false, error: error.message };
      }
    }
  };
})();
