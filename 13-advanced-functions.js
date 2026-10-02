// Here's a comprehensive collection of production-grade JavaScript function patterns and snippets for Node.js backend development:

// ## 1. Async/Await Error Handling

// Using try-catch wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// With detailed error logging
const asyncHandlerWithLogging = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    console.error('Async handler error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    next(error);
  }
};

// Usage in Express routes
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}));

// ## 2. Middleware Functions

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Rate limiting middleware
const rateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, timestamp] of requests.entries()) {
      if (timestamp < windowStart) {
        requests.delete(key);
      }
    }
    
    const userRequests = Array.from(requests.values())
      .filter(timestamp => timestamp > windowStart).length;
    
    if (userRequests >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    requests.set(ip, now);
    next();
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  });
  
  next();
};

// ## 3. Validation Functions

// Joi validation wrapper
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.body = value;
    next();
  };
};

// Example schema
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(50).required()
});

// Usage
app.post('/users', validateRequest(userSchema), asyncHandler(async (req, res) => {
  // req.body is validated here
}));

// ## 4. Database Operations

// Database connection with retry logic
const connectWithRetry = async (mongoose, url, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('Database connected successfully');
      return;
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error('Unable to connect to database after multiple attempts');
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};

// Transaction wrapper
const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ## 5. Utility Functions

// Password hashing
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Password verification
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// JWT token generation
const generateTokens = (payload) => {
  const accessToken = jwt.sign(
    payload, 
    process.env.JWT_ACCESS_SECRET, 
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    payload, 
    process.env.JWT_REFRESH_SECRET, 
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// File upload handler
const handleFileUpload = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    uploadPath = 'uploads/'
  } = options;
  
  return new Promise((resolve, reject) => {
    if (file.size > maxSize) {
      reject(new Error('File size too large'));
      return;
    }
    
    if (!allowedTypes.includes(file.mimetype)) {
      reject(new Error('File type not allowed'));
      return;
    }
    
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(uploadPath, filename);
    
    fs.writeFile(filepath, file.buffer, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve({ filename, filepath });
      }
    });
  });
};

// ## 6. Error Handling Functions

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new AppError(message, 400);
  }
  
  res.status(error.statusCode || 500).json({
    error: {
      message: error.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

// ## 7. Caching Functions

// Redis cache wrapper
const withCache = (redisClient) => {
  return {
    get: async (key) => {
      try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Cache get error:', error);
        return null;
      }
    },
    
    set: async (key, value, expiration = 3600) => {
      try {
        await redisClient.setex(
          key, 
          expiration, 
          JSON.stringify(value)
        );
      } catch (error) {
        console.error('Cache set error:', error);
      }
    },
    
    del: async (key) => {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error('Cache delete error:', error);
      }
    },
    
    getOrSet: async (key, fetchData, expiration = 3600) => {
      const cached = await this.get(key);
      if (cached) return cached;
      
      const freshData = await fetchData();
      await this.set(key, freshData, expiration);
      return freshData;
    }
  };
};

// ## 8. API Response Helpers

// Standardized response format
const apiResponse = {
  success: (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },
  
  error: (res, message, statusCode = 500, errors = null) => {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (errors) {
      response.errors = errors;
    }
    
    res.status(statusCode).json(response);
  },
  
  paginated: (res, data, pagination, message = 'Success') => {
    res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    });
  }
};

// Pagination helper
const getPagination = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit, page: parseInt(page) };
};

// ## 9. Security Functions

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();
  }
  return input;
};

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Helmet configuration for security headers
const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// ## 10. Configuration Management

// Environment configuration
const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: '15m',
    refreshExpiry: '7d'
  },
  
  // Server
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD
  }
};

// Configuration validation
const validateConfig = () => {
  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// ## 11. Testing Utilities

// Test setup helper
const setupTestDB = () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL);
  });
  
  beforeEach(async () => {
    await Promise.all(
      Object.values(mongoose.connection.collections).map(
        collection => collection.deleteMany()
      )
    );
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
  });
};

// Mock request/response for testing
const createMockReqRes = (overrides = {}) => {
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides.req
  };
  
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    ...overrides.res
  };
  
  const next = jest.fn();
  
  return { req, res, next };
};

// These snippets cover the essential patterns for production-grade Node.js backend development. Remember to:

// 1. Always handle errors properly
// 2. Use environment variables for configuration
// 3. Implement proper logging
// 4. Add input validation and sanitization
// 5. Use async/await with proper error handling
// 6. Implement security best practices
// 7. Write comprehensive tests
// 8. Use TypeScript for better type safety in production

// Would you like me to elaborate on any specific pattern or provide more examples for a particular use case?





























// Here's a comprehensive collection of production-grade JavaScript `call()` method patterns and snippets for Node.js backend development:

// ## 1. Basic `call()` Method Usage

// Basic function borrowing
function greet(message) {
  return `${message}, ${this.name}!`;
}

const user = { name: 'John' };
const admin = { name: 'Admin' };

// Using call to set 'this' context
console.log(greet.call(user, 'Hello')); // "Hello, John!"
console.log(greet.call(admin, 'Welcome')); // "Welcome, Admin!"

// ## 2. Database Model Inheritance Pattern

// Base Model class
class BaseModel {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  validate(data) {
    if (!data) {
      throw new Error('Data is required');
    }
    return true;
  }

  logOperation(operation) {
    console.log(`[${this.collectionName}] ${operation} - ${new Date().toISOString()}`);
  }
}

// User Model using call for constructor chaining
function UserModel(db) {
  // Call parent constructor with collection name
  BaseModel.call(this, 'users');
  this.db = db;
}

// Set up prototype chain
UserModel.prototype = Object.create(BaseModel.prototype);
UserModel.prototype.constructor = UserModel;

// Add user-specific methods
UserModel.prototype.create = function(userData) {
  this.logOperation('create');
  this.validate(userData);
  
  return this.db.collection(this.collectionName).insertOne({
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
};

UserModel.prototype.findByEmail = function(email) {
  this.logOperation('findByEmail');
  return this.db.collection(this.collectionName).findOne({ email });
};

// ## 3. Middleware Composition Pattern

// Base middleware class
class Middleware {
  constructor(name) {
    this.name = name;
  }

  execute(context, next) {
    console.log(`Executing ${this.name} middleware`);
    return next();
  }
}

// Authentication middleware
function AuthMiddleware() {
  Middleware.call(this, 'authentication');
}

AuthMiddleware.prototype = Object.create(Middleware.prototype);
AuthMiddleware.prototype.constructor = AuthMiddleware;

AuthMiddleware.prototype.execute = function(context, next) {
  // Call parent execute method
  Middleware.prototype.execute.call(this, context, () => {
    const token = context.req.headers.authorization;
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Validate token logic here
    context.user = { id: 1, name: 'John Doe' };
    
    return next();
  });
};

// Logging middleware
function LoggingMiddleware() {
  Middleware.call(this, 'logging');
}

LoggingMiddleware.prototype = Object.create(Middleware.prototype);
LoggingMiddleware.prototype.constructor = LoggingMiddleware;

LoggingMiddleware.prototype.execute = function(context, next) {
  const start = Date.now();
  
  // Call parent method
  Middleware.prototype.execute.call(this, context, () => {
    return next().finally(() => {
      const duration = Date.now() - start;
      console.log(`Request completed in ${duration}ms`);
    });
  });
};

// ## 4. Service Layer with Context Binding

// Base Service class
class BaseService {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.cache = new Map();
  }

  getFromCache(key) {
    return this.cache.get(key);
  }

  setInCache(key, value, ttl = 300000) { // 5 minutes default
    this.cache.set(key, value);
    setTimeout(() => this.cache.delete(key), ttl);
  }
}

// User Service with call pattern
function UserService(userRepository, cacheService) {
  BaseService.call(this, 'user-service');
  this.userRepository = userRepository;
  this.cacheService = cacheService;
}

UserService.prototype = Object.create(BaseService.prototype);
UserService.prototype.constructor = UserService;

UserService.prototype.getUserById = function(userId, useCache = true) {
  const cacheKey = `user:${userId}`;
  
  if (useCache) {
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('Returning cached user');
      return Promise.resolve(cached);
    }
  }

  return this.userRepository.findById(userId)
    .then(user => {
      if (user) {
        this.setInCache(cacheKey, user);
      }
      return user;
    });
};

UserService.prototype.updateUser = function(userId, updates) {
  const cacheKey = `user:${userId}`;
  
  return this.userRepository.update(userId, updates)
    .then(updatedUser => {
      // Invalidate cache
      this.cache.delete(cacheKey);
      return updatedUser;
    });
};

// ## 5. Plugin System with call()

// Plugin base class
class Plugin {
  constructor(name) {
    this.name = name;
    this.isEnabled = true;
  }

  initialize(app) {
    console.log(`Initializing plugin: ${this.name}`);
  }

  validateConfig(config) {
    return typeof config === 'object' && config !== null;
  }
}

// Authentication Plugin
function AuthPlugin(config) {
  Plugin.call(this, 'auth-plugin');
  
  if (!this.validateConfig(config)) {
    throw new Error('Invalid auth plugin configuration');
  }
  
  this.config = config;
  this.strategies = new Map();
}

AuthPlugin.prototype = Object.create(Plugin.prototype);
AuthPlugin.prototype.constructor = AuthPlugin;

AuthPlugin.prototype.initialize = function(app) {
  // Call parent initialize
  Plugin.prototype.initialize.call(this, app);
  
  // Add auth routes
  app.post('/auth/login', this.handleLogin.bind(this));
  app.post('/auth/register', this.handleRegister.bind(this));
  app.get('/auth/verify', this.handleVerify.bind(this));
};

AuthPlugin.prototype.handleLogin = function(req, res) {
  // Login logic here
  const { email, password } = req.body;
  
  // Authentication logic
  res.json({ token: 'jwt-token-here' });
};

// ## 6. Error Handling with call()

// Base Error Handler
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  logError(error, context = {}) {
    this.logger.error({
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
}

// API Error Handler
function ApiErrorHandler(logger, config = {}) {
  ErrorHandler.call(this, logger);
  this.config = {
    includeStack: config.includeStack || process.env.NODE_ENV === 'development',
    logAllErrors: config.logAllErrors !== false
  };
}

ApiErrorHandler.prototype = Object.create(ErrorHandler.prototype);
ApiErrorHandler.prototype.constructor = ApiErrorHandler;

ApiErrorHandler.prototype.handle = function(error, req, res) {
  // Call parent logError method
  this.logError(error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  let statusCode = 500;
  let message = 'Internal Server Error';

  if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Failed';
  }

  const response = {
    error: {
      message,
      statusCode,
      ...(this.config.includeStack && { stack: error.stack })
    }
  };

  res.status(statusCode).json(response);
};

// ## 7. Database Transaction Pattern

// Transaction Manager
class TransactionManager {
  constructor(db) {
    this.db = db;
  }

  async startSession() {
    return await this.db.startSession();
  }
}

// Repository with transaction support
function UserRepository(db, transactionManager) {
  this.db = db;
  this.transactionManager = transactionManager;
  this.collection = db.collection('users');
}

UserRepository.prototype.createWithTransaction = async function(userData, session) {
  try {
    const result = await this.collection.insertOne(
      {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { session }
    );
    
    return result;
  } catch (error) {
    throw new Error(`User creation failed: ${error.message}`);
  }
};

// Service using transaction pattern
function UserRegistrationService(userRepository, emailService) {
  this.userRepository = userRepository;
  this.emailService = emailService;
}

UserRegistrationService.prototype.registerUser = async function(userData) {
  const session = await this.userRepository.transactionManager.startSession();
  
  try {
    let user;
    
    await session.withTransaction(async () => {
      // Create user
      user = await this.userRepository.createWithTransaction(userData, session);
      
      // Send welcome email (could be in transaction if using transactional email)
      await this.emailService.sendWelcomeEmail.call(
        this.emailService, 
        user.email, 
        user.name
      );
    });
    
    return user;
  } finally {
    await session.endSession();
  }
};

// ## 8. Validation System with call()

// Base Validator
class Validator {
  constructor(fieldName) {
    this.fieldName = fieldName;
    this.errors = [];
  }

  addError(message) {
    this.errors.push(`${this.fieldName}: ${message}`);
  }

  getErrors() {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }
}

// Email Validator
function EmailValidator(fieldName = 'email') {
  Validator.call(this, fieldName);
  this.pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
}

EmailValidator.prototype = Object.create(Validator.prototype);
EmailValidator.prototype.constructor = EmailValidator;

EmailValidator.prototype.validate = function(value) {
  this.clearErrors();
  
  if (!value) {
    this.addError('is required');
    return false;
  }
  
  if (typeof value !== 'string') {
    this.addError('must be a string');
    return false;
  }
  
  if (!this.pattern.test(value)) {
    this.addError('is invalid');
    return false;
  }
  
  return true;
};

// Password Validator
function PasswordValidator(fieldName = 'password') {
  Validator.call(this, fieldName);
  this.minLength = 8;
}

PasswordValidator.prototype = Object.create(Validator.prototype);
PasswordValidator.prototype.constructor = PasswordValidator;

PasswordValidator.prototype.validate = function(value) {
  this.clearErrors();
  
  if (!value) {
    this.addError('is required');
    return false;
  }
  
  if (value.length < this.minLength) {
    this.addError(`must be at least ${this.minLength} characters`);
    return false;
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
    this.addError('must contain uppercase, lowercase, and numbers');
    return false;
  }
  
  return true;
};

// ## 9. Caching Strategy Pattern

// Cache Strategy Base
class CacheStrategy {
  constructor(name) {
    this.name = name;
  }

  async get(key) {
    throw new Error('get method must be implemented');
  }

  async set(key, value, ttl) {
    throw new Error('set method must be implemented');
  }
}

// Redis Cache Strategy
function RedisCacheStrategy(redisClient, prefix = 'app:') {
  CacheStrategy.call(this, 'redis');
  this.redis = redisClient;
  this.prefix = prefix;
}

RedisCacheStrategy.prototype = Object.create(CacheStrategy.prototype);
RedisCacheStrategy.prototype.constructor = RedisCacheStrategy;

RedisCacheStrategy.prototype.get = async function(key) {
  const prefixedKey = this.prefix + key;
  const value = await this.redis.get(prefixedKey);
  return value ? JSON.parse(value) : null;
};

RedisCacheStrategy.prototype.set = async function(key, value, ttl = 3600) {
  const prefixedKey = this.prefix + key;
  await this.redis.setex(prefixedKey, ttl, JSON.stringify(value));
};

// Memory Cache Strategy
function MemoryCacheStrategy(maxSize = 1000) {
  CacheStrategy.call(this, 'memory');
  this.cache = new Map();
  this.maxSize = maxSize;
}

MemoryCacheStrategy.prototype = Object.create(CacheStrategy.prototype);
MemoryCacheStrategy.prototype.constructor = MemoryCacheStrategy;

MemoryCacheStrategy.prototype.get = async function(key) {
  return this.cache.get(key);
};

MemoryCacheStrategy.prototype.set = async function(key, value, ttl = 3600) {
  if (this.cache.size >= this.maxSize) {
    // Remove first item (simple LRU)
    const firstKey = this.cache.keys().next().value;
    this.cache.delete(firstKey);
  }
  
  this.cache.set(key, value);
  
  if (ttl > 0) {
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl * 1000);
  }
};

// ## 10. API Client with call() Pattern

// HTTP Client Base
class HttpClient {
  constructor(baseURL, defaultHeaders = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(url, config);
      return await this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  handleResponse(response) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  handleError(error) {
    return new Error(`Request failed: ${error.message}`);
  }
}

// API Client for specific service
function UserApiClient(baseURL, apiKey) {
  HttpClient.call(this, baseURL, {
    'Authorization': `Bearer ${apiKey}`
  });
}

UserApiClient.prototype = Object.create(HttpClient.prototype);
UserApiClient.prototype.constructor = UserApiClient;

UserApiClient.prototype.getUser = function(userId) {
  return this.request(`/users/${userId}`);
};

UserApiClient.prototype.createUser = function(userData) {
  return this.request('/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
};

UserApiClient.prototype.handleResponse = function(response) {
  // Call parent handleResponse
  return HttpClient.prototype.handleResponse.call(this, response)
    .then(data => {
      // Transform response for user API
      return {
        success: true,
        data: data.user,
        meta: data.meta
      };
    });
};

// ## 11. Production Usage Example

// Complete example with all patterns
const main = async () => {
  // Setup
  const db = await connectToDatabase();
  const redis = await connectToRedis();
  
  // Create instances using call pattern
  const userRepo = new UserRepository(db);
  const redisCache = new RedisCacheStrategy(redis);
  const userService = new UserService(userRepo, redisCache);
  
  // Use the services
  try {
    const user = await userService.getUserById('123', true);
    console.log('User:', user);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Utility function to demonstrate call() with array-like objects
function convertArgsToArray() {
  // Using call with array-like objects
  const argsArray = Array.prototype.slice.call(arguments);
  console.log('Arguments as array:', argsArray);
  
  // Using call with array methods on non-array objects
  const nodeList = document.querySelectorAll('div'); // In browser context
  const divArray = Array.prototype.map.call(nodeList, div => div.textContent);
  
  return argsArray;
}

// ## Key Benefits in Production:

// 1. **Explicit Context Control**: `call()` gives you precise control over `this` context
// 2. **Function Borrowing**: Reuse methods across different objects
// 3. **Constructor Chaining**: Implement inheritance patterns
// 4. **Performance**: Avoid unnecessary object creation
// 5. **Compatibility**: Work with array-like objects and legacy code
// 6. **Testing**: Easily mock and test functions with specific contexts

// These patterns are essential for building maintainable, scalable Node.js backend applications with proper separation of concerns and code reuse.





























// Here's a comprehensive collection of production-grade JavaScript `apply()` method patterns and snippets for Node.js backend development:

// ## 1. Basic `apply()` Method Usage

// Basic function with apply
function introduce(role, department) {
  return `I'm ${this.name}, ${role} in ${department}`;
}

const employee = { name: 'Alice' };
const manager = { name: 'Bob' };

// Using apply with array of arguments
console.log(introduce.apply(employee, ['Developer', 'Engineering']));
// "I'm Alice, Developer in Engineering"

console.log(introduce.apply(manager, ['Team Lead', 'Product']));
// "I'm Bob, Team Lead in Product"

// ## 2. Database Query Builder with apply()

// Query Builder using apply for dynamic arguments
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.selectFields = ['*'];
  }

  select(...fields) {
    this.selectFields = fields.length > 0 ? fields : ['*'];
    return this;
  }

  where(field, operator, value) {
    // Using apply to handle dynamic number of filter conditions
    this.filters.push({ field, operator, value });
    return this;
  }

  whereIn(field, values) {
    // Apply can be used to pass array as individual arguments
    this.filters.push({ 
      field, 
      operator: 'IN', 
      value: `(${values.map(v => `'${v}'`).join(', ')})` 
    });
    return this;
  }

  build() {
    let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.table}`;
    
    if (this.filters.length > 0) {
      query += ' WHERE ' + this.filters.map(filter => 
        `${filter.field} ${filter.operator} ${filter.value}`
      ).join(' AND ');
    }
    
    return query;
  }
}

// Usage with dynamic conditions
const userQuery = new QueryBuilder('users')
  .select('id', 'name', 'email', 'created_at')
  .where('status', '=', 'active')
  .whereIn('role', ['admin', 'user'])
  .where('created_at', '>', '2023-01-01');

console.log(userQuery.build());

// ## 3. Bulk Database Operations

// Bulk insert with apply pattern
class BulkOperations {
  constructor(model) {
    this.model = model;
  }

  // Using apply to handle dynamic batch sizes
  async bulkInsert(data, batchSize = 100) {
    const results = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        // Using apply to pass array as individual documents
        const batchResult = await this.model.insertMany.apply(
          this.model, 
          [batch, { ordered: false }]
        );
        results.push(...batchResult);
      } catch (error) {
        console.error(`Batch ${i / batchSize + 1} failed:`, error.message);
        // Continue with other batches
      }
    }
    
    return results;
  }

  // Bulk update with dynamic conditions
  async bulkUpdate(updates, concurrency = 5) {
    const updatePromises = updates.map(update => 
      this.model.updateOne.apply(
        this.model, 
        [update.filter, update.data, update.options]
      )
    );

    // Process in batches to control concurrency
    const batches = [];
    for (let i = 0; i < updatePromises.length; i += concurrency) {
      const batch = updatePromises.slice(i, i + concurrency);
      batches.push(Promise.allSettled(batch));
    }

    const results = [];
    for (const batch of batches) {
      const batchResults = await batch;
      results.push(...batchResults);
    }

    return results;
  }
}

// ## 4. Middleware Pipeline with apply()

// Middleware pipeline using apply for argument forwarding
class MiddlewarePipeline {
  constructor() {
    this.middlewares = [];
  }

  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context) {
    let index = 0;
    
    const next = async () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        
        // Using apply to pass context and next function
        return await middleware.apply(null, [context, next]);
      }
    };

    return await next();
  }
}

// Individual middleware functions
const loggerMiddleware = async (context, next) => {
  const start = Date.now();
  console.log(`[START] ${context.req.method} ${context.req.url}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`[END] ${context.req.method} ${context.req.url} - ${duration}ms`);
};

const authMiddleware = async (context, next) => {
  const token = context.req.headers.authorization;
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  // Verify token and attach user to context
  context.user = { id: 1, name: 'John Doe' };
  
  await next();
};

// Usage
const pipeline = new MiddlewarePipeline()
  .use(loggerMiddleware)
  .use(authMiddleware);

// Execute pipeline
await pipeline.execute({ req: request, res: response });

// ## 5. Dynamic Validation System

// Validator using apply for rule composition
class SchemaValidator {
  constructor() {
    this.validators = new Map();
    this.registerDefaultValidators();
  }

  registerDefaultValidators() {
    this.validators.set('required', (value, ...params) => {
      return value != null && value !== '';
    });

    this.validators.set('minLength', (value, ...params) => {
      const [min] = params;
      return value && value.length >= min;
    });

    this.validators.set('maxLength', (value, ...params) => {
      const [max] = params;
      return value && value.length <= max;
    });

    this.validators.set('pattern', (value, ...params) => {
      const [regex] = params;
      return new RegExp(regex).test(value);
    });

    this.validators.set('email', (value, ...params) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    });
  }

  validate(data, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      for (const rule of rules) {
        const [validatorName, ...params] = rule.split(':');
        const validator = this.validators.get(validatorName);

        if (validator) {
          // Using apply to pass parameters to validator
          const isValid = validator.apply(null, [value, ...params]);
          
          if (!isValid) {
            errors.push({
              field,
              rule: validatorName,
              message: `Validation failed for ${field} with rule ${validatorName}`
            });
          }
        }
      }
    }

    return errors;
  }
}

// Usage
const validator = new SchemaValidator();
const userSchema = {
  name: ['required', 'minLength:2', 'maxLength:50'],
  email: ['required', 'email'],
  password: ['required', 'minLength:8', 'pattern:(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)']
};

const userData = {
  name: 'John',
  email: 'john@example.com',
  password: 'Weakpass'
};

const errors = validator.validate(userData, userSchema);
console.log('Validation errors:', errors);

// ## 6. API Response Formatter

// Response formatter using apply for dynamic data transformation
class ResponseFormatter {
  constructor() {
    this.formatters = new Map();
    this.registerDefaultFormatters();
  }

  registerDefaultFormatters() {
    this.formatters.set('success', (data, ...metadata) => {
      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        ...(metadata.length > 0 && { metadata: metadata[0] })
      };
    });

    this.formatters.set('error', (message, ...details) => {
      return {
        success: false,
        error: {
          message,
          ...(details.length > 0 && { details: details[0] })
        },
        timestamp: new Date().toISOString()
      };
    });

    this.formatters.set('paginated', (data, ...paginationInfo) => {
      const [pagination] = paginationInfo;
      return {
        success: true,
        data,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          pages: Math.ceil(pagination.total / pagination.limit)
        },
        timestamp: new Date().toISOString()
      };
    });
  }

  format(type, ...args) {
    const formatter = this.formatters.get(type);
    
    if (!formatter) {
      throw new Error(`Unknown formatter type: ${type}`);
    }

    // Using apply to pass dynamic arguments to formatter
    return formatter.apply(null, args);
  }

  // Helper method for common response patterns
  success(data, metadata = null) {
    const args = metadata ? [data, metadata] : [data];
    return this.format.apply(this, ['success', ...args]);
  }

  error(message, details = null) {
    const args = details ? [message, details] : [message];
    return this.format.apply(this, ['error', ...args]);
  }

  paginated(data, pagination) {
    return this.format.apply(this, ['paginated', data, pagination]);
  }
}

