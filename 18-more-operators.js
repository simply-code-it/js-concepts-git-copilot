// Of course. Here are comprehensive code snippets for these JavaScript features, specifically tailored for Node.js production-grade backend development with practical examples and best practices.

// ## 1. Falsy Values

// Falsy values are values that evaluate to `false` in boolean contexts.

// Production: Input validation and default values
class UserService {
    static validateUserInput(userData) {
        // Common falsy values in backend development
        const falsyValues = [
            false,         // Boolean false
            0,             // Number zero
            -0,            // Negative zero
            '',            // Empty string
            null,          // Null
            undefined,     // Undefined
            NaN,           // Not a Number
            // Note: Empty objects/arrays are truthy!
        ];

        // Practical validation examples
        if (!userData.username) {
            throw new Error('Username is required'); // Catches: '', null, undefined
        }

        if (!userData.age || isNaN(userData.age)) {
            throw new Error('Valid age is required'); // Catches: 0, null, undefined, NaN
        }

        // Special case: Zero might be valid for age, but falsy
        if (userData.age === 0) {
            // Handle zero explicitly if it's a valid value
            console.log('User age is zero');
        }

        return true;
    }

    static processUserPreferences(preferences) {
        // Database might return null/undefined for unset preferences
        const defaultPreferences = {
            theme: 'dark',
            notifications: true,
            language: 'en'
        };

        // Safely merge with defaults
        return {
            ...defaultPreferences,
            ...(preferences || {}) // Handle null/undefined preferences
        };
    }
}

// Usage examples
try {
    UserService.validateUserInput({ username: '', age: null });
} catch (error) {
    console.error('Validation error:', error.message);
}

// Database simulation
const dbResult = { username: 'john', age: 0, email: null };
console.log('Username exists:', !!dbResult.username); // true
console.log('Email exists:', !!dbResult.email);       // false
console.log('Age is truthy:', !!dbResult.age);        // false (0 is falsy!)

// Production tip: Be careful with numeric zero
const pagination = { page: 0, limit: 10 };
if (!pagination.page) {
    console.log('Page might be intentionally set to 0'); // This executes!
}

// ## 2. Nullish Coalescing Operator (`??`)

// The `??` operator returns the right-hand operand only when the left-hand operand is `null` or `undefined`.

// Production: Configuration management with proper fallbacks
class ConfigService {
    constructor() {
        this.config = {
            // Environment variables might be empty strings or undefined
            port: process.env.PORT ?? 3000,
            dbUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/app',
            maxConnections: process.env.MAX_CONNECTIONS ?? 10,
            logLevel: process.env.LOG_LEVEL ?? 'info',
            // Special case: Empty string should use default
            apiKey: process.env.API_KEY || 'default-key' // Use || if empty string should fallback
        };
    }

    getDatabaseConfig() {
        return {
            host: process.env.DB_HOST ?? 'localhost',
            port: parseInt(process.env.DB_PORT ?? '5432'),
            database: process.env.DB_NAME ?? 'myapp',
            // SSL might be explicitly false (boolean) or string
            ssl: process.env.DB_SSL === 'true' ?? false
        };
    }

    getUserSettings(userPreferences) {
        // Nullish coalescing vs logical OR
        return {
            // || would fallback for falsy values (0, '', false)
            itemsPerPage: userPreferences.itemsPerPage || 25, // If 0, uses 25 (probably wrong!)
            
            // ?? only falls back for null/undefined
            cacheTimeout: userPreferences.cacheTimeout ?? 30000, // If 0, uses 0 (correct)
            
            notifications: userPreferences.notifications ?? true,
            theme: userPreferences.theme ?? 'dark'
        };
    }
}

// Usage examples
const configService = new ConfigService();

// Environment variables simulation
process.env.PORT = ''; // Empty string
process.env.MAX_CONNECTIONS = '0'; // String '0'

console.log('Server port:', configService.config.port); // 3000 (?? doesn't fallback for '')
console.log('Max connections:', configService.config.maxConnections); // '0' (?? doesn't fallback for '0')

// Database query with potential null results
class UserRepository {
    async findUserByEmail(email) {
        // Simulate database call that might return null
        const user = await this.db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        return user ?? { id: 0, email, status: 'guest' }; // Default guest user
    }

    async getUserPreference(userId, key) {
        const preference = await this.db.query(
            'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
            [userId, key]
        );
        
        // preference might be null, undefined, or { value: 0 }
        return preference?.value ?? 'default-value';
    }
}

