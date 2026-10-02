// Here are comprehensive code snippets for JavaScript Classes in Node.js backend development:

// ## 1. Basic Class Structure

// Base class for all services
class BaseService {
  constructor(name, options = {}) {
    this.name = name;
    this.logger = options.logger || console;
    this.isInitialized = false;
    this.errors = [];
  }

  // Public method
  async initialize() {
    try {
      await this._validateConfig();
      this.isInitialized = true;
      this.logger.info(`${this.name} service initialized`);
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }

  // Protected method (convention with _ prefix)
  _validateConfig() {
    if (!this.name) {
      throw new Error('Service name is required');
    }
    return true;
  }

  // Private method (using # syntax - ES2022)
  #generateId() {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getter
  get status() {
    return {
      name: this.name,
      initialized: this.isInitialized,
      errorCount: this.errors.length,
      lastError: this.errors[this.errors.length - 1] || null
    };
  }

  // Setter
  set logger(newLogger) {
    if (typeof newLogger.info !== 'function') {
      throw new Error('Logger must have info method');
    }
    this._logger = newLogger;
  }

  get logger() {
    return this._logger;
  }

  // Static method
  static getVersion() {
    return '1.0.0';
  }
}

// ## 2. Database Model Class

const { v4: uuidv4 } = require('uuid');

class DatabaseModel extends BaseService {
  constructor(tableName, schema, databaseClient) {
    super(`DBModel:${tableName}`);
    this.tableName = tableName;
    this.schema = schema;
    this.db = databaseClient;
    this.softDelete = schema.softDelete || false;
  }

  async create(data) {
    this._validateData(data);
    
    const record = {
      id: uuidv4(),
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      const result = await this.db(this.tableName).insert(record).returning('*');
      this.logger.info(`Created record in ${this.tableName}`, { id: record.id });
      return result[0];
    } catch (error) {
      this.errors.push(error);
      throw new Error(`Failed to create record: ${error.message}`);
    }
  }

  async findById(id, options = {}) {
    let query = this.db(this.tableName).where({ id });

    if (this.softDelete && !options.includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    const record = await query.first();
    
    if (!record) {
      throw new Error(`Record not found with id: ${id}`);
    }

    return record;
  }

  async update(id, data) {
    const updateData = {
      ...data,
      updated_at: new Date()
    };

    const result = await this.db(this.tableName)
      .where({ id })
      .update(updateData)
      .returning('*');

    if (!result.length) {
      throw new Error(`Record not found with id: ${id}`);
    }

    this.logger.info(`Updated record in ${this.tableName}`, { id });
    return result[0];
  }

  async delete(id, hardDelete = false) {
    if (this.softDelete && !hardDelete) {
      return await this.update(id, { deleted_at: new Date() });
    }

    const result = await this.db(this.tableName)
      .where({ id })
      .delete()
      .returning('*');

    this.logger.info(`Deleted record from ${this.tableName}`, { id });
    return result[0];
  }

  _validateData(data) {
    const requiredFields = Object.entries(this.schema.fields)
      .filter(([_, field]) => field.required)
      .map(([name]) => name);

    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Type validation
    for (const [field, value] of Object.entries(data)) {
      const fieldSchema = this.schema.fields[field];
      if (fieldSchema && !this._validateType(value, fieldSchema.type)) {
        throw new Error(`Invalid type for field ${field}. Expected ${fieldSchema.type}`);
      }
    }
  }

  _validateType(value, expectedType) {
    const typeMap = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      object: 'object',
      array: 'object'
    };

    return typeof value === typeMap[expectedType] && 
          (expectedType !== 'array' || Array.isArray(value));
  }

  // Static factory method
  static createUserModel(databaseClient) {
    const schema = {
      softDelete: true,
      fields: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number', required: false },
        preferences: { type: 'object', required: false }
      }
    };

    return new DatabaseModel('users', schema, databaseClient);
  }
}

// ## 3. API Controller Class

class ApiController extends BaseService {
  constructor(service, validationSchema) {
    super(`APIController:${service.name}`);
    this.service = service;
    this.validationSchema = validationSchema;
  }

  async handleRequest(method, ...args) {
    try {
      this._validateMethod(method);
      
      const result = await this.service[method](...args);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.errors.push(error);
      
      return {
        success: false,
        error: {
          message: error.message,
          code: this._getErrorCode(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async create(req, res) {
    const validationResult = this._validateData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        errors: validationResult.errors
      });
    }

    const result = await this.handleRequest('create', req.body);
    
    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  }

  async findById(req, res) {
    const result = await this.handleRequest('findById', req.params.id);
    
    const statusCode = result.success ? 200 : 404;
    res.status(statusCode).json(result);
  }

  async update(req, res) {
    const validationResult = this._validateData(req.body, true);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        errors: validationResult.errors
      });
    }