// Usage in Express route
const formatter = new ResponseFormatter();

app.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { users, total } = await UserService.getPaginatedUsers(page, limit);
    
    const response = formatter.paginated(users, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    });
    
    res.json(response);
  } catch (error) {
    const response = formatter.error('Failed to fetch users', {
      code: 'USERS_FETCH_ERROR'
    });
    res.status(500).json(response);
  }
});

// ## 7. Event Emitter with apply()

// Enhanced Event Emitter using apply for argument propagation
class AdvancedEventEmitter {
  constructor() {
    this.events = new Map();
    this.maxListeners = 10;
  }

  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const listeners = this.events.get(event);
    if (listeners.length >= this.maxListeners) {
      console.warn(`Possible memory leak detected for event: ${event}`);
    }

    listeners.push(listener);
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      // Using apply to call the original listener
      listener.apply(null, args);
      this.off(event, onceWrapper);
    };
    
    this.on(event, onceWrapper);
    return this;
  }

  off(event, listener) {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  emit(event, ...args) {
    const listeners = this.events.get(event);
    
    if (listeners) {
      // Using apply for each listener to maintain proper this context
      listeners.forEach(listener => {
        try {
          listener.apply(null, args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    
    return this;
  }

  // Batch emit with error handling
  emitSafe(event, ...args) {
    const listeners = this.events.get(event);
    const results = [];
    
    if (listeners) {
      listeners.forEach((listener, index) => {
        try {
          const result = listener.apply(null, args);
          results.push({ success: true, result, index });
        } catch (error) {
          results.push({ success: false, error, index });
          console.error(`Listener ${index} failed for event ${event}:`, error);
        }
      });
    }
    
    return results;
  }
}

// Usage
const emitter = new AdvancedEventEmitter();

// Add listeners
emitter.on('user.created', (user, source) => {
  console.log(`User ${user.name} created from ${source}`);
});

emitter.on('user.created', (user, source) => {
  // Send welcome email
  console.log(`Sending welcome email to ${user.email}`);
});

// Emit event with multiple arguments
emitter.emit('user.created', 
  { name: 'Alice', email: 'alice@example.com' }, 
  'web-registration'
);

// ## 8. Cache Manager with apply()

// Multi-layer cache manager
class CacheManager {
  constructor(layers = []) {
    this.layers = layers;
    this.defaultTTL = 300; // 5 minutes
  }

  // Using apply for layered cache operations
  async get(key, ...options) {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      
      try {
        // Using apply to pass options to each layer's get method
        const value = await layer.get.apply(layer, [key, ...options]);
        
        if (value !== null && value !== undefined) {
          // Populate higher layers (except the current one)
          for (let j = 0; j < i; j++) {
            await this.layers[j].set.apply(
              this.layers[j], 
              [key, value, this.defaultTTL]
            );
          }
          return value;
        }
      } catch (error) {
        console.error(`Cache layer ${i} error:`, error);
        // Continue to next layer
      }
    }
    
    return null;
  }

  async set(key, value, ttl = this.defaultTTL, ...options) {
    const setOperations = this.layers.map(layer => 
      layer.set.apply(layer, [key, value, ttl, ...options])
        .catch(error => {
          console.error('Cache set error:', error);
          return false;
        })
    );
    
    const results = await Promise.allSettled(setOperations);
    return results.every(result => result.status === 'fulfilled');
  }

  async delete(key, ...options) {
    const deleteOperations = this.layers.map(layer =>
      layer.delete.apply(layer, [key, ...options])
        .catch(error => {
          console.error('Cache delete error:', error);
          return false;
        })
    );
    
    const results = await Promise.allSettled(deleteOperations);
    return results.every(result => result.status === 'fulfilled');
  }
}

// Cache layer implementations
class MemoryCacheLayer {
  constructor() {
    this.cache = new Map();
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value, ttl) {
    this.cache.set(key, value);
    
    if (ttl > 0) {
      setTimeout(() => {
        this.cache.delete(key);
      }, ttl * 1000);
    }
    
    return true;
  }

  async delete(key) {
    return this.cache.delete(key);
  }
}

class RedisCacheLayer {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
    return true;
  }

  async delete(key) {
    await this.redis.del(key);
    return true;
  }
}

// ## 9. Dynamic Service Loader

// Service loader using apply for dynamic instantiation
class ServiceLoader {
  constructor(serviceDirectory) {
    this.serviceDirectory = serviceDirectory;
    this.services = new Map();
    this.dependencies = new Map();
  }

  register(name, ServiceClass, dependencies = []) {
    this.services.set(name, ServiceClass);
    this.dependencies.set(name, dependencies);
  }

  // Using apply for dynamic constructor invocation
  async getService(serviceName, ...extraDependencies) {
    if (this.services.has(serviceName)) {
      const ServiceClass = this.services.get(serviceName);
      const dependencies = this.dependencies.get(serviceName);
      
      // Resolve dependencies
      const resolvedDependencies = await Promise.all(
        dependencies.map(dep => this.getService(dep))
      );
      
      // Combine with extra dependencies
      const allDependencies = [...resolvedDependencies, ...extraDependencies];
      
      // Using apply to instantiate with dynamic dependencies
      const instance = new (Function.prototype.bind.apply(
        ServiceClass, 
        [null, ...allDependencies]
      ))();
      
      return instance;
    }
    
    throw new Error(`Service not found: ${serviceName}`);
  }

  // Bulk service initialization
  async initializeAll() {
    const initializedServices = new Map();
    
    for (const [serviceName] of this.services) {
      if (!initializedServices.has(serviceName)) {
        const instance = await this.getService(serviceName);
        initializedServices.set(serviceName, instance);
      }
    }
    
    return initializedServices;
  }
}

// Usage
class DatabaseService {
  constructor(connectionString) {
    this.connectionString = connectionString;
  }
  
  connect() {
    console.log('Connecting to database...');
  }
}

class UserService {
  constructor(dbService, cacheService) {
    this.dbService = dbService;
    this.cacheService = cacheService;
  }
  
  getUsers() {
    return ['User1', 'User2'];
  }
}

// Register services
const loader = new ServiceLoader();
loader.register('database', DatabaseService, []);
loader.register('user', UserService, ['database']);

// Get service with dynamic dependencies
const userService = await loader.getService('user');
console.log(userService.getUsers());

// ## 10. Performance Monitoring with apply()

// Performance monitor using apply for function wrapping
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  // Wrap function with performance monitoring
  wrapFunction(fn, name = fn.name) {
    const monitor = this;
    
    return function(...args) {
      const start = process.hrtime.bigint();
      
      try {
        // Using apply to call original function with correct context
        const result = fn.apply(this, args);
        
        // Handle both sync and async functions
        if (result instanceof Promise) {
          return result.finally(() => {
            const end = process.hrtime.bigint();
            monitor.recordMetric(name, Number(end - start) / 1e6); // Convert to ms
          });
        } else {
          const end = process.hrtime.bigint();
          monitor.recordMetric(name, Number(end - start) / 1e6);
          return result;
        }
      } catch (error) {
        const end = process.hrtime.bigint();
        monitor.recordMetric(name, Number(end - start) / 1e6);
        throw error;
      }
    };
  }

  recordMetric(name, duration) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name);
    metrics.push({
      duration,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  getStats(name) {
    const metrics = this.metrics.get(name) || [];
    
    if (metrics.length === 0) {
      return null;
    }
    
    const durations = metrics.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    
    return { avg, max, min, count: durations.length };
  }

  // Wrap all methods of a class
  wrapClassMethods(instance, className) {
    const prototype = Object.getPrototypeOf(instance);
    
    Object.getOwnPropertyNames(prototype).forEach(methodName => {
      if (methodName !== 'constructor' && typeof prototype[methodName] === 'function') {
        const originalMethod = prototype[methodName];
        prototype[methodName] = this.wrapFunction(
          originalMethod, 
          `${className}.${methodName}`
        );
      }
    });
    
    return instance;
  }
}

// Usage
const monitor = new PerformanceMonitor();

// Wrap individual function
const monitoredFetch = monitor.wrapFunction(fetch, 'http.fetch');

// Wrap class methods
class UserRepository {
  async findById(id) {
    // Simulate database call
    await new Promise(resolve => setTimeout(resolve, 100));
    return { id, name: 'User' };
  }
  
  async findByEmail(email) {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { email, name: 'User' };
  }
}

const userRepo = new UserRepository();
monitor.wrapClassMethods(userRepo, 'UserRepository');

// Later, get performance stats
console.log(monitor.getStats('UserRepository.findById'));

// ## 11. Production Utility Functions

// Utility functions demonstrating apply() in production scenarios

// 1. Math operations on dataset
function analyzeDataset(...datasets) {
  // Using apply with Math functions
  const allData = [].concat.apply([], datasets);
  
  const stats = {
    min: Math.min.apply(null, allData),
    max: Math.max.apply(null, allData),
    avg: allData.reduce((a, b) => a + b, 0) / allData.length,
    sum: allData.reduce((a, b) => a + b, 0)
  };
  
  return stats;
}

// 2. Dynamic function composition
function compose(...functions) {
  return function(...args) {
    return functions.reduceRight((result, fn) => {
      // Using apply for each function in composition
      return [fn.apply(null, result)];
    }, args)[0];
  };
}

// 3. Safe function execution with timeout
function executeWithTimeout(fn, timeout, ...args) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Function execution timed out after ${timeout}ms`));
    }, timeout);
    
    try {
      // Using apply to execute function with arguments
      const result = fn.apply(null, args);
      
      if (result instanceof Promise) {
        result.then(resolve).catch(reject).finally(() => clearTimeout(timeoutId));
      } else {
        clearTimeout(timeoutId);
        resolve(result);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// 4. Batch processor with concurrency control
class BatchProcessor {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
  }
  
  async processItems(items, processorFn) {
    const results = [];
    
    for (let i = 0; i < items.length; i += this.concurrency) {
      const batch = items.slice(i, i + this.concurrency);
      
      const batchPromises = batch.map(item =>
        Promise.resolve(processorFn.apply(null, [item]))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

// ## Key Production Benefits of `apply()`:

// 1. **Dynamic Argument Handling**: Perfect for functions with variable arguments
// 2. **Array Manipulation**: Convert array-like objects to real arrays
// 3. **Function Composition**: Build complex operations from simple functions
// 4. **Performance Optimization**: Avoid unnecessary array creation in loops
// 5. **API Design Flexibility**: Create clean interfaces that accept multiple argument formats
// 6. **Method Borrowing**: Use methods from other objects with different contexts

// These patterns are essential for building scalable, maintainable Node.js backend systems with proper separation of concerns and optimal performance.


























// Here's a comprehensive collection of production-grade JavaScript `bind()` method patterns and snippets for Node.js backend development:

// ## 1. Basic `bind()` Method Usage

// Basic function binding
function getUserProfile(role, department) {
  return {
    name: this.name,
    email: this.email,
    role,
    department,
    fullInfo: `${this.name} (${this.email}) - ${role} in ${department}`
  };
}

const user = { name: 'John Doe', email: 'john@company.com' };
const admin = { name: 'Admin User', email: 'admin@company.com' };

// Create bound functions with preset context
const getUserAsAdmin = getUserProfile.bind(user, 'Administrator', 'IT');
const getUserAsManager = getUserProfile.bind(admin, 'Manager', 'Operations');

console.log(getUserAsAdmin());
console.log(getUserAsManager());

// ## 2. Database Connection Management

// Database connection manager with bound methods
class DatabaseConnection {
  constructor(connectionString, options = {}) {
    this.connectionString = connectionString;
    this.options = options;
    this.isConnected = false;
    this.pool = null;
    
    // Bind methods to maintain context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.query = this.query.bind(this);
    this.transaction = this.transaction.bind(this);
  }

  async connect() {
    try {
      this.pool = await this.createPool();
      this.isConnected = true;
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database disconnected');
    }
  }

  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      // Bind the connection to maintain context in callback
      const boundCallback = callback.bind(null, connection);
      const result = await boundCallback();
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Create pre-bound query methods for common operations
  createPreparedQueries() {
    return {
      findUserById: this.query.bind(this, 'SELECT * FROM users WHERE id = ?'),
      findUsersByStatus: this.query.bind(
        this, 
        'SELECT * FROM users WHERE status = ? LIMIT ? OFFSET ?'
      ),
      updateUserStatus: this.query.bind(
        this,
        'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?'
      )
    };
  }
}

// Usage
const db = new DatabaseConnection(process.env.DATABASE_URL);
await db.connect();

const queries = db.createPreparedQueries();
const user = await queries.findUserById([1]);
const activeUsers = await queries.findUsersByStatus(['active', 10, 0]);

// ## 3. API Route Handlers with Bound Context

// Controller class with bound route handlers
class UserController {
  constructor(userService, authService, logger) {
    this.userService = userService;
    this.authService = authService;
    this.logger = logger;

    // Bind all methods to maintain 'this' context
    this.getUser = this.getUser.bind(this);
    this.createUser = this.createUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
  }

  async getUser(req, res, next) {
    try {
      const userId = req.params.id;
      const user = await this.userService.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      this.logger.info('User fetched', { userId, actor: req.user.id });
      res.json({ data: user });
    } catch (error) {
      this.logger.error('Get user failed', { error: error.message });
      next(error);
    }
  }

  async createUser(req, res, next) {
    try {
      const userData = req.body;
      const user = await this.userService.create(userData);
      
      this.logger.info('User created', { userId: user.id, actor: req.user.id });
      res.status(201).json({ data: user });
    } catch (error) {
      this.logger.error('Create user failed', { error: error.message });
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const userId = req.params.id;
      const updates = req.body;
      
      const user = await this.userService.update(userId, updates);
      
      this.logger.info('User updated', { userId, actor: req.user.id });
      res.json({ data: user });
    } catch (error) {
      this.logger.error('Update user failed', { error: error.message });
      next(error);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const userId = req.params.id;
      await this.userService.delete(userId);
      
      this.logger.info('User deleted', { userId, actor: req.user.id });
      res.status(204).send();
    } catch (error) {
      this.logger.error('Delete user failed', { error: error.message });
      next(error);
    }
  }

  async getUserProfile(req, res, next) {
    try {
      const userId = req.user.id; // From auth middleware
      const profile = await this.userService.getProfile(userId);
      
      res.json({ data: profile });
    } catch (error) {
      this.logger.error('Get profile failed', { error: error.message });
      next(error);
    }
  }

  // Factory method to create pre-bound middleware
  static create(userService, authService, logger) {
    const controller = new UserController(userService, authService, logger);
    
    return {
      getUser: controller.getUser,
      createUser: controller.createUser,
      updateUser: controller.updateUser,
      deleteUser: controller.deleteUser,
      getUserProfile: controller.getUserProfile
    };
  }
}

// Usage in Express routes
const userController = UserController.create(userService, authService, logger);

app.get('/users/:id', authenticate, userController.getUser);
app.post('/users', authenticate, authorize('admin'), userController.createUser);
app.put('/users/:id', authenticate, authorize('admin'), userController.updateUser);
app.delete('/users/:id', authenticate, authorize('admin'), userController.deleteUser);
app.get('/profile', authenticate, userController.getUserProfile);

// ## 4. Event Handlers with Bound Context

// Event emitter with bound handlers
class EventDrivenService {
  constructor(eventEmitter, logger) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.handlers = new Map();

    // Bind methods
    this.registerHandler = this.registerHandler.bind(this);
    this.deregisterHandler = this.deregisterHandler.bind(this);
    this.handleUserCreated = this.handleUserCreated.bind(this);
    this.handleOrderPlaced = this.handleOrderPlaced.bind(this);
    this.handlePaymentProcessed = this.handlePaymentProcessed.bind(this);

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Register bound event handlers
    this.registerHandler('user.created', this.handleUserCreated);
    this.registerHandler('order.placed', this.handleOrderPlaced);
    this.registerHandler('payment.processed', this.handlePaymentProcessed);
  }

  registerHandler(event, handler) {
    const boundHandler = handler.bind(this);
    this.eventEmitter.on(event, boundHandler);
    this.handlers.set(event, boundHandler);
  }

  deregisterHandler(event) {
    const handler = this.handlers.get(event);
    if (handler) {
      this.eventEmitter.off(event, handler);
      this.handlers.delete(event);
    }
  }

  async handleUserCreated(userData) {
    try {
      this.logger.info('Handling user created event', { userId: userData.id });
      
      // Send welcome email
      await this.sendWelcomeEmail(userData.email, userData.name);
      
      // Create user profile
      await this.createUserProfile(userData.id);
      
      this.logger.info('User created event handled successfully', { 
        userId: userData.id 
      });
    } catch (error) {
      this.logger.error('Failed to handle user created event', { 
        error: error.message,
        userId: userData.id
      });
    }
  }

  async handleOrderPlaced(orderData) {
    try {
      this.logger.info('Handling order placed event', { orderId: orderData.id });
      
      // Update inventory
      await this.updateInventory(orderData.items);
      
      // Send order confirmation
      await this.sendOrderConfirmation(orderData);
      
      this.logger.info('Order placed event handled successfully', {
        orderId: orderData.id
      });
    } catch (error) {
      this.logger.error('Failed to handle order placed event', {
        error: error.message,
        orderId: orderData.id
      });
    }
  }

  async handlePaymentProcessed(paymentData) {
    try {
      this.logger.info('Handling payment processed event', {
        paymentId: paymentData.id
      });
      
      // Update order status
      await this.updateOrderStatus(paymentData.orderId, 'paid');
      
      // Trigger fulfillment process
      await this.triggerFulfillment(paymentData.orderId);
      
      this.logger.info('Payment processed event handled successfully', {
        paymentId: paymentData.id
      });
    } catch (error) {
      this.logger.error('Failed to handle payment processed event', {
        error: error.message,
        paymentId: paymentData.id
      });
    }
  }

  // Helper methods
  async sendWelcomeEmail(email, name) {
    // Email sending logic
  }

  async createUserProfile(userId) {
    // Profile creation logic
  }

  async updateInventory(items) {
    // Inventory update logic
  }

  async sendOrderConfirmation(orderData) {
    // Order confirmation logic
  }

  async updateOrderStatus(orderId, status) {
    // Order status update logic
  }

  async triggerFulfillment(orderId) {
    // Fulfillment triggering logic
  }
}

// ## 5. Middleware Factory with Bound Configuration

// Configurable middleware factory
class MiddlewareFactory {
  constructor(config) {
    this.config = config;
    
    // Bind factory methods
    this.createAuthMiddleware = this.createAuthMiddleware.bind(this);
    this.createValidationMiddleware = this.createValidationMiddleware.bind(this);
    this.createLoggingMiddleware = this.createLoggingMiddleware.bind(this);
    this.createRateLimitMiddleware = this.createRateLimitMiddleware.bind(this);
  }

  createAuthMiddleware(options = {}) {
    const { required = true, roles = [] } = options;
    
    // Return a bound middleware function
    const middleware = async function(req, res, next) {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token && required) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (token) {
          const user = await this.verifyToken(token);
          
          if (roles.length > 0 && !roles.includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
          }
          
          req.user = user;
        }
        
        next();
      } catch (error) {
        if (required) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        next();
      }
    }.bind(this); // Bind to maintain access to this.verifyToken
    
    return middleware;
  }

  createValidationMiddleware(schema, options = {}) {
    const { source = 'body' } = options;
    
    return async function(req, res, next) {
      try {
        const data = req[source];
        const { error, value } = schema.validate(data, {
          abortEarly: false,
          stripUnknown: true
        });
        
        if (error) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          });
        }
        
        req[source] = value;
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  createLoggingMiddleware(options = {}) {
    const { level = 'info', logBody = false } = options;
    
    return async function(req, res, next) {
      const start = Date.now();
      
      // Log request
      this.logger[level]('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        ...(logBody && { body: req.body })
      });
      
      // Hook into response finish
      res.on('finish', () => {
        const duration = Date.now() - start;
        
        this.logger[level]('Request completed', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`
        });
      });
      
      next();
    }.bind(this);
  }

  createRateLimitMiddleware(options = {}) {
    const { windowMs = 15 * 60 * 1000, max = 100 } = options;
    const requests = new Map();
    
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
        if (validTimestamps.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimestamps);
        }
      }
    }, windowMs);
    
    return function(req, res, next) {
      const key = req.ip;
      const now = Date.now();
      
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      
      const timestamps = requests.get(key);
      const windowTimestamps = timestamps.filter(ts => now - ts < windowMs);
      
      if (windowTimestamps.length >= max) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      windowTimestamps.push(now);
      requests.set(key, windowTimestamps);
      
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - windowTimestamps.length);
      
      next();
    };
  }

  async verifyToken(token) {
    // Token verification logic using this.config
    return jwt.verify(token, this.config.jwtSecret);
  }
}

// Usage
const middlewareFactory = new MiddlewareFactory({
  jwtSecret: process.env.JWT_SECRET,
  logger: console
});

app.use(middlewareFactory.createLoggingMiddleware({ level: 'info' }));
app.use(middlewareFactory.createAuthMiddleware({ required: false }));
app.use('/api', middlewareFactory.createRateLimitMiddleware({ max: 1000 }));

// ## 6. Service Layer with Bound Dependencies

// Base service class with bound methods
class BaseService {
  constructor(repository, logger, cache) {
    this.repository = repository;
    this.logger = logger;
    this.cache = cache;
    
    // Bind all methods
    this.bindMethods();
  }

  bindMethods() {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => name !== 'constructor' && typeof this[name] === 'function');
    
    methodNames.forEach(methodName => {
      this[methodName] = this[methodName].bind(this);
    });
  }

  async withCache(key, ttl, operation) {
    const cached = await this.cache.get(key);
    if (cached) {
      this.logger.debug('Cache hit', { key });
      return cached;
    }

    const result = await operation();
    await this.cache.set(key, result, ttl);
    this.logger.debug('Cache set', { key, ttl });
    
    return result;
  }

  async withRetry(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        this.logger.warn('Operation failed, retrying', {
          attempt,
          maxRetries,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
}

// User service implementation
class UserService extends BaseService {
  constructor(userRepository, logger, cache, emailService) {
    super(userRepository, logger, cache);
    this.emailService = emailService;
    
    // Bind additional methods
    this.sendWelcomeEmail = this.sendWelcomeEmail.bind(this);
  }

  async findById(userId, useCache = true) {
    const cacheKey = `user:${userId}`;
    
    if (useCache) {
      return this.withCache(cacheKey, 300, async () => {
        return await this.repository.findById(userId);
      });
    }
    
    return await this.repository.findById(userId);
  }

  async create(userData) {
    return this.withRetry(async () => {
      const user = await this.repository.create(userData);
      
      // Send welcome email (fire and forget)
      this.sendWelcomeEmail(user.email, user.name).catch(error => {
        this.logger.error('Failed to send welcome email', {
          userId: user.id,
          error: error.message
        });
      });
      
      // Invalidate relevant cache entries
      await this.cache.delete('users:list');
      
      this.logger.info('User created successfully', { userId: user.id });
      return user;
    });
  }

  async update(userId, updates) {
    const user = await this.repository.update(userId, updates);
    
    // Invalidate cache
    await this.cache.delete(`user:${userId}`);
    await this.cache.delete('users:list');
    
    this.logger.info('User updated', { userId });
    return user;
  }

  async list(filters = {}, options = {}) {
    const cacheKey = `users:list:${JSON.stringify({ filters, options })}`;
    
    return this.withCache(cacheKey, 60, async () => {
      return await this.repository.findAll(filters, options);
    });
  }

  async sendWelcomeEmail(email, name) {
    const subject = 'Welcome to Our Service';
    const html = `
      <h1>Welcome, ${name}!</h1>
      <p>Thank you for joining our service.</p>
    `;
    
    await this.emailService.send(email, subject, html);
    this.logger.info('Welcome email sent', { email });
  }
}

// Usage with dependency injection
const userService = new UserService(
  userRepository,
  logger,
  cache,
  emailService
);

// All methods are properly bound and can be passed around safely
app.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(user);
});

// ## 7. Configuration Management with Bound Methods

// Configuration manager with bound validators
class ConfigManager {
  constructor() {
    this.config = new Map();
    this.validators = new Map();
    this.watchers = new Map();
    
    // Bind methods
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.validate = this.validate.bind(this);
    this.watch = this.watch.bind(this);
    this.loadFromEnv = this.loadFromEnv.bind(this);
    
    this.registerDefaultValidators();
  }