// Practical API response formatting
function formatApiResponse(data, message) {
    return {
        success: true,
        data: data ?? null, // Explicit null instead of undefined
        message: message ?? 'Operation completed',
        timestamp: new Date().toISOString()
    };
}

console.log(formatApiResponse(null, ''));
// { success: true, data: null, message: '', timestamp: '...' }

// ## 3. Logical Assignment Operators

// Combine logical operations with assignment in a concise way.

// Production: Efficient state management and configuration merging
class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 300000; // 5 minutes
        this.maxSize = 1000;
    }

    // Logical OR assignment (||=)
    initializeCache(config = {}) {
        // Only assign if currently falsy
        this.defaultTTL ||= config.defaultTTL;
        this.maxSize ||= config.maxSize;
        this.cleanupInterval ||= setInterval(() => this.cleanup(), 60000);
        
        return this;
    }

    // Logical AND assignment (&&=)
    updateCacheConfig(newConfig) {
        // Only update if current value is truthy
        this.defaultTTL &&= newConfig.defaultTTL ?? this.defaultTTL;
        this.maxSize &&= newConfig.maxSize ?? this.maxSize;
        
        // Safe method calling
        this.cleanupInterval &&= clearInterval(this.cleanupInterval);
        
        return this;
    }

    // Nullish coalescing assignment (??=)
    setDefaultValues() {
        // Only assign if currently null or undefined
        this.defaultTTL ??= 300000;
        this.maxSize ??= 1000;
        this.cleanupInterval ??= setInterval(() => this.cleanup(), 60000);
        
        return this;
    }

    // Practical usage in request processing
    processRequest(request) {
        const context = request.context ?? {};
        
        // Build context with logical assignments
        context.requestId ||= generateRequestId();
        context.startTime ??= Date.now();
        context.user &&= await this.validateUser(context.user);
        
        return context;
    }
}

// Usage examples
const cache = new CacheService();

// ||= examples
let appConfig = {};
appConfig.port ||= 3000; // Assigns 3000 (was undefined)
appConfig.port ||= 8080; // Keeps 3000 (was truthy)
console.log('Port:', appConfig.port); // 3000

// &&= examples
let userSession = { id: 123, token: 'abc' };
userSession.token &&= await validateToken(userSession.token); // Updates if token exists
userSession.nonExistent &&= 'value'; // Doesn't create property
console.log('Session:', userSession); // { id: 123, token: validatedToken }

// ??= examples
let databaseConfig = { host: 'localhost', port: null };
databaseConfig.port ??= 5432; // Assigns 5432 (was null)
databaseConfig.host ??= '127.0.0.1'; // Keeps 'localhost' (was truthy)
databaseConfig.password ??= 'default-pass'; // Assigns (was undefined)
console.log('DB Config:', databaseConfig);

// Production pattern: Configuration merging
function mergeConfigs(baseConfig, overrideConfig) {
    const result = { ...baseConfig };
    
    // Only override if values are provided in override
    for (const [key, value] of Object.entries(overrideConfig)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    
    // Alternative with logical assignment
    result.port ||= overrideConfig.port;
    result.host ??= overrideConfig.host;
    
    return result;
}

// ## 4. Exponentiation Operator (`**`)

// The `**` operator raises the left operand to the power of the right operand.

// Production: Mathematical calculations, financial computations, and algorithms
class FinancialService {
    // Compound interest calculation
    static calculateCompoundInterest(principal, rate, time, compoundFrequency = 1) {
        // A = P(1 + r/n)^(nt)
        const amount = principal * (1 + rate / compoundFrequency) ** (compoundFrequency * time);
        return Math.round(amount * 100) / 100; // Round to 2 decimal places
    }

    // Exponential growth/decay
    static calculateExponentialGrowth(initialValue, growthRate, periods) {
        return initialValue * (1 + growthRate) ** periods;
    }

    // Mortgage payment calculation
    static calculateMonthlyPayment(principal, annualRate, years) {
        const monthlyRate = annualRate / 12;
        const numberOfPayments = years * 12;
        
        // M = P * (r(1+r)^n) / ((1+r)^n - 1)
        const monthlyPayment = principal * 
            (monthlyRate * (1 + monthlyRate) ** numberOfPayments) / 
            ((1 + monthlyRate) ** numberOfPayments - 1);
            
        return Math.round(monthlyPayment * 100) / 100;
    }
}

// Usage examples
console.log('2^10:', 2 ** 10); // 1024
console.log('Square root of 16:', 16 ** 0.5); // 4
console.log('Cube of 3:', 3 ** 3); // 27

// Financial calculations
console.log('Compound interest:', 
    FinancialService.calculateCompoundInterest(1000, 0.05, 10)); // 1628.89

console.log('Monthly mortgage:',
    FinancialService.calculateMonthlyPayment(200000, 0.035, 30)); // 898.09

// Production: Algorithm implementations
class AlgorithmService {
    // Exponential backoff for retry mechanisms
    static calculateBackoffDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
        const delay = baseDelay * (2 ** attempt); // Exponential growth
        return Math.min(delay, maxDelay);
    }

    // Distance calculation (2D/3D)
    static calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const dz = (point2.z || 0) - (point1.z || 0);
        
        return (dx ** 2 + dy ** 2 + dz ** 2) ** 0.5;
    }

    // Pagination total pages calculation
    static calculateTotalPages(totalItems, itemsPerPage) {
        return Math.ceil(totalItems / itemsPerPage);
    }

    // Memory size calculations (bytes to KB, MB, GB)
    static formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / (1024 ** i) * 100) / 100 + ' ' + sizes[i];
    }
}