    const result = await this.handleRequest('update', req.params.id, req.body);
    
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  }

  async delete(req, res) {
    const result = await this.handleRequest('delete', req.params.id);
    
    const statusCode = result.success ? 204 : 400;
    res.status(statusCode).json(result);
  }

  _validateMethod(method) {
    if (typeof this.service[method] !== 'function') {
      throw new Error(`Method ${method} not available in service`);
    }
  }

  _validateData(data, isPartial = false) {
    // Simplified validation - in production, use Joi or Yup
    const errors = [];
    
    for (const [field, schema] of Object.entries(this.validationSchema)) {
      if (schema.required && !isPartial && !data[field]) {
        errors.push(`${field} is required`);
      }
      
      if (data[field] && schema.type && typeof data[field] !== schema.type) {
        errors.push(`${field} must be of type ${schema.type}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  _getErrorCode(error) {
    const errorCodeMap = {
      'not found': 'NOT_FOUND',
      'validation': 'VALIDATION_ERROR',
      'unauthorized': 'UNAUTHORIZED'
    };

    for (const [keyword, code] of Object.entries(errorCodeMap)) {
      if (error.message.toLowerCase().includes(keyword)) {
        return code;
      }
    }

    return 'INTERNAL_ERROR';
  }
}

// ## 4. Service Layer with Dependency Injection

class UserService extends BaseService {
  constructor(userModel, emailService, cacheService) {
    super('UserService');
    this.userModel = userModel;
    this.emailService = emailService;
    this.cacheService = cacheService;
    this.cacheTtl = 300; // 5 minutes
  }

  async createUser(userData) {
    // Check if user already exists
    const existingUser = await this.userModel.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create user
    const user = await this.userModel.create(userData);
    
    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);
    
    // Invalidate cache
    await this.cacheService.delete('users:list');
    
    this.logger.info('User created successfully', { userId: user.id });
    return user;
  }

  async getUserById(id, useCache = true) {
    const cacheKey = `user:${id}`;
    
    if (useCache) {
      const cachedUser = await this.cacheService.get(cacheKey);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }
    }

    const user = await this.userModel.findById(id);
    
    if (useCache) {
      await this.cacheService.set(
        cacheKey, 
        JSON.stringify(user), 
        this.cacheTtl
      );
    }

    return user;
  }

  async updateUserProfile(id, updates) {
    const allowedFields = ['name', 'preferences', 'avatar'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    const updatedUser = await this.userModel.update(id, filteredUpdates);
    
    // Invalidate relevant cache entries
    await Promise.all([
      this.cacheService.delete(`user:${id}`),
      this.cacheService.delete('users:list')
    ]);

    return updatedUser;
  }

  async deactivateUser(id) {
    const user = await this.userModel.update(id, { 
      active: false,
      deactivated_at: new Date()
    });

    await this.emailService.sendDeactivationEmail(user.email);
    
    this.logger.info('User deactivated', { userId: id });
    return user;
  }

  // Batch operations
  async bulkCreateUsers(usersData) {
    const results = {
      successful: [],
      failed: []
    };

    for (const userData of usersData) {
      try {
        const user = await this.createUser(userData);
        results.successful.push(user);
      } catch (error) {
        results.failed.push({
          data: userData,
          error: error.message
        });
      }
    }

    return results;
  }
}

// ## 5. Middleware Class

class AuthMiddleware extends BaseService {
  constructor(jwtService, userService) {
    super('AuthMiddleware');
    this.jwtService = jwtService;
    this.userService = userService;
  }

  authenticate() {
    return async (req, res, next) => {
      try {
        const token = this._extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Access token required'
          });
        }

        const decoded = await this.jwtService.verify(token);
        const user = await this.userService.getUserById(decoded.userId, false);
        
        if (!user.active) {
          return res.status(401).json({
            success: false,
            error: 'User account is deactivated'
          });
        }

        req.user = user;
        req.token = token;
        
        next();
      } catch (error) {
        this.errors.push(error);
        
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
    };
  }

  authorize(requiredPermissions = []) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (req.user.role !== requiredRole) {
        return res.status(403).json({
          success: false,
          error: `Required role: ${requiredRole}`
        });
      }

      next();
    };
  }

  _extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return req.query.token || req.cookies?.accessToken;
  }
}

// ## 6. Factory Pattern with Classes

class ServiceFactory extends BaseService {
  constructor(databaseClient, config) {
    super('ServiceFactory');
    this.db = databaseClient;
    this.config = config;
    this.cache = new Map();
  }

  getUserService() {
    const cacheKey = 'UserService';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const userModel = DatabaseModel.createUserModel(this.db);
    const emailService = this.getEmailService();
    const cacheService = this.getCacheService();
    
    const userService = new UserService(userModel, emailService, cacheService);
    
    this.cache.set(cacheKey, userService);
    return userService;
  }

  getEmailService() {
    const cacheKey = 'EmailService';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const emailService = new EmailService(this.config.email);
    this.cache.set(cacheKey, emailService);
    return emailService;
  }

  getCacheService() {
    const cacheKey = 'CacheService';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const cacheService = new RedisCacheService(this.config.redis);
    this.cache.set(cacheKey, cacheService);
    return cacheService;
  }

  getAuthMiddleware() {
    const userService = this.getUserService();
    const jwtService = new JwtService(this.config.jwt);
    
    return new AuthMiddleware(jwtService, userService);
  }

  // Singleton pattern implementation
  static getInstance(databaseClient, config) {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(databaseClient, config);
    }
    return ServiceFactory.instance;
  }
}

// ## 7. Usage Example

// Application setup
class Application {
  constructor() {
    this.services = new Map();
    this.middlewares = new Map();
    this.controllers = new Map();
  }

  async initialize() {
    try {
      // Initialize factory
      const factory = ServiceFactory.getInstance(this.database, this.config);
      
      // Set up services
      this.services.set('userService', factory.getUserService());
      this.services.set('authMiddleware', factory.getAuthMiddleware());
      
      // Initialize all services
      for (const [name, service] of this.services) {
        if (service.initialize && typeof service.initialize === 'function') {
          await service.initialize();
        }
      }

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      process.exit(1);
    }
  }

  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }

  async shutdown() {
    console.log('Shutting down application...');
    
    // Cleanup logic for all services
    for (const [name, service] of this.services) {
      if (service.shutdown && typeof service.shutdown === 'function') {
        await service.shutdown();
      }
    }
    
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  app.shutdown();
});

process.on('SIGINT', () => {
  app.shutdown();
});

// These class examples demonstrate production-grade patterns including:
// - Proper encapsulation with private/protected methods
// - Dependency injection
// - Error handling and logging
// - Caching strategies
// - Middleware patterns
// - Factory and Singleton patterns
// - Async/await patterns
// - Input validation
// - Graceful shutdown handling
















































// Here are comprehensive code snippets for Getters and Setters in JavaScript Classes for Node.js backend development:

// ## 1. Basic Getters and Setters

class User {
  constructor(firstName, lastName, email) {
    this._firstName = firstName;
    this._lastName = lastName;
    this._email = email;
    this._createdAt = new Date();
    this._updatedAt = new Date();
    this._isActive = true;
  }

  // Basic getter
  get fullName() {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  // Basic setter with validation
  set email(newEmail) {
    if (!this._isValidEmail(newEmail)) {
      throw new Error('Invalid email format');
    }
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  get email() {
    return this._email;
  }

  // Read-only getter
  get createdAt() {
    return new Date(this._createdAt); // Return copy to prevent modification
  }

  get updatedAt() {
    return new Date(this._updatedAt);
  }

  // Computed getter
  get emailDomain() {
    return this._email.split('@')[1];
  }

  get initials() {
    return `${this._firstName.charAt(0)}${this._lastName.charAt(0)}`.toUpperCase();
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Usage
const user = new User('John', 'Doe', 'john@example.com');
console.log(user.fullName); // "John Doe"
console.log(user.emailDomain); // "example.com"
console.log(user.initials); // "JD"

user.email = 'john.doe@company.com'; // Updates and validates
// user.email = 'invalid-email'; // Throws Error

// ## 2. Database Configuration Class

class DatabaseConfig {
  constructor() {
    this._host = 'localhost';
    this._port = 5432;
    this._database = 'myapp';
    this._username = '';
    this._password = '';
    this._poolSize = 10;
    this._timeout = 30000;
    this._ssl = false;
  }

  get connectionString() {
    const auth = this._username ? `${this._username}:${this._password}@` : '';
    const ssl = this._ssl ? '?ssl=true' : '';
    return `postgresql://${auth}${this._host}:${this._port}/${this._database}${ssl}`;
  }

  set host(newHost) {
    if (!newHost || typeof newHost !== 'string') {
      throw new Error('Host must be a non-empty string');
    }
    this._host = newHost;
  }

  set port(newPort) {
    const port = parseInt(newPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Port must be a number between 1 and 65535');
    }
    this._port = port;
  }

  set poolSize(size) {
    const poolSize = parseInt(size);
    if (isNaN(poolSize) || poolSize < 1 || poolSize > 100) {
      throw new Error('Pool size must be between 1 and 100');
    }
    this._poolSize = poolSize;
  }

  get poolSize() {
    return this._poolSize;
  }

  set timeout(ms) {
    const timeout = parseInt(ms);
    if (isNaN(timeout) || timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }
    this._timeout = timeout;
  }

  get timeout() {
    return this._timeout;
  }

  // Secure getter for password (masked)
  get password() {
    return '***';
  }

  set password(newPassword) {
    if (typeof newPassword !== 'string') {
      throw new Error('Password must be a string');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    this._password = newPassword;
  }

  // Get configuration for external libraries
  get knexConfig() {
    return {
      client: 'pg',
      connection: {
        host: this._host,
        port: this._port,
        database: this._database,
        user: this._username,
        password: this._password,
        ssl: this._ssl
      },
      pool: {
        min: 2,
        max: this._poolSize,
        acquireTimeoutMillis: this._timeout
      }
    };
  }

  // Validation status
  get isValid() {
    return !!this._host && !!this._database && this._port > 0;
  }

  get missingFields() {
    const missing = [];
    if (!this._host) missing.push('host');
    if (!this._database) missing.push('database');
    if (!this._username) missing.push('username');
    return missing;
  }
}

// ## 3. Cached Data Access Class

const NodeCache = require('node-cache');

class CachedRepository {
  constructor(databaseModel, options = {}) {
    this._model = databaseModel;
    this._cache = new NodeCache({
      stdTTL: options.ttl || 300, // 5 minutes default
      checkperiod: options.checkperiod || 60
    });
    this._cacheHits = 0;
    this._cacheMisses = 0;
  }

  // Cache key generator
  _getCacheKey(method, identifier) {
    return `${this._model.constructor.name}:${method}:${identifier}`;
  }

  // Get with cache fallback
  async findById(id, options = {}) {
    const cacheKey = this._getCacheKey('findById', id);
    const skipCache = options.skipCache || false;

    if (!skipCache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        this._cacheHits++;
        return cached;
      }
    }

    this._cacheMisses++;
    const result = await this._model.findById(id);
    
    if (result && !skipCache) {
      this._cache.set(cacheKey, result);
    }

    return result;
  }

  async findByEmail(email, options = {}) {
    const cacheKey = this._getCacheKey('findByEmail', email);
    const skipCache = options.skipCache || false;

    if (!skipCache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        this._cacheHits++;
        return cached;
      }
    }

    this._cacheMisses++;
    const result = await this._model.findByEmail(email);
    
    if (result && !skipCache) {
      this._cache.set(cacheKey, result);
    }

    return result;
  }

  // Cache statistics
  get cacheStats() {
    const stats = this._cache.getStats();
    return {
      hits: this._cacheHits,
      misses: this._cacheMisses,
      hitRatio: this._cacheHits / (this._cacheHits + this._cacheMisses) || 0,
      keys: stats.keys,
      totalSize: this._getCacheSize()
    };
  }

  get cachePerformance() {
    const total = this._cacheHits + this._cacheMisses;
    return {
      hitRate: `${((this._cacheHits / total) * 100 || 0).toFixed(2)}%`,
      totalRequests: total,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  // Cache management
  get keys() {
    return this._cache.keys();
  }

  // Invalidate cache entries
  async invalidateForUser(userId) {
    const patterns = [
      this._getCacheKey('findById', userId),
      this._getCacheKey('findByEmail', '*')
    ];

    patterns.forEach(pattern => {
      const keys = this._cache.keys().filter(key => key.includes(pattern));
      keys.forEach(key => this._cache.del(key));
    });
  }

  clear() {
    this._cache.flushAll();
    this._cacheHits = 0;
    this._cacheMisses = 0;
  }

  _getCacheSize() {
    // Estimate cache size (simplified)
    const keys = this._cache.keys();
    let size = 0;
    keys.forEach(key => {
      const item = this._cache.get(key);
      if (item) {
        size += Buffer.from(JSON.stringify(item)).length;
      }
    });
    return size;
  }
}

// ## 4. API Rate Limiting Class

class RateLimiter {
  constructor(options = {}) {
    this._windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this._maxRequests = options.maxRequests || 100;
    this._skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this._stores = new Map(); // In production, use Redis
    this._blacklist = new Set();
    this._whitelist = new Set();
  }

  // Get client's request record
  _getClientRecord(clientId) {
    const now = Date.now();
    let record = this._stores.get(clientId);

    if (!record || now - record.windowStart > this._windowMs) {
      record = {
        count: 0,
        windowStart: now,
        lastRequest: now
      };
      this._stores.set(clientId, record);
    }

    return record;
  }

  // Check if request is allowed
  get isEnabled() {
    return this._maxRequests > 0;
  }

  async check(clientId, isSuccessful = true) {
    if (!this.isEnabled) {
      return { allowed: true, remaining: this._maxRequests };
    }

    if (this._whitelist.has(clientId)) {
      return { allowed: true, remaining: this._maxRequests };
    }

    if (this._blacklist.has(clientId)) {
      return { allowed: false, remaining: 0, reason: 'blacklisted' };
    }

    const record = this._getClientRecord(clientId);
    const now = Date.now();

    // Reset window if expired
    if (now - record.windowStart > this._windowMs) {
      record.count = 0;
      record.windowStart = now;
    }

    // Check if request should be counted
    const shouldCount = !this._skipSuccessfulRequests || !isSuccessful;

    if (shouldCount) {
      record.count++;
    }

    record.lastRequest = now;

    const remaining = Math.max(0, this._maxRequests - record.count);
    const allowed = record.count <= this._maxRequests;

    return {
      allowed,
      remaining,
      resetTime: record.windowStart + this._windowMs,
      current: record.count
    };
  }

  // Management getters and setters
  get blacklistSize() {
    return this._blacklist.size;
  }

  get whitelistSize() {
    return this._whitelist.size;
  }

  get activeClients() {
    const now = Date.now();
    let activeCount = 0;

    for (const [clientId, record] of this._stores) {
      if (now - record.lastRequest < this._windowMs) {
        activeCount++;
      }
    }

    return activeCount;
  }

  // Rate limit configuration setters
  set windowMs(ms) {
    const windowMs = parseInt(ms);
    if (isNaN(windowMs) || windowMs < 1000) {
      throw new Error('Window must be at least 1000ms');
    }
    this._windowMs = windowMs;
  }

  set maxRequests(max) {
    const maxRequests = parseInt(max);
    if (isNaN(maxRequests) || maxRequests < 0) {
      throw new Error('Max requests must be a non-negative number');
    }
    this._maxRequests = maxRequests;
  }

  // Client management
  addToBlacklist(clientId) {
    this._blacklist.add(clientId);
    this._stores.delete(clientId); // Clear any existing records
  }

  removeFromBlacklist(clientId) {
    this._blacklist.delete(clientId);
  }

  addToWhitelist(clientId) {
    this._whitelist.add(clientId);
    this._stores.delete(clientId); // Clear any existing records
  }

  removeFromWhitelist(clientId) {
    this._whitelist.delete(clientId);
  }

  // Statistics
  get statistics() {
    const now = Date.now();
    let totalRequests = 0;
    let blockedRequests = 0;

    for (const record of this._stores.values()) {
      if (now - record.windowStart <= this._windowMs) {
        totalRequests += record.count;
        if (record.count > this._maxRequests) {
          blockedRequests += (record.count - this._maxRequests);
        }
      }
    }

    return {
      totalClients: this._stores.size,
      activeClients: this.activeClients,
      totalRequests,
      blockedRequests,
      blacklistedClients: this.blacklistSize,
      whitelistedClients: this.whitelistSize,
      blockRate: totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0
    };
  }
}

// ## 5. Configuration Management Class

class ConfigManager {
  constructor() {
    this._config = new Map();
    this._defaults = new Map();
    this._validators = new Map();
    this._encryptedFields = new Set();
    this._changeListeners = new Map();
  }

  // Get value with fallback to default
  get(key) {
    if (this._config.has(key)) {
      return this._config.get(key);
    }
    
    if (this._defaults.has(key)) {
      return this._defaults.get(key);
    }
    
    return undefined;
  }

  // Set value with validation
  set(key, value) {
    const oldValue = this.get(key);
    
    // Validate if validator exists
    if (this._validators.has(key)) {
      const validator = this._validators.get(key);
      const validationResult = validator(value, oldValue);
      
      if (validationResult !== true) {
        throw new Error(`Validation failed for ${key}: ${validationResult}`);
      }
    }

    this._config.set(key, value);
    
    // Notify listeners
    this._notifyChangeListeners(key, value, oldValue);
  }

  // Bulk set with validation
  setMultiple(configObject) {
    const results = {
      successful: [],
      failed: []
    };

    for (const [key, value] of Object.entries(configObject)) {
      try {
        this.set(key, value);
        results.successful.push(key);
      } catch (error) {
        results.failed.push({
          key,
          error: error.message
        });
      }
    }

    return results;
  }

  // Default value management
  setDefault(key, value) {
    this._defaults.set(key, value);
  }

  get isUsingDefaults() {
    const usingDefaults = [];
    
    for (const [key] of this._defaults) {
      if (!this._config.has(key)) {
        usingDefaults.push(key);
      }
    }
    
    return usingDefaults;
  }

  // Validator management
  setValidator(key, validatorFn) {
    if (typeof validatorFn !== 'function') {
      throw new Error('Validator must be a function');
    }
    this._validators.set(key, validatorFn);
  }

  // Secure getter for sensitive data
  getSecure(key) {
    if (this._encryptedFields.has(key)) {
      return '***ENCRYPTED***';
    }
    return this.get(key);
  }

  markAsEncrypted(key) {
    this._encryptedFields.add(key);
  }

  // Change listeners
  onChange(key, listener) {
    if (!this._changeListeners.has(key)) {
      this._changeListeners.set(key, new Set());
    }
    this._changeListeners.get(key).add(listener);
  }

  removeChangeListener(key, listener) {
    if (this._changeListeners.has(key)) {
      this._changeListeners.get(key).delete(listener);
    }
  }

  _notifyChangeListeners(key, newValue, oldValue) {
    if (this._changeListeners.has(key)) {
      const listeners = this._changeListeners.get(key);
      for (const listener of listeners) {
        try {
          listener(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in config change listener for ${key}:`, error);
        }
      }
    }
  }

  // Configuration state getters
  get isLoaded() {
    return this._config.size > 0;
  }

  get loadedCount() {
    return this._config.size;
  }

  get defaultCount() {
    return this._defaults.size;
  }

  get allConfig() {
    const config = {};
    
    // Combine config and defaults
    for (const [key] of this._defaults) {
      config[key] = this.get(key);
    }
    
    for (const [key, value] of this._config) {
      if (!(key in config)) {
        config[key] = value;
      }
    }
    
    return config;
  }

  get safeConfig() {
    const config = this.allConfig;
    const safeConfig = {};
    
    for (const [key, value] of Object.entries(config)) {
      safeConfig[key] = this._encryptedFields.has(key) ? '***ENCRYPTED***' : value;
    }
    
    return safeConfig;
  }

  // Export/Import
  toJSON() {
    return this.allConfig;
  }

  fromJSON(configObject) {
    return this.setMultiple(configObject);
  }
}

// ## 6. Usage Example in Production

// Example usage in an Express application
class AppConfig {
  constructor() {
    this._configManager = new ConfigManager();
    this._setupDefaults();
    this._setupValidators();
    this._loadFromEnvironment();
  }

  _setupDefaults() {
    this._configManager.setDefault('PORT', 3000);
    this._configManager.setDefault('NODE_ENV', 'development');
    this._configManager.setDefault('LOG_LEVEL', 'info');
    this._configManager.setDefault('DB_POOL_SIZE', 10);
    this._configManager.setDefault('CACHE_TTL', 300);
  }

  _setupValidators() {
    this._configManager.setValidator('PORT', (value) => {
      const port = parseInt(value);
      return (port > 0 && port < 65536) || 'Port must be between 1 and 65535';
    });

    this._configManager.setValidator('DB_POOL_SIZE', (value) => {
      const size = parseInt(value);
      return (size > 0 && size <= 100) || 'Pool size must be between 1 and 100';
    });

    this._configManager.markAsEncrypted('DB_PASSWORD');
    this._configManager.markAsEncrypted('JWT_SECRET');
  }

  _loadFromEnvironment() {
    const envConfig = {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      LOG_LEVEL: process.env.LOG_LEVEL,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      JWT_SECRET: process.env.JWT_SECRET,
      DB_POOL_SIZE: process.env.DB_POOL_SIZE,
      CACHE_TTL: process.env.CACHE_TTL
    };

    // Remove undefined values
    Object.keys(envConfig).forEach(key => {
      if (envConfig[key] === undefined) {
        delete envConfig[key];
      }
    });

    this._configManager.setMultiple(envConfig);
  }

  // Public getters
  get port() {
    return this._configManager.get('PORT');
  }

  get environment() {
    return this._configManager.get('NODE_ENV');
  }

  get isProduction() {
    return this.environment === 'production';
  }

  get isDevelopment() {
    return this.environment === 'development';
  }

  get databaseConfig() {
    return {
      host: this._configManager.get('DB_HOST'),
      port: this._configManager.get('DB_PORT'),
      database: this._configManager.get('DB_NAME'),
      user: this._configManager.get('DB_USER'),
      password: this._configManager.get('DB_PASSWORD'),
      poolSize: this._configManager.get('DB_POOL_SIZE')
    };
  }

  get jwtConfig() {
    return {
      secret: this._configManager.get('JWT_SECRET'),
      expiresIn: this._configManager.get('JWT_EXPIRES_IN') || '7d'
    };
  }

  get cacheConfig() {
    return {
      ttl: this._configManager.get('CACHE_TTL')
    };
  }

  // Status getters
  get isConfigured() {
    const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
    return required.every(key => this._configManager.get(key));
  }

  get missingConfig() {
    const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
    return required.filter(key => !this._configManager.get(key));
  }

  get configStatus() {
    return {
      isConfigured: this.isConfigured,
      missingConfig: this.missingConfig,
      usingDefaults: this._configManager.isUsingDefaults,
      totalSettings: this._configManager.loadedCount,
      environment: this.environment
    };
  }

  // Listen for config changes
  onDatabaseConfigChange(listener) {
    ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].forEach(key => {
      this._configManager.onChange(key, listener);
    });
  }
}

// Usage in application
const appConfig = new AppConfig();

console.log('Port:', appConfig.port);
console.log('Database Host:', appConfig.databaseConfig.host);
console.log('Config Status:', appConfig.configStatus);

if (!appConfig.isConfigured) {
  console.error('Missing configuration:', appConfig.missingConfig);
  process.exit(1);
}

// These getters and setters provide:
// - **Data validation and sanitization**
// - **Computed properties**
// - **Access control and security**
// - **Caching mechanisms**
// - **Change tracking and notifications**
// - **Configuration management**
// - **Performance monitoring**
// - **Type safety and error handling**

// They're essential for building robust, maintainable Node.js backend applications.






























// Here are comprehensive code snippets for Class Expressions in JavaScript for Node.js backend development:

// ## 1. Basic Class Expressions

// Anonymous class expression
const Logger = class {
  constructor(name, level = 'info') {
    this.name = name;
    this.level = level;
    this.logs = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, logger: this.name };
    this.logs.push(logEntry);
    
    if (this.shouldLog(level)) {
      console.log(`[${level.toUpperCase()}] ${timestamp} ${this.name}: ${message}`);
    }
    
    return logEntry;
  }

  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.level];
  }

  get recentLogs() {
    return this.logs.slice(-10);
  }
};

// Named class expression
const DatabaseConnection = class DBConnection {
  constructor(config) {
    this.config = config;
    this.isConnected = false;
    this.connection = null;
    this.retryCount = 0;
  }

  async connect() {
    try {
      // Simulate database connection
      await this._simulateConnection();
      this.isConnected = true;
      this.retryCount = 0;
      console.log(`${DBConnection.name} connected successfully`);
    } catch (error) {
      this.retryCount++;
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async _simulateConnection() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.2) {
          resolve();
        } else {
          reject(new Error('Connection timeout'));
        }
      }, 100);
    });
  }
};

// ## 2. Factory Functions with Class Expressions

// Service factory with class expressions
const createServiceFactory = (serviceRegistry) => {
  return class ServiceFactory {
    constructor(serviceName, dependencies = {}) {
      this.serviceName = serviceName;
      this.dependencies = dependencies;
      this.instance = null;
    }

    create(config = {}) {
      const ServiceClass = serviceRegistry[this.serviceName];
      
      if (!ServiceClass) {
        throw new Error(`Service ${this.serviceName} not found in registry`);
      }

      this.instance = new ServiceClass({
        ...config,
        ...this.dependencies
      });

      return this.instance;
    }

    getSingleton(config = {}) {
      if (!this.instance) {
        this.instance = this.create(config);
      }
      return this.instance;
    }

    async createAsync(config = {}) {
      const instance = this.create(config);
      
      if (typeof instance.initialize === 'function') {
        await instance.initialize();
      }
      
      return instance;
    }
  };
};

// Usage
const serviceRegistry = {
  userService: class UserService {
    constructor({ database, cache }) {
      this.database = database;
      this.cache = cache;
    }

    async getUser(id) {
      // Implementation
      return { id, name: 'User' };
    }
  },

  authService: class AuthService {
    constructor({ jwtSecret, userService }) {
      this.jwtSecret = jwtSecret;
      this.userService = userService;
    }

    async validateToken(token) {
      // Implementation
      return { valid: true };
    }
  }
};

const ServiceFactory = createServiceFactory(serviceRegistry);
const userServiceFactory = new ServiceFactory('userService', { database: {}, cache: {} });
const userService = userServiceFactory.create();

// ## 3. Dynamic Class Creation

// Dynamic model class generator
const createModelClass = (modelName, schema, options = {}) => {
  const { softDelete = false, timestamps = true, validation = true } = options;

  return class {
    constructor(data = {}) {
      this._data = {};
      this._originalData = { ...data };
      this._changes = new Set();
      this._isNew = true;
      this._isDeleted = false;

      // Apply schema defaults and set data
      for (const [field, fieldConfig] of Object.entries(schema)) {
        if (data[field] !== undefined) {
          this._setField(field, data[field], fieldConfig);
        } else if (fieldConfig.default !== undefined) {
          this._setField(field, fieldConfig.default, fieldConfig);
        }
      }

      // Add timestamps
      if (timestamps) {
        this._data.createdAt = new Date();
        this._data.updatedAt = new Date();
      }
    }

    _setField(field, value, config) {
      if (validation && config.validate && !config.validate(value)) {
        throw new Error(`Validation failed for field ${field}`);
      }

      if (config.type && typeof value !== config.type) {
        throw new Error(`Field ${field} must be of type ${config.type}`);
      }

      this._data[field] = value;
      this._changes.add(field);
    }

    // Dynamic getters for all schema fields
    get id() {
      return this._data.id;
    }

    // Dynamic setter generation
    _createSetters() {
      for (const [field, config] of Object.entries(schema)) {
        Object.defineProperty(this, field, {
          get: () => this._data[field],
          set: (value) => this._setField(field, value, config),
          enumerable: true,
          configurable: true
        });
      }
    }

    get changes() {
      return Array.from(this._changes).reduce((acc, field) => {
        acc[field] = this._data[field];
        return acc;
      }, {});
    }

    get isDirty() {
      return this._changes.size > 0;
    }

    toJSON() {
      return { ...this._data, modelName };
    }

    static get modelName() {
      return modelName;
    }

    static get schema() {
      return schema;
    }
  };
};

// Usage
const UserModel = createModelClass('User', {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true, validate: (val) => val.length > 0 },
  email: { type: 'string', required: true },
  age: { type: 'number', default: 0 }
});

const user = new UserModel({ name: 'John', email: 'john@example.com' });
console.log(user.name); // 'John'
console.log(user.changes); // { name: 'John', email: 'john@example.com', age: 0 }

// ## 4. Middleware Chain with Class Expressions

const createMiddlewarePipeline = (middlewares = []) => {
  return class MiddlewarePipeline {
    constructor(context = {}) {
      this.middlewares = [...middlewares];
      this.context = context;
      this.currentIndex = 0;
      this.isExecuting = false;
    }

    use(middleware) {
      if (typeof middleware !== 'function') {
        throw new Error('Middleware must be a function');
      }
      this.middlewares.push(middleware);
      return this;
    }

    async execute(input) {
      if (this.isExecuting) {
        throw new Error('Pipeline is already executing');
      }

      this.isExecuting = true;
      this.currentIndex = 0;
      
      try {
        const result = await this._next(input);
        this.isExecuting = false;
        return result;
      } catch (error) {
        this.isExecuting = false;
        throw error;
      }
    }

    async _next(input) {
      if (this.currentIndex >= this.middlewares.length) {
        return input;
      }

      const currentMiddleware = this.middlewares[this.currentIndex];
      this.currentIndex++;

      if (typeof currentMiddleware !== 'function') {
        throw new Error(`Middleware at index ${this.currentIndex - 1} is not a function`);
      }

      const next = (newInput) => this._next(newInput !== undefined ? newInput : input);

      return await currentMiddleware.call(this.context, input, next, this.context);
    }

    clone() {
      const newPipeline = new MiddlewarePipeline(this.context);
      newPipeline.middlewares = [...this.middlewares];
      return newPipeline;
    }

    get length() {
      return this.middlewares.length;
    }

    get stats() {
      return {
        totalMiddlewares: this.middlewares.length,
        isExecuting: this.isExecuting,
        contextKeys: Object.keys(this.context)
      };
    }
  };
};

// Usage
const Pipeline = createMiddlewarePipeline();

const authMiddleware = async (req, next) => {
  console.log('Auth middleware');
  req.user = { id: 1, name: 'John' };
  return next(req);
};

const validationMiddleware = async (req, next) => {
  console.log('Validation middleware');
  if (!req.body) {
    throw new Error('Request body is required');
  }
  return next(req);
};

const loggingMiddleware = async (req, next) => {
  console.log('Logging middleware - start');
  const result = await next(req);
  console.log('Logging middleware - end');
  return result;
};

const pipeline = new Pipeline({ appName: 'MyApp' });
pipeline.use(authMiddleware);
pipeline.use(validationMiddleware);
pipeline.use(loggingMiddleware);

// Execute pipeline
const result = await pipeline.execute({ body: { data: 'test' } });

// ## 5. Plugin System with Class Expressions

const createPluginSystem = (baseClass) => {
  return class PluginSystem extends baseClass {
    constructor(...args) {
      super(...args);
      this._plugins = new Map();
      this._pluginHooks = new Map();
      this._initializedPlugins = new Set();
    }

    registerPlugin(name, pluginClass, options = {}) {
      if (this._plugins.has(name)) {
        throw new Error(`Plugin ${name} is already registered`);
      }

      const pluginInstance = new pluginClass({
        system: this,
        options,
        ...this._getPluginContext()
      });

      this._plugins.set(name, {
        instance: pluginInstance,
        options,
        hooks: new Set()
      });

      this._setupPluginHooks(name, pluginInstance);
    }

    _setupPluginHooks(name, pluginInstance) {
      const hookMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(pluginInstance)
      ).filter(method => 
        method.startsWith('on') && 
        typeof pluginInstance[method] === 'function'
      );

      for (const hook of hookMethods) {
        if (!this._pluginHooks.has(hook)) {
          this._pluginHooks.set(hook, new Set());
        }
        
        this._pluginHooks.get(hook).add(name);
        this._plugins.get(name).hooks.add(hook);
      }
    }

    async initializePlugins() {
      for (const [name, plugin] of this._plugins) {
        if (typeof plugin.instance.initialize === 'function') {
          try {
            await plugin.instance.initialize();
            this._initializedPlugins.add(name);
            console.log(`Plugin ${name} initialized successfully`);
          } catch (error) {
            console.error(`Failed to initialize plugin ${name}:`, error);
          }
        }
      }
    }

    async emitHook(hookName, ...args) {
      if (!this._pluginHooks.has(hookName)) {
        return;
      }

      const results = [];
      
      for (const pluginName of this._pluginHooks.get(hookName)) {
        const plugin = this._plugins.get(pluginName);
        
        if (plugin && typeof plugin.instance[hookName] === 'function') {
          try {
            const result = await plugin.instance[hookName](...args);
            results.push({
              plugin: pluginName,
              success: true,
              result
            });
          } catch (error) {
            results.push({
              plugin: pluginName,
              success: false,
              error: error.message
            });
          }
        }
      }

      return results;
    }

    getPlugin(name) {
      const plugin = this._plugins.get(name);
      return plugin ? plugin.instance : null;
    }

    get plugins() {
      return Array.from(this._plugins.keys());
    }

    get initializedPlugins() {
      return Array.from(this._initializedPlugins);
    }

    get hooks() {
      return Array.from(this._pluginHooks.keys());
    }

    _getPluginContext() {
      return {
        config: this.config || {},
        logger: this.logger || console,
        emitHook: this.emitHook.bind(this)
      };
    }
  };
};

// Usage example
class BaseApplication {
  constructor(config) {
    this.config = config;
    this.logger = console;
  }
}

const Application = createPluginSystem(BaseApplication);

// Define plugins
class LoggingPlugin {
  constructor({ system, options }) {
    this.system = system;
    this.options = options;
  }

  async initialize() {
    console.log('LoggingPlugin initialized');
  }

  async onRequestStart(req) {
    console.log(`Request started: ${req.url}`);
  }

  async onRequestEnd(req, res) {
    console.log(`Request ended: ${req.url} - Status: ${res.status}`);
  }
}

class MetricsPlugin {
  constructor({ system }) {
    this.system = system;
    this.metrics = new Map();
  }

  async initialize() {
    console.log('MetricsPlugin initialized');
  }

  async onRequestStart(req) {
    const key = `request.${req.method}.${req.url}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
}

// Use the plugin system
const app = new Application({ env: 'production' });
app.registerPlugin('logging', LoggingPlugin, { level: 'debug' });
app.registerPlugin('metrics', MetricsPlugin);

await app.initializePlugins();
await app.emitHook('onRequestStart', { method: 'GET', url: '/api/users' });

// ## 6. Strategy Pattern with Class Expressions

const createStrategyRegistry = (defaultStrategy = null) => {
  return class StrategyRegistry {
    constructor() {
      this._strategies = new Map();
      this._defaultStrategy = defaultStrategy;
      this._currentStrategy = defaultStrategy;
    }

    register(name, strategyClass, options = {}) {
      if (this._strategies.has(name)) {
        throw new Error(`Strategy ${name} is already registered`);
      }

      const strategyInstance = new strategyClass(options);
      this._strategies.set(name, {
        instance: strategyInstance,
        options,
        isActive: false
      });

      return this;
    }

    use(name) {
      if (!this._strategies.has(name)) {
        throw new Error(`Strategy ${name} is not registered`);
      }

      // Deactivate current strategy
      if (this._currentStrategy && this._strategies.has(this._currentStrategy)) {
        this._strategies.get(this._currentStrategy).isActive = false;
      }

      this._currentStrategy = name;
      this._strategies.get(name).isActive = true;

      return this;
    }

    async execute(method, ...args) {
      if (!this._currentStrategy) {
        throw new Error('No strategy selected');
      }

      const strategy = this._strategies.get(this._currentStrategy);
      
      if (typeof strategy.instance[method] !== 'function') {
        throw new Error(`Method ${method} not found in strategy ${this._currentStrategy}`);
      }

      return await strategy.instance[method](...args);
    }

    getStrategy(name) {
      return this._strategies.get(name)?.instance || null;
    }

    get currentStrategy() {
      return this._currentStrategy;
    }

    get availableStrategies() {
      return Array.from(this._strategies.keys());
    }

    get strategyInfo() {
      return Array.from(this._strategies.entries()).map(([name, data]) => ({
        name,
        isActive: data.isActive,
        options: data.options
      }));
    }
  };
};

// Usage - Payment processing strategies
const PaymentStrategyRegistry = createStrategyRegistry();

// Define payment strategies
class StripePaymentStrategy {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
  }

  async processPayment(amount, paymentData) {
    console.log(`Processing $${amount} payment via Stripe`);
    // Simulate API call
    return {
      success: true,
      transactionId: `stripe_${Date.now()}`,
      amount,
      gateway: 'stripe'
    };
  }

  async refundPayment(transactionId) {
    console.log(`Refunding payment ${transactionId} via Stripe`);
    return { success: true, refundId: `refund_${transactionId}` };
  }
}

class PayPalPaymentStrategy {
  constructor({ clientId, secret }) {
    this.clientId = clientId;
    this.secret = secret;
  }

  async processPayment(amount, paymentData) {
    console.log(`Processing $${amount} payment via PayPal`);
    return {
      success: true,
      transactionId: `paypal_${Date.now()}`,
      amount,
      gateway: 'paypal'
    };
  }

  async refundPayment(transactionId) {
    console.log(`Refunding payment ${transactionId} via PayPal`);
    return { success: true, refundId: `refund_${transactionId}` };
  }
}

// Use the strategy registry
const paymentRegistry = new PaymentStrategyRegistry();

paymentRegistry
  .register('stripe', StripePaymentStrategy, { apiKey: 'sk_test_123' })
  .register('paypal', PayPalPaymentStrategy, { clientId: 'client_123', secret: 'secret_123' });

// Use different strategies
paymentRegistry.use('stripe');
const stripeResult = await paymentRegistry.execute('processPayment', 100, { card: '4242...' });

paymentRegistry.use('paypal');
const paypalResult = await paymentRegistry.execute('processPayment', 150, { email: 'user@example.com' });

console.log(paymentRegistry.strategyInfo);

// ## 7. Database Repository Factory

const createRepository = (modelName, schema, database) => {
  return class Repository {
    constructor() {
      this.modelName = modelName;
      this.schema = schema;
      this.database = database;
      this.tableName = modelName.toLowerCase() + 's';
    }

    async findById(id, options = {}) {
      const query = this.database(this.tableName).where('id', id);
      
      if (options.includeDeleted) {
        return await query.first();
      }
      
      return await query.where('deleted_at', null).first();
    }

    async create(data) {
      const validatedData = this._validateData(data);
      const [record] = await this.database(this.tableName)
        .insert(validatedData)
        .returning('*');
      
      return record;
    }

    async update(id, data) {
      const validatedData = this._validateData(data, true);
      validatedData.updated_at = new Date();
      
      const [record] = await this.database(this.tableName)
        .where('id', id)
        .update(validatedData)
        .returning('*');
      
      return record;
    }

    async delete(id, hardDelete = false) {
      if (hardDelete) {
        const [record] = await this.database(this.tableName)
          .where('id', id)
          .delete()
          .returning('*');
        return record;
      }

      return await this.update(id, { deleted_at: new Date() });
    }

    _validateData(data, isPartial = false) {
      const errors = [];
      const validated = {};

      for (const [field, config] of Object.entries(schema)) {
        if (data[field] === undefined) {
          if (config.required && !isPartial) {
            errors.push(`${field} is required`);
          }
          continue;
        }

        // Type validation
        if (config.type && typeof data[field] !== config.type) {
          errors.push(`${field} must be of type ${config.type}`);
          continue;
        }

        // Custom validation
        if (config.validate && !config.validate(data[field])) {
          errors.push(`${field} failed validation`);
          continue;
        }

        validated[field] = data[field];
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      return validated;
    }

    static get repositoryName() {
      return `${modelName}Repository`;
    }

    get tableInfo() {
      return {
        tableName: this.tableName,
        fields: Object.keys(schema),
        requiredFields: Object.entries(schema)
          .filter(([_, config]) => config.required)
          .map(([field]) => field)
      };
    }
  };
};

// Usage
const userSchema = {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  email: { 
    type: 'string', 
    required: true,
    validate: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },
  age: { type: 'number', required: false }
};

const UserRepository = createRepository('User', userSchema, knexInstance);
const userRepo = new UserRepository();

const user = await userRepo.create({
  id: 'user_123',
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// These class expression patterns provide:
// - **Dynamic class creation** at runtime
// - **Factory patterns** for flexible object creation
// - **Plugin systems** for extensible architectures
// - **Strategy patterns** for interchangeable algorithms
// - **Middleware pipelines** for request processing
// - **Repository patterns** for data access
// - **Enhanced modularity and reusability**

// They're essential for building scalable, maintainable Node.js backend systems with flexible architecture.


































// Here are comprehensive code snippets for Computed Properties in JavaScript Classes for Node.js backend development:

// ## 1. Basic Computed Properties

class User {
  constructor(firstName, lastName, email, metadata = {}) {
    this._firstName = firstName;
    this._lastName = lastName;
    this._email = email;
    this._metadata = metadata;
    this._createdAt = new Date();
    this._roles = new Set(['user']);
    this._permissions = new Set();
  }

  // Basic computed properties
  get fullName() {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  get emailDomain() {
    return this._email.split('@')[1] || '';
  }

  get initials() {
    return `${this._firstName.charAt(0)}${this._lastName.charAt(0)}`.toUpperCase();
  }

  get profileUrl() {
    const slug = this.fullName.toLowerCase().replace(/\s+/g, '-');
    return `/users/${slug}-${this._email.split('@')[0]}`;
  }

  // Status-based computed properties
  get isActive() {
    return this._metadata.status === 'active' && !this._metadata.deactivatedAt;
  }

  get isVerified() {
    return !!this._metadata.emailVerified && !!this._metadata.verifiedAt;
  }

  get accountAge() {
    return Date.now() - this._createdAt.getTime();
  }

  get accountAgeInDays() {
    return Math.floor(this.accountAge / (1000 * 60 * 60 * 24));
  }

  // Role and permission computed properties
  get isAdmin() {
    return this._roles.has('admin');
  }

  get isModerator() {
    return this._roles.has('moderator');
  }

  get permissionsList() {
    return Array.from(this._permissions);
  }

  get effectivePermissions() {
    const rolePermissions = {
      admin: ['read', 'write', 'delete', 'manage_users'],
      moderator: ['read', 'write', 'moderate'],
      user: ['read', 'write_own']
    };

    const permissions = new Set();
    
    this._roles.forEach(role => {
      (rolePermissions[role] || []).forEach(perm => permissions.add(perm));
    });
    
    this._permissions.forEach(perm => permissions.add(perm));
    
    return Array.from(permissions);
  }

  // Validation computed properties
  get isValid() {
    return this._validateEmail() && this._validateName();
  }

  get validationErrors() {
    const errors = [];
    
    if (!this._validateEmail()) errors.push('Invalid email format');
    if (!this._validateName()) errors.push('First and last name are required');
    if (this._firstName.length < 2) errors.push('First name too short');
    if (this._lastName.length < 2) errors.push('Last name too short');
    
    return errors;
  }

  _validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this._email);
  }

  _validateName() {
    return this._firstName && this._lastName && 
           this._firstName.length > 0 && this._lastName.length > 0;
  }
}

// Usage
const user = new User('John', 'Doe', 'john.doe@company.com');
console.log(user.fullName); // "John Doe"
console.log(user.emailDomain); // "company.com"
console.log(user.initials); // "JD"
console.log(user.isValid); // true
console.log(user.effectivePermissions); // ["read", "write_own"]

// ## 2. Database Model with Computed Properties

class DatabaseModel {
  constructor(tableName, schema, data = {}) {
    this._tableName = tableName;
    this._schema = schema;
    this._data = this._initializeData(data);
    this._originalData = { ...this._data };
    this._changes = new Set();
    this._relationships = new Map();
  }

  // Computed properties for schema metadata
  get tableName() {
    return this._tableName;
  }

  get primaryKey() {
    return this._schema.primaryKey || 'id';
  }

  get fields() {
    return Object.keys(this._schema.fields);
  }

  get requiredFields() {
    return Object.entries(this._schema.fields)
      .filter(([_, config]) => config.required)
      .map(([field]) => field);
  }

  get nullableFields() {
    return Object.entries(this._schema.fields)
      .filter(([_, config]) => config.nullable)
      .map(([field]) => field);
  }

  // Data state computed properties
  get isNew() {
    return !this._data[this.primaryKey];
  }

  get isDirty() {
    return this._changes.size > 0;
  }

  get changedFields() {
    return Array.from(this._changes);
  }

  get changes() {
    const changes = {};
    this._changes.forEach(field => {
      changes[field] = {
        old: this._originalData[field],
        new: this._data[field]
      };
    });
    return changes;
  }

  get snapshot() {
    return {
      current: { ...this._data },
      original: { ...this._originalData },
      changes: this.changes,
      isNew: this.isNew,
      isDirty: this.isDirty
    };
  }

  // Validation computed properties
  get isValid() {
    return this.validationErrors.length === 0;
  }

  get validationErrors() {
    const errors = [];
    
    // Required field validation
    this.requiredFields.forEach(field => {
      if (this._data[field] === undefined || this._data[field] === null || this._data[field] === '') {
        errors.push(`${field} is required`);
      }
    });

    // Type validation
    Object.entries(this._schema.fields).forEach(([field, config]) => {
      const value = this._data[field];
      if (value !== undefined && value !== null) {
        if (config.type && typeof value !== config.type) {
          errors.push(`${field} must be of type ${config.type}`);
        }
        
        if (config.validate && !config.validate(value)) {
          errors.push(`${field} failed custom validation`);
        }
        
        if (config.maxLength && value.length > config.maxLength) {
          errors.push(`${field} exceeds maximum length of ${config.maxLength}`);
        }
      }
    });

    return errors;
  }

  // Relationship computed properties
  get hasRelationships() {
    return this._relationships.size > 0;
  }

  get relationshipNames() {
    return Array.from(this._relationships.keys());
  }

  // SQL and query computed properties
  get insertSQL() {
    const fields = Object.keys(this._data).filter(f => this._data[f] !== undefined);
    const values = fields.map(f => this._data[f]);
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    
    return {
      sql: `INSERT INTO ${this._tableName} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    };
  }

  get updateSQL() {
    const changedFields = Array.from(this._changes).filter(f => f !== this.primaryKey);
    const setClause = changedFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = changedFields.map(f => this._data[f]);
    
    return {
      sql: `UPDATE ${this._tableName} SET ${setClause} WHERE ${this.primaryKey} = $${values.length + 1}`,
      values: [...values, this._data[this.primaryKey]]
    };
  }

  _initializeData(data) {
    const initialized = {};
    
    Object.entries(this._schema.fields).forEach(([field, config]) => {
      if (data[field] !== undefined) {
        initialized[field] = data[field];
      } else if (config.default !== undefined) {
        initialized[field] = typeof config.default === 'function' 
          ? config.default() 
          : config.default;
      }
    });
    
    return initialized;
  }
}

// Usage
const userSchema = {
  primaryKey: 'id',
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true, maxLength: 100 },
    email: { 
      type: 'string', 
      required: true,
      validate: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    },
    age: { type: 'number', nullable: true },
    created_at: { type: 'object', default: () => new Date() },
    updated_at: { type: 'object', default: () => new Date() }
  }
};

const user = new DatabaseModel('users', userSchema, {
  id: 'user_123',
  name: 'Jane Smith',
  email: 'jane@example.com',
  age: 28
});

console.log(user.requiredFields); // ['id', 'name', 'email']
console.log(user.isValid); // true
console.log(user.insertSQL); // SQL for insertion

// ## 3. API Response Builder with Computed Properties

class APIResponse {
  constructor(data = null, options = {}) {
    this._data = data;
    this._meta = options.meta || {};
    this._links = options.links || {};
    this._errors = options.errors || [];
    this._statusCode = options.statusCode || 200;
    this._timestamp = new Date();
    this._requestId = options.requestId || null;
  }

  // Status computed properties
  get isSuccess() {
    return this._statusCode >= 200 && this._statusCode < 300;
  }

  get isError() {
    return this._statusCode >= 400;
  }

  get isServerError() {
    return this._statusCode >= 500;
  }

  get isClientError() {
    return this._statusCode >= 400 && this._statusCode < 500;
  }

  // Data computed properties
  get hasData() {
    return this._data !== null && this._data !== undefined;
  }

  get isEmpty() {
    if (Array.isArray(this._data)) {
      return this._data.length === 0;
    }
    if (typeof this._data === 'object' && this._data !== null) {
      return Object.keys(this._data).length === 0;
    }
    return !this.hasData;
  }

  get dataType() {
    if (this._data === null) return 'null';
    if (Array.isArray(this._data)) return 'array';
    return typeof this._data;
  }

  // Pagination computed properties
  get isPaginated() {
    return this._meta.page !== undefined && this._meta.total !== undefined;
  }

  get paginationInfo() {
    if (!this.isPaginated) return null;
    
    const { page = 1, total = 0, limit = 10 } = this._meta;
    const totalPages = Math.ceil(total / limit);
    
    return {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    };
  }

  // Response format computed properties
  get responseFormat() {
    const base = {
      success: this.isSuccess,
      timestamp: this._timestamp.toISOString(),
      ...(this._requestId && { requestId: this._requestId })
    };

    if (this.isError) {
      return {
        ...base,
        error: {
          code: this._meta.errorCode || 'INTERNAL_ERROR',
          message: this._errors[0] || 'An error occurred',
          details: this._errors.length > 1 ? this._errors.slice(1) : undefined,
          ...(this._meta.errorDetails && { meta: this._meta.errorDetails })
        }
      };
    }

    return {
      ...base,
      data: this._data,
      ...(Object.keys(this._meta).length > 0 && { meta: this._meta }),
      ...(Object.keys(this._links).length > 0 && { links: this._links }),
      ...(this.isPaginated && { pagination: this.paginationInfo })
    };
  }

  get httpHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Response-Timestamp': this._timestamp.toISOString(),
      ...(this._requestId && { 'X-Request-ID': this._requestId })
    };

    if (this.isPaginated) {
      headers['X-Pagination-Page'] = this.paginationInfo.currentPage;
      headers['X-Pagination-Total-Pages'] = this.paginationInfo.totalPages;
      headers['X-Pagination-Total-Items'] = this.paginationInfo.totalItems;
    }

    return headers;
  }

  // Performance computed properties
  get responseSize() {
    const jsonString = JSON.stringify(this.responseFormat);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  get isLargeResponse() {
    return this.responseSize > 1024 * 1024; // 1MB
  }

  // Cache computed properties
  get cacheKey() {
    const components = [
      'api',
      this._requestId,
      this._statusCode,
      JSON.stringify(this._data).substring(0, 100)
    ].filter(Boolean);
    
    return components.join(':');
  }

  get cacheTTL() {
    if (this.isError) return 60; // 1 minute for errors
    if (this.isPaginated) return 300; // 5 minutes for paginated data
    return 3600; // 1 hour for regular data
  }

  // Validation computed properties
  get isValidResponse() {
    if (this.isError) {
      return this._errors.length > 0 && this._meta.errorCode;
    }
    
    if (this.isPaginated) {
      return this.paginationInfo !== null && 
             this.paginationInfo.totalItems >= 0 &&
             this.paginationInfo.currentPage > 0;
    }
    
    return true;
  }
}

// Usage
const successResponse = new APIResponse(
  { users: [{ id: 1, name: 'John' }] },
  { 
    meta: { page: 1, total: 100, limit: 10 },
    requestId: 'req_123'
  }
);

console.log(successResponse.isPaginated); // true
console.log(successResponse.paginationInfo); // { currentPage: 1, totalPages: 10, ... }
console.log(successResponse.responseSize); // Response size in bytes

const errorResponse = new APIResponse(
  null,
  {
    statusCode: 400,
    errors: ['Invalid input', 'Email is required'],
    meta: { errorCode: 'VALIDATION_ERROR' },
    requestId: 'req_456'
  }
);

console.log(errorResponse.isError); // true
console.log(errorResponse.responseFormat); // Formatted error response

// ## 4. Caching Layer with Computed Properties

class CacheManager {
  constructor(options = {}) {
    this._store = new Map();
    this._hits = 0;
    this._misses = 0;
    this._defaultTTL = options.defaultTTL || 300; // 5 minutes
    this._maxSize = options.maxSize || 1000; // Maximum items
    this._cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this._lastCleanup = Date.now();
  }

  // Performance computed properties
  get hitRate() {
    const total = this._hits + this._misses;
    return total > 0 ? (this._hits / total) * 100 : 0;
  }

  get performance() {
    return {
      hits: this._hits,
      misses: this._misses,
      hitRate: `${this.hitRate.toFixed(2)}%`,
      totalRequests: this._hits + this._misses,
      size: this.currentSize,
      maxSize: this._maxSize,
      utilization: `${((this.currentSize / this._maxSize) * 100).toFixed(2)}%`
    };
  }

  // Memory computed properties
  get currentSize() {
    return this._store.size;
  }

  get isFull() {
    return this.currentSize >= this._maxSize;
  }

  get memoryUsage() {
    let totalSize = 0;
    
    for (const [key, entry] of this._store) {
      totalSize += this._estimateEntrySize(key, entry);
    }
    
    return {
      entries: this.currentSize,
      estimatedSize: `${(totalSize / 1024).toFixed(2)} KB`,
      maxEntries: this._maxSize
    };
  }

  // Expiration computed properties
  get expiredEntries() {
    const now = Date.now();
    const expired = [];
    
    for (const [key, entry] of this._store) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expired.push(key);
      }
    }
    
    return expired;
  }

  get expirationStats() {
    const now = Date.now();
    let expiredCount = 0;
    let expiringSoon = 0;
    
    for (const entry of this._store.values()) {
      if (entry.expiresAt) {
        if (entry.expiresAt < now) {
          expiredCount++;
        } else if (entry.expiresAt < now + 60000) { // Expiring in 1 minute
          expiringSoon++;
        }
      }
    }
    
    return {
      expired: expiredCount,
      expiringSoon,
      totalWithTTL: expiredCount + expiringSoon
    };
  }

  // Key analysis computed properties
  get keyPatterns() {
    const patterns = new Map();
    
    for (const key of this._store.keys()) {
      const pattern = key.split(':')[0]; // First segment as pattern
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }
    
    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 patterns
  }

  get mostUsedKeys() {
    return Array.from(this._store.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([key, entry]) => ({ key, accesses: entry.accessCount }));
  }

  // Cache health computed properties
  get health() {
    const perf = this.performance;
    const memory = this.memoryUsage;
    const expiration = this.expirationStats;
    
    let status = 'healthy';
    let score = 100;
    
    if (perf.hitRate < 50) score -= 30;
    if (memory.utilization > 90) score -= 30;
    if (expiration.expired > this.currentSize * 0.1) score -= 20;
    
    if (score < 70) status = 'degraded';
    if (score < 50) status = 'unhealthy';
    
    return {
      status,
      score,
      details: {
        performance: perf.hitRate >= 70 ? 'good' : 'poor',
        memory: memory.utilization < 80 ? 'good' : 'high',
        cleanup: expiration.expired === 0 ? 'good' : 'needed'
      }
    };
  }

  // Cache operations with computed TTL
  set(key, value, ttl = this._defaultTTL) {
    if (this.isFull && !this._store.has(key)) {
      this._evictLeastUsed();
    }
    
    this._store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + (ttl * 1000) : null,
      accessCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });
  }

  get(key) {
    const entry = this._store.get(key);
    
    if (!entry) {
      this._misses++;
      return null;
    }
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this._store.delete(key);
      this._misses++;
      return null;
    }
    
    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this._hits++;
    
    return entry.value;
  }

  get entryStats() {
    const stats = [];
    
    for (const [key, entry] of this._store) {
      stats.push({
        key,
        age: Date.now() - entry.createdAt,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        expiresIn: entry.expiresAt ? entry.expiresAt - Date.now() : null
      });
    }
    
    return stats.sort((a, b) => b.accessCount - a.accessCount);
  }

  _estimateEntrySize(key, entry) {
    // Rough estimation of entry size
    let size = Buffer.byteLength(key, 'utf8');
    size += Buffer.byteLength(JSON.stringify(entry.value), 'utf8');
    size += 32; // Overhead for object properties
    return size;
  }

  _evictLeastUsed() {
    let leastUsedKey = null;
    let minAccessCount = Infinity;
    
    for (const [key, entry] of this._store) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        leastUsedKey = key;
      }
    }
    
    if (leastUsedKey) {
      this._store.delete(leastUsedKey);
    }
  }
}

// Usage
const cache = new CacheManager({ maxSize: 100, defaultTTL: 60 });

// Populate cache
cache.set('user:1', { id: 1, name: 'John' }, 300);
cache.set('user:2', { id: 2, name: 'Jane' }, 300);

// Access cache
console.log(cache.get('user:1')); // { id: 1, name: 'John' }

// Monitor cache
console.log(cache.performance);
console.log(cache.health);
console.log(cache.memoryUsage);
console.log(cache.mostUsedKeys);

// ## 5. Configuration Manager with Computed Properties

class ConfigManager {
  constructor(environment = 'development') {
    this._environment = environment;
    this._config = new Map();
    this._defaults = new Map();
    this._validators = new Map();
    this._encryptedFields = new Set();
    this._changeListeners = new Map();
    this._loadedAt = new Date();
  }

  // Environment computed properties
  get isProduction() {
    return this._environment === 'production';
  }

  get isDevelopment() {
    return this._environment === 'development';
  }

  get isTesting() {
    return this._environment === 'test';
  }

  get environmentPrefix() {
    return this._environment.toUpperCase();
  }

  // Configuration state computed properties
  get isLoaded() {
    return this._config.size > 0;
  }

  get loadedCount() {
    return this._config.size;
  }

  get defaultCount() {
    return this._defaults.size;
  }

  get totalSettings() {
    return new Set([...this._config.keys(), ...this._defaults.keys()]).size;
  }

  // Validation computed properties
  get isValid() {
    return this.validationErrors.length === 0;
  }

  get validationErrors() {
    const errors = [];
    
    // Check required settings
    for (const [key, validator] of this._validators) {
      if (validator.required && !this.get(key)) {
        errors.push(`Required configuration missing: ${key}`);
      }
    }
    
    // Validate current values
    for (const [key, value] of this._config) {
      const validator = this._validators.get(key);
      if (validator && validator.validate && !validator.validate(value)) {
        errors.push(`Validation failed for ${key}: ${value}`);
      }
    }
    
    return errors;
  }

  // Security computed properties
  get hasSensitiveData() {
    return this._encryptedFields.size > 0;
  }

  get sensitiveFields() {
    return Array.from(this._encryptedFields);
  }

  // Performance computed properties
  get age() {
    return Date.now() - this._loadedAt.getTime();
  }

  get ageInMinutes() {
    return Math.floor(this.age / (1000 * 60));
  }

  get needsRefresh() {
    return this.age > (1000 * 60 * 60); // 1 hour
  }

  // Configuration groups computed properties
  get databaseConfig() {
    return this._getConfigGroup('database');
  }

  get cacheConfig() {
    return this._getConfigGroup('cache');
  }

  get apiConfig() {
    return this._getConfigGroup('api');
  }

  get securityConfig() {
    return this._getConfigGroup('security');
  }

  get allConfig() {
    const config = {};
    
    // Combine all keys from config and defaults
    const allKeys = new Set([...this._config.keys(), ...this._defaults.keys()]);
    
    for (const key of allKeys) {
      config[key] = this.get(key);
    }
    
    return config;
  }

  get safeConfig() {
    const config = this.allConfig;
    const safeConfig = {};
    
    for (const [key, value] of Object.entries(config)) {
      safeConfig[key] = this._encryptedFields.has(key) ? '***ENCRYPTED***' : value;
    }
    
    return safeConfig;
  }

  // Statistics computed properties
  get statistics() {
    return {
      environment: this._environment,
      totalSettings: this.totalSettings,
      customSettings: this.loadedCount,
      defaultSettings: this.defaultCount,
      sensitiveSettings: this._encryptedFields.size,
      validators: this._validators.size,
      listeners: Array.from(this._changeListeners.values()).reduce((sum, set) => sum + set.size, 0),
      age: this.ageInMinutes,
      isValid: this.isValid,
      validationErrors: this.validationErrors.length
    };
  }

  // Helper methods
  _getConfigGroup(prefix) {
    const group = {};
    const prefixWithDot = `${prefix}.`;
    
    for (const [key, value] of this._config) {
      if (key.startsWith(prefixWithDot)) {
        const fieldName = key.substring(prefixWithDot.length);
        group[fieldName] = value;
      }
    }
    
    for (const [key, value] of this._defaults) {
      if (key.startsWith(prefixWithDot) && !(key in this._config)) {
        const fieldName = key.substring(prefixWithDot.length);
        group[fieldName] = value;
      }
    }
    
    return group;
  }

  set(key, value) {
    const oldValue = this.get(key);
    this._config.set(key, value);
    this._notifyChange(key, value, oldValue);
  }

  get(key) {
    if (this._config.has(key)) {
      return this._config.get(key);
    }
    return this._defaults.get(key);
  }
}

// Usage
const config = new ConfigManager('production');

// Set some configuration
config.set('database.host', 'localhost');
config.set('database.port', 5432);
config.set('api.secret', 'very-secret-key');
config.set('cache.ttl', 3600);

// Mark sensitive fields
config._encryptedFields.add('api.secret');

console.log(config.databaseConfig); // { host: 'localhost', port: 5432 }
console.log(config.isProduction); // true
console.log(config.safeConfig); // Shows encrypted values for sensitive fields
console.log(config.statistics); // Configuration statistics

// These computed properties provide:
// - **Derived data** without storage overhead
// - **Runtime calculations** based on current state
// - **Validation and status checks**
// - **Performance metrics**
// - **Configuration management**
// - **Security masking**
// - **Cache statistics**
// - **API response formatting**

// They're essential for building intelligent, self-monitoring Node.js backend systems that can adapt and provide insights into their own operation.



























// Here are comprehensive code snippets for Inheritance in JavaScript Classes for Node.js backend development:

// ## 1. Basic Inheritance Patterns

// Base Service Class
class BaseService {
  constructor(name, options = {}) {
    this.name = name;
    this.logger = options.logger || console;
    this.isInitialized = false;
    this.errors = [];
    this.metrics = new Map();
    this._startTime = Date.now();
  }

  async initialize() {
    try {
      await this._validateDependencies();
      this.isInitialized = true;
      this.logger.info(`${this.name} initialized successfully`);
      this._recordMetric('initialization_time', Date.now() - this._startTime);
    } catch (error) {
      this.errors.push(error);
      this.logger.error(`Failed to initialize ${this.name}:`, error);
      throw error;
    }
  }

  async shutdown() {
    this.isInitialized = false;
    this.logger.info(`${this.name} shut down`);
  }

  // Protected methods (convention with _ prefix)
  _validateDependencies() {
    // To be implemented by child classes
    return Promise.resolve();
  }

  _recordMetric(name, value) {
    this.metrics.set(name, value);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  get status() {
    return {
      name: this.name,
      initialized: this.isInitialized,
      errorCount: this.errors.length,
      uptime: this.isInitialized ? Date.now() - this._startTime : 0,
      lastError: this.errors[this.errors.length - 1] || null
    };
  }

  // Static method inheritance
  static getServiceType() {
    return 'BaseService';
  }
}

// User Service inheriting from BaseService
class UserService extends BaseService {
  constructor(database, cache, options = {}) {
    super('UserService', options);
    this.database = database;
    this.cache = cache;
    this._userCache = new Map();
    this._validationRules = options.validationRules || {};
  }

  async _validateDependencies() {
    if (!this.database) {
      throw new Error('Database dependency is required');
    }
    if (!this.cache) {
      throw new Error('Cache dependency is required');
    }
  }

  async createUser(userData) {
    this._validateUserData(userData);
    
    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const user = await this.database.create('users', {
        ...userData,
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active'
      });

      // Cache the user
      this._cacheUser(user);
      
      this._recordMetric('users_created', (this.metrics.get('users_created') || 0) + 1);
      
      this.logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }

  async findUserById(id, useCache = true) {
    if (useCache) {
      const cachedUser = this._getCachedUser(id);
      if (cachedUser) {
        this._recordMetric('cache_hits', (this.metrics.get('cache_hits') || 0) + 1);
        return cachedUser;
      }
    }

    this._recordMetric('cache_misses', (this.metrics.get('cache_misses') || 0) + 1);
    
    const user = await this.database.findById('users', id);
    if (user) {
      this._cacheUser(user);
    }
    
    return user;
  }

  async findUserByEmail(email) {
    return await this.database.findOne('users', { email });
  }

  // Private methods
  _validateUserData(userData) {
    const required = ['email', 'name'];
    const missing = required.filter(field => !userData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (this._validationRules.email && !this._validationRules.email.test(userData.email)) {
      throw new Error('Invalid email format');
    }
  }

  _cacheUser(user) {
    this._userCache.set(user.id, user);
    // Set TTL for cache entry
    setTimeout(() => {
      this._userCache.delete(user.id);
    }, 5 * 60 * 1000); // 5 minutes
  }

  _getCachedUser(id) {
    return this._userCache.get(id);
  }

  // Override parent method
  async shutdown() {
    // Clear caches
    this._userCache.clear();
    
    // Call parent shutdown
    await super.shutdown();
    
    this.logger.info('UserService caches cleared');
  }

  // Additional methods specific to UserService
  async deactivateUser(userId) {
    const user = await this.findUserById(userId, false);
    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await this.database.update('users', userId, {
      status: 'inactive',
      updated_at: new Date(),
      deactivated_at: new Date()
    });

    // Remove from cache
    this._userCache.delete(userId);
    
    return updatedUser;
  }

  // Static method override
  static getServiceType() {
    return 'UserService';
  }
}

// ## 2. Multi-level Inheritance for Database Models

// Base Model Class
class BaseModel {
  constructor(tableName, database) {
    if (new.target === BaseModel) {
      throw new Error('BaseModel cannot be instantiated directly');
    }
    
    this.tableName = tableName;
    this.database = database;
    this.softDelete = false;
    this.timestamps = true;
  }

  async findById(id, options = {}) {
    let query = this.database(this.tableName).where('id', id);

    if (this.softDelete && !options.includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    const record = await query.first();
    
    if (!record && options.throwIfNotFound !== false) {
      throw new Error(`${this.constructor.name} not found with id: ${id}`);
    }

    return record;
  }

  async create(data) {
    const insertData = { ...data };
    
    if (this.timestamps) {
      const now = new Date();
      insertData.created_at = now;
      insertData.updated_at = now;
    }

    const [record] = await this.database(this.tableName)
      .insert(insertData)
      .returning('*');

    return record;
  }

  async update(id, data) {
    const updateData = { ...data };
    
    if (this.timestamps) {
      updateData.updated_at = new Date();
    }

    const [record] = await this.database(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning('*');

    if (!record) {
      throw new Error(`${this.constructor.name} not found with id: ${id}`);
    }

    return record;
  }

  async delete(id, hardDelete = false) {
    if (this.softDelete && !hardDelete) {
      return await this.update(id, { deleted_at: new Date() });
    }

    const [record] = await this.database(this.tableName)
      .where('id', id)
      .delete()
      .returning('*');

    return record;
  }

  // Abstract method - must be implemented by child classes
  validate(data) {
    throw new Error('validate method must be implemented by child class');
  }

  // Hook methods - can be overridden by child classes
  async beforeCreate(data) {
    return data;
  }

  async afterCreate(record) {
    return record;
  }

  async beforeUpdate(data) {
    return data;
  }

  async afterUpdate(record) {
    return record;
  }
}

// Timestamped Model (Intermediate level)
class TimestampedModel extends BaseModel {
  constructor(tableName, database) {
    super(tableName, database);
    this.timestamps = true;
  }

  async findRecent(limit = 10) {
    return await this.database(this.tableName)
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  async findUpdatedSince(timestamp) {
    return await this.database(this.tableName)
      .where('updated_at', '>=', timestamp)
      .whereNull('deleted_at');
  }
}

// SoftDelete Model (Intermediate level)
class SoftDeleteModel extends BaseModel {
  constructor(tableName, database) {
    super(tableName, database);
    this.softDelete = true;
  }

  async findWithDeleted(options = {}) {
    return await this.findById(options.id, { includeDeleted: true });
  }

  async restore(id) {
    const [record] = await this.database(this.tableName)
      .where('id', id)
      .update({ deleted_at: null })
      .returning('*');

    if (!record) {
      throw new Error(`${this.constructor.name} not found with id: ${id}`);
    }

    return record;
  }

  async findDeleted() {
    return await this.database(this.tableName)
      .whereNotNull('deleted_at');
  }
}

// User Model (Final implementation)
class UserModel extends SoftDeleteModel {
  constructor(database) {
    super('users', database);
    this.validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      password: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true
      }
    };
  }

  // Implement abstract method
  validate(data) {
    const errors = [];

    if (data.email && !this.validationRules.email.test(data.email)) {
      errors.push('Invalid email format');
    }

    if (data.password) {
      if (data.password.length < this.validationRules.password.minLength) {
        errors.push('Password must be at least 8 characters long');
      }
      if (this.validationRules.password.requireUppercase && !/[A-Z]/.test(data.password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (this.validationRules.password.requireNumbers && !/\d/.test(data.password)) {
        errors.push('Password must contain at least one number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Override hook methods
  async beforeCreate(data) {
    const validation = this.validate(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash password if present
    if (data.password) {
      data.password_hash = await this._hashPassword(data.password);
      delete data.password;
    }

    return data;
  }

  async afterCreate(user) {
    // Send welcome email or other post-creation logic
    console.log(`User ${user.email} created successfully`);
    return user;
  }

  async findByEmail(email) {
    return await this.database(this.tableName)
      .where('email', email)
      .whereNull('deleted_at')
      .first();
  }

  async verifyPassword(user, password) {
    return await this._comparePassword(password, user.password_hash);
  }

  // Private methods
  async _hashPassword(password) {
    // In production, use bcrypt or similar
    return Buffer.from(password).toString('base64');
  }

  async _comparePassword(password, hash) {
    return Buffer.from(password).toString('base64') === hash;
  }
}

// Admin User Model with additional privileges
class AdminUserModel extends UserModel {
  constructor(database) {
    super(database);
    this.adminPermissions = ['create_users', 'delete_users', 'manage_roles'];
  }

  async createAdmin(userData) {
    const adminData = {
      ...userData,
      role: 'admin',
      permissions: this.adminPermissions
    };

    return await this.create(adminData);
  }

  async promoteToAdmin(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return await this.update(userId, {
      role: 'admin',
      permissions: this.adminPermissions,
      promoted_at: new Date()
    });
  }

  async findAdmins() {
    return await this.database(this.tableName)
      .where('role', 'admin')
      .whereNull('deleted_at');
  }

  // Override validation for admin-specific rules
  validate(data) {
    const validation = super.validate(data);
    
    if (data.role === 'admin') {
      // Additional admin validation
      if (!data.admin_code) {
        validation.errors.push('Admin code required for admin role');
        validation.isValid = false;
      }
    }

    return validation;
  }
}

// ## 3. Mixin Pattern for Multiple Inheritance

// Mixin functions for reusable functionality
const TimestampMixin = (BaseClass) => class extends BaseClass {
  constructor(...args) {
    super(...args);
    this._createdAt = new Date();
    this._updatedAt = new Date();
  }

  get createdAt() {
    return new Date(this._createdAt);
  }

  get updatedAt() {
    return new Date(this._updatedAt);
  }

  touch() {
    this._updatedAt = new Date();
    return this;
  }

  get age() {
    return Date.now() - this._createdAt.getTime();
  }
};

const CacheableMixin = (BaseClass) => class extends BaseClass {
  constructor(...args) {
    super(...args);
    this._cache = new Map();
    this._cacheHits = 0;
    this._cacheMisses = 0;
  }

  cacheGet(key) {
    if (this._cache.has(key)) {
      this._cacheHits++;
      return this._cache.get(key);
    }
    this._cacheMisses++;
    return null;
  }

  cacheSet(key, value, ttl = 300000) { // 5 minutes default
    this._cache.set(key, value);
    
    // Auto-expire cache entry
    if (ttl > 0) {
      setTimeout(() => {
        this._cache.delete(key);
      }, ttl);
    }
  }

  cacheClear() {
    this._cache.clear();
  }

  get cacheStats() {
    const total = this._cacheHits + this._cacheMisses;
    return {
      size: this._cache.size,
      hits: this._cacheHits,
      misses: this._cacheMisses,
      hitRate: total > 0 ? (this._cacheHits / total) * 100 : 0
    };
  }
};

const ValidatableMixin = (BaseClass) => class extends BaseClass {
  constructor(...args) {
    super(...args);
    this._validators = new Map();
    this._validationErrors = [];
  }

  addValidator(field, validatorFn, message) {
    if (!this._validators.has(field)) {
      this._validators.set(field, []);
    }
    this._validators.get(field).push({ validator: validatorFn, message });
  }

  validate() {
    this._validationErrors = [];
    
    for (const [field, validators] of this._validators) {
      const value = this[field];
      
      for (const { validator, message } of validators) {
        if (!validator(value)) {
          this._validationErrors.push({
            field,
            message: message || `Validation failed for ${field}`
          });
        }
      }
    }
    
    return this.isValid;
  }

  get isValid() {
    return this._validationErrors.length === 0;
  }

  get validationErrors() {
    return [...this._validationErrors];
  }

  clearValidation() {
    this._validationErrors = [];
  }
};

// Usage with mixins
class ProductService extends CacheableMixin(ValidatableMixin(TimestampMixin(BaseService))) {
  constructor(database, inventoryService, options = {}) {
    super('ProductService', options);
    this.database = database;
    this.inventoryService = inventoryService;
    
    // Setup validators
    this.addValidator('price', (price) => price > 0, 'Price must be positive');
    this.addValidator('name', (name) => name && name.length > 0, 'Name is required');
  }

  async getProduct(id) {
    // Try cache first
    const cached = this.cacheGet(`product:${id}`);
    if (cached) {
      return cached;
    }

    const product = await this.database.findById('products', id);
    if (product) {
      this.cacheSet(`product:${id}`, product, 10 * 60 * 1000); // 10 minutes
    }

    return product;
  }

  async createProduct(productData) {
    // Validate using mixin
    if (!this.validate()) {
      throw new Error(`Validation failed: ${this.validationErrors.map(e => e.message).join(', ')}`);
    }

    const product = await this.database.create('products', productData);
    
    // Update timestamps
    this.touch();
    
    // Clear relevant caches
    this.cacheClear();
    
    return product;
  }

  async getProductsByCategory(categoryId) {
    const cacheKey = `products:category:${categoryId}`;
    const cached = this.cacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    const products = await this.database.find('products', { category_id: categoryId });
    this.cacheSet(cacheKey, products, 5 * 60 * 1000); // 5 minutes
    
    return products;
  }
}

// ## 4. Authentication & Authorization Inheritance Chain

// Base Authenticator
class BaseAuthenticator {
  constructor(options = {}) {
    this.options = options;
    this.strategies = new Map();
  }

  async authenticate(credentials) {
    throw new Error('authenticate method must be implemented');
  }

  async validate(token) {
    throw new Error('validate method must be implemented');
  }

  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
  }

  get availableStrategies() {
    return Array.from(this.strategies.keys());
  }
}

// JWT Authenticator
class JWTAuthenticator extends BaseAuthenticator {
  constructor(jwtSecret, options = {}) {
    super(options);
    this.jwtSecret = jwtSecret;
    this.algorithm = options.algorithm || 'HS256';
    this.expiresIn = options.expiresIn || '7d';
  }

  async authenticate(credentials) {
    const { email, password } = credentials;
    
    // Validate credentials (in real app, check against database)
    const user = await this._validateCredentials(email, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT
    const token = this._generateToken(user);
    
    return {
      token,
      user: this._sanitizeUser(user),
      expiresIn: this.expiresIn
    };
  }

  async validate(token) {
    try {
      const payload = this._verifyToken(token);
      const user = await this._getUserById(payload.userId);
      
      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      return {
        isValid: true,
        user: this._sanitizeUser(user),
        payload
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  // Protected methods
  _generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    // In production, use a JWT library like jsonwebtoken
    const header = Buffer.from(JSON.stringify({ alg: this.algorithm, typ: 'JWT' })).toString('base64');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = Buffer.from(this.jwtSecret).toString('base64');
    
    return `${header}.${payloadEncoded}.${signature}`;
  }

  _verifyToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Simple verification (in production, use proper JWT verification)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  }

  async _validateCredentials(email, password) {
    // In production, validate against database
    return { id: '1', email, password: 'hashed_password', role: 'user', status: 'active' };
  }

  async _getUserById(userId) {
    // In production, fetch from database
    return { id: userId, email: 'user@example.com', role: 'user', status: 'active' };
  }

  _sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

// OAuth Authenticator
class OAuthAuthenticator extends BaseAuthenticator {
  constructor(providers, options = {}) {
    super(options);
    this.providers = new Map();
    
    providers.forEach(provider => {
      this.registerStrategy(provider.name, provider);
    });
  }

  async authenticate(providerName, authCode) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not supported`);
    }

    // Exchange code for access token
    const accessToken = await this._exchangeCode(provider, authCode);
    
    // Get user profile
    const profile = await this._getUserProfile(provider, accessToken);
    
    // Find or create user
    const user = await this._findOrCreateUser(providerName, profile);
    
    // Generate application token
    const appToken = this._generateAppToken(user);
    
    return {
      token: appToken,
      user: this._sanitizeUser(user),
      provider: providerName
    };
  }

  async _exchangeCode(provider, code) {
    // Implement OAuth code exchange
    return 'mock_access_token';
  }

  async _getUserProfile(provider, accessToken) {
    // Implement profile fetching
    return {
      id: 'oauth_user_id',
      email: 'user@example.com',
      name: 'OAuth User'
    };
  }

  async _findOrCreateUser(providerName, profile) {
    // Find existing user or create new one
    return {
      id: 'user_id',
      email: profile.email,
      name: profile.name,
      oauth_provider: providerName,
      oauth_id: profile.id
    };
  }

  _generateAppToken(user) {
    // Generate JWT or similar token
    return 'app_jwt_token';
  }
}

// Multi-factor Authenticator
class MultiFactorAuthenticator extends JWTAuthenticator {
  constructor(jwtSecret, mfaService, options = {}) {
    super(jwtSecret, options);
    this.mfaService = mfaService;
    this.requireMFA = options.requireMFA || false;
  }

  async authenticate(credentials) {
    const { email, password, mfaToken } = credentials;
    
    // First, validate basic credentials
    const user = await this._validateCredentials(email, password);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if MFA is required
    if (this.requireMFA || user.mfa_enabled) {
      if (!mfaToken) {
        // Return partial authentication, require MFA
        return {
          requiresMFA: true,
          mfaMethods: await this.mfaService.getAvailableMethods(user.id)
        };
      }

      // Validate MFA token
      const isValidMFA = await this.mfaService.validateToken(user.id, mfaToken);
      if (!isValidMFA) {
        throw new Error('Invalid MFA token');
      }
    }

    // Generate final token
    const token = this._generateToken(user);
    
    return {
      token,
      user: this._sanitizeUser(user),
      expiresIn: this.expiresIn
    };
  }

  async enableMFA(userId, mfaMethod) {
    return await this.mfaService.enableMethod(userId, mfaMethod);
  }

  async disableMFA(userId) {
    return await this.mfaService.disableMethod(userId);
  }
}

// ## 5. Error Handling Inheritance

// Base Application Error
class ApplicationError extends Error {
  constructor(message, code = 'APPLICATION_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.isOperational = true; // Distinguish operational errors from programmer errors
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }

  log(logger) {
    logger.error(`${this.name} [${this.code}]: ${this.message}`, {
      details: this.details,
      timestamp: this.timestamp
    });
  }
}

// Database Errors
class DatabaseError extends ApplicationError {
  constructor(message, operation, query, originalError) {
    super(message, 'DATABASE_ERROR', {
      operation,
      query: this._sanitizeQuery(query),
      originalError: originalError?.message
    });
    this.originalError = originalError;
  }

  _sanitizeQuery(query) {
    // Remove sensitive data from query logging
    if (typeof query === 'string') {
      return query.replace(/(password|token|secret)=[^&]+/g, '$1=***');
    }
    return query;
  }
}

class ConnectionError extends DatabaseError {
  constructor(originalError) {
    super('Database connection failed', 'connect', null, originalError);
  }
}

class QueryError extends DatabaseError {
  constructor(operation, query, originalError) {
    super('Database query failed', operation, query, originalError);
  }
}

class UniqueConstraintError extends DatabaseError {
  constructor(field, value, originalError) {
    super('Unique constraint violated', 'insert', { field, value }, originalError);
    this.field = field;
    this.value = value;
  }
}

// Validation Errors
class ValidationError extends ApplicationError {
  constructor(field, value, rule, details = {}) {
    super(`Validation failed for field: ${field}`, 'VALIDATION_ERROR', {
      field,
      value: this._maskSensitiveValue(field, value),
      rule,
      ...details
    });
    this.field = field;
    this.rule = rule;
  }

  _maskSensitiveValue(field, value) {
    const sensitiveFields = ['password', 'token', 'secret', 'api_key'];
    if (sensitiveFields.includes(field) && value) {
      return '***';
    }
    return value;
  }
}

class RequiredFieldError extends ValidationError {
  constructor(field) {
    super(field, null, 'required', { message: `${field} is required` });
  }
}

class InvalidFormatError extends ValidationError {
  constructor(field, value, expectedFormat) {
    super(field, value, 'format', { 
      message: `${field} must match format: ${expectedFormat}`,
      expectedFormat 
    });
  }
}

// Authentication & Authorization Errors
class AuthenticationError extends ApplicationError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 'AUTHENTICATION_ERROR', details);
  }
}

class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  }
}

class TokenExpiredError extends AuthenticationError {
  constructor() {
    super('Authentication token has expired', { code: 'TOKEN_EXPIRED' });
  }
}

class AuthorizationError extends ApplicationError {
  constructor(resource, action, user) {
    super('Access denied', 'AUTHORIZATION_ERROR', {
      resource,
      action,
      userId: user?.id,
      userRole: user?.role
    });
    this.resource = resource;
    this.action = action;
  }
}

// Business Logic Errors
class BusinessLogicError extends ApplicationError {
  constructor(message, businessRule, context = {}) {
    super(message, 'BUSINESS_LOGIC_ERROR', {
      businessRule,
      ...context
    });
    this.businessRule = businessRule;
  }
}

class InsufficientFundsError extends BusinessLogicError {
  constructor(userId, amount, balance) {
    super('Insufficient funds', 'INSUFFICIENT_FUNDS', {
      userId,
      amount,
      balance
    });
  }
}

class ResourceNotFoundError extends BusinessLogicError {
  constructor(resourceType, resourceId) {
    super(`${resourceType} not found`, 'RESOURCE_NOT_FOUND', {
      resourceType,
      resourceId
    });
  }
}

// Usage in services
class PaymentService extends BaseService {
  async processPayment(userId, amount, paymentMethod) {
    try {
      // Check user balance
      const user = await this.findUserById(userId);
      if (user.balance < amount) {
        throw new InsufficientFundsError(userId, amount, user.balance);
      }

      // Process payment
      return await this._chargePayment(user, amount, paymentMethod);
    } catch (error) {
      if (error instanceof BusinessLogicError) {
        // Business logic errors are expected, log but don't alert
        error.log(this.logger);
      } else {
        // Unexpected errors, alert and rethrow
        this.logger.error('Unexpected error in processPayment:', error);
      }
      throw error;
    }
  }

  async findUserById(userId) {
    try {
      const user = await this.database.findById('users', userId);
      if (!user) {
        throw new ResourceNotFoundError('User', userId);
      }
      return user;
    } catch (error) {
      if (error instanceof DatabaseError) {
        // Wrap database errors with more context
        throw new DatabaseError(
          'Failed to fetch user',
          'findById',
          { table: 'users', id: userId },
          error
        );
      }
      throw error;
    }
  }
}

// Global error handler
class ErrorHandler {
  static handleError(error, req, res) {
    // Log the error
    if (error instanceof ApplicationError) {
      error.log(console);
    } else {
      console.error('Unexpected error:', error);
    }

    // Send appropriate response
    if (error instanceof ApplicationError && error.isOperational) {
      res.status(ErrorHandler.getStatusCode(error)).json({
        success: false,
        error: error.toJSON()
      });
    } else {
      // Don't expose internal errors in production
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  static getStatusCode(error) {
    const statusMap = {
      ValidationError: 400,
      AuthenticationError: 401,
      AuthorizationError: 403,
      ResourceNotFoundError: 404,
      BusinessLogicError: 422,
      DatabaseError: 503
    };

    return statusMap[error.constructor.name] || 500;
  }
}

// These inheritance patterns provide:

// - **Code reuse** through shared base functionality
// - **Specialization** through method overriding
// - **Polymorphism** for flexible service interactions
// - **Consistent error handling** across the application
// - **Mixin composition** for multiple inheritance-like behavior
// - **Abstract base classes** for defining contracts
// - **Hook methods** for extensibility
// - **Proper error hierarchy** for precise error handling

// This approach enables building maintainable, scalable Node.js backend systems with clear separation of concerns and reusable components.

































// Here are comprehensive code snippets demonstrating `new.target` usage in Node.js production-grade backend development:

// ## 1. Basic `new.target` Usage

// Basic class with new.target validation
class DatabaseConnection {
  constructor(connectionString) {
    if (new.target === DatabaseConnection) {
      throw new Error('DatabaseConnection is abstract and cannot be instantiated directly');
    }
    this.connectionString = connectionString;
    this.connected = false;
  }

  connect() {
    throw new Error('Method "connect" must be implemented by subclass');
  }
}

class MySQLConnection extends DatabaseConnection {
  constructor(connectionString) {
    super(connectionString);
  }

  connect() {
    this.connected = true;
    console.log(`Connected to MySQL: ${this.connectionString}`);
    return this;
  }
}

// Usage
try {
  // This will throw an error
  // const db = new DatabaseConnection('mysql://localhost:3306/db');
} catch (error) {
  console.error('Error:', error.message);
}

const mysql = new MySQLConnection('mysql://localhost:3306/production');
mysql.connect();

// ## 2. Abstract Factory Pattern

// Abstract Service Factory
class ServiceFactory {
  constructor() {
    if (new.target === ServiceFactory) {
      throw new Error('ServiceFactory is abstract');
    }
  }

  createUserService() {
    throw new Error('createUserService must be implemented');
  }

  createAuthService() {
    throw new Error('createAuthService must be implemented');
  }

  static getFactory(environment) {
    switch (environment) {
      case 'production':
        return new ProductionServiceFactory();
      case 'development':
        return new DevelopmentServiceFactory();
      case 'test':
        return new TestServiceFactory();
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
  }
}

class ProductionServiceFactory extends ServiceFactory {
  createUserService() {
    return new ProductionUserService();
  }

  createAuthService() {
    return new ProductionAuthService();
  }
}

class DevelopmentServiceFactory extends ServiceFactory {
  createUserService() {
    return new DevelopmentUserService();
  }

  createAuthService() {
    return new DevelopmentAuthService();
  }
}

// Service implementations
class ProductionUserService {
  getUser(id) {
    // Production implementation
    return { id, name: 'Production User', environment: 'production' };
  }
}

class DevelopmentUserService {
  getUser(id) {
    // Development implementation
    return { id, name: 'Development User', environment: 'development' };
  }
}

// ## 3. Repository Pattern with Validation

// Base Repository with new.target validation
class BaseRepository {
  constructor(modelName) {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository is abstract');
    }
    
    this.modelName = modelName;
    this.initialize();
  }

  initialize() {
    // Common initialization logic
    console.log(`Initializing ${this.modelName} repository`);
  }

  async findById(id) {
    throw new Error('findById must be implemented');
  }

  async create(data) {
    throw new Error('create must be implemented');
  }

  async update(id, data) {
    throw new Error('update must be implemented');
  }

  async delete(id) {
    throw new Error('delete must be implemented');
  }
}

// Concrete Repository Implementation
class UserRepository extends BaseRepository {
  constructor(database) {
    super('User');
    this.database = database;
    this.collection = this.database.collection('users');
  }

  async findById(id) {
    return await this.collection.findOne({ _id: id });
  }

  async create(userData) {
    const result = await this.collection.insertOne({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return result.insertedId;
  }

  async update(id, userData) {
    const result = await this.collection.updateOne(
      { _id: id },
      { 
        $set: { 
          ...userData, 
          updatedAt: new Date() 
        } 
      }
    );
    return result.modifiedCount;
  }

  async delete(id) {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount;
  }
}

// Usage in production
class DatabaseService {
  constructor() {
    this.repositories = new Map();
  }

  registerRepository(name, RepositoryClass) {
    if (new.target !== DatabaseService) {
      throw new Error('DatabaseService methods should be called on instance');
    }
    
    if (this.repositories.has(name)) {
      throw new Error(`Repository ${name} already registered`);
    }
    
    const repository = new RepositoryClass(this);
    this.repositories.set(name, repository);
    return repository;
  }

  getRepository(name) {
    return this.repositories.get(name);
  }
}

// ## 4. Middleware Chain with Validation

// Abstract Middleware
class Middleware {
  constructor() {
    if (new.target === Middleware) {
      throw new Error('Middleware is abstract');
    }
  }

  execute(context, next) {
    throw new Error('execute must be implemented');
  }
}

// Concrete Middleware Implementations
class AuthenticationMiddleware extends Middleware {
  async execute(context, next) {
    const { request } = context;
    
    // Validate authentication token
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Authentication required');
    }

    // Verify token (in production, use JWT or similar)
    context.user = await this.verifyToken(token);
    
    return next();
  }

  async verifyToken(token) {
    // Token verification logic
    return { id: 'user123', role: 'admin' };
  }
}

class LoggingMiddleware extends Middleware {
  async execute(context, next) {
    const start = Date.now();
    
    console.log(`[${new Date().toISOString()}] Request started:`, {
      method: context.request.method,
      url: context.request.url,
      user: context.user?.id
    });

    await next();

    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] Request completed:`, {
      method: context.request.method,
      url: context.request.url,
      duration: `${duration}ms`,
      status: context.response?.status
    });
  }
}

class ValidationMiddleware extends Middleware {
  constructor(schema) {
    super();
    this.schema = schema;
  }

  async execute(context, next) {
    const { request } = context;
    
    // Validate request body against schema
    const validationResult = this.schema.validate(request.body);
    if (validationResult.error) {
      throw new Error(`Validation failed: ${validationResult.error.message}`);
    }

    context.validatedData = validationResult.value;
    return next();
  }
}

// Middleware Chain
class MiddlewareChain {
  constructor() {
    this.middlewares = [];
  }

  use(middleware) {
    if (!(middleware instanceof Middleware)) {
      throw new Error('Middleware must extend base Middleware class');
    }
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context) {
    const executeMiddleware = async (index) => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index];
        await middleware.execute(context, () => executeMiddleware(index + 1));
      }
    };

    await executeMiddleware(0);
    return context;
  }
}

// ## 5. Service Layer with Dependency Injection

// Base Service with constructor validation
class BaseService {
  constructor(dependencies = {}) {
    if (new.target === BaseService) {
      throw new Error('BaseService is abstract');
    }

    this.validateDependencies(dependencies);
    this.dependencies = dependencies;
    this.initialize();
  }

  validateDependencies(dependencies) {
    const requiredDeps = this.constructor.requiredDependencies || [];
    const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);
    
    if (missingDeps.length > 0) {
      throw new Error(`Missing required dependencies: ${missingDeps.join(', ')}`);
    }
  }

  initialize() {
    // Service initialization logic
  }
}

// User Service Implementation
class UserService extends BaseService {
  static requiredDependencies = ['userRepository', 'emailService', 'logger'];

  constructor(dependencies) {
    super(dependencies);
  }

  async createUser(userData) {
    const { userRepository, emailService, logger } = this.dependencies;

    try {
      // Validate user data
      this.validateUserData(userData);

      // Create user in repository
      const userId = await userRepository.create(userData);

      // Send welcome email
      await emailService.sendWelcomeEmail(userData.email);

      logger.info(`User created successfully: ${userId}`);
      return userId;
    } catch (error) {
      logger.error(`Failed to create user: ${error.message}`);
      throw error;
    }
  }

  validateUserData(userData) {
    const requiredFields = ['email', 'name'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  async getUserProfile(userId) {
    const { userRepository } = this.dependencies;
    return await userRepository.findById(userId);
  }
}

// Service Container
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, ServiceClass, dependencies = []) {
    if (new.target !== ServiceContainer) {
      throw new Error('ServiceContainer methods should be called on instance');
    }

    this.factories.set(name, { ServiceClass, dependencies });
  }

  get(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not registered`);
    }

    const resolvedDependencies = {};
    for (const depName of factory.dependencies) {
      resolvedDependencies[depName] = this.get(depName);
    }

    const service = new factory.ServiceClass(resolvedDependencies);
    this.services.set(name, service);
    return service;
  }
}

// ## 6. Production Usage Example

// Complete production setup example
class ProductionApp {
  constructor() {
    this.serviceContainer = new ServiceContainer();
    this.setupServices();
    this.setupMiddleware();
  }

  setupServices() {
    // Register repositories
    this.serviceContainer.register('userRepository', UserRepository, ['database']);
    this.serviceContainer.register('emailService', EmailService, ['smtpConfig']);
    this.serviceContainer.register('logger', LoggerService, []);
    
    // Register business services
    this.serviceContainer.register('userService', UserService, [
      'userRepository', 
      'emailService', 
      'logger'
    ]);
  }

  setupMiddleware() {
    this.middlewareChain = new MiddlewareChain()
      .use(new LoggingMiddleware())
      .use(new AuthenticationMiddleware())
      .use(new ValidationMiddleware(userSchema));
  }

  async handleRequest(request, response) {
    const context = { request, response };
    
    try {
      await this.middlewareChain.execute(context);
      
      // Route handling based on validated context
      const userService = this.serviceContainer.get('userService');
      const result = await this.routeRequest(context, userService);
      
      context.response.status(200).json(result);
    } catch (error) {
      this.handleError(error, context);
    }
  }

  async routeRequest(context, userService) {
    const { request, validatedData, user } = context;
    
    switch (request.method) {
      case 'POST':
        if (request.url === '/users') {
          return await userService.createUser(validatedData);
        }
        break;
      case 'GET':
        if (request.url.startsWith('/users/')) {
          const userId = request.url.split('/')[2];
          return await userService.getUserProfile(userId);
        }
        break;
      default:
        throw new Error(`Unsupported method: ${request.method}`);
    }
  }

  handleError(error, context) {
    const { response } = context;
    
    console.error('Request error:', error);
    
    if (error.message.includes('Authentication')) {
      response.status(401).json({ error: error.message });
    } else if (error.message.includes('Validation')) {
      response.status(400).json({ error: error.message });
    } else {
      response.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Usage in production
const app = new ProductionApp();

// Simulate HTTP request
const mockRequest = {
  method: 'POST',
  url: '/users',
  headers: {
    authorization: 'Bearer valid-token-123'
  },
  body: {
    email: 'user@example.com',
    name: 'John Doe'
  }
};

const mockResponse = {
  status: (code) => ({
    json: (data) => console.log(`Response ${code}:`, data)
  })
};

// Handle the request
app.handleRequest(mockRequest, mockResponse);

// ## Key Benefits in Production:

// 1. **Abstract Base Classes**: Prevent direct instantiation of base classes
// 2. **Constructor Validation**: Ensure proper inheritance and dependency injection
// 3. **Factory Patterns**: Create objects based on environment or configuration
// 4. **Middleware Chains**: Implement cross-cutting concerns
// 5. **Service Containers**: Manage dependencies and lifecycle
// 6. **Error Handling**: Consistent error handling across the application
// 7. **Logging & Monitoring**: Built-in observability

// These patterns ensure your Node.js backend is maintainable, testable, and production-ready.






























// Here are comprehensive code snippets demonstrating `static methods` in Node.js production-grade backend development:

// ## 1. Static Factory Methods

// Database Connection Factory
class DatabaseConnection {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  // Static factory method for different database types
  static create(type, config) {
    switch (type) {
      case 'mysql':
        return new MySQLConnection(config);
      case 'postgres':
        return new PostgresConnection(config);
      case 'mongodb':
        return new MongoDBConnection(config);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  // Static method to validate connection configuration
  static validateConfig(config) {
    const required = ['host', 'port', 'database'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('Invalid port number');
    }

    return true;
  }

  // Static method to get default configuration
  static getDefaultConfig(environment) {
    const defaults = {
      development: {
        host: 'localhost',
        port: 3306,
        maxConnections: 10,
        timeout: 30000
      },
      production: {
        host: 'db-cluster.example.com',
        port: 3306,
        maxConnections: 100,
        timeout: 60000,
        ssl: true
      },
      test: {
        host: 'localhost',
        port: 3306,
        maxConnections: 5,
        timeout: 10000
      }
    };

    return defaults[environment] || defaults.development;
  }

  async connect() {
    throw new Error('connect method must be implemented by subclass');
  }
}

class MySQLConnection extends DatabaseConnection {
  async connect() {
    // MySQL connection logic
    this.connected = true;
    console.log(`Connected to MySQL: ${this.config.host}:${this.config.port}`);
    return this;
  }
}

class PostgresConnection extends DatabaseConnection {
  async connect() {
    // PostgreSQL connection logic
    this.connected = true;
    console.log(`Connected to PostgreSQL: ${this.config.host}:${this.config.port}`);
    return this;
  }
}

// Usage in production
class DatabaseManager {
  static async initializeDatabase(environment = 'production') {
    const defaultConfig = DatabaseConnection.getDefaultConfig(environment);
    const finalConfig = {
      ...defaultConfig,
      database: process.env.DB_NAME || 'myapp'
    };

    // Validate configuration
    DatabaseConnection.validateConfig(finalConfig);

    // Create connection based on environment
    const dbType = environment === 'production' ? 'mysql' : 'postgres';
    const connection = DatabaseConnection.create(dbType, finalConfig);
    
    await connection.connect();
    return connection;
  }
}

// ## 2. Static Validation & Utility Methods

// User Model with static validation
class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.username = data.username;
    this.password = data.password;
    this.role = data.role || 'user';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Static validation methods
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password) {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { 
        valid: false, 
        error: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' 
      };
    }

    return { valid: true };
  }

  static validateUsername(username) {
    if (username.length < 3 || username.length > 20) {
      return { valid: false, error: 'Username must be between 3 and 20 characters' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    return { valid: true };
  }

  // Static method to validate complete user data
  static validateUserData(userData) {
    const errors = [];

    if (!userData.email || !this.validateEmail(userData.email)) {
      errors.push('Invalid email address');
    }

    if (!userData.username) {
      errors.push('Username is required');
    } else {
      const usernameValidation = this.validateUsername(userData.username);
      if (!usernameValidation.valid) {
        errors.push(usernameValidation.error);
      }
    }

    if (!userData.password) {
      errors.push('Password is required');
    } else {
      const passwordValidation = this.validatePassword(userData.password);
      if (!passwordValidation.valid) {
        errors.push(passwordValidation.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : null
    };
  }

  // Static factory method for creating validated users
  static createValidated(userData) {
    const validation = this.validateUserData(userData);
    
    if (!validation.valid) {
      throw new Error(`User validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash password before storing
    const hashedPassword = this.hashPassword(userData.password);
    
    return new User({
      ...userData,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Static password hashing utility
  static hashPassword(password) {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(password + process.env.PASSWORD_SALT)
      .digest('hex');
  }

  // Static method to compare passwords
  static verifyPassword(password, hashedPassword) {
    return this.hashPassword(password) === hashedPassword;
  }

  // Static role-based authorization check
  static hasPermission(role, permission) {
    const rolePermissions = {
      user: ['read:own_profile', 'update:own_profile'],
      moderator: ['read:own_profile', 'update:own_profile', 'read:users', 'update:users'],
      admin: ['read:own_profile', 'update:own_profile', 'read:users', 'update:users', 'delete:users']
    };

    return rolePermissions[role]?.includes(permission) || false;
  }
}

// ## 3. Static Repository & Cache Management

// User Repository with static cache management
class UserRepository {
  constructor(database) {
    this.database = database;
    this.collection = this.database.collection('users');
  }

  // Static cache instance
  static cache = new Map();
  static cacheTTL = 5 * 60 * 1000; // 5 minutes

  // Static cache management methods
  static setCache(key, value, ttl = this.cacheTTL) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  static getCache(key) {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    // Remove expired cache
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  static clearCache(pattern = null) {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  static getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt > now) {
        validEntries++;
        totalSize += JSON.stringify(value).length;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: `${(totalSize / 1024).toFixed(2)} KB`
    };
  }

  // Instance methods using static cache
  async findById(id, useCache = true) {
    const cacheKey = `user:${id}`;

    if (useCache) {
      const cached = UserRepository.getCache(cacheKey);
      if (cached) {
        console.log(`Cache hit for user: ${id}`);
        return cached;
      }
    }

    // Database query
    const user = await this.collection.findOne({ _id: id });
    
    if (user && useCache) {
      UserRepository.setCache(cacheKey, user);
    }

    return user;
  }

  async findByEmail(email, useCache = true) {
    const cacheKey = `user:email:${email}`;

    if (useCache) {
      const cached = UserRepository.getCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const user = await this.collection.findOne({ email });
    
    if (user && useCache) {
      UserRepository.setCache(cacheKey, user);
    }

    return user;
  }

  async create(userData) {
    const validation = User.validateUserData(userData);
    if (!validation.valid) {
      throw new Error(`Invalid user data: ${validation.errors.join(', ')}`);
    }

    const user = User.createValidated(userData);
    const result = await this.collection.insertOne(user);

    // Invalidate relevant cache
    UserRepository.clearCache('user:');
    
    return result.insertedId;
  }

  async update(id, updateData) {
    const result = await this.collection.updateOne(
      { _id: id },
      { 
        $set: { 
          ...updateData, 
          updatedAt: new Date() 
        } 
      }
    );

    // Clear cache for this user
    UserRepository.clearCache(`user:${id}`);
    UserRepository.clearCache('user:email:');

    return result.modifiedCount;
  }
}

// ## 4. Static Service Registry & Dependency Injection

// Service Registry with static management
class ServiceRegistry {
  static services = new Map();
  static factories = new Map();
  static configurations = new Map();

  // Static service registration
  static register(name, ServiceClass, dependencies = [], config = {}) {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    this.factories.set(name, {
      ServiceClass,
      dependencies,
      config
    });

    console.log(`Registered service: ${name}`);
  }

  // Static service resolution with singleton pattern
  static get(name) {
    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    // Create new instance
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service ${name} is not registered`);
    }

    // Resolve dependencies
    const dependencies = {};
    for (const depName of factory.dependencies) {
      dependencies[depName] = this.get(depName);
    }

    // Create service instance
    const service = new factory.ServiceClass(dependencies, factory.config);
    this.services.set(name, service);

    console.log(`Initialized service: ${name}`);
    return service;
  }

  // Static service initialization
  static async initializeAll() {
    const initializationOrder = this.getInitializationOrder();
    
    for (const serviceName of initializationOrder) {
      const service = this.get(serviceName);
      
      // Initialize service if it has an init method
      if (typeof service.init === 'function') {
        await service.init();
        console.log(`Initialized service: ${serviceName}`);
      }
    }
  }

  // Static method to determine initialization order
  static getInitializationOrder() {
    const graph = new Map();
    
    for (const [name, factory] of this.factories.entries()) {
      graph.set(name, new Set(factory.dependencies));
    }

    // Simple topological sort (for production, use a more robust implementation)
    const visited = new Set();
    const order = [];

    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependencies = graph.get(node) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }

      order.push(node);
    };

    for (const node of graph.keys()) {
      visit(node);
    }

    return order;
  }

  // Static cleanup method
  static async destroyAll() {
    const destructionOrder = [...this.getInitializationOrder()].reverse();
    
    for (const serviceName of destructionOrder) {
      const service = this.services.get(serviceName);
      
      if (service && typeof service.destroy === 'function') {
        await service.destroy();
        console.log(`Destroyed service: ${serviceName}`);
      }
    }

    this.services.clear();
  }

  // Static health check
  static async healthCheck() {
    const results = [];

    for (const [name, service] of this.services.entries()) {
      try {
        if (typeof service.healthCheck === 'function') {
          const health = await service.healthCheck();
          results.push({ service: name, status: 'healthy', ...health });
        } else {
          results.push({ service: name, status: 'unknown' });
        }
      } catch (error) {
        results.push({ service: name, status: 'unhealthy', error: error.message });
      }
    }

    return results;
  }
}

// Service implementations
class DatabaseService {
  constructor(dependencies, config) {
    this.config = config;
    this.connected = false;
  }

  async init() {
    // Database connection logic
    this.connected = true;
    console.log('Database service initialized');
  }

  async healthCheck() {
    return {
      connected: this.connected,
      latency: Math.random() * 100 // Simulated latency
    };
  }

  async destroy() {
    this.connected = false;
    console.log('Database service destroyed');
  }
}

class UserService {
  constructor(dependencies, config) {
    this.db = dependencies.database;
    this.cache = dependencies.cache;
  }

  async init() {
    console.log('User service initialized');
  }

  async healthCheck() {
    return {
      usersCount: 1500, // Simulated count
      cacheHitRate: 0.85
    };
  }
}

// Production setup
class ProductionApp {
  static async bootstrap() {
    // Register services
    ServiceRegistry.register('database', DatabaseService, [], {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME
    });

    ServiceRegistry.register('cache', CacheService, []);

    ServiceRegistry.register('userService', UserService, [
      'database',
      'cache'
    ]);

    // Initialize all services
    await ServiceRegistry.initializeAll();

    // Perform health check
    const health = await ServiceRegistry.healthCheck();
    console.log('Service health check:', health);

    return ServiceRegistry;
  }

  static async shutdown() {
    await ServiceRegistry.destroyAll();
    console.log('Application shutdown complete');
  }
}

// ## 5. Static Configuration Management

// Configuration Manager with static methods
class ConfigManager {
  static config = new Map();
  static secrets = new Map();
  static validators = new Map();

  // Static configuration loading
  static loadFromEnvironment(prefix = 'APP_') {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        this.config.set(configKey, this.parseValue(value));
      }
    }
  }

  static loadFromFile(filePath) {
    const fs = require('fs');
    const path = require('path');

    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const configFile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      for (const [key, value] of Object.entries(configFile)) {
        this.config.set(key, value);
      }
    } catch (error) {
      throw new Error(`Failed to load config file: ${error.message}`);
    }
  }

  // Static value parsing
  static parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Check if it's a number
    if (!isNaN(value) && value.trim() !== '') {
      return Number(value);
    }

    // Check if it's JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Static configuration validation
  static registerValidator(key, validator) {
    this.validators.set(key, validator);
  }

  static validate() {
    const errors = [];

    for (const [key, validator] of this.validators.entries()) {
      const value = this.get(key);
      
      try {
        validator(value);
      } catch (error) {
        errors.push(`Config validation failed for ${key}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  // Static getter methods
  static get(key, defaultValue = undefined) {
    if (this.config.has(key)) {
      return this.config.get(key);
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    throw new Error(`Configuration key not found: ${key}`);
  }

  static getRequired(key) {
    const value = this.get(key);
    
    if (value === undefined || value === null) {
      throw new Error(`Required configuration missing: ${key}`);
    }
    
    return value;
  }

  // Static secret management
  static setSecret(key, value) {
    this.secrets.set(key, value);
  }

  static getSecret(key) {
    if (!this.secrets.has(key)) {
      throw new Error(`Secret not found: ${key}`);
    }
    
    return this.secrets.get(key);
  }

  // Static environment checks
  static isProduction() {
    return this.get('node_env', 'development') === 'production';
  }

  static isDevelopment() {
    return this.get('node_env', 'development') === 'development';
  }

  static isTest() {
    return this.get('node_env') === 'test';
  }

  // Static configuration dumping (for debugging)
  static dump(safe = true) {
    const dump = {};
    
    for (const [key, value] of this.config.entries()) {
      dump[key] = value;
    }
    
    if (!safe) {
      for (const [key, value] of this.secrets.entries()) {
        dump[`secret_${key}`] = '[REDACTED]';
      }
    }
    
    return dump;
  }
}

// Usage in production application
class AppConfig {
  static initialize() {
    // Load configuration
    ConfigManager.loadFromEnvironment('APP_');
    ConfigManager.loadFromFile('config/production.json');

    // Register validators
    ConfigManager.registerValidator('database_host', (value) => {
      if (!value || typeof value !== 'string') {
        throw new Error('Database host must be a non-empty string');
      }
    });

    ConfigManager.registerValidator('database_port', (value) => {
      if (value < 1 || value > 65535) {
        throw new Error('Database port must be between 1 and 65535');
      }
    });

    ConfigManager.registerValidator('jwt_secret', (value) => {
      if (!value || value.length < 32) {
        throw new Error('JWT secret must be at least 32 characters long');
      }
    });

    // Validate configuration
    ConfigManager.validate();

    // Set secrets (in production, these would come from a secure source)
    ConfigManager.setSecret('jwt_secret', ConfigManager.getRequired('jwt_secret'));
    ConfigManager.setSecret('encryption_key', ConfigManager.getRequired('encryption_key'));

    console.log('Configuration initialized successfully');
  }

  static getDatabaseConfig() {
    return {
      host: ConfigManager.getRequired('database_host'),
      port: ConfigManager.get('database_port', 3306),
      database: ConfigManager.getRequired('database_name'),
      username: ConfigManager.getRequired('database_username'),
      password: ConfigManager.getSecret('database_password'),
      ssl: ConfigManager.isProduction()
    };
  }

  static getAuthConfig() {
    return {
      jwtSecret: ConfigManager.getSecret('jwt_secret'),
      tokenExpiry: ConfigManager.get('token_expiry', '24h'),
      refreshTokenExpiry: ConfigManager.get('refresh_token_expiry', '7d')
    };
  }
}

// ## 6. Production Usage Example

// Complete production application setup
class ProductionApplication {
  static async start() {
    try {
      console.log('Starting production application...');

      // Initialize configuration
      AppConfig.initialize();

      // Bootstrap services
      const serviceRegistry = await ProductionApp.bootstrap();

      // Get required services
      const userService = serviceRegistry.get('userService');
      const database = serviceRegistry.get('database');

      // Start HTTP server
      const server = await this.startServer();

      // Setup graceful shutdown
      this.setupGracefulShutdown(server, serviceRegistry);

      console.log('Production application started successfully');
      return { server, serviceRegistry };
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  static async startServer() {
    const express = require('express');
    const app = express();

    // Middleware setup
    app.use(express.json());
    app.use(this.requestLogger);

    // Routes
    app.get('/health', this.healthCheckHandler);
    app.post('/users', this.createUserHandler);

    const port = ConfigManager.get('port', 3000);
    return app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }

  static requestLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });

    next();
  }

  static async healthCheckHandler(req, res) {
    try {
      const health = await ServiceRegistry.healthCheck();
      res.json({ status: 'healthy', services: health });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  }

  static async createUserHandler(req, res) {
    try {
      const userService = ServiceRegistry.get('userService');
      const userId = await userService.createUser(req.body);
      
      res.status(201).json({ 
        success: true, 
        userId,
        message: 'User created successfully'
      });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static setupGracefulShutdown(server, serviceRegistry) {
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      
      // Stop accepting new requests
      server.close(() => {
        console.log('HTTP server closed');
      });

      // Shutdown services
      await serviceRegistry.destroyAll();

      console.log('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Application startup
if (require.main === module) {
  ProductionApplication.start().catch(error => {
    console.error('Application startup failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionApplication;

// ## Key Benefits in Production:

// 1. **Factory Patterns**: Create objects without exposing instantiation logic
// 2. **Utility Methods**: Reusable validation and helper functions
// 3. **Cache Management**: Efficient static caching with TTL
// 4. **Service Registry**: Centralized dependency management
// 5. **Configuration Management**: Type-safe configuration handling
// 6. **Singleton Patterns**: Ensure single instances of critical services
// 7. **Health Checks**: Monitor service status and dependencies

// These patterns ensure your Node.js backend is scalable, maintainable, and production-ready with proper separation of concerns and efficient resource management.






























// Here are comprehensive code snippets demonstrating `static properties` in Node.js production-grade backend development:

// ## 1. Static Configuration & Constants

// Application Configuration with Static Properties
class AppConfig {
  // Static constants for environment types
  static ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    STAGING: 'staging',
    TEST: 'test'
  };

  // Static configuration properties
  static config = {
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || this.ENVIRONMENTS.DEVELOPMENT,
    port: parseInt(process.env.PORT) || 3000,
    maxRequestBodySize: process.env.MAX_REQUEST_SIZE || '10mb',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.RATE_LIMIT_MAX || 100
    }
  };

  // Static database configuration
  static database = {
    mysql: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'myapp',
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000
      }
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: parseInt(process.env.REDIS_DB) || 0
    }
  };

  // Static security configuration
  static security = {
    jwt: {
      secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: process.env.JWT_ISSUER || 'myapp'
    },
    bcrypt: {
      saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    },
    cors: {
      origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000']
    }
  };

  // Static method to get environment-specific config
  static getEnvironmentConfig() {
    const env = this.config.environment;
    
    const envConfigs = {
      [this.ENVIRONMENTS.DEVELOPMENT]: {
        logLevel: 'debug',
        enableSwagger: true,
        database: {
          ...this.database.mysql,
          database: `${this.database.mysql.database}_dev`
        }
      },
      [this.ENVIRONMENTS.PRODUCTION]: {
        logLevel: 'warn',
        enableSwagger: false,
        database: {
          ...this.database.mysql,
          pool: {
            min: 5,
            max: 20,
            acquireTimeout: 60000,
            idleTimeout: 30000
          }
        }
      },
      [this.ENVIRONMENTS.STAGING]: {
        logLevel: 'info',
        enableSwagger: true,
        database: {
          ...this.database.mysql,
          database: `${this.database.mysql.database}_staging`
        }
      }
    };

    return envConfigs[env] || envConfigs[this.ENVIRONMENTS.DEVELOPMENT];
  }

  // Static validation
  static validate() {
    const errors = [];

    if (!this.security.jwt.secret || this.security.jwt.secret === 'default-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production environment');
    }

    if (this.config.environment === this.ENVIRONMENTS.PRODUCTION) {
      if (!process.env.DB_PASSWORD) {
        errors.push('DB_PASSWORD is required in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
}

// ## 2. Static Cache & Registry Management

// Cache Manager with Static Properties
class CacheManager {
  // Static cache stores
  static caches = new Map();
  
  // Static cache configuration
  static defaultTTL = 5 * 60 * 1000; // 5 minutes
  static maxMemoryUsage = process.env.CACHE_MAX_MEMORY || 100 * 1024 * 1024; // 100MB
  
  // Static cache statistics
  static stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    memoryUsage: 0,
    lastCleanup: Date.now()
  };

  // Static cache types
  static CACHE_TYPES = {
    USER: 'user',
    SESSION: 'session',
    PERMISSION: 'permission',
    CONFIG: 'config',
    RATE_LIMIT: 'rate_limit'
  };

  // Static initialization flag
  static initialized = false;

  // Static initialization method
  static initialize() {
    if (this.initialized) {
      return;
    }

    // Initialize cache stores for different types
    for (const type of Object.values(this.CACHE_TYPES)) {
      this.caches.set(type, new Map());
    }

    // Start cleanup interval
    this.startCleanupInterval();
    
    this.initialized = true;
    console.log('CacheManager initialized');
  }

  // Static cache operations
  static set(cacheType, key, value, ttl = this.defaultTTL) {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.caches.has(cacheType)) {
      throw new Error(`Invalid cache type: ${cacheType}`);
    }

    const cache = this.caches.get(cacheType);
    const expiresAt = Date.now() + ttl;

    cache.set(key, {
      value,
      expiresAt,
      size: this.calculateSize(value)
    });

    this.stats.sets++;
    this.stats.memoryUsage += this.calculateSize(value);

    return true;
  }

  static get(cacheType, key) {
    if (!this.initialized || !this.caches.has(cacheType)) {
      this.stats.misses++;
      return null;
    }

    const cache = this.caches.get(cacheType);
    const cached = cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    if (cached.expiresAt < Date.now()) {
      cache.delete(key);
      this.stats.misses++;
      this.stats.memoryUsage -= cached.size;
      return null;
    }

    this.stats.hits++;
    return cached.value;
  }

  static delete(cacheType, key) {
    if (!this.initialized || !this.caches.has(cacheType)) {
      return false;
    }

    const cache = this.caches.get(cacheType);
    const cached = cache.get(key);
    
    if (cached) {
      this.stats.memoryUsage -= cached.size;
    }

    const deleted = cache.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
    }

    return deleted;
  }

  static clear(cacheType = null) {
    if (!this.initialized) {
      return;
    }

    if (cacheType) {
      const cache = this.caches.get(cacheType);
      if (cache) {
        cache.clear();
      }
    } else {
      for (const cache of this.caches.values()) {
        cache.clear();
      }
    }

    this.stats.memoryUsage = 0;
  }

  // Static utility methods
  static calculateSize(obj) {
    return Buffer.from(JSON.stringify(obj)).length;
  }

  static startCleanupInterval(interval = 60000) { // 1 minute
    setInterval(() => {
      this.cleanupExpired();
    }, interval);
  }

  static cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [cacheType, cache] of this.caches.entries()) {
      for (const [key, value] of cache.entries()) {
        if (value.expiresAt < now) {
          cache.delete(key);
          this.stats.memoryUsage -= value.size;
          cleaned++;
        }
      }
    }

    this.stats.lastCleanup = now;
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  // Static statistics methods
  static getStats() {
    const cacheSizes = {};
    
    for (const [cacheType, cache] of this.caches.entries()) {
      cacheSizes[cacheType] = cache.size;
    }

    return {
      ...this.stats,
      cacheSizes,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memoryUsageMB: (this.stats.memoryUsage / 1024 / 1024).toFixed(2)
    };
  }

  static isMemoryLimitExceeded() {
    return this.stats.memoryUsage > this.maxMemoryUsage;
  }
}

// ## 3. Static Service Registry & Dependency Container

// Service Container with Static Properties
class ServiceContainer {
  // Static service registry
  static services = new Map();
  static factories = new Map();
  static singletons = new Map();
  
  // Static service states
  static states = new Map();
  
  // Static service lifecycle constants
  static SERVICE_STATES = {
    UNREGISTERED: 'unregistered',
    REGISTERED: 'registered',
    RESOLVING: 'resolving',
    RESOLVED: 'resolved',
    INITIALIZING: 'initializing',
    INITIALIZED: 'initialized',
    DESTROYING: 'destroying',
    DESTROYED: 'destroyed',
    ERROR: 'error'
  };

  // Static service metadata
  static metadata = new Map();

  // Static service registration
  static register(name, ServiceClass, options = {}) {
    const { 
      dependencies = [], 
      singleton = true, 
      lazy = true,
      initializationTimeout = 30000 
    } = options;

    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this.services.set(name, {
      ServiceClass,
      dependencies,
      singleton,
      lazy,
      initializationTimeout
    });

    this.states.set(name, this.SERVICE_STATES.REGISTERED);
    this.metadata.set(name, {
      registeredAt: new Date(),
      initializedAt: null,
      initializationDuration: null,
      error: null
    });

    console.log(`Registered service: ${name}`);
  }

  // Static service resolution
  static get(name) {
    const serviceInfo = this.services.get(name);
    
    if (!serviceInfo) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Check if singleton already exists
    if (serviceInfo.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Update state
    this.states.set(name, this.SERVICE_STATES.RESOLVING);

    try {
      // Resolve dependencies
      const dependencies = {};
      for (const depName of serviceInfo.dependencies) {
        dependencies[depName] = this.get(depName);
      }

      // Create service instance
      const service = new serviceInfo.ServiceClass(dependencies);
      
      // Store singleton if applicable
      if (serviceInfo.singleton) {
        this.singletons.set(name, service);
      }

      this.states.set(name, this.SERVICE_STATES.RESOLVED);
      
      return service;
    } catch (error) {
      this.states.set(name, this.SERVICE_STATES.ERROR);
      this.metadata.get(name).error = error;
      throw error;
    }
  }

  // Static service initialization
  static async initializeService(name) {
    const service = this.get(name);
    const serviceInfo = this.services.get(name);
    const metadata = this.metadata.get(name);

    if (this.states.get(name) === this.SERVICE_STATES.INITIALIZED) {
      return service;
    }

    this.states.set(name, this.SERVICE_STATES.INITIALIZING);
    const startTime = Date.now();

    try {
      if (typeof service.initialize === 'function') {
        await Promise.race([
          service.initialize(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Initialization timeout for service '${name}'`)), 
            serviceInfo.initializationTimeout)
          )
        ]);
      }

      this.states.set(name, this.SERVICE_STATES.INITIALIZED);
      
      const endTime = Date.now();
      metadata.initializedAt = new Date();
      metadata.initializationDuration = endTime - startTime;

      console.log(`Initialized service: ${name} (${metadata.initializationDuration}ms)`);
      
      return service;
    } catch (error) {
      this.states.set(name, this.SERVICE_STATES.ERROR);
      metadata.error = error;
      throw error;
    }
  }

  // Static bulk initialization
  static async initializeAll() {
    const initializationOrder = this.getInitializationOrder();
    const results = [];

    for (const serviceName of initializationOrder) {
      try {
        const service = await this.initializeService(serviceName);
        results.push({ service: serviceName, status: 'success', serviceInstance: service });
      } catch (error) {
        results.push({ service: serviceName, status: 'error', error: error.message });
      }
    }

    return results;
  }

  // Static dependency graph analysis
  static getInitializationOrder() {
    const graph = new Map();
    const visited = new Set();
    const order = [];

    // Build dependency graph
    for (const [name, serviceInfo] of this.services.entries()) {
      graph.set(name, new Set(serviceInfo.dependencies));
    }

    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const dependencies = graph.get(node) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }

      order.push(node);
    };

    for (const node of graph.keys()) {
      visit(node);
    }

    return order;
  }

  // Static service destruction
  static async destroyService(name) {
    const service = this.singletons.get(name);
    
    if (!service) {
      return;
    }

    this.states.set(name, this.SERVICE_STATES.DESTROYING);

    try {
      if (typeof service.destroy === 'function') {
        await service.destroy();
      }

      this.singletons.delete(name);
      this.states.set(name, this.SERVICE_STATES.DESTROYED);

      console.log(`Destroyed service: ${name}`);
    } catch (error) {
      this.states.set(name, this.SERVICE_STATES.ERROR);
      console.error(`Error destroying service '${name}':`, error);
    }
  }

  // Static health check
  static async healthCheck() {
    const results = [];

    for (const [name, service] of this.singletons.entries()) {
      const state = this.states.get(name);
      const metadata = this.metadata.get(name);

      try {
        let health = { status: state };
        
        if (state === this.SERVICE_STATES.INITIALIZED && typeof service.healthCheck === 'function') {
          const serviceHealth = await service.healthCheck();
          health = { ...health, ...serviceHealth };
        }

        if (metadata.error) {
          health.error = metadata.error.message;
        }

        results.push({ service: name, ...health });
      } catch (error) {
        results.push({ 
          service: name, 
          status: this.SERVICE_STATES.ERROR, 
          error: error.message 
        });
      }
    }

    return results;
  }

  // Static utility methods
  static getServiceState(name) {
    return this.states.get(name) || this.SERVICE_STATES.UNREGISTERED;
  }

  static isServiceInitialized(name) {
    return this.states.get(name) === this.SERVICE_STATES.INITIALIZED;
  }

  static getRegisteredServices() {
    return Array.from(this.services.keys());
  }

  static getServiceMetadata(name) {
    return this.metadata.get(name) || {};
  }
}