  registerDefaultValidators() {
    this.validators.set('string', this.validateString.bind(this));
    this.validators.set('number', this.validateNumber.bind(this));
    this.validators.set('boolean', this.validateBoolean.bind(this));
    this.validators.set('email', this.validateEmail.bind(this));
    this.validators.set('url', this.validateUrl.bind(this));
  }

  get(key, defaultValue = null) {
    return this.config.has(key) ? this.config.get(key) : defaultValue;
  }

  set(key, value, options = {}) {
    const { validate = true, type = 'string' } = options;
    
    if (validate) {
      this.validate(key, value, type);
    }
    
    const oldValue = this.config.get(key);
    this.config.set(key, value);
    
    // Notify watchers
    if (this.watchers.has(key)) {
      this.watchers.get(key).forEach(callback => {
        callback(value, oldValue);
      });
    }
    
    return true;
  }

  validate(key, value, type = 'string') {
    const validator = this.validators.get(type);
    
    if (!validator) {
      throw new Error(`No validator found for type: ${type}`);
    }
    
    if (!validator(value)) {
      throw new Error(`Invalid value for ${key}: ${value} (expected ${type})`);
    }
    
    return true;
  }

  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    
    const boundCallback = callback.bind(this);
    this.watchers.get(key).push(boundCallback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(key);
      const index = watchers.indexOf(boundCallback);
      if (index > -1) {
        watchers.splice(index, 1);
      }
    };
  }

  async loadFromEnv(prefix = 'APP_') {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        let parsedValue = value;
        
        // Try to parse JSON values
        if (value && (value.startsWith('{') || value.startsWith('['))) {
          try {
            parsedValue = JSON.parse(value);
          } catch (error) {
            // Keep as string if not valid JSON
          }
        }
        
        // Convert string booleans and numbers
        if (value === 'true') parsedValue = true;
        if (value === 'false') parsedValue = false;
        if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);
        
        this.set(configKey, parsedValue, { validate: false });
      }
    }
  }

  // Validator methods
  validateString(value) {
    return typeof value === 'string';
  }

  validateNumber(value) {
    return typeof value === 'number' && !isNaN(value);
  }

  validateBoolean(value) {
    return typeof value === 'boolean';
  }

  validateEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  validateUrl(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  // Create pre-bound configuration getters
  createGetters() {
    return {
      getDatabaseUrl: () => this.get('database_url'),
      getJwtSecret: () => this.get('jwt_secret'),
      getPort: () => this.get('port', 3000),
      getLogLevel: () => this.get('log_level', 'info'),
      isProduction: () => this.get('node_env') === 'production'
    };
  }
}

// Usage
const config = new ConfigManager();
await config.loadFromEnv('APP_');

const { 
  getDatabaseUrl, 
  getJwtSecret, 
  getPort, 
  getLogLevel, 
  isProduction 
} = config.createGetters();

// These bound functions can be safely passed around
console.log(getDatabaseUrl());
console.log(getPort());
console.log(isProduction());

// ## 8. Task Queue with Bound Workers

// Task queue with bound worker functions
class TaskQueue {
  constructor(options = {}) {
    this.options = {
      concurrency: 1,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.queue = [];
    this.workers = new Map();
    this.isProcessing = false;
    this.activeTasks = 0;
    
    // Bind methods
    this.process = this.process.bind(this);
    this.add = this.add.bind(this);
    this.registerWorker = this.registerWorker.bind(this);
    this.executeTask = this.executeTask.bind(this);
  }

  registerWorker(taskType, workerFunction, options = {}) {
    const boundWorker = workerFunction.bind(this);
    this.workers.set(taskType, { worker: boundWorker, options });
  }

  async add(taskType, data, priority = 0) {
    const task = {
      id: this.generateId(),
      type: taskType,
      data,
      priority,
      attempts: 0,
      createdAt: new Date()
    };
    
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.process();
    }
    
    return task.id;
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.activeTasks < this.options.concurrency) {
      const task = this.queue.shift();
      this.activeTasks++;
      
      this.executeTask(task).finally(() => {
        this.activeTasks--;
        
        if (this.queue.length > 0) {
          this.process();
        } else {
          this.isProcessing = false;
        }
      });
    }
    
    this.isProcessing = false;
  }

  async executeTask(task) {
    const workerInfo = this.workers.get(task.type);
    
    if (!workerInfo) {
      console.error(`No worker registered for task type: ${task.type}`);
      return;
    }
    
    const { worker, options } = workerInfo;
    const retryAttempts = options.retryAttempts || this.options.retryAttempts;
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        await worker(task.data, task);
        console.log(`Task ${task.id} completed successfully`);
        return;
      } catch (error) {
        console.error(`Task ${task.id} failed (attempt ${attempt}/${retryAttempts}):`, error);
        
        if (attempt === retryAttempts) {
          console.error(`Task ${task.id} failed after ${retryAttempts} attempts`);
          await this.handleTaskFailure(task, error);
          return;
        }
        
        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async handleTaskFailure(task, error) {
    // Override this method for custom failure handling
    console.error(`Task ${task.id} failed permanently:`, error);
  }

  generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Usage with bound worker functions
const queue = new TaskQueue({ concurrency: 3 });

// Register workers with bound context
queue.registerWorker('send_email', async function(emailData, task) {
  console.log(`Sending email to ${emailData.to} for task ${task.id}`);
  // Email sending logic using this.options, etc.
  await this.sendEmail(emailData);
}, { retryAttempts: 2 });

queue.registerWorker('process_image', async function(imageData, task) {
  console.log(`Processing image ${imageData.filename} for task ${task.id}`);
  // Image processing logic
  await this.processImage(imageData);
}, { retryAttempts: 1 });

queue.registerWorker('generate_report', async function(reportData, task) {
  console.log(`Generating report for ${reportData.type} for task ${task.id}`);
  // Report generation logic
  await this.generateReport(reportData);
}, { retryAttempts: 3 });

// Add tasks
await queue.add('send_email', { 
  to: 'user@example.com', 
  subject: 'Welcome!', 
  body: 'Hello!' 
}, 1);

await queue.add('process_image', { 
  filename: 'photo.jpg', 
  operations: ['resize', 'compress'] 
}, 2);

// ## 9. Production Utility Functions

// Utility functions demonstrating bind() in production scenarios

// 1. Partial application for configuration
function createDatabaseConnection(config) {
  const baseConfig = {
    host: 'localhost',
    port: 5432,
    maxConnections: 10,
    timeout: 5000,
    ...config
  };
  
  return {
    query: async function(sql, params = []) {
      // Database query implementation
      console.log('Executing query:', sql, params);
    },
    
    // Create pre-bound methods with partial configuration
    findUserById: this.query.bind(this, 'SELECT * FROM users WHERE id = $1'),
    findUsersByStatus: this.query.bind(
      this, 
      'SELECT * FROM users WHERE status = $1 LIMIT $2 OFFSET $3'
    ),
    updateUser: this.query.bind(
      this,
      'UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3'
    )
  };
}

// 2. Event handler with bound cleanup
function createEventHandlers() {
  const handlers = [];
  
  function addHandler(element, event, handler) {
    const boundHandler = handler.bind(null, element);
    element.addEventListener(event, boundHandler);
    
    // Store for cleanup
    handlers.push({ element, event, handler: boundHandler });
    
    return () => {
      element.removeEventListener(event, boundHandler);
      const index = handlers.findIndex(h => h.handler === boundHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }
  
  function cleanupAll() {
    handlers.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    handlers.length = 0;
  }
  
  return { addHandler, cleanupAll };
}

// 3. API client with bound methods
function createApiClient(baseURL, defaultHeaders = {}) {
  const client = {
    baseURL,
    defaultHeaders,
    
    async request(endpoint, options = {}) {
      const url = `${this.baseURL}${endpoint}`;
      const config = {
        headers: { ...this.defaultHeaders, ...options.headers },
        ...options
      };
      
      const response = await fetch(url, config);
      return response.json();
    }
  };
  
  // Create bound convenience methods
  client.get = client.request.bind(client, '', { method: 'GET' });
  client.post = (endpoint, data) => 
    client.request.bind(client, endpoint, { 
      method: 'POST', 
      body: JSON.stringify(data) 
    })();
  client.put = (endpoint, data) => 
    client.request.bind(client, endpoint, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    })();
  client.delete = client.request.bind(client, '', { method: 'DELETE' });
  
  return client;
}

// 4. Middleware chain with bound context
function createMiddlewareChain() {
  const middlewares = [];
  
  function use(middleware) {
    const boundMiddleware = middleware.bind(this);
    middlewares.push(boundMiddleware);
  }
  
  function execute(context) {
    let index = 0;
    
    function next() {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return middleware(context, next);
      }
    }
    
    return next();
  }
  
  return { use, execute };
}


// ## Key Production Benefits of `bind()`:

// 1. **Context Preservation**: Maintain `this` context when passing methods as callbacks
// 2. **Partial Application**: Create specialized functions with pre-set arguments
// 3. **Method Safety**: Prevent context loss in event handlers and async operations
// 4. **Dependency Injection**: Bind services and dependencies to methods
// 5. **Performance**: Avoid creating wrapper functions in loops
// 6. **Testing**: Easily mock bound methods in unit tests
// 7. **Memory Management**: Proper cleanup of bound event handlers

// These patterns are essential for building robust, maintainable Node.js backend systems with proper context management and clean separation of concerns.






























// Here's a comprehensive collection of production-grade JavaScript closure patterns and snippets for Node.js backend development:

// ## 1. Basic Closure Patterns

// 1.1 Basic closure with private state
function createCounter() {
  let count = 0; // Private variable
  
  return {
    increment: function() {
      count++;
      return count;
    },
    decrement: function() {
      count--;
      return count;
    },
    getValue: function() {
      return count;
    },
    reset: function() {
      count = 0;
      return count;
    }
  };
}

// Usage
const counter = createCounter();
console.log(counter.increment()); // 1
console.log(counter.increment()); // 2
console.log(counter.getValue());  // 2
console.log(counter.decrement()); // 1
console.log(counter.reset());     // 0

// 1.2 Closure with configuration
function createApiClient(baseURL, defaultHeaders = {}) {
  const config = {
    baseURL,
    headers: { ...defaultHeaders },
    timeout: 5000
  };
  
  return {
    setHeader: function(key, value) {
      config.headers[key] = value;
    },
    
    setTimeout: function(timeout) {
      config.timeout = timeout;
    },
    
    request: async function(endpoint, options = {}) {
      const url = `${config.baseURL}${endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      try {
        const response = await fetch(url, {
          headers: { ...config.headers, ...options.headers },
          signal: controller.signal,
          ...options
        });
        
        clearTimeout(timeoutId);
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    
    getConfig: function() {
      return { ...config }; // Return copy to prevent mutation
    }
  };
}

// Usage
const apiClient = createApiClient('https://api.example.com', {
  'Authorization': 'Bearer token123'
});

apiClient.setHeader('Content-Type', 'application/json');
apiClient.setTimeout(10000);

// ## 2. Database Connection Management

// 2.1 Connection pool with closure
function createConnectionPool(config) {
  const {
    maxConnections = 10,
    connectionTimeout = 30000,
    acquireTimeout = 60000
  } = config;
  
  const connections = new Map();
  const waitingQueue = [];
  let activeConnections = 0;
  
  function createConnection() {
    // Simulate database connection
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection = {
      id: connectionId,
      createdAt: new Date(),
      lastUsed: new Date(),
      isBusy: false
    };
    
    connections.set(connectionId, connection);
    return connection;
  }
  
  return {
    async getConnection() {
      // Find available connection
      for (const [id, conn] of connections) {
        if (!conn.isBusy) {
          conn.isBusy = true;
          conn.lastUsed = new Date();
          activeConnections++;
          return {
            id: conn.id,
            release: () => {
              conn.isBusy = false;
              activeConnections--;
              
              // Process waiting queue
              if (waitingQueue.length > 0) {
                const resolve = waitingQueue.shift();
                resolve(this.getConnection());
              }
            }
          };
        }
      }
      
      // Create new connection if under limit
      if (connections.size < maxConnections) {
        const newConn = createConnection();
        newConn.isBusy = true;
        activeConnections++;
        return {
          id: newConn.id,
          release: () => {
            newConn.isBusy = false;
            activeConnections--;
          }
        };
      }
      
      // Wait for available connection
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Connection acquire timeout'));
        }, acquireTimeout);
        
        waitingQueue.push((connection) => {
          clearTimeout(timeoutId);
          resolve(connection);
        });
      });
    },
    
    getStats() {
      return {
        totalConnections: connections.size,
        activeConnections,
        waitingRequests: waitingQueue.length,
        availableConnections: connections.size - activeConnections
      };
    },
    
    closeAll() {
      connections.clear();
      waitingQueue.length = 0;
      activeConnections = 0;
    }
  };
}

// Usage
const pool = createConnectionPool({
  maxConnections: 5,
  connectionTimeout: 30000
});

async function executeQuery(query) {
  const connection = await pool.getConnection();
  try {
    // Execute query using connection
    console.log(`Executing query: ${query} on connection: ${connection.id}`);
    return { result: 'success', data: [] };
  } finally {
    connection.release();
  }
}

// 2.2 Transaction management with closure
function createTransactionManager(db) {
  let currentTransaction = null;
  
  return {
    async startTransaction() {
      if (currentTransaction) {
        throw new Error('Transaction already in progress');
      }
      
      const session = await db.startSession();
      session.startTransaction();
      
      currentTransaction = {
        session,
        commit: async () => {
          await session.commitTransaction();
          currentTransaction = null;
        },
        abort: async () => {
          await session.abortTransaction();
          currentTransaction = null;
        }
      };
      
      return currentTransaction;
    },
    
    async withTransaction(callback) {
      const transaction = await this.startTransaction();
      
      try {
        const result = await callback(transaction.session);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.abort();
        throw error;
      }
    },
    
    getCurrentTransaction() {
      return currentTransaction;
    },
    
    isInTransaction() {
      return currentTransaction !== null;
    }
  };
}

// ## 3. Caching System with Closures

// 3.1 Memory cache with TTL and closure
function createCache(options = {}) {
  const {
    defaultTTL = 300000, // 5 minutes
    maxSize = 1000,
    cleanupInterval = 60000 // 1 minute
  } = options;
  
  const cache = new Map();
  const timestamps = new Map();
  let size = 0;
  
  // Cleanup expired entries periodically
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of timestamps.entries()) {
      const ttl = timestamps.get(key)?.ttl || defaultTTL;
      if (now - timestamp.createdAt > ttl) {
        cache.delete(key);
        timestamps.delete(key);
        size--;
      }
    }
  }, cleanupInterval);
  
  return {
    set(key, value, ttl = defaultTTL) {
      // Remove oldest entry if at max size
      if (size >= maxSize && !cache.has(key)) {
        const firstKey = cache.keys().next().value;
        this.delete(firstKey);
      }
      
      if (!cache.has(key)) size++;
      
      cache.set(key, value);
      timestamps.set(key, {
        createdAt: Date.now(),
        ttl
      });
      
      return true;
    },
    
    get(key) {
      const value = cache.get(key);
      const timestamp = timestamps.get(key);
      
      if (value && timestamp) {
        const now = Date.now();
        if (now - timestamp.createdAt > timestamp.ttl) {
          this.delete(key);
          return null;
        }
        
        // Update access time (optional)
        timestamps.set(key, {
          ...timestamp,
          lastAccessed: now
        });
        
        return value;
      }
      
      return null;
    },
    
    delete(key) {
      const existed = cache.has(key);
      if (existed) size--;
      
      cache.delete(key);
      timestamps.delete(key);
      return existed;
    },
    
    clear() {
      cache.clear();
      timestamps.clear();
      size = 0;
    },
    
    has(key) {
      return this.get(key) !== null;
    },
    
    keys() {
      return Array.from(cache.keys());
    },
    
    size() {
      return size;
    },
    
    stats() {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [key, timestamp] of timestamps.entries()) {
        if (now - timestamp.createdAt > timestamp.ttl) {
          expiredCount++;
        }
      }
      
      return {
        total: size,
        expired: expiredCount,
        hitRate: this.calculateHitRate()
      };
    },
    
    calculateHitRate() {
      // Implementation for hit rate calculation
      return 0.95; // Example
    },
    
    // Cleanup resources
    destroy() {
      clearInterval(cleanupTimer);
      this.clear();
    }
  };
}

// 3.2 Cache with middleware support
function createAdvancedCache(options = {}) {
  const cache = createCache(options);
  const middlewares = {
    beforeGet: [],
    afterGet: [],
    beforeSet: [],
    afterSet: []
  };
  
  function use(hook, middleware) {
    if (middlewares[hook]) {
      middlewares[hook].push(middleware);
    }
  }
  
  async function runMiddlewares(hook, ...args) {
    for (const middleware of middlewares[hook]) {
      await middleware(...args);
    }
  }
  
  return {
    async get(key) {
      await runMiddlewares('beforeGet', key);
      
      const value = cache.get(key);
      
      await runMiddlewares('afterGet', key, value);
      
      return value;
    },
    
    async set(key, value, ttl) {
      await runMiddlewares('beforeSet', key, value, ttl);
      
      const result = cache.set(key, value, ttl);
      
      await runMiddlewares('afterSet', key, value, ttl, result);
      
      return result;
    },
    
    delete: cache.delete.bind(cache),
    clear: cache.clear.bind(cache),
    has: cache.has.bind(cache),
    keys: cache.keys.bind(cache),
    size: cache.size.bind(cache),
    stats: cache.stats.bind(cache),
    use,
    destroy: cache.destroy.bind(cache)
  };
}

// Usage with middleware
const cache = createAdvancedCache();

cache.use('beforeSet', async (key, value) => {
  console.log(`Setting cache key: ${key}`);
  // Validate or transform value before caching
});

cache.use('afterGet', async (key, value) => {
  if (value) {
    console.log(`Cache hit for key: ${key}`);
  } else {
    console.log(`Cache miss for key: ${key}`);
  }
});

// ## 4. Authentication & Authorization

// 4.1 JWT token manager with closure
function createTokenManager(secret, options = {}) {
  const {
    accessTokenExpiry = '15m',
    refreshTokenExpiry = '7d',
    issuer = 'my-app'
  } = options;
  
  const blacklistedTokens = new Set();
  const refreshTokens = new Map();
  
  return {
    generateTokens(payload) {
      const accessToken = jwt.sign(
        { ...payload, type: 'access' },
        secret,
        { expiresIn: accessTokenExpiry, issuer }
      );
      
      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        secret,
        { expiresIn: refreshTokenExpiry, issuer }
      );
      
      // Store refresh token
      refreshTokens.set(refreshToken, {
        userId: payload.userId,
        createdAt: new Date()
      });
      
      return { accessToken, refreshToken };
    },
    
    verifyToken(token, type = 'access') {
      if (blacklistedTokens.has(token)) {
        throw new Error('Token has been blacklisted');
      }
      
      try {
        const decoded = jwt.verify(token, secret, { issuer });
        
        if (decoded.type !== type) {
          throw new Error(`Invalid token type: expected ${type}, got ${decoded.type}`);
        }
        
        return decoded;
      } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    },
    
    refreshAccessToken(refreshToken) {
      if (!refreshTokens.has(refreshToken)) {
        throw new Error('Invalid refresh token');
      }
      
      const tokenInfo = refreshTokens.get(refreshToken);
      const decoded = this.verifyToken(refreshToken, 'refresh');
      
      // Generate new access token
      const { iat, exp, type, ...payload } = decoded;
      const newAccessToken = jwt.sign(
        { ...payload, type: 'access' },
        secret,
        { expiresIn: accessTokenExpiry, issuer }
      );
      
      return newAccessToken;
    },
    
    blacklistToken(token) {
      blacklistedTokens.add(token);
      
      // Cleanup blacklisted tokens after expiry
      setTimeout(() => {
        blacklistedTokens.delete(token);
      }, 24 * 60 * 60 * 1000); // 24 hours
    },
    
    revokeRefreshToken(refreshToken) {
      refreshTokens.delete(refreshToken);
    },
    
    cleanupExpiredTokens() {
      const now = new Date();
      for (const [token, info] of refreshTokens.entries()) {
        try {
          jwt.verify(token, secret);
        } catch (error) {
          refreshTokens.delete(token);
        }
      }
    },
    
    getStats() {
      return {
        blacklistedTokens: blacklistedTokens.size,
        activeRefreshTokens: refreshTokens.size
      };
    }
  };
}

// 4.2 Role-based access control with closure
function createRBAC(rolesConfig) {
  const roles = new Map();
  const permissions = new Map();
  
  // Initialize roles and permissions
  Object.entries(rolesConfig).forEach(([role, rolePermissions]) => {
    roles.set(role, new Set(rolePermissions));
    rolePermissions.forEach(permission => {
      if (!permissions.has(permission)) {
        permissions.set(permission, new Set());
      }
      permissions.get(permission).add(role);
    });
  });
  
  return {
    can(role, permission) {
      const rolePermissions = roles.get(role);
      return rolePermissions ? rolePermissions.has(permission) : false;
    },
    
    getRolesForPermission(permission) {
      return Array.from(permissions.get(permission) || []);
    },
    
    getPermissionsForRole(role) {
      return Array.from(roles.get(role) || []);
    },
    
    addPermissionToRole(role, permission) {
      if (!roles.has(role)) {
        roles.set(role, new Set());
      }
      
      roles.get(role).add(permission);
      
      if (!permissions.has(permission)) {
        permissions.set(permission, new Set());
      }
      
      permissions.get(permission).add(role);
    },
    
    removePermissionFromRole(role, permission) {
      if (roles.has(role)) {
        roles.get(role).delete(permission);
      }
      
      if (permissions.has(permission)) {
        permissions.get(permission).delete(role);
        
        if (permissions.get(permission).size === 0) {
          permissions.delete(permission);
        }
      }
    },
    
    createUserContext(userRoles) {
      const userRolesSet = new Set(userRoles);
      
      return {
        can: (permission) => {
          for (const role of userRolesSet) {
            if (this.can(role, permission)) {
              return true;
            }
          }
          return false;
        },
        
        canAny: (requiredPermissions) => {
          return requiredPermissions.some(permission => 
            this.can(permission)
          );
        },
        
        canAll: (requiredPermissions) => {
          return requiredPermissions.every(permission => 
            this.can(permission)
          );
        },
        
        getPermissions() {
          const userPermissions = new Set();
          userRolesSet.forEach(role => {
            const rolePermissions = roles.get(role);
            if (rolePermissions) {
              rolePermissions.forEach(permission => 
                userPermissions.add(permission)
              );
            }
          });
          return Array.from(userPermissions);
        }
      };
    }
  };
}

// Usage
const rbac = createRBAC({
  admin: ['read', 'write', 'delete', 'manage_users'],
  user: ['read', 'write'],
  guest: ['read']
});

const userContext = rbac.createUserContext(['user']);
console.log(userContext.can('write')); // true
console.log(userContext.can('delete')); // false

// ## 5. Rate Limiting with Closures

// 5.1 Rate limiter with sliding window
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipFailedRequests = false,
    keyGenerator = (req) => req.ip
  } = options;
  
  const requests = new Map();
  
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
      if (validTimestamps.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, validTimestamps);
      }
    }
  }, windowMs);
  
  return {
    middleware() {
      return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        
        if (!requests.has(key)) {
          requests.set(key, []);
        }
        
        const timestamps = requests.get(key);
        const windowStart = now - windowMs;
        
        // Remove old timestamps
        const validTimestamps = timestamps.filter(ts => ts > windowStart);
        requests.set(key, validTimestamps);
        
        if (validTimestamps.length >= maxRequests) {
          res.setHeader('X-RateLimit-Limit', maxRequests);
          res.setHeader('X-RateLimit-Remaining', 0);
          res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
          
          return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }
        
        // Add current timestamp
        validTimestamps.push(now);
        
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - validTimestamps.length);
        res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
        
        // Hook into response to handle failed requests
        if (skipFailedRequests) {
          const originalSend = res.send;
          res.send = function(body) {
            if (res.statusCode >= 400) {
              // Remove the timestamp for failed requests
              const currentTimestamps = requests.get(key);
              if (currentTimestamps) {
                const index = currentTimestamps.indexOf(now);
                if (index > -1) {
                  currentTimestamps.splice(index, 1);
                }
              }
            }
            originalSend.call(this, body);
          };
        }
        
        next();
      };
    },
    
    check(key) {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(key)) {
        return { allowed: true, remaining: maxRequests };
      }
      
      const timestamps = requests.get(key);
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      requests.set(key, validTimestamps);
      
      const remaining = Math.max(0, maxRequests - validTimestamps.length);
      
      return {
        allowed: remaining > 0,
        remaining,
        resetTime: new Date(now + windowMs)
      };
    },
    
    getStats() {
      return {
        totalKeys: requests.size,
        windowMs,
        maxRequests
      };
    }
  };
}

// 5.2 Multi-level rate limiter
function createMultiLevelRateLimiter(limiters) {
  return {
    async middleware() {
      return async (req, res, next) => {
        try {
          for (const limiter of limiters) {
            const result = limiter.check(req);
            if (!result.allowed) {
              res.setHeader('X-RateLimit-Limit', result.limit);
              res.setHeader('X-RateLimit-Remaining', 0);
              res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
              
              return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
              });
            }
          }
          
          next();
        } catch (error) {
          next(error);
        }
      };
    },
    
    check(req) {
      for (const limiter of limiters) {
        const result = limiter.check(req);
        if (!result.allowed) {
          return result;
        }
      }
      
      return { allowed: true };
    }
  };
}

// Usage
const ipLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 60  // 60 requests per minute
});

const userLimiter = createRateLimiter({
  windowMs: 3600000, // 1 hour
  maxRequests: 1000, // 1000 requests per hour
  keyGenerator: (req) => req.user?.id || 'anonymous'
});

const multiLimiter = createMultiLevelRateLimiter([ipLimiter, userLimiter]);

app.use(multiLimiter.middleware());

// ## 6. Configuration Management

// 6.1 Configuration manager with closure
function createConfigManager(defaultConfig = {}) {
  let config = { ...defaultConfig };
  const watchers = new Map();
  const validators = new Map();
  
  function validate(key, value) {
    const validator = validators.get(key);
    if (validator && !validator(value)) {
      throw new Error(`Invalid value for ${key}: ${value}`);
    }
  }
  
  function notifyWatchers(key, newValue, oldValue) {
    if (watchers.has(key)) {
      watchers.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error(`Config watcher error for ${key}:`, error);
        }
      });
    }
  }
  
  return {
    get(key, defaultValue = null) {
      const value = key.split('.').reduce((obj, k) => obj?.[k], config);
      return value !== undefined ? value : defaultValue;
    },
    
    set(key, value) {
      const keys = key.split('.');
      const lastKey = keys.pop();
      let current = config;
      
      // Validate before setting
      validate(key, value);
      
      // Navigate to nested object
      for (const k of keys) {
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
      
      const oldValue = current[lastKey];
      current[lastKey] = value;
      
      // Notify watchers
      notifyWatchers(key, value, oldValue);
      
      return true;
    },
    
    has(key) {
      return this.get(key) !== undefined;
    },
    
    watch(key, callback) {
      if (!watchers.has(key)) {
        watchers.set(key, []);
      }
      watchers.get(key).push(callback);
      
      // Return unwatch function
      return () => {
        const callbacks = watchers.get(key);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      };
    },
    
    validator(key, validatorFn) {
      validators.set(key, validatorFn);
    },
    
    loadFromEnv(prefix = 'APP_') {
      for (const [envKey, envValue] of Object.entries(process.env)) {
        if (envKey.startsWith(prefix)) {
          const configKey = envKey
            .slice(prefix.length)
            .toLowerCase()
            .split('_')
            .map((part, index) => 
              index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
            )
            .join('');
          
          let value = envValue;
          
          // Try to parse JSON values
          if (envValue && (envValue.startsWith('{') || envValue.startsWith('['))) {
            try {
              value = JSON.parse(envValue);
            } catch {
              // Keep as string if not valid JSON
            }
          }
          
          // Convert string booleans and numbers
          if (envValue === 'true') value = true;
          if (envValue === 'false') value = false;
          if (!isNaN(envValue) && envValue.trim() !== '') value = Number(envValue);
          
          this.set(configKey, value);
        }
      }
    },
    
    toJSON() {
      return JSON.parse(JSON.stringify(config));
    },
    
    reset() {
      config = { ...defaultConfig };
    }
  };
}

// Usage
const config = createConfigManager({
  database: {
    host: 'localhost',
    port: 5432
  },
  server: {
    port: 3000,
    env: 'development'
  }
});

config.validator('server.port', (value) => {
  return typeof value === 'number' && value > 0 && value < 65536;
});

config.watch('server.port', (newPort, oldPort) => {
  console.log(`Port changed from ${oldPort} to ${newPort}`);
});

config.loadFromEnv('APP_');

// ## 7. Logger with Closure

// 7.1 Advanced logger with closure
function createLogger(options = {}) {
  const {
    level = 'info',
    transports = [console],
    format = 'json',
    timestamp = true
  } = options;
  
  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  const currentLevel = levels[level] || levels.info;
  
  function shouldLog(level) {
    return levels[level] <= currentLevel;
  }
  
  function formatMessage(level, message, meta) {
    const base = {
      level,
      message,
      timestamp: timestamp ? new Date().toISOString() : undefined,
      ...meta
    };
    
    if (format === 'json') {
      return JSON.stringify(base);
    }
    
    // Simple format
    return `[${base.timestamp}] ${level.toUpperCase()}: ${message} ${
      meta ? JSON.stringify(meta) : ''
    }`;
  }
  
  function log(level, message, meta = {}) {
    if (!shouldLog(level)) return;
    
    const formattedMessage = formatMessage(level, message, meta);
    
    transports.forEach(transport => {
      if (transport[level]) {
        transport[level](formattedMessage);
      } else if (typeof transport === 'function') {
        transport(formattedMessage);
      }
    });
  }
  
  return {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta),
    
    child(additionalMeta) {
      return createLogger({
        ...options,
        transports,
        format: (level, message, meta) => 
          formatMessage(level, message, { ...additionalMeta, ...meta })
      });
    },
    
    setLevel(newLevel) {
      if (levels[newLevel] !== undefined) {
        currentLevel = levels[newLevel];
      }
    },
    
    addTransport(transport) {
      transports.push(transport);
    },
    
    getLevel() {
      return Object.keys(levels).find(key => levels[key] === currentLevel);
    }
  };
}

// 7.2 Request-specific logger
function createRequestLogger(baseLogger) {
  const requestLoggers = new Map();
  
  return {
    forRequest(req) {
      const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (!requestLoggers.has(requestId)) {
        const requestLogger = baseLogger.child({
          requestId,
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        requestLoggers.set(requestId, requestLogger);
        
        // Cleanup after response (simplified)
        setTimeout(() => {
          requestLoggers.delete(requestId);
        }, 60000); // Cleanup after 1 minute
      }
      
      return requestLoggers.get(requestId);
    },
    
    cleanup() {
      requestLoggers.clear();
    }
  };
}

// Usage
const logger = createLogger({
  level: 'debug',
  format: 'json'
});

const requestLogger = createRequestLogger(logger);

app.use((req, res, next) => {
  req.logger = requestLogger.forRequest(req);
  next();
});

app.get('/api/users', (req, res) => {
  req.logger.info('Fetching users', { userId: req.user.id });
  // ... handler logic
});

// ## 8. Middleware Composition

// 8.1 Middleware composer with closure
function createMiddlewarePipeline() {
  const middlewares = [];
  
  function use(middleware) {
    if (Array.isArray(middleware)) {
      middlewares.push(...middleware);
    } else {
      middlewares.push(middleware);
    }
  }
  
  function execute(context) {
    let index = 0;
    
    function next(err) {
      if (err) {
        // Error handling middleware
        const errorMiddleware = middlewares.find(mw => mw.length === 4);
        if (errorMiddleware) {
          return errorMiddleware(err, context, null, next);
        }
        throw err;
      }
      
      if (index >= middlewares.length) {
        return Promise.resolve();
      }
      
      const middleware = middlewares[index++];
      
      try {
        if (middleware.length <= 2) {
          // Regular middleware (context, next)
          return Promise.resolve(middleware(context, next));
        } else {
          // Error-first middleware (err, context, next)
          return Promise.resolve(middleware(null, context, next));
        }
      } catch (error) {
        return next(error);
      }
    }
    
    return next();
  }
  
  return {
    use,
    execute,
    getMiddlewareCount() {
      return middlewares.length;
    }
  };
}

// 8.2 Conditional middleware with closure
function createConditionalMiddleware(condition, trueMiddleware, falseMiddleware = null) {
  return async (context, next) => {
    const shouldExecute = await condition(context);
    
    if (shouldExecute) {
      return trueMiddleware(context, next);
    } else if (falseMiddleware) {
      return falseMiddleware(context, next);
    } else {
      return next();
    }
  };
}

// Usage
const pipeline = createMiddlewarePipeline();

pipeline.use([
  // Logging middleware
  async (ctx, next) => {
    console.log(`[${new Date().toISOString()}] ${ctx.req.method} ${ctx.req.url}`);
    await next();
    console.log(`[${new Date().toISOString()}] Completed with status ${ctx.res.statusCode}`);
  },
  
  // Authentication middleware
  createConditionalMiddleware(
    (ctx) => !ctx.req.url.startsWith('/public'),
    async (ctx, next) => {
      const token = ctx.req.headers.authorization;
      if (!token) {
        throw new Error('Authentication required');
      }
      ctx.user = await verifyToken(token);
      await next();
    }
  ),
  
  // Error handling middleware
  async (err, ctx, next) => {
    console.error('Middleware error:', err);
    ctx.res.statusCode = 500;
    ctx.res.end('Internal Server Error');
  }
]);

// Execute pipeline
await pipeline.execute({ req, res });

// ## 9. Factory Patterns with Closures

// 9.1 Service factory with dependency injection
function createServiceFactory(services) {
  const instances = new Map();
  const dependencies = new Map();
  
  function register(name, factory, deps = []) {
    dependencies.set(name, { factory, deps });
  }
  
  function get(name) {
    if (instances.has(name)) {
      return instances.get(name);
    }
    
    const serviceInfo = dependencies.get(name);
    if (!serviceInfo) {
      throw new Error(`Service not found: ${name}`);
    }
    
    const resolvedDeps = serviceInfo.deps.map(dep => get(dep));
    const instance = serviceInfo.factory(...resolvedDeps);
    
    instances.set(name, instance);
    return instance;
  }
  
  function clear() {
    instances.clear();
  }
  
  return {
    register,
    get,
    clear,
    has: (name) => dependencies.has(name),
    list: () => Array.from(dependencies.keys())
  };
}

// 9.2 Repository factory
function createRepositoryFactory(db, logger) {
  const repositories = new Map();
  
  function create(modelName, schema) {
    if (repositories.has(modelName)) {
      return repositories.get(modelName);
    }
    
    const repository = {
      async findById(id) {
        logger.debug(`Finding ${modelName} by id: ${id}`);
        // Implementation using db
        return { id, name: 'Example' };
      },
      
      async create(data) {
        logger.debug(`Creating ${modelName}`, data);
        // Implementation using db
        return { id: 1, ...data };
      },
      
      async update(id, updates) {
        logger.debug(`Updating ${modelName} ${id}`, updates);
        // Implementation using db
        return { id, ...updates };
      },
      
      async delete(id) {
        logger.debug(`Deleting ${modelName} ${id}`);
        // Implementation using db
        return true;
      }
    };
    
    repositories.set(modelName, repository);
    return repository;
  }
  
  return {
    create,
    get: (modelName) => repositories.get(modelName),
    has: (modelName) => repositories.has(modelName),
    list: () => Array.from(repositories.keys())
  };
}

// Usage
const serviceFactory = createServiceFactory();

serviceFactory.register('logger', () => createLogger());
serviceFactory.register('database', () => createDatabaseConnection());
serviceFactory.register('userRepository', (db, logger) => 
  createRepositoryFactory(db, logger).create('users')
);
serviceFactory.register('userService', (userRepository, logger) => ({
  getUser: (id) => userRepository.findById(id),
  createUser: (data) => userRepository.create(data)
}));

const userService = serviceFactory.get('userService');

// ## Key Production Benefits of Closures:

// 1. **Data Encapsulation**: Private state that's inaccessible from outside
// 2. **Memory Efficiency**: Shared methods with separate data instances
// 3. **Configuration Persistence**: Maintain configuration across function calls
// 4. **Dependency Management**: Clean dependency injection patterns
// 5. **Resource Management**: Proper cleanup of timers, connections, and listeners
// 6. **Middleware Composition**: Flexible request processing pipelines
// 7. **Caching Strategies**: Efficient caching with TTL and cleanup
// 8. **Security**: Protected authentication and authorization logic

// These closure patterns are essential for building scalable, maintainable, and secure Node.js backend applications with proper separation of concerns and efficient resource management.
































// Here are comprehensive code snippets for IIFE (Immediately Invoked Function Expressions) in Node.js production-grade backend development:

// ## 1. Basic IIFE Patterns

// Basic IIFE
(function() {
    console.log('IIFE executed immediately');
})();

// Arrow function IIFE
(() => {
    console.log('Arrow function IIFE');
})();

// Async IIFE
(async () => {
    const data = await fetchData();
    console.log('Async IIFE completed:', data);
})();

// ## 2. Module Initialization with IIFE

// Database connection module with IIFE
const database = (function() {
    let connection = null;
    let isConnected = false;

    async function connect() {
        try {
            // Simulate DB connection
            connection = await simulateDBConnection();
            isConnected = true;
            console.log('Database connected successfully');
            return connection;
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    function getConnection() {
        if (!isConnected) {
            throw new Error('Database not connected');
        }
        return connection;
    }

    function disconnect() {
        connection = null;
        isConnected = false;
        console.log('Database disconnected');
    }

    // Auto-connect when module loads (in production, you might want explicit connection)
    // connect().catch(console.error);

    return {
        connect,
        getConnection,
        disconnect,
        isConnected: () => isConnected
    };
})();

// Usage
await database.connect();
const conn = database.getConnection();

// ## 3. Configuration Management with IIFE

// Configuration loader with caching and validation
const config = (function() {
    const _cache = new Map();
    let _isLoaded = false;

    function loadEnvironmentVariables() {
        const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'JWT_SECRET'];
        
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        return {
            database: {
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT),
                username: process.env.DB_USERNAME || 'default',
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            },
            jwt: {
                secret: process.env.JWT_SECRET,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            },
            server: {
                port: parseInt(process.env.PORT) || 3000,
                nodeEnv: process.env.NODE_ENV || 'development'
            }
        };
    }

    function getConfig() {
        if (!_isLoaded) {
            const configData = loadEnvironmentVariables();
            _cache.set('config', configData);
            _isLoaded = true;
        }
        return _cache.get('config');
    }

    function refreshConfig() {
        _isLoaded = false;
        _cache.delete('config');
        return getConfig();
    }

    // Pre-load config on module initialization
    getConfig();

    return {
        get: getConfig,
        refresh: refreshConfig
    };
})();

// Usage
const dbConfig = config.get().database;

// ## 4. Service Factory with IIFE

// Service factory for dependency injection
const serviceFactory = (function() {
    const _services = new Map();
    const _dependencies = new Map();

    function registerService(name, factory, dependencies = []) {
        _dependencies.set(name, dependencies);
        _services.set(name, factory);
    }

    function getService(name) {
        if (!_services.has(name)) {
            throw new Error(`Service '${name}' not registered`);
        }

        const dependencies = _dependencies.get(name);
        const resolvedDependencies = dependencies.map(dep => getService(dep));
        
        return _services.get(name)(...resolvedDependencies);
    }

    function hasService(name) {
        return _services.has(name);
    }

    return {
        register: registerService,
        get: getService,
        has: hasService
    };
})();

// Register services
serviceFactory.register('logger', () => {
    return {
        info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
        error: (message) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`)
    };
});