// Retry mechanism with exponential backoff
async function apiCallWithRetry(apiCall, maxRetries = 5) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            
            const delay = AlgorithmService.calculateBackoffDelay(attempt);
            console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Performance benchmarking
function benchmarkOperation(operation, iterations = 1000) {
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
        operation();
    }
    
    const endTime = performance.now();
    const averageTime = (endTime - startTime) / iterations;
    
    return {
        totalTime: endTime - startTime,
        averageTime,
        operationsPerSecond: 1000 / averageTime
    };
}

// Compare ** vs Math.pow()
const base = 2, exponent = 10;
const expResult = benchmarkOperation(() => base ** exponent);
const powResult = benchmarkOperation(() => Math.pow(base, exponent));

console.log('Exponentiation operator:', expResult.averageTime.toFixed(4), 'ms');
console.log('Math.pow():', powResult.averageTime.toFixed(4), 'ms');

// ## Production Best Practices Summary

// 1. Use ?? for configuration/default values
const config = {
    port: process.env.PORT ?? 3000,
    timeout: userPreference.timeout ?? 5000
};

// 2. Use ||= for initialization with fallbacks
class Service {
    constructor() {
        this.cache ||= new Map();
        this.initialized ||= this.initialize();
    }
}

// 3. Use ** for mathematical operations (cleaner than Math.pow())
const area = Math.PI * (radius ** 2);

// 4. Be careful with falsy values in numeric contexts
const userAge = input.age || 25; // BUG: 0 becomes 25!
const userAge = input.age ?? 25; // CORRECT: 0 remains 0

// 5. Use logical assignment for safe property updates
obj.property &&= await validate(obj.property);

// These operators make your Node.js backend code more concise, readable, and less error-prone while maintaining production-grade quality.






























// Here's a comprehensive list of special built-in objects and global utilities in JavaScript that are crucial for Node.js backend development:

// ## Global Utility Objects

// ### 1. **JSON Object**
// Serialization/Deserialization for APIs and data storage
const obj = { name: "John", age: 30, active: true };

// Safe serialization with error handling
const jsonString = JSON.stringify(obj, null, 2);
const parsedObj = JSON.parse(jsonString);

// Reviver function for custom parsing
const data = JSON.parse('{"date": "2024-01-15"}', (key, value) => {
    if (key === 'date') return new Date(value);
    return value;
});

// ### 2. **Math Object**
// Mathematical operations and calculations
Math.floor(4.7);    // 4
Math.ceil(4.2);     // 5
Math.round(4.5);    // 5
Math.random();      // 0.0 - 1.0
Math.max(1, 3, 2);  // 3
Math.min(1, 3, 2);  // 1
Math.pow(2, 3);     // 8
Math.sqrt(16);      // 4

// Production use: IDs, sampling, calculations
const generateId = () => Math.random().toString(36).substring(2);

// ### 3. **Date Object**
// Date and time manipulation
const now = new Date();
const specific = new Date('2024-01-15T10:30:00Z');

// Production date handling
const isoString = now.toISOString(); // API responses
const timestamp = now.getTime();     // Database storage
const localString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York' 
});