// ## 4. Static Logger Configuration

// Logger with Static Configuration
class Logger {
  // Static log levels
  static LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  };

  // Static log level names
  static LEVEL_NAMES = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG',
    4: 'TRACE'
  };

  // Static configuration
  static config = {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: true,
    colors: true,
    json: process.env.NODE_ENV === 'production',
    file: {
      enabled: process.env.LOG_TO_FILE === 'true',
      path: process.env.LOG_FILE_PATH || './logs/app.log',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '7d'
    }
  };

  // Static transports
  static transports = [];

  // Static initialization
  static initialized = false;

  // Static initialization method
  static initialize() {
    if (this.initialized) {
      return;
    }

    // Console transport
    this.transports.push({
      type: 'console',
      write: (level, message, meta) => {
        const timestamp = this.config.timestamp ? new Date().toISOString() : '';
        const levelName = this.LEVEL_NAMES[level];
        
        if (this.config.json) {
          console.log(JSON.stringify({
            timestamp,
            level: levelName,
            message,
            ...meta
          }));
        } else {
          const color = this.getColorForLevel(level);
          console.log(`${timestamp} [${levelName}] ${message}`, meta || '');
        }
      }
    });

    // File transport (if enabled)
    if (this.config.file.enabled) {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure log directory exists
      const logDir = path.dirname(this.config.file.path);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.transports.push({
        type: 'file',
        write: (level, message, meta) => {
          const timestamp = new Date().toISOString();
          const levelName = this.LEVEL_NAMES[level];
          const logEntry = JSON.stringify({
            timestamp,
            level: levelName,
            message,
            ...meta
          }) + '\n';

          fs.appendFileSync(this.config.file.path, logEntry);
        }
      });
    }

    this.initialized = true;
  }

  // Static logging methods
  static log(level, message, meta = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    const currentLevel = this.LEVELS[this.config.level.toUpperCase()] || this.LEVELS.INFO;
    
    if (level <= currentLevel) {
      for (const transport of this.transports) {
        try {
          transport.write(level, message, meta);
        } catch (error) {
          console.error('Logging transport error:', error);
        }
      }
    }
  }

  static error(message, meta = {}) {
    this.log(this.LEVELS.ERROR, message, meta);
  }

  static warn(message, meta = {}) {
    this.log(this.LEVELS.WARN, message, meta);
  }

  static info(message, meta = {}) {
    this.log(this.LEVELS.INFO, message, meta);
  }

  static debug(message, meta = {}) {
    this.log(this.LEVELS.DEBUG, message, meta);
  }

  static trace(message, meta = {}) {
    this.log(this.LEVELS.TRACE, message, meta);
  }

  // Static utility methods
  static getColorForLevel(level) {
    const colors = {
      [this.LEVELS.ERROR]: '\x1b[31m', // Red
      [this.LEVELS.WARN]: '\x1b[33m',  // Yellow
      [this.LEVELS.INFO]: '\x1b[36m',  // Cyan
      [this.LEVELS.DEBUG]: '\x1b[35m', // Magenta
      [this.LEVELS.TRACE]: '\x1b[90m'  // Gray
    };
    
    return colors[level] || '\x1b[0m';
  }

  static setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (this.LEVELS[upperLevel] !== undefined) {
      this.config.level = level;
    } else {
      throw new Error(`Invalid log level: ${level}`);
    }
  }

  // Static request logging middleware
  static requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const meta = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        };

        if (res.statusCode >= 500) {
          this.error(`${req.method} ${req.url} ${res.statusCode}`, meta);
        } else if (res.statusCode >= 400) {
          this.warn(`${req.method} ${req.url} ${res.statusCode}`, meta);
        } else {
          this.info(`${req.method} ${req.url} ${res.statusCode}`, meta);
        }
      });

      next();
    };
  }
}

