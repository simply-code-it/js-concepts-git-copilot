// Of course! Here are comprehensive coding interview questions on Client-Side Storage for React.js production-grade frontend development, organized by topic and difficulty.

// ## 🍪 Cookies

// ### **Q1: How do cookies differ from other client storage mechanisms?**

// **What the interviewer wants to know:** Your understanding of cookies' unique characteristics and use cases.

// **Answer:**
// Key differences:
// 1. Automatic sending with HTTP requests
// 2. Size limits (~4KB)
// 3. Server-readable
// 4. Expiration control
// 5. Domain/path restrictions

// Production React example:
const useAuthCookie = () => {
    const setAuthCookie = (token, expiresInDays = 7) => {
        const expires = new Date();
        expires.setDate(expires.getDate() + expiresInDays);
        
        document.cookie = `authToken=${token}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
    };

    const getAuthCookie = () => {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith('authToken='))
            ?.split('=')[1];
    };

    return { setAuthCookie, getAuthCookie };
};

// ### **Q2: Implement a secure cookie management hook for authentication**

// **What the interviewer wants to know:** You understand security best practices.

// Production-grade cookie hook
const useSecureCookies = () => {
    const setCookie = (name, value, options = {}) => {
        const {
            expires = 7, // days
            path = '/',
            secure = true,
            sameSite = 'strict'
        } = options;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expires);

        const cookieValue = encodeURIComponent(value);
        let cookie = `${name}=${cookieValue}; expires=${expiryDate.toUTCString()}; path=${path}`;
        
        if (secure) cookie += '; secure';
        if (sameSite) cookie += `; samesite=${sameSite}`;

        document.cookie = cookie;
    };

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    };

    const deleteCookie = (name, path = '/') => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
    };

    return { setCookie, getCookie, deleteCookie };
};

// Usage in component
const AuthComponent = () => {
    const { setCookie, getCookie, deleteCookie } = useSecureCookies();
    
    const handleLogin = (token) => {
        setCookie('authToken', token, { expires: 7, secure: true });
        setCookie('userSession', 'active', { expires: 1 });
    };
    
    const handleLogout = () => {
        deleteCookie('authToken');
        deleteCookie('userSession');
    };
};

// ## 💾 Local Storage

// ### **Q3: Create a generic localStorage hook with error handling and serialization**

// **What the interviewer wants to know:** You can build robust storage utilities.

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            if (typeof window === 'undefined') return initialValue;
            
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            if (typeof window === 'undefined') return;
            
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    };

    const removeValue = () => {
        try {
            if (typeof window === 'undefined') return;
            
            window.localStorage.removeItem(key);
            setStoredValue(undefined);
        } catch (error) {
            console.error(`Error removing localStorage key "${key}":`, error);
        }
    };

    return [storedValue, setValue, removeValue];
};

// Production usage examples
const UserPreferences = () => {
    const [theme, setTheme] = useLocalStorage('theme', 'light');
    const [userSettings, setUserSettings] = useLocalStorage('user-settings', {
        notifications: true,
        language: 'en',
        itemsPerPage: 25
    });

    const updateSettings = (updates) => {
        setUserSettings(prev => ({ ...prev, ...updates }));
    };

    return (
        <div>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                Toggle Theme
            </button>
            <pre>{JSON.stringify(userSettings, null, 2)}</pre>
        </div>
    );
};

// ### **Q4: Implement a localStorage manager with expiration**

// **What the interviewer wants to know:** You understand storage limitations and can implement TTL.

class LocalStorageManager {
    constructor() {
        this.prefix = 'app_';
    }

    set(key, value, ttl = null) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                ...(ttl && { expires: Date.now() + ttl })
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            return true;
        } catch (error) {
            console.error('LocalStorage set error:', error);
            this.handleQuotaExceeded(error);
            return false;
        }
    }

    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return null;

            const parsed = JSON.parse(item);
            
            // Check expiration
            if (parsed.expires && Date.now() > parsed.expires) {
                this.remove(key);
                return null;
            }

            return parsed.value;
        } catch (error) {
            console.error('LocalStorage get error:', error);
            return null;
        }
    }

    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    clear() {
        Object.keys(localStorage)
            .filter(key => key.startsWith(this.prefix))
            .forEach(key => localStorage.removeItem(key));
    }

    handleQuotaExceeded(error) {
        if (error.name === 'QuotaExceededError') {
            // Clear expired items first
            this.clearExpired();
            
            // If still full, clear oldest items
            const keys = Object.keys(localStorage)
                .filter(key => key.startsWith(this.prefix))
                .map(key => ({
                    key,
                    timestamp: JSON.parse(localStorage.getItem(key))?.timestamp || 0
                }))
                .sort((a, b) => a.timestamp - b.timestamp);

            // Remove oldest 25% of items
            const removeCount = Math.ceil(keys.length * 0.25);
            keys.slice(0, removeCount).forEach(item => {
                localStorage.removeItem(item.key);
            });
        }
    }

    clearExpired() {
        Object.keys(localStorage)
            .filter(key => key.startsWith(this.prefix))
            .forEach(key => {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item.expires && Date.now() > item.expires) {
                        localStorage.removeItem(key);
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            });
    }
}

// React hook using the manager
const useAdvancedLocalStorage = (key, initialValue, ttl = null) => {
    const manager = useMemo(() => new LocalStorageManager(), []);
    const [value, setValue] = useState(() => manager.get(key) ?? initialValue);

    const setStoredValue = useCallback((newValue) => {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        setValue(valueToStore);
        manager.set(key, valueToStore, ttl);
    }, [key, value, ttl, manager]);

    return [value, setStoredValue];
};

// ## 🔐 Session Storage

// ### **Q5: When should you use sessionStorage over localStorage?**

// **What the interviewer wants to know:** You understand the specific use cases for session storage.

// Session Storage Hook for tab-specific data
const useSessionStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.sessionStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Error reading sessionStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error setting sessionStorage key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
};

// Production use cases:
const ShoppingCart = () => {
    // Session storage: cart persists per tab but not across tabs
    const [cart, setCart] = useSessionStorage('shopping-cart', []);
    
    // Form data that should survive refresh but not persist long-term
    const [formData, setFormData] = useSessionStorage('multi-step-form', {});

    const addToCart = (product) => {
        setCart(prev => [...prev, { ...product, addedAt: new Date().toISOString() }]);
    };

    return (
        <div>
            <h3>Cart Items: {cart.length}</h3>
            {/* Cart content */}
        </div>
    );
};

// Tab-specific configuration
const useTabConfig = () => {
    const [tabSettings, setTabSettings] = useSessionStorage('tab-config', {
        sortBy: 'name',
        viewMode: 'grid',
        filters: {}
    });

    return { tabSettings, setTabSettings };
};

// ### **Q6: Implement a multi-tab communication system using storage events**

// **What the interviewer wants to know:** You can handle cross-tab communication.

const useCrossTabState = (key, initialValue) => {
    const [state, setState] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === key && event.newValue) {
                try {
                    setState(JSON.parse(event.newValue));
                } catch (error) {
                    console.error('Error parsing cross-tab storage:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key]);

    const setValue = useCallback((value) => {
        const valueToStore = value instanceof Function ? value(state) : value;
        setState(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
    }, [key, state]);

    return [state, setValue];
};

// Usage: Shared authentication state across tabs
const useSharedAuth = () => {
    const [auth, setAuth] = useCrossTabState('shared-auth', { isLoggedIn: false, user: null });

    const login = (userData) => {
        setAuth({ isLoggedIn: true, user: userData });
    };

    const logout = () => {
        setAuth({ isLoggedIn: false, user: null });
    };

    return { auth, login, logout };
};

// ## 🗄️ IndexedDB

// ### **Q7: Create a React hook for IndexedDB operations**

// **What the interviewer wants to know:** You can work with complex client-side databases.

const useIndexedDB = (databaseName, version = 1) => {
    const [db, setDb] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const initDB = async () => {
            try {
                const request = indexedDB.open(databaseName, version);
                
                request.onerror = () => {
                    if (mounted) {
                        setError(request.error);
                        setIsLoading(false);
                    }
                };

                request.onsuccess = () => {
                    if (mounted) {
                        setDb(request.result);
                        setIsLoading(false);
                    }
                };

                request.onupgradeneeded = (event) => {
                    const database = event.target.result;
                    
                    // Create object stores
                    if (!database.objectStoreNames.contains('users')) {
                        const store = database.createObjectStore('users', { keyPath: 'id' });
                        store.createIndex('email', 'email', { unique: true });
                    }
                    
                    if (!database.objectStoreNames.contains('documents')) {
                        const store = database.createObjectStore('documents', { keyPath: 'id' });
                        store.createIndex('userId', 'userId', { unique: false });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                };
            } catch (err) {
                if (mounted) {
                    setError(err);
                    setIsLoading(false);
                }
            }
        };

        initDB();

        return () => {
            mounted = false;
            if (db) {
                db.close();
            }
        };
    }, [databaseName, version]);

    const add = useCallback(async (storeName, data) => {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('Database not initialized'));
            
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    const get = useCallback(async (storeName, key) => {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('Database not initialized'));
            
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    const getAll = useCallback(async (storeName, indexName, range) => {
        return new Promise((resolve, reject) => {
            if (!db) return reject(new Error('Database not initialized'));
            
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = indexName ? store.index(indexName) : null;
            const request = index ? index.getAll(range) : store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, [db]);

    return { db, error, isLoading, add, get, getAll };
};

// Production usage for offline-first app
const OfflineDataManager = () => {
    const { add, get, getAll, isLoading } = useIndexedDB('MyApp', 2);

    const cacheUserData = async (userData) => {
        try {
            await add('users', {
                id: userData.id,
                ...userData,
                cachedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to cache user data:', error);
        }
    };

    const getCachedDocuments = async (userId) => {
        try {
            return await getAll('documents', 'userId', IDBKeyRange.only(userId));
        } catch (error) {
            console.error('Failed to get cached documents:', error);
            return [];
        }
    };

    if (isLoading) return <div>Loading database...</div>;

    return (
        <div>
            {/* Offline data management UI */}
        </div>
    );
};

// ### **Q8: Implement an offline-first data synchronization strategy**

// **What the interviewer wants to know:** You understand complex data synchronization patterns.

class OfflineSyncManager {
    constructor() {
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    async queueOperation(operation) {
        this.syncQueue.push({
            id: this.generateId(),
            operation,
            timestamp: Date.now(),
            retries: 0
        });

        await this.saveQueueToStorage();
        
        if (this.isOnline) {
            this.processQueue();
        }
    }

    async processQueue() {
        while (this.syncQueue.length > 0 && this.isOnline) {
            const operation = this.syncQueue[0];
            
            try {
                await this.executeOperation(operation);
                this.syncQueue.shift();
                await this.saveQueueToStorage();
            } catch (error) {
                console.error('Sync operation failed:', error);
                operation.retries++;
                
                if (operation.retries >= 3) {
                    // Move to failed operations
                    this.moveToFailed(operation);
                    this.syncQueue.shift();
                    await this.saveQueueToStorage();
                } else {
                    // Exponential backoff
                    await this.delay(Math.pow(2, operation.retries) * 1000);
                }
            }
        }
    }

    async executeOperation(operation) {
        // Execute the stored operation
        switch (operation.type) {
            case 'CREATE_USER':
                return await api.createUser(operation.data);
            case 'UPDATE_DOCUMENT':
                return await api.updateDocument(operation.data);
            case 'DELETE_ITEM':
                return await api.deleteItem(operation.data.id);
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }

    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleOnline() {
        this.isOnline = true;
        this.processQueue();
    }

    handleOffline() {
        this.isOnline = false;
    }

    async saveQueueToStorage() {
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    }

    loadQueueFromStorage() {
        const stored = localStorage.getItem('syncQueue');
        if (stored) {
            this.syncQueue = JSON.parse(stored);
        }
    }
}

// React hook using the sync manager
const useOfflineSync = () => {
    const syncManager = useRef(new OfflineSyncManager());
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        syncManager.current.loadQueueFromStorage();
    }, []);

    const syncOperation = async (type, data) => {
        setIsSyncing(true);
        try {
            await syncManager.current.queueOperation({ type, data });
        } finally {
            setIsSyncing(false);
        }
    };

    return { syncOperation, isSyncing };
};

// ## 🎯 Advanced Scenario Questions

// ### **Q9: Design a storage strategy for a large-scale React application**

// **What the interviewer wants to know:** You can architect comprehensive storage solutions.

class StorageStrategy {
    constructor() {
        this.strategies = {
            SESSION: 'session',
            LOCAL: 'local', 
            INDEXED_DB: 'indexed_db',
            COOKIE: 'cookie'
        };
    }

    getStorageMethod(key, data) {
        const size = new Blob([JSON.stringify(data)]).size;
        
        if (key.includes('auth') || key.includes('token')) {
            return this.strategies.COOKIE; // Security-sensitive data
        } else if (size > 5000000) { // 5MB
            return this.strategies.INDEXED_DB; // Large data
        } else if (key.includes('tab-') || key.includes('temp-')) {
            return this.strategies.SESSION; // Tab-specific data
        } else {
            return this.strategies.LOCAL; // General persistence
        }
    }

    async setItem(key, value, options = {}) {
        const method = options.method || this.getStorageMethod(key, value);
        
        switch (method) {
            case this.strategies.COOKIE:
                return this.setCookie(key, value, options);
            case this.strategies.LOCAL:
                return this.setLocalStorage(key, value, options);
            case this.strategies.SESSION:
                return this.setSessionStorage(key, value, options);
            case this.strategies.INDEXED_DB:
                return this.setIndexedDB(key, value, options);
            default:
                throw new Error(`Unknown storage method: ${method}`);
        }
    }
}

// Comprehensive storage hook
const useSmartStorage = () => {
    const strategy = useMemo(() => new StorageStrategy(), []);
    
    const setItem = useCallback(async (key, value, options = {}) => {
        return await strategy.setItem(key, value, options);
    }, [strategy]);

    const getItem = useCallback(async (key) => {
        // Try all storage methods in order of priority
        const methods = ['cookie', 'local', 'session', 'indexed_db'];
        
        for (const method of methods) {
            try {
                const value = await strategy.getItem(key, method);
                if (value !== null && value !== undefined) {
                    return value;
                }
            } catch (error) {
                console.warn(`Failed to get ${key} from ${method}:`, error);
            }
        }
        return null;
    }, [strategy]);

    return { setItem, getItem };
};

// These questions cover the depth and complexity expected in production-grade React.js interviews, focusing on practical implementation, error handling, performance considerations, and real-world use cases.