// ### 4. **Console Object**
// Logging and debugging
console.log('Info message');
console.error('Error message');
console.warn('Warning message');
console.debug('Debug message');

// Production logging with structured data
console.log('User login', { 
    userId: 123, 
    timestamp: new Date().toISOString(),
    ip: '192.168.1.1'
});

// Performance monitoring
console.time('databaseQuery');
// ... database operation
console.timeEnd('databaseQuery');

// ## Fundamental Built-in Objects

// ### 5. **Object**
// Object manipulation utilities
const obj = { a: 1, b: 2 };

Object.keys(obj);      // ['a', 'b']
Object.values(obj);    // [1, 2]
Object.entries(obj);   // [['a', 1], ['b', 2]]

// Immutable operations
const frozen = Object.freeze(obj);     // Prevents modifications
const sealed = Object.seal(obj);       // Prevents adding/removing properties
const extended = Object.preventExtensions(obj); // Prevents adding properties

// ### 6. **Array**
// Array operations
const arr = [1, 2, 3];

// Production data processing
const doubled = arr.map(x => x * 2);
const even = arr.filter(x => x % 2 === 0);
const sum = arr.reduce((acc, val) => acc + val, 0);

// Modern array methods
const hasEven = arr.some(x => x % 2 === 0);
const allPositive = arr.every(x => x > 0);
const found = arr.find(x => x > 1);

// ### 7. **String**
// String manipulation
const str = 'Hello World';

str.includes('World');    // true
str.startsWith('Hello');  // true
str.endsWith('World');    // true
str.replace('World', 'Node.js');
str.split(' ');           // ['Hello', 'World']
str.trim();               // Remove whitespace

// Template literals
const name = 'John';
const greeting = `Hello ${name}, welcome!`;

// ### 8. **Number**
// Number utilities
Number.parseInt('42');     // 42
Number.parseFloat('3.14'); // 3.14
Number.isNaN(NaN);         // true
Number.isFinite(42);       // true
Number.isInteger(42);      // true

// Safe number conversions
const safeParse = (str) => {
    const num = Number(str);
    return Number.isNaN(num) ? 0 : num;
};

// ### 9. **Boolean**
// Boolean operations
Boolean(0);          // false
Boolean(1);          // true
Boolean('');         // false
Boolean('text');     // true
Boolean([]);         // true
Boolean({});         // true

// ## Collection Objects

// ### 10. **Map**
// Key-value store with any key type
const map = new Map();
map.set('name', 'John');
map.set(1, 'one');
map.set({ id: 1 }, 'object key');

map.get('name');     // 'John'
map.has(1);          // true
map.size;            // 3

// Production use: Caching, metadata
const cache = new Map();
cache.set('user:123', userData, { ttl: 60000 });

// ### 11. **Set**
// Unique value collection
const set = new Set([1, 2, 3, 3, 2]);
set.add(4);
set.has(2);          // true
set.size;            // 4

// Production use: Deduplication, feature flags
const uniqueUsers = new Set(userIds);
const enabledFeatures = new Set(['dark-mode', 'notifications']);

// ### 12. **WeakMap & WeakSet**
// Collections with weak references (better for memory)
const weakMap = new WeakMap();
const obj = {};
weakMap.set(obj, 'private data');

const weakSet = new WeakSet();
weakSet.add(obj);

// Production use: Private data, DOM element references

// ## Error Handling Objects

// ### 13. **Error**
// Custom error types
class ValidationError extends Error {
    constructor(field, message) {
        super(`Validation failed for ${field}: ${message}`);
        this.name = 'ValidationError';
        this.field = field;
        this.timestamp = new Date().toISOString();
    }
}

// Production error handling
try {
    throw new ValidationError('email', 'Invalid format');
} catch (error) {
    if (error instanceof ValidationError) {
        console.error(`Field error: ${error.field}`);
    }
}

// ### 14. **Promise**
// Asynchronous operations
const fetchData = () => new Promise((resolve, reject) => {
    // Async operation
    setTimeout(() => resolve('data'), 1000);
});

// Production async patterns
Promise.all([apiCall1, apiCall2, apiCall3])
    .then(([result1, result2, result3]) => {
        // All promises resolved
    })
    .catch(error => {
        // Handle any rejection
    });

Promise.race([timeoutPromise, dataPromise]);
Promise.allSettled([promise1, promise2]); // Wait for all to settle