// ## 5. Static Rate Limiting & Security

// Rate Limiter with Static Properties
class RateLimiter {
  // Static rate limit stores
  static limits = new Map();
  
  // Static default configuration
  static defaultConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  // Static rate limit types
  static RATE_LIMIT_TYPES = {
    GLOBAL: 'global',
    AUTH: 'auth',
    API: 'api',
    UPLOAD: 'upload'
  };

  // Static configuration for different limit types
  static rateLimitConfigs = {
    [this.RATE_LIMIT_TYPES.GLOBAL]: {
      windowMs: 15 * 60 * 1000,
      max: 1000
    },
    [this.RATE_LIMIT_TYPES.AUTH]: {
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: 'Too many authentication attempts, please try again later.'
    },
    [this.RATE_LIMIT_TYPES.API]: {
      windowMs: 60 * 1000, // 1 minute
      max: 60
    },
    [this.RATE_LIMIT_TYPES.UPLOAD]: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 10,
      message: 'Too many uploads, please try again later.'
    }
  };

  // Static statistics
  static stats = {
    totalRequests: 0,
    blockedRequests: 0,
    byType: new Map()
  };

  // Static middleware generator
  static createMiddleware(type = this.RATE_LIMIT_TYPES.GLOBAL, customConfig = {}) {
    const config = { ...this.rateLimitConfigs[type], ...customConfig };
    
    return (req, res, next) => {
      const key = this.getKey(req, type);
      const now = Date.now();
      
      // Initialize if not exists
      if (!this.limits.has(key)) {
        this.limits.set(key, {
          requests: 0,
          resetTime: now + config.windowMs,
          firstRequest: now
        });
      }

      const limit = this.limits.get(key);
      this.stats.totalRequests++;

      // Reset if window has passed
      if (now > limit.resetTime) {
        limit.requests = 0;
        limit.resetTime = now + config.windowMs;
        limit.firstRequest = now;
      }

      // Check if limit exceeded
      if (limit.requests >= config.max) {
        this.stats.blockedRequests++;
        
        // Update type-specific stats
        const typeStats = this.stats.byType.get(type) || { blocked: 0, total: 0 };
        typeStats.blocked++;
        typeStats.total++;
        this.stats.byType.set(type, typeStats);

        return res.status(config.statusCode).json({
          error: config.message,
          retryAfter: Math.ceil((limit.resetTime - now) / 1000)
        });
      }

      // Increment request count
      limit.requests++;

      // Update type-specific stats
      const typeStats = this.stats.byType.get(type) || { blocked: 0, total: 0 };
      typeStats.total++;
      this.stats.byType.set(type, typeStats);

      // Set headers
      res.set({
        'X-RateLimit-Limit': config.max,
        'X-RateLimit-Remaining': Math.max(0, config.max - limit.requests),
        'X-RateLimit-Reset': Math.ceil(limit.resetTime / 1000)
      });

      next();
    };
  }

  // Static key generation
  static getKey(req, type) {
    const identifier = req.ip || req.connection.remoteAddress;
    return `${type}:${identifier}`;
  }

  // Static cleanup method
  static cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // Static statistics method
  static getStats() {
    const typeStats = {};
    
    for (const [type, stats] of this.stats.byType.entries()) {
      typeStats[type] = {
        ...stats,
        blockRate: stats.blocked / stats.total || 0
      };
    }

    return {
      totalRequests: this.stats.totalRequests,
      blockedRequests: this.stats.blockedRequests,
      blockRate: this.stats.blockedRequests / this.stats.totalRequests || 0,
      activeLimits: this.limits.size,
      byType: typeStats
    };
  }

  // Static method to reset specific limit
  static reset(key) {
    return this.limits.delete(key);
  }

  // Static method to get current limit info
  static getLimitInfo(key) {
    return this.limits.get(key);
  }
}