serviceFactory.register('database', () => {
    return {
        query: async (sql) => {
            // Simulate database query
            return { rows: [] };
        }
    };
});

serviceFactory.register('userService', (logger, database) => {
    return {
        async getUser(id) {
            logger.info(`Fetching user ${id}`);
            return await database.query('SELECT * FROM users WHERE id = ?', [id]);
        }
    };
}, ['logger', 'database']);

// Usage
const userService = serviceFactory.get('userService');

// ## 5. Cache Management with IIFE

// Production-grade cache manager
const cacheManager = (function() {
    const _cache = new Map();
    const _ttl = new Map();
    const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

    function set(key, value, ttl = DEFAULT_TTL) {
        _cache.set(key, value);
        _ttl.set(key, Date.now() + ttl);
        
        // Auto cleanup after TTL
        setTimeout(() => {
            if (_ttl.get(key) <= Date.now()) {
                this.del(key);
            }
        }, ttl);
        
        return true;
    }

    function get(key) {
        const expiry = _ttl.get(key);
        
        if (expiry && expiry <= Date.now()) {
            this.del(key);
            return null;
        }
        
        return _cache.get(key) || null;
    }

    function del(key) {
        _cache.delete(key);
        _ttl.delete(key);
        return true;
    }

    function clear() {
        _cache.clear();
        _ttl.clear();
    }

    function has(key) {
        const expiry = _ttl.get(key);
        if (expiry && expiry <= Date.now()) {
            this.del(key);
            return false;
        }
        return _cache.has(key);
    }

    function size() {
        // Clean expired entries before returning size
        this._cleanExpired();
        return _cache.size;
    }

    function _cleanExpired() {
        const now = Date.now();
        for (const [key, expiry] of _ttl.entries()) {
            if (expiry <= now) {
                this.del(key);
            }
        }
    }

    // Periodic cleanup (every hour)
    setInterval(() => {
        this._cleanExpired();
    }, 60 * 60 * 1000);

    return {
        set,
        get,
        del,
        clear,
        has,
        size,
        _cleanExpired
    };
})();

// Usage
cacheManager.set('user:123', { name: 'John', email: 'john@example.com' }, 10 * 60 * 1000);
const user = cacheManager.get('user:123');

// ## 6. Rate Limiter with IIFE

// Production rate limiter
const rateLimiter = (function() {
    const _requests = new Map();
    const _cleanupInterval = 60 * 1000; // 1 minute

    function isRateLimited(identifier, maxRequests, windowMs) {
        const now = Date.now();
        const key = `${identifier}:${Math.floor(now / windowMs)}`;
        
        const currentCount = _requests.get(key) || 0;
        
        if (currentCount >= maxRequests) {
            return true;
        }
        
        _requests.set(key, currentCount + 1);
        return false;
    }

    function getRemainingRequests(identifier, maxRequests, windowMs) {
        const now = Date.now();
        const key = `${identifier}:${Math.floor(now / windowMs)}`;
        const currentCount = _requests.get(key) || 0;
        
        return Math.max(0, maxRequests - currentCount);
    }

    function _cleanupExpired() {
        const now = Date.now();
        const currentWindow = Math.floor(now / 60000); // Current minute
        
        for (const [key] of _requests.entries()) {
            const window = parseInt(key.split(':')[1]);
            if (window < currentWindow - 1) { // Keep only current and previous window
                _requests.delete(key);
            }
        }
    }

    // Regular cleanup
    setInterval(_cleanupExpired, _cleanupInterval);

    return {
        isRateLimited,
        getRemainingRequests,
        _cleanupExpired // Exposed for testing
    };
})();