// ## Node.js Specific Global Objects

// ### 15. **process**
// Process information and control
process.env.NODE_ENV;           // Environment variables
process.env.DATABASE_URL;       // Configuration
process.argv;                   // Command line arguments
process.cwd();                  // Current working directory
process.memoryUsage();          // Memory information
process.uptime();               // How long process has been running

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

// ### 16. **Buffer**
// Binary data handling
const buf = Buffer.from('Hello World', 'utf8');
const hex = buf.toString('hex');
const base64 = buf.toString('base64');

// Production use: File processing, network protocols
const fileBuffer = fs.readFileSync('image.jpg');
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

// ### 17. **URL**
// URL parsing and manipulation
const url = new URL('https://example.com:8080/path?query=value#hash');
url.hostname;    // 'example.com'
url.port;        // '8080'
url.pathname;    // '/path'
url.search;      // '?query=value'

// Production use: API route parsing, redirects
const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

// ## Utility Objects

// ### 18. **RegExp**
// Regular expressions
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[\d\s-()]+$/;

// Production validation
const isValidEmail = (email) => emailRegex.test(email);
const extractNumbers = (str) => str.match(/\d+/g);

// Performance: Pre-compile regex
const precompiledRegex = new RegExp('pattern', 'flags');

// ### 19. **Intl** (Internationalization)
// Internationalization utilities
const numberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});
numberFormat.format(1234.56); // '$1,234.56'

const dateFormat = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});
dateFormat.format(new Date()); // 'January 15, 2024'

// Production use: Multi-language applications

// ### 20. **Reflect**
// Meta-programming utilities
const obj = { name: 'John' };

Reflect.get(obj, 'name');           // 'John'
Reflect.set(obj, 'age', 30);        // true
Reflect.has(obj, 'name');           // true
Reflect.ownKeys(obj);               // ['name', 'age']

// Production use: Advanced object manipulation, proxies

// ### 21. **Proxy**
// Object interception and validation
const validator = {
    set(target, property, value) {
        if (property === 'age' && typeof value !== 'number') {
            throw new Error('Age must be a number');
        }
        target[property] = value;
        return true;
    }
};

const person = new Proxy({}, validator);
person.age = 30;  // Works
// person.age = 'thirty'; // Throws error

// Production use: Validation, logging, access control

// ## Special Value Objects

// ### 22. **Symbol**
// Unique identifiers
const USER_ROLE = Symbol('user');
const ADMIN_ROLE = Symbol('admin');

// Production use: Constants, metadata, private properties
const privateData = Symbol('privateData');

class User {
    constructor() {
        this[privateData] = 'sensitive info';
    }
}

// ### 23. **BigInt**
// Large integer operations
const bigNumber = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
const anotherBig = 9007199254740993n;

// Production use: Financial calculations, large IDs
const calculateInterest = (principal, rate, periods) => {
    return principal * (1n + rate) ** BigInt(periods);
};

// ## Node.js Module System Objects

// ### 24. **module, exports, require**
// Module system
module.exports = class Service {
    constructor() {
        this.name = 'My Service';
    }
};

// Or using exports
exports.helperFunction = () => {
    return 'helper result';
};

// Importing
const Service = require('./service');
const { helperFunction } = require('./helpers');

// ### 25. **__filename & __dirname**
// File path utilities
console.log(__filename); // Full path to current file
console.log(__dirname);  // Directory of current file

// Production use: Path resolution for files
const path = require('path');
const configPath = path.join(__dirname, 'config', 'app.json');

// ## Production Usage Patterns

// Common production patterns with these objects
class ProductionUtils {
    // Safe JSON with error handling
    static safeJSONParse(str, defaultValue = {}) {
        try {
            return JSON.parse(str);
        } catch {
            return defaultValue;
        }
    }

    // Date formatting for APIs
    static formatAPIDate(date) {
        return new Date(date).toISOString();
    }

    // Environment-aware configuration
    static getConfig() {
        return {
            env: process.env.NODE_ENV || 'development',
            port: parseInt(process.env.PORT) || 3000,
            logLevel: process.env.LOG_LEVEL || 'info',
            features: new Set(process.env.FEATURES?.split(',') || [])
        };
    }

    // Request ID generation
    static generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// These special objects form the foundation of Node.js backend development. Mastering them is essential for writing production-grade, efficient, and maintainable server-side applications.