// Security Headers Manager
class SecurityHeaders {
  // Static security headers configuration
  static headers = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };

  // Static environment-specific overrides
  static environmentOverrides = {
    development: {
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval';"
    },
    production: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }
  };

  // Static middleware
  static middleware() {
    return (req, res, next) => {
      const environment = process.env.NODE_ENV || 'development';
      const environmentHeaders = this.environmentOverrides[environment] || {};
      const finalHeaders = { ...this.headers, ...environmentHeaders };

      for (const [header, value] of Object.entries(finalHeaders)) {
        res.setHeader(header, value);
      }

      next();
    };
  }

  // Static method to add custom headers
  static addHeader(name, value) {
    this.headers[name] = value;
  }

  // Static method to remove header
  static removeHeader(name) {
    delete this.headers[name];
  }
}

// ## 6. Production Application Setup

// Production Application with Static Properties
class ProductionApp {
  // Static application state
  static state = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    SHUTTING_DOWN: 'shutting_down',
    TERMINATED: 'terminated'
  };

  // Static application components
  static components = {
    server: null,
    database: null,
    cache: null,
    services: null
  };

  // Static application metrics
  static metrics = {
    startTime: null,
    uptime: 0,
    totalRequests: 0,
    errorCount: 0,
    memoryUsage: null
  };

  // Static initialization
  static async initialize() {
    this.metrics.startTime = new Date();
    
    console.log('Initializing production application...');

    try {
      // 1. Initialize configuration
      AppConfig.validate();

      // 2. Initialize cache
      CacheManager.initialize();

      // 3. Register services
      this.registerServices();

      // 4. Initialize services
      await ServiceContainer.initializeAll();

      // 5. Start server
      await this.startServer();

      // 6. Start background tasks
      this.startBackgroundTasks();

      // Update state
      this.updateUptime();
      
      console.log('Production application initialized successfully');
      
    } catch (error) {
      console.error('Application initialization failed:', error);
      await this.shutdown(1);
    }
  }

  // Static service registration
  static registerServices() {
    // Database service
    ServiceContainer.register('database', DatabaseService, {
      dependencies: [],
      singleton: true,
      initializationTimeout: 30000
    });

    // User service
    ServiceContainer.register('userService', UserService, {
      dependencies: ['database', 'cache'],
      singleton: true
    });

    // Auth service
    ServiceContainer.register('authService', AuthService, {
      dependencies: ['database', 'userService'],
      singleton: true
    });
  }

  // Static server startup
  static async startServer() {
    const express = require('express');
    const app = express();

    // Security headers
    app.use(SecurityHeaders.middleware());

    // Rate limiting
    app.use(RateLimiter.createMiddleware(RateLimiter.RATE_LIMIT_TYPES.GLOBAL));
    app.use('/auth/', RateLimiter.createMiddleware(RateLimiter.RATE_LIMIT_TYPES.AUTH));

    // Request logging
    app.use(Logger.requestLogger());

    // Health check endpoint
    app.get('/health', this.healthCheckHandler);

    // Metrics endpoint
    app.get('/metrics', this.metricsHandler);

    const port = AppConfig.config.port;
    this.components.server = app.listen(port, () => {
      Logger.info(`Server started on port ${port}`);
    });

    return this.components.server;
  }

  // Static background tasks
  static startBackgroundTasks() {
    // Update uptime every second
    setInterval(() => {
      this.updateUptime();
    }, 1000);

    // Cleanup expired cache every minute
    setInterval(() => {
      CacheManager.cleanupExpired();
    }, 60000);

    // Cleanup expired rate limits every 5 minutes
    setInterval(() => {
      RateLimiter.cleanupExpired();
    }, 300000);

    // Log statistics every 10 minutes
    setInterval(() => {
      this.logStatistics();
    }, 600000);
  }

  // Static health check handler
  static async healthCheckHandler(req, res) {
    try {
      const health = await ServiceContainer.healthCheck();
      const cacheStats = CacheManager.getStats();
      const rateLimitStats = RateLimiter.getStats();

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: ProductionApp.metrics.uptime,
        services: health,
        cache: cacheStats,
        rateLimiting: rateLimitStats,
        memory: process.memoryUsage()
      };

      // Check if any service is unhealthy
      const unhealthyServices = health.filter(service => service.status !== 'initialized');
      if (unhealthyServices.length > 0) {
        healthStatus.status = 'unhealthy';
        healthStatus.unhealthyServices = unhealthyServices;
        return res.status(503).json(healthStatus);
      }

      res.json(healthStatus);
    } catch (error) {
      Logger.error('Health check failed:', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  // Static metrics handler
  static metricsHandler(req, res) {
    const metrics = {
      uptime: ProductionApp.metrics.uptime,
      memory: process.memoryUsage(),
      cache: CacheManager.getStats(),
      rateLimiting: RateLimiter.getStats(),
      services: {
        registered: ServiceContainer.getRegisteredServices().length,
        initialized: ServiceContainer.getRegisteredServices().filter(
          name => ServiceContainer.isServiceInitialized(name)
        ).length
      }
    };

    res.json(metrics);
  }

  // Static utility methods
  static updateUptime() {
    if (this.metrics.startTime) {
      this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
    }
  }

  static logStatistics() {
    const cacheStats = CacheManager.getStats();
    const rateLimitStats = RateLimiter.getStats();

    Logger.info('Application statistics', {
      uptime: Math.floor(this.metrics.uptime / 1000),
      cache: cacheStats,
      rateLimiting: rateLimitStats,
      memory: process.memoryUsage()
    });
  }

  // Static graceful shutdown
  static async shutdown(exitCode = 0) {
    Logger.info('Initiating graceful shutdown...');

    try {
      // Stop accepting new connections
      if (this.components.server) {
        this.components.server.close(() => {
          Logger.info('HTTP server closed');
        });
      }

      // Destroy services
      await ServiceContainer.destroyAll();

      // Clear caches
      CacheManager.clear();

      Logger.info('Graceful shutdown completed');
      
      process.exit(exitCode);
    } catch (error) {
      Logger.error('Shutdown error:', { error: error.message });
      process.exit(1);
    }
  }
}

// Application startup
if (require.main === module) {
  // Setup graceful shutdown
  process.on('SIGTERM', () => ProductionApp.shutdown());
  process.on('SIGINT', () => ProductionApp.shutdown());

  // Start the application
  ProductionApp.initialize().catch(error => {
    console.error('Application startup failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionApp;

// ## Key Benefits in Production:

// 1. **Centralized Configuration**: Single source of truth for all configurations
// 2. **Global State Management**: Shared state across application instances
// 3. **Memory Efficiency**: Singleton patterns reduce memory footprint
// 4. **Performance Monitoring**: Built-in metrics and statistics
// 5. **Resource Management**: Efficient cache and connection management
// 6. **Security**: Centralized security headers and rate limiting
// 7. **Monitoring**: Comprehensive health checks and logging
// 8. **Scalability**: Statically managed resources scale efficiently

// These patterns ensure your Node.js backend is production-ready with proper resource management, monitoring, and scalability considerations.





























// Here are comprehensive code snippets demonstrating `private fields` in Node.js production-grade backend development:

// ## 1. Private Fields in Database Models

// User Model with Private Fields
class User {
    // Private fields
    #id;
    #email;
    #passwordHash;
    #salt;
    #failedLoginAttempts;
    #lockedUntil;
    #createdAt;
    #updatedAt;

    constructor(userData) {
        this.#id = userData.id || this.#generateId();
        this.#email = userData.email;
        this.#passwordHash = userData.passwordHash;
        this.#salt = userData.salt || this.#generateSalt();
        this.#failedLoginAttempts = userData.failedLoginAttempts || 0;
        this.#lockedUntil = userData.lockedUntil || null;
        this.#createdAt = userData.createdAt || new Date();
        this.#updatedAt = userData.updatedAt || new Date();
        
        this.#validateUserData();
    }

    // Private validation method
    #validateUserData() {
        if (!this.#email || !this.#isValidEmail(this.#email)) {
            throw new Error('Invalid email address');
        }

        if (this.#passwordHash && this.#passwordHash.length < 64) {
            throw new Error('Invalid password hash');
        }
    }

    // Private utility methods
    #generateId() {
        const crypto = require('crypto');
        return crypto.randomUUID();
    }

    #generateSalt() {
        const crypto = require('crypto');
        return crypto.randomBytes(16).toString('hex');
    }

    #isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    #hashPassword(password) {
        const crypto = require('crypto');
        return crypto
            .pbkdf2Sync(password, this.#salt, 1000, 64, 'sha512')
            .toString('hex');
    }

    #updateTimestamp() {
        this.#updatedAt = new Date();
    }

    // Public methods with controlled access
    getId() {
        return this.#id;
    }

    getEmail() {
        return this.#email;
    }

    setEmail(newEmail) {
        if (!this.#isValidEmail(newEmail)) {
            throw new Error('Invalid email address');
        }
        this.#email = newEmail;
        this.#updateTimestamp();
    }

    verifyPassword(password) {
        if (this.#isAccountLocked()) {
            throw new Error('Account is temporarily locked due to too many failed attempts');
        }

        const inputHash = this.#hashPassword(password);
        const isValid = inputHash === this.#passwordHash;

        if (!isValid) {
            this.#recordFailedLogin();
            throw new Error('Invalid password');
        }

        // Reset failed attempts on successful login
        this.#failedLoginAttempts = 0;
        this.#lockedUntil = null;
        this.#updateTimestamp();

        return true;
    }

    changePassword(oldPassword, newPassword) {
        if (!this.verifyPassword(oldPassword)) {
            throw new Error('Current password is incorrect');
        }

        this.#setPassword(newPassword);
        this.#updateTimestamp();
    }

    // Private security methods
    #setPassword(newPassword) {
        if (newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        this.#passwordHash = this.#hashPassword(newPassword);
    }

    #recordFailedLogin() {
        this.#failedLoginAttempts++;
        
        if (this.#failedLoginAttempts >= 5) {
            // Lock account for 30 minutes after 5 failed attempts
            this.#lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        
        this.#updateTimestamp();
    }

    #isAccountLocked() {
        if (!this.#lockedUntil) return false;
        
        if (Date.now() > this.#lockedUntil.getTime()) {
            // Lock period has expired
            this.#failedLoginAttempts = 0;
            this.#lockedUntil = null;
            return false;
        }
        
        return true;
    }

    // Safe serialization for API responses
    toJSON() {
        return {
            id: this.#id,
            email: this.#email,
            createdAt: this.#createdAt,
            updatedAt: this.#updatedAt,
            // Never expose password hash, salt, or security fields
        };
    }

    getSecurityStatus() {
        return {
            failedLoginAttempts: this.#failedLoginAttempts,
            isLocked: this.#isAccountLocked(),
            lockedUntil: this.#lockedUntil
        };
    }

    resetLoginAttempts() {
        this.#failedLoginAttempts = 0;
        this.#lockedUntil = null;
        this.#updateTimestamp();
    }
}

// User Factory with Private Fields
class UserFactory {
    // Private static field for factory configuration
    static #defaultConfig = {
        passwordMinLength: 8,
        requireSpecialChars: true,
        maxUsersPerHour: 1000
    };

    // Private instance counter
    static #usersCreated = 0;
    static #lastCreationTime = Date.now();

    static createUser(email, password) {
        // Rate limiting
        this.#checkCreationRate();

        // Validate inputs
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        if (password.length < this.#defaultConfig.passwordMinLength) {
            throw new Error(`Password must be at least ${this.#defaultConfig.passwordMinLength} characters long`);
        }

        // Create salt and hash password
        const crypto = require('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto
            .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
            .toString('hex');

        const user = new User({
            email,
            passwordHash,
            salt
        });

        this.#usersCreated++;
        this.#lastCreationTime = Date.now();

        return user;
    }

    static #checkCreationRate() {
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        
        // Simple rate limiting - in production, use a more sophisticated approach
        if (this.#usersCreated > this.#defaultConfig.maxUsersPerHour && 
            this.#lastCreationTime > hourAgo) {
            throw new Error('Rate limit exceeded for user creation');
        }

        // Reset counter if last creation was more than an hour ago
        if (this.#lastCreationTime < hourAgo) {
            this.#usersCreated = 0;
        }
    }

    static getCreationStats() {
        return {
            usersCreated: this.#usersCreated,
            lastCreationTime: this.#lastCreationTime
        };
    }
}