// Usage in Express middleware
const rateLimitMiddleware = (req, res, next) => {
    const identifier = req.ip; // Use IP address as identifier
    const maxRequests = 100; // 100 requests per window
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (rateLimiter.isRateLimited(identifier, maxRequests, windowMs)) {
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
    
    res.set('X-RateLimit-Remaining', 
        rateLimiter.getRemainingRequests(identifier, maxRequests, windowMs));
    next();
};

// ## 7. Event Bus with IIFE

// Event bus for microservices communication
const eventBus = (function() {
    const _listeners = new Map();
    const _middlewares = [];

    function on(event, callback) {
        if (!_listeners.has(event)) {
            _listeners.set(event, new Set());
        }
        _listeners.get(event).add(callback);
        
        // Return unsubscribe function
        return () => {
            _listeners.get(event)?.delete(callback);
        };
    }

    function off(event, callback) {
        _listeners.get(event)?.delete(callback);
    }

    async function emit(event, data) {
        const listeners = _listeners.get(event) || new Set();
        
        // Apply middlewares
        let processedData = data;
        for (const middleware of _middlewares) {
            processedData = await middleware(event, processedData);
        }
        
        // Execute listeners
        const promises = Array.from(listeners).map(async listener => {
            try {
                await listener(processedData, event);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
        
        await Promise.allSettled(promises);
    }

    function use(middleware) {
        _middlewares.push(middleware);
    }

    function removeAllListeners(event) {
        if (event) {
            _listeners.delete(event);
        } else {
            _listeners.clear();
        }
    }

    return {
        on,
        off,
        emit,
        use,
        removeAllListeners
    };
})();

// Usage
const unsubscribe = eventBus.on('user.created', async (userData) => {
    console.log('User created:', userData);
    // Send welcome email, create profile, etc.
});

eventBus.emit('user.created', { id: 1, name: 'John Doe', email: 'john@example.com' });

// ## 8. Database Connection Pool with IIFE

// Database connection pool manager
const dbPool = (function() {
    const _pool = [];
    const _config = {
        maxConnections: 10,
        minConnections: 2,
        acquireTimeout: 30000,
        idleTimeout: 60000
    };
    let _currentConnections = 0;

    async function createConnection() {
        // Simulate database connection
        return {
            id: _currentConnections++,
            query: async (sql) => {
                console.log(`Executing: ${sql}`);
                return { rows: [] };
            },
            close: () => {
                console.log(`Connection ${this.id} closed`);
            }
        };
    }

    async function initialize() {
        for (let i = 0; i < _config.minConnections; i++) {
            const connection = await createConnection();
            _pool.push(connection);
        }
        console.log(`Database pool initialized with ${_pool.length} connections`);
    }

    async function getConnection() {
        if (_pool.length > 0) {
            return _pool.pop();
        }
        
        if (_currentConnections < _config.maxConnections) {
            return await createConnection();
        }
        
        throw new Error('No available connections in pool');
    }

    function releaseConnection(connection) {
        if (_pool.length < _config.maxConnections) {
            _pool.push(connection);
        } else {
            connection.close();
            _currentConnections--;
        }
    }

    function getPoolStatus() {
        return {
            available: _pool.length,
            total: _currentConnections,
            max: _config.maxConnections
        };
    }

    // Auto-initialize on module load
    initialize().catch(console.error);

    return {
        getConnection,
        releaseConnection,
        getPoolStatus,
        initialize
    };
})();

// Usage
const connection = await dbPool.getConnection();
try {
    const result = await connection.query('SELECT * FROM users');
    console.log(result);
} finally {
    dbPool.releaseConnection(connection);
}

// ## 9. Security Utils with IIFE

// Security utilities for production
const securityUtils = (function() {
    const crypto = require('crypto');
    
    // Private key (in production, use environment variables)
    const _encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    const _algorithm = 'aes-256-gcm';

    function encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(_algorithm, _encryptionKey);
        cipher.setAAD(Buffer.from('additional-data'));
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            iv: iv.toString('hex'),
            data: encrypted,
            authTag: authTag.toString('hex')
        };
    }

    function decrypt(encryptedData) {
        const decipher = crypto.createDecipher(_algorithm, _encryptionKey);
        decipher.setAAD(Buffer.from('additional-data'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    function hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return { salt, hash };
    }

    function verifyPassword(password, salt, hash) {
        const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return verifyHash === hash;
    }

    function generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    return {
        encrypt,
        decrypt,
        hashPassword,
        verifyPassword,
        generateToken,
        sanitizeInput
    };
})();

// Usage
const encrypted = securityUtils.encrypt('sensitive data');
const decrypted = securityUtils.decrypt(encrypted);

const passwordData = securityUtils.hashPassword('myPassword');
const isValid = securityUtils.verifyPassword('myPassword', passwordData.salt, passwordData.hash);

// ## 10. Error Handler with IIFE

// Centralized error handling
const errorHandler = (function() {
    const _logger = console; // In production, use a proper logger
    const _sentry = null; // Initialize with your error tracking service

    class AppError extends Error {
        constructor(message, statusCode = 500, isOperational = true) {
            super(message);
            this.statusCode = statusCode;
            this.isOperational = isOperational;
            this.timestamp = new Date().toISOString();
            
            Error.captureStackTrace(this, this.constructor);
        }
    }

    function handleError(error, context = {}) {
        // Log error
        _logger.error('Error occurred:', {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });

        // Send to error tracking service
        if (_sentry) {
            _sentry.captureException(error, { extra: context });
        }

        // Check if error is operational
        if (!error.isOperational) {
            // For programming errors, you might want to restart the process
            process.exit(1);
        }
    }

    function asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    function errorMiddleware(err, req, res, next) {
        handleError(err, { url: req.url, method: req.method });

        // Don't leak error details in production
        if (process.env.NODE_ENV === 'production') {
            return res.status(err.statusCode || 500).json({
                error: 'Something went wrong!',
                ...(err.isOperational && { message: err.message })
            });
        }

        // Development error response
        res.status(err.statusCode || 500).json({
            error: err.message,
            stack: err.stack,
            ...err
        });
    }

    return {
        AppError,
        handleError,
        asyncHandler,
        errorMiddleware
    };
})();

// Usage in Express app
app.get('/users/:id', errorHandler.asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) {
        throw new errorHandler.AppError('User not found', 404);
    }
    res.json(user);
}));

app.use(errorHandler.errorMiddleware);

// These IIFE patterns provide:

// 1. **Encapsulation** - Private variables and methods
// 2. **Singleton Pattern** - Single instance throughout the application
// 3. **Initialization Control** - Controlled setup and teardown
// 4. **Memory Efficiency** - Shared state where appropriate
// 5. **Production Readiness** - Error handling, logging, and monitoring
// 6. **Testability** - Well-defined interfaces for testing

// Choose the appropriate pattern based on your specific use case and requirements.





























// Here are comprehensive code snippets for returning multiple values in functions in Node.js production-grade backend development:

// ## 1. Object Destructuring Pattern

// User service with multiple return values
class UserService {
    async createUser(userData) {
        try {
            // Validation
            const validationResult = this.validateUserData(userData);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: validationResult.error,
                    statusCode: 400,
                    validationErrors: validationResult.details
                };
            }

            // Check if user exists
            const existingUser = await this.findUserByEmail(userData.email);
            if (existingUser) {
                return {
                    success: false,
                    error: 'User already exists',
                    statusCode: 409,
                    existingUserId: existingUser.id
                };
            }

            // Create user
            const user = await this.saveUser(userData);
            await this.sendWelcomeEmail(user.email);

            return {
                success: true,
                data: user,
                statusCode: 201,
                message: 'User created successfully',
                metadata: {
                    createdAt: user.createdAt,
                    emailVerified: false
                }
            };
        } catch (error) {
            return {
                success: false,
                error: 'Internal server error',
                statusCode: 500,
                internalError: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    validateUserData(userData) {
        const errors = [];
        
        if (!userData.email || !userData.email.includes('@')) {
            errors.push('Invalid email format');
        }
        
        if (!userData.password || userData.password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }

        return {
            isValid: errors.length === 0,
            error: errors.length > 0 ? 'Validation failed' : null,
            details: errors
        };
    }

    // Usage example
    async demo() {
        const result = await this.createUser({
            email: 'test@example.com',
            password: 'securepassword'
        });

        // Destructuring the return values
        const { success, data, error, statusCode, metadata } = result;

        if (success) {
            console.log('User created:', data);
            console.log('Metadata:', metadata);
        } else {
            console.error('Error:', error);
            console.log('Status:', statusCode);
        }
    }
}

// ## 2. Array Destructuring with Tuple Pattern

// Database operations with tuple returns
class DatabaseService {
    constructor() {
        this.pool = null; // Assume database connection pool
    }

    async executeTransaction(operations) {
        const connection = await this.pool.getConnection();
        
        try {
            await connection.beginTransaction();
            const results = [];

            for (const operation of operations) {
                const [success, data, error] = await this.executeOperation(connection, operation);
                
                if (!success) {
                    await connection.rollback();
                    return [false, null, error, { rolledBack: true, failedOperation: operation }];
                }
                
                results.push(data);
            }

            await connection.commit();
            return [true, results, null, { transactionId: this.generateTransactionId() }];
        } catch (error) {
            await connection.rollback();
            return [false, null, 'Transaction failed', { error: error.message }];
        } finally {
            connection.release();
        }
    }

    async executeOperation(connection, operation) {
        try {
            const { type, query, params } = operation;
            const [rows] = await connection.execute(query, params);
            
            return [true, rows, null];
        } catch (error) {
            return [false, null, `Operation failed: ${error.message}`];
        }
    }

    // Batch processing with tuple returns
    async processBatch(records, batchSize = 100) {
        const batches = this.chunkArray(records, batchSize);
        const successful = [];
        const failed = [];
        const errors = [];

        for (const [index, batch] of batches.entries()) {
            const [success, data, error, metadata] = await this.processSingleBatch(batch, index);
            
            if (success) {
                successful.push(...data.processed);
                if (data.skipped) {
                    failed.push(...data.skipped);
                }
            } else {
                failed.push(...batch);
                errors.push({
                    batchIndex: index,
                    error: error,
                    metadata: metadata
                });
            }
        }

        return [successful, failed, errors, {
            totalProcessed: successful.length,
            totalFailed: failed.length,
            batchCount: batches.length
        }];
    }

    async processSingleBatch(batch, batchIndex) {
        try {
            const processed = [];
            const skipped = [];

            for (const record of batch) {
                const [isValid, validationError] = this.validateRecord(record);
                
                if (isValid) {
                    const processedRecord = await this.transformRecord(record);
                    processed.push(processedRecord);
                } else {
                    skipped.push({
                        record,
                        error: validationError,
                        batchIndex
                    });
                }
            }

            return [true, { processed, skipped }, null, { batchIndex, processedCount: processed.length }];
        } catch (error) {
            return [false, null, `Batch ${batchIndex} processing failed`, { error: error.message }];
        }
    }

    // Usage example
    async demo() {
        const [successful, failed, errors, stats] = await this.processBatch([
            { id: 1, name: 'John' },
            { id: 2, name: 'Jane' }
        ], 50);

        console.log('Successful:', successful.length);
        console.log('Failed:', failed.length);
        console.log('Errors:', errors);
        console.log('Stats:', stats);
    }
}

// ## 3. Result Object Pattern for API Responses

// Standardized API response pattern
class ApiResponse {
    static success(data, metadata = {}) {
        return {
            success: true,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                ...metadata
            }
        };
    }

    static error(message, code = 'INTERNAL_ERROR', details = null) {
        return {
            success: false,
            error: {
                code,
                message,
                details,
                timestamp: new Date().toISOString()
            }
        };
    }

    static paginated(data, pagination) {
        return {
            success: true,
            data,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                pages: Math.ceil(pagination.total / pagination.limit),
                hasNext: pagination.page * pagination.limit < pagination.total,
                hasPrev: pagination.page > 1
            },
            metadata: {
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Usage in controller
class UserController {
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 10, search } = req.query;
            
            const [users, total, error] = await this.userService.getPaginatedUsers({
                page: parseInt(page),
                limit: parseInt(limit),
                search
            });

            if (error) {
                const response = ApiResponse.error(
                    'Failed to fetch users', 
                    'FETCH_USERS_ERROR', 
                    { details: error }
                );
                return res.status(500).json(response);
            }

            const response = ApiResponse.paginated(users, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            });

            res.json(response);
        } catch (error) {
            const response = ApiResponse.error(
                'Internal server error',
                'INTERNAL_ERROR',
                { stack: process.env.NODE_ENV === 'development' ? error.stack : undefined }
            );
            res.status(500).json(response);
        }
    }

    async createUser(req, res) {
        try {
            const userData = req.body;
            
            const result = await this.userService.createUser(userData);
            
            if (!result.success) {
                const response = ApiResponse.error(
                    result.error,
                    result.errorCode || 'CREATE_USER_ERROR',
                    {
                        validationErrors: result.validationErrors,
                        existingUserId: result.existingUserId
                    }
                );
                return res.status(result.statusCode || 400).json(response);
            }

            const response = ApiResponse.success(
                result.data,
                {
                    message: result.message,
                    ...result.metadata
                }
            );
            
            res.status(201).json(response);
        } catch (error) {
            const response = ApiResponse.error(
                'Failed to create user',
                'CREATE_USER_ERROR'
            );
            res.status(500).json(response);
        }
    }
}

// ## 4. Advanced Multiple Return with Status and Metadata

// File processing service with comprehensive returns
class FileProcessingService {
    async processUploadedFile(filePath, options = {}) {
        const startTime = Date.now();
        const results = {
            processed: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        try {
            // Validate file
            const [isValid, validationError, fileStats] = await this.validateFile(filePath);
            if (!isValid) {
                return {
                    status: 'VALIDATION_FAILED',
                    error: validationError,
                    fileStats,
                    results,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        processedAt: new Date().toISOString()
                    }
                };
            }

            // Parse file
            const [parseSuccess, records, parseError] = await this.parseFile(filePath);
            if (!parseSuccess) {
                return {
                    status: 'PARSE_FAILED',
                    error: parseError,
                    fileStats,
                    results,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        processedAt: new Date().toISOString()
                    }
                };
            }

            // Process records
            for (const [index, record] of records.entries()) {
                const [processedSuccess, processedData, processError] = 
                    await this.processSingleRecord(record, index);

                if (processedSuccess) {
                    results.processed++;
                    // Store successful processing data if needed
                } else if (processError === 'SKIPPED') {
                    results.skipped++;
                } else {
                    results.failed++;
                    results.errors.push({
                        recordIndex: index,
                        error: processError,
                        record: this.sanitizeRecord(record) // Remove sensitive data
                    });
                }
            }

            // Determine overall status
            let status = 'COMPLETED';
            if (results.failed > 0 && results.processed === 0) {
                status = 'FAILED';
            } else if (results.failed > 0) {
                status = 'PARTIAL_SUCCESS';
            }

            return {
                status,
                results,
                fileStats,
                metadata: {
                    processingTime: Date.now() - startTime,
                    processedAt: new Date().toISOString(),
                    totalRecords: records.length,
                    successRate: (results.processed / records.length) * 100
                }
            };

        } catch (error) {
            return {
                status: 'ERROR',
                error: error.message,
                results,
                metadata: {
                    processingTime: Date.now() - startTime,
                    processedAt: new Date().toISOString()
                }
            };
        }
    }

    async validateFile(filePath) {
        try {
            const fs = require('fs').promises;
            const stats = await fs.stat(filePath);
            
            if (stats.size > 100 * 1024 * 1024) { // 100MB limit
                return [false, 'File too large', stats];
            }

            if (stats.size === 0) {
                return [false, 'File is empty', stats];
            }

            return [true, null, stats];
        } catch (error) {
            return [false, `File validation failed: ${error.message}`, null];
        }
    }

    async processSingleRecord(record, index) {
        try {
            // Validate record
            const [isValid, validationError] = this.validateRecord(record);
            if (!isValid) {
                return [false, null, 'SKIPPED'];
            }

            // Transform record
            const transformed = this.transformRecord(record);
            
            // Save to database
            const [saveSuccess, savedData, saveError] = await this.saveRecord(transformed);
            
            if (!saveSuccess) {
                return [false, null, `Save failed: ${saveError}`];
            }

            return [true, savedData, null];
        } catch (error) {
            return [false, null, `Processing failed: ${error.message}`];
        }
    }

    // Usage example
    async demo() {
        const result = await this.processUploadedFile('/path/to/file.csv', {
            validate: true,
            batchSize: 1000
        });

        // Destructure based on status
        const { status, results, metadata, error, fileStats } = result;

        switch (status) {
            case 'COMPLETED':
                console.log(`Successfully processed ${results.processed} records`);
                console.log('Metadata:', metadata);
                break;
            case 'PARTIAL_SUCCESS':
                console.warn(`Partially processed: ${results.processed} success, ${results.failed} failed`);
                console.log('Errors:', results.errors.slice(0, 5)); // Log first 5 errors
                break;
            case 'FAILED':
                console.error('Processing failed:', error);
                console.log('File stats:', fileStats);
                break;
            case 'VALIDATION_FAILED':
                console.error('File validation failed:', error);
                break;
        }

        return result;
    }
}

// ## 5. Promise-based Multiple Returns

// Async operations with multiple return values
class AsyncOperations {
    async concurrentOperations(tasks, concurrencyLimit = 5) {
        const results = {
            successful: [],
            failed: [],
            timedOut: [],
            total: tasks.length
        };

        const executing = new Set();
        
        for (const [index, task] of tasks.entries()) {
            if (executing.size >= concurrencyLimit) {
                await Promise.race(executing);
            }

            const taskPromise = this.executeWithTimeout(task, 30000); // 30s timeout
            executing.add(taskPromise);

            taskPromise
                .then(([success, data, error, metadata]) => {
                    if (success) {
                        results.successful.push({
                            taskIndex: index,
                            data,
                            metadata
                        });
                    } else if (error === 'TIMEOUT') {
                        results.timedOut.push({
                            taskIndex: index,
                            task,
                            metadata
                        });
                    } else {
                        results.failed.push({
                            taskIndex: index,
                            error,
                            task,
                            metadata
                        });
                    }
                })
                .finally(() => {
                    executing.delete(taskPromise);
                });
        }

        // Wait for all remaining tasks
        await Promise.allSettled(executing);

        return [
            results.successful,
            results.failed,
            results.timedOut,
            {
                successRate: (results.successful.length / results.total) * 100,
                failureRate: (results.failed.length / results.total) * 100,
                timeoutRate: (results.timedOut.length / results.total) * 100
            }
        ];
    }

    async executeWithTimeout(task, timeoutMs) {
        const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve([false, null, 'TIMEOUT', { timeoutMs }]), timeoutMs)
        );

        const taskPromise = task().then(
            (result) => [true, result, null, { executedAt: new Date().toISOString() }],
            (error) => [false, null, error.message, { error: true }]
        );

        return Promise.race([taskPromise, timeoutPromise]);
    }

    // Batch processing with progress
    async processWithProgress(items, processor, batchSize = 10) {
        const batches = this.chunkArray(items, batchSize);
        const results = {
            processed: [],
            errors: [],
            progress: 0
        };

        for (const [batchIndex, batch] of batches.entries()) {
            const batchResults = await Promise.allSettled(
                batch.map((item, itemIndex) => 
                    processor(item, batchIndex * batchSize + itemIndex)
                )
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    const [success, data, error] = result.value;
                    
                    if (success) {
                        results.processed.push(data);
                    } else {
                        results.errors.push({
                            error,
                            item: data // might be partial data
                        });
                    }
                } else {
                    results.errors.push({
                        error: result.reason.message,
                        item: null
                    });
                }
            }

            // Update progress
            results.progress = ((batchIndex + 1) / batches.length) * 100;
            
            // Emit progress event if needed
            this.emitProgress(results.progress, batchIndex + 1, batches.length);
        }

        return [
            results.processed,
            results.errors,
            {
                totalProcessed: results.processed.length,
                totalErrors: results.errors.length,
                successRate: (results.processed.length / items.length) * 100
            }
        ];
    }
}

// ## 6. Database Transaction Pattern

// Database service with transaction support
class TransactionalService {
    async transferFunds(fromAccount, toAccount, amount) {
        const transaction = await this.startTransaction();
        
        try {
            // 1. Check if source account has sufficient funds
            const [hasFunds, currentBalance, balanceError] = 
                await this.checkAccountBalance(fromAccount, transaction);
            
            if (!hasFunds) {
                await transaction.rollback();
                return [false, null, 'INSUFFICIENT_FUNDS', {
                    currentBalance,
                    requiredAmount: amount
                }];
            }

            // 2. Deduct from source account
            const [deductSuccess, newSourceBalance, deductError] = 
                await this.deductFromAccount(fromAccount, amount, transaction);
            
            if (!deductSuccess) {
                await transaction.rollback();
                return [false, null, 'DEDUCTION_FAILED', {
                    error: deductError,
                    account: fromAccount
                }];
            }

            // 3. Add to destination account
            const [addSuccess, newDestBalance, addError] = 
                await this.addToAccount(toAccount, amount, transaction);
            
            if (!addSuccess) {
                await transaction.rollback();
                return [false, null, 'CREDIT_FAILED', {
                    error: addError,
                    account: toAccount
                }];
            }

            // 4. Create transaction record
            const [recordSuccess, transactionRecord, recordError] = 
                await this.createTransactionRecord({
                    fromAccount,
                    toAccount,
                    amount,
                    newSourceBalance,
                    newDestBalance
                }, transaction);

            if (!recordSuccess) {
                await transaction.rollback();
                return [false, null, 'RECORD_CREATION_FAILED', {
                    error: recordError
                }];
            }

            // 5. Commit transaction
            await transaction.commit();

            return [true, transactionRecord, null, {
                newSourceBalance,
                newDestBalance,
                transactionId: transactionRecord.id
            }];

        } catch (error) {
            await transaction.rollback();
            return [false, null, 'TRANSACTION_FAILED', {
                error: error.message,
                rolledBack: true
            }];
        }
    }

    // Usage example
    async demo() {
        const [success, transactionRecord, error, metadata] = 
            await this.transferFunds('acc123', 'acc456', 1000);

        if (success) {
            console.log('Transfer successful:', transactionRecord);
            console.log('New balances:', {
                source: metadata.newSourceBalance,
                destination: metadata.newDestBalance
            });
        } else {
            console.error('Transfer failed:', error);
            console.log('Error details:', metadata);
            
            // Handle specific error cases
            switch (error) {
                case 'INSUFFICIENT_FUNDS':
                    // Notify user about insufficient funds
                    break;
                case 'DEDUCTION_FAILED':
                    // Log and alert about deduction failure
                    break;
                default:
                    // Handle generic failure
                    break;
            }
        }
    }
}

// ## 7. Validation Service Pattern

// Comprehensive validation service
class ValidationService {
    validateUserRegistration(userData) {
        const errors = [];
        const warnings = [];
        const sanitizedData = { ...userData };

        // Email validation
        const [emailValid, emailError, emailSuggestions] = this.validateEmail(userData.email);
        if (!emailValid) {
            errors.push(`Email: ${emailError}`);
        } else if (emailSuggestions.length > 0) {
            warnings.push(`Email suggestions: ${emailSuggestions.join(', ')}`);
        } else {
            sanitizedData.email = userData.email.toLowerCase().trim();
        }

        // Password validation
        const [passwordValid, passwordError, passwordStrength] = this.validatePassword(userData.password);
        if (!passwordValid) {
            errors.push(`Password: ${passwordError}`);
        } else {
            sanitizedData.passwordStrength = passwordStrength;
        }

        // Age validation
        if (userData.age) {
            const [ageValid, ageError, ageCategory] = this.validateAge(userData.age);
            if (!ageValid) {
                errors.push(`Age: ${ageError}`);
            } else {
                sanitizedData.ageCategory = ageCategory;
            }
        }

        return {
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            errors,
            warnings,
            sanitizedData,
            metadata: {
                validatedAt: new Date().toISOString(),
                validationRules: this.getValidationRules()
            }
        };
    }

    validateEmail(email) {
        const errors = [];
        const suggestions = [];

        if (!email) {
            return [false, 'Email is required', []];
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return [false, 'Invalid email format', []];
        }

        // Check for common typos
        if (email.includes('gmial.com')) {
            suggestions.push('Did you mean gmail.com?');
        }

        // Check disposable emails
        if (this.isDisposableEmail(email)) {
            warnings.push('Disposable email addresses are not recommended');
        }

        return [true, null, suggestions];
    }

    validatePassword(password) {
        const strength = {
            score: 0,
            feedback: []
        };

        if (!password) {
            return [false, 'Password is required', strength];
        }

        if (password.length < 8) {
            return [false, 'Password must be at least 8 characters', strength];
        }

        // Calculate strength
        if (password.length >= 12) strength.score++;
        if (/[A-Z]/.test(password)) strength.score++;
        if (/[a-z]/.test(password)) strength.score++;
        if (/[0-9]/.test(password)) strength.score++;
        if (/[^A-Za-z0-9]/.test(password)) strength.score++;

        if (strength.score < 3) {
            return [false, 'Password is too weak', strength];
        }

        return [true, null, strength];
    }

    // Usage example
    demo() {
        const userData = {
            email: 'test@gmial.com',
            password: 'weak',
            age: 15
        };

        const validationResult = this.validateUserRegistration(userData);

        if (!validationResult.isValid) {
            console.error('Validation failed:');
            validationResult.errors.forEach(error => console.error(`- ${error}`));
            
            if (validationResult.hasWarnings) {
                console.warn('Warnings:');
                validationResult.warnings.forEach(warning => console.warn(`- ${warning}`));
            }
        } else {
            console.log('Validation passed');
            console.log('Sanitized data:', validationResult.sanitizedData);
            
            if (validationResult.hasWarnings) {
                console.warn('Please note:', validationResult.warnings);
            }
        }

        return validationResult;
    }
}

// These patterns provide:

// 1. **Consistent Return Patterns** - Standardized ways to return multiple values
// 2. **Error Handling** - Comprehensive error information alongside data
// 3. **Metadata** - Additional context about operations
// 4. **Type Safety** - Clear structure for return values
// 5. **Production Readiness** - Error tracking, logging, and monitoring support
// 6. **Flexibility** - Adaptable to different use cases and requirements

// Choose the pattern that best fits your specific use case and maintain consistency across your codebase.





























// Here are comprehensive code snippets for arrow functions in Node.js production-grade backend development:

// ## 1. Arrow Functions in Express.js Routes and Middleware

// Express server with arrow functions
const express = require('express');
const app = express();

// Middleware with arrow functions
const requestLogger = (req, res, next) => {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    const statusCode = err.statusCode || 500;
    const response = {
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };
    
    res.status(statusCode).json(response);
};

// Async route handlers with arrow functions
const getUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        
        // Input validation
        if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
            return res.status(400).json({ 
                error: 'Invalid user ID format',
                code: 'INVALID_USER_ID'
            });
        }
        
        const user = await UserModel.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Sanitize user data before sending
        const userData = {
            id: user._id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt
        };
        
        res.json({
            success: true,
            data: userData,
            metadata: {
                requestedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

// Route definitions with arrow functions
app.get('/users/:id', getUserById);

// POST route with validation
const createUser = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        
        // Validation
        const validationErrors = [];
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            validationErrors.push('Valid email is required');
        }
        if (!password || password.length < 8) {
            validationErrors.push('Password must be at least 8 characters');
        }
        
        if (validationErrors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validationErrors,
                code: 'VALIDATION_ERROR'
            });
        }
        
        // Check if user exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists',
                code: 'USER_EXISTS'
            });
        }
        
        // Create user
        const user = new UserModel({
            email,
            password: await bcrypt.hash(password, 12),
            name
        });
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name
                },
                token
            },
            message: 'User created successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

app.post('/users', createUser);

// ## 2. Arrow Functions in Service Classes

// User service with arrow functions for consistent 'this' binding
class UserService {
    constructor(userModel, emailService, logger) {
        this.userModel = userModel;
        this.emailService = emailService;
        this.logger = logger;
        
        // Using arrow functions to bind methods to instance
        this.createUser = async (userData) => {
            try {
                this.logger.info('Creating user', { email: userData.email });
                
                const existingUser = await this.userModel.findOne({ 
                    email: userData.email 
                });
                
                if (existingUser) {
                    throw new Error('USER_ALREADY_EXISTS');
                }
                
                const user = new this.userModel(userData);
                await user.save();
                
                // Send welcome email
                await this.emailService.sendWelcomeEmail(user.email, user.name);
                
                this.logger.info('User created successfully', { userId: user._id });
                
                return {
                    success: true,
                    data: user,
                    message: 'User created successfully'
                };
            } catch (error) {
                this.logger.error('Failed to create user', { 
                    error: error.message,
                    email: userData.email 
                });
                
                return {
                    success: false,
                    error: error.message,
                    code: this.getErrorCode(error)
                };
            }
        };
        
        this.getUserProfile = async (userId) => {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }
            
            return {
                id: user._id,
                email: user.email,
                name: user.name,
                profile: user.profile,
                preferences: user.preferences,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        };
        
        this.updateUser = async (userId, updateData) => {
            const allowedFields = ['name', 'profile', 'preferences'];
            const filteredUpdate = Object.keys(updateData)
                .filter(key => allowedFields.includes(key))
                .reduce((obj, key) => {
                    obj[key] = updateData[key];
                    return obj;
                }, {});
            
            const user = await this.userModel.findByIdAndUpdate(
                userId,
                { $set: filteredUpdate },
                { new: true, runValidators: true }
            );
            
            if (!user) {
                throw new Error('USER_NOT_FOUND');
            }
            
            return user;
        };
    }
    