// ## 2. Private Fields in Service Classes

// Authentication Service with Private Fields
class AuthenticationService {
    // Private fields for sensitive data and dependencies
    #jwtSecret;
    #tokenExpiry;
    #refreshTokenExpiry;
    #userRepository;
    #blacklistedTokens;
    #rateLimiter;

    constructor(userRepository, config = {}) {
        this.#userRepository = userRepository;
        this.#jwtSecret = config.jwtSecret || process.env.JWT_SECRET;
        this.#tokenExpiry = config.tokenExpiry || '15m';
        this.#refreshTokenExpiry = config.refreshTokenExpiry || '7d';
        this.#blacklistedTokens = new Map();
        this.#rateLimiter = new Map();

        if (!this.#jwtSecret) {
            throw new Error('JWT secret is required');
        }
    }

    // Private JWT methods
    #generateToken(payload, expiresIn) {
        const jwt = require('jsonwebtoken');
        return jwt.sign(payload, this.#jwtSecret, { expiresIn });
    }

    #verifyToken(token) {
        const jwt = require('jsonwebtoken');
        
        // Check if token is blacklisted
        if (this.#isTokenBlacklisted(token)) {
            throw new Error('Token has been revoked');
        }

        return jwt.verify(token, this.#jwtSecret);
    }

    #isTokenBlacklisted(token) {
        const blacklisted = this.#blacklistedTokens.get(token);
        
        if (blacklisted && blacklisted.expiresAt > Date.now()) {
            return true;
        }
        
        // Clean up expired blacklisted tokens
        if (blacklisted && blacklisted.expiresAt <= Date.now()) {
            this.#blacklistedTokens.delete(token);
        }
        
        return false;
    }

    // Private rate limiting
    #checkRateLimit(identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        const now = Date.now();
        const key = `rate_limit:${identifier}`;
        
        if (!this.#rateLimiter.has(key)) {
            this.#rateLimiter.set(key, {
                attempts: 1,
                firstAttempt: now,
                windowStart: now
            });
            return true;
        }

        const limit = this.#rateLimiter.get(key);
        
        // Reset if window has passed
        if (now - limit.windowStart > windowMs) {
            limit.attempts = 1;
            limit.windowStart = now;
            return true;
        }

        // Check if limit exceeded
        if (limit.attempts >= maxAttempts) {
            return false;
        }

        limit.attempts++;
        return true;
    }

    #cleanupRateLimiter() {
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
        
        for (const [key, limit] of this.#rateLimiter.entries()) {
            if (now - limit.windowStart > windowMs) {
                this.#rateLimiter.delete(key);
            }
        }
    }

    // Public authentication methods
    async login(email, password, ipAddress) {
        // Rate limiting by IP and email
        const ipKey = `login:ip:${ipAddress}`;
        const emailKey = `login:email:${email}`;
        
        if (!this.#checkRateLimit(ipKey) || !this.#checkRateLimit(emailKey)) {
            throw new Error('Too many login attempts. Please try again later.');
        }

        // Find user
        const user = await this.#userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password using user's method
        try {
            user.verifyPassword(password);
        } catch (error) {
            throw new Error('Invalid credentials');
        }

        // Generate tokens
        const accessToken = this.#generateAccessToken(user);
        const refreshToken = this.#generateRefreshToken(user);

        // Log successful login
        this.#logAuthentication('LOGIN_SUCCESS', user.getId(), ipAddress);

        return {
            accessToken,
            refreshToken,
            user: user.toJSON()
        };
    }

    async refreshToken(refreshToken, ipAddress) {
        try {
            const decoded = this.#verifyToken(refreshToken);
            
            // Verify it's a refresh token
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Get user
            const user = await this.#userRepository.findById(decoded.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Generate new tokens
            const newAccessToken = this.#generateAccessToken(user);
            const newRefreshToken = this.#generateRefreshToken(user);

            // Blacklist old refresh token
            this.#blacklistToken(refreshToken, decoded.exp * 1000);

            this.#logAuthentication('TOKEN_REFRESH', user.getId(), ipAddress);

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };

        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async logout(accessToken, refreshToken, ipAddress) {
        try {
            const decoded = this.#verifyToken(accessToken);
            
            // Blacklist both tokens
            this.#blacklistToken(accessToken, decoded.exp * 1000);
            
            if (refreshToken) {
                const refreshDecoded = this.#verifyToken(refreshToken);
                this.#blacklistToken(refreshToken, refreshDecoded.exp * 1000);
            }

            this.#logAuthentication('LOGOUT', decoded.userId, ipAddress);

            return true;
        } catch (error) {
            // Even if token is invalid, consider it logged out
            return true;
        }
    }

    verifyAccessToken(token) {
        try {
            const decoded = this.#verifyToken(token);
            
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            throw new Error('Invalid access token');
        }
    }

    // Private token generation methods
    #generateAccessToken(user) {
        const payload = {
            userId: user.getId(),
            email: user.getEmail(),
            type: 'access',
            iat: Math.floor(Date.now() / 1000)
        };

        return this.#generateToken(payload, this.#tokenExpiry);
    }

    #generateRefreshToken(user) {
        const payload = {
            userId: user.getId(),
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000)
        };

        return this.#generateToken(payload, this.#refreshTokenExpiry);
    }

    #blacklistToken(token, expiresAt) {
        this.#blacklistedTokens.set(token, { expiresAt });
    }

    // Private logging
    #logAuthentication(event, userId, ipAddress) {
        console.log(`[AUTH] ${event} - User: ${userId}, IP: ${ipAddress}, Time: ${new Date().toISOString()}`);
    }

    // Cleanup method
    cleanup() {
        this.#cleanupRateLimiter();
        
        // Clean up expired blacklisted tokens
        const now = Date.now();
        for (const [token, data] of this.#blacklistedTokens.entries()) {
            if (data.expiresAt <= now) {
                this.#blacklistedTokens.delete(token);
            }
        }
    }
}

// ## 3. Private Fields in Repository Pattern

// Base Repository with Private Fields
class BaseRepository {
    // Private fields for database connection and configuration
    #database;
    #collectionName;
    #queryLogger;
    #maxQueryTime;
    #cache;

    constructor(database, collectionName, config = {}) {
        this.#database = database;
        this.#collectionName = collectionName;
        this.#queryLogger = config.queryLogger || console;
        this.#maxQueryTime = config.maxQueryTime || 30000; // 30 seconds
        this.#cache = new Map();
    }

    // Private database methods
    async #executeQuery(operation, query, options = {}) {
        const startTime = Date.now();
        const queryId = this.#generateQueryId();
        
        try {
            this.#logQueryStart(queryId, operation, query);
            
            // Set timeout for query
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), this.#maxQueryTime);
            });

            const queryPromise = this.#database
                .collection(this.#collectionName)
                [operation](query, options);

            const result = await Promise.race([queryPromise, timeoutPromise]);
            
            const duration = Date.now() - startTime;
            this.#logQuerySuccess(queryId, operation, duration);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.#logQueryError(queryId, operation, error, duration);
            throw error;
        }
    }

    // Private caching methods
    #getCacheKey(operation, query) {
        return `${operation}:${JSON.stringify(query)}`;
    }

    #setCache(key, value, ttl = 60000) { // 1 minute default TTL
        this.#cache.set(key, {
            value,
            expiresAt: Date.now() + ttl
        });
    }

    #getCache(key) {
        const cached = this.#cache.get(key);
        
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }
        
        if (cached) {
            this.#cache.delete(key); // Remove expired cache
        }
        
        return null;
    }

    #clearCache(pattern = null) {
        if (pattern) {
            for (const [key] of this.#cache.entries()) {
                if (key.includes(pattern)) {
                    this.#cache.delete(key);
                }
            }
        } else {
            this.#cache.clear();
        }
    }

    // Private logging methods
    #generateQueryId() {
        return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    #logQueryStart(queryId, operation, query) {
        this.#queryLogger.debug(`[QUERY_START] ${queryId} - ${operation}`, {
            collection: this.#collectionName,
            query: this.#sanitizeQuery(query)
        });
    }

    #logQuerySuccess(queryId, operation, duration) {
        this.#queryLogger.debug(`[QUERY_SUCCESS] ${queryId} - ${operation} - ${duration}ms`);
    }

    #logQueryError(queryId, operation, error, duration) {
        this.#queryLogger.error(`[QUERY_ERROR] ${queryId} - ${operation} - ${duration}ms`, {
            error: error.message,
            stack: error.stack
        });
    }

    #sanitizeQuery(query) {
        // Remove sensitive data from logs
        const sanitized = { ...query };
        
        if (sanitized.password) {
            sanitized.password = '***';
        }
        
        if (sanitized.token) {
            sanitized.token = '***';
        }
        
        return sanitized;
    }

    // Protected methods for subclasses (using getters to simulate protected access)
    get _collection() {
        return this.#database.collection(this.#collectionName);
    }

    get _cache() {
        return {
            get: (key) => this.#getCache(key),
            set: (key, value, ttl) => this.#setCache(key, value, ttl),
            clear: (pattern) => this.#clearCache(pattern)
        };
    }
}

// User Repository with Private Fields
class UserRepository extends BaseRepository {
    #emailIndexCreated = false;

    constructor(database) {
        super(database, 'users', {
            maxQueryTime: 10000, // 10 seconds for user queries
            queryLogger: require('./logger')
        });
    }

    async #ensureIndexes() {
        if (!this.#emailIndexCreated) {
            await this._collection.createIndex({ email: 1 }, { unique: true });
            this.#emailIndexCreated = true;
        }
    }

    async findByEmail(email, useCache = true) {
        await this.#ensureIndexes();

        const cacheKey = this._cache.get(`findByEmail:${email}`);
        
        if (useCache) {
            const cached = this._cache.get(cacheKey);
            if (cached) return cached;
        }

        const userDoc = await this._collection.findOne({ email });
        
        if (userDoc && useCache) {
            this._cache.set(cacheKey, userDoc, 30000); // Cache for 30 seconds
        }

        return userDoc;
    }

    async findById(id, useCache = true) {
        const cacheKey = this._cache.get(`findById:${id}`);
        
        if (useCache) {
            const cached = this._cache.get(cacheKey);
            if (cached) return cached;
        }

        const userDoc = await this._collection.findOne({ _id: id });
        
        if (userDoc && useCache) {
            this._cache.set(cacheKey, userDoc, 60000); // Cache for 1 minute
        }

        return userDoc;
    }

    async create(userData) {
        await this.#ensureIndexes();

        const userDoc = {
            _id: userData.getId(),
            email: userData.getEmail(),
            passwordHash: userData.passwordHash, // This would be accessed via getter in real implementation
            salt: userData.salt, // This would be accessed via getter in real implementation
            failedLoginAttempts: userData.getSecurityStatus().failedLoginAttempts,
            lockedUntil: userData.getSecurityStatus().lockedUntil,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await this._collection.insertOne(userDoc);
        
        // Clear relevant cache
        this._cache.clear('findByEmail:');
        this._cache.clear('findById:');

        return result.insertedId;
    }

    async update(userId, updateData) {
        const updateDoc = {
            $set: {
                ...updateData,
                updatedAt: new Date()
            }
        };

        const result = await this._collection.updateOne(
            { _id: userId },
            updateDoc
        );

        // Clear cache for this user
        this._cache.clear(`findById:${userId}`);
        this._cache.clear('findByEmail:');

        return result.modifiedCount;
    }

    async incrementFailedLoginAttempts(userId) {
        const result = await this._collection.updateOne(
            { _id: userId },
            {
                $inc: { failedLoginAttempts: 1 },
                $set: { updatedAt: new Date() }
            }
        );

        this._cache.clear(`findById:${userId}`);

        return result.modifiedCount;
    }

    async resetLoginAttempts(userId) {
        const result = await this._collection.updateOne(
            { _id: userId },
            {
                $set: {
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                    updatedAt: new Date()
                }
            }
        );

        this._cache.clear(`findById:${userId}`);

        return result.modifiedCount;
    }
}

// ## 4. Private Fields in Configuration Management

// Secure Configuration Manager with Private Fields
class SecureConfigManager {
    // Private fields for sensitive configuration
    #encryptionKey;
    #secrets = new Map();
    #encryptedConfigs = new Map();
    #configCache = new Map();
    #keyRotationInterval;

    constructor() {
        this.#encryptionKey = process.env.CONFIG_ENCRYPTION_KEY;
        this.#keyRotationInterval = setInterval(() => {
            this.#rotateKeys();
        }, 24 * 60 * 60 * 1000); // Rotate keys every 24 hours

        if (!this.#encryptionKey) {
            throw new Error('CONFIG_ENCRYPTION_KEY environment variable is required');
        }
    }

    // Private encryption methods
    #encrypt(value) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, this.#encryptionKey);
        cipher.setAAD(Buffer.from('config'));
        
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    #decrypt(encryptedData) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        
        const decipher = crypto.createDecipher(algorithm, this.#encryptionKey);
        decipher.setAAD(Buffer.from('config'));
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    #hashKey(key) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    // Private key management
    #rotateKeys() {
        console.log('Rotating configuration keys...');
        
        // Re-encrypt all secrets with new key
        for (const [key, encryptedValue] of this.#encryptedConfigs.entries()) {
            try {
                const decrypted = this.#decrypt(encryptedValue);
                this.#secrets.set(key, decrypted);
            } catch (error) {
                console.error(`Failed to decrypt ${key} during key rotation:`, error);
            }
        }
        
        // Update encryption key (in production, this would come from a secure source)
        this.#encryptionKey = this.#generateNewEncryptionKey();
        
        // Re-encrypt all secrets
        for (const [key, value] of this.#secrets.entries()) {
            this.#encryptedConfigs.set(key, this.#encrypt(value));
        }
        
        console.log('Key rotation completed');
    }

    #generateNewEncryptionKey() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex'); // 256-bit key
    }

    // Public methods for secure configuration access
    setSecret(key, value) {
        if (typeof value !== 'string') {
            throw new Error('Secret value must be a string');
        }

        const hashedKey = this.#hashKey(key);
        this.#secrets.set(hashedKey, value);
        this.#encryptedConfigs.set(hashedKey, this.#encrypt(value));
        this.#configCache.delete(hashedKey);
    }

    getSecret(key) {
        const hashedKey = this.#hashKey(key);
        
        // Check cache first
        if (this.#configCache.has(hashedKey)) {
            return this.#configCache.get(hashedKey);
        }

        // Get from secrets map
        if (this.#secrets.has(hashedKey)) {
            const value = this.#secrets.get(hashedKey);
            this.#configCache.set(hashedKey, value);
            return value;
        }

        // Try to decrypt if only encrypted version exists
        if (this.#encryptedConfigs.has(hashedKey)) {
            try {
                const encryptedValue = this.#encryptedConfigs.get(hashedKey);
                const value = this.#decrypt(encryptedValue);
                this.#secrets.set(hashedKey, value);
                this.#configCache.set(hashedKey, value);
                return value;
            } catch (error) {
                throw new Error(`Failed to decrypt secret: ${key}`);
            }
        }

        throw new Error(`Secret not found: ${key}`);
    }

    hasSecret(key) {
        const hashedKey = this.#hashKey(key);
        return this.#secrets.has(hashedKey) || this.#encryptedConfigs.has(hashedKey);
    }

    deleteSecret(key) {
        const hashedKey = this.#hashKey(key);
        this.#secrets.delete(hashedKey);
        this.#encryptedConfigs.delete(hashedKey);
        this.#configCache.delete(hashedKey);
    }

    // Bulk operations
    setSecrets(secrets) {
        for (const [key, value] of Object.entries(secrets)) {
            this.setSecret(key, value);
        }
    }

    getAllSecrets() {
        const secrets = {};
        
        for (const [hashedKey] of this.#secrets.entries()) {
            // In real implementation, you'd maintain a reverse mapping
            // For security, we don't expose the actual keys
            secrets[hashedKey] = '***';
        }
        
        return secrets;
    }

    // Security methods
    clearCache() {
        this.#configCache.clear();
    }

    clearAll() {
        this.#secrets.clear();
        this.#encryptedConfigs.clear();
        this.#configCache.clear();
    }

    // Memory management
    getMemoryUsage() {
        let totalSize = 0;
        
        for (const value of this.#secrets.values()) {
            totalSize += Buffer.from(value).length;
        }
        
        for (const value of this.#encryptedConfigs.values()) {
            totalSize += Buffer.from(JSON.stringify(value)).length;
        }
        
        for (const value of this.#configCache.values()) {
            totalSize += Buffer.from(value).length;
        }
        
        return {
            secretsCount: this.#secrets.size,
            encryptedCount: this.#encryptedConfigs.size,
            cacheCount: this.#configCache.size,
            totalMemory: `${(totalSize / 1024 / 1024).toFixed(2)} MB`
        };
    }

    // Cleanup
    destroy() {
        clearInterval(this.#keyRotationInterval);
        this.clearAll();
    }
}

// Database Configuration with Private Fields
class DatabaseConfig {
    #host;
    #port;
    #database;
    #username;
    #password;
    #poolConfig;
    #sslConfig;
    #isInitialized = false;

    constructor() {
        this.#loadFromEnvironment();
    }

    #loadFromEnvironment() {
        this.#host = process.env.DB_HOST;
        this.#port = parseInt(process.env.DB_PORT);
        this.#database = process.env.DB_NAME;
        this.#username = process.env.DB_USERNAME;
        
        // Password should come from secure config manager
        const configManager = new SecureConfigManager();
        this.#password = configManager.getSecret('database_password');

        this.#poolConfig = {
            min: parseInt(process.env.DB_POOL_MIN) || 2,
            max: parseInt(process.env.DB_POOL_MAX) || 10,
            acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
            idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000
        };

        this.#sslConfig = process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: false,
            ca: process.env.DB_SSL_CA
        } : null;

        this.#validate();
        this.#isInitialized = true;
    }

    #validate() {
        const required = ['host', 'port', 'database', 'username', 'password'];
        const missing = required.filter(field => !this[`#${field}`]);
        
        if (missing.length > 0) {
            throw new Error(`Missing database configuration: ${missing.join(', ')}`);
        }

        if (this.#port < 1 || this.#port > 65535) {
            throw new Error('Invalid database port');
        }
    }

    // Public getters for safe access
    getConnectionConfig() {
        if (!this.#isInitialized) {
            throw new Error('Database configuration not initialized');
        }

        return {
            host: this.#host,
            port: this.#port,
            database: this.#database,
            username: this.#username,
            password: '***', // Never expose password
            pool: this.#poolConfig,
            ssl: this.#sslConfig
        };
    }

    getConnectionString() {
        if (!this.#isInitialized) {
            throw new Error('Database configuration not initialized');
        }

        // Return connection string without password
        return `mysql://${this.#username}@${this.#host}:${this.#port}/${this.#database}`;
    }

    // Method for creating actual database connection (password used internally)
    async createConnection() {
        const mysql = require('mysql2/promise');
        
        const connection = await mysql.createConnection({
            host: this.#host,
            port: this.#port,
            database: this.#database,
            user: this.#username,
            password: this.#password, // Used internally, not exposed
            ...this.#poolConfig,
            ssl: this.#sslConfig
        });

        return connection;
    }

    isSSLEnabled() {
        return this.#sslConfig !== null;
    }

    getPoolConfig() {
        return { ...this.#poolConfig };
    }
}

// ## 5. Private Fields in API Rate Limiting

// Advanced Rate Limiter with Private Fields
class RateLimiter {
    // Private fields for rate limiting state
    #limits = new Map();
    #ipBlacklist = new Map();
    #suspiciousActivities = new Map();
    #cleanupInterval;
    #config;

    constructor(config = {}) {
        this.#config = {
            windowMs: config.windowMs || 15 * 60 * 1000, // 15 minutes
            maxRequests: config.maxRequests || 100,
            blockDuration: config.blockDuration || 30 * 60 * 1000, // 30 minutes
            suspiciousThreshold: config.suspiciousThreshold || 10,
            cleanupInterval: config.cleanupInterval || 60 * 1000, // 1 minute
            ...config
        };