    // Traditional method that needs binding
    getErrorCode(error) {
        const errorMap = {
            'USER_ALREADY_EXISTS': 'CONFLICT',
            'USER_NOT_FOUND': 'NOT_FOUND',
            'VALIDATION_ERROR': 'BAD_REQUEST'
        };
        
        return errorMap[error.message] || 'INTERNAL_ERROR';
    }
}

// Factory function using arrow functions
const createUserService = (dependencies) => {
    const { userModel, emailService, logger } = dependencies;
    
    return {
        // Arrow functions for public methods
        create: async (userData) => {
            const service = new UserService(userModel, emailService, logger);
            return await service.createUser(userData);
        },
        
        findById: async (userId) => {
            const user = await userModel.findById(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User not found',
                    code: 'NOT_FOUND'
                };
            }
            return {
                success: true,
                data: user
            };
        },
        
        // Batch operations with arrow functions
        bulkCreate: async (usersData) => {
            const results = {
                successful: [],
                failed: []
            };
            
            const createPromises = usersData.map(async (userData, index) => {
                try {
                    const result = await userModel.create(userData);
                    results.successful.push({
                        index,
                        userId: result._id,
                        email: result.email
                    });
                } catch (error) {
                    results.failed.push({
                        index,
                        error: error.message,
                        email: userData.email
                    });
                }
            });
            
            await Promise.allSettled(createPromises);
            
            return results;
        }
    };
};

// ## 3. Database Operations with Arrow Functions

// Database repository pattern with arrow functions
class UserRepository {
    constructor(dbConnection, logger) {
        this.db = dbConnection;
        this.logger = logger;
    }
    
    // Arrow functions for database operations
    findUserByEmail = async (email) => {
        try {
            const user = await this.db.collection('users').findOne({ 
                email: email.toLowerCase() 
            });
            
            return user ? this.sanitizeUser(user) : null;
        } catch (error) {
            this.logger.error('Database error in findUserByEmail', {
                error: error.message,
                email
            });
            throw new Error('DATABASE_ERROR');
        }
    };
    
    createUser = async (userData) => {
        const session = this.db.startSession();
        
        try {
            session.startTransaction();
            
            const user = {
                ...userData,
                email: userData.email.toLowerCase(),
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'active'
            };
            
            const result = await this.db.collection('users').insertOne(user, { session });
            
            // Create user profile in same transaction
            await this.db.collection('profiles').insertOne({
                userId: result.insertedId,
                preferences: {},
                settings: {},
                createdAt: new Date()
            }, { session });
            
            await session.commitTransaction();
            
            return {
                ...user,
                _id: result.insertedId
            };
        } catch (error) {
            await session.abortTransaction();
            this.logger.error('Failed to create user in transaction', {
                error: error.message,
                email: userData.email
            });
            throw error;
        } finally {
            session.endSession();
        }
    };
    
    updateUserLastLogin = async (userId) => {
        return await this.db.collection('users').updateOne(
            { _id: userId },
            { 
                $set: { 
                    lastLogin: new Date(),
                    updatedAt: new Date()
                },
                $inc: { loginCount: 1 }
            }
        );
    };
    
    // Complex query with aggregation pipeline
    getUserStats = async (timeRange = '7d') => {
        const dateFilter = this.getDateFilter(timeRange);
        
        const pipeline = [
            { $match: { createdAt: { $gte: dateFilter } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ];
        
        return await this.db.collection('users').aggregate(pipeline).toArray();
    };
    
    // Private helper with arrow function
    getDateFilter = (timeRange) => {
        const now = new Date();
        const filters = {
            '24h': new Date(now.setDate(now.getDate() - 1)),
            '7d': new Date(now.setDate(now.getDate() - 7)),
            '30d': new Date(now.setDate(now.getDate() - 30))
        };
        
        return filters[timeRange] || filters['7d'];
    };
    
    sanitizeUser = (user) => {
        const { password, ...sanitized } = user;
        return sanitized;
    };
}

// Database connection manager with arrow functions
const createDatabaseManager = (config) => {
    const { connectionString, dbName, options } = config;
    let client = null;
    let isConnected = false;
    
    return {
        connect: async () => {
            if (isConnected) {
                return client;
            }
            
            try {
                client = new MongoClient(connectionString, options);
                await client.connect();
                isConnected = true;
                
                console.log('Database connected successfully');
                return client.db(dbName);
            } catch (error) {
                console.error('Database connection failed:', error);
                throw new Error('DATABASE_CONNECTION_FAILED');
            }
        },
        
        disconnect: async () => {
            if (client && isConnected) {
                await client.close();
                isConnected = false;
                console.log('Database disconnected');
            }
        },
        
        // Health check with arrow function
        healthCheck: async () => {
            if (!isConnected) {
                return { status: 'disconnected', timestamp: new Date().toISOString() };
            }
            
            try {
                await client.db().admin().ping();
                return { 
                    status: 'connected', 
                    timestamp: new Date().toISOString(),
                    details: { dbName, connectionString: this.maskConnectionString(connectionString) }
                };
            } catch (error) {
                return { 
                    status: 'error', 
                    timestamp: new Date().toISOString(),
                    error: error.message 
                };
            }
        },
        
        // Private method with arrow function
        maskConnectionString: (connString) => {
            return connString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        },
        
        isConnected: () => isConnected
    };
};

// ## 4. Event Handlers and Stream Processing

// Event emitter with arrow functions
class EventManager {
    constructor() {
        this.events = new Map();
        this.middlewares = [];
    }
    
    // Event registration with arrow functions
    on = (eventName, handler, options = {}) => {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        const handlerWrapper = async (data) => {
            try {
                // Apply middlewares
                let processedData = data;
                for (const middleware of this.middlewares) {
                    processedData = await middleware(eventName, processedData);
                }
                
                await handler(processedData);
                
                if (options.logSuccess) {
                    console.log(`Event ${eventName} handled successfully`);
                }
            } catch (error) {
                console.error(`Error in event handler for ${eventName}:`, error);
                
                if (options.retryOnError) {
                    await this.retryHandler(eventName, data, handler, options.maxRetries || 3);
                }
            }
        };
        
        this.events.get(eventName).push(handlerWrapper);
        
        // Return unsubscribe function
        return () => {
            const handlers = this.events.get(eventName) || [];
            const index = handlers.indexOf(handlerWrapper);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        };
    };
    
    emit = async (eventName, data) => {
        const handlers = this.events.get(eventName) || [];
        
        if (handlers.length === 0) {
            console.warn(`No handlers registered for event: ${eventName}`);
            return;
        }
        
        const promises = handlers.map(handler => handler(data));
        await Promise.allSettled(promises);
    };
    
    // Retry logic with arrow function
    retryHandler = async (eventName, data, handler, maxRetries, attempt = 1) => {
        if (attempt > maxRetries) {
            console.error(`Max retries exceeded for event ${eventName}`);
            return;
        }
        
        try {
            await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Exponential backoff
            await handler(data);
            console.log(`Event ${eventName} handled successfully after ${attempt} retries`);
        } catch (error) {
            console.error(`Retry ${attempt} failed for event ${eventName}:`, error);
            await this.retryHandler(eventName, data, handler, maxRetries, attempt + 1);
        }
    };
    
    use = (middleware) => {
        this.middlewares.push(middleware);
    };
}

// Stream processing with arrow functions
class StreamProcessor {
    constructor(options = {}) {
        this.options = {
            highWaterMark: options.highWaterMark || 1000,
            concurrency: options.concurrency || 5,
            ...options
        };
        this.processing = false;
        this.queue = [];
    }
    
    // Stream transformation with arrow functions
    createTransformStream = (transformFn) => {
        return new Transform({
            objectMode: true,
            highWaterMark: this.options.highWaterMark,
            
            transform: async (chunk, encoding, callback) => {
                try {
                    const result = await transformFn(chunk);
                    callback(null, result);
                } catch (error) {
                    callback(error);
                }
            }
        });
    };
    
    // Batch processing with arrow functions
    processInBatches = async (dataStream, batchSize, processBatchFn) => {
        let batch = [];
        
        for await (const item of dataStream) {
            batch.push(item);
            
            if (batch.length >= batchSize) {
                await processBatchFn(batch);
                batch = [];
            }
        }
        
        // Process remaining items
        if (batch.length > 0) {
            await processBatchFn(batch);
        }
    };
    
    // Parallel processing with controlled concurrency
    processParallel = async (items, processorFn) => {
        const results = {
            successful: [],
            failed: []
        };
        
        const processWithSemaphore = async (item, index) => {
            try {
                const result = await processorFn(item, index);
                results.successful.push({ item, result, index });
                return result;
            } catch (error) {
                results.failed.push({ item, error: error.message, index });
                throw error;
            }
        };
        
        // Control concurrency
        const executing = new Set();
        
        for (const [index, item] of items.entries()) {
            if (executing.size >= this.options.concurrency) {
                await Promise.race(executing);
            }
            
            const promise = processWithSemaphore(item, index);
            executing.add(promise);
            promise.finally(() => executing.delete(promise));
        }
        
        // Wait for all remaining
        await Promise.allSettled(executing);
        
        return results;
    };
}

// File processing example with arrow functions
const createFileProcessor = () => {
    const fs = require('fs').promises;
    const path = require('path');
    
    return {
        // Process CSV files with arrow functions
        processCSV: async (filePath, processor) => {
            const stream = fs.createReadStream(filePath);
            const results = [];
            
            return new Promise((resolve, reject) => {
                stream
                    .pipe(csv.parse({ headers: true }))
                    .on('data', async (row) => {
                        try {
                            const result = await processor(row);
                            results.push(result);
                        } catch (error) {
                            console.error('Error processing row:', error);
                        }
                    })
                    .on('end', () => {
                        resolve(results);
                    })
                    .on('error', reject);
            });
        },
        
        // Directory processing with arrow functions
        processDirectory: async (dirPath, fileProcessor, options = {}) => {
            const files = await fs.readdir(dirPath);
            const results = {
                processed: [],
                failed: []
            };
            
            const processFile = async (filename) => {
                const filePath = path.join(dirPath, filename);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && this.isSupportedFile(filename)) {
                    try {
                        const result = await fileProcessor(filePath);
                        results.processed.push({
                            filename,
                            result,
                            size: stats.size
                        });
                    } catch (error) {
                        results.failed.push({
                            filename,
                            error: error.message
                        });
                    }
                }
            };
            
            // Process files with concurrency control
            const concurrency = options.concurrency || 3;
            const executing = new Set();
            
            for (const filename of files) {
                if (executing.size >= concurrency) {
                    await Promise.race(executing);
                }
                
                const promise = processFile(filename);
                executing.add(promise);
                promise.finally(() => executing.delete(promise));
            }
            
            await Promise.allSettled(executing);
            return results;
        },
        
        isSupportedFile: (filename) => {
            const supported = ['.csv', '.json', '.txt'];
            return supported.some(ext => filename.endsWith(ext));
        }
    };
};

// ## 5. Configuration and Factory Patterns

// Configuration manager with arrow functions
const createConfigManager = (defaultConfig = {}) => {
    let config = { ...defaultConfig };
    const subscribers = new Set();
    
    return {
        // Arrow functions for configuration management
        get: (key = null) => {
            if (key === null) {
                return { ...config }; // Return copy to prevent mutation
            }
            
            const keys = key.split('.');
            let value = config;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return undefined;
                }
            }
            
            return value;
        },
        
        set: (key, value) => {
            const keys = key.split('.');
            let current = config;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const k = keys[i];
                if (!(k in current) || typeof current[k] !== 'object') {
                    current[k] = {};
                }
                current = current[k];
            }
            
            current[keys[keys.length - 1]] = value;
            
            // Notify subscribers
            subscribers.forEach(callback => callback(key, value));
        },
        
        subscribe: (callback) => {
            subscribers.add(callback);
            
            // Return unsubscribe function
            return () => {
                subscribers.delete(callback);
            };
        },
        
        // Validation with arrow function
        validate: (schema) => {
            const validateConfig = (config, schema, path = '') => {
                const errors = [];
                
                for (const [key, rule] of Object.entries(schema)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    const value = config[key];
                    
                    if (rule.required && value === undefined) {
                        errors.push(`${currentPath} is required`);
                        continue;
                    }
                    
                    if (value !== undefined) {
                        if (rule.type && typeof value !== rule.type) {
                            errors.push(`${currentPath} should be ${rule.type}`);
                        }
                        
                        if (rule.validate && !rule.validate(value)) {
                            errors.push(`${currentPath} failed validation`);
                        }
                        
                        if (rule.children && typeof value === 'object') {
                            errors.push(...validateConfig(value, rule.children, currentPath));
                        }
                    }
                }
                
                return errors;
            };
            
            return validateConfig(config, schema);
        },
        
        // Reset to defaults
        reset: () => {
            config = { ...defaultConfig };
            subscribers.forEach(callback => callback('*', config));
        }
    };
};

// Factory pattern with arrow functions
const createServiceFactory = (dependencies) => {
    const { logger, database, cache } = dependencies;
    const services = new Map();
    
    return {
        // Service creation with arrow functions
        createUserService: (options = {}) => {
            const key = `userService-${JSON.stringify(options)}`;
            
            if (services.has(key)) {
                return services.get(key);
            }
            
            const service = {
                // Arrow functions for service methods
                create: async (userData) => {
                    logger.info('Creating user', { email: userData.email });
                    
                    const existing = await database.collection('users').findOne({
                        email: userData.email
                    });
                    
                    if (existing) {
                        throw new Error('USER_EXISTS');
                    }
                    
                    const result = await database.collection('users').insertOne({
                        ...userData,
                        createdAt: new Date(),
                        status: 'active'
                    });
                    
                    // Invalidate cache
                    await cache.del('users:list');
                    
                    return result.insertedId;
                },
                
                find: async (query = {}, options = {}) => {
                    const cacheKey = `users:${JSON.stringify(query)}`;
                    
                    // Try cache first
                    if (options.useCache !== false) {
                        const cached = await cache.get(cacheKey);
                        if (cached) {
                            return JSON.parse(cached);
                        }
                    }
                    
                    const users = await database.collection('users')
                        .find(query)
                        .skip(options.skip || 0)
                        .limit(options.limit || 50)
                        .toArray();
                    
                    // Cache result
                    if (options.useCache !== false) {
                        await cache.set(cacheKey, JSON.stringify(users), 'EX', 300); // 5 minutes
                    }
                    
                    return users;
                },
                
                // Batch operations
                bulkUpdate: async (userIds, updates) => {
                    const session = database.startSession();
                    
                    try {
                        session.startTransaction();
                        
                        const result = await database.collection('users').updateMany(
                            { _id: { $in: userIds } },
                            { $set: { ...updates, updatedAt: new Date() } },
                            { session }
                        );
                        
                        await session.commitTransaction();
                        
                        // Invalidate relevant cache entries
                        await cache.del('users:list');
                        userIds.forEach(async id => {
                            await cache.del(`user:${id}`);
                        });
                        
                        return result;
                    } catch (error) {
                        await session.abortTransaction();
                        throw error;
                    } finally {
                        session.endSession();
                    }
                }
            };
            
            services.set(key, service);
            return service;
        },
        
        // Cleanup method
        cleanup: async () => {
            logger.info('Cleaning up services');
            services.clear();
        }
    };
};

// Dependency injection container with arrow functions
const createContainer = () => {
    const dependencies = new Map();
    const factories = new Map();
    const singletons = new Map();
    
    return {
        // Arrow functions for dependency management
        register: (name, factory, isSingleton = false) => {
            factories.set(name, { factory, isSingleton });
        },
        
        resolve: async (name) => {
            // Check if already resolved (for singletons)
            if (singletons.has(name)) {
                return singletons.get(name);
            }
            
            const factoryInfo = factories.get(name);
            if (!factoryInfo) {
                throw new Error(`Dependency ${name} not registered`);
            }
            
            const { factory, isSingleton } = factoryInfo;
            const instance = await factory(this);
            
            if (isSingleton) {
                singletons.set(name, instance);
            }
            
            return instance;
        },
        
        // Bulk resolution
        resolveAll: async (names) => {
            const results = {};
            
            await Promise.all(
                names.map(async (name) => {
                    results[name] = await this.resolve(name);
                })
            );
            
            return results;
        },
        
        // Health check
        healthCheck: async () => {
            const status = {};
            
            for (const [name] of factories) {
                try {
                    const instance = await this.resolve(name);
                    if (typeof instance.healthCheck === 'function') {
                        status[name] = await instance.healthCheck();
                    } else {
                        status[name] = { status: 'unknown' };
                    }
                } catch (error) {
                    status[name] = { status: 'error', error: error.message };
                }
            }
            
            return status;
        }
    };
};

// ## 6. Utility Functions and Helpers

// Validation utilities with arrow functions
const createValidators = () => {
    return {
        // Email validation
        isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        
        // Password strength validation
        isStrongPassword: (password) => {
            const checks = [
                password.length >= 8,
                /[A-Z]/.test(password),
                /[a-z]/.test(password),
                /[0-9]/.test(password),
                /[^A-Za-z0-9]/.test(password)
            ];
            
            return checks.filter(Boolean).length >= 4;
        },
        
        // URL validation
        isURL: (url) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        
        // Object validation
        validateObject: (obj, schema) => {
            const errors = [];
            
            Object.entries(schema).forEach(([key, validator]) => {
                const value = obj[key];
                
                if (validator.required && value === undefined) {
                    errors.push(`${key} is required`);
                    return;
                }
                
                if (value !== undefined && !validator.validate(value)) {
                    errors.push(`${key} is invalid`);
                }
            });
            
            return {
                isValid: errors.length === 0,
                errors
            };
        }
    };
};

// Async utilities with arrow functions
const createAsyncUtils = () => {
    return {
        // Retry with exponential backoff
        retry: async (fn, options = {}) => {
            const {
                retries = 3,
                delay = 1000,
                backoff = 2,
                shouldRetry = (error) => true
            } = options;
            
            let lastError;
            
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;
                    
                    if (!shouldRetry(error) || attempt === retries) {
                        break;
                    }
                    
                    const waitTime = delay * Math.pow(backoff, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            
            throw lastError;
        },
        
        // Timeout wrapper
        withTimeout: (promise, timeoutMs, timeoutError = 'Operation timeout') => {
            return Promise.race([
                promise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
                )
            ]);
        },
        
        // Parallel execution with limit
        parallelLimit: async (tasks, limit) => {
            const results = [];
            const executing = new Set();
            
            for (const [index, task] of tasks.entries()) {
                if (executing.size >= limit) {
                    await Promise.race(executing);
                }
                
                const promise = task().then(result => {
                    results[index] = { status: 'fulfilled', value: result };
                }).catch(error => {
                    results[index] = { status: 'rejected', reason: error };
                });
                
                executing.add(promise);
                promise.finally(() => executing.delete(promise));
            }
            
            await Promise.allSettled(executing);
            return results;
        },
        
        // Debounce function
        debounce: (fn, delay) => {
            let timeoutId;
            
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn(...args), delay);
            };
        },
        
        // Throttle function
        throttle: (fn, delay) => {
            let lastCall = 0;
            
            return (...args) => {
                const now = Date.now();
                
                if (now - lastCall >= delay) {
                    lastCall = now;
                    return fn(...args);
                }
            };
        }
    };
};

// Logging utilities with arrow functions
const createLogger = (options = {}) => {
    const { level = 'info', transports = [] } = options;
    
    const levels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };
    
    const shouldLog = (messageLevel) => levels[messageLevel] <= levels[level];
    
    return {
        // Arrow functions for logging
        error: (message, meta = {}) => {
            if (shouldLog('error')) {
                this.log('error', message, meta);
            }
        },
        
        warn: (message, meta = {}) => {
            if (shouldLog('warn')) {
                this.log('warn', message, meta);
            }
        },
        
        info: (message, meta = {}) => {
            if (shouldLog('info')) {
                this.log('info', message, meta);
            }
        },
        
        debug: (message, meta = {}) => {
            if (shouldLog('debug')) {
                this.log('debug', message, meta);
            }
        },
        
        // Private log method
        log: (level, message, meta) => {
            const logEntry = {
                level,
                message,
                timestamp: new Date().toISOString(),
                ...meta
            };
            
            transports.forEach(transport => {
                try {
                    transport(logEntry);
                } catch (error) {
                    // Don't let transport errors break logging
                    console.error('Log transport error:', error);
                }
            });
        },
        
        // Child logger with context
        child: (context) => {
            return createLogger({
                ...options,
                transports: options.transports.map(transport => 
                    (entry) => transport({ ...entry, ...context })
                )
            });
        }
    };
};

// These arrow function patterns provide:

// 1. **Consistent `this` binding** - No need for `.bind()` or `self = this` patterns
// 2. **Concise syntax** - Cleaner code for callbacks and methods
// 3. **Better functional programming** - Ideal for map/filter/reduce operations
// 4. **Production reliability** - Predictable behavior in async operations
// 5. **Maintainability** - Clear, readable code structure
// 6. **Type safety** - Consistent parameter handling

// Choose the appropriate pattern based on your specific use case while maintaining consistency across your codebase.


























// Here are comprehensive code snippets for rest parameters in Node.js production-grade backend development:

// ## 1. REST API Route Handlers with Rest Parameters

// Express route handlers with rest parameters
class UserController {
    constructor(userService, validationService) {
        this.userService = userService;
        this.validationService = validationService;
    }

    // Create user with flexible field handling
    createUser = async (req, res, next) => {
        try {
            const { email, password, name, ...optionalFields } = req.body;
            
            // Validate required fields
            const requiredValidation = this.validationService.validateRequiredFields(
                { email, password, name },
                ['email', 'password', 'name']
            );
            
            if (!requiredValidation.isValid) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    missing: requiredValidation.missing,
                    code: 'MISSING_REQUIRED_FIELDS'
                });
            }

            // Validate optional fields
            const optionalValidation = this.validationService.validateOptionalFields(
                optionalFields,
                ['phone', 'address', 'preferences', 'metadata']
            );

            if (!optionalValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid optional fields',
                    invalid: optionalValidation.invalid,
                    code: 'INVALID_OPTIONAL_FIELDS'
                });
            }

            const userData = {
                email,
                password,
                name,
                ...optionalValidation.validFields
            };

            const result = await this.userService.createUser(userData);
            
            if (!result.success) {
                return res.status(result.statusCode || 400).json({
                    error: result.error,
                    code: result.code,
                    details: result.details
                });
            }

            res.status(201).json({
                success: true,
                data: result.data,
                message: 'User created successfully'
            });

        } catch (error) {
            next(error);
        }
    };

    // Bulk update users with flexible criteria
    bulkUpdateUsers = async (req, res, next) => {
        try {
            const { updates, ...criteria } = req.body;
            
            if (!updates || Object.keys(updates).length === 0) {
                return res.status(400).json({
                    error: 'No updates provided',
                    code: 'NO_UPDATES_PROVIDED'
                });
            }

            // Validate update fields
            const allowedFields = ['name', 'status', 'preferences', 'metadata'];
            const invalidUpdates = Object.keys(updates).filter(
                field => !allowedFields.includes(field)
            );

            if (invalidUpdates.length > 0) {
                return res.status(400).json({
                    error: 'Invalid update fields',
                    invalidFields: invalidUpdates,
                    allowedFields,
                    code: 'INVALID_UPDATE_FIELDS'
                });
            }

            const result = await this.userService.bulkUpdateUsers(criteria, updates);
            
            res.json({
                success: true,
                data: {
                    matched: result.matchedCount,
                    modified: result.modifiedCount,
                    criteria,
                    updates
                },
                message: `Successfully updated ${result.modifiedCount} users`
            });

        } catch (error) {
            next(error);
        }
    };

    // Search users with multiple filter options
    searchUsers = async (req, res, next) => {
        try {
            const { 
                page = 1, 
                limit = 10, 
                sort = 'createdAt', 
                order = 'desc',
                ...filters 
            } = req.query;

            // Remove pagination and sorting from filters
            const { page: _, limit: __, sort: ___, order: ____, ...cleanFilters } = filters;

            // Validate filters
            const filterValidation = this.validationService.validateSearchFilters(
                cleanFilters,
                ['email', 'name', 'status', 'createdAfter', 'createdBefore']
            );

            if (!filterValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid search filters',
                    invalidFilters: filterValidation.invalid,
                    code: 'INVALID_SEARCH_FILTERS'
                });
            }

            const searchOptions = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort,
                order,
                filters: filterValidation.validFilters
            };

            const result = await this.userService.searchUsers(searchOptions);
            
            res.json({
                success: true,
                data: result.users,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    pages: result.pages,
                    hasNext: result.hasNext,
                    hasPrev: result.hasPrev
                },
                filters: cleanFilters
            });

        } catch (error) {
            next(error);
        }
    };
}