        this.#startCleanupInterval();
    }

    // Private cleanup methods
    #startCleanupInterval() {
        this.#cleanupInterval = setInterval(() => {
            this.#cleanupExpired();
        }, this.#config.cleanupInterval);
    }

    #cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;

        // Cleanup expired limits
        for (const [key, limit] of this.#limits.entries()) {
            if (now - limit.windowStart > this.#config.windowMs) {
                this.#limits.delete(key);
                cleaned++;
            }
        }

        // Cleanup expired blacklist entries
        for (const [ip, data] of this.#ipBlacklist.entries()) {
            if (now > data.expiresAt) {
                this.#ipBlacklist.delete(ip);
                cleaned++;
            }
        }

        // Cleanup old suspicious activities
        for (const [ip, activities] of this.#suspiciousActivities.entries()) {
            const recentActivities = activities.filter(
                activity => now - activity.timestamp < this.#config.windowMs
            );
            
            if (recentActivities.length === 0) {
                this.#suspiciousActivities.delete(ip);
            } else {
                this.#suspiciousActivities.set(ip, recentActivities);
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired rate limit entries`);
        }
    }

    // Private rate limiting logic
    #isBlocked(ip) {
        const blockData = this.#ipBlacklist.get(ip);
        
        if (blockData && Date.now() < blockData.expiresAt) {
            return true;
        }
        
        if (blockData && Date.now() >= blockData.expiresAt) {
            this.#ipBlacklist.delete(ip);
        }
        
        return false;
    }

    #recordSuspiciousActivity(ip, reason) {
        if (!this.#suspiciousActivities.has(ip)) {
            this.#suspiciousActivities.set(ip, []);
        }

        const activities = this.#suspiciousActivities.get(ip);
        activities.push({
            timestamp: Date.now(),
            reason
        });

        // Check if we should block this IP
        const recentActivities = activities.filter(
            activity => Date.now() - activity.timestamp < this.#config.windowMs
        );

        if (recentActivities.length >= this.#config.suspiciousThreshold) {
            this.#blockIP(ip, 'Too many suspicious activities');
        }
    }

    #blockIP(ip, reason) {
        this.#ipBlacklist.set(ip, {
            expiresAt: Date.now() + this.#config.blockDuration,
            reason,
            blockedAt: new Date()
        });

        console.log(`Blocked IP ${ip}: ${reason}`);
    }

    #getLimitKey(ip, endpoint = 'global') {
        return `${endpoint}:${ip}`;
    }

    // Public middleware
    middleware(options = {}) {
        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const endpoint = options.endpoint || req.path;
            const key = this.#getLimitKey(ip, endpoint);

            // Check if IP is blocked
            if (this.#isBlocked(ip)) {
                const blockData = this.#ipBlacklist.get(ip);
                return res.status(429).json({
                    error: 'IP address temporarily blocked',
                    reason: blockData.reason,
                    retryAfter: Math.ceil((blockData.expiresAt - Date.now()) / 1000)
                });
            }

            // Get or create limit for this key
            if (!this.#limits.has(key)) {
                this.#limits.set(key, {
                    count: 0,
                    windowStart: Date.now(),
                    firstRequest: Date.now()
                });
            }

            const limit = this.#limits.get(key);

            // Reset if window has passed
            if (Date.now() - limit.windowStart > this.#config.windowMs) {
                limit.count = 0;
                limit.windowStart = Date.now();
                limit.firstRequest = Date.now();
            }

            // Check if limit exceeded
            const maxRequests = options.maxRequests || this.#config.maxRequests;
            
            if (limit.count >= maxRequests) {
                // Record suspicious activity
                this.#recordSuspiciousActivity(ip, 'Rate limit exceeded');
                
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: Math.ceil((limit.windowStart + this.#config.windowMs - Date.now()) / 1000)
                });
            }

            // Increment count
            limit.count++;

            // Set response headers
            res.set({
                'X-RateLimit-Limit': maxRequests,
                'X-RateLimit-Remaining': Math.max(0, maxRequests - limit.count),
                'X-RateLimit-Reset': Math.ceil((limit.windowStart + this.#config.windowMs) / 1000)
            });

            next();
        };
    }

    // Public methods for management
    getIPStats(ip) {
        const stats = {
            isBlocked: this.#isBlocked(ip),
            limits: {},
            suspiciousActivities: 0
        };

        if (stats.isBlocked) {
            const blockData = this.#ipBlacklist.get(ip);
            stats.blockedUntil = blockData.expiresAt;
            stats.blockReason = blockData.reason;
        }

        // Get limits for all endpoints for this IP
        for (const [key, limit] of this.#limits.entries()) {
            if (key.endsWith(ip)) {
                const endpoint = key.split(':')[0];
                stats.limits[endpoint] = {
                    count: limit.count,
                    windowStart: limit.windowStart,
                    firstRequest: limit.firstRequest
                };
            }
        }

        // Count suspicious activities
        const activities = this.#suspiciousActivities.get(ip) || [];
        stats.suspiciousActivities = activities.length;

        return stats;
    }

    unblockIP(ip) {
        return this.#ipBlacklist.delete(ip);
    }

    resetLimit(ip, endpoint = 'global') {
        const key = this.#getLimitKey(ip, endpoint);
        return this.#limits.delete(key);
    }

    getGlobalStats() {
        return {
            totalLimitedIPs: this.#limits.size,
            totalBlockedIPs: this.#ipBlacklist.size,
            totalSuspiciousIPs: this.#suspiciousActivities.size,
            memoryUsage: this.#getMemoryUsage()
        };
    }

    #getMemoryUsage() {
        let size = 0;
        
        for (const [key, value] of this.#limits.entries()) {
            size += key.length + JSON.stringify(value).length;
        }
        
        for (const [key, value] of this.#ipBlacklist.entries()) {
            size += key.length + JSON.stringify(value).length;
        }
        
        for (const [key, value] of this.#suspiciousActivities.entries()) {
            size += key.length + JSON.stringify(value).length;
        }
        
        return `${(size / 1024).toFixed(2)} KB`;
    }

    // Cleanup
    destroy() {
        if (this.#cleanupInterval) {
            clearInterval(this.#cleanupInterval);
        }
        
        this.#limits.clear();
        this.#ipBlacklist.clear();
        this.#suspiciousActivities.clear();
    }
}

// ## 6. Private Fields in Financial Transaction Processing

// Financial Transaction Processor with Private Fields
class TransactionProcessor {
    // Private fields for financial data and processing state
    #pendingTransactions = new Map();
    #processedTransactions = new Map();
    #accountBalances = new Map();
    #transactionQueue = [];
    #isProcessing = false;
    #dailyLimits = new Map();
    #fraudDetectionRules;
    #auditLogger;

    constructor(config = {}) {
        this.#fraudDetectionRules = config.fraudDetectionRules || this.#getDefaultFraudRules();
        this.#auditLogger = config.auditLogger || console;

        // Start transaction processing loop
        this.#startProcessingLoop();
    }

    // Private processing methods
    async #startProcessingLoop() {
        while (true) {
            if (this.#transactionQueue.length > 0 && !this.#isProcessing) {
                await this.#processNextTransaction();
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms interval
        }
    }

    async #processNextTransaction() {
        if (this.#transactionQueue.length === 0) return;

        this.#isProcessing = true;
        const transaction = this.#transactionQueue.shift();

        try {
            this.#auditLogger.info(`Processing transaction: ${transaction.id}`);

            // Validate transaction
            await this.#validateTransaction(transaction);

            // Check fraud detection
            await this.#checkFraud(transaction);

            // Process the transaction
            await this.#executeTransaction(transaction);

            // Update balances
            await this.#updateBalances(transaction);

            // Mark as processed
            this.#markTransactionProcessed(transaction);

            this.#auditLogger.info(`Transaction processed successfully: ${transaction.id}`);

        } catch (error) {
            this.#markTransactionFailed(transaction, error.message);
            this.#auditLogger.error(`Transaction failed: ${transaction.id}`, { error: error.message });
        } finally {
            this.#isProcessing = false;
        }
    }

    // Private validation methods
    async #validateTransaction(transaction) {
        // Check required fields
        const required = ['id', 'fromAccount', 'toAccount', 'amount', 'currency'];
        const missing = required.filter(field => !transaction[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validate amount
        if (transaction.amount <= 0) {
            throw new Error('Transaction amount must be positive');
        }

        // Check if accounts exist
        if (!this.#accountBalances.has(transaction.fromAccount)) {
            throw new Error(`Source account not found: ${transaction.fromAccount}`);
        }

        if (!this.#accountBalances.has(transaction.toAccount)) {
            throw new Error(`Destination account not found: ${transaction.toAccount}`);
        }

        // Check sufficient funds
        const fromBalance = this.#accountBalances.get(transaction.fromAccount);
        if (fromBalance < transaction.amount) {
            throw new Error('Insufficient funds');
        }

        // Check daily limits
        await this.#checkDailyLimits(transaction);
    }

    async #checkDailyLimits(transaction) {
        const today = new Date().toDateString();
        const limitKey = `${transaction.fromAccount}:${today}`;
        
        if (!this.#dailyLimits.has(limitKey)) {
            this.#dailyLimits.set(limitKey, {
                amount: 0,
                count: 0,
                date: today
            });
        }

        const dailyLimit = this.#dailyLimits.get(limitKey);
        const maxDailyAmount = 10000; // $10,000 daily limit
        const maxDailyCount = 50; // 50 transactions per day

        if (dailyLimit.amount + transaction.amount > maxDailyAmount) {
            throw new Error('Daily transaction amount limit exceeded');
        }

        if (dailyLimit.count >= maxDailyCount) {
            throw new Error('Daily transaction count limit exceeded');
        }
    }

    // Private fraud detection
    async #checkFraud(transaction) {
        for (const rule of this.#fraudDetectionRules) {
            const isFraudulent = await rule(transaction, this.#getTransactionHistory(transaction.fromAccount));
            
            if (isFraudulent) {
                throw new Error('Transaction flagged as potentially fraudulent');
            }
        }
    }

    #getDefaultFraudRules() {
        return [
            // Large amount rule
            (transaction) => transaction.amount > 5000,
            
            // Rapid succession rule
            (transaction, history) => {
                const recentTransactions = history.filter(t => 
                    Date.now() - t.timestamp < 5 * 60 * 1000 // 5 minutes
                );
                return recentTransactions.length >= 5;
            },
            
            // Unusual time rule
            (transaction) => {
                const hour = new Date().getHours();
                return hour < 6 || hour > 22; // Unusual hours: 10 PM to 6 AM
            }
        ];
    }

    #getTransactionHistory(accountId) {
        const history = [];
        
        for (const transaction of this.#processedTransactions.values()) {
            if (transaction.fromAccount === accountId || transaction.toAccount === accountId) {
                history.push(transaction);
            }
        }
        
        return history;
    }

    // Private transaction execution
    async #executeTransaction(transaction) {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // In real implementation, this would interact with banking systems
        console.log(`Executing transaction: ${transaction.id} for $${transaction.amount}`);
    }

    async #updateBalances(transaction) {
        const fromBalance = this.#accountBalances.get(transaction.fromAccount);
        const toBalance = this.#accountBalances.get(transaction.toAccount);

        this.#accountBalances.set(transaction.fromAccount, fromBalance - transaction.amount);
        this.#accountBalances.set(transaction.toAccount, toBalance + transaction.amount);

        // Update daily limits
        const today = new Date().toDateString();
        const limitKey = `${transaction.fromAccount}:${today}`;
        const dailyLimit = this.#dailyLimits.get(limitKey);
        
        dailyLimit.amount += transaction.amount;
        dailyLimit.count += 1;
    }

    #markTransactionProcessed(transaction) {
        this.#processedTransactions.set(transaction.id, {
            ...transaction,
            status: 'processed',
            processedAt: new Date()
        });
        
        this.#pendingTransactions.delete(transaction.id);
    }

    #markTransactionFailed(transaction, error) {
        this.#processedTransactions.set(transaction.id, {
            ...transaction,
            status: 'failed',
            error,
            processedAt: new Date()
        });
        
        this.#pendingTransactions.delete(transaction.id);
    }

    // Public methods
    async submitTransaction(transactionData) {
        const transaction = {
            id: this.#generateTransactionId(),
            timestamp: new Date(),
            status: 'pending',
            ...transactionData
        };

        // Basic validation
        if (!transaction.fromAccount || !transaction.toAccount) {
            throw new Error('Source and destination accounts are required');
        }

        if (transaction.fromAccount === transaction.toAccount) {
            throw new Error('Cannot transfer to the same account');
        }

        // Add to pending transactions and queue
        this.#pendingTransactions.set(transaction.id, transaction);
        this.#transactionQueue.push(transaction);

        this.#auditLogger.info(`Transaction submitted: ${transaction.id}`);

        return transaction.id;
    }

    getTransactionStatus(transactionId) {
        if (this.#pendingTransactions.has(transactionId)) {
            return { status: 'pending' };
        }

        const processed = this.#processedTransactions.get(transactionId);
        if (processed) {
            return {
                status: processed.status,
                processedAt: processed.processedAt,
                error: processed.error
            };
        }

        throw new Error('Transaction not found');
    }

    // Account management
    createAccount(accountId, initialBalance = 0) {
        if (this.#accountBalances.has(accountId)) {
            throw new Error('Account already exists');
        }

        this.#accountBalances.set(accountId, initialBalance);
        this.#auditLogger.info(`Account created: ${accountId} with balance $${initialBalance}`);
    }

    getAccountBalance(accountId) {
        if (!this.#accountBalances.has(accountId)) {
            throw new Error('Account not found');
        }

        return this.#accountBalances.get(accountId);
    }

    // Utility methods
    #generateTransactionId() {
        const crypto = require('crypto');
        return `txn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    // Statistics and monitoring
    getStats() {
        return {
            pendingTransactions: this.#pendingTransactions.size,
            processedTransactions: this.#processedTransactions.size,
            totalAccounts: this.#accountBalances.size,
            queueLength: this.#transactionQueue.length,
            isProcessing: this.#isProcessing
        };
    }

    getDailyLimits(accountId) {
        const today = new Date().toDateString();
        const limitKey = `${accountId}:${today}`;
        
        return this.#dailyLimits.get(limitKey) || { amount: 0, count: 0, date: today };
    }

    // Cleanup
    destroy() {
        this.#pendingTransactions.clear();
        this.#processedTransactions.clear();
        this.#accountBalances.clear();
        this.#transactionQueue = [];
        this.#dailyLimits.clear();
    }
}

// ## Key Benefits in Production:

// 1. **Data Encapsulation**: Sensitive data like passwords, tokens, and financial information are truly private
// 2. **Security**: Private fields prevent accidental exposure of sensitive data
// 3. **Immutability**: Internal state cannot be modified from outside the class
// 4. **Validation**: All data access goes through controlled methods with validation
// 5. **Audit Trail**: Private methods can enforce logging and monitoring
// 6. **Performance**: Private fields can be optimized by JavaScript engines
// 7. **Maintainability**: Clear separation between public API and internal implementation

// These patterns ensure your Node.js backend is secure, maintainable, and production-ready with proper encapsulation of sensitive business logic and data.






























// Here are comprehensive code snippets for private methods in JavaScript classes for Node.js production-grade backend development:

// ## 1. Basic Private Methods (ES2022+)

// Using # syntax (true private methods)
class UserService {
  #databaseConnection;
  
  constructor(dbConnection) {
    this.#databaseConnection = dbConnection;
  }

  // Public method
  async getUser(id) {
    this.#validateUserId(id);
    const user = await this.#fetchUserFromDatabase(id);
    return this.#sanitizeUserData(user);
  }

  // Private method - can only be called within the class
  #validateUserId(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid user ID');
    }
    if (!this.#isValidUUID(id)) {
      throw new Error('User ID must be a valid UUID');
    }
  }

  // Private method with database access
  async #fetchUserFromDatabase(id) {
    try {
      return await this.#databaseConnection.query(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
    } catch (error) {
      this.#logError('Database fetch failed', error);
      throw new Error('User not found');
    }
  }

  // Private utility method
  #sanitizeUserData(user) {
    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.salt;
    return sanitized;
  }

  // Private validation method
  #isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Private logging method
  #logError(message, error) {
    console.error(`[UserService Error] ${message}:`, {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  }
}

// ## 2. Private Static Methods

class EncryptionService {
  static #encryptionKey = process.env.ENCRYPTION_KEY;

  // Private static method
  static #validateKey() {
    if (!this.#encryptionKey || this.#encryptionKey.length < 32) {
      throw new Error('Encryption key is invalid or too short');
    }
  }

  // Private static utility method
  static #generateSalt() {
    return require('crypto').randomBytes(16).toString('hex');
  }

  // Public method using private static methods
  static async hashPassword(password) {
    this.#validateKey();
    const salt = this.#generateSalt();
    const hashedPassword = await this.#computeHash(password, salt);
    return { hashedPassword, salt };
  }

  // Private static method with complex logic
  static async #computeHash(password, salt) {
    const { pbkdf2 } = require('crypto').promises;
    return pbkdf2(password, salt + this.#encryptionKey, 100000, 64, 'sha512')
      .then(hash => hash.toString('hex'));
  }
}

// ## 3. Private Methods with Dependency Injection

class OrderProcessor {
  #paymentGateway;
  #inventoryService;
  #emailService;
  #logger;

  constructor(dependencies) {
    this.#paymentGateway = dependencies.paymentGateway;
    this.#inventoryService = dependencies.inventoryService;
    this.#emailService = dependencies.emailService;
    this.#logger = dependencies.logger;
  }

  async processOrder(order) {
    try {
      this.#validateOrder(order);
      await this.#reserveInventory(order);
      const paymentResult = await this.#processPayment(order);
      await this.#updateOrderStatus(order, 'completed');
      await this.#sendConfirmationEmail(order);
      
      return { success: true, orderId: order.id };
    } catch (error) {
      await this.#handleOrderFailure(order, error);
      throw error;
    }
  }

  #validateOrder(order) {
    if (!order?.items?.length) {
      throw new Error('Order must contain items');
    }
    if (!order.totalAmount || order.totalAmount <= 0) {
      throw new Error('Invalid order amount');
    }
    this.#logger.debug('Order validation passed', { orderId: order.id });
  }

  async #reserveInventory(order) {
    for (const item of order.items) {
      const available = await this.#inventoryService.checkAvailability(item.productId);
      if (available < item.quantity) {
        throw new Error(`Insufficient inventory for product ${item.productId}`);
      }
    }
    await this.#inventoryService.reserveItems(order.items);
  }

  async #processPayment(order) {
    const paymentData = {
      amount: order.totalAmount,
      currency: order.currency,
      paymentMethod: order.paymentMethod
    };
    
    return await this.#paymentGateway.charge(paymentData);
  }

  async #updateOrderStatus(order, status) {
    // Implementation for updating order in database
    this.#logger.info('Order status updated', { 
      orderId: order.id, 
      status 
    });
  }

  async #sendConfirmationEmail(order) {
    const emailTemplate = this.#generateEmailTemplate(order);
    await this.#emailService.send({
      to: order.customerEmail,
      subject: 'Order Confirmation',
      html: emailTemplate
    });
  }

  #generateEmailTemplate(order) {
    return `
      <h1>Order Confirmation</h1>
      <p>Thank you for your order!</p>
      <p>Order ID: ${order.id}</p>
      <p>Total: $${order.totalAmount}</p>
    `;
  }

  async #handleOrderFailure(order, error) {
    this.#logger.error('Order processing failed', {
      orderId: order.id,
      error: error.message
    });
    
    // Rollback inventory reservation
    await this.#inventoryService.releaseReservation(order.items);
    
    // Update order status to failed
    await this.#updateOrderStatus(order, 'failed');
  }
}

// ## 4. Advanced Private Methods with Caching

class ProductService {
  #cache;
  #dbRepository;
  #cacheTtl = 300000; // 5 minutes

  constructor(dbRepository, cache) {
    this.#dbRepository = dbRepository;
    this.#cache = cache;
  }

  async getProductWithCache(id) {
    const cacheKey = `product:${id}`;
    
    // Try to get from cache first
    const cached = await this.#getFromCache(cacheKey);
    if (cached) {
      this.#logCacheHit(cacheKey);
      return cached;
    }

    // Cache miss - fetch from database
    const product = await this.#fetchProductFromDB(id);
    
    // Store in cache
    await this.#setCache(cacheKey, product);
    
    return product;
  }

  async #getFromCache(key) {
    try {
      const cached = await this.#cache.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.#logCacheError('GET', key, error);
      return null;
    }
  }

  async #setCache(key, value) {
    try {
      await this.#cache.setex(
        key, 
        this.#cacheTtl / 1000, 
        JSON.stringify(value)
      );
    } catch (error) {
      this.#logCacheError('SET', key, error);
    }
  }

  async #fetchProductFromDB(id) {
    this.#validateProductId(id);
    const product = await this.#dbRepository.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }

    return this.#enrichProductData(product);
  }

  #validateProductId(id) {
    if (!id || !Number.isInteger(Number(id))) {
      throw new Error('Invalid product ID');
    }
  }

  #enrichProductData(product) {
    return {
      ...product,
      displayPrice: this.#formatPrice(product.price),
      inStock: product.quantity > 0,
      categoryPath: this.#buildCategoryPath(product.categoryId)
    };
  }

  #formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  #buildCategoryPath(categoryId) {
    // Implementation for building category hierarchy
    return `/categories/${categoryId}`;
  }

  #logCacheHit(key) {
    console.log(`[CACHE HIT] ${key}`);
  }

  #logCacheError(operation, key, error) {
    console.error(`[CACHE ERROR] ${operation} ${key}:`, error.message);
  }
}

// ## 5. Private Methods with Rate Limiting

class APIService {
  #rateLimiter;
  #httpClient;
  #maxRetries = 3;

  constructor(httpClient, rateLimiter) {
    this.#httpClient = httpClient;
    this.#rateLimiter = rateLimiter;
  }

  async makeAPICall(endpoint, data) {
    await this.#checkRateLimit();
    
    try {
      return await this.#executeWithRetry(endpoint, data);
    } catch (error) {
      this.#handleAPIError(error, endpoint);
      throw error;
    }
  }

  async #checkRateLimit() {
    const canProceed = await this.#rateLimiter.checkLimit('api-call');
    if (!canProceed) {
      throw new Error('Rate limit exceeded');
    }
  }

  async #executeWithRetry(endpoint, data, retryCount = 0) {
    try {
      return await this.#httpClient.post(endpoint, data);
    } catch (error) {
      if (this.#shouldRetry(error) && retryCount < this.#maxRetries) {
        await this.#waitForRetry(retryCount);
        return this.#executeWithRetry(endpoint, data, retryCount + 1);
      }
      throw error;
    }
  }

  #shouldRetry(error) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.statusCode) || 
           error.code === 'ECONNRESET';
  }

  async #waitForRetry(retryCount) {
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  #handleAPIError(error, endpoint) {
    console.error(`API Call failed to ${endpoint}:`, {
      timestamp: new Date().toISOString(),
      statusCode: error.statusCode,
      message: error.message,
      endpoint
    });

    // Metrics collection
    this.#incrementErrorMetric(endpoint, error.statusCode);
  }

  #incrementErrorMetric(endpoint, statusCode) {
    // Implementation for metrics collection
    // Could use StatsD, Prometheus, etc.
    console.log(`[METRIC] api_error:${endpoint}:${statusCode}`);
  }
}

// ## 6. Testing Private Methods (Workaround)

// While private methods can't be tested directly, you can test them indirectly
// through public methods, or use this pattern for testing:

class TestableService {
  #privateMethod() {
    return this.#internalLogic();
  }

  // Public method that exposes private logic for testing
  testPrivateMethod(...args) {
    if (process.env.NODE_ENV === 'test') {
      return this.#privateMethod(...args);
    }
    throw new Error('Method only available in test environment');
  }

  #internalLogic() {
    // Complex private logic
    return 'result';
  }
}

// Alternative: Extract private logic to separate functions
class ServiceWithExtractedLogic {
  #processData(data) {
    return internalHelpers.validateAndTransform(data);
  }
}

// Internal helpers (in same file, not exported)
const internalHelpers = {
  validateAndTransform(data) {
    // Implementation
    return data;
  }
};

// ## 7. Best Practices for Production

// Error handling and logging in private methods
class ProductionService {
  #config;
  #metrics;

  constructor(config, metrics) {
    this.#config = config;
    this.#metrics = metrics;
  }

  async #processBatch(items) {
    const batchId = this.#generateBatchId();
    
    this.#logBatchStart(batchId, items.length);
    
    try {
      const results = [];
      
      for (const item of items) {
        const result = await this.#processItem(item, batchId);
        results.push(result);
      }
      
      this.#logBatchComplete(batchId, results.length);
      this.#recordMetrics(batchId, 'success', results.length);
      
      return results;
    } catch (error) {
      this.#logBatchError(batchId, error);
      this.#recordMetrics(batchId, 'error', 0);
      throw error;
    }
  }

  #generateBatchId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  #logBatchStart(batchId, itemCount) {
    console.log(`[BATCH START]`, {
      batchId,
      itemCount,
      timestamp: new Date().toISOString()
    });
  }

  #logBatchComplete(batchId, processedCount) {
    console.log(`[BATCH COMPLETE]`, {
      batchId,
      processedCount,
      timestamp: new Date().toISOString()
    });
  }

  #logBatchError(batchId, error) {
    console.error(`[BATCH ERROR]`, {
      batchId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  #recordMetrics(batchId, status, count) {
    if (this.#metrics) {
      this.#metrics.increment('batch.processed', count, { status });
    }
  }

  async #processItem(item, batchId) {
    // Validate input
    this.#validateItem(item);
    
    // Business logic
    const processed = await this.#applyBusinessRules(item);
    
    // Data transformation
    return this.#transformOutput(processed);
  }

  #validateItem(item) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item: must be an object');
    }
    
    const required = ['id', 'type', 'data'];
    for (const field of required) {
      if (!item[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  async #applyBusinessRules(item) {
    // Complex business logic implementation
    return { ...item, processed: true, timestamp: Date.now() };
  }

  #transformOutput(data) {
    // Remove sensitive fields
    const { internal, secret, ...sanitized } = data;
    return sanitized;
  }
}

// ## Key Points for Production Use:

// 1. **True Privacy**: `#` methods are truly private and cannot be accessed outside the class
// 2. **Encapsulation**: Keep internal implementation details hidden
// 3. **Error Handling**: Always handle errors in private methods
// 4. **Logging**: Include appropriate logging for debugging and monitoring
// 5. **Testing**: Test private methods indirectly through public interfaces
// 6. **Performance**: Private methods can be optimized by JavaScript engines
// 7. **Maintainability**: Clear separation of concerns between public and private APIs

// These patterns ensure your Node.js backend code is secure, maintainable, and production-ready.