// Middleware with rest parameters
const createMiddlewarePipeline = (...middlewares) => {
    return (req, res, next) => {
        const executeMiddleware = async (index) => {
            if (index >= middlewares.length) {
                return next();
            }

            const middleware = middlewares[index];
            
            try {
                await middleware(req, res, (error) => {
                    if (error) {
                        return next(error);
                    }
                    executeMiddleware(index + 1);
                });
            } catch (error) {
                next(error);
            }
        };

        executeMiddleware(0);
    };
};

// Usage in Express app
const app = express();

const authMiddleware = require('./middlewares/auth');
const validationMiddleware = require('./middlewares/validation');
const loggingMiddleware = require('./middlewares/logging');
const rateLimitMiddleware = require('./middlewares/rateLimit');

// Apply multiple middlewares using rest parameters
app.use('/api/users', 
    createMiddlewarePipeline(
        loggingMiddleware,
        rateLimitMiddleware,
        authMiddleware,
        validationMiddleware
    ),
    userController
);

// ## 2. Service Layer with Rest Parameters

// User service with rest parameters for flexible operations
class UserService {
    constructor(userRepository, emailService, logger) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.logger = logger;
    }

    // Create user with comprehensive options
    createUser = async (userData, ...options) => {
        const mergedOptions = this.mergeOptions({
            sendWelcomeEmail: true,
            validateEmail: true,
            createProfile: true,
            generateApiKey: false,
            ...options
        });

        try {
            this.logger.info('Creating user', { 
                email: userData.email, 
                options: mergedOptions 
            });

            // Validate user data
            const validationResult = this.validateUserData(userData, mergedOptions);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: 'Validation failed',
                    details: validationResult.errors,
                    code: 'VALIDATION_FAILED'
                };
            }

            // Check for existing user
            const existingUser = await this.userRepository.findByEmail(userData.email);
            if (existingUser) {
                return {
                    success: false,
                    error: 'User already exists',
                    existingUserId: existingUser.id,
                    code: 'USER_EXISTS'
                };
            }

            // Create user
            const user = await this.userRepository.create({
                ...userData,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Execute post-creation actions
            const postCreationResults = await this.executePostCreationActions(
                user, 
                mergedOptions
            );

            this.logger.info('User created successfully', { 
                userId: user.id,
                postCreationResults: Object.keys(postCreationResults)
            });

            return {
                success: true,
                data: {
                    user,
                    ...postCreationResults
                },
                message: 'User created successfully'
            };

        } catch (error) {
            this.logger.error('Failed to create user', {
                error: error.message,
                email: userData.email
            });

            return {
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR',
                internalError: error.message
            };
        }
    };

    // Bulk operations with rest parameters
    bulkOperation = async (operation, items, ...operationOptions) => {
        const results = {
            successful: [],
            failed: [],
            skipped: []
        };

        const options = this.mergeBulkOptions(...operationOptions);

        for (const [index, item] of items.entries()) {
            if (options.skipCondition && options.skipCondition(item, index)) {
                results.skipped.push({ item, index, reason: 'Skip condition met' });
                continue;
            }

            try {
                const result = await operation(item, index, options);
                
                if (result.success) {
                    results.successful.push({
                        item,
                        index,
                        result: result.data,
                        metadata: result.metadata
                    });
                } else {
                    results.failed.push({
                        item,
                        index,
                        error: result.error,
                        code: result.code
                    });
                }
            } catch (error) {
                results.failed.push({
                    item,
                    index,
                    error: error.message,
                    code: 'OPERATION_FAILED'
                });
            }

            // Respect concurrency limit
            if (options.concurrency && options.concurrency > 1) {
                await this.delay(options.delayBetweenOperations || 0);
            }
        }

        return {
            results,
            summary: {
                total: items.length,
                successful: results.successful.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                successRate: (results.successful.length / items.length) * 100
            }
        };
    };

    // Flexible query method
    queryUsers = async (baseQuery = {}, ...additionalQueries) => {
        const mergedQuery = additionalQueries.reduce((query, additional) => ({
            ...query,
            ...additional
        }), baseQuery);

        // Apply query transformations
        const finalQuery = this.transformQuery(mergedQuery);

        try {
            const users = await this.userRepository.find(finalQuery);
            const total = await this.userRepository.count(finalQuery);

            return {
                success: true,
                data: users,
                metadata: {
                    query: finalQuery,
                    total,
                    returned: users.length,
                    executedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            this.logger.error('Query failed', {
                error: error.message,
                query: finalQuery
            });

            return {
                success: false,
                error: 'Query execution failed',
                code: 'QUERY_FAILED',
                internalError: error.message
            };
        }
    };

    // Helper methods
    mergeOptions = (...optionsArray) => {
        return optionsArray.reduce((merged, current) => ({
            ...merged,
            ...current
        }), {});
    };

    mergeBulkOptions = (...optionsArray) => {
        const baseOptions = {
            concurrency: 1,
            delayBetweenOperations: 0,
            skipCondition: null,
            onProgress: null,
            ...optionsArray[0]
        };

        return optionsArray.slice(1).reduce((merged, current) => ({
            ...merged,
            ...current,
            // Special handling for arrays
            onProgress: current.onProgress || merged.onProgress
        }), baseOptions);
    };

    executePostCreationActions = async (user, options) => {
        const actions = [];
        const results = {};

        if (options.sendWelcomeEmail) {
            actions.push(
                this.emailService.sendWelcomeEmail(user.email, user.name)
                    .then(result => { results.welcomeEmailSent = result; })
                    .catch(error => { results.welcomeEmailError = error.message; })
            );
        }

        if (options.createProfile) {
            actions.push(
                this.userRepository.createProfile(user.id)
                    .then(profile => { results.profile = profile; })
                    .catch(error => { results.profileError = error.message; })
            );
        }

        if (options.generateApiKey) {
            actions.push(
                this.generateApiKey(user.id)
                    .then(apiKey => { results.apiKey = apiKey; })
                    .catch(error => { results.apiKeyError = error.message; })
            );
        }

        await Promise.allSettled(actions);
        return results;
    };
}

// ## 3. Database Repository with Rest Parameters

// Advanced repository pattern with rest parameters
class UserRepository {
    constructor(db, logger, config = {}) {
        this.db = db;
        this.logger = logger;
        this.config = config;
    }

    // Flexible find method with multiple query options
    find = async (baseCriteria = {}, ...additionalCriteria) => {
        const mergedCriteria = additionalCriteria.reduce((criteria, additional) => ({
            ...criteria,
            ...additional
        }), baseCriteria);

        try {
            const {
                select = {},
                sort = { createdAt: -1 },
                page = 1,
                limit = 50,
                populate = [],
                ...queryCriteria
            } = mergedCriteria;

            // Build MongoDB query
            let query = this.db.collection('users').find(queryCriteria);

            // Apply projections
            if (Object.keys(select).length > 0) {
                query = query.project(select);
            }

            // Apply sorting
            query = query.sort(sort);

            // Apply pagination
            const skip = (page - 1) * limit;
            query = query.skip(skip).limit(limit);

            const users = await query.toArray();

            // Get total count for pagination
            const total = await this.db.collection('users').countDocuments(queryCriteria);

            return {
                data: users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                query: {
                    criteria: queryCriteria,
                    select,
                    sort,
                    populate
                }
            };

        } catch (error) {
            this.logger.error('Database find operation failed', {
                error: error.message,
                criteria: mergedCriteria
            });
            throw new Error('DATABASE_QUERY_FAILED');
        }
    };

    // Bulk operations with multiple documents
    bulkWrite = async (...operations) => {
        const session = this.db.startSession();
        
        try {
            session.startTransaction();

            const results = {
                inserted: [],
                updated: [],
                deleted: [],
                errors: []
            };

            for (const operation of operations) {
                try {
                    const { type, ...params } = operation;
                    
                    let result;
                    switch (type) {
                        case 'insert':
                            result = await this.db.collection('users').insertOne(
                                { ...params.document, createdAt: new Date() },
                                { session }
                            );
                            results.inserted.push({
                                id: result.insertedId,
                                ...params.document
                            });
                            break;

                        case 'update':
                            result = await this.db.collection('users').updateOne(
                                params.filter,
                                { 
                                    $set: { 
                                        ...params.update, 
                                        updatedAt: new Date() 
                                    } 
                                },
                                { session }
                            );
                            results.updated.push({
                                matched: result.matchedCount,
                                modified: result.modifiedCount,
                                filter: params.filter
                            });
                            break;

                        case 'delete':
                            result = await this.db.collection('users').deleteOne(
                                params.filter,
                                { session }
                            );
                            results.deleted.push({
                                deleted: result.deletedCount,
                                filter: params.filter
                            });
                            break;

                        default:
                            throw new Error(`Unknown operation type: ${type}`);
                    }
                } catch (error) {
                    results.errors.push({
                        operation,
                        error: error.message
                    });
                    
                    if (operation.critical) {
                        throw error;
                    }
                }
            }

            await session.commitTransaction();
            return results;

        } catch (error) {
            await session.abortTransaction();
            this.logger.error('Bulk write transaction failed', {
                error: error.message,
                operationsCount: operations.length
            });
            throw error;
        } finally {
            session.endSession();
        }
    };

    // Aggregation pipeline with multiple stages
    aggregate = async (basePipeline = [], ...additionalStages) => {
        const pipeline = [
            ...basePipeline,
            ...additionalStages.flat()
        ];

        try {
            // Validate pipeline stages
            const validation = this.validateAggregationPipeline(pipeline);
            if (!validation.isValid) {
                throw new Error(`Invalid aggregation pipeline: ${validation.errors.join(', ')}`);
            }

            const results = await this.db.collection('users')
                .aggregate(pipeline)
                .toArray();

            return {
                data: results,
                pipeline,
                metadata: {
                    stages: pipeline.length,
                    resultCount: results.length,
                    executedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error('Aggregation pipeline failed', {
                error: error.message,
                pipeline
            });
            throw new Error('AGGREGATION_FAILED');
        }
    };

    // Advanced search with multiple filter conditions
    advancedSearch = async (searchText, ...filters) => {
        const searchStages = [];

        // Text search stage
        if (searchText) {
            searchStages.push({
                $match: {
                    $text: {
                        $search: searchText,
                        $caseSensitive: false,
                        $diacriticSensitive: false
                    }
                }
            });
        }

        // Add filter stages
        const filterStages = filters.map(filter => ({
            $match: this.buildFilterQuery(filter)
        }));

        const pipeline = [
            ...searchStages,
            ...filterStages,
            {
                $project: {
                    _id: 1,
                    email: 1,
                    name: 1,
                    status: 1,
                    createdAt: 1,
                    score: { $meta: "textScore" }
                }
            },
            {
                $sort: {
                    score: { $meta: "textScore" },
                    createdAt: -1
                }
            }
        ];

        return await this.aggregate(pipeline);
    };

    // Helper methods
    buildFilterQuery = (filter) => {
        const query = {};

        if (filter.status) {
            query.status = filter.status;
        }

        if (filter.createdAfter) {
            query.createdAt = { ...query.createdAt, $gte: new Date(filter.createdAfter) };
        }

        if (filter.createdBefore) {
            query.createdAt = { ...query.createdAt, $lte: new Date(filter.createdBefore) };
        }

        if (filter.emailDomain) {
            query.email = { $regex: `@${filter.emailDomain}$`, $options: 'i' };
        }

        return query;
    };

    validateAggregationPipeline = (pipeline) => {
        const errors = [];
        const allowedStages = [
            '$match', '$group', '$sort', '$project', 
            '$limit', '$skip', '$lookup', '$unwind'
        ];

        pipeline.forEach((stage, index) => {
            const stageName = Object.keys(stage)[0];
            
            if (!allowedStages.includes(stageName)) {
                errors.push(`Stage ${index}: Unknown stage '${stageName}'`);
            }

            // Additional validation for specific stages
            if (stageName === '$group' && !stage.$group._id) {
                errors.push(`Stage ${index}: $group must have _id field`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    };
}

// ## 4. Validation Service with Rest Parameters

// Comprehensive validation service with rest parameters
class ValidationService {
    constructor(config = {}) {
        this.config = config;
    }

    // Multi-field validation with rest parameters
    validateFields = (data, ...validations) => {
        const errors = {};
        const warnings = {};
        const sanitized = { ...data };

        // Merge all validation rules
        const mergedValidations = validations.reduce((merged, current) => ({
            ...merged,
            ...current
        }), {});

        for (const [field, rules] of Object.entries(mergedValidations)) {
            const value = data[field];
            const fieldResult = this.validateField(field, value, rules);

            if (fieldResult.errors.length > 0) {
                errors[field] = fieldResult.errors;
            }

            if (fieldResult.warnings.length > 0) {
                warnings[field] = fieldResult.warnings;
            }

            if (fieldResult.sanitizedValue !== undefined) {
                sanitized[field] = fieldResult.sanitizedValue;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            hasWarnings: Object.keys(warnings).length > 0,
            errors,
            warnings,
            sanitized,
            summary: {
                totalFields: Object.keys(mergedValidations).length,
                validFields: Object.keys(mergedValidations).length - Object.keys(errors).length,
                errorFields: Object.keys(errors).length,
                warningFields: Object.keys(warnings).length
            }
        };
    };

    // Validate single field with multiple rules
    validateField = (field, value, rules) => {
        const errors = [];
        const warnings = [];
        let sanitizedValue = value;

        // Required validation
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            return { errors, warnings, sanitizedValue };
        }

        // Skip further validation if value is empty and not required
        if (value === undefined || value === null || value === '') {
            return { errors, warnings, sanitizedValue };
        }

        // Type validation
        if (rules.type) {
            const typeValidation = this.validateType(field, value, rules.type);
            if (!typeValidation.isValid) {
                errors.push(typeValidation.error);
            } else if (typeValidation.sanitizedValue !== undefined) {
                sanitizedValue = typeValidation.sanitizedValue;
            }
        }

        // Custom validators
        if (rules.validators) {
            for (const validator of rules.validators) {
                const result = validator(value, field);
                if (!result.isValid) {
                    errors.push(result.error);
                }
                if (result.warning) {
                    warnings.push(result.warning);
                }
                if (result.sanitizedValue !== undefined) {
                    sanitizedValue = result.sanitizedValue;
                }
            }
        }

        // Length validation
        if (rules.minLength && String(value).length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
        }

        if (rules.maxLength && String(value).length > rules.maxLength) {
            errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }

        // Value range validation
        if (rules.min !== undefined && value < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
        }

        if (rules.max !== undefined && value > rules.max) {
            errors.push(`${field} must be at most ${rules.max}`);
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(String(value))) {
            errors.push(`${field} format is invalid`);
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
        }

        return { errors, warnings, sanitizedValue };
    };

    // Batch validation with multiple entities
    validateBatch = async (entities, ...validationConfigs) => {
        const results = {
            valid: [],
            invalid: [],
            errors: []
        };

        const mergedConfig = validationConfigs.reduce((config, current) => ({
            ...config,
            ...current
        }), {});

        const validationPromises = entities.map(async (entity, index) => {
            try {
                const validationResult = this.validateFields(entity, mergedConfig.rules);

                if (validationResult.isValid) {
                    results.valid.push({
                        entity,
                        index,
                        sanitized: validationResult.sanitized,
                        warnings: validationResult.warnings
                    });
                } else {
                    results.invalid.push({
                        entity,
                        index,
                        errors: validationResult.errors,
                        warnings: validationResult.warnings
                    });
                }

                // Call progress callback if provided
                if (mergedConfig.onProgress) {
                    mergedConfig.onProgress(index, entities.length);
                }

            } catch (error) {
                results.errors.push({
                    entity,
                    index,
                    error: error.message
                });
            }
        });

        await Promise.allSettled(validationPromises);

        return {
            ...results,
            summary: {
                total: entities.length,
                valid: results.valid.length,
                invalid: results.invalid.length,
                errors: results.errors.length,
                successRate: (results.valid.length / entities.length) * 100
            }
        };
    };

    // Schema validation with multiple schemas
    validateWithSchemas = (data, ...schemas) => {
        const allErrors = {};
        const allWarnings = {};
        const sanitized = { ...data };

        for (const schema of schemas) {
            const validationResult = this.validateFields(data, schema.rules);
            
            // Merge errors and warnings
            Object.assign(allErrors, validationResult.errors);
            Object.assign(allWarnings, validationResult.warnings);
            
            // Update sanitized data
            Object.assign(sanitized, validationResult.sanitized);
        }

        return {
            isValid: Object.keys(allErrors).length === 0,
            hasWarnings: Object.keys(allWarnings).length > 0,
            errors: allErrors,
            warnings: allWarnings,
            sanitized,
            schemasUsed: schemas.length
        };
    };

    // Helper methods
    validateType = (field, value, expectedType) => {
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    return { 
                        isValid: false, 
                        error: `${field} must be a string` 
                    };
                }
                return { 
                    isValid: true, 
                    sanitizedValue: String(value).trim() 
                };

            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    return { 
                        isValid: false, 
                        error: `${field} must be a number` 
                    };
                }
                return { 
                    isValid: true, 
                    sanitizedValue: num 
                };

            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(value))) {
                    return { 
                        isValid: false, 
                        error: `${field} must be a valid email` 
                    };
                }
                return { 
                    isValid: true, 
                    sanitizedValue: String(value).toLowerCase().trim() 
                };

            case 'boolean':
                if (typeof value !== 'boolean') {
                    const boolValue = String(value).toLowerCase() === 'true';
                    return { 
                        isValid: true, 
                        sanitizedValue: boolValue 
                    };
                }
                return { isValid: true };

            default:
                return { isValid: true };
        }
    };

    // Predefined validation rules
    static get USER_CREATION_RULES() {
        return {
            email: {
                type: 'email',
                required: true,
                maxLength: 255
            },
            password: {
                type: 'string',
                required: true,
                minLength: 8,
                validators: [
                    (value) => ({
                        isValid: /[A-Z]/.test(value),
                        error: 'Password must contain at least one uppercase letter'
                    }),
                    (value) => ({
                        isValid: /[0-9]/.test(value),
                        error: 'Password must contain at least one number'
                    })
                ]
            },
            name: {
                type: 'string',
                required: true,
                minLength: 2,
                maxLength: 100
            },
            age: {
                type: 'number',
                min: 13,
                max: 120
            }
        };
    }

    static get USER_UPDATE_RULES() {
        return {
            name: {
                type: 'string',
                minLength: 2,
                maxLength: 100
            },
            status: {
                type: 'string',
                enum: ['active', 'inactive', 'suspended']
            },
            preferences: {
                type: 'object'
            }
        };
    }
}

// ## 5. Event System with Rest Parameters

// Advanced event system with rest parameters
class EventEmitter {
    constructor() {
        this.events = new Map();
        this.middlewares = [];
    }

    // Register event with multiple handlers
    on = (eventName, ...handlers) => {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        const wrappedHandlers = handlers.map(handler => 
            this.wrapHandler(eventName, handler)
        );

        this.events.get(eventName).push(...wrappedHandlers);

        // Return unsubscribe function
        return () => {
            const eventHandlers = this.events.get(eventName) || [];
            const newHandlers = eventHandlers.filter(
                h => !wrappedHandlers.includes(h)
            );
            this.events.set(eventName, newHandlers);
        };
    };

    // Emit event with multiple data payloads
    emit = async (eventName, ...dataPayloads) => {
        const handlers = this.events.get(eventName) || [];
        
        if (handlers.length === 0) {
            console.warn(`No handlers registered for event: ${eventName}`);
            return {
                event: eventName,
                results: [],
                summary: {
                    totalHandlers: 0,
                    successful: 0,
                    failed: 0
                }
            };
        }

        // Merge data payloads
        const mergedData = dataPayloads.reduce((merged, current) => ({
            ...merged,
            ...current
        }), {});

        // Apply middlewares
        let processedData = mergedData;
        for (const middleware of this.middlewares) {
            processedData = await middleware(eventName, processedData);
        }

        // Execute handlers
        const handlerPromises = handlers.map(async (handler, index) => {
            try {
                const result = await handler(processedData, eventName);
                return {
                    handlerIndex: index,
                    status: 'success',
                    result,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                return {
                    handlerIndex: index,
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        const results = await Promise.allSettled(handlerPromises);
        const settledResults = results.map(result => 
            result.status === 'fulfilled' ? result.value : {
                handlerIndex: -1,
                status: 'error',
                error: 'Handler execution failed',
                timestamp: new Date().toISOString()
            }
        );

        const summary = {
            totalHandlers: handlers.length,
            successful: settledResults.filter(r => r.status === 'success').length,
            failed: settledResults.filter(r => r.status === 'error').length
        };

        return {
            event: eventName,
            data: processedData,
            results: settledResults,
            summary
        };
    };

    // Batch emit multiple events
    emitBatch = async (...events) => {
        const results = [];

        for (const event of events) {
            const { eventName, data } = event;
            const result = await this.emit(eventName, data);
            results.push(result);
        }

        return {
            events: results,
            summary: {
                totalEvents: events.length,
                totalHandlers: results.reduce((sum, r) => sum + r.summary.totalHandlers, 0),
                totalSuccessful: results.reduce((sum, r) => sum + r.summary.successful, 0),
                totalFailed: results.reduce((sum, r) => sum + r.summary.failed, 0)
            }
        };
    };

    // Add multiple middlewares
    use = (...middlewares) => {
        this.middlewares.push(...middlewares);
    };

    // Remove middlewares
    removeMiddleware = (...middlewaresToRemove) => {
        this.middlewares = this.middlewares.filter(
            middleware => !middlewaresToRemove.includes(middleware)
        );
    };

    // Helper methods
    wrapHandler = (eventName, handler) => {
        return async (data, originalEventName) => {
            const startTime = Date.now();
            
            try {
                const result = await handler(data, originalEventName);
                const duration = Date.now() - startTime;
                
                console.log(`Handler for ${eventName} completed in ${duration}ms`);
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                console.error(`Handler for ${eventName} failed after ${duration}ms:`, error);
                throw error;
            }
        };
    };

    // Get event statistics
    getStats = () => {
        const stats = {
            totalEvents: this.events.size,
            totalHandlers: 0,
            events: {}
        };

        for (const [eventName, handlers] of this.events.entries()) {
            stats.events[eventName] = {
                handlerCount: handlers.length
            };
            stats.totalHandlers += handlers.length;
        }

        stats.middlewareCount = this.middlewares.length;
        return stats;
    };
}

// Usage example
const eventSystem = new EventEmitter();

// Add middlewares
eventSystem.use(
    // Logging middleware
    async (eventName, data) => {
        console.log(`Event ${eventName} emitted with data:`, data);
        return data;
    },
    
    // Validation middleware
    async (eventName, data) => {
        if (eventName === 'user.created') {
            if (!data.email || !data.userId) {
                throw new Error('Invalid user data for user.created event');
            }
        }
        return data;
    },
    
    // Transformation middleware
    async (eventName, data) => {
        if (eventName.includes('user.')) {
            return {
                ...data,
                timestamp: new Date().toISOString(),
                eventName
            };
        }
        return data;
    }
);

// Register multiple handlers for same event
const unsubscribe = eventSystem.on(
    'user.created',
    
    // Handler 1: Send welcome email
    async (data) => {
        await emailService.sendWelcomeEmail(data.email, data.name);
        return { action: 'welcome_email_sent', success: true };
    },
    
    // Handler 2: Create user profile
    async (data) => {
        const profile = await userService.createProfile(data.userId);
        return { action: 'profile_created', profile };
    },
    
    // Handler 3: Update analytics
    async (data) => {
        await analyticsService.track('user_created', data);
        return { action: 'analytics_updated', success: true };
    }
);

// Emit event with multiple data objects
const result = await eventSystem.emit(
    'user.created',
    { userId: '123', email: 'test@example.com', name: 'Test User' },
    { source: 'web_registration', ip: '192.168.1.1' },
    { metadata: { campaign: 'winter_2024' } }
);

// ## 6. Utility Functions with Rest Parameters

// Production utility functions with rest parameters
class ProductionUtils {
    // Advanced logging with multiple metadata objects
    static createLogger = (baseContext = {}, ...additionalContexts) => {
        const mergedContext = additionalContexts.reduce((context, additional) => ({
            ...context,
            ...additional
        }), baseContext);

        return {
            info: (message, ...metadata) => {
                const allMetadata = metadata.reduce((merged, current) => ({
                    ...merged,
                    ...current
                }), {});

                console.log(JSON.stringify({
                    level: 'INFO',
                    timestamp: new Date().toISOString(),
                    message,
                    ...mergedContext,
                    ...allMetadata
                }));
            },

            error: (message, error, ...metadata) => {
                const allMetadata = metadata.reduce((merged, current) => ({
                    ...merged,
                    ...current
                }), {});

                console.error(JSON.stringify({
                    level: 'ERROR',
                    timestamp: new Date().toISOString(),
                    message,
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    ...mergedContext,
                    ...allMetadata
                }));
            },

            warn: (message, ...metadata) => {
                const allMetadata = metadata.reduce((merged, current) => ({
                    ...merged,
                    ...current
                }), {});

                console.warn(JSON.stringify({
                    level: 'WARN',
                    timestamp: new Date().toISOString(),
                    message,
                    ...mergedContext,
                    ...allMetadata
                }));
            },

            debug: (message, ...metadata) => {
                if (process.env.NODE_ENV === 'development') {
                    const allMetadata = metadata.reduce((merged, current) => ({
                        ...merged,
                        ...current
                    }), {});

                    console.debug(JSON.stringify({
                        level: 'DEBUG',
                        timestamp: new Date().toISOString(),
                        message,
                        ...mergedContext,
                        ...allMetadata
                    }));
                }
            }
        };
    };

    // Configuration merger with multiple config sources
    static mergeConfigs = (baseConfig, ...configOverrides) => {
        return configOverrides.reduce((config, override) => {
            const merged = { ...config };
            
            for (const [key, value] of Object.entries(override)) {
                if (value === undefined || value === null) {
                    continue;
                }
                
                if (Array.isArray(value) && Array.isArray(merged[key])) {
                    // Merge arrays, avoiding duplicates
                    merged[key] = [...new Set([...merged[key], ...value])];
                } else if (typeof value === 'object' && value !== null && 
                          typeof merged[key] === 'object' && merged[key] !== null) {
                    // Recursively merge objects
                    merged[key] = this.mergeConfigs(merged[key], value);
                } else {
                    // Override primitive values
                    merged[key] = value;
                }
            }
            
            return merged;
        }, baseConfig);
    };

    // Advanced error handling with multiple error handlers
    static createErrorHandler = (...errorHandlers) => {
        return async (error, context = {}) => {
            const results = [];
            
            for (const handler of errorHandlers) {
                try {
                    const result = await handler(error, context);
                    results.push({
                        handler: handler.name || 'anonymous',
                        success: true,
                        result
                    });
                } catch (handlerError) {
                    results.push({
                        handler: handler.name || 'anonymous',
                        success: false,
                        error: handlerError.message
                    });
                }
            }
            
            return {
                handled: true,
                originalError: error.message,
                context,
                handlerResults: results,
                summary: {
                    totalHandlers: errorHandlers.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length
                }
            };
        };
    };

    // Data transformation pipeline
    static createTransformPipeline = (...transformers) => {
        return async (data, context = {}) => {
            let currentData = data;
            const transformations = [];
            
            for (const [index, transformer] of transformers.entries()) {
                try {
                    const startTime = Date.now();
                    currentData = await transformer(currentData, context);
                    const duration = Date.now() - startTime;
                    
                    transformations.push({
                        index,
                        transformer: transformer.name || `transformer_${index}`,
                        success: true,
                        duration,
                        outputType: typeof currentData
                    });
                } catch (error) {
                    transformations.push({
                        index,
                        transformer: transformer.name || `transformer_${index}`,
                        success: false,
                        error: error.message,
                        duration: Date.now() - startTime
                    });
                    throw new Error(`Transform pipeline failed at step ${index}: ${error.message}`);
                }
            }
            
            return {
                data: currentData,
                transformations,
                summary: {
                    totalTransformations: transformers.length,
                    successful: transformations.filter(t => t.success).length,
                    totalDuration: transformations.reduce((sum, t) => sum + t.duration, 0)
                }
            };
        };
    };

    // Batch processor with multiple operations
    static createBatchProcessor = (operation, ...options) => {
        const mergedOptions = options.reduce((opts, current) => ({
            ...opts,
            ...current
        }), {
            batchSize: 100,
            concurrency: 1,
            retryAttempts: 3,
            onProgress: null
        });

        return async (items) => {
            const batches = [];
            for (let i = 0; i < items.length; i += mergedOptions.batchSize) {
                batches.push(items.slice(i, i + mergedOptions.batchSize));
            }

            const results = {
                successful: [],
                failed: [],
                batchesProcessed: 0
            };

            const processBatch = async (batch, batchIndex) => {
                const batchResults = {
                    successful: [],
                    failed: []
                };

                for (const [itemIndex, item] of batch.entries()) {
                    let lastError;
                    
                    for (let attempt = 1; attempt <= mergedOptions.retryAttempts; attempt++) {
                        try {
                            const result = await operation(item, {
                                batchIndex,
                                itemIndex,
                                attempt,
                                totalItems: items.length
                            });
                            
                            batchResults.successful.push({
                                item,
                                result,
                                batchIndex,
                                itemIndex,
                                attempt
                            });
                            break;
                        } catch (error) {
                            lastError = error;
                            
                            if (attempt === mergedOptions.retryAttempts) {
                                batchResults.failed.push({
                                    item,
                                    error: lastError.message,
                                    batchIndex,
                                    itemIndex,
                                    attempts: attempt
                                });
                            } else {
                                // Wait before retry (exponential backoff)
                                await new Promise(resolve => 
                                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                                );
                            }
                        }
                    }
                }

                results.batchesProcessed++;
                results.successful.push(...batchResults.successful);
                results.failed.push(...batchResults.failed);

                // Report progress
                if (mergedOptions.onProgress) {
                    mergedOptions.onProgress({
                        batchesProcessed: results.batchesProcessed,
                        totalBatches: batches.length,
                        successfulItems: results.successful.length,
                        failedItems: results.failed.length,
                        totalItems: items.length
                    });
                }

                return batchResults;
            };

            // Process batches with concurrency control
            if (mergedOptions.concurrency > 1) {
                const executing = new Set();
                
                for (const [batchIndex, batch] of batches.entries()) {
                    if (executing.size >= mergedOptions.concurrency) {
                        await Promise.race(executing);
                    }
                    
                    const promise = processBatch(batch, batchIndex);
                    executing.add(promise);
                    promise.finally(() => executing.delete(promise));
                }
                
                // Wait for all remaining batches
                await Promise.allSettled(executing);
            } else {
                // Sequential processing
                for (const [batchIndex, batch] of batches.entries()) {
                    await processBatch(batch, batchIndex);
                }
            }

            return {
                ...results,
                summary: {
                    totalItems: items.length,
                    totalBatches: batches.length,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    successRate: (results.successful.length / items.length) * 100
                }
            };
        };
    };
}

// Usage examples
const logger = ProductionUtils.createLogger(
    { service: 'user-service', version: '1.0.0' },
    { environment: process.env.NODE_ENV },
    { deployment: process.env.DEPLOYMENT_ID }
);

const config = ProductionUtils.mergeConfigs(
    { database: { host: 'localhost', port: 27017 } },
    { database: { host: 'prod-db.example.com' } },
    { cache: { enabled: true, ttl: 300 } },
    { features: { newAuth: true, betaFeatures: ['dashboard_v2'] } }
);

const errorHandler = ProductionUtils.createErrorHandler(
    // Log error
    async (error, context) => {
        logger.error('Error occurred', error, context);
    },
    // Send to monitoring service
    async (error, context) => {
        await monitoringService.captureException(error, context);
    },
    // Notify team for critical errors
    async (error, context) => {
        if (context.critical) {
            await notificationService.notifyTeam(error, context);
        }
    }
);

// These rest parameter patterns provide:

// 1. **Flexible APIs** - Functions that can accept varying numbers of arguments
// 2. **Clean Syntax** - No need for `arguments` object or manual array manipulation
// 3. **Type Safety** - Clear parameter expectations with modern JavaScript
// 4. **Production Reliability** - Comprehensive error handling and validation
// 5. **Maintainability** - Easy to extend and modify function signatures
// 6. **Performance** - Efficient handling of multiple arguments

// Rest parameters are particularly useful for:
// - Configuration merging
// - Middleware composition
// - Batch operations
// - Event handling systems
// - Validation pipelines
// - Data transformation chains






























// I'll provide comprehensive code snippets for callback patterns in Node.js production-grade backend development, covering various scenarios and best practices.

// ## 1. Basic Callback Patterns

// ### Standard Error-First Callbacks
// Standard Node.js callback pattern (error-first)
function readUserData(userId, callback) {
    // Simulate async operation
    setTimeout(() => {
        if (!userId) {
            return callback(new Error('User ID is required'));
        }
        
        if (userId === '123') {
            callback(null, { id: '123', name: 'John Doe', email: 'john@example.com' });
        } else {
            callback(new Error('User not found'));
        }
    }, 100);
}

// Usage
readUserData('123', (error, user) => {
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('User found:', user);
});

// ### Callback with Multiple Results
function getUserWithPosts(userId, callback) {
    // Simulate fetching user and posts
    setTimeout(() => {
        if (!userId) {
            return callback(new Error('Invalid user ID'));
        }
        
        const user = { id: userId, name: 'Jane Smith' };
        const posts = [
            { id: 1, title: 'First Post', content: 'Hello World' },
            { id: 2, title: 'Second Post', content: 'Node.js is awesome' }
        ];
        
        callback(null, user, posts);
    }, 150);
}

// Usage
getUserWithPosts('456', (error, user, posts) => {
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('User:', user);
    console.log('Posts:', posts);
});

// ## 2. Production-Grade Callback Utilities

// ### Callback Helper Functions
// Utility to ensure callback is only called once
function once(callback) {
    let called = false;
    return function(...args) {
        if (called) return;
        called = true;
        callback.apply(this, args);
    };
}

// Safe callback execution with error handling
function safeCallback(callback) {
    return function(error, ...results) {
        if (typeof callback !== 'function') {
            return;
        }
        
        try {
            callback(error, ...results);
        } catch (err) {
            // Log callback errors but don't throw (prevent unhandled exceptions)
            console.error('Callback execution error:', err);
        }
    };
}

// Usage example
function asyncOperation(data, callback) {
    const safeCallbackOnce = once(safeCallback(callback));
    
    setTimeout(() => {
        try {
            // Simulate processing
            const result = data.toUpperCase();
            safeCallbackOnce(null, result);
            // This won't execute due to 'once' wrapper
            safeCallbackOnce(null, 'duplicate call');
        } catch (error) {
            safeCallbackOnce(error);
        }
    }, 100);
}

// ### Timeout Wrapper for Callbacks
function withTimeout(asyncFn, timeoutMs, callback) {
    let timer = null;
    let completed = false;
    
    const timeoutCallback = once(safeCallback(callback));
    
    // Set timeout
    timer = setTimeout(() => {
        if (!completed) {
            completed = true;
            timeoutCallback(new Error(`Operation timed out after ${timeoutMs}ms`));
        }
    }, timeoutMs);
    
    // Execute original function
    asyncFn((error, ...results) => {
        if (!completed) {
            completed = true;
            clearTimeout(timer);
            timeoutCallback(error, ...results);
        }
    });
}

// Usage
function slowOperation(callback) {
    setTimeout(() => {
        callback(null, 'Operation completed');
    }, 2000);
}

withTimeout(slowOperation, 1000, (error, result) => {
    if (error) {
        console.error('Error:', error.message); // Will timeout
        return;
    }
    console.log('Success:', result);
});

// ## 3. Database Operations with Callbacks

// ### MySQL Database Wrapper
const mysql = require('mysql2');

class Database {
    constructor(config) {
        this.pool = mysql.createPool({
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            connectionLimit: 10,
            acquireTimeout: 60000,
            timeout: 60000
        });
    }

    query(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        const safeCallback = once(safeCallback(callback));
        
        this.pool.getConnection((error, connection) => {
            if (error) {
                return safeCallback(error);
            }
            
            connection.query(sql, params, (queryError, results) => {
                connection.release();
                
                if (queryError) {
                    return safeCallback(queryError);
                }
                
                safeCallback(null, results);
            });
        });
    }

    // Transaction support with callbacks
    transaction(operations, callback) {
        const safeCallback = once(safeCallback(callback));
        
        this.pool.getConnection((error, connection) => {
            if (error) {
                return safeCallback(error);
            }
            
            connection.beginTransaction((transactionError) => {
                if (transactionError) {
                    connection.release();
                    return safeCallback(transactionError);
                }
                
                // Execute operations
                operations(connection, (opsError, result) => {
                    if (opsError) {
                        return connection.rollback(() => {
                            connection.release();
                            safeCallback(opsError);
                        });
                    }
                    
                    connection.commit((commitError) => {
                        if (commitError) {
                            return connection.rollback(() => {
                                connection.release();
                                safeCallback(commitError);
                            });
                        }
                        
                        connection.release();
                        safeCallback(null, result);
                    });
                });
            });
        });
    }

    close(callback) {
        this.pool.end(callback);
    }
}

// Usage
const db = new Database({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'myapp'
});

// Query example
db.query('SELECT * FROM users WHERE id = ?', [1], (error, results) => {
    if (error) {
        console.error('Database error:', error);
        return;
    }
    console.log('User:', results[0]);
});

// Transaction example
db.transaction((connection, done) => {
    connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1], (error) => {
        if (error) return done(error);
        
        connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2], (error) => {
            if (error) return done(error);
            done(null, 'Transfer completed');
        });
    });
}, (error, result) => {
    if (error) {
        console.error('Transaction failed:', error);
        return;
    }
    console.log('Transaction successful:', result);
});

// ## 4. File System Operations

// ### Advanced File Operations with Callbacks
const fs = require('fs');
const path = require('path');

class FileManager {
    // Read file with encoding and callback
    readFile(filePath, encoding = 'utf8', callback) {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = 'utf8';
        }
        
        const safeCallback = once(safeCallback(callback));
        
        fs.readFile(filePath, encoding, (error, data) => {
            if (error) {
                return safeCallback(error);
            }
            safeCallback(null, data);
        });
    }

    // Write file with backup
    writeFileWithBackup(filePath, data, callback) {
        const safeCallback = once(safeCallback(callback));
        const backupPath = `${filePath}.backup`;
        
        // First create backup
        fs.copyFile(filePath, backupPath, (backupError) => {
            if (backupError && backupError.code !== 'ENOENT') {
                return safeCallback(backupError);
            }
            
            // Then write new file
            fs.writeFile(filePath, data, (writeError) => {
                if (writeError) {
                    // If write failed, try to restore from backup if it exists
                    fs.access(backupPath, (accessError) => {
                        if (!accessError) {
                            fs.copyFile(backupPath, filePath, () => {
                                safeCallback(writeError);
                            });
                        } else {
                            safeCallback(writeError);
                        }
                    });
                    return;
                }
                
                // Clean up backup on success
                fs.unlink(backupPath, (unlinkError) => {
                    // Ignore unlink errors
                    safeCallback(null, 'File written successfully');
                });
            });
        });
    }

    // Recursive directory operations
    walkDirectory(dirPath, fileCallback, finishCallback, errorCallback) {
        const safeFinishCallback = once(safeCallback(finishCallback));
        const safeErrorCallback = once(safeCallback(errorCallback));
        
        fs.readdir(dirPath, (error, items) => {
            if (error) {
                return safeErrorCallback(error);
            }
            
            let pending = items.length;
            if (pending === 0) {
                return safeFinishCallback(null);
            }
            
            items.forEach((item) => {
                const fullPath = path.join(dirPath, item);
                
                fs.stat(fullPath, (statError, stats) => {
                    if (statError) {
                        safeErrorCallback(statError);
                        return;
                    }
                    
                    if (stats.isDirectory()) {
                        this.walkDirectory(fullPath, fileCallback, () => {
                            if (--pending === 0) {
                                safeFinishCallback(null);
                            }
                        }, safeErrorCallback);
                    } else {
                        fileCallback(fullPath, stats, (fileError) => {
                            if (fileError) {
                                safeErrorCallback(fileError);
                                return;
                            }
                            
                            if (--pending === 0) {
                                safeFinishCallback(null);
                            }
                        });
                    }
                });
            });
        });
    }
}

// Usage
const fileManager = new FileManager();

// Read file
fileManager.readFile('/path/to/file.txt', (error, content) => {
    if (error) {
        console.error('Read error:', error);
        return;
    }
    console.log('File content:', content);
});

// Walk directory
fileManager.walkDirectory(
    '/path/to/directory',
    (filePath, stats, next) => {
        console.log('Processing file:', filePath);
        // Process each file
        next();
    },
    (error) => {
        if (error) {
            console.error('Walk error:', error);
            return;
        }
        console.log('Directory processing completed');
    },
    (error) => {
        console.error('Fatal error:', error);
    }
);

// ## 5. HTTP Request Handling with Callbacks

// ### HTTP Client with Callbacks
const https = require('https');
const http = require('http');

class HttpClient {
    constructor(options = {}) {
        this.defaultTimeout = options.timeout || 30000;
        this.retryAttempts = options.retryAttempts || 3;
    }

    request(options, data = null, callback) {
        if (typeof data === 'function') {
            callback = data;
            data = null;
        }
        
        const safeCallback = once(safeCallback(callback));
        const timeout = options.timeout || this.defaultTimeout;
        
        this._makeRequest(options, data, timeout, this.retryAttempts, safeCallback);
    }

    _makeRequest(options, data, timeout, retriesLeft, callback) {
        const protocol = options.protocol === 'https:' ? https : http;
        let timer = null;
        
        const req = protocol.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                clearTimeout(timer);
                
                if (res.statusCode >= 400) {
                    const error = new Error(`HTTP Error: ${res.statusCode}`);
                    error.statusCode = res.statusCode;
                    error.response = responseData;
                    return callback(error);
                }
                
                callback(null, {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: responseData
                });
            });
        });
        
        req.on('error', (error) => {
            clearTimeout(timer);
            
            if (retriesLeft > 0) {
                console.log(`Retrying request, ${retriesLeft} attempts left`);
                setTimeout(() => {
                    this._makeRequest(options, data, timeout, retriesLeft - 1, callback);
                }, 1000);
            } else {
                callback(error);
            }
        });
        
        // Set timeout
        timer = setTimeout(() => {
            req.destroy();
            callback(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
        
        // Send data if provided
        if (data) {
            req.write(data);
        }
        
        req.end();
    }

    get(url, options = {}, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        const requestOptions = {
            ...options,
            method: 'GET',
            protocol: new URL(url).protocol,
            hostname: new URL(url).hostname,
            path: new URL(url).pathname + new URL(url).search
        };
        
        this.request(requestOptions, callback);
    }

    post(url, data, options = {}, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        const requestOptions = {
            ...options,
            method: 'POST',
            protocol: new URL(url).protocol,
            hostname: new URL(url).hostname,
            path: new URL(url).pathname,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        const jsonData = JSON.stringify(data);
        requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
        
        this.request(requestOptions, jsonData, callback);
    }
}

// Usage
const client = new HttpClient({ timeout: 5000, retryAttempts: 2 });

// GET request
client.get('https://api.example.com/users', (error, response) => {
    if (error) {
        console.error('Request failed:', error);
        return;
    }
    console.log('Response:', response.data);
});

// POST request
client.post(
    'https://api.example.com/users',
    { name: 'John Doe', email: 'john@example.com' },
    { headers: { 'Authorization': 'Bearer token' } },
    (error, response) => {
        if (error) {
            console.error('POST failed:', error);
            return;
        }
        console.log('User created:', response.data);
    }
);

// ## 6. Control Flow Patterns

// ### Parallel Execution
function parallel(tasks, callback) {
    const safeCallback = once(safeCallback(callback));
    const results = new Array(tasks.length);
    let completed = 0;
    let hasError = false;

    tasks.forEach((task, index) => {
        task((error, result) => {
            if (hasError) return;
            
            if (error) {
                hasError = true;
                return safeCallback(error);
            }
            
            results[index] = result;
            completed++;
            
            if (completed === tasks.length) {
                safeCallback(null, results);
            }
        });
    });
}

// Usage
parallel([
    (cb) => setTimeout(() => cb(null, 'Task 1 done'), 100),
    (cb) => setTimeout(() => cb(null, 'Task 2 done'), 50),
    (cb) => setTimeout(() => cb(null, 'Task 3 done'), 75)
], (error, results) => {
    if (error) {
        console.error('Parallel error:', error);
        return;
    }
    console.log('All tasks completed:', results);
});

// ### Sequential Execution
function series(tasks, callback) {
    const safeCallback = once(safeCallback(callback));
    const results = [];
    let index = 0;
    
    function next() {
        if (index >= tasks.length) {
            return safeCallback(null, results);
        }
        
        const task = tasks[index++];
        task((error, result) => {
            if (error) {
                return safeCallback(error);
            }
            
            results.push(result);
            next();
        });
    }
    
    next();
}

// Usage
series([
    (cb) => setTimeout(() => cb(null, 'Step 1'), 100),
    (cb) => setTimeout(() => cb(null, 'Step 2'), 50),
    (cb) => setTimeout(() => cb(null, 'Step 3'), 75)
], (error, results) => {
    if (error) {
        console.error('Series error:', error);
        return;
    }
    console.log('Sequence completed:', results);
});

// ### Waterfall Pattern
function waterfall(tasks, callback) {
    const safeCallback = once(safeCallback(callback));
    let index = 0;
    let previousResult = null;
    
    function next(error, ...results) {
        if (error) {
            return safeCallback(error);
        }
        
        if (index >= tasks.length) {
            return safeCallback(null, ...results);
        }
        
        const task = tasks[index++];
        task(previousResult, next);
        
        // Update previous result for next iteration
        if (results.length > 0) {
            previousResult = results[0];
        }
    }
    
    next(null);
}

// Usage
waterfall([
    (initial, cb) => {
        console.log('Step 1 with:', initial);
        setTimeout(() => cb(null, 'result1'), 100);
    },
    (prevResult, cb) => {
        console.log('Step 2 with:', prevResult);
        setTimeout(() => cb(null, 'result2', 'additional'), 50);
    },
    (prevResult, cb) => {
        console.log('Step 3 with:', prevResult);
        setTimeout(() => cb(null, 'final'), 75);
    }
], (error, finalResult) => {
    if (error) {
        console.error('Waterfall error:', error);
        return;
    }
    console.log('Waterfall completed:', finalResult);
});

// ## 7. Error Handling Best Practices

// ### Comprehensive Error Handler
class ErrorHandler {
    static handleDatabaseError(error, callback) {
        const safeCallback = once(safeCallback(callback));
        
        if (error.code === 'ER_DUP_ENTRY') {
            return safeCallback(new Error('Duplicate entry found'));
        } else if (error.code === 'ER_NO_REFERENCED_ROW') {
            return safeCallback(new Error('Referenced record not found'));
        } else if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
            return safeCallback(new Error('Database lock timeout'));
        } else if (error.fatal) {
            return safeCallback(new Error('Database connection failed'));
        }
        
        // Log unexpected errors
        console.error('Unexpected database error:', error);
        safeCallback(new Error('Internal database error'));
    }

    static handleNetworkError(error, callback) {
        const safeCallback = once(safeCallback(callback));
        
        if (error.code === 'ECONNREFUSED') {
            return safeCallback(new Error('Service unavailable'));
        } else if (error.code === 'ETIMEDOUT') {
            return safeCallback(new Error('Request timeout'));
        } else if (error.code === 'ENOTFOUND') {
            return safeCallback(new Error('Service not found'));
        }
        
        console.error('Unexpected network error:', error);
        safeCallback(new Error('Network communication failed'));
    }

    static wrapAsync(fn) {
        return function(...args) {
            const callback = args.pop();
            const safeCallback = once(safeCallback(callback));
            
            try {
                fn(...args, safeCallback);
            } catch (syncError) {
                safeCallback(syncError);
            }
        };
    }
}

// Usage example with error handling
const safeDatabaseQuery = ErrorHandler.wrapAsync((query, params, callback) => {
    // This would be your actual database call
    someDatabaseLibrary.query(query, params, (error, results) => {
        if (error) {
            return ErrorHandler.handleDatabaseError(error, callback);
        }
        callback(null, results);
    });
});

// These code snippets provide production-ready callback patterns for Node.js backend development, including proper error handling, resource management, and common async patterns used in real-world applications.