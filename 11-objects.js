// # JavaScript Objects - Production Grade Node.js Development

// ## 1. Configuration Objects

// ### Environment-Based Configuration
// config/database.js
class DatabaseConfig {
    constructor(environment) {
        this.environment = environment;
        this.config = this.loadConfig();
    }

    loadConfig() {
        const baseConfig = {
            pool: {
                max: 10,
                min: 2,
                acquire: 30000,
                idle: 10000
            },
            dialect: 'postgres',
            logging: this.environment === 'development' ? console.log : false
        };

        const environmentConfigs = {
            development: {
                host: 'localhost',
                port: 5432,
                database: 'app_dev',
                username: 'dev_user',
                password: 'dev_pass'
            },
            testing: {
                host: process.env.TEST_DB_HOST,
                port: process.env.TEST_DB_PORT,
                database: process.env.TEST_DB_NAME,
                username: process.env.TEST_DB_USER,
                password: process.env.TEST_DB_PASS
            },
            production: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                database: process.env.DB_NAME,
                username: process.env.DB_USER,
                password: process.env.DB_PASS,
                pool: {
                    max: 20,
                    min: 5,
                    acquire: 60000,
                    idle: 30000
                }
            }
        };

        return {
            ...baseConfig,
            ...environmentConfigs[this.environment],
            // Override with environment variables if present
            ...(process.env.DB_HOST && { host: process.env.DB_HOST }),
            ...(process.env.DB_PORT && { port: parseInt(process.env.DB_PORT) })
        };
    }

    validate() {
        const required = ['host', 'database', 'username', 'password'];
        const missing = required.filter(field => !this.config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing database configuration: ${missing.join(', ')}`);
        }
        
        return true;
    }
}

// config/app.js
const AppConfig = {
    server: {
        port: parseInt(process.env.PORT) || 3000,
        environment: process.env.NODE_ENV || 'development',
        cluster: process.env.USE_CLUSTER === 'true',
        trustProxy: process.env.TRUST_PROXY === 'true'
    },
    
    security: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }
    },
    
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
        skipSuccessfulRequests: false
    },
    
    cache: {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB) || 0
        },
        ttl: {
            user: 3600, // 1 hour
            session: 86400, // 24 hours
            api: 300 // 5 minutes
        }
    }
};

// Usage
const dbConfig = new DatabaseConfig(process.env.NODE_ENV);
dbConfig.validate();

export { AppConfig, dbConfig };

// ## 2. Service Objects with Dependency Injection

// ### User Service with Repository Pattern
// services/UserService.js
class UserService {
    constructor({ userRepository, emailService, cacheService, logger }) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.cacheService = cacheService;
        this.logger = logger;
    }

    async createUser(userData) {
        const validationResult = this.validateUserData(userData);
        if (!validationResult.isValid) {
            throw new ValidationError('Invalid user data', validationResult.errors);
        }

        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw new ConflictError('User already exists');
        }

        const user = await this.userRepository.create({
            ...userData,
            password: await this.hashPassword(userData.password),
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Invalidate cache
        await this.cacheService.del('users:all');
        
        // Send welcome email (fire and forget)
        this.emailService.sendWelcomeEmail(user.email, user.name)
            .catch(error => this.logger.error('Failed to send welcome email', error));

        this.logger.info('User created successfully', { userId: user.id });
        return this.sanitizeUser(user);
    }

    async getUserById(userId, includeSensitive = false) {
        const cacheKey = `user:${userId}`;
        
        // Try cache first
        const cachedUser = await this.cacheService.get(cacheKey);
        if (cachedUser) {
            return includeSensitive ? JSON.parse(cachedUser) : this.sanitizeUser(JSON.parse(cachedUser));
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Cache user data
        await this.cacheService.set(cacheKey, JSON.stringify(user), 3600);

        return includeSensitive ? user : this.sanitizeUser(user);
    }

    async updateUser(userId, updates) {
        const allowedUpdates = ['name', 'avatar', 'preferences'];
        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        if (Object.keys(filteredUpdates).length === 0) {
            throw new ValidationError('No valid fields to update');
        }

        filteredUpdates.updatedAt = new Date();
        const user = await this.userRepository.findByIdAndUpdate(userId, filteredUpdates, { new: true });

        // Invalidate cache
        await this.cacheService.del(`user:${userId}`);
        await this.cacheService.del('users:all');

        return this.sanitizeUser(user);
    }

    validateUserData(userData) {
        const errors = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!userData.email || !emailRegex.test(userData.email)) {
            errors.push('Valid email is required');
        }

        if (!userData.password || userData.password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!userData.name || userData.name.trim().length < 2) {
            errors.push('Name must be at least 2 characters long');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async hashPassword(password) {
        return bcrypt.hash(password, AppConfig.security.bcryptRounds);
    }

    sanitizeUser(user) {
        const { password, resetToken, ...sanitized } = user.toObject ? user.toObject() : user;
        return sanitized;
    }
}

// factories/ServiceFactory.js
class ServiceFactory {
    static createUserService() {
        const userRepository = new UserRepository();
        const emailService = new EmailService();
        const cacheService = new RedisCacheService();
        const logger = new Logger();

        return new UserService({
            userRepository,
            emailService,
            cacheService,
            logger
        });
    }
}

// Usage in controller
const userService = ServiceFactory.createUserService();
const user = await userService.createUser(userData);

// ## 3. Request/Response Objects

// ### Standardized API Response Format
// utils/ApiResponse.js
class ApiResponse {
    static success(data, meta = {}) {
        return {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        };
    }

    static paginated(data, pagination) {
        return this.success(data, {
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                pages: Math.ceil(pagination.total / pagination.limit)
            }
        });
    }

    static error(message, code = 'ERROR', details = null) {
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

    static fromValidationError(validationError) {
        return this.error(
            'Validation failed',
            'VALIDATION_ERROR',
            validationError.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }))
        );
    }
}

// middleware/responseFormatter.js
const responseFormatter = (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
        // Only format JSON responses
        if (res.get('Content-Type') === 'application/json') {
            // If it's already an ApiResponse, use it as is
            if (data && data.success !== undefined) {
                return originalSend.call(this, JSON.stringify(data));
            }

            // Format successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const formatted = ApiResponse.success(data);
                return originalSend.call(this, JSON.stringify(formatted));
            }
        }

        return originalSend.call(this, data);
    };

    next();
};

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode, code = 'APP_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

class NotFoundError extends AppError {
    constructor(resource) {
        super(`${resource || 'Resource'} not found`, 404, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

// Error handling middleware
const errorHandler = (error, req, res, next) => {
    const logger = req.logger || console;

    logger.error('Error occurred:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    if (error.isOperational) {
        const response = ApiResponse.error(
            error.message,
            error.code,
            error.details
        );
        return res.status(error.statusCode).json(response);
    }

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message;

    const response = ApiResponse.error(
        message,
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? error.stack : undefined
    );

    res.status(500).json(response);
};

// ## 4. Database Model Objects

// ### MongoDB/Mongoose Models with Hooks
// models/User.js
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    preferences: {
        emailNotifications: { type: Boolean, default: true },
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
        language: { type: String, default: 'en' }
    },
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            delete ret.password;
            delete ret.loginAttempts;
            delete ret.lockUntil;
            return ret;
        }
    }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ 'preferences.language': 1 });

// Virtuals
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Methods
userSchema.methods = {
    async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    },

    incrementLoginAttempts() {
        // If we have a previous lock that has expired, restart at 1
        if (this.lockUntil && this.lockUntil < Date.now()) {
            return this.updateOne({
                $set: { loginAttempts: 1 },
                $unset: { lockUntil: 1 }
            });
        }

        // Otherwise increment
        const updates = { $inc: { loginAttempts: 1 } };
        
        // Lock the account if we've reached max attempts and it's not locked already
        if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
            updates.$set = { lockUntil: Date.now() + LOCK_TIME };
        }

        return this.updateOne(updates);
    },

    toJSON() {
        const user = this.toObject();
        user.id = user._id.toString();
        delete user._id;
        delete user.__v;
        delete user.password;
        return user;
    }
};

// Statics
userSchema.statics = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 2 * 60 * 60 * 1000, // 2 hours

    async findByEmail(email) {
        return this.findOne({ email: email.toLowerCase() });
    },

    async getActiveUsers(since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        return this.find({
            status: 'active',
            lastLogin: { $gte: since }
        }).sort({ lastLogin: -1 });
    },

    async getUsersWithPagination({ page = 1, limit = 10, sort = '-createdAt', ...filters } = {}) {
        const skip = (page - 1) * limit;
        
        const query = this.find(filters);
        const countQuery = this.countDocuments(filters);

        const [users, total] = await Promise.all([
            query.sort(sort).skip(skip).limit(limit).exec(),
            countQuery.exec()
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
};

// Hooks
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.post('save', function(doc) {
    // Emit event for other services
    eventBus.emit('user.saved', doc);
});

userSchema.post('findOneAndUpdate', function(doc) {
    if (doc) {
        eventBus.emit('user.updated', doc);
    }
});

const User = mongoose.model('User', userSchema);

// ## 5. Factory Pattern Objects

// ### Object Factory for Different Environments
// factories/LoggerFactory.js
class LoggerFactory {
    static createLogger(environment) {
        const commonOptions = {
            level: process.env.LOG_LEVEL || 'info',
            timestamp: true,
            handleExceptions: true,
            json: environment === 'production'
        };

        switch (environment) {
            case 'development':
                return new DevelopmentLogger(commonOptions);
            case 'production':
                return new ProductionLogger(commonOptions);
            case 'testing':
                return new TestingLogger(commonOptions);
            default:
                return new DevelopmentLogger(commonOptions);
        }
    }
}

class DevelopmentLogger {
    constructor(options) {
        this.options = options;
    }

    info(message, meta = {}) {
        console.log(`[${new Date().toISOString()}] INFO: ${message}`, meta);
    }

    error(message, error = null, meta = {}) {
        console.error(`[${new Date().toISOString()}] ERROR: ${message}`, {
            ...meta,
            error: error?.message,
            stack: error?.stack
        });
    }

    warn(message, meta = {}) {
        console.warn(`[${new Date().toISOString()}] WARN: ${message}`, meta);
    }
}

class ProductionLogger {
    constructor(options) {
        this.options = options;
    }

    info(message, meta = {}) {
        const logEntry = {
            level: 'INFO',
            timestamp: new Date().toISOString(),
            message,
            ...meta
        };
        console.log(JSON.stringify(logEntry));
    }

    error(message, error = null, meta = {}) {
        const logEntry = {
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            message,
            error: error?.message,
            stack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
            ...meta
        };
        console.error(JSON.stringify(logEntry));
    }

    warn(message, meta = {}) {
        const logEntry = {
            level: 'WARN',
            timestamp: new Date().toISOString(),
            message,
            ...meta
        };
        console.warn(JSON.stringify(logEntry));
    }
}

// factories/PaymentProcessorFactory.js
class PaymentProcessorFactory {
    static createProcessor(type, config) {
        const processors = {
            stripe: StripePaymentProcessor,
            paypal: PayPalPaymentProcessor,
            crypto: CryptoPaymentProcessor,
            bank: BankTransferProcessor
        };

        const ProcessorClass = processors[type];
        if (!ProcessorClass) {
            throw new Error(`Unsupported payment processor: ${type}`);
        }

        return new ProcessorClass(config);
    }
}

class StripePaymentProcessor {
    constructor(config) {
        this.stripe = require('stripe')(config.secretKey);
        this.webhookSecret = config.webhookSecret;
    }

    async createPaymentIntent(amount, currency, metadata = {}) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency,
                metadata,
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return {
                id: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100
            };
        } catch (error) {
            throw new PaymentError(`Stripe error: ${error.message}`);
        }
    }

    async handleWebhook(payload, signature) {
        try {
            const event = this.stripe.webhooks.constructEvent(
                payload,
                signature,
                this.webhookSecret
            );

            return this.processWebhookEvent(event);
        } catch (error) {
            throw new PaymentError(`Webhook error: ${error.message}`);
        }
    }

    processWebhookEvent(event) {
        switch (event.type) {
            case 'payment_intent.succeeded':
                return this.handlePaymentSuccess(event.data.object);
            case 'payment_intent.payment_failed':
                return this.handlePaymentFailure(event.data.object);
            default:
                return { processed: false, event: event.type };
        }
    }
}

// ## 6. Cache Management Objects

// ### Redis Cache Manager with Namespacing
// services/CacheService.js
class CacheService {
    constructor(redisClient, options = {}) {
        this.redis = redisClient;
        this.defaultTTL = options.defaultTTL || 3600; // 1 hour
        this.namespace = options.namespace || 'app';
    }

    generateKey(keyspace, key) {
        return `${this.namespace}:${keyspace}:${key}`;
    }

    async get(keyspace, key) {
        const cacheKey = this.generateKey(keyspace, key);
        try {
            const data = await this.redis.get(cacheKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(keyspace, key, value, ttl = this.defaultTTL) {
        const cacheKey = this.generateKey(keyspace, key);
        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.setex(cacheKey, ttl, serialized);
            } else {
                await this.redis.set(cacheKey, serialized);
            }
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    async del(keyspace, key) {
        const cacheKey = this.generateKey(keyspace, key);
        try {
            await this.redis.del(cacheKey);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    async mget(keyspace, keys) {
        const cacheKeys = keys.map(key => this.generateKey(keyspace, key));
        try {
            const results = await this.redis.mget(cacheKeys);
            return results.map(result => result ? JSON.parse(result) : null);
        } catch (error) {
            console.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }

    async mset(keyspace, keyValuePairs, ttl = this.defaultTTL) {
        const pipeline = this.redis.pipeline();
        
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            const cacheKey = this.generateKey(keyspace, key);
            const serialized = JSON.stringify(value);
            
            if (ttl > 0) {
                pipeline.setex(cacheKey, ttl, serialized);
            } else {
                pipeline.set(cacheKey, serialized);
            }
        });

        try {
            await pipeline.exec();
            return true;
        } catch (error) {
            console.error('Cache mset error:', error);
            return false;
        }
    }

    async invalidatePattern(pattern) {
        try {
            const keys = await this.redis.keys(`${this.namespace}:${pattern}`);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
            return keys.length;
        } catch (error) {
            console.error('Cache invalidate error:', error);
            return 0;
        }
    }

    async withCache(keyspace, key, ttl, asyncFn) {
        const cached = await this.get(keyspace, key);
        if (cached !== null) {
            return cached;
        }

        const freshData = await asyncFn();
        await this.set(keyspace, key, freshData, ttl);
        
        return freshData;
    }

    // Specialized cache methods for common use cases
    async cacheUser(userId, userData, ttl = 7200) {
        return this.set('users', userId, userData, ttl);
    }

    async getCachedUser(userId) {
        return this.get('users', userId);
    }

    async cacheSession(sessionId, sessionData, ttl = 86400) {
        return this.set('sessions', sessionId, sessionData, ttl);
    }

    async invalidateUserCache(userId) {
        await this.del('users', userId);
        await this.invalidatePattern('user:*'); // Invalidate any user-related cache
    }
}

// Usage
const cacheService = new CacheService(redisClient, {
    namespace: 'myapp',
    defaultTTL: 3600
});

// Cache with fallback
const user = await cacheService.withCache(
    'users', 
    `id:${userId}`, 
    1800, // 30 minutes
    () => userService.getUserById(userId)
);

// ## 7. Validation Objects

// ### Comprehensive Validation Schemas
// validators/UserValidator.js
const Joi = require('joi');

const UserValidator = {
    create: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .normalize()
            .messages({
                'string.email': 'Please provide a valid email address',
                'any.required': 'Email is required'
            }),
        
        password: Joi.string()
            .min(8)
            .max(100)
            .required()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .messages({
                'string.min': 'Password must be at least 8 characters long',
                'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
                'any.required': 'Password is required'
            }),
        
        name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.min': 'Name must be at least 2 characters long',
                'any.required': 'Name is required'
            }),
        
        avatar: Joi.string()
            .uri()
            .optional(),
        
        role: Joi.string()
            .valid('user', 'admin', 'moderator')
            .default('user'),
        
        preferences: Joi.object({
            emailNotifications: Joi.boolean().default(true),
            theme: Joi.string().valid('light', 'dark', 'auto').default('auto'),
            language: Joi.string().valid('en', 'es', 'fr', 'de').default('en')
        }).default()
    }),
    
    update: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .trim()
            .optional(),
        
        avatar: Joi.string()
            .uri()
            .optional(),
        
        preferences: Joi.object({
            emailNotifications: Joi.boolean(),
            theme: Joi.string().valid('light', 'dark', 'auto'),
            language: Joi.string().valid('en', 'es', 'fr', 'de')
        }).optional()
    }).min(1), // At least one field must be provided
    
    login: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .normalize(),
        
        password: Joi.string()
            .required()
    }),
    
    changePassword: Joi.object({
        currentPassword: Joi.string()
            .required(),
        
        newPassword: Joi.string()
            .min(8)
            .max(100)
            .required()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .invalid(Joi.ref('currentPassword'))
            .messages({
                'any.invalid': 'New password must be different from current password'
            })
    })
};

// Custom validator class
class Validator {
    static validate(schema, data, options = {}) {
        const { abortEarly = false, allowUnknown = false } = options;
        
        const { error, value } = schema.validate(data, {
            abortEarly,
            allowUnknown,
            stripUnknown: true
        });
        
        if (error) {
            throw new ValidationError(
                'Validation failed',
                error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    type: detail.type
                }))
            );
        }
        
        return value;
    }
    
    static async validateAsync(schema, data, options = {}) {
        try {
            const value = await schema.validateAsync(data, {
                abortEarly: false,
                allowUnknown: options.allowUnknown || false,
                stripUnknown: true
            });
            return value;
        } catch (error) {
            throw new ValidationError(
                'Validation failed',
                error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    type: detail.type
                }))
            );
        }
    }
}

// Usage in controller
app.post('/api/users', async (req, res, next) => {
    try {
        const validatedData = Validator.validate(UserValidator.create, req.body);
        const user = await userService.createUser(validatedData);
        res.status(201).json(ApiResponse.success(user));
    } catch (error) {
        next(error);
    }
});

app.patch('/api/users/:id', async (req, res, next) => {
    try {
        const validatedData = Validator.validate(UserValidator.update, req.body);
        const user = await userService.updateUser(req.params.id, validatedData);
        res.json(ApiResponse.success(user));
    } catch (error) {
        next(error);
    }
});

// These production-grade object patterns demonstrate how to structure Node.js applications for scalability, maintainability, and reliability. Each pattern addresses specific concerns like configuration management, service layer abstraction, data validation, caching, and error handling.




































// # Object Methods & `this` Usage - Production Grade Node.js Development

// ## 1. Service Classes with Method Chaining

// ### Database Query Builder
class QueryBuilder {
    constructor(model) {
        this.model = model;
        this.query = {};
        this.options = {
            select: null,
            populate: [],
            sort: null,
            limit: null,
            skip: 0
        };
    }

    where(conditions) {
        this.query = { ...this.query, ...conditions };
        return this; // Enable chaining
    }

    select(fields) {
        this.options.select = fields;
        return this;
    }

    populate(path, select = null) {
        this.options.populate.push({ path, select });
        return this;
    }

    sort(sortBy) {
        this.options.sort = sortBy;
        return this;
    }

    limit(limit) {
        this.options.limit = limit;
        return this;
    }

    skip(skip) {
        this.options.skip = skip;
        return this;
    }

    async exec() {
        let query = this.model.find(this.query);

        if (this.options.select) {
            query = query.select(this.options.select);
        }

        this.options.populate.forEach(populate => {
            query = query.populate(populate.path, populate.select);
        });

        if (this.options.sort) {
            query = query.sort(this.options.sort);
        }

        if (this.options.limit) {
            query = query.limit(this.options.limit);
        }

        if (this.options.skip) {
            query = query.skip(this.options.skip);
        }

        return query.exec();
    }

    async count() {
        return this.model.countDocuments(this.query);
    }

    async paginate(page = 1, limit = 10) {
        this.options.skip = (page - 1) * limit;
        this.options.limit = limit;

        const [data, total] = await Promise.all([
            this.exec(),
            this.count()
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
}

// Usage in UserService
class UserService {
    constructor(userModel) {
        this.User = userModel;
    }

    findActiveUsers() {
        return new QueryBuilder(this.User)
            .where({ status: 'active' })
            .select('name email role')
            .populate('profile')
            .sort('-createdAt')
            .limit(100)
            .exec();
    }

    searchUsers(filters) {
        const builder = new QueryBuilder(this.User)
            .where({ status: 'active' });

        if (filters.name) {
            builder.where({ 
                name: { $regex: filters.name, $options: 'i' } 
            });
        }

        if (filters.role) {
            builder.where({ role: filters.role });
        }

        return builder
            .select('name email role createdAt')
            .sort('-createdAt')
            .paginate(filters.page, filters.limit);
    }
}

// ## 2. State Management with `this`

// ### Session Management Service
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
    }

    createSession(userId, userData) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId,
            userData,
            createdAt: new Date(),
            lastAccessed: new Date(),
            expiresAt: new Date(Date.now() + this.sessionTimeout)
        };

        this.sessions.set(sessionId, session);
        return session;
    }

    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }

        // Check if session is expired
        if (session.expiresAt < new Date()) {
            this.sessions.delete(sessionId);
            return null;
        }

        // Update last accessed time
        session.lastAccessed = new Date();
        session.expiresAt = new Date(Date.now() + this.sessionTimeout);
        
        return session;
    }

    destroySession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    destroyUserSessions(userId) {
        let destroyedCount = 0;
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.userId === userId) {
                this.sessions.delete(sessionId);
                destroyedCount++;
            }
        }
        
        return destroyedCount;
    }

    updateSessionData(sessionId, updates) {
        const session = this.getSession(sessionId);
        
        if (session) {
            Object.assign(session.userData, updates);
            return true;
        }
        
        return false;
    }

    generateSessionId() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.expiresAt < now) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }

        console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }

    // Get statistics about sessions
    getStats() {
        const now = new Date();
        const activeSessions = Array.from(this.sessions.values());
        
        return {
            total: activeSessions.length,
            expired: activeSessions.filter(s => s.expiresAt < now).length,
            byRole: activeSessions.reduce((acc, session) => {
                const role = session.userData.role || 'user';
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {})
        };
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.sessions.clear();
    }
}

// Usage in authentication middleware
const sessionManager = new SessionManager();

app.use((req, res, next) => {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    
    if (sessionId) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
            req.session = session;
            req.user = session.userData;
        }
    }
    
    next();
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await UserService.authenticate(email, password);
        const session = sessionManager.createSession(user.id, {
            id: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions
        });

        res.cookie('sessionId', session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: sessionManager.sessionTimeout
        });

        res.json({ success: true, user: session.userData });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

app.post('/logout', (req, res) => {
    if (req.session) {
        sessionManager.destroySession(req.session.id);
    }
    
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// ## 3. Event Emitter with Context Binding

// ### Custom Event System with `this` Context
const EventEmitter = require('events');

class AppEventEmitter extends EventEmitter {
    constructor() {
        super();
        this.middlewares = [];
        this.eventHistory = new Map();
        this.maxHistory = 1000;
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async emitWithContext(eventName, context, ...args) {
        // Apply middlewares
        let processedContext = context;
        for (const middleware of this.middlewares) {
            processedContext = await middleware(processedContext, eventName);
            if (processedContext.stopPropagation) {
                return false;
            }
        }

        // Store event in history
        this.recordEvent(eventName, processedContext, args);

        // Emit event with bound context
        return this.emit(eventName, processedContext, ...args);
    }

    recordEvent(eventName, context, args) {
        const eventRecord = {
            timestamp: new Date(),
            event: eventName,
            context: this.sanitizeContext(context),
            args: this.sanitizeArgs(args)
        };

        if (!this.eventHistory.has(eventName)) {
            this.eventHistory.set(eventName, []);
        }

        const history = this.eventHistory.get(eventName);
        history.push(eventRecord);

        // Keep only recent events
        if (history.length > this.maxHistory) {
            history.shift();
        }
    }

    sanitizeContext(context) {
        const sanitized = { ...context };
        // Remove sensitive data
        delete sanitized.password;
        delete sanitized.token;
        delete sanitized.secret;
        return sanitized;
    }

    sanitizeArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                return this.sanitizeContext(arg);
            }
            return arg;
        });
    }

    getEventHistory(eventName, limit = 50) {
        const history = this.eventHistory.get(eventName) || [];
        return history.slice(-limit);
    }

    getEventStats() {
        const stats = {};
        
        for (const [eventName, history] of this.eventHistory.entries()) {
            stats[eventName] = {
                count: history.length,
                lastOccurred: history.length > 0 ? history[history.length - 1].timestamp : null,
                rate: this.calculateEventRate(history)
            };
        }
        
        return stats;
    }

    calculateEventRate(history) {
        if (history.length < 2) return 0;
        
        const first = history[0].timestamp;
        const last = history[history.length - 1].timestamp;
        const duration = last - first;
        
        return (history.length / duration) * 1000 * 60; // Events per minute
    }
}

// Usage in Order Service
class OrderService {
    constructor(eventEmitter) {
        this.eventEmitter = eventEmitter;
        this.processOrder = this.processOrder.bind(this); // Bind for async callbacks
        this.handlePaymentSuccess = this.handlePaymentSuccess.bind(this);
        this.handlePaymentFailure = this.handlePaymentFailure.bind(this);

        // Register event handlers
        this.eventEmitter.on('order.created', this.processOrder);
        this.eventEmitter.on('payment.success', this.handlePaymentSuccess);
        this.eventEmitter.on('payment.failed', this.handlePaymentFailure);
    }

    async createOrder(orderData) {
        const order = await Order.create(orderData);
        
        const context = {
            orderId: order.id,
            userId: order.userId,
            amount: order.total,
            timestamp: new Date(),
            source: 'order-service'
        };

        await this.eventEmitter.emitWithContext('order.created', context, order);
        
        return order;
    }

    async processOrder(context, order) {
        try {
            console.log(`Processing order ${order.id} for user ${context.userId}`);
            
            // Update order status
            order.status = 'processing';
            await order.save();

            // Emit payment event
            const paymentContext = {
                ...context,
                paymentMethod: order.paymentMethod
            };

            await this.eventEmitter.emitWithContext('payment.requested', paymentContext, order);
            
        } catch (error) {
            console.error(`Failed to process order ${order.id}:`, error);
            
            // Emit failure event
            const errorContext = {
                ...context,
                error: error.message
            };
            
            await this.eventEmitter.emitWithContext('order.processing_failed', errorContext, order);
        }
    }

    async handlePaymentSuccess(context, paymentResult) {
        try {
            const order = await Order.findById(context.orderId);
            if (!order) {
                throw new Error(`Order ${context.orderId} not found`);
            }

            order.status = 'completed';
            order.paymentId = paymentResult.id;
            order.paidAt = new Date();
            await order.save();

            // Emit order completed event
            await this.eventEmitter.emitWithContext('order.completed', context, order);

            // Send confirmation email
            await this.sendConfirmationEmail(order);

        } catch (error) {
            console.error(`Failed to handle payment success for order ${context.orderId}:`, error);
        }
    }

    async handlePaymentFailure(context, error) {
        const order = await Order.findById(context.orderId);
        if (order) {
            order.status = 'payment_failed';
            order.paymentError = error.message;
            await order.save();

            // Notify user
            await this.sendPaymentFailureEmail(order, error.message);
        }
    }

    async sendConfirmationEmail(order) {
        // Email sending logic
        console.log(`Sent confirmation email for order ${order.id}`);
    }

    async sendPaymentFailureEmail(order, error) {
        // Email sending logic
        console.log(`Sent payment failure email for order ${order.id}`);
    }
}

// ## 4. Configuration Manager with Dynamic Updates

// ### Dynamic Configuration Service
class ConfigManager {
    constructor() {
        this.config = new Map();
        this.watchers = new Map();
        this.defaults = new Map();
        this.validationRules = new Map();
    }

    set(key, value, options = {}) {
        const { validate = true, persist = false } = options;

        if (validate && this.validationRules.has(key)) {
            const isValid = this.validationRules.get(key)(value);
            if (!isValid) {
                throw new Error(`Invalid value for configuration key: ${key}`);
            }
        }

        const oldValue = this.config.get(key);
        this.config.set(key, value);

        // Notify watchers
        if (this.watchers.has(key)) {
            this.watchers.get(key).forEach(callback => {
                try {
                    callback(value, oldValue, key);
                } catch (error) {
                    console.error(`Error in config watcher for ${key}:`, error);
                }
            });
        }

        // Persist to database if required
        if (persist) {
            this.persistConfig(key, value);
        }

        return this;
    }

    get(key, defaultValue = null) {
        if (this.config.has(key)) {
            return this.config.get(key);
        }

        if (this.defaults.has(key)) {
            const value = this.defaults.get(key);
            this.config.set(key, value); // Cache the default
            return value;
        }

        return defaultValue;
    }

    has(key) {
        return this.config.has(key) || this.defaults.has(key);
    }

    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, []);
        }
        this.watchers.get(key).push(callback);
        
        // Return unwatch function
        return () => {
            const watchers = this.watchers.get(key);
            if (watchers) {
                const index = watchers.indexOf(callback);
                if (index > -1) {
                    watchers.splice(index, 1);
                }
            }
        };
    }

    setDefault(key, value) {
        this.defaults.set(key, value);
        return this;
    }

    setValidationRule(key, validator) {
        this.validationRules.set(key, validator);
        return this;
    }

    async loadFromDatabase() {
        try {
            const configs = await ConfigModel.find({});
            configs.forEach(config => {
                this.set(config.key, config.value, { validate: false, persist: false });
            });
        } catch (error) {
            console.error('Failed to load configuration from database:', error);
        }
    }

    async persistConfig(key, value) {
        try {
            await ConfigModel.findOneAndUpdate(
                { key },
                { key, value, updatedAt: new Date() },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error(`Failed to persist configuration ${key}:`, error);
        }
    }

    toJSON() {
        const result = {};
        
        // Combine config and defaults
        const allKeys = new Set([
            ...this.config.keys(),
            ...this.defaults.keys()
        ]);
        
        for (const key of allKeys) {
            result[key] = this.get(key);
        }
        
        return result;
    }

    // Bulk operations
    setMultiple(configs, options = {}) {
        Object.entries(configs).forEach(([key, value]) => {
            this.set(key, value, options);
        });
        return this;
    }

    getMultiple(keys) {
        const result = {};
        keys.forEach(key => {
            result[key] = this.get(key);
        });
        return result;
    }
}

// Usage in application
const configManager = new ConfigManager();

// Set defaults and validation rules
configManager
    .setDefault('server.port', 3000)
    .setDefault('database.pool.max', 10)
    .setDefault('cache.ttl', 3600)
    .setValidationRule('server.port', value => value > 0 && value < 65536)
    .setValidationRule('database.pool.max', value => value > 0 && value <= 100)
    .setValidationRule('cache.ttl', value => value >= 0);

// Watch for changes
const unwatchPort = configManager.watch('server.port', (newValue, oldValue) => {
    console.log(`Server port changed from ${oldValue} to ${newValue}`);
    
    if (server && server.listening) {
        console.log('Server restart required for port change to take effect');
    }
});

const unwatchCacheTtl = configManager.watch('cache.ttl', (newValue) => {
    cacheService.setDefaultTTL(newValue);
});

// Load configuration from database
await configManager.loadFromDatabase();

// Use in server setup
const serverConfig = {
    port: configManager.get('server.port'),
    environment: configManager.get('environment', 'development'),
    cluster: configManager.get('server.cluster', false)
};

// Dynamic configuration update endpoint
app.put('/admin/config/:key', async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    try {
        configManager.set(key, value, { persist: true });
        res.json({ 
            success: true, 
            message: `Configuration ${key} updated successfully` 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/admin/config', (req, res) => {
    res.json(configManager.toJSON());
});

// ## 5. Cache Service with Method Binding

// ### Advanced Cache Service with `this` Context
class CacheService {
    constructor(redisClient, options = {}) {
        this.redis = redisClient;
        this.namespace = options.namespace || 'app';
        this.defaultTTL = options.defaultTTL || 3600;
        this.compression = options.compression || false;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };

        // Bind methods to maintain `this` context
        this.get = this.get.bind(this);
        this.set = this.set.bind(this);
        this.del = this.del.bind(this);
        this.withCache = this.withCache.bind(this);
        this.getStats = this.getStats.bind(this);
        this.resetStats = this.resetStats.bind(this);
    }

    generateKey(keyspace, key) {
        return `${this.namespace}:${keyspace}:${key}`;
    }

    async get(keyspace, key) {
        const cacheKey = this.generateKey(keyspace, key);
        
        try {
            let data = await this.redis.get(cacheKey);
            
            if (data) {
                if (this.compression) {
                    data = await this.decompress(data);
                }
                
                const parsed = JSON.parse(data);
                this.stats.hits++;
                return parsed;
            }
            
            this.stats.misses++;
            return null;
            
        } catch (error) {
            this.stats.errors++;
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(keyspace, key, value, ttl = this.defaultTTL) {
        const cacheKey = this.generateKey(keyspace, key);
        
        try {
            let data = JSON.stringify(value);
            
            if (this.compression) {
                data = await this.compress(data);
            }
            
            if (ttl > 0) {
                await this.redis.setex(cacheKey, ttl, data);
            } else {
                await this.redis.set(cacheKey, data);
            }
            
            this.stats.sets++;
            return true;
            
        } catch (error) {
            this.stats.errors++;
            console.error('Cache set error:', error);
            return false;
        }
    }

    async del(keyspace, key) {
        const cacheKey = this.generateKey(keyspace, key);
        
        try {
            await this.redis.del(cacheKey);
            this.stats.deletes++;
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache delete error:', error);
            return false;
        }
    }

    async withCache(keyspace, key, asyncFn, ttl = this.defaultTTL) {
        const cached = await this.get(keyspace, key);
        
        if (cached !== null) {
            return cached;
        }

        const freshData = await asyncFn();
        await this.set(keyspace, key, freshData, ttl);
        
        return freshData;
    }

    async mget(keyspace, keys) {
        const cacheKeys = keys.map(key => this.generateKey(keyspace, key));
        
        try {
            const results = await this.redis.mget(cacheKeys);
            
            return results.map((result, index) => {
                if (result) {
                    try {
                        let data = result;
                        if (this.compression) {
                            data = this.decompress(data);
                        }
                        this.stats.hits++;
                        return JSON.parse(data);
                    } catch (error) {
                        this.stats.errors++;
                        return null;
                    }
                }
                this.stats.misses++;
                return null;
            });
            
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }

    async mset(keyspace, keyValuePairs, ttl = this.defaultTTL) {
        const pipeline = this.redis.pipeline();
        
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            const cacheKey = this.generateKey(keyspace, key);
            let data = JSON.stringify(value);
            
            if (this.compression) {
                data = this.compress(data);
            }
            
            if (ttl > 0) {
                pipeline.setex(cacheKey, ttl, data);
            } else {
                pipeline.set(cacheKey, data);
            }
        });

        try {
            await pipeline.exec();
            this.stats.sets += Object.keys(keyValuePairs).length;
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mset error:', error);
            return false;
        }
    }

    async compress(data) {
        // Implementation for compression (e.g., gzip)
        return data; // Simplified
    }

    async decompress(data) {
        // Implementation for decompression
        return data; // Simplified
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate.toFixed(2)}%`,
            namespace: this.namespace
        };
    }

    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
    }

    // Specialized cache methods
    async cacheUser(user) {
        return this.set('users', user.id, user, 7200); // 2 hours
    }

    async getCachedUser(userId) {
        return this.get('users', userId);
    }

    async cacheSession(session) {
        return this.set('sessions', session.id, session, 86400); // 24 hours
    }

    async invalidateUser(userId) {
        await this.del('users', userId);
        // Invalidate related cache entries
        await this.redis.del(`${this.namespace}:users:${userId}:permissions`);
        await this.redis.del(`${this.namespace}:users:${userId}:preferences`);
    }
}

// Usage with method binding
const cacheService = new CacheService(redisClient, {
    namespace: 'myapp',
    defaultTTL: 3600,
    compression: true
});

// The bound methods can be safely passed as callbacks
app.get('/api/users/:id', async (req, res) => {
    const user = await cacheService.withCache(
        'users',
        req.params.id,
        async () => {
            return User.findById(req.params.id);
        }
    );
    
    res.json(user);
});

// Stats endpoint
app.get('/admin/cache/stats', (req, res) => {
    res.json(cacheService.getStats());
});

// ## 6. Job Queue with `this` Context

// ### Background Job Processor
class JobQueue {
    constructor(options = {}) {
        this.queue = [];
        this.processing = false;
        this.concurrency = options.concurrency || 1;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.jobHandlers = new Map();
        this.failedJobs = [];
        this.completedJobs = [];
        
        // Bind methods
        this.addJob = this.addJob.bind(this);
        this.processQueue = this.processQueue.bind(this);
        this.registerHandler = this.registerHandler.bind(this);
        this.getStats = this.getStats.bind(this);
    }

    addJob(type, data, options = {}) {
        const job = {
            id: this.generateJobId(),
            type,
            data,
            attempts: 0,
            maxAttempts: options.maxAttempts || this.retryAttempts,
            delay: options.delay || 0,
            priority: options.priority || 0,
            createdAt: new Date(),
            status: 'queued'
        };

        // Add to queue based on priority
        const index = this.queue.findIndex(qJob => qJob.priority < job.priority);
        if (index === -1) {
            this.queue.push(job);
        } else {
            this.queue.splice(index, 0, job);
        }

        // Start processing if not already running
        if (!this.processing) {
            this.processQueue();
        }

        return job.id;
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.processing) {
            const job = this.queue.shift();
            
            // Apply delay if specified
            if (job.delay > 0) {
                await this.delay(job.delay);
            }

            await this.processJob(job);
        }

        this.processing = false;
    }

    async processJob(job) {
        const handler = this.jobHandlers.get(job.type);
        
        if (!handler) {
            console.error(`No handler registered for job type: ${job.type}`);
            job.status = 'failed';
            this.failedJobs.push(job);
            return;
        }

        try {
            job.status = 'processing';
            job.startedAt = new Date();
            
            await handler(job.data, job);
            
            job.status = 'completed';
            job.completedAt = new Date();
            this.completedJobs.push(job);
            
        } catch (error) {
            job.attempts++;
            job.lastError = error.message;
            
            if (job.attempts >= job.maxAttempts) {
                job.status = 'failed';
                this.failedJobs.push(job);
                console.error(`Job ${job.id} failed after ${job.attempts} attempts:`, error);
            } else {
                // Retry with exponential backoff
                const delay = this.retryDelay * Math.pow(2, job.attempts - 1);
                job.delay = delay;
                job.status = 'queued';
                this.queue.push(job);
                console.warn(`Job ${job.id} failed, retrying in ${delay}ms:`, error);
            }
        }
    }

    registerHandler(type, handler) {
        this.jobHandlers.set(type, handler);
    }

    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            queued: this.queue.length,
            processing: this.processing,
            completed: this.completedJobs.length,
            failed: this.failedJobs.length,
            handlers: Array.from(this.jobHandlers.keys())
        };
    }

    clearCompletedJobs(olderThan = 24 * 60 * 60 * 1000) { // 24 hours
        const cutoff = new Date(Date.now() - olderThan);
        
        this.completedJobs = this.completedJobs.filter(
            job => job.completedAt > cutoff
        );
        
        this.failedJobs = this.failedJobs.filter(
            job => job.completedAt > cutoff
        );
    }

    pause() {
        this.processing = false;
    }

    resume() {
        if (!this.processing && this.queue.length > 0) {
            this.processQueue();
        }
    }
}

// Usage in email service
class EmailService {
    constructor(jobQueue) {
        this.jobQueue = jobQueue;
        
        // Register job handlers
        this.jobQueue.registerHandler('send_welcome_email', this.sendWelcomeEmail.bind(this));
        this.jobQueue.registerHandler('send_password_reset', this.sendPasswordReset.bind(this));
        this.jobQueue.registerHandler('send_notification', this.sendNotification.bind(this));
    }

    async sendWelcomeEmail(data, job) {
        const { email, name } = data;
        
        // Simulate email sending
        await this.delay(1000);
        
        console.log(`Sent welcome email to ${email} for ${name}`);
        
        // Update job progress
        job.progress = 100;
    }

    async sendPasswordReset(data, job) {
        const { email, resetToken } = data;
        
        await this.delay(500);
        
        console.log(`Sent password reset email to ${email}`);
        job.progress = 100;
    }

    async sendNotification(data, job) {
        const { userId, message } = data;
        
        await this.delay(200);
        
        console.log(`Sent notification to user ${userId}: ${message}`);
        job.progress = 100;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public methods to queue jobs
    queueWelcomeEmail(email, name) {
        return this.jobQueue.addJob('send_welcome_email', { email, name }, {
            priority: 1
        });
    }

    queuePasswordReset(email, resetToken) {
        return this.jobQueue.addJob('send_password_reset', { email, resetToken }, {
            priority: 10 // High priority
        });
    }
}

// Usage in application
const jobQueue = new JobQueue({
    concurrency: 3,
    retryAttempts: 5,
    retryDelay: 2000
});

const emailService = new EmailService(jobQueue);

// Queue emails from API endpoints
app.post('/api/users', async (req, res) => {
    const user = await User.create(req.body);
    
    // Queue welcome email (non-blocking)
    emailService.queueWelcomeEmail(user.email, user.name);
    
    res.status(201).json(user);
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { email } = req.body;
    const resetToken = generateResetToken();
    
    // Queue password reset email (high priority)
    emailService.queuePasswordReset(email, resetToken);
    
    res.json({ message: 'Password reset email sent' });
});

// Admin endpoint to monitor jobs
app.get('/admin/jobs/stats', (req, res) => {
    res.json(jobQueue.getStats());
});

// These production-grade examples demonstrate how object methods and proper `this` context management enable:
// - **Method chaining** for fluent APIs
// - **State management** within service objects
// - **Event handling** with proper context binding
// - **Dynamic configuration** with change notifications
// - **Cache management** with statistics tracking
// - **Background job processing** with retry mechanisms

// The key is using `this` to maintain object state across method calls and properly binding methods when they're passed as callbacks to maintain context.

































// Here are comprehensive code snippets for constructor functions in Node.js production-grade backend development:

// ## 1. Basic Constructor Function Pattern

// Traditional constructor function
function User(name, email, role = 'user') {
  // Validation
  if (!name || !email) {
    throw new Error('Name and email are required');
  }

  // Instance properties
  this.name = name;
  this.email = email;
  this.role = role;
  this.createdAt = new Date();
  this.isActive = true;

  // Methods (added to prototype for memory efficiency)
  User.prototype.getProfile = function() {
    return {
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive
    };
  };

  User.prototype.deactivate = function() {
    this.isActive = false;
    return this;
  };

  User.prototype.activate = function() {
    this.isActive = true;
    return this;
  };
}

// Usage
const user1 = new User('John Doe', 'john@example.com');
console.log(user1.getProfile());

// ## 2. ES6 Class Syntax (Recommended for Production)

class User {
  constructor(name, email, role = 'user') {
    // Input validation
    if (!name || typeof name !== 'string') {
      throw new Error('Valid name is required');
    }
    
    if (!this.isValidEmail(email)) {
      throw new Error('Valid email is required');
    }

    // Private fields (using naming convention)
    this._name = name;
    this._email = email;
    this._role = role;
    this._createdAt = new Date();
    this._isActive = true;
    this._id = this.generateId();
  }

  // Private method (convention)
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  generateId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  get name() {
    return this._name;
  }

  get email() {
    return this._email;
  }

  get profile() {
    return {
      id: this._id,
      name: this._name,
      email: this._email,
      role: this._role,
      isActive: this._isActive,
      createdAt: this._createdAt
    };
  }

  // Setters with validation
  set name(newName) {
    if (!newName || typeof newName !== 'string') {
      throw new Error('Valid name is required');
    }
    this._name = newName;
  }

  set email(newEmail) {
    if (!this.isValidEmail(newEmail)) {
      throw new Error('Valid email is required');
    }
    this._email = newEmail;
  }

  // Business logic methods
  deactivate() {
    this._isActive = false;
    return this;
  }

  activate() {
    this._isActive = true;
    return this;
  }

  updateProfile(updates) {
    const allowedUpdates = ['name', 'email'];
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        this[key] = updates[key];
      }
    });
    return this;
  }

  // Static methods
  static createAdmin(name, email) {
    return new User(name, email, 'admin');
  }

  static validateUserData(userData) {
    return userData.name && userData.email && this.prototype.isValidEmail(userData.email);
  }
}

// Usage
try {
  const admin = User.createAdmin('Admin User', 'admin@example.com');
  const regularUser = new User('Regular User', 'user@example.com');
  
  console.log(admin.profile);
  console.log(regularUser.profile);
} catch (error) {
  console.error('Error creating user:', error.message);
}

// ## 3. Database Model Constructor

const { v4: uuidv4 } = require('uuid');

class Product {
  constructor(productData) {
    this.validateProductData(productData);

    this.id = productData.id || uuidv4();
    this.name = productData.name;
    this.description = productData.description;
    this.price = this.validatePrice(productData.price);
    this.category = productData.category;
    this.inStock = productData.inStock || 0;
    this.sku = productData.sku || this.generateSKU();
    this.tags = productData.tags || [];
    this.metadata = productData.metadata || {};
    this.createdAt = productData.createdAt || new Date();
    this.updatedAt = new Date();
    this.isActive = productData.isActive !== false;
  }

  validateProductData(data) {
    const required = ['name', 'price', 'category'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (data.price && data.price < 0) {
      throw new Error('Price cannot be negative');
    }
  }

  validatePrice(price) {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      throw new Error('Invalid price');
    }
    return Math.round(parsedPrice * 100) / 100; // Round to 2 decimal places
  }

  generateSKU() {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${random}`;
  }

  // Business logic methods
  updateStock(quantity) {
    const newStock = this.inStock + quantity;
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
    this.inStock = newStock;
    this.updatedAt = new Date();
    return this;
  }

  applyDiscount(percentage) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    this.price = this.price * (1 - percentage / 100);
    this.updatedAt = new Date();
    return this;
  }

  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
    return this;
  }

  // Serialization methods
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category: this.category,
      inStock: this.inStock,
      sku: this.sku,
      tags: this.tags,
      metadata: this.metadata,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Static factory methods
  static createFromDatabase(row) {
    return new Product(row);
  }

  static createBulk(productsData) {
    return productsData.map(data => new Product(data));
  }
}

// Usage in service layer
class ProductService {
  constructor() {
    this.products = new Map();
  }

  createProduct(productData) {
    try {
      const product = new Product(productData);
      this.products.set(product.id, product);
      return product;
    } catch (error) {
      throw new Error(`Product creation failed: ${error.message}`);
    }
  }

  updateProductStock(productId, quantity) {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return product.updateStock(quantity);
  }
}

// ## 4. Service Layer Constructor with Dependency Injection

// Database abstraction
class Database {
  constructor(connectionString, options = {}) {
    this.connectionString = connectionString;
    this.options = options;
    this.isConnected = false;
  }

  async connect() {
    // Simulate database connection
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isConnected = true;
    console.log('Database connected');
  }

  async query(sql, params) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    // Simulate query execution
    return { rows: [], count: 0 };
  }
}

// Logger service
class Logger {
  constructor(level = 'info', transport = 'console') {
    this.level = level;
    this.transport = transport;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  log(level, message, meta = {}) {
    if (this.levels[level] <= this.levels[this.level]) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
      };
      console.log(JSON.stringify(logEntry));
    }
  }

  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
  info(message, meta) { this.log('info', message, meta); }
  debug(message, meta) { this.log('debug', message, meta); }
}

// Main service with dependency injection
class UserService {
  constructor(database, logger, config = {}) {
    if (!database || !logger) {
      throw new Error('Database and Logger dependencies are required');
    }

    this.db = database;
    this.logger = logger;
    this.config = {
      maxUsers: config.maxUsers || 1000,
      cacheEnabled: config.cacheEnabled !== false,
      ...config
    };
    
    this.cache = new Map();
    this.metrics = {
      usersCreated: 0,
      errors: 0
    };
  }

  async initialize() {
    try {
      await this.db.connect();
      this.logger.info('UserService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize UserService', { error: error.message });
      throw error;
    }
  }

  async createUser(userData) {
    try {
      // Validate business rules
      if (this.metrics.usersCreated >= this.config.maxUsers) {
        throw new Error('Maximum user limit reached');
      }

      const user = new User(userData);
      
      // Simulate database save
      await this.db.query(
        'INSERT INTO users VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.email, user.createdAt]
      );

      this.metrics.usersCreated++;
      this.logger.info('User created successfully', { userId: user.id, email: user.email });

      // Cache user if enabled
      if (this.config.cacheEnabled) {
        this.cache.set(user.id, user);
      }

      return user;

    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to create user', { 
        error: error.message, 
        userData: { email: userData.email } 
      });
      throw error;
    }
  }

  async getUser(userId) {
    // Check cache first
    if (this.config.cacheEnabled && this.cache.has(userId)) {
      return this.cache.get(userId);
    }

    // Fetch from database
    const result = await this.db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = User.createFromDatabase(result.rows[0]);
    
    // Update cache
    if (this.config.cacheEnabled) {
      this.cache.set(userId, user);
    }

    return user;
  }

  getMetrics() {
    return { ...this.metrics, cacheSize: this.cache.size };
  }
}

// Factory function for service creation
function createUserService(config = {}) {
  const database = new Database(config.databaseUrl, {
    poolSize: config.dbPoolSize || 10,
    timeout: config.dbTimeout || 30000
  });

  const logger = new Logger(config.logLevel || 'info', config.logTransport || 'console');

  return new UserService(database, logger, config);
}

// Usage
async function main() {
  try {
    const userService = createUserService({
      databaseUrl: 'postgresql://localhost:5432/mydb',
      logLevel: 'debug',
      maxUsers: 500
    });

    await userService.initialize();

    const user = await userService.createUser({
      name: 'Jane Smith',
      email: 'jane@example.com'
    });

    console.log('Created user:', user.profile);
    console.log('Service metrics:', userService.getMetrics());

  } catch (error) {
    console.error('Application error:', error.message);
  }
}

// ## 5. Configuration Object Constructor

class AppConfig {
  constructor(config = {}) {
    this.environment = config.environment || process.env.NODE_ENV || 'development';
    this.port = config.port || process.env.PORT || 3000;
    this.database = this.validateDatabaseConfig(config.database);
    this.redis = this.validateRedisConfig(config.redis);
    this.jwt = this.validateJWTConfig(config.jwt);
    this.cors = this.validateCORSConfig(config.cors);
    this.rateLimit = this.validateRateLimitConfig(config.rateLimit);
  }

  validateDatabaseConfig(dbConfig = {}) {
    const defaultConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'app_db',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'password',
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000
      }
    };

    return { ...defaultConfig, ...dbConfig };
  }

  validateRedisConfig(redisConfig = {}) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      ...redisConfig
    };
  }

  validateJWTConfig(jwtConfig = {}) {
    const secret = process.env.JWT_SECRET;
    if (!secret && this.environment === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }

    return {
      secret: secret || 'development-secret',
      expiresIn: '24h',
      issuer: 'myapp',
      ...jwtConfig
    };
  }

  validateCORSConfig(corsConfig = {}) {
    const defaults = {
      origin: this.environment === 'production' 
        ? ['https://myapp.com'] 
        : ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    };

    return { ...defaults, ...corsConfig };
  }

  validateRateLimitConfig(rateLimitConfig = {}) {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      ...rateLimitConfig
    };
  }

  isProduction() {
    return this.environment === 'production';
  }

  isDevelopment() {
    return this.environment === 'development';
  }

  toJSON() {
    const config = { ...this };
    // Remove sensitive data from serialization
    if (config.database && config.database.password) {
      config.database.password = '***';
    }
    if (config.redis && config.redis.password) {
      config.redis.password = '***';
    }
    if (config.jwt && config.jwt.secret) {
      config.jwt.secret = '***';
    }
    return config;
  }
}

// Usage
const config = new AppConfig({
  environment: process.env.NODE_ENV,
  database: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASS
  },
  rateLimit: {
    max: process.env.NODE_ENV === 'production' ? 50 : 1000
  }
});

console.log('App Config:', config.toJSON());

// These code snippets demonstrate production-grade constructor patterns in Node.js with:

// - **Input validation and error handling**
// - **Encapsulation and data integrity**
// - **Dependency injection for testability**
// - **Configuration management**
// - **Memory efficiency with prototype methods**
// - **Serialization methods**
// - **Static factory methods**
// - **Comprehensive logging and metrics**
// - **Environment-specific configurations**

// Choose the pattern that best fits your use case, with ES6 classes being the most recommended for modern Node.js development.


































// Here are the best use cases of `new.target` in Node.js backend development with practical code snippets:

// ## 1. Abstract Base Class Enforcement

// Abstract service class that cannot be instantiated directly
class AbstractService {
  constructor() {
    if (new.target === AbstractService) {
      throw new Error('AbstractService cannot be instantiated directly');
    }
    
    if (!this.execute) {
      throw new Error('Child classes must implement execute() method');
    }
    
    this.serviceName = this.constructor.name;
    this.createdAt = new Date();
  }
}

// Concrete implementation
class EmailService extends AbstractService {
  constructor(smtpConfig) {
    super();
    this.smtpConfig = smtpConfig;
  }

  async execute(payload) {
    console.log(`Sending email via ${this.serviceName}`);
    // Email sending logic
    return { success: true, service: this.serviceName };
  }
}

// Another concrete implementation
class SMSService extends AbstractService {
  constructor(twilioConfig) {
    super();
    this.twilioConfig = twilioConfig;
  }

  async execute(payload) {
    console.log(`Sending SMS via ${this.serviceName}`);
    // SMS sending logic
    return { success: true, service: this.serviceName };
  }
}

// Usage
try {
  // This will throw error - cannot instantiate abstract class
  // const service = new AbstractService();
  
  const emailService = new EmailService({ host: 'smtp.example.com' });
  const smsService = new SMSService({ accountSid: 'abc123' });
  
  console.log(await emailService.execute({ to: 'user@example.com' }));
  console.log(await smsService.execute({ to: '+1234567890' }));
} catch (error) {
  console.error('Error:', error.message);
}

// ## 2. Secure Factory Pattern with Constructor Validation

class DatabaseConnection {
  constructor(connectionString, options = {}) {
    if (new.target === DatabaseConnection) {
      throw new Error('DatabaseConnection must be created via factory method');
    }
    
    this.connectionString = connectionString;
    this.options = options;
    this.isConnected = false;
    this.connectionId = this.generateConnectionId();
  }

  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Factory method
  static create(connectionString, options = {}) {
    class SecureConnection extends DatabaseConnection {
      constructor(connectionString, options) {
        super(connectionString, options);
        this.validateConnectionString(connectionString);
      }

      validateConnectionString(connString) {
        if (!connString || typeof connString !== 'string') {
          throw new Error('Invalid connection string');
        }
        
        // Additional validation logic
        if (!connString.includes('://')) {
          throw new Error('Malformed connection string');
        }
      }

      async connect() {
        if (this.isConnected) {
          throw new Error('Connection already established');
        }
        
        // Simulate connection logic
        await new Promise(resolve => setTimeout(resolve, 100));
        this.isConnected = true;
        console.log(`Connected to database with ID: ${this.connectionId}`);
        return this;
      }

      async disconnect() {
        this.isConnected = false;
        console.log(`Disconnected: ${this.connectionId}`);
      }
    }

    return new SecureConnection(connectionString, options);
  }
}

// Usage
async function databaseDemo() {
  try {
    // This will throw error - must use factory method
    // const conn = new DatabaseConnection('postgresql://localhost:5432/mydb');
    
    const connection = DatabaseConnection.create('postgresql://localhost:5432/mydb', {
      poolSize: 10,
      timeout: 30000
    });
    
    await connection.connect();
    await connection.disconnect();
    
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

databaseDemo();

// ## 3. Plugin System with Registration Enforcement

class Plugin {
  constructor() {
    if (new.target === Plugin) {
      throw new Error('Plugin is abstract and cannot be instantiated directly');
    }
    
    // Auto-register plugin when instantiated
    this.register();
  }

  register() {
    const pluginName = this.constructor.name;
    
    if (!this.getName) {
      throw new Error(`Plugin ${pluginName} must implement getName() method`);
    }
    
    if (!this.execute) {
      throw new Error(`Plugin ${pluginName} must implement execute() method`);
    }
    
    PluginRegistry.register(this);
    console.log(`Plugin registered: ${this.getName()}`);
  }
}

class PluginRegistry {
  static plugins = new Map();

  static register(plugin) {
    const name = plugin.getName();
    if (this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' is already registered`);
    }
    this.plugins.set(name, plugin);
  }

  static getPlugin(name) {
    return this.plugins.get(name);
  }

  static executePlugin(name, data) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }
    return plugin.execute(data);
  }
}

// Concrete plugins
class AuthenticationPlugin extends Plugin {
  getName() {
    return 'authentication';
  }

  execute(userData) {
    console.log('Authenticating user:', userData.username);
    return { authenticated: true, user: userData.username };
  }
}

class LoggingPlugin extends Plugin {
  getName() {
    return 'logging';
  }

  execute(logData) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${logData.message}`);
    return { logged: true, timestamp };
  }
}

// Usage
function pluginDemo() {
  try {
    // This will throw error
    // const plugin = new Plugin();
    
    const authPlugin = new AuthenticationPlugin();
    const loggingPlugin = new LoggingPlugin();
    
    // Execute plugins
    const authResult = PluginRegistry.executePlugin('authentication', {
      username: 'john_doe',
      password: 'secret'
    });
    
    const logResult = PluginRegistry.executePlugin('logging', {
      message: 'User authenticated successfully',
      level: 'info'
    });
    
    console.log('Auth result:', authResult);
    console.log('Log result:', logResult);
    
  } catch (error) {
    console.error('Plugin error:', error.message);
  }
}

pluginDemo();

// ## 4. Middleware Chain with Constructor Validation

class Middleware {
  constructor() {
    if (new.target === Middleware) {
      throw new Error('Middleware is abstract and cannot be instantiated directly');
    }
    
    if (typeof this.handle !== 'function') {
      throw new Error('Middleware must implement handle() method');
    }
    
    this.middlewareName = this.constructor.name;
  }

  static createChain(...middlewares) {
    return new MiddlewareChain(middlewares);
  }
}

class MiddlewareChain {
  constructor(middlewares = []) {
    this.middlewares = middlewares;
  }

  use(middleware) {
    if (!(middleware instanceof Middleware)) {
      throw new Error('Middleware must extend Base Middleware class');
    }
    this.middlewares.push(middleware);
    return this; // For chaining
  }

  async execute(context) {
    let index = 0;
    
    const next = async () => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return await middleware.handle(context, next);
      }
    };
    
    await next();
    return context;
  }
}

// Concrete middleware implementations
class AuthenticationMiddleware extends Middleware {
  async handle(context, next) {
    console.log('AuthenticationMiddleware: Checking authentication');
    
    if (!context.headers?.authorization) {
      throw new Error('Authentication required');
    }
    
    // Simulate token validation
    context.user = { id: 1, username: 'john_doe' };
    console.log('AuthenticationMiddleware: User authenticated');
    
    await next();
  }
}

class LoggingMiddleware extends Middleware {
  async handle(context, next) {
    const startTime = Date.now();
    console.log('LoggingMiddleware: Request started');
    
    await next();
    
    const duration = Date.now() - startTime;
    console.log(`LoggingMiddleware: Request completed in ${duration}ms`);
  }
}

class ValidationMiddleware extends Middleware {
  async handle(context, next) {
    console.log('ValidationMiddleware: Validating request data');
    
    if (context.body && Object.keys(context.body).length === 0) {
      throw new Error('Request body cannot be empty');
    }
    
    console.log('ValidationMiddleware: Request data validated');
    await next();
  }
}

// Usage
async function middlewareDemo() {
  try {
    // This will throw error
    // const mw = new Middleware();
    
    const chain = Middleware.createChain(
      new LoggingMiddleware(),
      new AuthenticationMiddleware(),
      new ValidationMiddleware()
    );
    
    const context = {
      headers: {
        authorization: 'Bearer token123'
      },
      body: {
        message: 'Hello World'
      },
      method: 'POST',
      url: '/api/test'
    };
    
    await chain.execute(context);
    console.log('Final context:', context);
    
  } catch (error) {
    console.error('Middleware error:', error.message);
  }
}

middlewareDemo();

// ## 5. Advanced: Repository Pattern with Dynamic Implementation

class Repository {
  constructor() {
    if (new.target === Repository) {
      throw new Error('Repository is abstract and cannot be instantiated directly');
    }
    
    this.entityName = this.constructor.name.replace('Repository', '').toLowerCase();
    this.initialize();
  }

  initialize() {
    // Template method pattern
    console.log(`Initializing ${this.entityName} repository`);
  }

  // Abstract methods that must be implemented
  async findById(id) {
    throw new Error('findById method must be implemented');
  }

  async save(entity) {
    throw new Error('save method must be implemented');
  }

  async delete(id) {
    throw new Error('delete method must be implemented');
  }

  // Factory method for creating repository instances
  static create(entityClass, implementation = 'memory') {
    class DynamicRepository extends Repository {
      constructor() {
        super();
        this.storage = new Map();
      }

      async findById(id) {
        const entity = this.storage.get(id);
        if (!entity) {
          throw new Error(`${this.entityName} with id ${id} not found`);
        }
        return entity;
      }

      async save(entity) {
        if (!entity.id) {
          entity.id = ` ${this.entityName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        this.storage.set(entity.id, entity);
        console.log(`Saved ${this.entityName} with id: ${entity.id}`);
        return entity;
      }

      async delete(id) {
        const exists = this.storage.has(id);
        if (!exists) {
          throw new Error(`${this.entityName} with id ${id} not found`);
        }
        this.storage.delete(id);
        console.log(`Deleted ${this.entityName} with id: ${id}`);
        return true;
      }

      async findAll() {
        return Array.from(this.storage.values());
      }
    }

    return new DynamicRepository();
  }
}

// Usage
async function repositoryDemo() {
  try {
    // This will throw error
    // const repo = new Repository();
    
    const userRepository = Repository.create('User');
    const productRepository = Repository.create('Product');
    
    // User operations
    const user = await userRepository.save({
      name: 'John Doe',
      email: 'john@example.com'
    });
    
    const foundUser = await userRepository.findById(user.id);
    console.log('Found user:', foundUser);
    
    // Product operations
    const product = await productRepository.save({
      name: 'Laptop',
      price: 999.99,
      category: 'Electronics'
    });
    
    const allProducts = await productRepository.findAll();
    console.log('All products:', allProducts);
    
    // Cleanup
    await userRepository.delete(user.id);
    await productRepository.delete(product.id);
    
  } catch (error) {
    console.error('Repository error:', error.message);
  }
}

repositoryDemo();

// ## Key Benefits of `new.target` in Production:

// 1. **Abstract Class Enforcement** - Prevents direct instantiation of base classes
// 2. **Secure Factory Patterns** - Ensures objects are created through controlled factories
// 3. **Plugin System Integrity** - Validates plugin implementations at construction time
// 4. **Framework Development** - Essential for building extensible frameworks and libraries
// 5. **Runtime Validation** - Catches implementation errors early during instantiation

// These patterns are particularly valuable in large-scale Node.js applications where maintainability, extensibility, and runtime safety are critical concerns.

































// Here are comprehensive code snippets for JavaScript prototype in Node.js production-grade backend development:

// ## 1. Prototype-Based Inheritance for Service Classes

// Base Service Prototype
function BaseService(serviceName) {
  if (!new.target) {
    throw new Error('BaseService must be called with new');
  }
  
  this.serviceName = serviceName;
  this.startedAt = new Date();
  this.metrics = {
    requests: 0,
    errors: 0,
    latency: 0
  };
}

// Base methods on prototype
BaseService.prototype = {
  constructor: BaseService,
  
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${message}`);
  },
  
  updateMetrics(latency = 0, error = false) {
    this.metrics.requests++;
    this.metrics.latency = (this.metrics.latency + latency) / 2;
    if (error) this.metrics.errors++;
  },
  
  async execute() {
    throw new Error('execute method must be implemented by child service');
  },
  
  getHealth() {
    return {
      service: this.serviceName,
      uptime: Date.now() - this.startedAt.getTime(),
      metrics: { ...this.metrics },
      status: 'healthy'
    };
  }
};

// Database Service inheriting from BaseService
function DatabaseService(connectionConfig) {
  BaseService.call(this, 'DatabaseService');
  this.connectionConfig = connectionConfig;
  this.isConnected = false;
  this.connectionPool = new Map();
}

// Set up prototype chain
DatabaseService.prototype = Object.create(BaseService.prototype);
DatabaseService.prototype.constructor = DatabaseService;

// Database-specific methods
DatabaseService.prototype.connect = async function() {
  const startTime = Date.now();
  try {
    // Simulate connection logic
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isConnected = true;
    this.log('Database connected successfully');
    this.updateMetrics(Date.now() - startTime);
    return true;
  } catch (error) {
    this.updateMetrics(Date.now() - startTime, true);
    this.log(`Connection failed: ${error.message}`, 'error');
    throw error;
  }
};

DatabaseService.prototype.query = async function(sql, params = []) {
  const startTime = Date.now();
  try {
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 50));
    const result = { rows: [{ id: 1, data: 'mock' }], count: 1 };
    this.updateMetrics(Date.now() - startTime);
    this.log(`Query executed: ${sql}`);
    return result;
  } catch (error) {
    this.updateMetrics(Date.now() - startTime, true);
    this.log(`Query failed: ${error.message}`, 'error');
    throw error;
  }
};

// Cache Service inheriting from BaseService
function CacheService(redisConfig) {
  BaseService.call(this, 'CacheService');
  this.redisConfig = redisConfig;
  this.cache = new Map();
  this.hits = 0;
  this.misses = 0;
}

CacheService.prototype = Object.create(BaseService.prototype);
CacheService.prototype.constructor = CacheService;

CacheService.prototype.set = function(key, value, ttl = 3600) {
  const item = {
    value,
    expiresAt: Date.now() + (ttl * 1000)
  };
  this.cache.set(key, item);
  this.log(`Cache set: ${key}`);
  return true;
};

CacheService.prototype.get = function(key) {
  const item = this.cache.get(key);
  if (!item) {
    this.misses++;
    this.log(`Cache miss: ${key}`, 'debug');
    return null;
  }
  
  if (Date.now() > item.expiresAt) {
    this.cache.delete(key);
    this.misses++;
    this.log(`Cache expired: ${key}`, 'debug');
    return null;
  }
  
  this.hits++;
  this.log(`Cache hit: ${key}`, 'debug');
  return item.value;
};

CacheService.prototype.getStats = function() {
  const hitRate = this.hits + this.misses > 0 
    ? (this.hits / (this.hits + this.misses)) * 100 
    : 0;
    
  return {
    ...this.getHealth(),
    cacheSize: this.cache.size,
    hits: this.hits,
    misses: this.misses,
    hitRate: `${hitRate.toFixed(2)}%`
  };
};

// Usage
async function serviceDemo() {
  const dbService = new DatabaseService({
    host: 'localhost',
    port: 5432,
    database: 'myapp'
  });
  
  const cacheService = new CacheService({
    host: 'localhost',
    port: 6379
  });
  
  await dbService.connect();
  const result = await dbService.query('SELECT * FROM users WHERE id = ?', [1]);
  console.log('Query result:', result);
  
  cacheService.set('user:1', { id: 1, name: 'John' }, 60);
  const cachedUser = cacheService.get('user:1');
  console.log('Cached user:', cachedUser);
  
  console.log('DB Health:', dbService.getHealth());
  console.log('Cache Stats:', cacheService.getStats());
}

serviceDemo();

// ## 2. Prototype Mixins for Cross-Cutting Concerns

// Logging Mixin
const Loggable = {
  log(message, level = 'info') {
    const logger = this.getLogger ? this.getLogger() : console;
    const context = this.getLogContext ? this.getLogContext() : {};
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    logger.log(JSON.stringify(logEntry));
  },
  
  error(message, error = null) {
    this.log(message, 'error');
    if (error) {
      this.log(`Error details: ${error.message}`, 'error');
    }
  },
  
  warn(message) {
    this.log(message, 'warn');
  },
  
  debug(message) {
    this.log(message, 'debug');
  }
};

// Validation Mixin
const Validatable = {
  validate(schema, data) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
        }
        
        if (rules.min && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        
        if (rules.max && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    return true;
  }
};

// Cacheable Mixin
const Cacheable = {
  initCache() {
    if (!this._cache) {
      this._cache = new Map();
      this._cacheHits = 0;
      this._cacheMisses = 0;
    }
  },
  
  getFromCache(key) {
    this.initCache();
    if (this._cache.has(key)) {
      this._cacheHits++;
      return this._cache.get(key);
    }
    this._cacheMisses++;
    return null;
  },
  
  setToCache(key, value, ttl = 300) {
    this.initCache();
    const item = {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    };
    this._cache.set(key, item);
  },
  
  clearCache() {
    if (this._cache) {
      this._cache.clear();
      this._cacheHits = 0;
      this._cacheMisses = 0;
    }
  },
  
  getCacheStats() {
    this.initCache();
    const total = this._cacheHits + this._cacheMisses;
    const hitRate = total > 0 ? (this._cacheHits / total) * 100 : 0;
    
    return {
      size: this._cache.size,
      hits: this._cacheHits,
      misses: this._cacheMisses,
      hitRate: `${hitRate.toFixed(2)}%`
    };
  }
};

// User Service using mixins
function UserService(database) {
  this.database = database;
  this.serviceName = 'UserService';
  
  // Initialize mixins
  Object.assign(this, Loggable, Validatable, Cacheable);
}

UserService.prototype.getLogContext = function() {
  return {
    service: this.serviceName,
    timestamp: new Date().toISOString()
  };
};

UserService.prototype.getUserSchema = function() {
  return {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    age: { type: 'number', min: 0, max: 150 }
  };
};

UserService.prototype.createUser = async function(userData) {
  try {
    this.log('Creating new user', 'info');
    
    // Validate input
    this.validate(this.getUserSchema(), userData);
    
    // Check cache first
    const cacheKey = `user:${userData.email}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.log('User found in cache', 'debug');
      return cached;
    }
    
    // Simulate database operation
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date()
    };
    
    // Cache the result
    this.setToCache(cacheKey, user, 300);
    
    this.log(`User created successfully: ${user.id}`, 'info');
    return user;
    
  } catch (error) {
    this.error('Failed to create user', error);
    throw error;
  }
};

UserService.prototype.getUser = async function(userId) {
  const cacheKey = `user:${userId}`;
  const cached = this.getFromCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Simulate database fetch
  const user = { id: userId, name: 'Test User', email: 'test@example.com' };
  this.setToCache(cacheKey, user, 300);
  return user;
};

// Usage
async function mixinDemo() {
  const userService = new UserService({});
  
  try {
    const user = await userService.createUser({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });
    
    console.log('Created user:', user);
    console.log('Cache stats:', userService.getCacheStats());
    
    // This will throw validation error
    await userService.createUser({
      name: 'Jane Doe',
      email: 'invalid-email',
      age: 200
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

mixinDemo();

// ## 3. Prototype Chain for Middleware System

// Base Middleware Prototype
function Middleware(name) {
  this.name = name;
  this.next = null;
}

Middleware.prototype = {
  constructor: Middleware,
  
  setNext(middleware) {
    this.next = middleware;
    return middleware; // For chaining
  },
  
  async handle(request, response) {
    throw new Error('handle method must be implemented');
  },
  
  async next(request, response) {
    if (this.next) {
      return await this.next.handle(request, response);
    }
    return { request, response };
  }
};

// Authentication Middleware
function AuthMiddleware() {
  Middleware.call(this, 'AuthMiddleware');
  this.requiredRoles = ['user', 'admin'];
}

AuthMiddleware.prototype = Object.create(Middleware.prototype);
AuthMiddleware.prototype.constructor = AuthMiddleware;

AuthMiddleware.prototype.handle = async function(request, response) {
  console.log('AuthMiddleware: Checking authentication');
  
  const token = request.headers?.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('Authentication token required');
  }
  
  // Simulate token validation
  const user = this.validateToken(token);
  if (!user) {
    throw new Error('Invalid authentication token');
  }
  
  // Check roles
  if (!this.requiredRoles.includes(user.role)) {
    throw new Error('Insufficient permissions');
  }
  
  request.user = user;
  console.log('AuthMiddleware: User authenticated:', user.username);
  
  return await this.next(request, response);
};

AuthMiddleware.prototype.validateToken = function(token) {
  // Simulate token validation
  return token === 'valid-token' 
    ? { id: 1, username: 'john_doe', role: 'user' }
    : null;
};

// Logging Middleware
function LoggingMiddleware() {
  Middleware.call(this, 'LoggingMiddleware');
}

LoggingMiddleware.prototype = Object.create(Middleware.prototype);
LoggingMiddleware.prototype.constructor = LoggingMiddleware;

LoggingMiddleware.prototype.handle = async function(request, response) {
  const startTime = Date.now();
  console.log('LoggingMiddleware: Request started', {
    method: request.method,
    path: request.path,
    timestamp: new Date().toISOString()
  });
  
  try {
    const result = await this.next(request, response);
    const duration = Date.now() - startTime;
    
    console.log('LoggingMiddleware: Request completed', {
      method: request.method,
      path: request.path,
      duration: `${duration}ms`,
      status: 'success'
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('LoggingMiddleware: Request failed', {
      method: request.method,
      path: request.path,
      duration: `${duration}ms`,
      error: error.message,
      status: 'error'
    });
    throw error;
  }
};

// Validation Middleware
function ValidationMiddleware(schema) {
  Middleware.call(this, 'ValidationMiddleware');
  this.schema = schema;
}

ValidationMiddleware.prototype = Object.create(Middleware.prototype);
ValidationMiddleware.prototype.constructor = ValidationMiddleware;

ValidationMiddleware.prototype.handle = async function(request, response) {
  console.log('ValidationMiddleware: Validating request body');
  
  if (!request.body) {
    throw new Error('Request body is required');
  }
  
  this.validateAgainstSchema(request.body);
  console.log('ValidationMiddleware: Request body validated successfully');
  
  return await this.next(request, response);
};

ValidationMiddleware.prototype.validateAgainstSchema = function(data) {
  for (const [field, rules] of Object.entries(this.schema)) {
    const value = data[field];
    
    if (rules.required && value === undefined) {
      throw new Error(`Field '${field}' is required`);
    }
    
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      throw new Error(`Field '${field}' must be of type ${rules.type}`);
    }
  }
};

// Rate Limiting Middleware
function RateLimitMiddleware(requestsPerMinute = 60) {
  Middleware.call(this, 'RateLimitMiddleware');
  this.requestsPerMinute = requestsPerMinute;
  this.requests = new Map();
}

RateLimitMiddleware.prototype = Object.create(Middleware.prototype);
RateLimitMiddleware.prototype.constructor = RateLimitMiddleware;

RateLimitMiddleware.prototype.handle = async function(request, response) {
  const clientIp = request.ip || 'unknown';
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute ago
  
  // Clean old requests
  this.cleanOldRequests(windowStart);
  
  // Get client requests
  const clientRequests = this.requests.get(clientIp) || [];
  const recentRequests = clientRequests.filter(time => time > windowStart);
  
  if (recentRequests.length >= this.requestsPerMinute) {
    throw new Error('Rate limit exceeded');
  }
  
  // Add current request
  recentRequests.push(now);
  this.requests.set(clientIp, recentRequests);
  
  console.log(`RateLimitMiddleware: ${clientIp} - ${recentRequests.length}/${this.requestsPerMinute} requests`);
  
  return await this.next(request, response);
};

RateLimitMiddleware.prototype.cleanOldRequests = function(windowStart) {
  for (const [ip, requests] of this.requests.entries()) {
    const recent = requests.filter(time => time > windowStart);
    if (recent.length === 0) {
      this.requests.delete(ip);
    } else {
      this.requests.set(ip, recent);
    }
  }
};

// Middleware Chain Builder
function MiddlewareChain() {
  this.middlewares = [];
}

MiddlewareChain.prototype = {
  use(middleware) {
    this.middlewares.push(middleware);
    return this; // For chaining
  },
  
  build() {
    if (this.middlewares.length === 0) {
      throw new Error('No middlewares added to chain');
    }
    
    // Link middlewares in reverse order
    for (let i = this.middlewares.length - 1; i > 0; i--) {
      this.middlewares[i - 1].setNext(this.middlewares[i]);
    }
    
    return this.middlewares[0]; // Return the first middleware
  }
};

// Usage
async function middlewareDemo() {
  const userSchema = {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true }
  };
  
  const chain = new MiddlewareChain()
    .use(new LoggingMiddleware())
    .use(new RateLimitMiddleware(10))
    .use(new AuthMiddleware())
    .use(new ValidationMiddleware(userSchema));
  
  const firstMiddleware = chain.build();
  
  const request = {
    method: 'POST',
    path: '/api/users',
    headers: {
      authorization: 'Bearer valid-token'
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com'
    },
    ip: '192.168.1.100'
  };
  
  const response = {};
  
  try {
    const result = await firstMiddleware.handle(request, response);
    console.log('Request completed successfully:', result);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

middlewareDemo();

// ## 4. Prototype-Based Plugin System

// Plugin Base Class
function Plugin(name, version = '1.0.0') {
  if (!new.target) {
    throw new Error('Plugin must be called with new');
  }
  
  this.name = name;
  this.version = version;
  this.enabled = true;
  this.hooks = new Map();
}

Plugin.prototype = {
  constructor: Plugin,
  
  registerHook(hookName, callback, priority = 10) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    this.hooks.get(hookName).push({ callback, priority });
    // Sort by priority
    this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
    
    console.log(`Hook registered: ${hookName} for plugin ${this.name}`);
  },
  
  async executeHook(hookName, ...args) {
    if (!this.hooks.has(hookName)) {
      return args[0]; // Return first argument if no hooks
    }
    
    let result = args[0];
    for (const hook of this.hooks.get(hookName)) {
      if (typeof hook.callback === 'function') {
        result = await hook.callback(result, ...args.slice(1)) || result;
      }
    }
    
    return result;
  },
  
  enable() {
    this.enabled = true;
    console.log(`Plugin ${this.name} enabled`);
  },
  
  disable() {
    this.enabled = false;
    console.log(`Plugin ${this.name} disabled`);
  },
  
  // Abstract methods to be implemented by concrete plugins
  async initialize() {
    throw new Error('initialize method must be implemented');
  },
  
  async cleanup() {
    throw new Error('cleanup method must be implemented');
  }
};

// Analytics Plugin
function AnalyticsPlugin() {
  Plugin.call(this, 'Analytics', '1.2.0');
  this.events = [];
  this.maxEvents = 1000;
}

AnalyticsPlugin.prototype = Object.create(Plugin.prototype);
AnalyticsPlugin.prototype.constructor = AnalyticsPlugin;

AnalyticsPlugin.prototype.initialize = async function() {
  console.log('Initializing Analytics Plugin');
  
  // Register hooks
  this.registerHook('user.registered', this.trackUserRegistration.bind(this), 5);
  this.registerHook('user.login', this.trackUserLogin.bind(this), 5);
  this.registerHook('http.request', this.trackRequest.bind(this), 10);
};

AnalyticsPlugin.prototype.trackUserRegistration = function(user) {
  this.events.push({
    type: 'user.registered',
    userId: user.id,
    timestamp: new Date(),
    data: { email: user.email }
  });
  
  console.log(`Tracked user registration: ${user.email}`);
  this.cleanupOldEvents();
  return user;
};

AnalyticsPlugin.prototype.trackUserLogin = function(user) {
  this.events.push({
    type: 'user.login',
    userId: user.id,
    timestamp: new Date(),
    data: { ip: user.lastLoginIp }
  });
  
  console.log(`Tracked user login: ${user.email}`);
  this.cleanupOldEvents();
  return user;
};

AnalyticsPlugin.prototype.trackRequest = function(request) {
  this.events.push({
    type: 'http.request',
    timestamp: new Date(),
    data: {
      method: request.method,
      path: request.path,
      userAgent: request.headers?.['user-agent']
    }
  });
  
  this.cleanupOldEvents();
  return request;
};

AnalyticsPlugin.prototype.cleanupOldEvents = function() {
  if (this.events.length > this.maxEvents) {
    this.events = this.events.slice(-this.maxEvents);
  }
};

AnalyticsPlugin.prototype.getStats = function() {
  const stats = {};
  this.events.forEach(event => {
    stats[event.type] = (stats[event.type] || 0) + 1;
  });
  
  return {
    totalEvents: this.events.length,
    eventsByType: stats,
    plugin: this.name,
    version: this.version
  };
};

AnalyticsPlugin.prototype.cleanup = async function() {
  this.events = [];
  console.log('Analytics Plugin cleaned up');
};

// Caching Plugin
function CachingPlugin() {
  Plugin.call(this, 'Caching', '1.1.0');
  this.cache = new Map();
  this.hitCount = 0;
  this.missCount = 0;
}

CachingPlugin.prototype = Object.create(Plugin.prototype);
CachingPlugin.prototype.constructor = CachingPlugin;

CachingPlugin.prototype.initialize = async function() {
  console.log('Initializing Caching Plugin');
  
  this.registerHook('database.query', this.cacheQuery.bind(this), 1);
  this.registerHook('database.result', this.cacheResult.bind(this), 100);
};

CachingPlugin.prototype.cacheQuery = function(query) {
  const cacheKey = this.generateCacheKey(query);
  const cached = this.cache.get(cacheKey);
  
  if (cached && Date.now() < cached.expiresAt) {
    this.hitCount++;
    console.log(`Cache hit for query: ${query}`);
    return cached.result;
  }
  
  this.missCount++;
  return null; // Continue with database query
};

CachingPlugin.prototype.cacheResult = function(result, query) {
  if (result && query) {
    const cacheKey = this.generateCacheKey(query);
    const ttl = this.getTTLForQuery(query);
    
    this.cache.set(cacheKey, {
      result,
      expiresAt: Date.now() + (ttl * 1000)
    });
    
    console.log(`Cached result for query: ${query}`);
  }
  
  return result;
};

CachingPlugin.prototype.generateCacheKey = function(query) {
  return `query:${Buffer.from(query).toString('base64')}`;
};

CachingPlugin.prototype.getTTLForQuery = function(query) {
  // Simple TTL strategy based on query type
  if (query.includes('SELECT')) return 300; // 5 minutes
  if (query.includes('UPDATE') || query.includes('DELETE')) return 60; // 1 minute
  return 180; // 3 minutes default
};

CachingPlugin.prototype.getCacheStats = function() {
  const total = this.hitCount + this.missCount;
  const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;
  
  return {
    cacheSize: this.cache.size,
    hits: this.hitCount,
    misses: this.missCount,
    hitRate: `${hitRate.toFixed(2)}%`
  };
};

CachingPlugin.prototype.cleanup = async function() {
  this.cache.clear();
  this.hitCount = 0;
  this.missCount = 0;
  console.log('Caching Plugin cleaned up');
};

// Plugin Manager
function PluginManager() {
  this.plugins = new Map();
  this.hooks = new Map();
}

PluginManager.prototype = {
  registerPlugin(plugin) {
    if (!(plugin instanceof Plugin)) {
      throw new Error('Plugin must be an instance of Plugin class');
    }
    
    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
  },
  
  async initializePlugins() {
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        await plugin.initialize();
      }
    }
  },
  
  async executeHook(hookName, ...args) {
    let result = args[0];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        result = await plugin.executeHook(hookName, result, ...args.slice(1));
      }
    }
    
    return result;
  },
  
  getPlugin(name) {
    return this.plugins.get(name);
  },
  
  async disablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.disable();
    }
  },
  
  async enablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enable();
    }
  },
  
  getPluginStats() {
    const stats = {};
    for (const plugin of this.plugins.values()) {
      stats[plugin.name] = {
        enabled: plugin.enabled,
        version: plugin.version,
        hooks: plugin.hooks.size
      };
    }
    return stats;
  }
};

// Usage
async function pluginDemo() {
  const pluginManager = new PluginManager();
  
  // Register plugins
  pluginManager.registerPlugin(new AnalyticsPlugin());
  pluginManager.registerPlugin(new CachingPlugin());
  
  // Initialize all plugins
  await pluginManager.initializePlugins();
  
  // Simulate application events
  const user = { id: 1, email: 'john@example.com', lastLoginIp: '192.168.1.100' };
  
  // Execute hooks
  await pluginManager.executeHook('user.registered', user);
  await pluginManager.executeHook('user.login', user);
  
  const query = 'SELECT * FROM users WHERE id = 1';
  const dbResult = { id: 1, name: 'John Doe' };
  
  // Simulate database query with caching
  const cachedResult = await pluginManager.executeHook('database.query', null, query);
  if (!cachedResult) {
    console.log('Cache miss, executing database query...');
    await pluginManager.executeHook('database.result', dbResult, query);
  }
  
  // Get plugin statistics
  console.log('Plugin Stats:', pluginManager.getPluginStats());
  
  const analyticsPlugin = pluginManager.getPlugin('Analytics');
  console.log('Analytics Stats:', analyticsPlugin.getStats());
  
  const cachingPlugin = pluginManager.getPlugin('Caching');
  console.log('Cache Stats:', cachingPlugin.getCacheStats());
}

pluginDemo();

// ## 5. Performance Optimization with Prototype Methods

// High-performance data processing with prototype methods
function DataProcessor(batchSize = 1000) {
  this.batchSize = batchSize;
  this.batch = [];
  this.processedCount = 0;
  this.errorCount = 0;
  this.startTime = null;
}

// All methods on prototype for memory efficiency
DataProcessor.prototype = {
  constructor: DataProcessor,
  
  start() {
    this.startTime = Date.now();
    this.batch = [];
    this.processedCount = 0;
    this.errorCount = 0;
    console.log('Data processor started');
  },
  
  addData(item) {
    this.batch.push(item);
    
    if (this.batch.length >= this.batchSize) {
      return this.processBatch();
    }
    
    return Promise.resolve();
  },
  
  async processBatch() {
    if (this.batch.length === 0) {
      return;
    }
    
    const batchToProcess = [...this.batch];
    this.batch = [];
    
    try {
      await this.processItems(batchToProcess);
      this.processedCount += batchToProcess.length;
      
      console.log(`Processed batch of ${batchToProcess.length} items. Total: ${this.processedCount}`);
    } catch (error) {
      this.errorCount += batchToProcess.length;
      console.error('Batch processing failed:', error.message);
      throw error;
    }
  },
  
  async processItems(items) {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    for (const item of items) {
      if (!this.validateItem(item)) {
        throw new Error(`Invalid item: ${JSON.stringify(item)}`);
      }
      
      this.transformItem(item);
    }
  },
  
  validateItem(item) {
    return item && typeof item === 'object' && item.id && item.value;
  },
  
  transformItem(item) {
    item.processedAt = new Date();
    item.transformedValue = item.value * 2;
    return item;
  },
  
  async finish() {
    // Process any remaining items
    if (this.batch.length > 0) {
      await this.processBatch();
    }
    
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const itemsPerSecond = this.processedCount / (duration / 1000);
    
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      duration: `${duration}ms`,
      rate: `${itemsPerSecond.toFixed(2)} items/second`,
      successRate: `${((this.processedCount / (this.processedCount + this.errorCount)) * 100).toFixed(2)}%`
    };
  }
};

// Memory-efficient object pool using prototype
function ObjectPool(constructor, initialSize = 100) {
  this.constructor = constructor;
  this.available = [];
  this.inUse = new Set();
  
  // Pre-populate pool
  for (let i = 0; i < initialSize; i++) {
    this.available.push(this.createObject());
  }
}

ObjectPool.prototype = {
  acquire() {
    if (this.available.length === 0) {
      // Create new object if pool is empty
      return this.createObject();
    }
    
    const obj = this.available.pop();
    this.inUse.add(obj);
    return obj;
  },
  
  release(obj) {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      this.resetObject(obj);
      this.available.push(obj);
    }
  },
  
  createObject() {
    const obj = Object.create(this.constructor.prototype);
    this.constructor.apply(obj, arguments);
    return obj;
  },
  
  resetObject(obj) {
    // Reset object to initial state
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
  },
  
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }
};

// Usage example
async function performanceDemo() {
  console.log('=== Data Processor Demo ===');
  const processor = new DataProcessor(500);
  processor.start();
  
  // Simulate adding data
  for (let i = 0; i < 2500; i++) {
    await processor.addData({ id: i, value: Math.random() * 100 });
  }
  
  const results = await processor.finish();
  console.log('Processing results:', results);
  
  console.log('\n=== Object Pool Demo ===');
  
  function DatabaseConnection(id) {
    this.id = id;
    this.connected = false;
    this.lastUsed = null;
  }
  
  DatabaseConnection.prototype.connect = function() {
    this.connected = true;
    this.lastUsed = new Date();
    console.log(`Connection ${this.id} connected`);
  };
  
  DatabaseConnection.prototype.disconnect = function() {
    this.connected = false;
    console.log(`Connection ${this.id} disconnected`);
  };
  
  const connectionPool = new ObjectPool(DatabaseConnection, 5);
  
  // Acquire and use connections
  const conn1 = connectionPool.acquire(1);
  const conn2 = connectionPool.acquire(2);
  
  conn1.connect();
  conn2.connect();
  
  console.log('Pool stats after acquisition:', connectionPool.getStats());
  
  // Release connections back to pool
  connectionPool.release(conn1);
  connectionPool.release(conn2);
  
  console.log('Pool stats after release:', connectionPool.getStats());
}

performanceDemo();

// These prototypes demonstrate production-grade patterns for:

// 1. **Service Inheritance** - Building scalable service architectures
// 2. **Mixin Composition** - Adding cross-cutting concerns efficiently
// 3. **Middleware Chains** - Creating flexible request processing pipelines
// 4. **Plugin Systems** - Building extensible applications
// 5. **Performance Optimization** - Memory-efficient object creation and processing

// The key benefits in production are:
// - **Memory efficiency** - Shared prototype methods reduce memory usage
// - **Performance** - Faster object creation and method lookup
// - **Maintainability** - Clear inheritance hierarchies and composition
// - **Extensibility** - Easy to add new functionality through prototypes
// - **Runtime optimization** - Hot code paths benefit from prototype chain optimization









































// Here are comprehensive code snippets for prototypal inheritance in Node.js production-grade backend development:

// ## 1. Classical Inheritance Pattern for Domain Models

// Base Entity prototype
function Entity(id) {
  if (!id) throw new Error('ID is required');
  this.id = id;
  this.createdAt = new Date();
  this.updatedAt = new Date();
  this._version = 1;
}

Entity.prototype = {
  constructor: Entity,
  
  validate() {
    if (!this.id) throw new Error('Entity must have an ID');
    return true;
  },
  
  updateTimestamps() {
    this.updatedAt = new Date();
    this._version++;
  },
  
  toJSON() {
    const obj = {};
    for (const key in this) {
      if (this.hasOwnProperty(key) && !key.startsWith('_')) {
        obj[key] = this[key];
      }
    }
    return obj;
  },
  
  equals(other) {
    return other instanceof Entity && this.id === other.id;
  }
};

// User entity inheriting from Entity
function User(id, email, name) {
  Entity.call(this, id);
  
  if (!this.isValidEmail(email)) {
    throw new Error('Invalid email format');
  }
  
  this.email = email;
  this.name = name;
  this.isActive = true;
  this.lastLogin = null;
  this.roles = ['user'];
}

// Set up prototype chain
User.prototype = Object.create(Entity.prototype);
User.prototype.constructor = User;

// User-specific methods
User.prototype.isValidEmail = function(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

User.prototype.activate = function() {
  this.isActive = true;
  this.updateTimestamps();
  return this;
};

User.prototype.deactivate = function() {
  this.isActive = false;
  this.updateTimestamps();
  return this;
};

User.prototype.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.updateTimestamps();
  return this;
};

User.prototype.addRole = function(role) {
  if (!this.roles.includes(role)) {
    this.roles.push(role);
    this.updateTimestamps();
  }
  return this;
};

User.prototype.hasRole = function(role) {
  return this.roles.includes(role);
};

// Admin user extending User
function Admin(id, email, name, permissions = []) {
  User.call(this, id, email, name);
  this.permissions = permissions;
  this.addRole('admin');
}

Admin.prototype = Object.create(User.prototype);
Admin.prototype.constructor = Admin;

Admin.prototype.addPermission = function(permission) {
  if (!this.permissions.includes(permission)) {
    this.permissions.push(permission);
    this.updateTimestamps();
  }
  return this;
};

Admin.prototype.can = function(permission) {
  return this.permissions.includes(permission) || this.permissions.includes('*');
};

// Usage in production
function userDemo() {
  try {
    const regularUser = new User('user_123', 'john@example.com', 'John Doe');
    regularUser.updateLastLogin();
    
    const adminUser = new Admin('admin_456', 'admin@example.com', 'System Admin', [
      'users.create',
      'users.delete',
      'system.config'
    ]);
    
    console.log('Regular User:', regularUser.toJSON());
    console.log('Admin User:', adminUser.toJSON());
    console.log('Admin can delete users:', adminUser.can('users.delete'));
    console.log('Is admin instance of User?', adminUser instanceof User);
    console.log('Is admin instance of Entity?', adminUser instanceof Entity);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

userDemo();

// ## 2. Service Layer with Prototypal Inheritance

// Base Service prototype
function BaseService(serviceName, options = {}) {
  this.serviceName = serviceName;
  this.options = options;
  this.startedAt = new Date();
  this.metrics = {
    requests: 0,
    successes: 0,
    failures: 0,
    totalLatency: 0
  };
  this.healthChecks = new Map();
}

BaseService.prototype = {
  constructor: BaseService,
  
  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...meta
    };
    
    if (this.options.logger) {
      this.options.logger.log(level, logEntry);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  },
  
  updateMetrics(success, latency) {
    this.metrics.requests++;
    this.metrics.totalLatency += latency;
    
    if (success) {
      this.metrics.successes++;
    } else {
      this.metrics.failures++;
    }
  },
  
  async executeWithMetrics(operationName, operation) {
    const startTime = Date.now();
    
    try {
      this.log('info', `Starting operation: ${operationName}`);
      const result = await operation();
      const latency = Date.now() - startTime;
      
      this.updateMetrics(true, latency);
      this.log('info', `Operation completed: ${operationName}`, { latency });
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      this.updateMetrics(false, latency);
      this.log('error', `Operation failed: ${operationName}`, { 
        error: error.message,
        latency 
      });
      
      throw error;
    }
  },
  
  registerHealthCheck(name, checkFn) {
    this.healthChecks.set(name, checkFn);
  },
  
  async health() {
    const checks = {};
    let isHealthy = true;
    
    for (const [name, checkFn] of this.healthChecks.entries()) {
      try {
        checks[name] = await checkFn();
        if (!checks[name].healthy) {
          isHealthy = false;
        }
      } catch (error) {
        checks[name] = { healthy: false, error: error.message };
        isHealthy = false;
      }
    }
    
    return {
      service: this.serviceName,
      healthy: isHealthy,
      uptime: Date.now() - this.startedAt.getTime(),
      metrics: this.getMetrics(),
      checks
    };
  },
  
  getMetrics() {
    const avgLatency = this.metrics.requests > 0 
      ? this.metrics.totalLatency / this.metrics.requests 
      : 0;
    
    return {
      ...this.metrics,
      avgLatency: Math.round(avgLatency),
      successRate: this.metrics.requests > 0 
        ? (this.metrics.successes / this.metrics.requests) * 100 
        : 0
    };
  }
};

// Database Service
function DatabaseService(connectionConfig) {
  BaseService.call(this, 'DatabaseService', connectionConfig);
  this.connectionConfig = connectionConfig;
  this.isConnected = false;
  this.pool = [];
  
  this.registerHealthCheck('connection', this.checkConnection.bind(this));
}

DatabaseService.prototype = Object.create(BaseService.prototype);
DatabaseService.prototype.constructor = DatabaseService;

DatabaseService.prototype.connect = async function() {
  return await this.executeWithMetrics('connect', async () => {
    // Simulate connection logic
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isConnected = true;
    this.log('info', 'Database connected successfully');
    return true;
  });
};

DatabaseService.prototype.query = async function(sql, params = []) {
  return await this.executeWithMetrics('query', async () => {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.log('debug', 'Query executed', { sql, params });
    
    return {
      rows: [{ id: 1, data: 'result' }],
      rowCount: 1,
      sql,
      params
    };
  });
};

DatabaseService.prototype.checkConnection = async function() {
  return {
    healthy: this.isConnected,
    message: this.isConnected ? 'Connected' : 'Disconnected'
  };
};

// Cache Service
function CacheService(redisConfig) {
  BaseService.call(this, 'CacheService', redisConfig);
  this.redisConfig = redisConfig;
  this.cache = new Map();
  this.hits = 0;
  this.misses = 0;
  
  this.registerHealthCheck('memory_usage', this.checkMemoryUsage.bind(this));
}

CacheService.prototype = Object.create(BaseService.prototype);
CacheService.prototype.constructor = CacheService;

CacheService.prototype.get = function(key) {
  const startTime = Date.now();
  
  try {
    const item = this.cache.get(key);
    
    if (item && Date.now() < item.expiresAt) {
      this.hits++;
      this.log('debug', 'Cache hit', { key });
      return item.value;
    }
    
    if (item) {
      this.cache.delete(key);
    }
    
    this.misses++;
    this.log('debug', 'Cache miss', { key });
    return null;
  } finally {
    this.updateMetrics(true, Date.now() - startTime);
  }
};

CacheService.prototype.set = function(key, value, ttl = 3600) {
  const startTime = Date.now();
  
  try {
    const item = {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: new Date()
    };
    
    this.cache.set(key, item);
    this.log('debug', 'Cache set', { key, ttl });
    
    return true;
  } finally {
    this.updateMetrics(true, Date.now() - startTime);
  }
};

CacheService.prototype.del = function(key) {
  this.cache.delete(key);
  this.log('debug', 'Cache deleted', { key });
  return true;
};

CacheService.prototype.checkMemoryUsage = function() {
  const usage = process.memoryUsage();
  const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  return {
    healthy: heapUsedPercent < 80,
    message: `Heap usage: ${heapUsedPercent.toFixed(2)}%`,
    data: {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      cacheSize: this.cache.size
    }
  };
};

CacheService.prototype.getCacheStats = function() {
  const total = this.hits + this.misses;
  const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
  
  return {
    ...this.getMetrics(),
    cacheSize: this.cache.size,
    hits: this.hits,
    misses: this.misses,
    hitRate: `${hitRate.toFixed(2)}%`
  };
};

// Usage in application
async function serviceDemo() {
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    logger: console
  };
  
  const cacheConfig = {
    host: 'localhost',
    port: 6379,
    logger: console
  };
  
  const dbService = new DatabaseService(dbConfig);
  const cacheService = new CacheService(cacheConfig);
  
  try {
    await dbService.connect();
    
    // Use services
    await dbService.query('SELECT * FROM users WHERE id = ?', [1]);
    cacheService.set('user:1', { id: 1, name: 'John' }, 60);
    const user = cacheService.get('user:1');
    
    console.log('Cached user:', user);
    
    // Check health
    const dbHealth = await dbService.health();
    const cacheHealth = await cacheService.health();
    const cacheStats = cacheService.getCacheStats();
    
    console.log('DB Health:', dbHealth);
    console.log('Cache Health:', cacheHealth);
    console.log('Cache Stats:', cacheStats);
    
  } catch (error) {
    console.error('Service error:', error.message);
  }
}

serviceDemo();

// ## 3. Repository Pattern with Prototypal Inheritance

// Base Repository prototype
function BaseRepository(modelName, options = {}) {
  this.modelName = modelName;
  this.options = options;
  this.cache = options.cache || null;
  this.validator = options.validator || null;
}

BaseRepository.prototype = {
  constructor: BaseRepository,
  
  generateId() {
    return `${this.modelName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  validate(data) {
    if (this.validator) {
      return this.validator.validate(data);
    }
    return { valid: true, errors: [] };
  },
  
  getCacheKey(id) {
    return `${this.modelName}:${id}`;
  },
  
  async getFromCache(id) {
    if (!this.cache) return null;
    
    const cacheKey = this.getCacheKey(id);
    return await this.cache.get(cacheKey);
  },
  
  async setToCache(id, data, ttl = 300) {
    if (!this.cache) return;
    
    const cacheKey = this.getCacheKey(id);
    await this.cache.set(cacheKey, data, ttl);
  },
  
  async invalidateCache(id) {
    if (!this.cache) return;
    
    const cacheKey = this.getCacheKey(id);
    await this.cache.del(cacheKey);
  },
  
  // Abstract methods to be implemented by child repositories
  async findById(id) {
    throw new Error('findById must be implemented');
  },
  
  async save(data) {
    throw new Error('save must be implemented');
  },
  
  async delete(id) {
    throw new Error('delete must be implemented');
  }
};

// In-Memory Repository implementation
function MemoryRepository(modelName, options = {}) {
  BaseRepository.call(this, modelName, options);
  this.storage = new Map();
  this.indexes = new Map();
}

MemoryRepository.prototype = Object.create(BaseRepository.prototype);
MemoryRepository.prototype.constructor = MemoryRepository;

MemoryRepository.prototype.findById = async function(id) {
  // Check cache first
  const cached = await this.getFromCache(id);
  if (cached) {
    return cached;
  }
  
  const entity = this.storage.get(id);
  if (!entity) {
    throw new Error(`${this.modelName} with id ${id} not found`);
  }
  
  // Cache the result
  await this.setToCache(id, entity);
  
  return entity;
};

MemoryRepository.prototype.save = async function(data) {
  const validation = this.validate(data);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const entity = {
    ...data,
    id: data.id || this.generateId(),
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date()
  };
  
  this.storage.set(entity.id, entity);
  
  // Update indexes
  this.updateIndexes(entity);
  
  // Invalidate cache
  await this.invalidateCache(entity.id);
  
  return entity;
};

MemoryRepository.prototype.delete = async function(id) {
  const exists = this.storage.has(id);
  if (!exists) {
    throw new Error(`${this.modelName} with id ${id} not found`);
  }
  
  this.storage.delete(id);
  
  // Remove from indexes
  this.removeFromIndexes(id);
  
  // Invalidate cache
  await this.invalidateCache(id);
  
  return true;
};

MemoryRepository.prototype.findAll = async function() {
  return Array.from(this.storage.values());
};

MemoryRepository.prototype.findBy = async function(field, value) {
  const indexKey = `${field}:${value}`;
  
  if (this.indexes.has(field)) {
    const index = this.indexes.get(field);
    const ids = index.get(value) || [];
    return ids.map(id => this.storage.get(id)).filter(Boolean);
  }
  
  // Fallback to scanning if no index
  const results = [];
  for (const entity of this.storage.values()) {
    if (entity[field] === value) {
      results.push(entity);
    }
  }
  return results;
};

MemoryRepository.prototype.createIndex = function(field) {
  if (!this.indexes.has(field)) {
    this.indexes.set(field, new Map());
  }
  
  // Build initial index
  const index = this.indexes.get(field);
  for (const [id, entity] of this.storage.entries()) {
    const value = entity[field];
    if (value !== undefined) {
      if (!index.has(value)) {
        index.set(value, []);
      }
      index.get(value).push(id);
    }
  }
};

MemoryRepository.prototype.updateIndexes = function(entity) {
  for (const [field, index] of this.indexes.entries()) {
    const value = entity[field];
    if (value !== undefined) {
      if (!index.has(value)) {
        index.set(value, []);
      }
      
      const ids = index.get(value);
      if (!ids.includes(entity.id)) {
        ids.push(entity.id);
      }
    }
  }
};

MemoryRepository.prototype.removeFromIndexes = function(id) {
  for (const index of this.indexes.values()) {
    for (const [value, ids] of index.entries()) {
      const newIds = ids.filter(entityId => entityId !== id);
      if (newIds.length === 0) {
        index.delete(value);
      } else {
        index.set(value, newIds);
      }
    }
  }
};

// User Repository extending MemoryRepository
function UserRepository(options = {}) {
  MemoryRepository.call(this, 'User', options);
  this.createIndex('email');
  this.createIndex('role');
}

UserRepository.prototype = Object.create(MemoryRepository.prototype);
UserRepository.prototype.constructor = UserRepository;

UserRepository.prototype.findByEmail = async function(email) {
  const users = await this.findBy('email', email);
  return users.length > 0 ? users[0] : null;
};

UserRepository.prototype.findByRole = async function(role) {
  return await this.findBy('role', role);
};

UserRepository.prototype.deactivateUser = async function(userId) {
  const user = await this.findById(userId);
  user.isActive = false;
  user.updatedAt = new Date();
  
  this.storage.set(userId, user);
  await this.invalidateCache(userId);
  
  return user;
};

// Usage with service layer
async function repositoryDemo() {
  const cacheService = {
    async get(key) { return null; },
    async set(key, value, ttl) { /* implementation */ },
    async del(key) { /* implementation */ }
  };
  
  const userRepo = new UserRepository({ cache: cacheService });
  
  try {
    // Create users
    const user1 = await userRepo.save({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
      isActive: true
    });
    
    const user2 = await userRepo.save({
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true
    });
    
    console.log('Created users:', user1, user2);
    
    // Find by email
    const foundUser = await userRepo.findByEmail('john@example.com');
    console.log('Found by email:', foundUser);
    
    // Find by role
    const admins = await userRepo.findByRole('admin');
    console.log('Admins:', admins);
    
    // Deactivate user
    const deactivated = await userRepo.deactivateUser(user1.id);
    console.log('Deactivated user:', deactivated);
    
    // Find all
    const allUsers = await userRepo.findAll();
    console.log('All users:', allUsers);
    
  } catch (error) {
    console.error('Repository error:', error.message);
  }
}

repositoryDemo();

// ## 4. Middleware System with Prototypal Inheritance

// Base Middleware prototype
function Middleware(name) {
  this.name = name;
  this.next = null;
  this.config = {};
}

Middleware.prototype = {
  constructor: Middleware,
  
  setNext(middleware) {
    this.next = middleware;
    return this.next;
  },
  
  async handle(context) {
    throw new Error('handle method must be implemented');
  },
  
  async next(context) {
    if (this.next) {
      return await this.next.handle(context);
    }
    return context;
  },
  
  configure(config) {
    this.config = { ...this.config, ...config };
    return this;
  }
};

// Authentication Middleware
function AuthMiddleware() {
  Middleware.call(this, 'AuthMiddleware');
  this.requiredRoles = ['user'];
}

AuthMiddleware.prototype = Object.create(Middleware.prototype);
AuthMiddleware.prototype.constructor = AuthMiddleware;

AuthMiddleware.prototype.handle = async function(context) {
  console.log('AuthMiddleware: Starting authentication');
  
  const token = context.headers?.authorization;
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const user = await this.authenticate(token);
  if (!user) {
    throw new Error('Invalid authentication token');
  }
  
  // Check roles
  const hasRequiredRole = this.requiredRoles.some(role => 
    user.roles.includes(role)
  );
  
  if (!hasRequiredRole) {
    throw new Error('Insufficient permissions');
  }
  
  context.user = user;
  console.log('AuthMiddleware: User authenticated', { userId: user.id });
  
  return await this.next(context);
};

AuthMiddleware.prototype.authenticate = async function(token) {
  // Simulate token validation
  await new Promise(resolve => setTimeout(resolve, 10));
  
  if (token === 'valid-token') {
    return {
      id: 'user_123',
      username: 'john_doe',
      roles: ['user', 'admin'],
      permissions: ['read', 'write']
    };
  }
  
  return null;
};

AuthMiddleware.prototype.requireRoles = function(roles) {
  this.requiredRoles = roles;
  return this;
};

// Logging Middleware
function LoggingMiddleware() {
  Middleware.call(this, 'LoggingMiddleware');
}

LoggingMiddleware.prototype = Object.create(Middleware.prototype);
LoggingMiddleware.prototype.constructor = LoggingMiddleware;

LoggingMiddleware.prototype.handle = async function(context) {
  const startTime = Date.now();
  context._requestId = this.generateRequestId();
  
  console.log('LoggingMiddleware: Request started', {
    requestId: context._requestId,
    method: context.method,
    path: context.path,
    timestamp: new Date().toISOString()
  });
  
  try {
    const result = await this.next(context);
    const duration = Date.now() - startTime;
    
    console.log('LoggingMiddleware: Request completed', {
      requestId: context._requestId,
      method: context.method,
      path: context.path,
      duration: `${duration}ms`,
      status: 'success',
      user: context.user?.id
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log('LoggingMiddleware: Request failed', {
      requestId: context._requestId,
      method: context.method,
      path: context.path,
      duration: `${duration}ms`,
      error: error.message,
      status: 'error'
    });
    
    throw error;
  }
};

LoggingMiddleware.prototype.generateRequestId = function() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validation Middleware
function ValidationMiddleware(schema) {
  Middleware.call(this, 'ValidationMiddleware');
  this.schema = schema;
}

ValidationMiddleware.prototype = Object.create(Middleware.prototype);
ValidationMiddleware.prototype.constructor = ValidationMiddleware;

ValidationMiddleware.prototype.handle = async function(context) {
  console.log('ValidationMiddleware: Validating request');
  
  if (!context.body) {
    throw new Error('Request body is required');
  }
  
  const errors = this.validate(context.body);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  console.log('ValidationMiddleware: Request validated successfully');
  
  return await this.next(context);
};

ValidationMiddleware.prototype.validate = function(data) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(this.schema)) {
    const value = data[field];
    
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be ${rules.type}`);
      }
      
      if (rules.min && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      
      if (rules.max && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
  }
  
  return errors;
};

// Rate Limiting Middleware
function RateLimitMiddleware(limit = 100, windowMs = 60000) {
  Middleware.call(this, 'RateLimitMiddleware');
  this.limit = limit;
  this.windowMs = windowMs;
  this.requests = new Map();
}

RateLimitMiddleware.prototype = Object.create(Middleware.prototype);
RateLimitMiddleware.prototype.constructor = RateLimitMiddleware;

RateLimitMiddleware.prototype.handle = async function(context) {
  const clientId = this.getClientId(context);
  const now = Date.now();
  const windowStart = now - this.windowMs;
  
  this.cleanupOldRequests(windowStart);
  
  const clientRequests = this.requests.get(clientId) || [];
  const recentRequests = clientRequests.filter(time => time > windowStart);
  
  if (recentRequests.length >= this.limit) {
    throw new Error('Rate limit exceeded');
  }
  
  recentRequests.push(now);
  this.requests.set(clientId, recentRequests);
  
  context.rateLimit = {
    limit: this.limit,
    remaining: this.limit - recentRequests.length,
    reset: windowStart + this.windowMs
  };
  
  console.log('RateLimitMiddleware: Request allowed', {
    clientId,
    remaining: context.rateLimit.remaining
  });
  
  return await this.next(context);
};

RateLimitMiddleware.prototype.getClientId = function(context) {
  return context.ip || context.headers['x-forwarded-for'] || 'unknown';
};

RateLimitMiddleware.prototype.cleanupOldRequests = function(windowStart) {
  for (const [clientId, requests] of this.requests.entries()) {
    const recent = requests.filter(time => time > windowStart);
    if (recent.length === 0) {
      this.requests.delete(clientId);
    } else {
      this.requests.set(clientId, recent);
    }
  }
};

// Middleware Pipeline
function MiddlewarePipeline() {
  this.middlewares = [];
}

MiddlewarePipeline.prototype = {
  use(middleware) {
    if (!(middleware instanceof Middleware)) {
      throw new Error('Middleware must extend Base Middleware');
    }
    this.middlewares.push(middleware);
    return this;
  },
  
  build() {
    if (this.middlewares.length === 0) {
      throw new Error('No middlewares in pipeline');
    }
    
    // Link middlewares in reverse order
    for (let i = this.middlewares.length - 1; i > 0; i--) {
      this.middlewares[i - 1].setNext(this.middlewares[i]);
    }
    
    return this.middlewares[0];
  },
  
  async execute(context) {
    const firstMiddleware = this.build();
    return await firstMiddleware.handle(context);
  }
};

// Usage in API route
async function middlewareDemo() {
  const userSchema = {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    age: { type: 'number', required: false, min: 0, max: 150 }
  };
  
  const pipeline = new MiddlewarePipeline();
  
  pipeline
    .use(new LoggingMiddleware())
    .use(new RateLimitMiddleware(10, 60000)) // 10 requests per minute
    .use(new AuthMiddleware().requireRoles(['user', 'admin']))
    .use(new ValidationMiddleware(userSchema));
  
  // Simulate API request
  const context = {
    method: 'POST',
    path: '/api/users',
    headers: {
      authorization: 'valid-token',
      'x-forwarded-for': '192.168.1.100'
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    },
    ip: '192.168.1.100'
  };
  
  try {
    const result = await pipeline.execute(context);
    console.log('Request completed successfully:', result);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

middlewareDemo();

// ## 5. Advanced: Plugin System with Prototypal Inheritance

// Base Plugin prototype
function Plugin(name, version = '1.0.0') {
  this.name = name;
  this.version = version;
  this.enabled = true;
  this.dependencies = [];
  this.hooks = new Map();
}

Plugin.prototype = {
  constructor: Plugin,
  
  async initialize() {
    console.log(`Plugin ${this.name} v${this.version} initializing`);
    return true;
  },
  
  async cleanup() {
    console.log(`Plugin ${this.name} cleaning up`);
    return true;
  },
  
  registerHook(hookName, callback, priority = 10) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    this.hooks.get(hookName).push({ callback, priority });
    this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
    
    console.log(`Hook registered: ${hookName} for plugin ${this.name}`);
  },
  
  async executeHook(hookName, ...args) {
    if (!this.hooks.has(hookName)) {
      return args[0];
    }
    
    let result = args[0];
    for (const hook of this.hooks.get(hookName)) {
      if (typeof hook.callback === 'function') {
        result = await hook.callback(result, ...args.slice(1)) || result;
      }
    }
    
    return result;
  },
  
  enable() {
    this.enabled = true;
    console.log(`Plugin ${this.name} enabled`);
  },
  
  disable() {
    this.enabled = false;
    console.log(`Plugin ${this.name} disabled`);
  },
  
  dependsOn(pluginNames) {
    this.dependencies = pluginNames;
    return this;
  }
};

// Analytics Plugin
function AnalyticsPlugin() {
  Plugin.call(this, 'Analytics', '1.2.0');
  this.events = [];
  this.maxEvents = 10000;
}

AnalyticsPlugin.prototype = Object.create(Plugin.prototype);
AnalyticsPlugin.prototype.constructor = AnalyticsPlugin;

AnalyticsPlugin.prototype.initialize = async function() {
  await Plugin.prototype.initialize.call(this);
  
  // Register hooks
  this.registerHook('user.registered', this.trackUserRegistration.bind(this), 5);
  this.registerHook('user.login', this.trackUserLogin.bind(this), 5);
  this.registerHook('http.request', this.trackRequest.bind(this), 10);
  this.registerHook('http.response', this.trackResponse.bind(this), 10);
  
  console.log('Analytics plugin initialized with event tracking');
  return true;
};

AnalyticsPlugin.prototype.trackUserRegistration = function(user) {
  this.recordEvent('user.registered', {
    userId: user.id,
    email: user.email,
    timestamp: new Date()
  });
  return user;
};

AnalyticsPlugin.prototype.trackUserLogin = function(user) {
  this.recordEvent('user.login', {
    userId: user.id,
    timestamp: new Date(),
    source: 'web'
  });
  return user;
};

AnalyticsPlugin.prototype.trackRequest = function(request) {
  this.recordEvent('http.request', {
    method: request.method,
    path: request.path,
    userAgent: request.headers?.['user-agent'],
    timestamp: new Date()
  });
  return request;
};

AnalyticsPlugin.prototype.trackResponse = function(response) {
  this.recordEvent('http.response', {
    statusCode: response.statusCode,
    duration: response.duration,
    timestamp: new Date()
  });
  return response;
};

AnalyticsPlugin.prototype.recordEvent = function(type, data) {
  this.events.push({ type, data, recordedAt: new Date() });
  
  // Cleanup old events if needed
  if (this.events.length > this.maxEvents) {
    this.events = this.events.slice(-this.maxEvents);
  }
  
  console.log(`Analytics event recorded: ${type}`);
};

AnalyticsPlugin.prototype.getStats = function() {
  const stats = {};
  this.events.forEach(event => {
    stats[event.type] = (stats[event.type] || 0) + 1;
  });
  
  return {
    totalEvents: this.events.length,
    eventsByType: stats,
    plugin: this.name,
    version: this.version
  };
};

// Caching Plugin
function CachingPlugin() {
  Plugin.call(this, 'Caching', '1.1.0');
  this.cache = new Map();
  this.defaultTTL = 300; // 5 minutes
}

CachingPlugin.prototype = Object.create(Plugin.prototype);
CachingPlugin.prototype.constructor = CachingPlugin;

CachingPlugin.prototype.initialize = async function() {
  await Plugin.prototype.initialize.call(this);
  
  this.registerHook('database.query', this.cacheQuery.bind(this), 1);
  this.registerHook('database.result', this.cacheResult.bind(this), 100);
  this.registerHook('cache.clear', this.clearCache.bind(this), 1);
  
  console.log('Caching plugin initialized');
  return true;
};

CachingPlugin.prototype.cacheQuery = function(query) {
  const cacheKey = this.generateCacheKey('query', query);
  const cached = this.get(cacheKey);
  
  if (cached) {
    console.log(`Cache hit for query: ${query}`);
    return cached;
  }
  
  console.log(`Cache miss for query: ${query}`);
  return null;
};

CachingPlugin.prototype.cacheResult = function(result, query) {
  if (result && query) {
    const cacheKey = this.generateCacheKey('query', query);
    const ttl = this.getTTLForQuery(query);
    
    this.set(cacheKey, result, ttl);
    console.log(`Cached result for query: ${query}`);
  }
  
  return result;
};

CachingPlugin.prototype.get = function(key) {
  const item = this.cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    this.cache.delete(key);
    return null;
  }
  
  return item.value;
};

CachingPlugin.prototype.set = function(key, value, ttl = this.defaultTTL) {
  const item = {
    value,
    expiresAt: Date.now() + (ttl * 1000),
    createdAt: new Date()
  };
  
  this.cache.set(key, item);
  return true;
};

CachingPlugin.prototype.clearCache = function() {
  const size = this.cache.size;
  this.cache.clear();
  console.log(`Cache cleared, removed ${size} items`);
  return true;
};

CachingPlugin.prototype.generateCacheKey = function(prefix, data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return `${prefix}:${Buffer.from(str).toString('base64')}`;
};

CachingPlugin.prototype.getTTLForQuery = function(query) {
  if (query.includes('SELECT')) return 300; // 5 minutes
  if (query.includes('UPDATE') || query.includes('DELETE')) return 60; // 1 minute
  return 180; // 3 minutes default
};

CachingPlugin.prototype.getCacheStats = function() {
  let expired = 0;
  let valid = 0;
  
  for (const item of this.cache.values()) {
    if (Date.now() > item.expiresAt) {
      expired++;
    } else {
      valid++;
    }
  }
  
  return {
    total: this.cache.size,
    valid,
    expired,
    plugin: this.name,
    version: this.version
  };
};

// Plugin Manager
function PluginManager() {
  this.plugins = new Map();
  this.initialized = false;
}

PluginManager.prototype = {
  registerPlugin(plugin) {
    if (!(plugin instanceof Plugin)) {
      throw new Error('Plugin must be an instance of Plugin');
    }
    
    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
  },
  
  async initialize() {
    if (this.initialized) {
      throw new Error('Plugin manager already initialized');
    }
    
    // Check dependencies
    for (const plugin of this.plugins.values()) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${plugin.name} depends on ${dep} but it's not registered`);
        }
      }
    }
    
    // Initialize plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        await plugin.initialize();
      }
    }
    
    this.initialized = true;
    console.log('All plugins initialized successfully');
  },
  
  async executeHook(hookName, ...args) {
    if (!this.initialized) {
      throw new Error('Plugin manager not initialized');
    }
    
    let result = args[0];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        result = await plugin.executeHook(hookName, result, ...args.slice(1));
      }
    }
    
    return result;
  },
  
  getPlugin(name) {
    return this.plugins.get(name);
  },
  
  async cleanup() {
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        await plugin.cleanup();
      }
    }
    
    this.initialized = false;
    console.log('All plugins cleaned up');
  },
  
  getStatus() {
    const status = {};
    
    for (const [name, plugin] of this.plugins.entries()) {
      status[name] = {
        enabled: plugin.enabled,
        version: plugin.version,
        hooks: Array.from(plugin.hooks.keys())
      };
    }
    
    return status;
  }
};

// Usage in application
async function pluginDemo() {
  const pluginManager = new PluginManager();
  
  // Register plugins
  pluginManager.registerPlugin(new AnalyticsPlugin());
  pluginManager.registerPlugin(new CachingPlugin());
  
  try {
    // Initialize all plugins
    await pluginManager.initialize();
    
    // Simulate application events
    const user = { id: 1, email: 'john@example.com' };
    
    await pluginManager.executeHook('user.registered', user);
    await pluginManager.executeHook('user.login', user);
    
    const query = 'SELECT * FROM users WHERE id = 1';
    const dbResult = { id: 1, name: 'John Doe' };
    
    // Database query with caching
    let result = await pluginManager.executeHook('database.query', null, query);
    if (!result) {
      console.log('Executing database query...');
      result = await pluginManager.executeHook('database.result', dbResult, query);
    }
    
    console.log('Final result:', result);
    
    // Get plugin status and stats
    console.log('Plugin Status:', pluginManager.getStatus());
    
    const analytics = pluginManager.getPlugin('Analytics');
    console.log('Analytics Stats:', analytics.getStats());
    
    const caching = pluginManager.getPlugin('Caching');
    console.log('Cache Stats:', caching.getCacheStats());
    
    // Cleanup
    await pluginManager.cleanup();
    
  } catch (error) {
    console.error('Plugin error:', error.message);
  }
}

pluginDemo();

// These production-grade prototypal inheritance patterns provide:

// 1. **Memory Efficiency** - Shared methods reduce memory usage
// 2. **Performance** - Faster object creation and method lookup
// 3. **Maintainability** - Clear inheritance hierarchies
// 4. **Extensibility** - Easy to add new functionality
// 5. **Runtime Optimization** - Better for hot code paths
// 6. **Framework Compatibility** - Works well with Node.js internals

// The key benefits in production backend development are reduced memory footprint, better performance under load, and more maintainable code architecture.



























// Here are comprehensive code snippets for the `this` keyword in Node.js production-grade backend development:

// ## 1. `this` in Class-Based Service Patterns

// Base Service Class with proper this binding
class DatabaseService {
  constructor(connectionConfig) {
    this.connectionConfig = connectionConfig;
    this.connection = null;
    this.isConnected = false;
    this.queryCount = 0;
    this.pool = [];
    
    // Auto-bind methods to maintain this context
    this.connect = this.connect.bind(this);
    this.query = this.query.bind(this);
    this._handleError = this._handleError.bind(this);
  }

  async connect() {
    try {
      console.log('Connecting to database with config:', this.connectionConfig);
      
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 100));
      this.connection = { connected: true };
      this.isConnected = true;
      
      console.log('Database connected successfully');
      return this; // Return this for method chaining
    } catch (error) {
      this._handleError('Connection failed', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    this.queryCount++;
    
    try {
      console.log(`Executing query [${this.queryCount}]:`, sql);
      
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = { rows: [{ id: 1, data: 'result' }], rowCount: 1 };
      
      return result;
    } catch (error) {
      this._handleError('Query failed', error, { sql, params });
      throw error;
    }
  }

  _handleError(context, error, meta = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      service: 'DatabaseService',
      context,
      error: error.message,
      ...meta
    };
    
    console.error('Database Error:', errorInfo);
    
    // Could also send to monitoring service
    this._reportToMonitoring(errorInfo);
  }

  _reportToMonitoring(errorInfo) {
    // Implementation for error reporting service
    console.log('Reporting to monitoring:', errorInfo);
  }

  getStats() {
    return {
      isConnected: this.isConnected,
      queryCount: this.queryCount,
      config: { ...this.connectionConfig, password: '***' } // Hide sensitive data
    };
  }

  // Static method that doesn't use this
  static validateConfig(config) {
    const required = ['host', 'port', 'database'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }
    
    return true;
  }
}

// User Service that extends DatabaseService
class UserService extends DatabaseService {
  constructor(connectionConfig, userConfig = {}) {
    super(connectionConfig);
    
    this.userConfig = userConfig;
    this.cache = new Map();
    
    // Bind additional methods
    this.getUser = this.getUser.bind(this);
    this.clearCache = this.clearCache.bind(this);
  }

  async getUser(userId, useCache = true) {
    // Check cache first
    if (useCache && this.cache.has(userId)) {
      console.log('Cache hit for user:', userId);
      return this.cache.get(userId);
    }

    // Query database
    const result = await this.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const user = result.rows[0];
    
    // Cache the result
    this.cache.set(userId, user);
    
    return user;
  }

  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`Cleared cache, removed ${size} items`);
    return this; // Enable chaining
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      hits: Object.keys(this.cache).length,
      service: this.constructor.name
    };
  }
}

// Usage with proper this context
async function serviceDemo() {
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'admin'
  };

  // Validate config using static method (no this needed)
  DatabaseService.validateConfig(dbConfig);

  const userService = new UserService(dbConfig);
  
  try {
    await userService.connect();
    
    // Method chaining works because methods return this
    const stats = userService.getStats();
    console.log('Service stats:', stats);
    
    // These will maintain proper this context even when passed as callbacks
    const getUserFn = userService.getUser;
    // getUserFn(1); // This would throw error without proper binding
    
    const user = await userService.getUser(1);
    console.log('User:', user);
    
    const cacheStats = userService.clearCache().getCacheStats();
    console.log('Cache stats after clear:', cacheStats);
    
  } catch (error) {
    console.error('Service error:', error.message);
  }
}

serviceDemo();

// ## 2. `this` in Factory Functions and Configuration Builders

// Configuration Builder with fluent interface (returning this)
function AppConfig() {
  this.database = {};
  this.server = {};
  this.cache = {};
  this.security = {};
  this.logging = { level: 'info' };
}

AppConfig.prototype = {
  setDatabase(host, port, database, username, password) {
    this.database = { host, port, database, username, password };
    return this; // Enable method chaining
  },

  setServer(port = 3000, host = 'localhost', timeout = 30000) {
    this.server = { port, host, timeout };
    return this;
  },

  setCache(redisConfig) {
    this.cache = { 
      provider: 'redis',
      ...redisConfig 
    };
    return this;
  },

  setSecurity(jwtSecret, corsOrigins = []) {
    this.security = {
      jwtSecret,
      corsOrigins,
      rateLimit: { windowMs: 900000, max: 100 }
    };
    return this;
  },

  setLogging(level, transport = 'console') {
    this.logging = { level, transport };
    return this;
  },

  validate() {
    const errors = [];

    if (!this.database.host) {
      errors.push('Database host is required');
    }

    if (!this.security.jwtSecret) {
      errors.push('JWT secret is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return this;
  },

  toJSON() {
    // Return safe copy without sensitive data
    const config = { ...this };
    
    if (config.database.password) {
      config.database.password = '***';
    }
    
    if (config.security.jwtSecret) {
      config.security.jwtSecret = '***';
    }
    
    return config;
  }
};

// Factory function that uses this for context
function createServiceFactory(serviceType, defaultConfig = {}) {
  const factory = {
    services: new Map(),
    
    create(name, config = {}) {
      const serviceConfig = { ...defaultConfig, ...config, name };
      
      let service;
      switch (serviceType) {
        case 'email':
          service = new EmailService(serviceConfig);
          break;
        case 'storage':
          service = new StorageService(serviceConfig);
          break;
        case 'payment':
          service = new PaymentService(serviceConfig);
          break;
        default:
          throw new Error(`Unknown service type: ${serviceType}`);
      }
      
      this.services.set(name, service);
      return service;
    },
    
    get(name) {
      const service = this.services.get(name);
      if (!service) {
        throw new Error(`Service ${name} not found`);
      }
      return service;
    },
    
    list() {
      return Array.from(this.services.entries()).map(([name, service]) => ({
        name,
        type: serviceType,
        config: service.getConfig ? service.getConfig() : {}
      }));
    }
  };
  
  return factory;
}

// Email Service implementation
function EmailService(config) {
  this.name = config.name;
  this.provider = config.provider || 'smtp';
  this.templates = new Map();
  this.sentCount = 0;
  
  // Store config without exposing sensitive data
  this._config = {
    host: config.host,
    port: config.port,
    secure: config.secure !== false
  };
}

EmailService.prototype = {
  async send(templateName, to, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    try {
      console.log(`Sending email to ${to} using template ${templateName}`);
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.sentCount++;
      
      return {
        success: true,
        messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        to,
        template: templateName
      };
    } catch (error) {
      console.error('Failed to send email:', error.message);
      throw error;
    }
  },
  
  registerTemplate(name, template) {
    this.templates.set(name, template);
    console.log(`Template registered: ${name}`);
    return this; // Enable chaining
  },
  
  getStats() {
    return {
      name: this.name,
      provider: this.provider,
      sentCount: this.sentCount,
      templateCount: this.templates.size
    };
  },
  
  getConfig() {
    // Return safe config without sensitive data
    return {
      name: this.name,
      provider: this.provider,
      ...this._config,
      password: '***' // Hide sensitive data
    };
  }
};

// Usage of factory and builder patterns
function factoryDemo() {
  // Configuration builder with method chaining
  const config = new AppConfig()
    .setDatabase('localhost', 5432, 'myapp', 'admin', 'secret123')
    .setServer(3000, '0.0.0.0')
    .setSecurity('super-secret-jwt-key', ['https://myapp.com'])
    .setLogging('debug', 'file')
    .validate();
  
  console.log('App Config:', config.toJSON());
  
  // Service factory usage
  const emailFactory = createServiceFactory('email', {
    provider: 'smtp',
    host: 'smtp.example.com',
    port: 587
  });
  
  const notificationService = emailFactory.create('notifications', {
    host: 'smtp.notifications.com'
  });
  
  const marketingService = emailFactory.create('marketing', {
    provider: 'sendgrid'
  });
  
  // Register templates and use chaining
  notificationService
    .registerTemplate('welcome', { subject: 'Welcome!', body: 'Hello {{name}}' })
    .registerTemplate('reset-password', { subject: 'Reset Password', body: 'Reset link: {{link}}' });
  
  console.log('Email services:', emailFactory.list());
  
  // Demonstrate this context in async operations
  const sendWelcomeEmail = notificationService.send.bind(notificationService);
  
  // This will maintain proper this context
  setTimeout(async () => {
    try {
      const result = await sendWelcomeEmail('welcome', 'user@example.com', { name: 'John' });
      console.log('Email sent:', result);
      
      console.log('Notification stats:', notificationService.getStats());
    } catch (error) {
      console.error('Error sending email:', error.message);
    }
  }, 1000);
}

factoryDemo();

// ## 3. `this` in Middleware and Request Handlers

// Middleware context management
class RequestContext {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.user = null;
    this.startTime = Date.now();
    this.data = new Map();
    this.logs = [];
    
    // Auto-bind methods
    this.set = this.set.bind(this);
    this.get = this.get.bind(this);
    this.log = this.log.bind(this);
    this.measure = this.measure.bind(this);
  }

  set(key, value) {
    this.data.set(key, value);
    return this;
  }

  get(key) {
    return this.data.get(key);
  }

  log(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.req.id,
      userId: this.user?.id,
      ...meta
    };
    
    this.logs.push(logEntry);
    console.log(JSON.stringify(logEntry));
    
    return this;
  }

  measure(name, fn) {
    const start = Date.now();
    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(res => {
        const duration = Date.now() - start;
        this.log('debug', `Timing: ${name}`, { duration, name });
        return res;
      });
    } else {
      const duration = Date.now() - start;
      this.log('debug', `Timing: ${name}`, { duration, name });
      return result;
    }
  }

  getMetrics() {
    const duration = Date.now() - this.startTime;
    return {
      requestId: this.req.id,
      duration,
      logCount: this.logs.length,
      dataSize: this.data.size,
      user: this.user ? { id: this.user.id, role: this.user.role } : null
    };
  }
}

// Authentication Middleware with proper this binding
function createAuthMiddleware(options = {}) {
  const authMiddleware = {
    requiredRoles: options.requiredRoles || ['user'],
    tokenHeader: options.tokenHeader || 'authorization',
    
    async authenticate(ctx) {
      const token = ctx.req.headers[this.tokenHeader];
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const user = await this.validateToken(token);
      if (!user) {
        throw new Error('Invalid token');
      }
      
      // Check roles
      const hasRole = this.requiredRoles.some(role => 
        user.roles.includes(role)
      );
      
      if (!hasRole) {
        throw new Error('Insufficient permissions');
      }
      
      ctx.user = user;
      ctx.log('info', 'User authenticated', { userId: user.id });
      
      return ctx;
    },
    
    async validateToken(token) {
      // Simulate token validation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (token === 'valid-token') {
        return {
          id: 'user_123',
          username: 'john_doe',
          roles: ['user', 'admin'],
          permissions: ['read', 'write']
        };
      }
      
      return null;
    },
    
    middleware() {
      // Return bound function to maintain this context
      return async (req, res, next) => {
            const ctx = new RequestContext(req, res);
            
            try {
            await this.authenticate(ctx);
            req.ctx = ctx; // Attach context to request
            next();
            } catch (error) {
            ctx.log('error', 'Authentication failed', { error: error.message });
            res.status(401).json({ error: error.message });
            }
        }.bind(this); // Bind this to maintain context
    }
  
  return authMiddleware;
}





// Route Handler with method binding
class UserController {
  constructor(userService, cacheService) {
    this.userService = userService;
    this.cacheService = cacheService;
    
    // Auto-bind all methods to maintain this context
    this.getUser = this.getUser.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.deleteUser = this.deleteUser.bind(this);
    this._validateUserData = this._validateUserData.bind(this);
  }

  async getUser(req, res) {
    const ctx = req.ctx;
    
    return await ctx.measure('getUser', async () => {
      try {
        const userId = req.params.id;
        
        ctx.log('info', 'Fetching user', { userId });
        
        const user = await this.userService.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        ctx.log('info', 'User fetched successfully', { userId });
        
        res.json({
          success: true,
          data: user,
          metrics: ctx.getMetrics()
        });
        
      } catch (error) {
        ctx.log('error', 'Failed to fetch user', { 
          error: error.message,
          userId: req.params.id 
        });
        
        res.status(500).json({ 
          error: 'Failed to fetch user',
          metrics: ctx.getMetrics()
        });
      }
    });
  }

  async updateUser(req, res) {
    const ctx = req.ctx;
    
    try {
      const userId = req.params.id;
      const updateData = req.body;
      
      // Authorization check
      if (ctx.user.id !== userId && !ctx.user.roles.includes('admin')) {
        throw new Error('Not authorized to update this user');
      }
      
      this._validateUserData(updateData);
      
      ctx.log('info', 'Updating user', { userId, updates: Object.keys(updateData) });
      
      // Simulate update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      ctx.log('info', 'User updated successfully', { userId });
      
      res.json({
        success: true,
        data: { id: userId, ...updateData, updatedAt: new Date() },
        metrics: ctx.getMetrics()
      });
      
    } catch (error) {
      ctx.log('error', 'Failed to update user', { 
        error: error.message,
        userId: req.params.id 
      });
      
      res.status(400).json({ 
        error: error.message,
        metrics: ctx.getMetrics()
      });
    }
  }

  async deleteUser(req, res) {
    const ctx = req.ctx;
    
    try {
      const userId = req.params.id;
      
      // Only admins or the user themselves can delete
      if (ctx.user.id !== userId && !ctx.user.roles.includes('admin')) {
        throw new Error('Not authorized to delete this user');
      }
      
      ctx.log('warn', 'Deleting user', { userId, initiatedBy: ctx.user.id });
      
      // Simulate deletion
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // Clear cache
      this.cacheService.del(`user:${userId}`);
      
      ctx.log('info', 'User deleted successfully', { userId });
      
      res.json({
        success: true,
        message: 'User deleted successfully',
        metrics: ctx.getMetrics()
      });
      
    } catch (error) {
      ctx.log('error', 'Failed to delete user', { 
        error: error.message,
        userId: req.params.id 
      });
      
      res.status(400).json({ 
        error: error.message,
        metrics: ctx.getMetrics()
      });
    }
  }

  _validateUserData(data) {
    const allowedFields = ['name', 'email', 'preferences'];
    const invalidFields = Object.keys(data).filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      throw new Error(`Invalid fields: ${invalidFields.join(', ')}`);
    }
    
    if (data.email && !this._isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Express.js-like router setup demonstration
function createRouter() {
  const routes = [];
  
  const router = {
    get(path, handler) {
      routes.push({ method: 'GET', path, handler });
      return this;
    },
    
    put(path, handler) {
      routes.push({ method: 'PUT', path, handler });
      return this;
    },
    
    delete(path, handler) {
      routes.push({ method: 'DELETE', path, handler });
      return this;
    },
    
    // Simulate request handling
    async handleRequest(method, path, req, res) {
      const route = routes.find(r => r.method === method && r.path === path);
      
      if (!route) {
        res.status(404).json({ error: 'Route not found' });
        return;
      }
      
      await route.handler(req, res);
    }
  };
  
  return router;
}

// Usage in application
async function middlewareDemo() {
  // Create auth middleware
  const auth = createAuthMiddleware({
    requiredRoles: ['user', 'admin'],
    tokenHeader: 'authorization'
  });
  
  // Create controller
  const userController = new UserController(
    { getUser: async (id) => ({ id, name: 'John Doe' }) },
    { del: (key) => console.log('Cache deleted:', key) }
  );
  
  // Create router
  const router = createRouter()
    .get('/users/:id', auth.middleware(), userController.getUser)
    .put('/users/:id', auth.middleware(), userController.updateUser)
    .delete('/users/:id', auth.middleware(), userController.deleteUser);
  
  // Simulate requests
  const mockReq = {
    id: 'req_123',
    params: { id: 'user_123' },
    headers: { authorization: 'valid-token' },
    body: { name: 'John Updated' },
    ctx: null // Will be set by auth middleware
  };
  
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log(`Response [${this.statusCode}]:`, JSON.stringify(data, null, 2));
      return this;
    }
  };
  
  // Test the routes
  console.log('=== Testing User Routes ===');
  
  await router.handleRequest('GET', '/users/user_123', mockReq, mockRes);
  await router.handleRequest('PUT', '/users/user_123', mockReq, mockRes);
  await router.handleRequest('DELETE', '/users/user_123', mockReq, mockRes);
}

middlewareDemo();

// ## 4. `this` in Event Emitters and Stream Processing

const { EventEmitter } = require('events');

// Custom Event Emitter with context management
class DataProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      batchSize: options.batchSize || 100,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      ...options
    };
    
    this.queue = [];
    this.isProcessing = false;
    this.stats = {
      processed: 0,
      failed: 0,
      retries: 0,
      batches: 0
    };
    
    // Bind event handlers to maintain this context
    this._processBatch = this._processBatch.bind(this);
    this._handleError = this._handleError.bind(this);
    this._handleSuccess = this._handleSuccess.bind(this);
    
    // Set up event listeners
    this.on('error', this._handleError);
    this.on('success', this._handleSuccess);
  }

  add(data) {
    this.queue.push({
      data,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      addedAt: new Date()
    });
    
    this.emit('item.added', { queueSize: this.queue.length });
    
    // Start processing if not already running
    if (!this.isProcessing && this.queue.length >= this.options.batchSize) {
      this.process();
    }
    
    return this; // Enable chaining
  }

  async process() {
    if (this.isProcessing) {
      this.emit('warning', 'Processor already running');
      return this;
    }
    
    this.isProcessing = true;
    this.emit('processing.started', { queueSize: this.queue.length });
    
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.options.batchSize);
        await this._processBatch(batch);
        this.stats.batches++;
      }
      
      this.emit('processing.completed', { stats: this.getStats() });
    } catch (error) {
      this.emit('processing.failed', { error: error.message, stats: this.getStats() });
    } finally {
      this.isProcessing = false;
    }
    
    return this;
  }

  async _processBatch(batch) {
    this.emit('batch.started', { batchSize: batch.length });
    
    const promises = batch.map(async (item) => {
      try {
        const result = await this._processItemWithRetry(item);
        this.emit('item.success', { id: item.id, result });
        return result;
      } catch (error) {
        this.emit('item.failed', { id: item.id, error: error.message, attempts: item.attempts });
        throw error;
      }
    });
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.stats.processed += successful;
    this.stats.failed += failed;
    
    this.emit('batch.completed', {
      batchSize: batch.length,
      successful,
      failed,
      stats: this.getStats()
    });
  }

  async _processItemWithRetry(item) {
    while (item.attempts < this.options.maxRetries) {
      try {
        item.attempts++;
        const result = await this._processSingleItem(item);
        return result;
      } catch (error) {
        if (item.attempts >= this.options.maxRetries) {
          throw error;
        }
        
        this.stats.retries++;
        this.emit('retry', { id: item.id, attempt: item.attempts, error: error.message });
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Max retries exceeded for item ${item.id}`);
  }

  async _processSingleItem(item) {
    // Simulate processing with occasional failures
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        // 10% failure rate for demonstration
        if (Math.random() < 0.1) {
          reject(new Error('Random processing failure'));
        } else {
          resolve({ 
            id: item.id, 
            processedAt: new Date(),
            data: item.data 
          });
        }
      }, 10);
    });
  }

  _handleError(error) {
    console.error('DataProcessor Error:', error);
    
    // Could send to error tracking service
    this._reportError(error);
  }

  _handleSuccess(result) {
    console.log('DataProcessor Success:', result.id);
  }

  _reportError(error) {
    // Implementation for error reporting service
    console.log('Reporting error to monitoring service:', error.message);
  }

  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      options: this.options
    };
  }

  clearQueue() {
    const size = this.queue.length;
    this.queue = [];
    this.emit('queue.cleared', { clearedItems: size });
    return this;
  }
}

// Stream Processor using this context
class StreamProcessor {
  constructor(transformFn, options = {}) {
    this.transformFn = transformFn;
    this.options = options;
    this.buffer = [];
    this.writers = new Set();
    
    // Bind methods
    this.write = this.write.bind(this);
    this.pipe = this.pipe.bind(this);
    this._flush = this._flush.bind(this);
    
    // Auto-flush interval
    if (options.autoFlushInterval) {
      this.flushInterval = setInterval(this._flush, options.autoFlushInterval);
    }
  }

  write(data) {
    this.buffer.push(data);
    
    // Auto-flush if buffer reaches threshold
    if (this.buffer.length >= (this.options.bufferSize || 10)) {
      this._flush();
    }
    
    return this;
  }

  pipe(destination) {
    if (typeof destination.write !== 'function') {
      throw new Error('Destination must have write method');
    }
    
    this.writers.add(destination);
    return destination;
  }

  async _flush() {
    if (this.buffer.length === 0) return;
    
    const batch = [...this.buffer];
    this.buffer = [];
    
    try {
      const transformed = await this.transformFn(batch, this);
      
      // Write to all destinations
      const writePromises = Array.from(this.writers).map(async (writer) => {
        try {
          await writer.write(transformed);
        } catch (error) {
          console.error('Write error:', error.message);
        }
      });
      
      await Promise.allSettled(writePromises);
      
      this.emit('flush', { 
        batchSize: batch.length,
        transformedCount: Array.isArray(transformed) ? transformed.length : 1
      });
      
    } catch (error) {
      this.emit('error', { 
        error: error.message,
        batchSize: batch.length 
      });
    }
  }

  end() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    return this._flush();
  }

  // Make it event-emitter like
  on(event, handler) {
    if (!this._events) this._events = new Map();
    if (!this._events.has(event)) this._events.set(event, []);
    this._events.get(event).push(handler);
    return this;
  }

  emit(event, data) {
    if (!this._events || !this._events.has(event)) return;
    
    this._events.get(event).forEach(handler => {
      try {
        handler.call(this, data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

// Usage examples
async function eventEmitterDemo() {
  console.log('=== Data Processor Demo ===');
  
  const processor = new DataProcessor({
    batchSize: 5,
    maxRetries: 2,
    timeout: 10000
  });
  
  // Set up event listeners
  processor
    .on('item.added', (data) => {
      console.log('Item added, queue size:', data.queueSize);
    })
    .on('batch.started', (data) => {
      console.log('Batch started, size:', data.batchSize);
    })
    .on('item.success', (data) => {
      console.log('Item processed successfully:', data.id);
    })
    .on('processing.completed', (data) => {
      console.log('Processing completed, stats:', data.stats);
    });
  
  // Add some data
  for (let i = 0; i < 12; i++) {
    processor.add({ index: i, value: `data_${i}` });
  }
  
  // Start processing
  await processor.process();
  
  console.log('Final stats:', processor.getStats());
  
  console.log('\n=== Stream Processor Demo ===');
  
  const transformFn = async (batch) => {
    // Simulate async transformation
    await new Promise(resolve => setTimeout(resolve, 10));
    return batch.map(item => ({
      ...item,
      transformed: true,
      processedAt: new Date()
    }));
  };
  
  const streamProcessor = new StreamProcessor(transformFn, {
    bufferSize: 3,
    autoFlushInterval: 1000
  });
  
  const mockWriter = {
    write: async (data) => {
      console.log('Writer received:', data.length, 'items');
      return true;
    }
  };
  
  streamProcessor.pipe(mockWriter);
  
  for (let i = 0; i < 7; i++) {
    streamProcessor.write({ original: i });
  }
  
  // Wait for auto-flush
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  await streamProcessor.end();
}

eventEmitterDemo();

// ## 5. `this` in Advanced Patterns: Dependency Injection and Context Management

// Dependency Injection Container with this context
class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.dependencies = new Map();
  }

  register(name, implementation, options = {}) {
    const serviceDef = {
      implementation,
      singleton: options.singleton || false,
      dependencies: options.dependencies || [],
      factory: options.factory || false
    };
    
    this.services.set(name, serviceDef);
    return this; // Enable chaining
  }

  get(name) {
    const serviceDef = this.services.get(name);
    
    if (!serviceDef) {
      throw new Error(`Service ${name} not registered`);
    }
    
    // Return singleton if exists
    if (serviceDef.singleton && this.singletons.has(name)) {
      return this.singletons.get(name);
    }
    
    let instance;
    
    if (serviceDef.factory) {
      // Factory function
      instance = this._createFromFactory(serviceDef, name);
    } else {
      // Constructor
      instance = this._createFromConstructor(serviceDef, name);
    }
    
    // Store singleton
    if (serviceDef.singleton) {
      this.singletons.set(name, instance);
    }
    
    return instance;
  }

  _createFromConstructor(serviceDef, name) {
    const dependencies = serviceDef.dependencies.map(dep => this.get(dep));
    
    try {
      const instance = new serviceDef.implementation(...dependencies);
      
      // Auto-bind methods if requested
      if (serviceDef.autoBind) {
        this._autoBindMethods(instance);
      }
      
      return instance;
    } catch (error) {
      throw new Error(`Failed to create service ${name}: ${error.message}`);
    }
  }

  _createFromFactory(serviceDef, name) {
    const dependencies = serviceDef.dependencies.map(dep => this.get(dep));
    
    try {
      return serviceDef.implementation.call(this, ...dependencies);
    } catch (error) {
      throw new Error(`Factory failed for service ${name}: ${error.message}`);
    }
  }

  _autoBindMethods(instance) {
    const proto = Object.getPrototypeOf(instance);
    
    Object.getOwnPropertyNames(proto).forEach(methodName => {
      if (methodName !== 'constructor' && typeof instance[methodName] === 'function') {
        instance[methodName] = instance[methodName].bind(instance);
      }
    });
  }

  listServices() {
    return Array.from(this.services.entries()).map(([name, def]) => ({
      name,
      singleton: def.singleton,
      dependencies: def.dependencies,
      factory: def.factory
    }));
  }
}

// Context Manager for request-scoped dependencies
class ContextManager {
  constructor() {
    this.contexts = new Map();
    this.currentContext = null;
  }

  createContext(name, initialValues = {}) {
    const context = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      data: new Map(Object.entries(initialValues)),
      createdAt: new Date(),
      parent: this.currentContext
    };
    
    this.contexts.set(context.id, context);
    return context;
  }

  runInContext(context, fn) {
    const previousContext = this.currentContext;
    this.currentContext = context;
    
    try {
      const result = fn.call(this, context);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          this.currentContext = previousContext;
        });
      }
      
      this.currentContext = previousContext;
      return result;
    } catch (error) {
      this.currentContext = previousContext;
      throw error;
    }
  }

  getCurrentContext() {
    return this.currentContext;
  }

  set(key, value) {
    if (!this.currentContext) {
      throw new Error('No active context');
    }
    
    this.currentContext.data.set(key, value);
    return this; // Enable chaining
  }

  get(key) {
    if (!this.currentContext) {
      throw new Error('No active context');
    }
    
    // Check current context first
    if (this.currentContext.data.has(key)) {
      return this.currentContext.data.get(key);
    }
    
    // Check parent contexts
    let parent = this.currentContext.parent;
    while (parent) {
      if (parent.data.has(key)) {
        return parent.data.get(key);
      }
      parent = parent.parent;
    }
    
    return undefined;
  }

  disposeContext(contextId) {
    this.contexts.delete(contextId);
    
    // Clear current context if it's the one being disposed
    if (this.currentContext && this.currentContext.id === contextId) {
      this.currentContext = null;
    }
  }
}

// Usage in production application
function dependencyInjectionDemo() {
  console.log('=== Dependency Injection Demo ===');
  
  // Service definitions
  class Logger {
    constructor() {
      this.logs = [];
    }
    
    log(level, message, meta = {}) {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
      };
      
      this.logs.push(entry);
      console.log(JSON.stringify(entry));
    }
    
    getLogs() {
      return this.logs;
    }
  }
  
  class DatabaseService {
    constructor(logger) {
      this.logger = logger;
      this.connection = null;
    }
    
    connect() {
      this.logger.log('info', 'Database connecting...');
      this.connection = { connected: true };
      this.logger.log('info', 'Database connected');
      return this;
    }
    
    query(sql) {
      this.logger.log('debug', 'Executing query', { sql });
      return { rows: [], rowCount: 0 };
    }
  }
  
  class UserService {
    constructor(database, logger) {
      this.database = database;
      this.logger = logger;
      this.cache = new Map();
    }
    
    getUser(id) {
      this.logger.log('info', 'Fetching user', { userId: id });
      
      // Check cache
      if (this.cache.has(id)) {
        this.logger.log('debug', 'Cache hit for user', { userId: id });
        return this.cache.get(id);
      }
      
      const user = this.database.query(`SELECT * FROM users WHERE id = ${id}`);
      this.cache.set(id, user);
      
      return user;
    }
  }
  
  // Factory function
  function createConfig() {
    return {
      environment: process.env.NODE_ENV || 'development',
      database: {
        host: 'localhost',
        port: 5432
      }
    };
  }
  
  // Setup DI Container
  const container = new DIContainer();
  
  container
    .register('config', createConfig, { factory: true, singleton: true })
    .register('logger', Logger, { singleton: true })
    .register('database', DatabaseService, { 
      dependencies: ['logger'],
      singleton: true 
    })
    .register('userService', UserService, {
      dependencies: ['database', 'logger'],
      singleton: true
    });
  
  console.log('Registered services:', container.listServices());
  
  // Use services
  const logger = container.get('logger');
  const userService = container.get('userService');
  const config = container.get('config');
  
  logger.log('info', 'Application started', { environment: config.environment });
  
  userService.getUser(123);
  
  console.log('\n=== Context Management Demo ===');
  
  const contextManager = new ContextManager();
  
  // Create nested contexts
  const requestContext = contextManager.createContext('request', {
    requestId: 'req_123',
    userId: 'user_456',
    startTime: Date.now()
  });
  
  contextManager.runInContext(requestContext, function(ctx) {
    console.log('Running in request context:', ctx.id);
    
    // Set some request-specific data
    this.set('userAgent', 'Mozilla/5.0');
    this.set('ip', '192.168.1.100');
    
    // Create sub-context for database transaction
    const dbContext = contextManager.createContext('db-transaction', {
      transactionId: 'tx_789'
    });
    
    contextManager.runInContext(dbContext, function(subCtx) {
      console.log('Running in DB context:', subCtx.id);
      console.log('Accessing parent context data:', this.get('requestId'));
      
      this.set('queryCount', 5);
      
      console.log('All context data:', {
        requestId: this.get('requestId'),
        transactionId: this.get('transactionId'),
        queryCount: this.get('queryCount')
      });
    });
    
    console.log('Back in request context');
    console.log('Query count from sub-context:', this.get('queryCount'));
  });
  
  // Context is automatically cleaned up
}

dependencyInjectionDemo();

// ## Key Production Insights for `this`:

// 1. **Always bind methods** in constructors for class instances
// 2. **Return `this`** for method chaining in builders and fluent interfaces
// 3. **Use arrow functions** carefully - they capture lexical `this`
// 4. **Maintain context** in async callbacks and event handlers
// 5. **Be explicit** with `.call()`, `.apply()`, and `.bind()` when needed
// 6. **Consider using Proxy** for advanced context management
// 7. **Use DI containers** for managing service dependencies and context

// These patterns ensure robust `this` handling in production Node.js applications, preventing common context-related bugs and making code more maintainable.












































// Here are comprehensive code snippets for JavaScript object properties in Node.js production-grade backend development:

// ## 1. Property Descriptors and Metadata Management

// Advanced configuration management with property descriptors
class SecureConfig {
  constructor(initialConfig = {}) {
    this._sensitiveFields = new Set(['password', 'secret', 'token', 'key']);
    this._validators = new Map();
    this._metadata = new Map();
    
    // Define properties with descriptors
    Object.defineProperty(this, '_internal', {
      value: new Map(),
      writable: false,
      enumerable: false,
      configurable: false
    });
    
    // Initialize with validation
    this._initializeConfig(initialConfig);
  }
  
  _initializeConfig(config) {
    for (const [key, value] of Object.entries(config)) {
      this.set(key, value);
    }
    
    // Seal the configuration to prevent new properties
    Object.seal(this);
  }
  
  // Define property with validation and metadata
  set(key, value, options = {}) {
    const {
      sensitive = this._sensitiveFields.has(key),
      validator = null,
      readonly = false,
      enumerable = true
    } = options;
    
    // Run validation if exists
    if (validator && !validator(value)) {
      throw new Error(`Validation failed for property: ${key}`);
    }
    
    // Store metadata
    this._metadata.set(key, {
      sensitive,
      readonly,
      enumerable,
      lastModified: new Date(),
      modifiedBy: 'system'
    });
    
    // Define property with descriptor
    Object.defineProperty(this, key, {
      get: () => {
        const meta = this._metadata.get(key);
        if (meta && meta.sensitive) {
          return '***REDACTED***';
        }
        return this._internal.get(key);
      },
      set: (newValue) => {
        const meta = this._metadata.get(key);
        
        if (meta && meta.readonly) {
          throw new Error(`Property ${key} is read-only`);
        }
        
        if (validator && !validator(newValue)) {
          throw new Error(`Validation failed for property: ${key}`);
        }
        
        this._internal.set(key, newValue);
        meta.lastModified = new Date();
      },
      enumerable: meta ? meta.enumerable : enumerable,
      configurable: false
    });
    
    // Set initial value
    this._internal.set(key, value);
  }
  
  // Get raw value (bypassing redaction)
  getRaw(key) {
    if (!this._internal.has(key)) {
      throw new Error(`Property ${key} not found`);
    }
    return this._internal.get(key);
  }
  
  // Get property metadata
  getMetadata(key) {
    return this._metadata.get(key) || null;
  }
  
  // Define validator for property
  addValidator(key, validatorFn) {
    this._validators.set(key, validatorFn);
    
    // Update existing property if it exists
    if (this._internal.has(key)) {
      const currentValue = this._internal.get(key);
      if (!validatorFn(currentValue)) {
        throw new Error(`Current value fails validation for property: ${key}`);
      }
    }
  }
  
  // Get safe representation for logging
  toSafeJSON() {
    const result = {};
    
    for (const [key] of this._internal) {
      const meta = this._metadata.get(key);
      if (meta && meta.sensitive) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = this._internal.get(key);
      }
    }
    
    return result;
  }
  
  // Freeze configuration (make all properties readonly)
  freeze() {
    for (const [key, meta] of this._metadata) {
      meta.readonly = true;
      
      // Redefine property as readonly
      Object.defineProperty(this, key, {
        get: () => this._internal.get(key),
        set: () => {
          throw new Error(`Configuration is frozen. Property ${key} is read-only`);
        },
        enumerable: meta.enumerable,
        configurable: false
      });
    }
    
    Object.freeze(this);
  }
  
  // Get all property names
  getPropertyNames() {
    return Array.from(this._internal.keys());
  }
}

// Usage in production
function configDemo() {
  const config = new SecureConfig();
  
  // Set properties with different options
  config.set('databaseHost', 'localhost', {
    validator: (val) => typeof val === 'string' && val.length > 0
  });
  
  config.set('databasePort', 5432, {
    validator: (val) => Number.isInteger(val) && val > 0 && val < 65536
  });
  
  config.set('databasePassword', 'super-secret-123', {
    sensitive: true
  });
  
  config.set('apiVersion', 'v1', {
    readonly: true
  });
  
  // Add custom validator
  config.addValidator('databaseHost', (host) => {
    return host !== 'localhost' || process.env.NODE_ENV === 'development';
  });
  
  console.log('Config (safe):', config.toSafeJSON());
  console.log('Database host:', config.databaseHost);
  console.log('Database password:', config.databasePassword); // Redacted
  console.log('Raw password:', config.getRaw('databasePassword'));
  console.log('Metadata for password:', config.getMetadata('databasePassword'));
  
  try {
    config.apiVersion = 'v2'; // This will throw error
  } catch (error) {
    console.log('Expected error:', error.message);
  }
  
  // Freeze configuration
  config.freeze();
  
  console.log('Property names:', config.getPropertyNames());
}

configDemo();

// ## 2. Dynamic Property Proxies for API Response Management

// Advanced response handler with property interception
class APIResponse {
  constructor(data = {}, options = {}) {
    this._data = this._deepClone(data);
    this._options = {
      redactSensitive: options.redactSensitive !== false,
      transformDates: options.transformDates !== false,
      includeMetadata: options.includeMetadata || false,
      maxDepth: options.maxDepth || 10,
      ...options
    };
    
    this._sensitiveFields = new Set([
      'password', 'token', 'secret', 'authorization', 
      'credit_card', 'ssn', 'api_key'
    ]);
    
    this._metadata = {
      createdAt: new Date(),
      version: '1.0',
      transformations: []
    };
    
    // Create proxy for dynamic property handling
    return this._createProxy(this._data);
  }
  
  _createProxy(target, path = '', depth = 0) {
    if (depth > this._options.maxDepth) {
      return target;
    }
    
    const handler = {
      get: (obj, prop) => {
        // Handle special properties
        if (prop === 'toJSON') {
          return () => this._serialize(obj);
        }
        
        if (prop === '_metadata') {
          return this._metadata;
        }
        
        if (prop === 'toString') {
          return () => JSON.stringify(this._serialize(obj), null, 2);
        }
        
        const value = obj[prop];
        const currentPath = path ? `${path}.${prop}` : prop;
        
        // Apply transformations
        return this._transformValue(value, currentPath, depth + 1);
      },
      
      set: (obj, prop, value) => {
        const currentPath = path ? `${path}.${prop}` : prop;
        
        // Validate before setting
        if (this._isSensitiveField(currentPath)) {
          throw new Error(`Cannot set sensitive field: ${currentPath}`);
        }
        
        obj[prop] = value;
        this._metadata.transformations.push({
          action: 'SET',
          path: currentPath,
          timestamp: new Date(),
          newValue: this._options.redactSensitive && this._isSensitiveField(prop) 
            ? '***REDACTED***' 
            : value
        });
        
        return true;
      },
      
      deleteProperty: (obj, prop) => {
        const currentPath = path ? `${path}.${prop}` : prop;
        
        if (this._isSensitiveField(currentPath)) {
          throw new Error(`Cannot delete sensitive field: ${currentPath}`);
        }
        
        delete obj[prop];
        this._metadata.transformations.push({
          action: 'DELETE',
          path: currentPath,
          timestamp: new Date()
        });
        
        return true;
      },
      
      ownKeys: (obj) => {
        return Reflect.ownKeys(obj).filter(key => 
          !key.toString().startsWith('_')
        );
      },
      
      getOwnPropertyDescriptor: (obj, prop) => {
        if (prop.toString().startsWith('_')) {
          return undefined;
        }
        return Reflect.getOwnPropertyDescriptor(obj, prop);
      }
    };
    
    if (typeof target === 'object' && target !== null) {
      for (const key of Object.keys(target)) {
        if (typeof target[key] === 'object' && target[key] !== null) {
          target[key] = this._createProxy(
            target[key], 
            path ? `${path}.${key}` : key, 
            depth + 1
          );
        }
      }
    }
    
    return new Proxy(target, handler);
  }
  
  _transformValue(value, path, depth) {
    if (value instanceof Date && this._options.transformDates) {
      this._metadata.transformations.push({
        action: 'DATE_TRANSFORM',
        path,
        timestamp: new Date(),
        originalValue: value,
        transformedValue: value.toISOString()
      });
      return value.toISOString();
    }
    
    if (this._options.redactSensitive && this._isSensitiveField(path)) {
      this._metadata.transformations.push({
        action: 'REDACT',
        path,
        timestamp: new Date(),
        originalValue: value
      });
      return '***REDACTED***';
    }
    
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      return this._createProxy(value, path, depth);
    }
    
    return value;
  }
  
  _isSensitiveField(path) {
    return this._sensitiveFields.has(path.toLowerCase()) ||
           path.toLowerCase().includes('password') ||
           path.toLowerCase().includes('token') ||
           path.toLowerCase().includes('secret');
  }
  
  _serialize(obj) {
    const result = this._deepClone(obj);
    
    if (this._options.includeMetadata) {
      result._metadata = { ...this._metadata };
    }
    
    return result;
  }
  
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    
    const clone = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clone[key] = this._deepClone(obj[key]);
      }
    }
    
    return clone;
  }
  
  // Static method to create response from different sources
  static fromDatabase(row, options = {}) {
    const data = { ...row };
    
    // Convert database-specific types
    if (data.created_at) {
      data.createdAt = new Date(data.created_at);
      delete data.created_at;
    }
    
    if (data.updated_at) {
      data.updatedAt = new Date(data.updated_at);
      delete data.updated_at;
    }
    
    return new APIResponse(data, options);
  }
  
  // Chainable methods for response transformation
  redact(...fields) {
    fields.forEach(field => this._sensitiveFields.add(field));
    return this;
  }
  
  includeMetadata() {
    this._options.includeMetadata = true;
    return this;
  }
}

// Usage in API controllers
function apiResponseDemo() {
  // Simulate database row
  const dbRow = {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    password_hash: 'hashed_password_123',
    api_key: 'secret-api-key-456',
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-12-01'),
    profile: {
      first_name: 'John',
      last_name: 'Doe',
      ssn: '123-45-6789',
      preferences: {
        newsletter: true,
        notifications: false
      }
    },
    tokens: [
      { type: 'access', value: 'access-token-123' },
      { type: 'refresh', value: 'refresh-token-456' }
    ]
  };
  
  // Create API response
  const response = APIResponse.fromDatabase(dbRow, {
    redactSensitive: true,
    transformDates: true,
    includeMetadata: true
  })
  .redact('ssn', 'api_key');
  
  console.log('API Response:', JSON.stringify(response, null, 2));
  
  // Demonstrate property access
  console.log('\nProperty access:');
  console.log('Username:', response.username);
  console.log('Password:', response.password_hash); // Redacted
  console.log('Profile SSN:', response.profile.ssn); // Redacted
  console.log('Created date:', response.createdAt); // ISO string
  
  // Demonstrate modification
  try {
    response.username = 'jane_doe';
    console.log('Updated username:', response.username);
    
    // This will throw error
    response.password_hash = 'new_password';
  } catch (error) {
    console.log('Expected error:', error.message);
  }
  
  // Show metadata
  console.log('\nTransformations:', response._metadata.transformations.length);
}

apiResponseDemo();

// ## 3. Advanced Property Validation and Schema Enforcement

// Schema-based property validation system
class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
    this.validators = this._compileSchema(schema);
  }
  
  _compileSchema(schema) {
    const validators = new Map();
    
    for (const [key, rules] of Object.entries(schema)) {
      validators.set(key, this._createValidator(rules));
    }
    
    return validators;
  }
  
  _createValidator(rules) {
    const validations = [];
    
    if (rules.required) {
      validations.push((value) => {
        if (value === undefined || value === null) {
          throw new Error('Field is required');
        }
        return true;
      });
    }
    
    if (rules.type) {
      validations.push((value) => {
        if (value === undefined || value === null) return true;
        
        let isValid = false;
        switch (rules.type) {
          case 'string':
            isValid = typeof value === 'string';
            break;
          case 'number':
            isValid = typeof value === 'number' && !isNaN(value);
            break;
          case 'boolean':
            isValid = typeof value === 'boolean';
            break;
          case 'array':
            isValid = Array.isArray(value);
            break;
          case 'object':
            isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
            break;
          case 'date':
            isValid = value instanceof Date;
            break;
          default:
            isValid = true;
        }
        
        if (!isValid) {
          throw new Error(`Field must be of type ${rules.type}`);
        }
        return true;
      });
    }
    
    if (rules.min !== undefined) {
      validations.push((value) => {
        if (value === undefined || value === null) return true;
        
        if (typeof value === 'number' && value < rules.min) {
          throw new Error(`Field must be at least ${rules.min}`);
        }
        
        if (typeof value === 'string' && value.length < rules.min) {
          throw new Error(`Field must be at least ${rules.min} characters`);
        }
        
        if (Array.isArray(value) && value.length < rules.min) {
          throw new Error(`Array must contain at least ${rules.min} items`);
        }
        
        return true;
      });
    }
    
    if (rules.max !== undefined) {
      validations.push((value) => {
        if (value === undefined || value === null) return true;
        
        if (typeof value === 'number' && value > rules.max) {
          throw new Error(`Field must be at most ${rules.max}`);
        }
        
        if (typeof value === 'string' && value.length > rules.max) {
          throw new Error(`Field must be at most ${rules.max} characters`);
        }
        
        if (Array.isArray(value) && value.length > rules.max) {
          throw new Error(`Array must contain at most ${rules.max} items`);
        }
        
        return true;
      });
    }
    
    if (rules.pattern) {
      validations.push((value) => {
        if (value === undefined || value === null) return true;
        
        if (typeof value === 'string' && !rules.pattern.test(value)) {
          throw new Error('Field format is invalid');
        }
        
        return true;
      });
    }
    
    if (rules.enum) {
      validations.push((value) => {
        if (value === undefined || value === null) return true;
        
        if (!rules.enum.includes(value)) {
          throw new Error(`Field must be one of: ${rules.enum.join(', ')}`);
        }
        
        return true;
      });
    }
    
    if (rules.custom) {
      validations.push(rules.custom);
    }
    
    return (value) => {
      for (const validation of validations) {
        validation(value);
      }
      return true;
    };
  }
  
  validate(data) {
    const errors = [];
    const validated = {};
    
    for (const [key, validator] of this.validators) {
      try {
        validator(data[key]);
        validated[key] = data[key];
      } catch (error) {
        errors.push({
          field: key,
          message: error.message,
          value: data[key]
        });
      }
    }
    
    // Check for extra fields
    for (const key of Object.keys(data)) {
      if (!this.validators.has(key)) {
        errors.push({
          field: key,
          message: 'Unexpected field',
          value: data[key]
        });
      }
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Schema validation failed', errors);
    }
    
    return validated;
  }
}

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Schema-enforced object with runtime validation
class SchemaEnforcedObject {
  constructor(schema, initialData = {}) {
    this._schema = schema;
    this._validator = new SchemaValidator(schema);
    this._data = {};
    this._changes = [];
    this._isFrozen = false;
    
    // Initialize with validated data
    if (Object.keys(initialData).length > 0) {
      this._update(initialData, 'INIT');
    }
    
    // Create proxy for property access
    return this._createProxy();
  }
  
  _createProxy() {
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }
        
        if (prop in target._data) {
          return target._data[prop];
        }
        
        return undefined;
      },
      
      set: (target, prop, value) => {
        if (prop in target) {
          target[prop] = value;
          return true;
        }
        
        if (target._isFrozen) {
          throw new Error('Object is frozen. Cannot modify properties.');
        }
        
        // Validate against schema
        const schemaRules = target._schema[prop];
        if (!schemaRules) {
          throw new Error(`Property ${prop} not defined in schema`);
        }
        
        const validator = target._validator._createValidator(schemaRules);
        try {
          validator(value);
        } catch (error) {
          throw new Error(`Validation failed for ${prop}: ${error.message}`);
        }
        
        const oldValue = target._data[prop];
        target._data[prop] = value;
        
        target._changes.push({
          property: prop,
          oldValue,
          newValue: value,
          timestamp: new Date(),
          type: 'UPDATE'
        });
        
        return true;
      },
      
      deleteProperty: (target, prop) => {
        if (target._isFrozen) {
          throw new Error('Object is frozen. Cannot delete properties.');
        }
        
        if (target._schema[prop] && target._schema[prop].required) {
          throw new Error(`Cannot delete required property: ${prop}`);
        }
        
        const oldValue = target._data[prop];
        delete target._data[prop];
        
        target._changes.push({
          property: prop,
          oldValue,
          newValue: undefined,
          timestamp: new Date(),
          type: 'DELETE'
        });
        
        return true;
      },
      
      ownKeys: (target) => {
        return Reflect.ownKeys(target._data);
      },
      
      getOwnPropertyDescriptor: (target, prop) => {
        if (prop in target._data) {
          return {
            value: target._data[prop],
            writable: !target._isFrozen,
            enumerable: true,
            configurable: !target._isFrozen
          };
        }
        
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
  }
  
  _update(data, changeType = 'UPDATE') {
    const validated = this._validator.validate(data);
    
    for (const [key, value] of Object.entries(validated)) {
      const oldValue = this._data[key];
      this._data[key] = value;
      
      this._changes.push({
        property: key,
        oldValue,
        newValue: value,
        timestamp: new Date(),
        type: changeType
      });
    }
  }
  
  // Batch update with validation
  update(changes) {
    if (this._isFrozen) {
      throw new Error('Object is frozen. Cannot update.');
    }
    
    this._update(changes, 'BATCH_UPDATE');
    return this;
  }
  
  // Get change history
  getChangeHistory() {
    return [...this._changes];
  }
  
  // Freeze object (make immutable)
  freeze() {
    this._isFrozen = true;
    Object.freeze(this._data);
    return this;
  }
  
  // Create snapshot
  toJSON() {
    return { ...this._data };
  }
  
  // Get schema information
  getSchema() {
    return { ...this._schema };
  }
}

// Usage in production
function schemaValidationDemo() {
  // Define schema
  const userSchema = {
    id: {
      type: 'number',
      required: true,
      min: 1
    },
    username: {
      type: 'string',
      required: true,
      min: 3,
      max: 50,
      pattern: /^[a-zA-Z0-9_]+$/
    },
    email: {
      type: 'string',
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    age: {
      type: 'number',
      min: 0,
      max: 150
    },
    role: {
      type: 'string',
      enum: ['user', 'admin', 'moderator'],
      default: 'user'
    },
    tags: {
      type: 'array',
      max: 10
    },
    metadata: {
      type: 'object'
    },
    createdAt: {
      type: 'date',
      required: true
    }
  };
  
  // Create schema-enforced object
  const user = new SchemaEnforcedObject(userSchema, {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    age: 30,
    role: 'user',
    tags: ['developer', 'nodejs'],
    metadata: { newsletter: true },
    createdAt: new Date()
  });
  
  console.log('User object:', user.toJSON());
  
  // Property access works normally
  console.log('Username:', user.username);
  console.log('Email:', user.email);
  
  // Validation on property assignment
  try {
    user.username = 'jo'; // Too short
  } catch (error) {
    console.log('Validation error:', error.message);
  }
  
  try {
    user.email = 'invalid-email'; // Invalid format
  } catch (error) {
    console.log('Validation error:', error.message);
  }
  
  try {
    user.role = 'superadmin'; // Not in enum
  } catch (error) {
    console.log('Validation error:', error.message);
  }
  
  // Batch update
  user.update({
    age: 31,
    tags: ['developer', 'nodejs', 'backend']
  });
  
  console.log('After update:', user.toJSON());
  
  // Show change history
  console.log('Change history:', user.getChangeHistory());
  
  // Freeze object
  user.freeze();
  
  try {
    user.username = 'new_username'; // This will throw error
  } catch (error) {
    console.log('Expected error after freeze:', error.message);
  }
}

schemaValidationDemo();

// ## 4. Performance-Optimized Property Access for High-Frequency Operations

// High-performance property access with caching
class OptimizedDataStore {
  constructor(options = {}) {
    this._data = new Map();
    this._indexes = new Map();
    this._cache = new Map();
    this._options = {
      cacheEnabled: options.cacheEnabled !== false,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      maxCacheSize: options.maxCacheSize || 10000,
      indexFields: options.indexFields || [],
      ...options
    };
    
    this._accessStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    this._lastCleanup = Date.now();
    
    // Initialize indexes
    this._initializeIndexes();
    
    // Create optimized property access
    return this._createOptimizedProxy();
  }
  
  _initializeIndexes() {
    for (const field of this._options.indexFields) {
      this._indexes.set(field, new Map());
    }
  }
  
  _createOptimizedProxy() {
    const handler = {
      get: (target, prop) => {
        // Handle special properties
        if (prop === 'stats') {
          return this._getStats();
        }
        
        if (prop === 'clearCache') {
          return () => this._clearCache();
        }
        
        if (prop === 'toJSON') {
          return () => this._serialize();
        }
        
        // Check cache first
        if (this._options.cacheEnabled) {
          const cached = this._cache.get(prop);
          if (cached && Date.now() < cached.expiresAt) {
            this._accessStats.hits++;
            return cached.value;
          }
        }
        
        // Get from data store
        const value = this._data.get(prop);
        this._accessStats.misses++;
        
        // Cache the value
        if (this._options.cacheEnabled && value !== undefined) {
          this._setCache(prop, value);
        }
        
        return value;
      },
      
      set: (target, prop, value) => {
        const oldValue = this._data.get(prop);
        
        // Update data store
        this._data.set(prop, value);
        this._accessStats.sets++;
        
        // Update indexes
        this._updateIndexes(prop, oldValue, value);
        
        // Update cache
        if (this._options.cacheEnabled) {
          this._setCache(prop, value);
        }
        
        // Cleanup cache if needed
        this._cleanupCache();
        
        return true;
      },
      
      deleteProperty: (target, prop) => {
        const oldValue = this._data.get(prop);
        
        // Remove from data store
        this._data.delete(prop);
        this._accessStats.deletes++;
        
        // Remove from indexes
        this._removeFromIndexes(prop, oldValue);
        
        // Remove from cache
        this._cache.delete(prop);
        
        return true;
      },
      
      has: (target, prop) => {
        return this._data.has(prop);
      },
      
      ownKeys: (target) => {
        return Array.from(this._data.keys());
      },
      
      getOwnPropertyDescriptor: (target, prop) => {
        if (this._data.has(prop)) {
          return {
            value: this._data.get(prop),
            writable: true,
            enumerable: true,
            configurable: true
          };
        }
      }
    };
    
    return new Proxy(this, handler);
  }
  
  _setCache(key, value) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + this._options.cacheTTL,
      lastAccessed: Date.now()
    });
    
    // Evict if cache is too large
    if (this._cache.size > this._options.maxCacheSize) {
      this._evictOldest();
    }
  }
  
  _evictOldest() {
    let oldestKey = null;
    let oldestAccess = Date.now();
    
    for (const [key, entry] of this._cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestKey = key;
        oldestAccess = entry.lastAccessed;
      }
    }
    
    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }
  
  _cleanupCache() {
    const now = Date.now();
    
    // Cleanup every minute
    if (now - this._lastCleanup > 60000) {
      for (const [key, entry] of this._cache.entries()) {
        if (now > entry.expiresAt) {
          this._cache.delete(key);
        }
      }
      this._lastCleanup = now;
    }
  }
  
  _updateIndexes(key, oldValue, newValue) {
    for (const [field, index] of this._indexes) {
      // Remove old value from index
      if (oldValue && oldValue[field] !== undefined) {
        const oldIndexKey = oldValue[field];
        const keys = index.get(oldIndexKey);
        if (keys) {
          const newKeys = keys.filter(k => k !== key);
          if (newKeys.length === 0) {
            index.delete(oldIndexKey);
          } else {
            index.set(oldIndexKey, newKeys);
          }
        }
      }
      
      // Add new value to index
      if (newValue && newValue[field] !== undefined) {
        const newIndexKey = newValue[field];
        if (!index.has(newIndexKey)) {
          index.set(newIndexKey, []);
        }
        index.get(newIndexKey).push(key);
      }
    }
  }
  
  _removeFromIndexes(key, oldValue) {
    for (const [field, index] of this._indexes) {
      if (oldValue && oldValue[field] !== undefined) {
        const indexKey = oldValue[field];
        const keys = index.get(indexKey);
        if (keys) {
          const newKeys = keys.filter(k => k !== key);
          if (newKeys.length === 0) {
            index.delete(indexKey);
          } else {
            index.set(indexKey, newKeys);
          }
        }
      }
    }
  }
  
  // Query by indexed field
  findBy(field, value) {
    if (!this._indexes.has(field)) {
      throw new Error(`Field ${field} is not indexed`);
    }
    
    const index = this._indexes.get(field);
    const keys = index.get(value) || [];
    
    return keys.map(key => this[key]);
  }
  
  // Batch operations
  setMultiple(entries) {
    for (const [key, value] of Object.entries(entries)) {
      this[key] = value;
    }
    return this;
  }
  
  getMultiple(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this[key];
    }
    return result;
  }
  
  _getStats() {
    const hitRate = this._accessStats.hits + this._accessStats.misses > 0 
      ? (this._accessStats.hits / (this._accessStats.hits + this._accessStats.misses)) * 100 
      : 0;
    
    return {
      ...this._accessStats,
      hitRate: `${hitRate.toFixed(2)}%`,
      dataSize: this._data.size,
      cacheSize: this._cache.size,
      indexCount: this._indexes.size
    };
  }
  
  _clearCache() {
    this._cache.clear();
    return this;
  }
  
  _serialize() {
    const result = {};
    for (const [key, value] of this._data.entries()) {
      result[key] = value;
    }
    return result;
  }
}

// Usage for high-performance scenarios
function performanceDemo() {
  // Create optimized store with indexing
  const store = new OptimizedDataStore({
    cacheEnabled: true,
    cacheTTL: 60000, // 1 minute
    maxCacheSize: 1000,
    indexFields: ['category', 'status']
  });
  
  // Populate with sample data
  const sampleData = {
    user_1: { id: 1, name: 'John', category: 'premium', status: 'active' },
    user_2: { id: 2, name: 'Jane', category: 'basic', status: 'active' },
    user_3: { id: 3, name: 'Bob', category: 'premium', status: 'inactive' },
    user_4: { id: 4, name: 'Alice', category: 'basic', status: 'active' },
    config: { theme: 'dark', language: 'en', version: '1.0.0' }
  };
  
  store.setMultiple(sampleData);
  
  // Demonstrate property access
  console.log('User 1:', store.user_1);
  console.log('Config:', store.config);
  
  // Query using indexes
  console.log('Premium users:', store.findBy('category', 'premium'));
  console.log('Active users:', store.findBy('status', 'active'));
  
  // Performance testing
  console.log('\n=== Performance Test ===');
  
  // Simulate high-frequency access
  const startTime = Date.now();
  const iterations = 10000;
  
  for (let i = 0; i < iterations; i++) {
    // Mixed operations
    const value = store.user_1; // Read
    store[`temp_${i}`] = { value: i, timestamp: Date.now() }; // Write
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`Completed ${iterations} operations in ${duration}ms`);
  console.log('Operations per second:', Math.round(iterations / (duration / 1000)));
  console.log('Store stats:', store.stats);
  
  // Cleanup
  for (let i = 0; i < iterations; i++) {
    delete store[`temp_${i}`];
  }
  
  console.log('Final stats:', store.stats);
}

performanceDemo();

// ## 5. Advanced: Property-Based Authorization and Access Control

// Role-based property access control
class SecureObject {
  constructor(initialData = {}, options = {}) {
    this._data = new Map();
    this._permissions = new Map();
    this._auditLog = [];
    this._options = {
      defaultRole: options.defaultRole || 'user',
      enableAudit: options.enableAudit !== false,
      strictMode: options.strictMode !== false,
      ...options
    };
    
    this._roles = new Set(['admin', 'user', 'viewer', 'editor']);
    this._sensitiveProperties = new Set(options.sensitiveProperties || []);
    
    // Initialize with data
    this._initializeData(initialData);
    
    return this._createSecureProxy();
  }
  
  _initializeData(data) {
    for (const [key, value] of Object.entries(data)) {
      this._data.set(key, value);
      
      // Set default permissions
      this._setDefaultPermissions(key);
    }
  }
  
  _setDefaultPermissions(property) {
    const isSensitive = this._sensitiveProperties.has(property);
    
    this._permissions.set(property, {
      read: isSensitive ? ['admin'] : ['admin', 'user', 'viewer', 'editor'],
      write: isSensitive ? ['admin'] : ['admin', 'editor'],
      delete: ['admin']
    });
  }
  
  _createSecureProxy() {
    const handler = {
      get: (target, prop) => {
        // Handle internal properties
        if (prop.startsWith('_') || prop in target) {
          return target[prop];
        }
        
        // Check if property exists
        if (!target._data.has(prop)) {
          if (target._options.strictMode) {
            throw new Error(`Property ${prop} does not exist`);
          }
          return undefined;
        }
        
        // Check read permissions
        if (!target._hasPermission(prop, 'read')) {
          target._logAudit('READ_DENIED', prop, null, 'Permission denied');
          throw new Error(`Read access denied for property: ${prop}`);
        }
        
        const value = target._data.get(prop);
        target._logAudit('READ', prop, value);
        
        return value;
      },
      
      set: (target, prop, value) => {
        // Check write permissions
        if (!target._hasPermission(prop, 'write')) {
          target._logAudit('WRITE_DENIED', prop, value, 'Permission denied');
          throw new Error(`Write access denied for property: ${prop}`);
        }
        
        const oldValue = target._data.get(prop);
        target._data.set(prop, value);
        
        target._logAudit('WRITE', prop, value, null, oldValue);
        
        return true;
      },
      
      deleteProperty: (target, prop) => {
        // Check delete permissions
        if (!target._hasPermission(prop, 'delete')) {
          target._logAudit('DELETE_DENIED', prop, null, 'Permission denied');
          throw new Error(`Delete access denied for property: ${prop}`);
        }
        
        const oldValue = target._data.get(prop);
        target._data.delete(prop);
        target._permissions.delete(prop);
        
        target._logAudit('DELETE', prop, null, null, oldValue);
        
        return true;
      },
      
      ownKeys: (target) => {
        const keys = Array.from(target._data.keys());
        
        // Filter based on read permissions
        return keys.filter(key => target._hasPermission(key, 'read'));
      },
      
      getOwnPropertyDescriptor: (target, prop) => {
        if (target._data.has(prop) && target._hasPermission(prop, 'read')) {
          return {
            value: target._data.get(prop),
            writable: target._hasPermission(prop, 'write'),
            enumerable: true,
            configurable: target._hasPermission(prop, 'delete')
          };
        }
        
        return undefined;
      }
    };
    
    return new Proxy(this, handler);
  }
  
  _hasPermission(property, action) {
    const userRole = this._currentUser?.role || this._options.defaultRole;
    const permissions = this._permissions.get(property);
    
    if (!permissions || !permissions[action]) {
      return false;
    }
    
    return permissions[action].includes(userRole);
  }
  
  _logAudit(action, property, newValue, reason = null, oldValue = null) {
    if (!this._options.enableAudit) return;
    
    this._auditLog.push({
      action,
      property,
      newValue: this._shouldRedact(property) ? '***REDACTED***' : newValue,
      oldValue: this._shouldRedact(property) ? '***REDACTED***' : oldValue,
      user: this._currentUser?.id || 'system',
      role: this._currentUser?.role || this._options.defaultRole,
      timestamp: new Date(),
      reason
    });
    
    // Keep only last 1000 entries
    if (this._auditLog.length > 1000) {
      this._auditLog = this._auditLog.slice(-1000);
    }
  }
  
  _shouldRedact(property) {
    return this._sensitiveProperties.has(property);
  }
  
  // User context management
  setUserContext(user) {
    if (!user || !user.role || !this._roles.has(user.role)) {
      throw new Error('Invalid user context');
    }
    
    this._currentUser = { ...user };
    this._logAudit('USER_CONTEXT_SET', null, null, `User: ${user.id}, Role: ${user.role}`);
    
    return this;
  }
  
  clearUserContext() {
    this._currentUser = null;
    this._logAudit('USER_CONTEXT_CLEARED');
    
    return this;
  }
  
  // Permission management
  setPermissions(property, permissions) {
    if (!this._data.has(property)) {
      throw new Error(`Property ${property} does not exist`);
    }
    
    // Validate permissions structure
    const validActions = ['read', 'write', 'delete'];
    for (const action of Object.keys(permissions)) {
      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}`);
      }
      
      if (!Array.isArray(permissions[action])) {
        throw new Error(`Permissions for ${action} must be an array`);
      }
      
      for (const role of permissions[action]) {
        if (!this._roles.has(role)) {
          throw new Error(`Invalid role: ${role}`);
        }
      }
    }
    
    this._permissions.set(property, permissions);
    this._logAudit('PERMISSIONS_UPDATED', property, permissions);
    
    return this;
  }
  
  // Role management
  addRole(role) {
    this._roles.add(role);
    return this;
  }
  
  removeRole(role) {
    if (role === 'admin') {
      throw new Error('Cannot remove admin role');
    }
    this._roles.delete(role);
    return this;
  }
  
  // Audit methods
  getAuditLog(filter = {}) {
    let log = [...this._auditLog];
    
    if (filter.action) {
      log = log.filter(entry => entry.action === filter.action);
    }
    
    if (filter.property) {
      log = log.filter(entry => entry.property === filter.property);
    }
    
    if (filter.user) {
      log = log.filter(entry => entry.user === filter.user);
    }
    
    if (filter.startDate) {
      log = log.filter(entry => entry.timestamp >= filter.startDate);
    }
    
    if (filter.endDate) {
      log = log.filter(entry => entry.timestamp <= filter.endDate);
    }
    
    return log;
  }
  
  // Security report
  getSecurityReport() {
    const sensitiveProps = Array.from(this._sensitiveProperties);
    const adminOnlyProps = Array.from(this._data.keys()).filter(prop => {
      const perms = this._permissions.get(prop);
      return perms && perms.read && perms.read.length === 1 && perms.read[0] === 'admin';
    });
    
    return {
      totalProperties: this._data.size,
      sensitiveProperties: sensitiveProps.length,
      adminOnlyProperties: adminOnlyProps.length,
      roles: Array.from(this._roles),
      auditEntries: this._auditLog.length,
      currentUser: this._currentUser ? {
        id: this._currentUser.id,
        role: this._currentUser.role
      } : null
    };
  }
}

// Usage in secure application
function securityDemo() {
  // Create secure object with sensitive data
  const secureData = new SecureObject({
    publicInfo: 'This is public information',
    userData: 'Regular user data',
    adminNotes: 'Sensitive admin notes',
    apiKeys: 'secret-api-keys-here',
    config: {
      featureFlag: true,
      maxUsers: 1000
    }
  }, {
    sensitiveProperties: ['adminNotes', 'apiKeys'],
    enableAudit: true,
    strictMode: true
  });
  
  // Add roles
  secureData.addRole('auditor');
  
  // Set permissions
  secureData.setPermissions('publicInfo', {
    read: ['admin', 'user', 'viewer', 'editor', 'auditor'],
    write: ['admin', 'editor'],
    delete: ['admin']
  });
  
  secureData.setPermissions('adminNotes', {
    read: ['admin', 'auditor'],
    write: ['admin'],
    delete: ['admin']
  });
  
  // Test different user contexts
  console.log('=== Testing User Access ===');
  
  // Regular user
  secureData.setUserContext({ id: 'user_1', role: 'user' });
  
  console.log('User can read publicInfo:', secureData.publicInfo);
  
  try {
    console.log('User reading adminNotes:', secureData.adminNotes);
  } catch (error) {
    console.log('Expected error for user:', error.message);
  }
  
  // Editor user
  secureData.setUserContext({ id: 'editor_1', role: 'editor' });
  
  console.log('Editor can read publicInfo:', secureData.publicInfo);
  
  try {
    secureData.publicInfo = 'Modified by editor';
    console.log('Editor modified publicInfo:', secureData.publicInfo);
  } catch (error) {
    console.log('Editor write error:', error.message);
  }
  
  // Admin user
  secureData.setUserContext({ id: 'admin_1', role: 'admin' });
  
  console.log('Admin can read adminNotes:', secureData.adminNotes);
  console.log('Admin can read apiKeys:', secureData.apiKeys);
  
  // Show audit log
  console.log('\n=== Audit Log ===');
  const recentAudit = secureData.getAuditLog({ 
    action: 'READ_DENIED' 
  });
  
  recentAudit.forEach(entry => {
    console.log(`[${entry.timestamp.toISOString()}] ${entry.action} ${entry.property} by ${entry.user}: ${entry.reason}`);
  });
  
  // Security report
  console.log('\n=== Security Report ===');
  console.log(secureData.getSecurityReport());
  
  // List accessible properties for current user
  console.log('\n=== Accessible Properties for Admin ===');
  console.log('Properties:', Object.keys(secureData));
}

securityDemo();

// These production-grade patterns demonstrate advanced object property management for:

// 1. **Security** - Property-level access control and validation
// 2. **Performance** - Optimized access patterns with caching
// 3. **Auditability** - Comprehensive change tracking and logging
// 4. **Validation** - Runtime schema enforcement
// 5. **Metadata** - Rich property descriptors and metadata management

// These techniques are essential for building robust, secure, and maintainable Node.js backend systems.






























// Here are comprehensive code snippets for JavaScript object methods in Node.js production-grade backend development:

// ## 1. Advanced Object Methods for Configuration Management

// Production-grade configuration manager using Object methods
class ConfigManager {
  constructor(defaultConfig = {}) {
    this._config = Object.create(null); // Null prototype for security
    this._defaults = Object.freeze({ ...defaultConfig });
    this._validators = new Map();
    this._watchers = new Map();
    this._version = 1;
    
    // Initialize with defaults
    this._initializeConfig();
  }
  
  _initializeConfig() {
    // Use Object.assign for shallow merge
    Object.assign(this._config, this._defaults);
    
    // Define immutable properties using Object.defineProperty
    Object.defineProperty(this._config, '_metadata', {
      value: {
        createdAt: new Date(),
        version: this._version,
        source: 'default'
      },
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  
  // Deep merge configuration using Object methods
  merge(config, source = 'custom') {
    if (!this._isValidConfig(config)) {
      throw new Error('Invalid configuration object');
    }
    
    // Use Object.keys and Object.entries for iteration
    Object.keys(config).forEach(key => {
      const value = config[key];
      
      // Validate before merging
      if (this._validators.has(key)) {
        const validator = this._validators.get(key);
        if (!validator(value)) {
          throw new Error(`Validation failed for key: ${key}`);
        }
      }
      
      // Deep merge objects, shallow copy for others
      if (this._isObject(value) && this._isObject(this._config[key])) {
        this._config[key] = this._deepMerge(this._config[key], value);
      } else {
        this._config[key] = value;
      }
    });
    
    this._version++;
    this._updateMetadata(source);
    this._notifyWatchers('merge', config);
    
    return this;
  }
  
  // Deep merge implementation using Object methods
  _deepMerge(target, source) {
    const result = Object.assign({}, target);
    
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (this._isObject(sourceValue) && this._isObject(targetValue)) {
        result[key] = this._deepMerge(targetValue, sourceValue);
      } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        result[key] = [...new Set([...targetValue, ...sourceValue])];
      } else {
        result[key] = sourceValue;
      }
    });
    
    return result;
  }
  
  // Set individual property with validation
  set(key, value, options = {}) {
    const { validate = true, notify = true } = options;
    
    if (validate && this._validators.has(key)) {
      const validator = this._validators.get(key);
      if (!validator(value)) {
        throw new Error(`Validation failed for key: ${key}`);
      }
    }
    
    // Use Object.defineProperty for fine-grained control
    Object.defineProperty(this._config, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
    
    this._version++;
    
    if (notify) {
      this._notifyWatchers('set', { [key]: value });
    }
    
    return this;
  }
  
  // Get configuration with optional transformation
  get(key, transform = null) {
    if (!key) {
      return this._cloneConfig();
    }
    
    const keys = key.split('.');
    let value = this._config;
    
    for (const k of keys) {
      if (value == null || !Object.prototype.hasOwnProperty.call(value, k)) {
        return undefined;
      }
      value = value[k];
    }
    
    return transform ? transform(value) : value;
  }
  
  // Check if configuration has specific key
  has(key) {
    const keys = key.split('.');
    let obj = this._config;
    
    for (const k of keys) {
      if (!obj || !Object.prototype.hasOwnProperty.call(obj, k)) {
        return false;
      }
      obj = obj[k];
    }
    
    return true;
  }
  
  // Delete configuration property
  delete(key) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let obj = this._config;
    
    for (const k of keys) {
      if (!obj || !Object.prototype.hasOwnProperty.call(obj, k)) {
        return false;
      }
      obj = obj[k];
    }
    
    if (obj && Object.prototype.hasOwnProperty.call(obj, lastKey)) {
      delete obj[lastKey];
      this._version++;
      this._notifyWatchers('delete', { key });
      return true;
    }
    
    return false;
  }
  
  // Add validator for configuration property
  addValidator(key, validatorFn) {
    this._validators.set(key, validatorFn);
    return this;
  }
  
  // Watch for configuration changes
  watch(key, callback) {
    if (!this._watchers.has(key)) {
      this._watchers.set(key, new Set());
    }
    this._watchers.get(key).add(callback);
    
    return () => {
      const watchers = this._watchers.get(key);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this._watchers.delete(key);
        }
      }
    };
  }
  
  // Get all configuration keys
  keys() {
    return Object.keys(this._config).filter(key => !key.startsWith('_'));
  }
  
  // Get all configuration entries
  entries() {
    return Object.entries(this._config).filter(([key]) => !key.startsWith('_'));
  }
  
  // Get configuration as frozen object
  toObject() {
    return Object.freeze(this._cloneConfig());
  }
  
  // Reset to defaults
  reset() {
    const oldConfig = this._cloneConfig();
    
    // Clear current config
    Object.keys(this._config).forEach(key => {
      if (!key.startsWith('_')) {
        delete this._config[key];
      }
    });
    
    // Restore defaults
    Object.assign(this._config, this._defaults);
    
    this._version++;
    this._notifyWatchers('reset', oldConfig);
    
    return this;
  }
  
  // Utility methods
  _isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
  
  _isValidConfig(config) {
    return config && typeof config === 'object' && !Array.isArray(config);
  }
  
  _cloneConfig() {
    return JSON.parse(JSON.stringify(this._config));
  }
  
  _updateMetadata(source) {
    if (Object.prototype.hasOwnProperty.call(this._config, '_metadata')) {
      this._config._metadata.updatedAt = new Date();
      this._config._metadata.version = this._version;
      this._config._metadata.lastSource = source;
    }
  }
  
  _notifyWatchers(action, data) {
    this._watchers.forEach((callbacks, key) => {
      if (key === '*' || (typeof data === 'object' && Object.keys(data).includes(key))) {
        callbacks.forEach(callback => {
          try {
            callback(action, data, this._version);
          } catch (error) {
            console.error('Config watcher error:', error);
          }
        });
      }
    });
  }
  
  // Static factory method
  static createFromEnv(prefix = 'APP_') {
    const config = {};
    
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        let value = process.env[key];
        
        // Try to parse JSON values
        if (value && (value.startsWith('{') || value.startsWith('['))) {
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string if parsing fails
          }
        }
        
        // Convert string booleans and numbers
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        if (!isNaN(value) && value !== '') value = Number(value);
        
        config[configKey] = value;
      }
    });
    
    return new ConfigManager(config);
  }
}

// Usage in production
function configManagerDemo() {
  const configManager = new ConfigManager({
    database: {
      host: 'localhost',
      port: 5432,
      pool: { max: 10, min: 2 }
    },
    server: {
      port: 3000,
      cors: ['https://example.com']
    },
    features: {
      caching: true,
      compression: false
    }
  });
  
  // Add validators
  configManager.addValidator('server.port', (port) => {
    return Number.isInteger(port) && port > 0 && port < 65536;
  });
  
  // Watch for changes
  const unwatch = configManager.watch('database.host', (action, data) => {
    console.log(`Database host changed: ${action}`, data);
  });
  
  // Merge configuration
  configManager.merge({
    database: {
      host: 'production-db.example.com',
      ssl: true
    },
    logging: {
      level: 'debug',
      format: 'json'
    }
  });
  
  // Set individual values
  configManager.set('server.port', 8080);
  
  // Get values
  console.log('Database host:', configManager.get('database.host'));
  console.log('Server port:', configManager.get('server.port'));
  console.log('Has logging?', configManager.has('logging'));
  
  // Get all keys
  console.log('All keys:', configManager.keys());
  
  // Create from environment
  const envConfig = ConfigManager.createFromEnv('APP_');
  console.log('Env config keys:', envConfig.keys());
  
  // Cleanup
  unwatch();
}

configManagerDemo();

// ## 2. Object Methods for Data Transformation and Serialization

// Advanced data transformer using Object methods
class DataTransformer {
  constructor(options = {}) {
    this._options = {
      dateFormat: options.dateFormat || 'iso',
      redactSensitive: options.redactSensitive !== false,
      maxDepth: options.maxDepth || 10,
      ...options
    };
    
    this._sensitiveFields = new Set([
      'password', 'token', 'secret', 'authorization',
      'creditCard', 'ssn', 'apiKey'
    ]);
    
    this._transformers = new Map();
    this._validators = new Map();
    
    this._registerDefaultTransformers();
  }
  
  _registerDefaultTransformers() {
    // Date transformer
    this._transformers.set('date', (value) => {
      if (!(value instanceof Date)) return value;
      
      switch (this._options.dateFormat) {
        case 'iso':
          return value.toISOString();
        case 'timestamp':
          return value.getTime();
        case 'locale':
          return value.toLocaleString();
        default:
          return value.toISOString();
      }
    });
    
    // Buffer transformer
    this._transformers.set('buffer', (value) => {
      if (Buffer.isBuffer(value)) {
        return value.toString('base64');
      }
      return value;
    });
    
    // Sensitive data transformer
    this._transformers.set('sensitive', (value, key) => {
      if (this._sensitiveFields.has(key) && this._options.redactSensitive) {
        return '***REDACTED***';
      }
      return value;
    });
  }
  
  // Transform object for serialization
  transform(data, context = {}) {
    if (data == null) return data;
    
    // Handle primitive types
    if (typeof data !== 'object') {
      return data;
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.transform(item, { ...context, depth: (context.depth || 0) + 1 }));
    }
    
    // Check depth limit
    if ((context.depth || 0) >= this._options.maxDepth) {
      return '[Maximum depth reached]';
    }
    
    // Create new object with transformed properties
    const transformed = Object.create(null);
    
    Object.keys(data).forEach(key => {
      let value = data[key];
      
      // Apply sensitive data transformation
      value = this._applyTransformer('sensitive', value, key);
      
      // Apply type-specific transformers
      if (value instanceof Date) {
        value = this._applyTransformer('date', value, key);
      } else if (Buffer.isBuffer(value)) {
        value = this._applyTransformer('buffer', value, key);
      } else if (typeof value === 'object' && value !== null) {
        value = this.transform(value, { ...context, depth: (context.depth || 0) + 1 });
      }
      
      // Apply custom transformers
      if (this._transformers.has(key)) {
        value = this._applyTransformer(key, value, key);
      }
      
      transformed[key] = value;
    });
    
    return transformed;
  }
  
  // Normalize object structure
  normalize(data, schema) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    const normalized = Object.create(null);
    
    Object.keys(schema).forEach(key => {
      const fieldSchema = schema[key];
      const value = data[key];
      
      // Apply normalization based on schema
      normalized[key] = this._normalizeValue(value, fieldSchema, key);
    });
    
    return normalized;
  }
  
  _normalizeValue(value, schema, key) {
    if (value === undefined || value === null) {
      return schema.default;
    }
    
    // Type conversion
    switch (schema.type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? schema.default : num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      case 'date':
        if (typeof value === 'string' || typeof value === 'number') {
          return new Date(value);
        }
        return value instanceof Date ? value : schema.default;
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' && value !== null ? value : schema.default;
      default:
        return value;
    }
  }
  
  // Flatten nested objects
  flatten(obj, prefix = '', separator = '.') {
    if (obj == null || typeof obj !== 'object') {
      return { [prefix]: obj };
    }
    
    return Object.keys(obj).reduce((acc, key) => {
      const fullKey = prefix ? `${prefix}${separator}${key}` : key;
      const value = obj[key];
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(acc, this.flatten(value, fullKey, separator));
      } else {
        acc[fullKey] = value;
      }
      
      return acc;
    }, Object.create(null));
  }
  
  // Unflatten objects
  unflatten(obj, separator = '.') {
    const result = Object.create(null);
    
    Object.keys(obj).forEach(key => {
      const keys = key.split(separator);
      let current = result;
      
      for (let i = 0; i < keys.length; i++) {
        const part = keys[i];
        
        if (i === keys.length - 1) {
          current[part] = obj[key];
        } else {
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = Object.create(null);
          }
          current = current[part];
        }
      }
    });
    
    return result;
  }
  
  // Deep clone using Object methods
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const clone = Object.create(Object.getPrototypeOf(obj));
    
    Object.keys(obj).forEach(key => {
      clone[key] = this.deepClone(obj[key]);
    });
    
    return clone;
  }
  
  // Compare objects deeply
  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return obj1 === obj2;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => {
      if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
      return this.deepEqual(obj1[key], obj2[key]);
    });
  }
  
  // Merge objects deeply
  deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    
    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this._isObject(source[key])) {
          if (!target[key] || !this._isObject(target[key])) {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          target[key] = [...new Set([...target[key], ...source[key]])];
        } else {
          target[key] = source[key];
        }
      });
    }
    
    return this.deepMerge(target, ...sources);
  }
  
  // Add custom transformer
  addTransformer(name, transformerFn) {
    this._transformers.set(name, transformerFn);
    return this;
  }
  
  // Add sensitive field
  addSensitiveField(field) {
    this._sensitiveFields.add(field);
    return this;
  }
  
  // Utility methods
  _applyTransformer(transformerName, value, key) {
    const transformer = this._transformers.get(transformerName);
    return transformer ? transformer(value, key) : value;
  }
  
  _isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
  
  // Static method for quick transformation
  static serialize(data, options = {}) {
    const transformer = new DataTransformer(options);
    return transformer.transform(data);
  }
}

// Usage in production
function dataTransformationDemo() {
  const transformer = new DataTransformer({
    dateFormat: 'iso',
    redactSensitive: true,
    maxDepth: 5
  });
  
  // Sample data with various types
  const userData = {
    id: 1,
    username: 'john_doe',
    password: 'secret123',
    email: 'john@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      birthDate: new Date('1990-01-01'),
      ssn: '123-45-6789',
      preferences: {
        theme: 'dark',
        notifications: true,
        advanced: {
          apiKeys: ['key1', 'key2']
        }
      }
    },
    tokens: [
      { type: 'access', value: 'access_token_123' },
      { type: 'refresh', value: 'refresh_token_456' }
    ],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      binaryData: Buffer.from('some binary data')
    }
  };
  
  // Add custom sensitive field
  transformer.addSensitiveField('email');
  
  // Transform data for safe serialization
  const safeData = transformer.transform(userData);
  console.log('Transformed data:', JSON.stringify(safeData, null, 2));
  
  // Flatten the object
  const flattened = transformer.flatten(userData);
  console.log('Flattened data:', flattened);
  
  // Unflatten back
  const unflattened = transformer.unflatten(flattened);
  console.log('Unflattened data matches original:', transformer.deepEqual(userData, unflattened));
  
  // Deep clone
  const cloned = transformer.deepClone(userData);
  console.log('Deep clone successful:', transformer.deepEqual(userData, cloned));
  
  // Normalize with schema
  const schema = {
    id: { type: 'number', default: 0 },
    username: { type: 'string', default: '' },
    age: { type: 'number', default: 0 },
    isActive: { type: 'boolean', default: false },
    tags: { type: 'array', default: [] }
  };
  
  const rawData = {
    id: '123',
    username: 'jane_doe',
    age: '30',
    isActive: 'true',
    tags: 'developer'
  };
  
  const normalized = transformer.normalize(rawData, schema);
  console.log('Normalized data:', normalized);
}

dataTransformationDemo();

// ## 3. Object Methods for Advanced Validation and Sanitization

// Production-grade object validator
class ObjectValidator {
  constructor(rules = {}) {
    this._rules = new Map(Object.entries(rules));
    this._customValidators = new Map();
    this._sanitizers = new Map();
    this._errors = new Map();
    
    this._registerBuiltInValidators();
    this._registerBuiltInSanitizers();
  }
  
  _registerBuiltInValidators() {
    this._customValidators.set('required', (value) => {
      return value !== undefined && value !== null && value !== '';
    });
    
    this._customValidators.set('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    });
    
    this._customValidators.set('url', (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });
    
    this._customValidators.set('min', (value, param) => {
      if (typeof value === 'number') return value >= param;
      if (typeof value === 'string') return value.length >= param;
      if (Array.isArray(value)) return value.length >= param;
      return false;
    });
    
    this._customValidators.set('max', (value, param) => {
      if (typeof value === 'number') return value <= param;
      if (typeof value === 'string') return value.length <= param;
      if (Array.isArray(value)) return value.length <= param;
      return false;
    });
  }
  
  _registerBuiltInSanitizers() {
    this._sanitizers.set('trim', (value) => {
      return typeof value === 'string' ? value.trim() : value;
    });
    
    this._sanitizers.set('lowercase', (value) => {
      return typeof value === 'string' ? value.toLowerCase() : value;
    });
    
    this._sanitizers.set('uppercase', (value) => {
      return typeof value === 'string' ? value.toUpperCase() : value;
    });
    
    this._sanitizers.set('escape', (value) => {
      if (typeof value !== 'string') return value;
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    });
  }
  
  // Validate object against rules
  validate(obj, context = {}) {
    this._errors.clear();
    
    if (!obj || typeof obj !== 'object') {
      this._addError('root', 'Input must be an object');
      return this._createResult();
    }
    
    // Check for extra fields if strict mode
    if (context.strict) {
      this._validateNoExtraFields(obj);
    }
    
    // Validate each field
    this._rules.forEach((rules, field) => {
      const value = this._getNestedValue(obj, field);
      this._validateField(field, value, rules, obj);
    });
    
    return this._createResult();
  }
  
  // Sanitize object
  sanitize(obj, rules = null) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = this._deepClone(obj);
    const sanitizeRules = rules || this._rules;
    
    Object.keys(sanitized).forEach(key => {
      const rules = sanitizeRules.get(key);
      if (rules && rules.sanitize) {
        sanitized[key] = this._applySanitizers(sanitized[key], rules.sanitize);
      }
      
      // Recursively sanitize nested objects
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    });
    
    return sanitized;
  }
  
  // Add validation rule
  addRule(field, rules) {
    this._rules.set(field, rules);
    return this;
  }
  
  // Add custom validator
  addValidator(name, validatorFn) {
    this._customValidators.set(name, validatorFn);
    return this;
  }
  
  // Add sanitizer
  addSanitizer(name, sanitizerFn) {
    this._sanitizers.set(name, sanitizerFn);
    return this;
  }
  
  // Get validation schema
  getSchema() {
    const schema = Object.create(null);
    this._rules.forEach((rules, field) => {
      schema[field] = { ...rules };
    });
    return schema;
  }
  
  // Create validator from JSON schema
  static fromJSONSchema(jsonSchema) {
    const validator = new ObjectValidator();
    
    if (jsonSchema.properties) {
      Object.keys(jsonSchema.properties).forEach(property => {
        const propSchema = jsonSchema.properties[property];
        const rules = {};
        
        if (propSchema.type) {
          rules.type = propSchema.type;
        }
        
        if (propSchema.required) {
          rules.required = true;
        }
        
        if (propSchema.minLength !== undefined) {
          rules.min = propSchema.minLength;
        }
        
        if (propSchema.maxLength !== undefined) {
          rules.max = propSchema.maxLength;
        }
        
        if (propSchema.pattern) {
          rules.pattern = new RegExp(propSchema.pattern);
        }
        
        if (propSchema.enum) {
          rules.enum = propSchema.enum;
        }
        
        validator.addRule(property, rules);
      });
    }
    
    return validator;
  }
  
  // Private methods
  _validateField(field, value, rules, obj) {
    // Check required field
    if (rules.required && (value === undefined || value === null || value === '')) {
      this._addError(field, `${field} is required`);
      return;
    }
    
    // Skip further validation if field is optional and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return;
    }
    
    // Type validation
    if (rules.type && !this._validateType(value, rules.type)) {
      this._addError(field, `${field} must be of type ${rules.type}`);
    }
    
    // Custom validators
    Object.keys(rules).forEach(ruleName => {
      if (ruleName === 'required' || ruleName === 'type' || ruleName === 'sanitize') {
        return;
      }
      
      const ruleValue = rules[ruleName];
      
      if (this._customValidators.has(ruleName)) {
        const validator = this._customValidators.get(ruleName);
        if (!validator(value, ruleValue, obj)) {
          this._addError(field, `${field} failed ${ruleName} validation`);
        }
      } else if (ruleName === 'pattern' && typeof value === 'string') {
        if (!ruleValue.test(value)) {
          this._addError(field, `${field} format is invalid`);
        }
      } else if (ruleName === 'enum' && Array.isArray(ruleValue)) {
        if (!ruleValue.includes(value)) {
          this._addError(field, `${field} must be one of: ${ruleValue.join(', ')}`);
        }
      } else if (ruleName === 'custom' && typeof ruleValue === 'function') {
        if (!ruleValue(value, obj)) {
          this._addError(field, `${field} failed custom validation`);
        }
      }
    });
  }
  
  _validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date;
      default:
        return true;
    }
  }
  
  _validateNoExtraFields(obj) {
    const allowedFields = new Set(this._rules.keys());
    
    Object.keys(obj).forEach(field => {
      if (!allowedFields.has(field)) {
        this._addError(field, `Unexpected field: ${field}`);
      }
    });
  }
  
  _applySanitizers(value, sanitizers) {
    let sanitizedValue = value;
    
    if (typeof sanitizers === 'string') {
      sanitizers = [sanitizers];
    }
    
    if (Array.isArray(sanitizers)) {
      sanitizers.forEach(sanitizerName => {
        if (this._sanitizers.has(sanitizerName)) {
          const sanitizer = this._sanitizers.get(sanitizerName);
          sanitizedValue = sanitizer(sanitizedValue);
        }
      });
    }
    
    return sanitizedValue;
  }
  
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  _addError(field, message) {
    if (!this._errors.has(field)) {
      this._errors.set(field, []);
    }
    this._errors.get(field).push(message);
  }
  
  _createResult() {
    const errors = Object.create(null);
    this._errors.forEach((messages, field) => {
      errors[field] = messages;
    });
    
    return {
      isValid: this._errors.size === 0,
      errors,
      getFirstError: (field) => {
        return errors[field] ? errors[field][0] : null;
      },
      getAllErrors: () => errors,
      toString: () => {
        return Object.keys(errors).map(field => 
          `${field}: ${errors[field].join(', ')}`
        ).join('; ');
      }
    };
  }
  
  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Usage in production
function validationDemo() {
  // Create validator with rules
  const validator = new ObjectValidator({
    username: {
      required: true,
      type: 'string',
      min: 3,
      max: 50,
      pattern: /^[a-zA-Z0-9_]+$/,
      sanitize: ['trim', 'lowercase']
    },
    email: {
      required: true,
      type: 'string',
      email: true,
      sanitize: ['trim', 'lowercase']
    },
    age: {
      required: false,
      type: 'number',
      min: 0,
      max: 150
    },
    password: {
      required: true,
      type: 'string',
      min: 8,
      custom: (value) => {
        return /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);
      }
    },
    role: {
      required: true,
      enum: ['user', 'admin', 'moderator']
    },
    preferences: {
      type: 'object',
      required: false
    }
  });
  
  // Test data
  const testData = {
    username: '  John_Doe  ',
    email: 'JOHN@example.com',
    age: '25', // Will be validated as string, but we want number
    password: 'WeakPassword',
    role: 'superadmin', // Not in enum
    extraField: 'This should cause error in strict mode'
  };
  
  // Validate without strict mode
  console.log('=== Validation Results ===');
  const result1 = validator.validate(testData);
  console.log('Is valid:', result1.isValid);
  console.log('Errors:', result1.errors);
  console.log('First error for role:', result1.getFirstError('role'));
  
  // Validate with strict mode
  const result2 = validator.validate(testData, { strict: true });
  console.log('\n=== Strict Validation Results ===');
  console.log('Is valid:', result2.isValid);
  console.log('Errors:', result2.errors);
  
  // Sanitize data
  const sanitized = validator.sanitize(testData);
  console.log('\n=== Sanitized Data ===');
  console.log('Sanitized:', sanitized);
  
  // Create from JSON Schema
  const jsonSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', required: true, minLength: 1 },
      email: { type: 'string', format: 'email' },
      age: { type: 'number', minimum: 0, maximum: 150 }
    },
    required: ['name', 'email']
  };
  
  const schemaValidator = ObjectValidator.fromJSONSchema(jsonSchema);
  const schemaResult = schemaValidator.validate({
    name: 'Jane Doe',
    email: 'jane@example.com',
    age: 30
  });
  
  console.log('\n=== JSON Schema Validation ===');
  console.log('Schema validation result:', schemaResult.isValid);
}

validationDemo();

// ## 4. Object Methods for Performance Optimization

// High-performance object operations for critical paths
class PerformanceOptimizedObject {
  constructor() {
    this._data = Object.create(null);
    this._cache = new Map();
    this._accessCounts = new Map();
    this._listeners = new Map();
    this._options = {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      maxCacheSize: 10000,
      hotPathThreshold: 100
    };
    
    this._setupProxy();
  }
  
  _setupProxy() {
    const handler = {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }
        
        // Track access patterns
        this._trackAccess(prop);
        
        // Check cache first
        if (this._options.cacheEnabled) {
          const cached = this._cache.get(prop);
          if (cached && Date.now() < cached.expiresAt) {
            return cached.value;
          }
        }
        
        const value = this._data[prop];
        
        // Cache the value
        if (this._options.cacheEnabled && value !== undefined) {
          this._setCache(prop, value);
        }
        
        return value;
      },
      
      set: (target, prop, value) => {
        const oldValue = this._data[prop];
        this._data[prop] = value;
        
        // Update cache
        if (this._options.cacheEnabled) {
          this._setCache(prop, value);
        }
        
        // Notify listeners
        this._notifyListeners(prop, value, oldValue);
        
        return true;
      },
      
      deleteProperty: (target, prop) => {
        const oldValue = this._data[prop];
        delete this._data[prop];
        
        // Remove from cache
        this._cache.delete(prop);
        this._accessCounts.delete(prop);
        
        // Notify listeners
        this._notifyListeners(prop, undefined, oldValue);
        
        return true;
      },
      
      has: (target, prop) => {
        return prop in this._data;
      },
      
      ownKeys: (target) => {
        return Object.keys(this._data);
      },
      
      getOwnPropertyDescriptor: (target, prop) => {
        if (prop in this._data) {
          return {
            value: this._data[prop],
            writable: true,
            enumerable: true,
            configurable: true
          };
        }
      }
    };
    
    return new Proxy(this, handler);
  }
  
  // Bulk operations for performance
  setMultiple(entries) {
    const keys = Object.keys(entries);
    
    // Use Object.assign for bulk set
    Object.assign(this._data, entries);
    
    // Bulk cache update
    if (this._options.cacheEnabled) {
      keys.forEach(key => {
        this._setCache(key, entries[key]);
      });
    }
    
    // Bulk notification
    keys.forEach(key => {
      this._notifyListeners(key, entries[key]);
    });
    
    return this;
  }
  
  getMultiple(keys) {
    const result = Object.create(null);
    
    keys.forEach(key => {
      result[key] = this[key];
    });
    
    return result;
  }
  
  // Efficient filtering
  filter(predicate) {
    const result = Object.create(null);
    
    Object.keys(this._data).forEach(key => {
      if (predicate(this._data[key], key)) {
        result[key] = this._data[key];
      }
    });
    
    return result;
  }
  
  // Efficient mapping
  map(transform) {
    const result = Object.create(null);
    
    Object.keys(this._data).forEach(key => {
      result[key] = transform(this._data[key], key);
    });
    
    return result;
  }
  
  // Reduce operation
  reduce(reducer, initialValue) {
    return Object.keys(this._data).reduce((acc, key) => {
      return reducer(acc, this._data[key], key);
    }, initialValue);
  }
  
  // Find operation
  find(predicate) {
    for (const key in this._data) {
      if (predicate(this._data[key], key)) {
        return { key, value: this._data[key] };
      }
    }
    return null;
  }
  
  // Efficient cloning
  clone() {
    const cloned = new PerformanceOptimizedObject();
    
    // Use Object.assign for shallow clone
    Object.assign(cloned._data, this._data);
    
    return cloned;
  }
  
  // Deep clone
  deepClone() {
    const cloned = new PerformanceOptimizedObject();
    
    Object.keys(this._data).forEach(key => {
      cloned._data[key] = this._deepCloneValue(this._data[key]);
    });
    
    return cloned;
  }
  
  // Watch for changes
  watch(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    
    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this._listeners.delete(key);
        }
      }
    };
  }
  
  // Get performance statistics
  getStats() {
    const totalAccesses = Array.from(this._accessCounts.values()).reduce((sum, count) => sum + count, 0);
    
    // Identify hot paths
    const hotPaths = Array.from(this._accessCounts.entries())
      .filter(([_, count]) => count > this._options.hotPathThreshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    return {
      totalProperties: Object.keys(this._data).length,
      cacheSize: this._cache.size,
      totalAccesses,
      hotPaths,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
  
  // Optimize based on access patterns
  optimize() {
    // Clear expired cache entries
    this._cleanupCache();
    
    // Pre-warm cache for hot paths
    const hotPaths = Array.from(this._accessCounts.entries())
      .filter(([_, count]) => count > this._options.hotPathThreshold)
      .map(([key]) => key);
    
    hotPaths.forEach(key => {
      if (this._data[key] !== undefined && !this._cache.has(key)) {
        this._setCache(key, this._data[key]);
      }
    });
    
    return this;
  }
  
  // Private methods
  _trackAccess(key) {
    const count = this._accessCounts.get(key) || 0;
    this._accessCounts.set(key, count + 1);
  }
  
  _setCache(key, value) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + this._options.cacheTTL,
      lastAccessed: Date.now()
    });
    
    // Evict if cache is too large
    if (this._cache.size > this._options.maxCacheSize) {
      this._evictOldestCacheEntry();
    }
  }
  
  _evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestAccess = Date.now();
    
    for (const [key, entry] of this._cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestKey = key;
        oldestAccess = entry.lastAccessed;
      }
    }
    
    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }
  
  _cleanupCache() {
    const now = Date.now();
    
    for (const [key, entry] of this._cache.entries()) {
      if (now > entry.expiresAt) {
        this._cache.delete(key);
      }
    }
  }
  
  _notifyListeners(key, newValue, oldValue) {
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error('Listener error:', error);
        }
      });
    }
  }
  
  _deepCloneValue(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this._deepCloneValue(item));
    }
    
    const cloned = Object.create(null);
    Object.keys(value).forEach(key => {
      cloned[key] = this._deepCloneValue(value[key]);
    });
    
    return cloned;
  }
}

// Usage in high-performance scenarios
function performanceDemo() {
  const obj = new PerformanceOptimizedObject();
  
  // Bulk data insertion
  const bulkData = Object.create(null);
  for (let i = 0; i < 1000; i++) {
    bulkData[`key_${i}`] = {
      id: i,
      value: `value_${i}`,
      timestamp: Date.now(),
      data: Array.from({ length: 100 }, (_, j) => `item_${j}`)
    };
  }
  
  console.time('Bulk set');
  obj.setMultiple(bulkData);
  console.timeEnd('Bulk set');
  
  // Simulate access patterns
  console.time('Multiple accesses');
  for (let i = 0; i < 10000; i++) {
    const key = `key_${i % 1000}`;
    const value = obj[key];
  }
  console.timeEnd('Multiple accesses');
  
  // Filter operation
  console.time('Filter operation');
  const filtered = obj.filter((value, key) => value.id % 2 === 0);
  console.timeEnd('Filter operation');
  console.log('Filtered count:', Object.keys(filtered).length);
  
  // Map operation
  console.time('Map operation');
  const mapped = obj.map((value, key) => ({
    ...value,
    processed: true,
    processedAt: new Date()
  }));
  console.timeEnd('Map operation');
  
  // Reduce operation
  console.time('Reduce operation');
  const total = obj.reduce((sum, value) => sum + value.id, 0);
  console.timeEnd('Reduce operation');
  console.log('Total sum:', total);
  
  // Find operation
  console.time('Find operation');
  const found = obj.find((value, key) => value.id === 500);
  console.timeEnd('Find operation');
  console.log('Found item:', found);
  
  // Watch for changes
  const unwatch = obj.watch('key_1', (newValue, oldValue) => {
    console.log('Key_1 changed:', { from: oldValue, to: newValue });
  });
  
  obj.key_1 = { id: 1, value: 'updated' };
  
  // Get statistics
  console.log('Performance stats:', obj.getStats());
  
  // Optimize
  obj.optimize();
  console.log('Stats after optimization:', obj.getStats());
  
  // Cleanup
  unwatch();
}

performanceDemo();

// ## 5. Object Methods for Advanced Patterns and Utilities

// Comprehensive object utilities for production
class ObjectUtils {
  // Deep freeze object (immutable)
  static deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
      Object.freeze(obj);
      
      Object.getOwnPropertyNames(obj).forEach(prop => {
        const value = obj[prop];
        
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
          this.deepFreeze(value);
        }
      });
    }
    
    return obj;
  }
  
  // Deep seal object
  static deepSeal(obj) {
    if (obj && typeof obj === 'object' && !Object.isSealed(obj)) {
      Object.seal(obj);
      
      Object.getOwnPropertyNames(obj).forEach(prop => {
        const value = obj[prop];
        
        if (value && typeof value === 'object' && !Object.isSealed(value)) {
          this.deepSeal(value);
        }
      });
    }
    
    return obj;
  }
  
  // Create immutable proxy
  static createImmutable(obj) {
    const handler = {
      get(target, prop) {
        const value = target[prop];
        
        if (value && typeof value === 'object') {
          return this.createImmutable(value);
        }
        
        return value;
      },
      
      set() {
        throw new Error('Cannot modify immutable object');
      },
      
      deleteProperty() {
        throw new Error('Cannot delete from immutable object');
      },
      
      defineProperty() {
        throw new Error('Cannot define properties on immutable object');
      },
      
      setPrototypeOf() {
        throw new Error('Cannot change prototype of immutable object');
      }
    };
    
    return new Proxy(obj, handler);
  }
  
  // Object diff utility
  static diff(obj1, obj2) {
    const differences = Object.create(null);
    
    const allKeys = new Set([
      ...Object.keys(obj1),
      ...Object.keys(obj2)
    ]);
    
    allKeys.forEach(key => {
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      if (this.isEqual(val1, val2)) {
        return;
      }
      
      if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
        const nestedDiff = this.diff(val1, val2);
        if (Object.keys(nestedDiff).length > 0) {
          differences[key] = nestedDiff;
        }
      } else {
        differences[key] = {
          from: val1,
          to: val2
        };
      }
    });
    
    return differences;
  }
  
  // Object patch utility
  static patch(obj, diff) {
    const patched = this.deepClone(obj);
    
    Object.keys(diff).forEach(key => {
      const change = diff[key];
      
      if (change && typeof change === 'object' && 'from' in change && 'to' in change) {
        patched[key] = change.to;
      } else if (typeof change === 'object') {
        patched[key] = this.patch(patched[key] || {}, change);
      }
    });
    
    return patched;
  }
  
  // Object validation against schema
  static validateAgainstSchema(obj, schema) {
    const errors = [];
    
    const validate = (value, rules, path = '') => {
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${path} is required`);
        return;
      }
      
      if (value === undefined || value === null) {
        return;
      }
      
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${path} must be ${rules.type}`);
      }
      
      if (rules.min !== undefined) {
        if (typeof value === 'number' && value < rules.min) {
          errors.push(`${path} must be at least ${rules.min}`);
        } else if (typeof value === 'string' && value.length < rules.min) {
          errors.push(`${path} must be at least ${rules.min} characters`);
        }
      }
      
      if (rules.max !== undefined) {
        if (typeof value === 'number' && value > rules.max) {
          errors.push(`${path} must be at most ${rules.max}`);
        } else if (typeof value === 'string' && value.length > rules.max) {
          errors.push(`${path} must be at most ${rules.max} characters`);
        }
      }
      
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`${path} format is invalid`);
      }
      
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${path} must be one of: ${rules.enum.join(', ')}`);
      }
      
      if (rules.properties && typeof value === 'object') {
        Object.keys(rules.properties).forEach(prop => {
          validate(value[prop], rules.properties[prop], path ? `${path}.${prop}` : prop);
        });
      }
    };
    
    Object.keys(schema).forEach(key => {
      validate(obj[key], schema[key], key);
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Object transformation pipeline
  static createPipeline(...transformers) {
    return function(obj) {
      return transformers.reduce((current, transformer) => {
        return transformer(current);
      }, obj);
    };
  }
  
  // Memoization utility
  static memoize(fn, options = {}) {
    const cache = new Map();
    const {
      maxSize = 1000,
      ttl = 0,
      resolver = (...args) => JSON.stringify(args)
    } = options;
    
    return function(...args) {
      const key = resolver(...args);
      
      if (cache.has(key)) {
        const entry = cache.get(key);
        
        if (!ttl || Date.now() - entry.timestamp < ttl) {
          return entry.value;
        }
        
        cache.delete(key);
      }
      
      const value = fn(...args);
      
      cache.set(key, {
        value,
        timestamp: Date.now()
      });
      
      // Evict if cache is too large
      if (cache.size > maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return value;
    };
  }
  
  // Property observer
  static observe(obj, callback) {
    const handler = {
      get(target, prop) {
        const value = target[prop];
        
        if (value && typeof value === 'object') {
          return new Proxy(value, handler);
        }
        
        return value;
      },
      
      set(target, prop, value) {
        const oldValue = target[prop];
        target[prop] = value;
        
        callback('set', prop, value, oldValue);
        return true;
      },
      
      deleteProperty(target, prop) {
        const oldValue = target[prop];
        delete target[prop];
        
        callback('delete', prop, undefined, oldValue);
        return true;
      }
    };
    
    return new Proxy(obj, handler);
  }
  
  // Utility methods
  static isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
  
  static isEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return obj1 === obj2;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => {
      if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
      return this.isEqual(obj1[key], obj2[key]);
    });
  }
  
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const clone = Object.create(Object.getPrototypeOf(obj));
    
    Object.keys(obj).forEach(key => {
      clone[key] = this.deepClone(obj[key]);
    });
    
    return clone;
  }
  
  static pick(obj, keys) {
    const result = Object.create(null);
    
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    
    return result;
  }
  
  static omit(obj, keys) {
    const result = Object.create(null);
    
    Object.keys(obj).forEach(key => {
      if (!keys.includes(key)) {
        result[key] = obj[key];
      }
    });
    
    return result;
  }
}

// Usage examples
function utilitiesDemo() {
  // Deep freeze example
  const obj = {
    a: 1,
    b: { c: 2, d: [3, 4] }
  };
  
  const frozen = ObjectUtils.deepFreeze(obj);
  
  try {
    frozen.b.c = 5; // This will throw in strict mode
  } catch (error) {
    console.log('Expected error:', error.message);
  }
  
  // Object diff example
  const obj1 = { a: 1, b: { c: 2 }, d: [1, 2] };
  const obj2 = { a: 1, b: { c: 3 }, d: [1, 2, 3], e: 'new' };
  
  const differences = ObjectUtils.diff(obj1, obj2);
  console.log('Object differences:', differences);
  
  // Object patch example
  const patched = ObjectUtils.patch(obj1, differences);
  console.log('Patched object:', patched);
  
  // Schema validation
  const schema = {
    name: { type: 'string', required: true, min: 1 },
    email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    age: { type: 'number', min: 0, max: 150 },
    address: {
      properties: {
        street: { type: 'string', required: true },
        city: { type: 'string', required: true }
      }
    }
  };
  
  const testObj = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    address: {
      street: '123 Main St',
      city: 'New York'
    }
  };
  
  const validationResult = ObjectUtils.validateAgainstSchema(testObj, schema);
  console.log('Validation result:', validationResult);
  
  // Transformation pipeline
  const pipeline = ObjectUtils.createPipeline(
    (obj) => ObjectUtils.pick(obj, ['name', 'email']),
    (obj) => ObjectUtils.map(obj, (value) => value.toUpperCase()),
    (obj) => ({ ...obj, processed: true })
  );
  
  const transformed = pipeline(testObj);
  console.log('Transformed object:', transformed);
  
  // Memoization
  const expensiveOperation = ObjectUtils.memoize((a, b) => {
    console.log('Computing...');
    return a + b;
  }, { maxSize: 100, ttl: 5000 });
  
  console.log('First call:', expensiveOperation(1, 2));
  console.log('Second call (cached):', expensiveOperation(1, 2));
  
  // Property observation
  const observed = ObjectUtils.observe(testObj, (action, prop, newValue, oldValue) => {
    console.log(`Property ${prop} ${action}:`, { from: oldValue, to: newValue });
  });
  
  observed.name = 'Jane Doe';
  delete observed.age;
}

utilitiesDemo();

// These production-grade object method patterns provide:

// 1. **Configuration Management** - Robust configuration handling with validation
// 2. **Data Transformation** - Efficient serialization and normalization
// 3. **Validation & Sanitization** - Comprehensive input validation
// 4. **Performance Optimization** - High-performance object operations
// 5. **Advanced Utilities** - Immutable objects, diff/patch, memoization, and observation

// These techniques are essential for building scalable, maintainable, and performant Node.js backend systems.





























// Here are comprehensive code snippets for JavaScript factory functions in Node.js production-grade backend development:

// ## 1. Database Connection Factory with Connection Pooling

// Database connection factory with connection pooling
class DatabaseConnectionFactory {
  constructor() {
    this._pools = new Map();
    this._configs = new Map();
    this._metrics = {
      connectionsCreated: 0,
      connectionsReused: 0,
      errors: 0
    };
  }

  // Factory method for creating database connections
  createConnection(config) {
    const {
      type = 'postgresql',
      host,
      port,
      database,
      username,
      password,
      poolSize = 10,
      connectionTimeout = 30000,
      acquireTimeout = 60000,
      ...options
    } = config;

    const poolKey = this._generatePoolKey(config);

    // Return existing pool if available
    if (this._pools.has(poolKey)) {
      this._metrics.connectionsReused++;
      return this._pools.get(poolKey);
    }

    // Validate required configuration
    if (!host || !database || !username) {
      throw new Error('Missing required database configuration: host, database, username');
    }

    // Create new connection pool based on type
    const pool = this._createPoolByType(type, {
      host,
      port,
      database,
      username,
      password,
      poolSize,
      connectionTimeout,
      acquireTimeout,
      ...options
    });

    this._pools.set(poolKey, pool);
    this._configs.set(poolKey, config);
    this._metrics.connectionsCreated++;

    // Set up error handling and cleanup
    this._setupPoolEventHandlers(pool, poolKey);

    return pool;
  }

  // Private method to create pool by database type
  _createPoolByType(type, config) {
    switch (type.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return this._createPostgresPool(config);
      case 'mysql':
        return this._createMySQLPool(config);
      case 'mongodb':
        return this._createMongoDBPool(config);
      case 'redis':
        return this._createRedisPool(config);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  // PostgreSQL connection pool
  _createPostgresPool(config) {
    // Simulated PostgreSQL pool implementation
    const pool = {
      type: 'postgresql',
      config: { ...config, password: '***' }, // Hide password in logs
      connections: new Array(config.poolSize).fill(null).map((_, index) => ({
        id: `pg_conn_${Date.now()}_${index}`,
        connected: true,
        lastUsed: new Date()
      })),
      async query(sql, params = []) {
        const connection = this.connections.find(conn => conn.connected);
        if (!connection) {
          throw new Error('No available connections in pool');
        }
        
        connection.lastUsed = new Date();
        console.log(`[PostgreSQL] Executing: ${sql}`, params);
        
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return {
          rows: [{ id: 1, result: 'simulated' }],
          rowCount: 1,
          command: 'SELECT'
        };
      },
      async end() {
        this.connections.forEach(conn => conn.connected = false);
        console.log('PostgreSQL pool closed');
      }
    };

    return pool;
  }

  // MySQL connection pool
  _createMySQLPool(config) {
    // Simulated MySQL pool implementation
    const pool = {
      type: 'mysql',
      config: { ...config, password: '***' },
      connections: new Array(config.poolSize).fill(null).map((_, index) => ({
        id: `mysql_conn_${Date.now()}_${index}`,
        connected: true,
        lastUsed: new Date()
      })),
      async query(sql, params = []) {
        const connection = this.connections.find(conn => conn.connected);
        if (!connection) {
          throw new Error('No available connections in pool');
        }
        
        connection.lastUsed = new Date();
        console.log(`[MySQL] Executing: ${sql}`, params);
        
        await new Promise(resolve => setTimeout(resolve, 30));
        
        return {
          results: [{ id: 1, data: 'mysql_result' }],
          fields: []
        };
      },
      async end() {
        this.connections.forEach(conn => conn.connected = false);
        console.log('MySQL pool closed');
      }
    };

    return pool;
  }

  // MongoDB connection pool
  _createMongoDBPool(config) {
    const pool = {
      type: 'mongodb',
      config: { ...config, password: '***' },
      connected: true,
      collections: new Map(),
      async getCollection(name) {
        if (!this.collections.has(name)) {
          this.collections.set(name, {
            name,
            documents: new Map()
          });
        }
        return this.collections.get(name);
      },
      async find(collectionName, query = {}) {
        const collection = await this.getCollection(collectionName);
        console.log(`[MongoDB] Finding in ${collectionName}:`, query);
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        return Array.from(collection.documents.values()).filter(doc => {
          return Object.keys(query).every(key => doc[key] === query[key]);
        });
      },
      async insert(collectionName, document) {
        const collection = await this.getCollection(collectionName);
        const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docWithId = { _id: id, ...document, createdAt: new Date() };
        
        collection.documents.set(id, docWithId);
        console.log(`[MongoDB] Inserted into ${collectionName}:`, docWithId);
        
        return docWithId;
      },
      async close() {
        this.connected = false;
        this.collections.clear();
        console.log('MongoDB connection closed');
      }
    };

    return pool;
  }

  // Redis connection pool
  _createRedisPool(config) {
    const pool = {
      type: 'redis',
      config: { ...config, password: '***' },
      connected: true,
      data: new Map(),
      async get(key) {
        console.log(`[Redis] GET ${key}`);
        await new Promise(resolve => setTimeout(resolve, 5));
        return this.data.get(key);
      },
      async set(key, value, ttl = null) {
        console.log(`[Redis] SET ${key}`, value);
        this.data.set(key, value);
        
        if (ttl) {
          setTimeout(() => {
            this.data.delete(key);
          }, ttl * 1000);
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
        return 'OK';
      },
      async del(key) {
        console.log(`[Redis] DEL ${key}`);
        const deleted = this.data.delete(key);
        await new Promise(resolve => setTimeout(resolve, 5));
        return deleted ? 1 : 0;
      },
      async quit() {
        this.connected = false;
        this.data.clear();
        console.log('Redis connection closed');
      }
    };

    return pool;
  }

  // Pool event handlers
  _setupPoolEventHandlers(pool, poolKey) {
    // Simulate event handlers for connection management
    pool.on('error', (error) => {
      console.error(`Database pool error (${pool.type}):`, error.message);
      this._metrics.errors++;
    });

    pool.on('acquire', (connection) => {
      console.log(`Connection acquired from ${pool.type} pool`);
    });

    pool.on('release', (connection) => {
      console.log(`Connection released to ${pool.type} pool`);
    });
  }

  // Generate unique pool key
  _generatePoolKey(config) {
    return `${config.type}:${config.host}:${config.port}:${config.database}`;
  }

  // Get factory metrics
  getMetrics() {
    return {
      ...this._metrics,
      activePools: this._pools.size,
      poolTypes: Array.from(this._pools.values()).map(pool => pool.type)
    };
  }

  // Close all connection pools
  async closeAll() {
    const closePromises = Array.from(this._pools.values()).map(async (pool) => {
      try {
        if (pool.end) await pool.end();
        if (pool.close) await pool.close();
        if (pool.quit) await pool.quit();
      } catch (error) {
        console.error('Error closing pool:', error.message);
      }
    });

    await Promise.allSettled(closePromises);
    
    this._pools.clear();
    this._configs.clear();
    
    console.log('All database connection pools closed');
  }

  // Static factory method for singleton instance
  static getInstance() {
    if (!DatabaseConnectionFactory._instance) {
      DatabaseConnectionFactory._instance = new DatabaseConnectionFactory();
    }
    return DatabaseConnectionFactory._instance;
  }
}

// Usage in production
async function databaseFactoryDemo() {
  const dbFactory = DatabaseConnectionFactory.getInstance();

  try {
    // Create different database connections
    const postgresPool = dbFactory.createConnection({
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'myapp',
      username: 'admin',
      password: 'secret',
      poolSize: 5
    });

    const mysqlPool = dbFactory.createConnection({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'myapp',
      username: 'admin',
      password: 'secret',
      poolSize: 3
    });

    const mongoPool = dbFactory.createConnection({
      type: 'mongodb',
      host: 'localhost',
      port: 27017,
      database: 'myapp',
      username: 'admin',
      password: 'secret'
    });

    const redisPool = dbFactory.createConnection({
      type: 'redis',
      host: 'localhost',
      port: 6379,
      password: 'secret'
    });

    // Use the connections
    console.log('=== Testing Database Connections ===');
    
    // PostgreSQL
    const pgResult = await postgresPool.query('SELECT * FROM users WHERE id = $1', [1]);
    console.log('PostgreSQL result:', pgResult.rows);

    // MySQL
    const mysqlResult = await mysqlPool.query('SELECT * FROM users WHERE id = ?', [1]);
    console.log('MySQL result:', mysqlResult.results);

    // MongoDB
    await mongoPool.insert('users', { name: 'John Doe', email: 'john@example.com' });
    const mongoResults = await mongoPool.find('users', { name: 'John Doe' });
    console.log('MongoDB results:', mongoResults);

    // Redis
    await redisPool.set('user:1', JSON.stringify({ name: 'John Doe' }), 3600);
    const redisResult = await redisPool.get('user:1');
    console.log('Redis result:', redisResult);

    // Show metrics
    console.log('\n=== Factory Metrics ===');
    console.log(dbFactory.getMetrics());

    // Cleanup
    await dbFactory.closeAll();

  } catch (error) {
    console.error('Database factory error:', error.message);
  }
}

databaseFactoryDemo();

// ## 2. Service Factory with Dependency Injection

// Advanced service factory with dependency injection and lifecycle management
class ServiceFactory {
  constructor() {
    this._services = new Map();
    this._dependencies = new Map();
    this._lifecycleHooks = new Map();
    this._serviceInstances = new Map();
    this._configurations = new Map();
    this._middleware = [];
  }

  // Register a service with its dependencies and configuration
  register(name, ServiceClass, options = {}) {
    const {
      dependencies = [],
      configuration = {},
      singleton = true,
      lazy = true,
      lifecycle = {}
    } = options;

    if (this._services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }

    this._services.set(name, {
      class: ServiceClass,
      singleton,
      lazy,
      instance: null,
      initialized: false
    });

    this._dependencies.set(name, dependencies);
    this._configurations.set(name, configuration);
    this._lifecycleHooks.set(name, lifecycle);

    console.log(`Service registered: ${name} (${ServiceClass.name})`);
    
    // Initialize immediately if not lazy
    if (!lazy) {
      this._initializeService(name);
    }

    return this; // Enable method chaining
  }

  // Configure a service
  configure(name, configuration) {
    if (!this._services.has(name)) {
      throw new Error(`Service '${name}' is not registered`);
    }

    const currentConfig = this._configurations.get(name) || {};
    this._configurations.set(name, { ...currentConfig, ...configuration });

    // Re-initialize if service is already initialized
    if (this._serviceInstances.has(name)) {
      console.log(`Reconfiguring service: ${name}`);
      this._serviceInstances.delete(name);
      this._initializeService(name);
    }

    return this;
  }

  // Get a service instance
  get(name) {
    if (!this._services.has(name)) {
      throw new Error(`Service '${name}' is not registered`);
    }

    const serviceInfo = this._services.get(name);

    // Initialize if lazy and not initialized
    if (serviceInfo.lazy && !serviceInfo.initialized) {
      this._initializeService(name);
    }

    if (serviceInfo.singleton) {
      return serviceInfo.instance;
    }

    // Create new instance for non-singleton services
    return this._createServiceInstance(name);
  }

  // Add middleware for service creation
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this._middleware.push(middleware);
    return this;
  }

  // Initialize all services
  async initialize() {
    console.log('Initializing all services...');
    
    const initializationPromises = Array.from(this._services.keys()).map(async (name) => {
      if (!this._services.get(name).initialized) {
        await this._initializeService(name);
      }
    });

    await Promise.all(initializationPromises);
    console.log('All services initialized successfully');
  }

  // Shutdown all services
  async shutdown() {
    console.log('Shutting down all services...');
    
    const shutdownPromises = Array.from(this._services.values()).map(async (serviceInfo) => {
      if (serviceInfo.instance && serviceInfo.instance.shutdown) {
        try {
          await serviceInfo.instance.shutdown();
          console.log(`Service ${serviceInfo.class.name} shut down successfully`);
        } catch (error) {
          console.error(`Error shutting down service ${serviceInfo.class.name}:`, error.message);
        }
      }
    });

    await Promise.allSettled(shutdownPromises);
    
    this._serviceInstances.clear();
    Array.from(this._services.keys()).forEach(name => {
      this._services.get(name).initialized = false;
      this._services.get(name).instance = null;
    });

    console.log('All services shut down');
  }

  // Get service statistics
  getStats() {
    const stats = {
      totalServices: this._services.size,
      initializedServices: 0,
      singletonServices: 0,
      lazyServices: 0
    };

    this._services.forEach(serviceInfo => {
      if (serviceInfo.initialized) stats.initializedServices++;
      if (serviceInfo.singleton) stats.singletonServices++;
      if (serviceInfo.lazy) stats.lazyServices++;
    });

    return stats;
  }

  // Private methods
  async _initializeService(name) {
    const serviceInfo = this._services.get(name);
    
    if (serviceInfo.initialized && serviceInfo.singleton) {
      return serviceInfo.instance;
    }

    console.log(`Initializing service: ${name}`);

    // Resolve dependencies
    const dependencies = await this._resolveDependencies(name);
    
    // Get configuration
    const configuration = this._configurations.get(name) || {};
    
    // Apply middleware
    let serviceInstance = this._createServiceInstance(name, dependencies, configuration);
    
    for (const middleware of this._middleware) {
      serviceInstance = await middleware(serviceInstance, name, dependencies, configuration);
    }

    // Run lifecycle hooks
    await this._runLifecycleHooks(name, 'beforeInitialize', serviceInstance);
    
    if (serviceInstance.initialize && typeof serviceInstance.initialize === 'function') {
      await serviceInstance.initialize();
    }
    
    await this._runLifecycleHooks(name, 'afterInitialize', serviceInstance);

    // Store instance for singleton services
    if (serviceInfo.singleton) {
      serviceInfo.instance = serviceInstance;
    }

    serviceInfo.initialized = true;
    this._serviceInstances.set(name, serviceInstance);

    console.log(`Service initialized: ${name}`);
    
    return serviceInstance;
  }

  _createServiceInstance(name, dependencies = [], configuration = {}) {
    const serviceInfo = this._services.get(name);
    
    if (!dependencies.length) {
      dependencies = this._resolveDependenciesSync(name);
    }
    
    if (!Object.keys(configuration).length) {
      configuration = this._configurations.get(name) || {};
    }

    try {
      return new serviceInfo.class(...dependencies, configuration);
    } catch (error) {
      throw new Error(`Failed to create service instance for ${name}: ${error.message}`);
    }
  }

  async _resolveDependencies(name) {
    const dependencyNames = this._dependencies.get(name) || [];
    const dependencies = [];

    for (const depName of dependencyNames) {
      if (!this._services.has(depName)) {
        throw new Error(`Dependency '${depName}' not found for service '${name}'`);
      }
      dependencies.push(await this.get(depName));
    }

    return dependencies;
  }

  _resolveDependenciesSync(name) {
    const dependencyNames = this._dependencies.get(name) || [];
    return dependencyNames.map(depName => {
      if (!this._services.has(depName)) {
        throw new Error(`Dependency '${depName}' not found for service '${name}'`);
      }
      return this.get(depName);
    });
  }

  async _runLifecycleHooks(name, hookName, serviceInstance) {
    const lifecycle = this._lifecycleHooks.get(name) || {};
    const hook = lifecycle[hookName];
    
    if (hook && typeof hook === 'function') {
      await hook(serviceInstance);
    }
  }

  // Static factory creator
  static create() {
    return new ServiceFactory();
  }
}

// Example services for demonstration
class DatabaseService {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
    this.connectionPool = [];
  }

  async initialize() {
    console.log('Initializing DatabaseService...');
    // Simulate database connection
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    this.connectionPool = Array.from({ length: this.config.poolSize || 5 }, (_, i) => ({
      id: i,
      connected: true
    }));
    console.log('DatabaseService initialized');
  }

  async query(sql, params = []) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    console.log(`Executing query: ${sql}`, params);
    await new Promise(resolve => setTimeout(resolve, 50));
    return { rows: [{ id: 1, data: 'result' }] };
  }

  async shutdown() {
    console.log('Shutting down DatabaseService...');
    this.connected = false;
    this.connectionPool = [];
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('DatabaseService shut down');
  }
}

class CacheService {
  constructor(databaseService, config = {}) {
    this.databaseService = databaseService;
    this.config = config;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  async initialize() {
    console.log('Initializing CacheService...');
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('CacheService initialized');
  }

  async get(key) {
    if (this.cache.has(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }
    
    this.stats.misses++;
    
    // Try to get from database
    const result = await this.databaseService.query('SELECT * FROM cache WHERE key = ?', [key]);
    if (result.rows.length > 0) {
      const value = result.rows[0].value;
      this.cache.set(key, value);
      return value;
    }
    
    return null;
  }

  async set(key, value, ttl = 3600) {
    this.cache.set(key, value);
    // Also persist to database
    await this.databaseService.query(
      'INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
      [key, value, new Date(Date.now() + ttl * 1000)]
    );
  }

  async shutdown() {
    console.log('Shutting down CacheService...');
    this.cache.clear();
    await new Promise(resolve => setTimeout(resolve, 30));
    console.log('CacheService shut down');
  }
}

class UserService {
  constructor(databaseService, cacheService, config = {}) {
    this.databaseService = databaseService;
    this.cacheService = cacheService;
    this.config = config;
  }

  async initialize() {
    console.log('Initializing UserService...');
    await new Promise(resolve => setTimeout(resolve, 30));
    console.log('UserService initialized');
  }

  async getUser(userId) {
    // Try cache first
    const cacheKey = `user:${userId}`;
    let user = await this.cacheService.get(cacheKey);
    
    if (!user) {
      // Get from database
      const result = await this.databaseService.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      
      if (result.rows.length > 0) {
        user = result.rows[0];
        await this.cacheService.set(cacheKey, user, 300); // Cache for 5 minutes
      }
    }
    
    return user;
  }

  async createUser(userData) {
    const result = await this.databaseService.query(
      'INSERT INTO users (name, email) VALUES (?, ?) RETURNING *',
      [userData.name, userData.email]
    );
    
    return result.rows[0];
  }
}

// Usage in production
async function serviceFactoryDemo() {
  const serviceFactory = ServiceFactory.create();

  // Add middleware for logging
  serviceFactory.use(async (serviceInstance, name, dependencies, config) => {
    console.log(`Middleware: Creating service ${name}`);
    serviceInstance._serviceName = name;
    serviceInstance._createdAt = new Date();
    return serviceInstance;
  });

  // Register services with dependencies
  serviceFactory
    .register('database', DatabaseService, {
      configuration: { poolSize: 10, host: 'localhost' },
      singleton: true,
      lazy: false
    })
    .register('cache', CacheService, {
      dependencies: ['database'],
      configuration: { maxSize: 1000 },
      singleton: true
    })
    .register('userService', UserService, {
      dependencies: ['database', 'cache'],
      configuration: { features: ['auth', 'profile'] },
      singleton: true,
      lifecycle: {
        afterInitialize: async (service) => {
          console.log(`Lifecycle hook: UserService initialized at ${new Date()}`);
        }
      }
    });

  // Initialize all services
  await serviceFactory.initialize();

  // Use services
  const userService = serviceFactory.get('userService');
  const user = await userService.getUser(1);
  console.log('User:', user);

  // Show statistics
  console.log('\n=== Service Factory Statistics ===');
  console.log(serviceFactory.getStats());

  // Reconfigure a service
  serviceFactory.configure('database', { poolSize: 15 });
  
  // Get the reconfigured service
  const dbService = serviceFactory.get('database');
  console.log('Database pool size:', dbService.connectionPool.length);

  // Shutdown all services
  await serviceFactory.shutdown();
}

serviceFactoryDemo();

// ## 3. Middleware Factory for Express.js Applications

// Advanced middleware factory for Express.js applications
class MiddlewareFactory {
  constructor() {
    this._middlewareRegistry = new Map();
    this._middlewareChains = new Map();
    this._configurations = new Map();
    this._hooks = {
      before: new Map(),
      after: new Map(),
      error: new Map()
    };
  }

  // Register middleware with factory
  register(name, middlewareCreator, options = {}) {
    if (this._middlewareRegistry.has(name)) {
      throw new Error(`Middleware '${name}' is already registered`);
    }

    const {
      dependencies = [],
      configSchema = null,
      defaultConfig = {},
      category = 'general'
    } = options;

    this._middlewareRegistry.set(name, {
      creator: middlewareCreator,
      dependencies,
      configSchema,
      defaultConfig,
      category,
      instances: new Map()
    });

    console.log(`Middleware registered: ${name} (${category})`);
    return this;
  }

  // Create middleware instance with configuration
  create(name, config = {}, context = {}) {
    if (!this._middlewareRegistry.has(name)) {
      throw new Error(`Middleware '${name}' is not registered`);
    }

    const middlewareInfo = this._middlewareRegistry.get(name);
    const finalConfig = { ...middlewareInfo.defaultConfig, ...config };

    // Validate configuration against schema if provided
    if (middlewareInfo.configSchema) {
      this._validateConfig(finalConfig, middlewareInfo.configSchema, name);
    }

    // Create instance key for caching
    const instanceKey = this._generateInstanceKey(name, finalConfig);
    
    // Return cached instance if available
    if (middlewareInfo.instances.has(instanceKey)) {
      return middlewareInfo.instances.get(instanceKey);
    }

    // Resolve dependencies
    const dependencies = this._resolveDependencies(middlewareInfo.dependencies, context);

    // Create middleware instance
    const middlewareInstance = middlewareInfo.creator(finalConfig, dependencies, context);

    if (typeof middlewareInstance !== 'function') {
      throw new Error(`Middleware '${name}' must return a function`);
    }

    // Enhance middleware with hooks and metadata
    const enhancedMiddleware = this._enhanceMiddleware(middlewareInstance, name, finalConfig);

    // Cache the instance
    middlewareInfo.instances.set(instanceKey, enhancedMiddleware);

    console.log(`Middleware created: ${name}`);
    return enhancedMiddleware;
  }

  // Create middleware chain
  createChain(chainName, middlewareDefinitions) {
    if (this._middlewareChains.has(chainName)) {
      throw new Error(`Middleware chain '${chainName}' already exists`);
    }

    const middlewares = middlewareDefinitions.map(def => {
      if (typeof def === 'string') {
        return this.create(def);
      }
      
      if (typeof def === 'object' && def.name) {
        return this.create(def.name, def.config, def.context);
      }
      
      throw new Error('Invalid middleware definition');
    });

    // Create chain function
    const chain = (req, res, next) => {
      this._executeMiddlewareChain(middlewares, req, res, next);
    };

    this._middlewareChains.set(chainName, {
      middlewares,
      definitions: middlewareDefinitions
    });

    console.log(`Middleware chain created: ${chainName} with ${middlewares.length} middlewares`);
    return chain;
  }

  // Add hook for middleware execution
  addHook(type, name, hookFunction) {
    if (!['before', 'after', 'error'].includes(type)) {
      throw new Error('Hook type must be: before, after, or error');
    }

    if (!this._hooks[type].has(name)) {
      this._hooks[type].set(name, []);
    }

    this._hooks[type].get(name).push(hookFunction);
    return this;
  }

  // Get middleware statistics
  getStats() {
    const stats = {
      totalRegistered: this._middlewareRegistry.size,
      totalChains: this._middlewareChains.size,
      categories: new Set(),
      instances: 0
    };

    this._middlewareRegistry.forEach(info => {
      stats.categories.add(info.category);
      stats.instances += info.instances.size;
    });

    stats.categories = Array.from(stats.categories);

    return stats;
  }

  // Clear cached instances
  clearCache(name = null) {
    if (name) {
      const middlewareInfo = this._middlewareRegistry.get(name);
      if (middlewareInfo) {
        middlewareInfo.instances.clear();
        console.log(`Cache cleared for middleware: ${name}`);
      }
    } else {
      this._middlewareRegistry.forEach(info => info.instances.clear());
      console.log('All middleware cache cleared');
    }
    return this;
  }

  // Private methods
  _validateConfig(config, schema, middlewareName) {
    const errors = [];

    Object.keys(schema).forEach(key => {
      const rule = schema[key];
      const value = config[key];

      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        return;
      }

      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${key} must be ${rule.type}`);
        }

        if (rule.min && value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
        }

        if (rule.max && value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${key} format is invalid`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
        }
      }
    });

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed for ${middlewareName}: ${errors.join(', ')}`);
    }
  }

  _resolveDependencies(dependencies, context) {
    return dependencies.reduce((acc, dep) => {
      if (context[dep]) {
        acc[dep] = context[dep];
      } else {
        throw new Error(`Dependency '${dep}' not found in context`);
      }
      return acc;
    }, {});
  }

  _generateInstanceKey(name, config) {
    const configString = JSON.stringify(config);
    return `${name}_${Buffer.from(configString).toString('base64')}`;
  }

  _enhanceMiddleware(middleware, name, config) {
    const enhanced = async (req, res, next) => {
      const startTime = Date.now();
      
      try {
        // Execute before hooks
        await this._executeHooks('before', name, req, res);

        // Execute middleware
        await new Promise((resolve, reject) => {
          middleware(req, res, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        // Execute after hooks
        await this._executeHooks('after', name, req, res);

        // Log performance
        const duration = Date.now() - startTime;
        console.log(`Middleware ${name} executed in ${duration}ms`);

        next();
      } catch (error) {
        // Execute error hooks
        await this._executeHooks('error', name, req, res, error);
        
        const duration = Date.now() - startTime;
        console.error(`Middleware ${name} failed after ${duration}ms:`, error.message);
        
        next(error);
      }
    };

    // Add metadata
    enhanced._middlewareName = name;
    enhanced._config = config;
    enhanced._createdAt = new Date();

    return enhanced;
  }

  async _executeMiddlewareChain(middlewares, req, res, next) {
    let index = 0;

    const executeNext = async (error) => {
      if (error) {
        return next(error);
      }

      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      
      try {
        await middleware(req, res, executeNext);
      } catch (err) {
        executeNext(err);
      }
    };

    await executeNext();
  }

  async _executeHooks(type, middlewareName, req, res, error = null) {
    const hooks = this._hooks[type].get(middlewareName) || [];
    
    for (const hook of hooks) {
      try {
        await hook(req, res, error);
      } catch (hookError) {
        console.error(`Hook error in ${type} for ${middlewareName}:`, hookError.message);
      }
    }
  }

  // Static factory method
  static create() {
    return new MiddlewareFactory();
  }
}

// Example middleware creators
const loggingMiddleware = (config, dependencies) => {
  const { format = 'combined', level = 'info' } = config;
  
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
      
      if (level === 'debug') {
        console.debug(`[DEBUG] ${message}`);
      } else {
        console.log(message);
      }
    });
    
    next();
  };
};

const authMiddleware = (config, dependencies) => {
  const { secret, required = true } = config;
  
  if (!secret) {
    throw new Error('Auth middleware requires a secret');
  }
  
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      if (required) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return next();
    }
    
    try {
      // Simulate token verification
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (token === 'valid-token') {
        req.user = { id: 1, username: 'john_doe', role: 'user' };
        next();
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      res.status(401).json({ error: 'Token verification failed' });
    }
  };
};

const validationMiddleware = (config, dependencies) => {
  const { schema, source = 'body' } = config;
  
  return (req, res, next) => {
    const data = req[source];
    const errors = [];
    
    Object.keys(schema).forEach(field => {
      const rules = schema[field];
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        return;
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be ${rules.type}`);
        }
        
        if (rules.min && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        
        if (rules.max && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    
    next();
  };
};

const rateLimitMiddleware = (config, dependencies) => {
  const { windowMs = 900000, max = 100 } = config;
  const requests = new Map();
  
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(time => now - time < windowMs);
      if (validTimestamps.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, validTimestamps);
      }
    }
  }, 60000);
  
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const timestamps = requests.get(key);
    const recentRequests = timestamps.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= max) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil(windowMs / 1000) 
      });
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - recentRequests.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
};

// Usage in Express.js application
async function middlewareFactoryDemo() {
  const middlewareFactory = MiddlewareFactory.create();

  // Register middlewares with schemas
  middlewareFactory
    .register('logging', loggingMiddleware, {
      category: 'utility',
      defaultConfig: { format: 'combined', level: 'info' },
      configSchema: {
        format: { type: 'string', enum: ['combined', 'common', 'dev'] },
        level: { type: 'string', enum: ['info', 'debug'] }
      }
    })
    .register('auth', authMiddleware, {
      category: 'security',
      dependencies: ['logger'],
      configSchema: {
        secret: { type: 'string', required: true },
        required: { type: 'boolean' }
      }
    })
    .register('validation', validationMiddleware, {
      category: 'validation',
      configSchema: {
        schema: { type: 'object', required: true },
        source: { type: 'string', enum: ['body', 'query', 'params'] }
      }
    })
    .register('rateLimit', rateLimitMiddleware, {
      category: 'security',
      defaultConfig: { windowMs: 900000, max: 100 },
      configSchema: {
        windowMs: { type: 'number', min: 1000 },
        max: { type: 'number', min: 1 }
      }
    });

  // Add hooks
  middlewareFactory
    .addHook('before', 'auth', (req, res) => {
      console.log('Before auth middleware:', req.method, req.url);
    })
    .addHook('after', 'auth', (req, res) => {
      console.log('After auth middleware:', req.user?.username);
    })
    .addHook('error', 'auth', (req, res, error) => {
      console.error('Auth middleware error:', error.message);
    });

  // Create middleware instances
  const logging = middlewareFactory.create('logging', { level: 'debug' });
  const auth = middlewareFactory.create('auth', { 
    secret: 'my-secret-key', 
    required: true 
  }, { logger: console });
  
  const userValidation = middlewareFactory.create('validation', {
    schema: {
      name: { required: true, type: 'string', min: 1 },
      email: { required: true, type: 'string' },
      age: { type: 'number', min: 0, max: 150 }
    },
    source: 'body'
  });

  const rateLimit = middlewareFactory.create('rateLimit', { 
    windowMs: 60000, 
    max: 10 
  });

  // Create middleware chains
  const apiChain = middlewareFactory.createChain('api', [
    'logging',
    'rateLimit',
    { name: 'auth', config: { secret: 'api-secret', required: true } }
  ]);

  const userRegistrationChain = middlewareFactory.createChain('userRegistration', [
    'logging',
    { name: 'validation', config: {
      schema: {
        username: { required: true, type: 'string', min: 3 },
        email: { required: true, type: 'string' },
        password: { required: true, type: 'string', min: 8 }
      }
    }}
  ]);

  console.log('=== Middleware Factory Demo ===');
  console.log('Middleware stats:', middlewareFactory.getStats());

  // Simulate Express.js usage
  console.log('\n=== Simulating Express.js Middleware Execution ===');
  
  const mockReq = {
    method: 'POST',
    url: '/api/users',
    headers: {
      authorization: 'Bearer valid-token'
    },
    body: {
      username: 'john_doe',
      email: 'john@example.com',
      password: 'securepassword123'
    },
    ip: '192.168.1.100'
  };

  const mockRes = {
    statusCode: 200,
    setHeader: (key, value) => console.log(`Set header: ${key} = ${value}`),
    on: (event, handler) => {
      if (event === 'finish') {
        setTimeout(handler, 10);
      }
    }
  };

  const mockNext = (error) => {
    if (error) {
      console.error('Next called with error:', error.message);
    } else {
      console.log('Next called successfully');
    }
  };

  // Test individual middleware
  await logging(mockReq, mockRes, mockNext);
  await auth(mockReq, mockRes, mockNext);
  await userValidation(mockReq, mockRes, mockNext);

  // Test chain
  console.log('\n=== Testing API Chain ===');
  await apiChain(mockReq, mockRes, mockNext);
}

middlewareFactoryDemo();

// ## 4. Repository Factory for Data Access Layer

// Repository factory for data access layer with multiple data sources
class RepositoryFactory {
  constructor() {
    this._repositories = new Map();
    this._dataSources = new Map();
    this._mappers = new Map();
    this._cache = new Map();
    this._config = {
      defaultCacheTTL: 300000, // 5 minutes
      maxCacheSize: 10000
    };
  }

  // Register data source
  registerDataSource(name, dataSource, options = {}) {
    if (this._dataSources.has(name)) {
      throw new Error(`Data source '${name}' is already registered`);
    }

    const {
      type = 'database',
      default: isDefault = false,
      healthCheck = null,
      ...config
    } = options;

    this._dataSources.set(name, {
      instance: dataSource,
      type,
      config,
      isDefault,
      healthCheck,
      connected: false
    });

    console.log(`Data source registered: ${name} (${type})`);
    
    // Set as default if specified
    if (isDefault) {
      this._config.defaultDataSource = name;
    }

    return this;
  }

  // Register repository
  registerRepository(name, RepositoryClass, options = {}) {
    if (this._repositories.has(name)) {
      throw new Error(`Repository '${name}' is already registered`);
    }

    const {
      dataSource = this._config.defaultDataSource,
      cacheEnabled = true,
      cacheTTL = this._config.defaultCacheTTL,
      dependencies = [],
      ...config
    } = options;

    if (!this._dataSources.has(dataSource)) {
      throw new Error(`Data source '${dataSource}' not found`);
    }

    this._repositories.set(name, {
      class: RepositoryClass,
      dataSource,
      cacheEnabled,
      cacheTTL,
      dependencies,
      config,
      instances: new Map()
    });

    console.log(`Repository registered: ${name}`);
    return this;
  }

  // Register entity mapper
  registerMapper(entityName, mapper) {
    this._mappers.set(entityName, mapper);
    console.log(`Mapper registered for: ${entityName}`);
    return this;
  }

  // Get repository instance
  get(repositoryName, context = {}) {
    if (!this._repositories.has(repositoryName)) {
      throw new Error(`Repository '${repositoryName}' not found`);
    }

    const repoInfo = this._repositories.get(repositoryName);
    const instanceKey = this._generateInstanceKey(context);

    // Return cached instance if available
    if (repoInfo.instances.has(instanceKey)) {
      return repoInfo.instances.get(instanceKey);
    }

    // Get data source
    const dataSource = this._getDataSource(repoInfo.dataSource);
    
    // Resolve dependencies
    const dependencies = this._resolveDependencies(repoInfo.dependencies, context);
    
    // Create repository instance
    const repository = new repoInfo.class(
      dataSource,
      this._mappers,
      { ...repoInfo.config, cacheTTL: repoInfo.cacheTTL },
      dependencies
    );

    // Enable caching if configured
    if (repoInfo.cacheEnabled) {
      this._enableCaching(repository, repositoryName);
    }

    // Cache the instance
    repoInfo.instances.set(instanceKey, repository);

    console.log(`Repository instance created: ${repositoryName}`);
    return repository;
  }

  // Initialize all data sources
  async initialize() {
    console.log('Initializing data sources...');
    
    const initPromises = Array.from(this._dataSources.values()).map(async (dsInfo) => {
      try {
        if (dsInfo.instance.connect && typeof dsInfo.instance.connect === 'function') {
          await dsInfo.instance.connect();
          dsInfo.connected = true;
          console.log(`Data source connected: ${this._getDataSourceName(dsInfo.instance)}`);
        }
        
        // Run health check if provided
        if (dsInfo.healthCheck) {
          const healthy = await dsInfo.healthCheck(dsInfo.instance);
          if (!healthy) {
            throw new Error('Health check failed');
          }
        }
      } catch (error) {
        console.error(`Failed to initialize data source:`, error.message);
        dsInfo.connected = false;
        throw error;
      }
    });

    await Promise.allSettled(initPromises);
    console.log('Data sources initialized');
  }

  // Close all data sources
  async close() {
    console.log('Closing data sources...');
    
    const closePromises = Array.from(this._dataSources.values()).map(async (dsInfo) => {
      try {
        if (dsInfo.instance.close && typeof dsInfo.instance.close === 'function') {
          await dsInfo.instance.close();
          dsInfo.connected = false;
          console.log(`Data source closed: ${this._getDataSourceName(dsInfo.instance)}`);
        }
      } catch (error) {
        console.error(`Error closing data source:`, error.message);
      }
    });

    await Promise.allSettled(closePromises);
    console.log('All data sources closed');
  }

  // Get factory status
  getStatus() {
    const status = {
      dataSources: {},
      repositories: {},
      cache: {
        size: this._cache.size,
        hitRate: this._calculateCacheHitRate()
      }
    };

    this._dataSources.forEach((dsInfo, name) => {
      status.dataSources[name] = {
        type: dsInfo.type,
        connected: dsInfo.connected,
        isDefault: dsInfo.isDefault
      };
    });

    this._repositories.forEach((repoInfo, name) => {
      status.repositories[name] = {
        dataSource: repoInfo.dataSource,
        cacheEnabled: repoInfo.cacheEnabled,
        instances: repoInfo.instances.size
      };
    });

    return status;
  }

  // Clear cache
  clearCache(repositoryName = null) {
    if (repositoryName) {
      this._cache.forEach((value, key) => {
        if (key.startsWith(`${repositoryName}:`)) {
          this._cache.delete(key);
        }
      });
      console.log(`Cache cleared for repository: ${repositoryName}`);
    } else {
      this._cache.clear();
      console.log('All cache cleared');
    }
    return this;
  }

  // Private methods
  _getDataSource(name) {
    const dsInfo = this._dataSources.get(name);
    if (!dsInfo) {
      throw new Error(`Data source '${name}' not found`);
    }
    
    if (!dsInfo.connected) {
      throw new Error(`Data source '${name}' is not connected`);
    }
    
    return dsInfo.instance;
  }

  _getDataSourceName(instance) {
    for (const [name, dsInfo] of this._dataSources.entries()) {
      if (dsInfo.instance === instance) {
        return name;
      }
    }
    return 'unknown';
  }

  _resolveDependencies(dependencies, context) {
    return dependencies.reduce((acc, dep) => {
      if (context[dep]) {
        acc[dep] = context[dep];
      } else {
        throw new Error(`Dependency '${dep}' not found in context`);
      }
      return acc;
    }, {});
  }

  _generateInstanceKey(context) {
    return Buffer.from(JSON.stringify(context)).toString('base64');
  }

  _enableCaching(repository, repositoryName) {
    const originalFindById = repository.findById;
    const originalFind = repository.find;
    
    repository.findById = async (id) => {
      const cacheKey = `${repositoryName}:findById:${id}`;
      
      // Check cache
      const cached = this._cache.get(cacheKey);
      if (cached) {
        repository._cacheHits = (repository._cacheHits || 0) + 1;
        return cached;
      }
      
      repository._cacheMisses = (repository._cacheMisses || 0) + 1;
      
      // Fetch from data source
      const result = await originalFindById.call(repository, id);
      
      // Cache the result
      if (result) {
        this._cache.set(cacheKey, result);
        
        // Evict if cache is too large
        if (this._cache.size > this._config.maxCacheSize) {
          const firstKey = this._cache.keys().next().value;
          this._cache.delete(firstKey);
        }
      }
      
      return result;
    };
    
    repository.find = async (criteria) => {
      const cacheKey = `${repositoryName}:find:${JSON.stringify(criteria)}`;
      
      const cached = this._cache.get(cacheKey);
      if (cached) {
        repository._cacheHits = (repository._cacheHits || 0) + 1;
        return cached;
      }
      
      repository._cacheMisses = (repository._cacheMisses || 0) + 1;
      
      const results = await originalFind.call(repository, criteria);
      
      if (results && results.length > 0) {
        this._cache.set(cacheKey, results);
        
        if (this._cache.size > this._config.maxCacheSize) {
          const firstKey = this._cache.keys().next().value;
          this._cache.delete(firstKey);
        }
      }
      
      return results;
    };
    
    // Add cache statistics method
    repository.getCacheStats = () => {
      const hits = repository._cacheHits || 0;
      const misses = repository._cacheMisses || 0;
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        hits,
        misses,
        hitRate: `${hitRate.toFixed(2)}%`
      };
    };
  }

  _calculateCacheHitRate() {
    let totalHits = 0;
    let totalMisses = 0;
    
    this._repositories.forEach(repoInfo => {
      repoInfo.instances.forEach(instance => {
        if (instance.getCacheStats) {
          const stats = instance.getCacheStats();
          totalHits += stats.hits;
          totalMisses += stats.misses;
        }
      });
    });
    
    const total = totalHits + totalMisses;
    return total > 0 ? (totalHits / total) * 100 : 0;
  }

  // Static factory creator
  static create() {
    return new RepositoryFactory();
  }
}

// Example data sources
class PostgreSQLDataSource {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  async connect() {
    console.log('Connecting to PostgreSQL...');
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    console.log('PostgreSQL connected');
  }

  async close() {
    this.connected = false;
    console.log('PostgreSQL connection closed');
  }

  async query(sql, params = []) {
    if (!this.connected) {
      throw new Error('PostgreSQL not connected');
    }
    
    console.log(`[PostgreSQL] ${sql}`, params);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Simulate query results
    return {
      rows: [{ id: 1, name: 'John Doe', email: 'john@example.com' }],
      rowCount: 1
    };
  }
}

class MongoDBDataSource {
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.collections = new Map();
  }

  async connect() {
    console.log('Connecting to MongoDB...');
    await new Promise(resolve => setTimeout(resolve, 80));
    this.connected = true;
    console.log('MongoDB connected');
  }

  async close() {
    this.connected = false;
    this.collections.clear();
    console.log('MongoDB connection closed');
  }

  async getCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name);
  }

  async find(collectionName, query = {}) {
    const collection = await this.getCollection(collectionName);
    console.log(`[MongoDB] find in ${collectionName}:`, query);
    
    await new Promise(resolve => setTimeout(resolve, 30));
    
    return Array.from(collection.values()).filter(doc => {
      return Object.keys(query).every(key => doc[key] === query[key]);
    });
  }

  async insert(collectionName, document) {
    const collection = await this.getCollection(collectionName);
    const id = document._id || `doc_${Date.now()}`;
    const docWithId = { _id: id, ...document };
    
    collection.set(id, docWithId);
    console.log(`[MongoDB] inserted into ${collectionName}:`, docWithId);
    
    return docWithId;
  }
}

// Example repositories
class BaseRepository {
  constructor(dataSource, mappers, config, dependencies) {
    this.dataSource = dataSource;
    this.mappers = mappers;
    this.config = config;
    this.dependencies = dependencies;
  }

  // To be implemented by concrete repositories
  async findById(id) {
    throw new Error('findById not implemented');
  }

  async find(criteria) {
    throw new Error('find not implemented');
  }

  async save(entity) {
    throw new Error('save not implemented');
  }

  async delete(id) {
    throw new Error('delete not implemented');
  }
}

class UserRepository extends BaseRepository {
  constructor(dataSource, mappers, config, dependencies) {
    super(dataSource, mappers, config, dependencies);
    this.entityName = 'users';
  }

  async findById(id) {
    if (this.dataSource.query) {
      // PostgreSQL style
      const result = await this.dataSource.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } else {
      // MongoDB style
      const results = await this.dataSource.find('users', { _id: id });
      return results[0] || null;
    }
  }

  async find(criteria) {
    if (this.dataSource.query) {
      const conditions = Object.keys(criteria).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(criteria);
      
      const result = await this.dataSource.query(
        `SELECT * FROM users WHERE ${conditions}`,
        values
      );
      return result.rows;
    } else {
      return await this.dataSource.find('users', criteria);
    }
  }

  async save(user) {
    if (this.dataSource.query) {
      if (user.id) {
        // Update
        const result = await this.dataSource.query(
          'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *',
          [user.name, user.email, user.id]
        );
        return result.rows[0];
      } else {
        // Insert
        const result = await this.dataSource.query(
          'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
          [user.name, user.email]
        );
        return result.rows[0];
      }
    } else {
      if (user._id) {
        // Update
        const collection = await this.dataSource.getCollection('users');
        collection.set(user._id, user);
        return user;
      } else {
        // Insert
        return await this.dataSource.insert('users', user);
      }
    }
  }

  async delete(id) {
    if (this.dataSource.query) {
      const result = await this.dataSource.query(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0] || null;
    } else {
      const collection = await this.dataSource.getCollection('users');
      const user = collection.get(id);
      if (user) {
        collection.delete(id);
        return user;
      }
      return null;
    }
  }
}

class ProductRepository extends BaseRepository {
  constructor(dataSource, mappers, config, dependencies) {
    super(dataSource, mappers, config, dependencies);
    this.entityName = 'products';
  }

  async findById(id) {
    if (this.dataSource.query) {
      const result = await this.dataSource.query(
        'SELECT * FROM products WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } else {
      const results = await this.dataSource.find('products', { _id: id });
      return results[0] || null;
    }
  }

  async findByCategory(category) {
    return this.find({ category });
  }
}

// Usage in production
async function repositoryFactoryDemo() {
  const repositoryFactory = RepositoryFactory.create();

  // Register data sources
  const postgresDataSource = new PostgreSQLDataSource({
    host: 'localhost',
    port: 5432,
    database: 'myapp'
  });

  const mongoDataSource = new MongoDBDataSource({
    host: 'localhost',
    port: 27017,
    database: 'myapp'
  });

  repositoryFactory
    .registerDataSource('postgres', postgresDataSource, {
      type: 'sql',
      default: true,
      healthCheck: async (ds) => ds.connected
    })
    .registerDataSource('mongodb', mongoDataSource, {
      type: 'nosql',
      healthCheck: async (ds) => ds.connected
    });

  // Register repositories
  repositoryFactory
    .registerRepository('userRepository', UserRepository, {
      dataSource: 'postgres',
      cacheEnabled: true,
      cacheTTL: 300000 // 5 minutes
    })
    .registerRepository('productRepository', ProductRepository, {
      dataSource: 'mongodb',
      cacheEnabled: true
    });

  // Initialize data sources
  await repositoryFactory.initialize();

  // Get repository instances
  const userRepo = repositoryFactory.get('userRepository');
  const productRepo = repositoryFactory.get('productRepository');

  // Use repositories
  console.log('=== Testing Repositories ===');
  
  // User repository (PostgreSQL)
  const user = await userRepo.save({
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Saved user:', user);

  const foundUser = await userRepo.findById(user.id || user._id);
  console.log('Found user:', foundUser);

  // Product repository (MongoDB)
  const product = await productRepo.save({
    name: 'Laptop',
    category: 'electronics',
    price: 999.99
  });
  console.log('Saved product:', product);

  const foundProduct = await productRepo.findById(product._id);
  console.log('Found product:', foundProduct);

  // Test caching
  console.log('\n=== Testing Cache ===');
  
  // These should hit cache
  await userRepo.findById(user.id || user._id);
  await userRepo.findById(user.id || user._id);
  
  console.log('User repository cache stats:', userRepo.getCacheStats());

  // Show factory status
  console.log('\n=== Factory Status ===');
  console.log(repositoryFactory.getStatus());

  // Cleanup
  await repositoryFactory.close();
}

repositoryFactoryDemo();

// These production-grade factory function patterns provide:

// 1. **Database Connection Management** - Connection pooling and multi-database support
// 2. **Service Dependency Injection** - Lifecycle management and dependency resolution
// 3. **Middleware Composition** - Flexible middleware chains with hooks and validation
// 4. **Repository Data Access** - Caching, multiple data sources, and entity mapping

// These factories enable scalable, maintainable, and testable backend architectures in Node.js production environments.




























// Here are comprehensive code snippets for object destructuring in Node.js production-grade backend development:

// ## 1. Configuration Management with Destructuring

// Advanced configuration management with destructuring and defaults
class ConfigManager {
  constructor(config = {}) {
    // Destructure with defaults and validation
    const {
      // Server configuration
      server: {
        port = 3000,
        host = 'localhost',
        environment = process.env.NODE_ENV || 'development',
        clusterMode = false,
        ...serverRest
      } = {},
      
      // Database configuration
      database: {
        host: dbHost = 'localhost',
        port: dbPort = 5432,
        name: dbName = 'myapp',
        username: dbUser,
        password: dbPass,
        pool: {
          max: poolMax = 10,
          min: poolMin = 2,
          acquire: poolAcquire = 30000,
          idle: poolIdle = 10000,
          ...poolRest
        } = {},
        ...databaseRest
      } = {},
      
      // Security configuration
      security: {
        jwtSecret = this._getRequiredEnvVar('JWT_SECRET'),
        jwtExpiresIn = '24h',
        bcryptRounds = 12,
        corsOrigins = ['http://localhost:3000'],
        rateLimit: {
          windowMs: rateWindow = 900000,
          max: rateMax = 100,
          ...rateLimitRest
        } = {},
        ...securityRest
      } = {},
      
      // Logging configuration
      logging: {
        level = environment === 'production' ? 'info' : 'debug',
        transports = ['console', 'file'],
        file: {
          filename: logFile = 'app.log',
          maxSize: logMaxSize = 10485760,
          maxFiles: logMaxFiles = 5,
          ...logFileRest
        } = {},
        ...loggingRest
      } = {},
      
      // External services
      services: {
        email: {
          provider: emailProvider = 'smtp',
          apiKey: emailApiKey,
          from: emailFrom = 'noreply@example.com',
          ...emailRest
        } = {},
        storage: {
          provider: storageProvider = 'local',
          bucket: storageBucket,
          region: storageRegion,
          ...storageRest
        } = {},
        ...servicesRest
      } = {},
      
      // Feature flags
      features: {
        caching = true,
        compression = true,
        websockets = false,
        ...featuresRest
      } = {},
      
      // Rest of the configuration
      ...restConfig
    } = config;

    // Assign destructured values to instance properties
    this.server = {
      port,
      host,
      environment,
      clusterMode,
      ...serverRest
    };

    this.database = {
      host: dbHost,
      port: dbPort,
      name: dbName,
      username: dbUser,
      password: dbPass,
      pool: {
        max: poolMax,
        min: poolMin,
        acquire: poolAcquire,
        idle: poolIdle,
        ...poolRest
      },
      ...databaseRest
    };

    this.security = {
      jwtSecret,
      jwtExpiresIn,
      bcryptRounds,
      corsOrigins,
      rateLimit: {
        windowMs: rateWindow,
        max: rateMax,
        ...rateLimitRest
      },
      ...securityRest
    };

    this.logging = {
      level,
      transports,
      file: {
        filename: logFile,
        maxSize: logMaxSize,
        maxFiles: logMaxFiles,
        ...logFileRest
      },
      ...loggingRest
    };

    this.services = {
      email: {
        provider: emailProvider,
        apiKey: emailApiKey,
        from: emailFrom,
        ...emailRest
      },
      storage: {
        provider: storageProvider,
        bucket: storageBucket,
        region: storageRegion,
        ...storageRest
      },
      ...servicesRest
    };

    this.features = {
      caching,
      compression,
      websockets,
      ...featuresRest
    };

    this.restConfig = restConfig;

    // Validate critical configuration
    this._validateConfig();
  }

  // Method to get configuration with deep destructuring
  getServiceConfig(serviceName, options = {}) {
    const {
      includeSensitive = false,
      transform = null,
      ...queryOptions
    } = options;

    // Destructure based on service name
    switch (serviceName) {
      case 'database':
        const {
          host,
          port,
          name: database,
          username,
          password,
          pool: { max, min, ...poolConfig },
          ...dbRest
        } = this.database;

        const dbConfig = {
          host,
          port,
          database,
          username,
          password: includeSensitive ? password : '***',
          pool: { max, min, ...poolConfig },
          ...dbRest
        };

        return transform ? transform(dbConfig) : dbConfig;

      case 'api':
        const {
          server: { port, host, environment },
          security: { jwtSecret, corsOrigins },
          features: { caching, compression },
          ...apiRest
        } = this;

        const apiConfig = {
          server: { port, host, environment },
          security: {
            jwtSecret: includeSensitive ? jwtSecret : '***',
            corsOrigins
          },
          features: { caching, compression },
          ...apiRest
        };

        return transform ? transform(apiConfig) : apiConfig;

      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
  }

  // Update configuration with partial updates using destructuring
  update(updates) {
    const {
      server: serverUpdates = {},
      database: databaseUpdates = {},
      security: securityUpdates = {},
      ...restUpdates
    } = updates;

    // Merge updates using destructuring
    this.server = {
      ...this.server,
      ...serverUpdates
    };

    this.database = {
      ...this.database,
      ...databaseUpdates,
      pool: {
        ...this.database.pool,
        ...(databaseUpdates.pool || {})
      }
    };

    this.security = {
      ...this.security,
      ...securityUpdates,
      rateLimit: {
        ...this.security.rateLimit,
        ...(securityUpdates.rateLimit || {})
      }
    };

    Object.assign(this, restUpdates);

    this._validateConfig();
    return this;
  }

  // Create environment-specific configuration
  createEnvironmentConfig(env = this.server.environment) {
    const baseConfig = this.toJSON();

    // Destructure and modify based on environment
    const {
      server: { clusterMode, ...serverRest },
      database: { pool: { max: poolMax, ...poolRest }, ...databaseRest },
      logging: { level, ...loggingRest },
      ...restBase
    } = baseConfig;

    const envConfig = {
      server: {
        ...serverRest,
        clusterMode: env === 'production' ? true : clusterMode
      },
      database: {
        ...databaseRest,
        pool: {
          ...poolRest,
          max: env === 'production' ? Math.max(poolMax, 20) : poolMax
        }
      },
      logging: {
        ...loggingRest,
        level: env === 'production' ? 'warn' : level
      },
      ...restBase
    };

    return envConfig;
  }

  // Private methods
  _getRequiredEnvVar(name) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
  }

  _validateConfig() {
    const { jwtSecret, bcryptRounds } = this.security;
    const { port, environment } = this.server;

    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    if (bcryptRounds < 10 || bcryptRounds > 15) {
      throw new Error('BCrypt rounds must be between 10 and 15');
    }

    if (port < 1 || port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }

    if (!['development', 'staging', 'production'].includes(environment)) {
      throw new Error('Environment must be one of: development, staging, production');
    }
  }

  toJSON() {
    // Return safe copy without sensitive data
    const {
      database: { password, ...databaseRest },
      security: { jwtSecret, ...securityRest },
      services: { email: { apiKey, ...emailRest }, ...servicesRest },
      ...rest
    } = this;

    return {
      ...rest,
      database: databaseRest,
      security: securityRest,
      services: {
        email: emailRest,
        ...servicesRest
      }
    };
  }

  // Static factory method with destructuring
  static createFromEnv(prefix = 'APP_') {
    const envConfig = {};

    // Destructure environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const configKey = key
          .slice(prefix.length)
          .toLowerCase()
          .split('_')
          .reduce((result, part, index) => {
            if (index === 0) return part;
            return result + part.charAt(0).toUpperCase() + part.slice(1);
          }, '');

        let value = process.env[key];

        // Parse values
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);
        else if (value.startsWith('[') || value.startsWith('{')) {
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string if parsing fails
          }
        }

        // Set nested properties
        const keys = configKey.split('.');
        let current = envConfig;

        for (let i = 0; i < keys.length - 1; i++) {
          const keyPart = keys[i];
          if (!current[keyPart]) {
            current[keyPart] = {};
          }
          current = current[keyPart];
        }

        current[keys[keys.length - 1]] = value;
      }
    });

    return new ConfigManager(envConfig);
  }
}

// Usage in production
function configDestructuringDemo() {
  // Create configuration from object
  const config = new ConfigManager({
    server: {
      port: 8080,
      host: '0.0.0.0',
      environment: 'production',
      clusterMode: true
    },
    database: {
      host: 'db.example.com',
      port: 5432,
      name: 'myapp_prod',
      username: 'admin',
      password: 'super-secret-password',
      pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
      }
    },
    security: {
      jwtSecret: 'very-long-and-secure-jwt-secret-key-here',
      jwtExpiresIn: '24h',
      bcryptRounds: 12,
      corsOrigins: ['https://myapp.com'],
      rateLimit: {
        windowMs: 900000,
        max: 100
      }
    },
    logging: {
      level: 'info',
      transports: ['console', 'file'],
      file: {
        filename: 'app.log',
        maxSize: 10485760,
        maxFiles: 5
      }
    }
  });

  console.log('Server config:', config.server);
  console.log('Database config:', config.getServiceConfig('database', { includeSensitive: false }));
  console.log('API config:', config.getServiceConfig('api'));

  // Update configuration
  config.update({
    server: {
      port: 8443
    },
    features: {
      caching: true,
      websockets: true
    }
  });

  console.log('Updated server port:', config.server.port);

  // Create environment-specific config
  const prodConfig = config.createEnvironmentConfig('production');
  console.log('Production config:', prodConfig);

  // Create from environment variables
  process.env.APP_SERVER_PORT = '3000';
  process.env.APP_DATABASE_HOST = 'localhost';
  process.env.APP_SECURITY_JWT_SECRET = 'env-jwt-secret';

  const envConfig = ConfigManager.createFromEnv();
  console.log('Env-based config:', envConfig.toJSON());
}

configDestructuringDemo();

// ## 2. API Request/Response Handling with Destructuring

// Advanced request/response handler with comprehensive destructuring
class APIHandler {
  constructor(options = {}) {
    const {
      validation = true,
      transformation = true,
      logging = true,
      errorHandling = true,
      ...restOptions
    } = options;

    this.options = {
      validation,
      transformation,
      logging,
      errorHandling,
      ...restOptions
    };

    this.validators = new Map();
    this.transformers = new Map();
    this.middleware = [];
  }

  // Main request handler with destructuring
  async handleRequest(req, res) {
    const startTime = Date.now();
    
    try {
      // Destructure request with defaults
      const {
        method,
        url,
        headers = {},
        params = {},
        query = {},
        body = {},
        user = null,
        ip,
        ...requestRest
      } = req;

      // Destructure headers for common use cases
      const {
        authorization,
        'user-agent': userAgent,
        'content-type': contentType = 'application/json',
        ...otherHeaders
      } = headers;

      // Create request context with destructured values
      const context = {
        method,
        url,
        headers: {
          authorization,
          userAgent,
          contentType,
          ...otherHeaders
        },
        params,
        query,
        body,
        user,
        ip,
        ...requestRest,
        timestamp: new Date()
      };

      // Log request if enabled
      if (this.options.logging) {
        this._logRequest(context);
      }

      // Validate request if enabled
      if (this.options.validation) {
        await this._validateRequest(context);
      }

      // Transform request data if enabled
      if (this.options.transformation) {
        await this._transformRequest(context);
      }

      // Execute middleware
      for (const middleware of this.middleware) {
        await middleware(context);
      }

      // Process the request (to be implemented by subclasses)
      const result = await this.processRequest(context);

      // Prepare and send response
      await this._sendResponse(res, result, context);

      // Log successful response
      if (this.options.logging) {
        this._logResponse(context, result, Date.now() - startTime);
      }

    } catch (error) {
      // Handle errors with proper destructuring
      await this._handleError(error, req, res, Date.now() - startTime);
    }
  }

  // Response handler with destructuring
  async _sendResponse(res, result, context) {
    const {
      statusCode = 200,
      headers: responseHeaders = {},
      data,
      meta = {},
      ...resultRest
    } = result;

    // Destructure context for response formatting
    const {
      method,
      url,
      user,
      timestamp,
      ...contextRest
    } = context;

    // Default response structure
    const response = {
      success: true,
      data,
      meta: {
        timestamp,
        method,
        url,
        ...meta
      },
      ...resultRest
    };

    // Set headers with defaults
    const headers = {
      'content-type': 'application/json',
      'x-request-id': context.requestId || this._generateRequestId(),
      ...responseHeaders
    };

    // Send response
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(response));
  }

  // Error handler with comprehensive destructuring
  async _handleError(error, req, res, duration) {
    if (!this.options.errorHandling) {
      throw error;
    }

    // Destructure error object
    const {
      message,
      statusCode = 500,
      code,
      details = {},
      stack,
      ...errorRest
    } = error;

    // Destructure request for error context
    const {
      method,
      url,
      headers: { 'user-agent': userAgent },
      ip,
      user
    } = req;

    // Log error
    console.error('API Error:', {
      message,
      statusCode,
      code,
      method,
      url,
      userAgent,
      ip,
      userId: user?.id,
      duration: `${duration}ms`,
      stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      ...errorRest
    });

    // Prepare error response
    const errorResponse = {
      success: false,
      error: {
        message: this._getClientErrorMessage(message, statusCode),
        code,
        ...(process.env.NODE_ENV === 'development' && { details }),
        ...errorRest
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this._generateRequestId()
      }
    };

    // Send error response
    res.writeHead(statusCode, {
      'content-type': 'application/json',
      'x-request-id': errorResponse.meta.requestId
    });
    
    res.end(JSON.stringify(errorResponse));
  }

  // Request validation with destructuring
  async _validateRequest(context) {
    const {
      method,
      body,
      query,
      params,
      headers: { authorization, contentType },
      url
    } = context;

    // Method-specific validation
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (!body || Object.keys(body).length === 0) {
        throw this._createValidationError('Request body is required');
      }

      if (contentType !== 'application/json') {
        throw this._createValidationError('Content-Type must be application/json');
      }
    }

    // Route-specific validation
    const validator = this.validators.get(this._getRouteKey(method, url));
    if (validator) {
      const { body: bodySchema, query: querySchema, params: paramsSchema } = validator;
      
      if (bodySchema) {
        await this._validateAgainstSchema(body, bodySchema, 'body');
      }
      
      if (querySchema) {
        await this._validateAgainstSchema(query, querySchema, 'query');
      }
      
      if (paramsSchema) {
        await this._validateAgainstSchema(params, paramsSchema, 'params');
      }
    }

    // Authentication validation
    if (this._requiresAuth(method, url) && !authorization) {
      throw this._createAuthError('Authentication required');
    }
  }

  // Request transformation with destructuring
  async _transformRequest(context) {
    const {
      body,
      query,
      params,
      method,
      url
    } = context;

    const transformer = this.transformers.get(this._getRouteKey(method, url));
    if (transformer) {
      const {
        body: bodyTransform,
        query: queryTransform,
        params: paramsTransform,
        ...restTransform
      } = transformer;

      if (bodyTransform) {
        context.body = await this._applyTransformation(body, bodyTransform);
      }

      if (queryTransform) {
        context.query = await this._applyTransformation(query, queryTransform);
      }

      if (paramsTransform) {
        context.params = await this._applyTransformation(params, paramsTransform);
      }

      // Apply other transformations
      Object.keys(restTransform).forEach(key => {
        if (context[key] !== undefined) {
          context[key] = restTransform[key](context[key]);
        }
      });
    }
  }

  // Add route-specific validator
  addValidator(method, path, validator) {
    const {
      body: bodySchema,
      query: querySchema,
      params: paramsSchema,
      ...restValidator
    } = validator;

    this.validators.set(this._getRouteKey(method, path), {
      body: bodySchema,
      query: querySchema,
      params: paramsSchema,
      ...restValidator
    });

    return this;
  }

  // Add route-specific transformer
  addTransformer(method, path, transformer) {
    const {
      body: bodyTransform,
      query: queryTransform,
      params: paramsTransform,
      ...restTransformer
    } = transformer;

    this.transformers.set(this._getRouteKey(method, path), {
      body: bodyTransform,
      query: queryTransform,
      params: paramsTransform,
      ...restTransformer
    });

    return this;
  }

  // Add middleware
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  // Private utility methods
  _logRequest(context) {
    const {
      method,
      url,
      headers: { 'user-agent': userAgent },
      ip,
      user,
      timestamp
    } = context;

    console.log(`[${timestamp.toISOString()}] ${method} ${url}`, {
      ip,
      userAgent,
      userId: user?.id
    });
  }

  _logResponse(context, result, duration) {
    const {
      method,
      url,
      user
    } = context;

    const { statusCode } = result;

    console.log(`[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms`, {
      userId: user?.id
    });
  }

  _getRouteKey(method, path) {
    return `${method}:${path}`;
  }

  _requiresAuth(method, path) {
    // Define routes that require authentication
    const protectedRoutes = [
      'POST:/api/users',
      'PUT:/api/users/*',
      'DELETE:/api/users/*'
    ];

    return protectedRoutes.some(route => {
      const [routeMethod, routePath] = route.split(':');
      return method === routeMethod && path.startsWith(routePath.replace('*', ''));
    });
  }

  async _validateAgainstSchema(data, schema, source) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const { required, type, min, max, pattern, custom } = rules;

      if (required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (type && typeof value !== type) {
          errors.push(`${field} must be ${type}`);
        }

        if (min !== undefined) {
          if (typeof value === 'number' && value < min) {
            errors.push(`${field} must be at least ${min}`);
          } else if (typeof value === 'string' && value.length < min) {
            errors.push(`${field} must be at least ${min} characters`);
          }
        }

        if (max !== undefined) {
          if (typeof value === 'number' && value > max) {
            errors.push(`${field} must be at most ${max}`);
          } else if (typeof value === 'string' && value.length > max) {
            errors.push(`${field} must be at most ${max} characters`);
          }
        }

        if (pattern && !pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }

        if (custom && !custom(value)) {
          errors.push(`${field} failed custom validation`);
        }
      }
    }

    if (errors.length > 0) {
      throw this._createValidationError(`Validation failed for ${source}: ${errors.join(', ')}`, errors);
    }
  }

  async _applyTransformation(data, transform) {
    if (typeof transform === 'function') {
      return await transform(data);
    }

    if (typeof transform === 'object') {
      const transformed = { ...data };
      
      for (const [key, transformer] of Object.entries(transform)) {
        if (transformed[key] !== undefined) {
          transformed[key] = typeof transformer === 'function' 
            ? await transformer(transformed[key])
            : transformer;
        }
      }
      
      return transformed;
    }

    return data;
  }

  _createValidationError(message, details = []) {
    const error = new Error(message);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = details;
    return error;
  }

  _createAuthError(message) {
    const error = new Error(message);
    error.statusCode = 401;
    error.code = 'AUTHENTICATION_ERROR';
    return error;
  }

  _getClientErrorMessage(message, statusCode) {
    if (statusCode >= 500) {
      return 'Internal server error';
    }
    return message;
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Abstract method to be implemented by subclasses
  async processRequest(context) {
    throw new Error('processRequest must be implemented by subclass');
  }
}

// Example implementation for user API
class UserAPIHandler extends APIHandler {
  constructor(options = {}) {
    const {
      userService,
      authService,
      cacheService,
      ...restOptions
    } = options;

    super(restOptions);

    this.userService = userService;
    this.authService = authService;
    this.cacheService = cacheService;

    // Set up validators and transformers
    this._setupValidators();
    this._setupTransformers();
    this._setupMiddleware();
  }

  _setupValidators() {
    // User creation validator
    this.addValidator('POST', '/api/users', {
      body: {
        name: { required: true, type: 'string', min: 1 },
        email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        password: { required: true, type: 'string', min: 8 }
      }
    });

    // User update validator
    this.addValidator('PUT', '/api/users/:id', {
      body: {
        name: { type: 'string', min: 1 },
        email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
      },
      params: {
        id: { required: true, type: 'string' }
      }
    });
  }

  _setupTransformers() {
    // User creation transformer
    this.addTransformer('POST', '/api/users', {
      body: async (body) => {
        const { password, ...restBody } = body;
        const hashedPassword = await this.authService.hashPassword(password);
        return { ...restBody, password: hashedPassword };
      }
    });

    // User response transformer
    this.addTransformer('GET', '/api/users/:id', {
      response: (user) => {
        const { password, ...safeUser } = user;
        return safeUser;
      }
    });
  }

  _setupMiddleware() {
    // Authentication middleware
    this.use(async (context) => {
      const { headers: { authorization }, method, url } = context;

      if (this._requiresAuth(method, url)) {
        if (!authorization) {
          throw this._createAuthError('Authentication required');
        }

        const user = await this.authService.verifyToken(authorization.replace('Bearer ', ''));
        if (!user) {
          throw this._createAuthError('Invalid token');
        }

        context.user = user;
      }
    });

    // Caching middleware
    this.use(async (context) => {
      const { method, url, params } = context;

      if (method === 'GET' && params.id) {
        const cacheKey = `user:${params.id}`;
        const cached = await this.cacheService.get(cacheKey);
        
        if (cached) {
          context.cached = true;
          context.result = { data: cached, statusCode: 200 };
          throw new Error('CACHE_HIT'); // Special error to break middleware chain
        }
      }
    });
  }

  async processRequest(context) {
    const { method, url, params, query, body, user, cached, result } = context;

    // Return cached result if available
    if (cached) {
      return result;
    }

    // Route to appropriate handler
    const routeKey = this._getRouteKey(method, url);
    
    switch (routeKey) {
      case 'GET:/api/users/:id':
        return await this._getUser(params.id);
      
      case 'POST:/api/users':
        return await this._createUser(body);
      
      case 'PUT:/api/users/:id':
        return await this._updateUser(params.id, body, user);
      
      case 'DELETE:/api/users/:id':
        return await this._deleteUser(params.id, user);
      
      case 'GET:/api/users':
        return await this._listUsers(query);
      
      default:
        throw new Error(`Route not found: ${method} ${url}`);
    }
  }

  async _getUser(userId) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Cache the result
    await this.cacheService.set(`user:${userId}`, user, 300);

    return {
      statusCode: 200,
      data: user,
      meta: { cached: false }
    };
  }

  async _createUser(userData) {
    const user = await this.userService.create(userData);
    
    return {
      statusCode: 201,
      data: user,
      meta: { created: true }
    };
  }

  async _updateUser(userId, updates, currentUser) {
    // Authorization check
    if (currentUser.id !== userId && !currentUser.isAdmin) {
      throw this._createAuthError('Not authorized to update this user');
    }

    const user = await this.userService.update(userId, updates);
    
    // Invalidate cache
    await this.cacheService.del(`user:${userId}`);

    return {
      statusCode: 200,
      data: user,
      meta: { updated: true }
    };
  }

  async _deleteUser(userId, currentUser) {
    if (!currentUser.isAdmin) {
      throw this._createAuthError('Not authorized to delete users');
    }

    await this.userService.delete(userId);
    
    // Invalidate cache
    await this.cacheService.del(`user:${userId}`);

    return {
      statusCode: 204,
      meta: { deleted: true }
    };
  }

  async _listUsers(query) {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      ...filters
    } = query;

    const users = await this.userService.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      order,
      filters
    });

    return {
      statusCode: 200,
      data: users,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        order
      }
    };
  }
}

// Mock services for demonstration
const mockServices = {
  userService: {
    async findById(id) {
      return { id, name: 'John Doe', email: 'john@example.com', createdAt: new Date() };
    },
    async create(userData) {
      return { id: '123', ...userData, createdAt: new Date() };
    },
    async update(id, updates) {
      return { id, ...updates, updatedAt: new Date() };
    },
    async delete(id) {
      return true;
    },
    async findAll(options) {
      return [{ id: '123', name: 'John Doe', email: 'john@example.com' }];
    }
  },
  authService: {
    async hashPassword(password) {
      return `hashed_${password}`;
    },
    async verifyToken(token) {
      if (token === 'valid-token') {
        return { id: 'user123', isAdmin: false };
      }
      return null;
    }
  },
  cacheService: {
    async get(key) {
      return null; // Simulate cache miss
    },
    async set(key, value, ttl) {
      console.log(`Cached ${key} for ${ttl} seconds`);
    },
    async del(key) {
      console.log(`Invalidated cache for ${key}`);
    }
  }
};

// Usage demonstration
async function apiHandlerDemo() {
  const userAPI = new UserAPIHandler({
    userService: mockServices.userService,
    authService: mockServices.authService,
    cacheService: mockServices.cacheService,
    logging: true,
    validation: true,
    transformation: true
  });

  // Mock request objects
  const mockReq = {
    method: 'GET',
    url: '/api/users/123',
    headers: {
      'user-agent': 'Mozilla/5.0',
      authorization: 'Bearer valid-token'
    },
    params: { id: '123' },
    query: {},
    body: {},
    ip: '192.168.1.100'
  };

  const mockRes = {
    writeHead: (status, headers) => {
      console.log(`Response: ${status}`, headers);
    },
    end: (data) => {
      console.log('Response data:', JSON.parse(data));
    }
  };

  console.log('=== Testing User API Handler ===');
  await userAPI.handleRequest(mockReq, mockRes);

  // Test with POST request
  const postReq = {
    method: 'POST',
    url: '/api/users',
    headers: {
      'content-type': 'application/json'
    },
    params: {},
    query: {},
    body: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'securepassword123'
    },
    ip: '192.168.1.100'
  };

  console.log('\n=== Testing User Creation ===');
  await userAPI.handleRequest(postReq, mockRes);
}

apiHandlerDemo();

// ## 3. Database Query Builder with Destructuring

// Advanced query builder with comprehensive destructuring
class QueryBuilder {
  constructor(tableName, options = {}) {
    const {
      dialect = 'postgres',
      pagination = true,
      logging = false,
      timestamps = true,
      softDelete = false,
      ...restOptions
    } = options;

    this.tableName = tableName;
    this.options = {
      dialect,
      pagination,
      logging,
      timestamps,
      softDelete,
      ...restOptions
    };

    this.query = {
      select: [],
      where: [],
      joins: [],
      order: [],
      group: [],
      having: [],
      limit: null,
      offset: null,
      data: {},
      type: 'select'
    };

    this.paramCount = 0;
    this.parameters = [];
  }

  // SELECT clause with destructuring
  select(fields = ['*']) {
    const fieldList = Array.isArray(fields) ? fields : [fields];
    
    this.query.select = [
      ...this.query.select,
      ...fieldList.map(field => this._parseField(field))
    ];
    
    return this;
  }

  // WHERE clause with advanced destructuring
  where(conditions, operator = 'AND') {
    if (typeof conditions === 'object' && conditions !== null) {
      const {
        $and,
        $or,
        $not,
        ...simpleConditions
      } = conditions;

      // Handle simple conditions
      Object.entries(simpleConditions).forEach(([field, value]) => {
        this._addWhereCondition(field, '=', value, operator);
      });

      // Handle AND conditions
      if ($and && Array.isArray($and)) {
        $and.forEach(condition => {
          this.where(condition, 'AND');
        });
      }

      // Handle OR conditions
      if ($or && Array.isArray($or)) {
        const orConditions = $or.map(condition => {
          const qb = new QueryBuilder(this.tableName, this.options);
          qb.where(condition, 'AND');
          return qb;
        });
        this.query.where.push({
          type: 'OR',
          conditions: orConditions
        });
      }

      // Handle NOT conditions
      if ($not) {
        const notQb = new QueryBuilder(this.tableName, this.options);
        notQb.where($not, 'AND');
        this.query.where.push({
          type: 'NOT',
          condition: notQb
        });
      }
    } else if (typeof conditions === 'string') {
      this.query.where.push({
        type: 'RAW',
        condition: conditions,
        operator
      });
    }

    return this;
  }

  // JOIN clause with destructuring
  join(table, conditions, type = 'INNER') {
    const {
      $on,
      $using,
      ...joinConditions
    } = conditions;

    const join = {
      table,
      type: type.toUpperCase(),
      conditions: []
    };

    // Handle ON conditions
    if ($on) {
      Object.entries($on).forEach(([leftField, rightField]) => {
        join.conditions.push({
          left: this._parseField(leftField),
          right: this._parseField(rightField, table),
          operator: '='
        });
      });
    }

    // Handle USING conditions
    if ($using) {
      const fields = Array.isArray($using) ? $using : [$using];
      fields.forEach(field => {
        join.conditions.push({
          left: this._parseField(field),
          right: this._parseField(field, table),
          operator: '='
        });
      });
    }

    // Handle additional conditions
    Object.entries(joinConditions).forEach(([leftField, rightField]) => {
      join.conditions.push({
        left: this._parseField(leftField),
        right: this._parseField(rightField, table),
        operator: '='
      });
    });

    this.query.joins.push(join);
    return this;
  }

  // ORDER BY clause with destructuring
  orderBy(field, direction = 'ASC') {
    const {
      $field,
      $direction = 'ASC',
      ...orderConfig
    } = typeof field === 'object' ? field : { $field: field, $direction: direction };

    const order = {
      field: this._parseField($field),
      direction: $direction.toUpperCase()
    };

    // Handle multiple order fields
    if (Object.keys(orderConfig).length > 0) {
      Object.entries(orderConfig).forEach(([field, dir]) => {
        this.query.order.push({
          field: this._parseField(field),
          direction: dir.toUpperCase()
        });
      });
    }

    this.query.order.push(order);
    return this;
  }

  // Pagination with destructuring
  paginate({ page = 1, limit = 10, ...paginationOptions } = {}) {
    const {
      maxLimit = 100,
      countTotal = true,
      ...restPagination
    } = paginationOptions;

    const actualLimit = Math.min(limit, maxLimit);
    const actualPage = Math.max(page, 1);
    const offset = (actualPage - 1) * actualLimit;

    this.query.limit = actualLimit;
    this.query.offset = offset;
    this.query.pagination = {
      page: actualPage,
      limit: actualLimit,
      countTotal,
      ...restPagination
    };

    return this;
  }

  // INSERT operation with destructuring
  insert(data) {
    this.query.type = 'insert';
    
    if (Array.isArray(data)) {
      // Batch insert
      this.query.data = data.map(item => this._prepareData(item));
    } else {
      // Single insert
      this.query.data = this._prepareData(data);
    }

    return this;
  }

  // UPDATE operation with destructuring
  update(data, conditions = {}) {
    this.query.type = 'update';
    this.query.data = this._prepareData(data);
    
    if (Object.keys(conditions).length > 0) {
      this.where(conditions);
    }

    return this;
  }

  // DELETE operation with destructuring
  delete(conditions = {}) {
    this.query.type = 'delete';
    
    if (Object.keys(conditions).length > 0) {
      this.where(conditions);
    }

    return this;
  }

  // Build the final query with comprehensive destructuring
  build() {
    const {
      type,
      select,
      where,
      joins,
      order,
      group,
      having,
      limit,
      offset,
      data,
      pagination
    } = this.query;

    this.paramCount = 0;
    this.parameters = [];

    let sql;
    let result;

    switch (type) {
      case 'select':
        result = this._buildSelect({
          select,
          where,
          joins,
          order,
          group,
          having,
          limit,
          offset
        });
        break;
      
      case 'insert':
        result = this._buildInsert(data);
        break;
      
      case 'update':
        result = this._buildUpdate({ data, where });
        break;
      
      case 'delete':
        result = this._buildDelete(where);
        break;
      
      default:
        throw new Error(`Unknown query type: ${type}`);
    }

    // Add pagination metadata if needed
    if (pagination && pagination.countTotal) {
      result.pagination = {
        ...pagination,
        buildCountQuery: () => this._buildCountQuery(where)
      };
    }

    if (this.options.logging) {
      console.log('Generated SQL:', result.sql);
      console.log('Parameters:', result.parameters);
    }

    return result;
  }

  // Private methods
  _buildSelect({ select, where, joins, order, group, having, limit, offset }) {
    const selectClause = select.length > 0 ? select.join(', ') : '*';
    let sql = `SELECT ${selectClause} FROM ${this.tableName}`;

    // JOIN clauses
    joins.forEach(join => {
      const conditions = join.conditions.map(cond => 
        `${cond.left} ${cond.operator} ${cond.right}`
      ).join(' AND ');
      
      sql += ` ${join.type} JOIN ${join.table} ON ${conditions}`;
    });

    // WHERE clause
    const whereClause = this._buildWhereClause(where);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    // GROUP BY clause
    if (group.length > 0) {
      sql += ` GROUP BY ${group.join(', ')}`;
    }

    // HAVING clause
    const havingClause = this._buildWhereClause(having);
    if (havingClause) {
      sql += ` HAVING ${havingClause}`;
    }

    // ORDER BY clause
    if (order.length > 0) {
      const orderClause = order.map(({ field, direction }) => 
        `${field} ${direction}`
      ).join(', ');
      sql += ` ORDER BY ${orderClause}`;
    }

    // LIMIT and OFFSET
    if (limit !== null) {
      sql += ` LIMIT $${this._addParameter(limit)}`;
    }
    if (offset !== null) {
      sql += ` OFFSET $${this._addParameter(offset)}`;
    }

    return {
      sql,
      parameters: [...this.parameters]
    };
  }

  _buildInsert(data) {
    if (Array.isArray(data)) {
      // Batch insert
      const columns = Object.keys(data[0]);
      const placeholders = data.map((item, index) => 
        `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
      ).join(', ');

      const values = data.flatMap(item => 
        columns.map(column => item[column])
      );

      const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES ${placeholders} RETURNING *`;
      
      return {
        sql,
        parameters: values
      };
    } else {
      // Single insert
      const columns = Object.keys(data);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const values = columns.map(column => data[column]);

      const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      
      return {
        sql,
        parameters: values
      };
    }
  }

  _buildUpdate({ data, where }) {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    const values = Object.values(data);
    let paramOffset = values.length;

    const whereClause = this._buildWhereClause(where, paramOffset);
    
    const sql = `UPDATE ${this.tableName} SET ${setClause}${whereClause ? ` WHERE ${whereClause}` : ''} RETURNING *`;
    
    return {
      sql,
      parameters: [...values, ...this.parameters]
    };
  }

  _buildDelete(where) {
    const whereClause = this._buildWhereClause(where);
    
    const sql = `DELETE FROM ${this.tableName}${whereClause ? ` WHERE ${whereClause}` : ''} RETURNING *`;
    
    return {
      sql,
      parameters: [...this.parameters]
    };
  }

  _buildCountQuery(where) {
    const whereClause = this._buildWhereClause(where);
    
    const sql = `SELECT COUNT(*) as total FROM ${this.tableName}${whereClause ? ` WHERE ${whereClause}` : ''}`;
    
    return {
      sql,
      parameters: [...this.parameters]
    };
  }

  _buildWhereClause(conditions, paramOffset = 0) {
    if (!conditions || conditions.length === 0) {
      return '';
    }

    const clauses = conditions.map(condition => {
      const { type, conditions: subConditions, condition: rawCondition, operator } = condition;

      switch (type) {
        case 'SIMPLE':
          return `${condition.field} ${condition.operator} $${condition.paramIndex + paramOffset}`;
        
        case 'RAW':
          return rawCondition;
        
        case 'OR':
          const orClauses = subConditions.map(subQb => 
            `(${this._buildWhereClause(subQb.query.where, paramOffset)})`
          );
          return `(${orClauses.join(' OR ')})`;
        
        case 'NOT':
          return `NOT (${this._buildWhereClause([condition.condition.query.where], paramOffset)})`;
        
        default:
          return '';
      }
    });

    return clauses.join(' AND ');
  }

  _addWhereCondition(field, operator, value, logicalOperator = 'AND') {
    this.query.where.push({
      type: 'SIMPLE',
      field: this._parseField(field),
      operator,
      value,
      paramIndex: this._addParameter(value),
      logicalOperator
    });
  }

  _parseField(field, table = null) {
    if (typeof field !== 'string') {
      return field;
    }

    // Handle functions and expressions
    if (field.includes('(') && field.includes(')')) {
      return field;
    }

    // Handle table.field notation
    if (field.includes('.')) {
      return field;
    }

    // Add table prefix if provided
    return table ? `${table}.${field}` : `${this.tableName}.${field}`;
  }

  _prepareData(data) {
    const { timestamps, softDelete } = this.options;
    const prepared = { ...data };

    if (timestamps) {
      const now = new Date();
      if (this.query.type === 'insert') {
        prepared.created_at = now;
        prepared.updated_at = now;
      } else if (this.query.type === 'update') {
        prepared.updated_at = now;
      }
    }

    if (softDelete && this.query.type === 'delete') {
      prepared.deleted_at = new Date();
      this.query.type = 'update'; // Convert to soft delete
    }

    return prepared;
  }

  _addParameter(value) {
    this.parameters.push(value);
    return this.paramCount++;
  }

  // Static factory method
  static forTable(tableName, options = {}) {
    return new QueryBuilder(tableName, options);
  }
}

// Usage examples
function queryBuilderDemo() {
  console.log('=== Query Builder Demo ===');

  // Simple SELECT query
  const simpleQuery = QueryBuilder
    .forTable('users')
    .select(['id', 'name', 'email'])
    .where({ 
      status: 'active',
      age: { $gte: 18 }
    })
    .orderBy('name', 'ASC')
    .paginate({ page: 1, limit: 10 })
    .build();

  console.log('Simple SELECT:', simpleQuery);

  // Complex SELECT with joins and advanced conditions
  const complexQuery = QueryBuilder
    .forTable('users', { dialect: 'postgres', logging: true })
    .select([
      'users.id',
      'users.name',
      'users.email',
      'profiles.bio',
      'COUNT(posts.id) as post_count'
    ])
    .join('profiles', {
      $on: { 'users.id': 'profiles.user_id' }
    })
    .join('posts', {
      $on: { 'users.id': 'posts.author_id' }
    })
    .where({
      $and: [
        { 'users.status': 'active' },
        { 
          $or: [
            { 'users.age': { $gte: 18 } },
            { 'profiles.verified': true }
          ]
        }
      ],
      'posts.published_at': { $gte: new Date('2023-01-01') }
    })
    .groupBy(['users.id', 'users.name', 'users.email', 'profiles.bio'])
    .orderBy({ 
      'post_count': 'DESC',
      'users.name': 'ASC'
    })
    .paginate({ page: 1, limit: 20, countTotal: true })
    .build();

  console.log('Complex SELECT:', complexQuery);

  // INSERT query
  const insertQuery = QueryBuilder
    .forTable('users')
    .insert({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      status: 'active'
    })
    .build();

  console.log('INSERT:', insertQuery);

  // UPDATE query
  const updateQuery = QueryBuilder
    .forTable('users')
    .update(
      { 
        name: 'Jane Doe',
        status: 'inactive'
      },
      { 
        id: 123,
        status: 'active'
      }
    )
    .build();

  console.log('UPDATE:', updateQuery);

  // DELETE query (soft delete if enabled)
  const deleteQuery = QueryBuilder
    .forTable('users', { softDelete: true })
    .delete({ id: 123 })
    .build();

  console.log('DELETE:', deleteQuery);

  // Batch INSERT
  const batchInsertQuery = QueryBuilder
    .forTable('users')
    .insert([
      {
        name: 'User 1',
        email: 'user1@example.com',
        status: 'active'
      },
      {
        name: 'User 2',
        email: 'user2@example.com',
        status: 'active'
      }
    ])
    .build();

  console.log('Batch INSERT:', batchInsertQuery);
}

queryBuilderDemo();

// ## 4. Service Layer with Destructuring Patterns

// Advanced service layer with comprehensive destructuring patterns
class BaseService {
  constructor(options = {}) {
    const {
      repository,
      cache,
      logger = console,
      validation = true,
      transformation = true,
      ...serviceOptions
    } = options;

    this.repository = repository;
    this.cache = cache;
    this.logger = logger;
    this.options = {
      validation,
      transformation,
      ...serviceOptions
    };

    this.validators = new Map();
    this.transformers = new Map();
    this.hooks = {
      before: new Map(),
      after: new Map(),
      error: new Map()
    };
  }

  // Generic find method with destructuring
  async find(options = {}) {
    const {
      where = {},
      include = [],
      order = [],
      limit,
      offset,
      page = 1,
      perPage = 10,
      cache: useCache = true,
      ...queryOptions
    } = options;

    const cacheKey = this._generateCacheKey('find', options);

    try {
      // Check cache first
      if (useCache && this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug('Cache hit for find operation');
          return cached;
        }
      }

      // Execute before hooks
      await this._executeHooks('before', 'find', { options });

      // Build query with destructured options
      const query = {
        where: this._transformWhere(where),
        include,
        order,
        ...(limit !== undefined && { limit }),
        ...(offset !== undefined && { offset }),
        ...(page && perPage && {
          limit: perPage,
          offset: (page - 1) * perPage
        }),
        ...queryOptions
      };

      // Execute query
      const results = await this.repository.find(query);

      // Transform results
      const transformedResults = this.options.transformation 
        ? await this._transformResults(results, 'find')
        : results;

      // Prepare response with metadata
      const response = {
        data: transformedResults,
        meta: {
          page: page || 1,
          perPage: perPage || (limit || 10),
          ...(page && perPage && {
            total: await this._getTotalCount(where),
            totalPages: Math.ceil((await this._getTotalCount(where)) / perPage)
          })
        }
      };

      // Cache the results
      if (useCache && this.cache) {
        await this.cache.set(cacheKey, response, 300); // 5 minutes
      }

      // Execute after hooks
      await this._executeHooks('after', 'find', { options, results: response });

      return response;

    } catch (error) {
      // Execute error hooks
      await this._executeHooks('error', 'find', { options, error });
      throw error;
    }
  }

  // Generic findById method
  async findById(id, options = {}) {
    const {
      include = [],
      cache: useCache = true,
      ...findOptions
    } = options;

    const cacheKey = this._generateCacheKey('findById', { id, ...options });

    try {
      if (useCache && this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug('Cache hit for findById operation');
          return cached;
        }
      }

      await this._executeHooks('before', 'findById', { id, options });

      const entity = await this.repository.findById(id, {
        include,
        ...findOptions
      });

      if (!entity) {
        throw new Error('Entity not found');
      }

      const transformedEntity = this.options.transformation
        ? await this._transformEntity(entity, 'findById')
        : entity;

      if (useCache && this.cache) {
        await this.cache.set(cacheKey, transformedEntity, 300);
      }

      await this._executeHooks('after', 'findById', { id, options, result: transformedEntity });

      return transformedEntity;

    } catch (error) {
      await this._executeHooks('error', 'findById', { id, options, error });
      throw error;
    }
  }

  // Generic create method
  async create(data, options = {}) {
    const {
      validate = true,
      transform = true,
      bypassHooks = false,
      ...createOptions
    } = options;

    try {
      if (!bypassHooks) {
        await this._executeHooks('before', 'create', { data, options });
      }

      // Validate input
      if (validate && this.options.validation) {
        await this._validateData(data, 'create');
      }

      // Transform input
      const transformedData = transform && this.options.transformation
        ? await this._transformInput(data, 'create')
        : data;

      // Create entity
      const entity = await this.repository.create(transformedData, createOptions);

      // Transform output
      const result = transform && this.options.transformation
        ? await this._transformEntity(entity, 'create')
        : entity;

      // Invalidate relevant cache
      await this._invalidateCache('create', result);

      if (!bypassHooks) {
        await this._executeHooks('after', 'create', { data, options, result });
      }

      return result;

    } catch (error) {
      await this._executeHooks('error', 'create', { data, options, error });
      throw error;
    }
  }

  // Generic update method
  async update(id, data, options = {}) {
    const {
      where = {},
      validate = true,
      transform = true,
      ...updateOptions
    } = options;

    try {
      await this._executeHooks('before', 'update', { id, data, options });

      // Validate input
      if (validate && this.options.validation) {
        await this._validateData(data, 'update');
      }

      // Transform input
      const transformedData = transform && this.options.transformation
        ? await this._transformInput(data, 'update')
        : data;

      // Build update conditions
      const conditions = { id, ...where };

      // Update entity
      const entity = await this.repository.update(conditions, transformedData, updateOptions);

      if (!entity) {
        throw new Error('Entity not found');
      }

      // Transform output
      const result = transform && this.options.transformation
        ? await this._transformEntity(entity, 'update')
        : entity;

      // Invalidate cache
      await this._invalidateCache('update', result);

      await this._executeHooks('after', 'update', { id, data, options, result });

      return result;

    } catch (error) {
      await this._executeHooks('error', 'update', { id, data, options, error });
      throw error;
    }
  }

  // Generic delete method
  async delete(id, options = {}) {
    const {
      where = {},
      softDelete = true,
      ...deleteOptions
    } = options;

    try {
      await this._executeHooks('before', 'delete', { id, options });

      const conditions = { id, ...where };

      const result = softDelete
        ? await this.repository.update(conditions, { deletedAt: new Date() }, deleteOptions)
        : await this.repository.delete(conditions, deleteOptions);

      if (!result) {
        throw new Error('Entity not found');
      }

      // Invalidate cache
      await this._invalidateCache('delete', { id });

      await this._executeHooks('after', 'delete', { id, options, result });

      return result;

    } catch (error) {
      await this._executeHooks('error', 'delete', { id, options, error });
      throw error;
    }
  }

  // Add validator for specific operation
  addValidator(operation, validator) {
    if (!this.validators.has(operation)) {
      this.validators.set(operation, []);
    }
    this.validators.get(operation).push(validator);
    return this;
  }

  // Add transformer for specific operation and direction
  addTransformer(operation, direction, transformer) {
    const key = `${operation}:${direction}`;
    if (!this.transformers.has(key)) {
      this.transformers.set(key, []);
    }
    this.transformers.get(key).push(transformer);
    return this;
  }

  // Add hook for specific operation and timing
  addHook(operation, timing, hook) {
    const key = `${operation}:${timing}`;
    if (!this.hooks[timing].has(key)) {
      this.hooks[timing].set(key, []);
    }
    this.hooks[timing].get(key).push(hook);
    return this;
  }

  // Private methods
  async _validateData(data, operation) {
    const validators = this.validators.get(operation) || [];
    
    for (const validator of validators) {
      await validator(data);
    }
  }

  async _transformInput(data, operation) {
    const transformers = this.transformers.get(`${operation}:input`) || [];
    let transformed = data;

    for (const transformer of transformers) {
      transformed = await transformer(transformed);
    }

    return transformed;
  }

  async _transformEntity(entity, operation) {
    const transformers = this.transformers.get(`${operation}:output`) || [];
    let transformed = entity;

    for (const transformer of transformers) {
      transformed = await transformer(transformed);
    }

    return transformed;
  }

  async _transformResults(results, operation) {
    if (Array.isArray(results)) {
      return Promise.all(results.map(entity => this._transformEntity(entity, operation)));
    }
    return this._transformEntity(results, operation);
  }

  async _executeHooks(timing, operation, context) {
    const hooks = this.hooks[timing].get(`${operation}:${timing}`) || [];
    
    for (const hook of hooks) {
      await hook(context);
    }
  }

  async _getTotalCount(where) {
    return await this.repository.count({ where });
  }

  _transformWhere(where) {
    // Transform where conditions for the repository
    if (typeof where === 'object' && where !== null) {
      const transformed = { ...where };
      
      // Handle date ranges
      if (where.createdAt) {
        const { $gte, $lte, ...dateRest } = where.createdAt;
        if ($gte || $lte) {
          transformed.createdAt = {
            ...($gte && { $gte: new Date($gte) }),
            ...($lte && { $lte: new Date($lte) }),
            ...dateRest
          };
        }
      }

      return transformed;
    }

    return where;
  }

  _generateCacheKey(operation, params) {
    const paramString = JSON.stringify(params);
    return `${this.constructor.name.toLowerCase()}:${operation}:${Buffer.from(paramString).toString('base64')}`;
  }

  async _invalidateCache(operation, result) {
    if (!this.cache) return;

    const patterns = [
      `${this.constructor.name.toLowerCase()}:find:*`,
      `${this.constructor.name.toLowerCase()}:findById:*`
    ];

    if (operation === 'create' || operation === 'update') {
      const id = result.id || result._id;
      if (id) {
        patterns.push(`${this.constructor.name.toLowerCase()}:findById:${JSON.stringify({ id })}`);
      }
    }

    if (operation === 'delete') {
      const id = result.id || result;
      if (id) {
        patterns.push(`${this.constructor.name.toLowerCase()}:findById:${JSON.stringify({ id })}`);
      }
    }

    // Invalidate matching cache keys
    for (const pattern of patterns) {
      await this.cache.delPattern?.(pattern);
    }
  }
}

// User Service implementation with destructuring patterns
class UserService extends BaseService {
  constructor(options = {}) {
    const {
      authService,
      emailService,
      fileService,
      ...serviceOptions
    } = options;

    super(serviceOptions);

    this.authService = authService;
    this.emailService = emailService;
    this.fileService = fileService;

    this._setupValidators();
    this._setupTransformers();
    this._setupHooks();
  }

  _setupValidators() {
    // Create user validator
    this.addValidator('create', async (data) => {
      const { name, email, password, profile = {} } = data;

      if (!name || name.length < 2) {
        throw new Error('Name must be at least 2 characters long');
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Valid email is required');
      }

      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Check if email already exists
      const existingUser = await this.repository.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('Email already exists');
      }
    });

    // Update user validator
    this.addValidator('update', async (data) => {
      const { email, password, ...rest } = data;

      if (email) {
        throw new Error('Email cannot be changed');
      }

      if (password && password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
    });
  }

  _setupTransformers() {
    // Input transformation for create
    this.addTransformer('create', 'input', async (data) => {
      const { password, profile, preferences = {}, ...rest } = data;

      const transformed = {
        ...rest,
        ...(password && { password: await this.authService.hashPassword(password) }),
        ...(profile && { profile: this._transformProfile(profile) }),
        preferences: {
          notifications: true,
          theme: 'light',
          ...preferences
        },
        status: 'active',
        emailVerified: false
      };

      return transformed;
    });

    // Output transformation for all operations
    this.addTransformer('findById', 'output', (user) => this._sanitizeUser(user));
    this.addTransformer('find', 'output', (users) => 
      Array.isArray(users) ? users.map(user => this._sanitizeUser(user)) : this._sanitizeUser(users)
    );
    this.addTransformer('create', 'output', (user) => this._sanitizeUser(user));
    this.addTransformer('update', 'output', (user) => this._sanitizeUser(user));
  }

  _setupHooks() {
    // After create hook - send welcome email
    this.addHook('create', 'after', async ({ result }) => {
      try {
        const { email, name } = result;
        await this.emailService.sendWelcomeEmail(email, name);
      } catch (error) {
        this.logger.error('Failed to send welcome email:', error);
      }
    });

    // Before update hook - track changes
    this.addHook('update', 'before', async ({ id, data }) => {
      const oldUser = await this.repository.findById(id);
      this.logger.info('User update', {
        userId: id,
        changes: Object.keys(data),
        oldData: this._sanitizeUser(oldUser)
      });
    });

    // After update hook - invalidate sessions if password changed
    this.addHook('update', 'after', async ({ id, data, result }) => {
      if (data.password) {
        await this.authService.invalidateUserSessions(id);
      }
    });
  }

  // Custom service methods with advanced destructuring
  async register(userData, options = {}) {
    const {
      sendWelcomeEmail = true,
      verifyEmail = false,
      ...registerOptions
    } = options;

    // Extract and transform registration data
    const {
      password,
      confirmPassword,
      acceptTerms,
      ...registrationData
    } = userData;

    // Validate registration-specific rules
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (!acceptTerms) {
      throw new Error('Must accept terms and conditions');
    }

    // Create user with registration options
    const user = await this.create(
      { ...registrationData, password },
      {
        ...registerOptions,
        bypassHooks: !sendWelcomeEmail
      }
    );

    // Generate email verification token if needed
    if (verifyEmail) {
      const verificationToken = await this.authService.generateVerificationToken(user.id);
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    }

    return user;
  }

  async updateProfile(userId, profileData, options = {}) {
    const {
      uploadAvatar = false,
      ...updateOptions
    } = options;

    const {
      avatar,
      socialLinks = {},
      ...profileUpdates
    } = profileData;

    let avatarUrl = null;

    // Handle avatar upload
    if (uploadAvatar && avatar) {
      const { filename, mimetype, buffer } = avatar;
      avatarUrl = await this.fileService.uploadUserAvatar(userId, {
        filename,
        mimetype,
        buffer
      });
    }

    // Update user profile
    const updatedUser = await this.update(
      userId,
      {
        profile: {
          ...profileUpdates,
          ...(avatarUrl && { avatar: avatarUrl }),
          socialLinks: this._transformSocialLinks(socialLinks)
        }
      },
      updateOptions
    );

    return updatedUser;
  }

  async searchUsers(criteria, options = {}) {
    const {
      query,
      filters = {},
      sort = 'relevance',
      ...searchOptions
    } = options;

    const {
      status = 'active',
      role,
      location,
      skills = [],
      ...otherFilters
    } = filters;

    // Build search conditions
    const where = {
      status,
      ...(role && { role }),
      ...(location && { 'profile.location': { $regex: location, $options: 'i' } }),
      ...(skills.length > 0 && { 'profile.skills': { $in: skills } }),
      ...otherFilters
    };

    // Add text search if query provided
    if (query) {
      where.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { 'profile.bio': { $regex: query, $options: 'i' } }
      ];
    }

    // Build sort options
    const order = this._buildSearchSort(sort, query);

    return await this.find({
      where,
      order,
      ...searchOptions
    });
  }

  async bulkUpdateUsers(userIds, updates, options = {}) {
    const {
      validate = true,
      notifyUsers = false,
      ...bulkOptions
    } = options;

    const {
      status,
      role,
      metadata = {},
      ...otherUpdates
    } = updates;

    // Validate bulk update
    if (validate) {
      await this._validateBulkUpdate(updates, userIds);
    }

    // Perform bulk update
    const results = await Promise.allSettled(
      userIds.map(userId => 
        this.update(userId, updates, { ...bulkOptions, validate: false })
      )
    );

    // Process results
    const { successful, failed } = results.reduce((acc, result, index) => {
      if (result.status === 'fulfilled') {
        acc.successful.push({
          userId: userIds[index],
          user: result.value
        });
      } else {
        acc.failed.push({
          userId: userIds[index],
          error: result.reason.message
        });
      }
      return acc;
    }, { successful: [], failed: [] });

    // Notify users if requested
    if (notifyUsers && successful.length > 0) {
      await this._notifyUsersOfBulkUpdate(successful, updates);
    }

    return {
      successful,
      failed,
      total: userIds.length,
      successfulCount: successful.length,
      failedCount: failed.length
    };
  }

  // Private helper methods
  _sanitizeUser(user) {
    if (!user) return user;

    const {
      password,
      resetToken,
      verificationToken,
      ...sanitized
    } = user;

    return sanitized;
  }

  _transformProfile(profile) {
    const {
      avatar,
      socialLinks = {},
      ...profileRest
    } = profile;

    return {
      ...profileRest,
      ...(avatar && { avatar: this._processAvatarUrl(avatar) }),
      socialLinks: this._transformSocialLinks(socialLinks),
      updatedAt: new Date()
    };
  }

  _transformSocialLinks(links) {
    const allowedPlatforms = ['github', 'twitter', 'linkedin', 'website'];
    const transformed = {};

    Object.entries(links).forEach(([platform, url]) => {
      if (allowedPlatforms.includes(platform.toLowerCase()) && url) {
        transformed[platform.toLowerCase()] = url;
      }
    });

    return transformed;
  }

  _processAvatarUrl(avatar) {
    if (typeof avatar === 'string') {
      return avatar.startsWith('http') ? avatar : `/uploads/avatars/${avatar}`;
    }
    return avatar;
  }

  _buildSearchSort(sort, query) {
    switch (sort) {
      case 'relevance':
        return query ? [{ $text: { $score: { $meta: 'textScore' } } }] : [{ createdAt: -1 }];
      case 'newest':
        return [{ createdAt: -1 }];
      case 'oldest':
        return [{ createdAt: 1 }];
      case 'name':
        return [{ name: 1 }];
      default:
        return [{ createdAt: -1 }];
    }
  }

  async _validateBulkUpdate(updates, userIds) {
    const { role, status } = updates;

    // Check if user has permission to assign roles
    if (role) {
      const allowedRoles = ['user', 'moderator'];
      if (!allowedRoles.includes(role)) {
        throw new Error(`Cannot assign role: ${role}`);
      }
    }

    // Check if user has permission to set status
    if (status && !['active', 'suspended', 'inactive'].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Check if any users don't exist
    const existingUsers = await this.repository.find({
      where: { id: { $in: userIds } },
      select: ['id']
    });

    const existingIds = existingUsers.map(user => user.id);
    const missingIds = userIds.filter(id => !existingIds.includes(id));

    if (missingIds.length > 0) {
      throw new Error(`Users not found: ${missingIds.join(', ')}`);
    }
  }

  async _notifyUsersOfBulkUpdate(successfulUpdates, updates) {
    const { role, status, ...otherUpdates } = updates;
    const notificationPromises = successfulUpdates.map(({ userId, user }) => {
      const notification = {
        userId,
        type: 'profile_updated',
        data: {
          changes: Object.keys(updates),
          ...(role && { newRole: role }),
          ...(status && { newStatus: status })
        }
      };
      return this.emailService.sendNotification(user.email, notification);
    });

    await Promise.allSettled(notificationPromises);
  }
}

// Mock implementations for demonstration
const mockServices = {
  authService: {
    async hashPassword(password) {
      return `hashed_${password}`;
    },
    async generateVerificationToken(userId) {
      return `verify_${userId}_${Date.now()}`;
    },
    async invalidateUserSessions(userId) {
      console.log(`Invalidated sessions for user: ${userId}`);
    }
  },
  emailService: {
    async sendWelcomeEmail(email, name) {
      console.log(`Sent welcome email to ${email} for ${name}`);
    },
    async sendVerificationEmail(email, token) {
      console.log(`Sent verification email to ${email} with token: ${token}`);
    },
    async sendNotification(email, notification) {
      console.log(`Sent notification to ${email}:`, notification);
    }
  },
  fileService: {
    async uploadUserAvatar(userId, file) {
      return `/uploads/avatars/${userId}/${file.filename}`;
    }
  },
  repository: {
    async find(options) {
      return [{ id: 1, name: 'Test User', email: 'test@example.com' }];
    },
    async findById(id, options) {
      return { id, name: 'Test User', email: 'test@example.com' };
    },
    async findOne(options) {
      return null;
    },
    async create(data) {
      return { id: 1, ...data, createdAt: new Date() };
    },
    async update(conditions, data, options) {
      return { ...conditions, ...data, updatedAt: new Date() };
    },
    async delete(conditions, options) {
      return { ...conditions, deletedAt: new Date() };
    },
    async count(options) {
      return 1;
    }
  },
  cache: {
    async get(key) {
      return null;
    },
    async set(key, value, ttl) {
      console.log(`Cached ${key} for ${ttl} seconds`);
    },
    async delPattern(pattern) {
      console.log(`Invalidated cache pattern: ${pattern}`);
    }
  }
};

// Usage demonstration
async function serviceDestructuringDemo() {
  console.log('=== Service Destructuring Demo ===');

  const userService = new UserService({
    repository: mockServices.repository,
    authService: mockServices.authService,
    emailService: mockServices.emailService,
    fileService: mockServices.fileService,
    cache: mockServices.cache,
    logger: console,
    validation: true,
    transformation: true
  });

  // Test user registration
  try {
    const newUser = await userService.register({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123',
      acceptTerms: true,
      profile: {
        bio: 'Software developer',
        location: 'New York'
      }
    }, {
      sendWelcomeEmail: true,
      verifyEmail: true
    });

    console.log('Registered user:', newUser);
  } catch (error) {
    console.error('Registration error:', error.message);
  }

  // Test profile update
  try {
    const updatedUser = await userService.updateProfile(1, {
      bio: 'Senior software developer',
      socialLinks: {
        github: 'https://github.com/johndoe',
        twitter: 'https://twitter.com/johndoe'
      }
    }, {
      uploadAvatar: false
    });

    console.log('Updated user profile:', updatedUser);
  } catch (error) {
    console.error('Profile update error:', error.message);
  }

  // Test user search
  const searchResults = await userService.searchUsers(
    { status: 'active' },
    {
      query: 'john',
      filters: {
        role: 'user',
        skills: ['javascript', 'nodejs']
      },
      sort: 'relevance',
      page: 1,
      perPage: 10
    }
  );

  console.log('Search results:', searchResults);

  // Test bulk update
  const bulkResults = await userService.bulkUpdateUsers(
    [1, 2, 3],
    {
      status: 'active',
      role: 'user',
      metadata: { bulkUpdate: true }
    },
    {
      notifyUsers: true,
      validate: true
    }
  );

  console.log('Bulk update results:', bulkResults);
}

serviceDestructuringDemo();

// ## 5. Error Handling and Utility Functions with Destructuring

// Advanced error handling and utility functions with destructuring
class ErrorHandler {
  constructor(options = {}) {
    const {
      environment = process.env.NODE_ENV || 'development',
      logLevel = 'error',
      includeStack = environment !== 'production',
      notifyAdmins = false,
      ...handlerOptions
    } = options;

    this.options = {
      environment,
      logLevel,
      includeStack,
      notifyAdmins,
      ...handlerOptions
    };

    this.logger = this._createLogger();
    this.notifier = this._createNotifier();
  }

  // Main error handling method with comprehensive destructuring
  handleError(error, context = {}) {
    const {
      message,
      stack,
      statusCode = 500,
      code,
      details = {},
      cause,
      ...errorRest
    } = error;

    const {
      requestId,
      userId,
      operation,
      metadata = {},
      ...contextRest
    } = context;

    // Create error report with destructuring
    const errorReport = {
      // Error information
      error: {
        message,
        code,
        statusCode,
        details,
        ...(this.options.includeStack && { stack }),
        ...(cause && { cause: this._extractErrorInfo(cause) }),
        ...errorRest
      },
      
      // Context information
      context: {
        requestId,
        userId,
        operation,
        timestamp: new Date().toISOString(),
        environment: this.options.environment,
        ...metadata,
        ...contextRest
      },
      
      // System information
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Log the error
    this._logError(errorReport);

    // Notify admins if configured
    if (this.options.notifyAdmins && this._shouldNotify(errorReport)) {
      this._notifyAdmins(errorReport);
    }

    // Return client-friendly error
    return this._createClientError(errorReport);
  }

  // Async error handler for promises
  async handleAsyncError(promise, context = {}) {
    try {
      const result = await promise;
      return { success: true, data: result };
    } catch (error) {
      const handledError = this.handleError(error, context);
      return { success: false, error: handledError };
    }
  }

  // Error boundary for Express.js middleware
  expressMiddleware() {
    return (error, req, res, next) => {
      // Destructure request for context
      const {
        method,
        url,
        headers,
        params,
        query,
        body,
        user,
        ip,
        ...requestRest
      } = req;

      const context = {
        requestId: headers['x-request-id'],
        userId: user?.id,
        operation: `${method} ${url}`,
        metadata: {
          method,
          url,
          headers: this._sanitizeHeaders(headers),
          params,
          query,
          body: this._sanitizeBody(body),
          ip,
          ...requestRest
        }
      };

      const clientError = this.handleError(error, context);

      res.status(clientError.statusCode).json(clientError);
    };
  }

  // Create custom error with destructuring
  createError(type, options = {}) {
    const {
      message,
      statusCode,
      code,
      details = {},
      cause,
      ...errorOptions
    } = options;

    const error = new Error(message);
    
    // Set error properties using destructuring
    Object.assign(error, {
      statusCode,
      code: code || type.toUpperCase(),
      details,
      cause,
      timestamp: new Date(),
      ...errorOptions
    });

    // Capture stack trace
    Error.captureStackTrace(error, this.createError);

    return error;
  }

  // Common error types with destructuring patterns
  createValidationError(fieldErrors, options = {}) {
    const {
      message = 'Validation failed',
      ...errorOptions
    } = options;

    return this.createError('VALIDATION_ERROR', {
      message,
      statusCode: 400,
      details: { fields: fieldErrors },
      ...errorOptions
    });
  }

  createAuthError(message = 'Authentication required', options = {}) {
    return this.createError('AUTHENTICATION_ERROR', {
      message,
      statusCode: 401,
      ...options
    });
  }

  createPermissionError(message = 'Insufficient permissions', options = {}) {
    return this.createError('PERMISSION_ERROR', {
      message,
      statusCode: 403,
      ...options
    });
  }

  createNotFoundError(resource, options = {}) {
    const {
      message = `${resource || 'Resource'} not found`,
      ...errorOptions
    } = options;

    return this.createError('NOT_FOUND', {
      message,
      statusCode: 404,
      ...errorOptions
    });
  }

  createConflictError(message = 'Resource conflict', options = {}) {
    return this.createError('CONFLICT', {
      message,
      statusCode: 409,
      ...options
    });
  }

  createRateLimitError(options = {}) {
    const {
      message = 'Rate limit exceeded',
      retryAfter,
      ...errorOptions
    } = options;

    return this.createError('RATE_LIMIT', {
      message,
      statusCode: 429,
      ...(retryAfter && { headers: { 'Retry-After': retryAfter } }),
      ...errorOptions
    });
  }

  // Utility functions with destructuring
  sanitizeErrorForLogging(error) {
    const {
      stack,
      cause,
      ...sanitizedError
    } = error;

    return {
      ...sanitizedError,
      ...(cause && { cause: this.sanitizeErrorForLogging(cause) })
    };
  }

  extractErrorInfo(error) {
    if (!error) return null;

    const {
      message,
      stack,
      code,
      statusCode,
      details,
      cause,
      ...rest
    } = error;

    return {
      message,
      code,
      statusCode,
      details,
      ...(cause && { cause: this.extractErrorInfo(cause) }),
      ...rest
    };
  }

  // Private methods
  _createLogger() {
    const { logLevel, environment } = this.options;

    return {
      error: (message, meta) => {
        console.error(`[ERROR] ${message}`, meta);
      },
      warn: (message, meta) => {
        if (['warn', 'info', 'debug'].includes(logLevel)) {
          console.warn(`[WARN] ${message}`, meta);
        }
      },
      info: (message, meta) => {
        if (['info', 'debug'].includes(logLevel)) {
          console.info(`[INFO] ${message}`, meta);
        }
      },
      debug: (message, meta) => {
        if (logLevel === 'debug') {
          console.debug(`[DEBUG] ${message}`, meta);
        }
      }
    };
  }

  _createNotifier() {
    return {
      notify: async (errorReport) => {
        // In production, this would send to Slack, Email, etc.
        console.log('ADMIN NOTIFICATION:', errorReport);
      }
    };
  }

  _logError(errorReport) {
    const {
      error: { message, code, statusCode },
      context: { requestId, userId, operation },
      ...reportRest
    } = errorReport;

    const logData = {
      code,
      statusCode,
      requestId,
      userId,
      operation,
      ...reportRest
    };

    // Log based on status code
    if (statusCode >= 500) {
      this.logger.error(message, logData);
    } else if (statusCode >= 400) {
      this.logger.warn(message, logData);
    } else {
      this.logger.info(message, logData);
    }
  }

  _shouldNotify(errorReport) {
    const {
      error: { statusCode },
      context: { environment }
    } = errorReport;

    // Only notify for server errors in production
    return statusCode >= 500 && environment === 'production';
  }

  _notifyAdmins(errorReport) {
    const sanitizedReport = this._sanitizeErrorReport(errorReport);
    this.notifier.notify(sanitizedReport);
  }

  _createClientError(errorReport) {
    const {
      error: { message, code, statusCode, details },
      context: { requestId, environment },
      ...reportRest
    } = errorReport;

    const clientError = {
      success: false,
      error: {
        message: this._getClientMessage(message, statusCode),
        code,
        ...(environment === 'development' && { details }),
        ...(environment === 'development' && { originalMessage: message })
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        ...(environment === 'development' && { debug: reportRest })
      }
    };

    return clientError;
  }

  _extractErrorInfo(error) {
    if (!error) return null;

    const {
      message,
      code,
      statusCode,
      details,
      cause,
      ...rest
    } = error;

    return {
      message,
      code,
      statusCode,
      details,
      ...(cause && { cause: this._extractErrorInfo(cause) }),
      ...rest
    };
  }

  _sanitizeHeaders(headers) {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '***';
      }
    });

    return sanitized;
  }

  _sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'creditCard'];
    const sanitized = { ...body };

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    return sanitized;
  }

  _sanitizeErrorReport(errorReport) {
    const {
      context: { metadata, ...contextRest },
      ...reportRest
    } = errorReport;

    return {
      ...reportRest,
      context: {
        ...contextRest,
        metadata: {
          ...metadata,
          headers: this._sanitizeHeaders(metadata.headers || {}),
          body: this._sanitizeBody(metadata.body || {})
        }
      }
    };
  }

  _getClientMessage(message, statusCode) {
    if (statusCode >= 500) {
      return 'Internal server error';
    }
    return message;
  }
}

// Utility functions with advanced destructuring
const ObjectUtils = {
  // Deep merge with destructuring
  deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key] || !this.isObject(target[key])) {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    return this.deepMerge(target, ...sources);
  },

  // Pick properties with nested support
  pick(obj, paths) {
    const result = {};

    paths.forEach(path => {
      const keys = path.split('.');
      let current = obj;
      let currentResult = result;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        
        if (current && key in current) {
          if (i === keys.length - 1) {
            currentResult[key] = current[key];
          } else {
            if (!currentResult[key]) {
              currentResult[key] = {};
            }
            currentResult = currentResult[key];
            current = current[key];
          }
        } else {
          break;
        }
      }
    });

    return result;
  },

  // Omit properties with nested support
  omit(obj, paths) {
    const result = { ...obj };
    
    paths.forEach(path => {
      const keys = path.split('.');
      let current = result;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        
        if (i === keys.length - 1) {
          delete current[key];
        } else if (current[key] && typeof current[key] === 'object') {
          current = current[key];
        } else {
          break;
        }
      }
    });

    return result;
  },

  // Get nested property with default
  get(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return defaultValue;
      }
    }

    return result;
  },

  // Set nested property
  set(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return obj;
  },

  // Transform object properties
  transform(obj, transformer) {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const { [key]: transformedKey, [value]: transformedValue } = transformer(key, value);
      result[transformedKey] = transformedValue;
    }

    return result;
  },

  // Flatten object
  flatten(obj, prefix = '', separator = '.') {
    return Object.keys(obj).reduce((acc, key) => {
      const pre = prefix.length ? prefix + separator : '';
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(acc, this.flatten(obj[key], pre + key, separator));
      } else {
        acc[pre + key] = obj[key];
      }
      
      return acc;
    }, {});
  },

  // Check if value is an object
  isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
};

// Usage demonstration
function errorHandlingDemo() {
  console.log('=== Error Handling Demo ===');

  const errorHandler = new ErrorHandler({
    environment: 'development',
    logLevel: 'debug',
    notifyAdmins: true
  });

  // Test custom error creation
  const validationError = errorHandler.createValidationError({
    email: 'Invalid email format',
    password: 'Password too short'
  }, {
    message: 'User input validation failed',
    operation: 'user_registration'
  });

  console.log('Validation error:', validationError);

  // Test error handling
  const handledError = errorHandler.handleError(validationError, {
    requestId: 'req_123',
    userId: 'user_456',
    operation: 'CREATE_USER',
    metadata: {
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0'
    }
  });

  console.log('Handled error:', handledError);

  // Test async error handling
  async function testAsyncOperation() {
    const result = await errorHandler.handleAsyncError(
      Promise.reject(new Error('Async operation failed')),
      { operation: 'ASYNC_TEST' }
    );
    
    console.log('Async result:', result);
  }

  testAsyncOperation();

  // Test object utilities
  const testObj = {
    user: {
      profile: {
        name: 'John',
        email: 'john@example.com',
        settings: {
          theme: 'dark',
          notifications: true
        }
      },
      preferences: {
        language: 'en'
      }
    },
    metadata: {
      createdAt: new Date()
    }
  };

  console.log('Picked properties:', ObjectUtils.pick(testObj, [
    'user.profile.name',
    'user.profile.settings.theme',
    'metadata.createdAt'
  ]));

  console.log('Flattened object:', ObjectUtils.flatten(testObj));

  // Test Express middleware
  const expressMiddleware = errorHandler.expressMiddleware();
  console.log('Express middleware created:', typeof expressMiddleware);
}

errorHandlingDemo();

// These comprehensive code snippets demonstrate object destructuring in Node.js production-grade backend development across:

// 1. **Configuration Management** - Deep destructuring with defaults and validation
// 2. **API Request/Response Handling** - Comprehensive request context destructuring
// 3. **Database Query Building** - Advanced query construction with nested destructuring
// 4. **Service Layer Patterns** - Complex business logic with transformation and validation
// 5. **Error Handling & Utilities** - Robust error management and object manipulation utilities

// These patterns enable clean, maintainable, and scalable code while leveraging JavaScript's destructuring capabilities to their fullest potential in production environments.



































// Here are comprehensive code snippets covering JavaScript object's own properties and enumerable properties for Node.js production-grade backend development:

// ## 1. Property Management for Configuration Objects

// Advanced configuration management with property control
class SecureConfig {
  constructor(config = {}) {
    // Use null prototype to avoid prototype pollution
    this._data = Object.create(null);
    this._metadata = new Map();
    this._validators = new Map();
    this._sensitiveFields = new Set(['password', 'secret', 'token', 'apiKey']);
    
    // Define internal properties with specific attributes
    Object.defineProperties(this, {
      '_data': {
        value: this._data,
        writable: false,
        enumerable: false,
        configurable: false
      },
      '_metadata': {
        value: this._metadata,
        writable: false,
        enumerable: false,
        configurable: false
      },
      '_validators': {
        value: this._validators,
        writable: false,
        enumerable: false,
        configurable: false
      },
      '_sensitiveFields': {
        value: this._sensitiveFields,
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
    
    this._initialize(config);
  }
  
  _initialize(config) {
    // Only copy own enumerable properties
    const ownEnumerableProps = Object.keys(config).filter(key => {
      const descriptor = Object.getOwnPropertyDescriptor(config, key);
      return descriptor.enumerable;
    });
    
    ownEnumerableProps.forEach(key => {
      this.set(key, config[key]);
    });
    
    // Seal the instance to prevent new properties
    Object.seal(this);
  }
  
  set(key, value, options = {}) {
    const {
      enumerable = true,
      writable = true,
      configurable = false,
      sensitive = this._sensitiveFields.has(key),
      validator = null
    } = options;
    
    // Validate if validator exists
    if (validator && !validator(value)) {
      throw new Error(`Validation failed for property: ${key}`);
    }
    
    // Store metadata
    this._metadata.set(key, {
      enumerable,
      writable,
      configurable,
      sensitive,
      lastModified: new Date(),
      modifiedBy: 'system'
    });
    
    // Define property with specific attributes
    Object.defineProperty(this, key, {
      get: () => {
        const meta = this._metadata.get(key);
        if (meta && meta.sensitive) {
          return '***REDACTED***';
        }
        return this._data[key];
      },
      set: (newValue) => {
        const meta = this._metadata.get(key);
        if (meta && !meta.writable) {
          throw new Error(`Property ${key} is read-only`);
        }
        
        if (meta && meta.sensitive) {
          throw new Error(`Cannot directly set sensitive property: ${key}`);
        }
        
        // Run validation
        const validator = this._validators.get(key);
        if (validator && !validator(newValue)) {
          throw new Error(`Validation failed for property: ${key}`);
        }
        
        this._data[key] = newValue;
        meta.lastModified = new Date();
      },
      enumerable: enumerable,
      configurable: configurable
    });
    
    // Set initial value
    this._data[key] = value;
    
    return this;
  }
  
  // Get all own enumerable properties
  getOwnEnumerableProperties() {
    return Object.getOwnPropertyNames(this).filter(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(this, prop);
      return descriptor.enumerable;
    });
  }
  
  // Get all own properties (including non-enumerable)
  getAllOwnProperties() {
    return Object.getOwnPropertyNames(this);
  }
  
  // Get property descriptors for inspection
  getPropertyDescriptors() {
    const descriptors = {};
    
    this.getAllOwnProperties().forEach(prop => {
      descriptors[prop] = Object.getOwnPropertyDescriptor(this, prop);
    });
    
    return descriptors;
  }
  
  // Check if property is enumerable
  isEnumerable(prop) {
    const descriptor = Object.getOwnPropertyDescriptor(this, prop);
    return descriptor ? descriptor.enumerable : false;
  }
  
  // Check if property is writable
  isWritable(prop) {
    const descriptor = Object.getOwnPropertyDescriptor(this, prop);
    return descriptor ? descriptor.writable : false;
  }
  
  // Make property read-only
  makeReadOnly(prop) {
    if (!this._metadata.has(prop)) {
      throw new Error(`Property ${prop} does not exist`);
    }
    
    const meta = this._metadata.get(prop);
    meta.writable = false;
    
    Object.defineProperty(this, prop, {
      writable: false,
      enumerable: meta.enumerable,
      configurable: meta.configurable
    });
    
    return this;
  }
  
  // Hide property (make non-enumerable)
  hideProperty(prop) {
    if (!this._metadata.has(prop)) {
      throw new Error(`Property ${prop} does not exist`);
    }
    
    const meta = this._metadata.get(prop);
    meta.enumerable = false;
    
    Object.defineProperty(this, prop, {
      enumerable: false,
      writable: meta.writable,
      configurable: meta.configurable
    });
    
    return this;
  }
  
  // Show property (make enumerable)
  showProperty(prop) {
    if (!this._metadata.has(prop)) {
      throw new Error(`Property ${prop} does not exist`);
    }
    
    const meta = this._metadata.get(prop);
    meta.enumerable = true;
    
    Object.defineProperty(this, prop, {
      enumerable: true,
      writable: meta.writable,
      configurable: meta.configurable
    });
    
    return this;
  }
  
  // Add validator for property
  addValidator(key, validatorFn) {
    this._validators.set(key, validatorFn);
    return this;
  }
  
  // Safe serialization for logging (only enumerable, non-sensitive)
  toSafeJSON() {
    const result = {};
    
    this.getOwnEnumerableProperties().forEach(key => {
      const meta = this._metadata.get(key);
      if (meta && meta.sensitive) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = this[key];
      }
    });
    
    return result;
  }
  
  // Get property metadata
  getPropertyMetadata(key) {
    return this._metadata.get(key) || null;
  }
  
  // Static method to create from environment variables
  static fromEnv(prefix = 'APP_') {
    const config = new SecureConfig();
    
    // Only process own enumerable properties of process.env
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        let value = process.env[key];
        
        // Type conversion
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);
        
        config.set(configKey, value, {
          enumerable: true,
          writable: false, // Environment variables are read-only
          configurable: false
        });
      }
    });
    
    return config;
  }
}

// Usage examples
function configPropertyDemo() {
  const config = new SecureConfig();
  
  // Set properties with different attributes
  config.set('databaseHost', 'localhost', {
    enumerable: true,
    writable: true,
    configurable: false,
    validator: (val) => typeof val === 'string' && val.length > 0
  });
  
  config.set('databasePassword', 'secret123', {
    enumerable: false, // Hide sensitive data
    writable: false,
    configurable: false,
    sensitive: true
  });
  
  config.set('apiVersion', 'v1', {
    enumerable: true,
    writable: false, // Read-only
    configurable: false
  });
  
  console.log('Own enumerable properties:', config.getOwnEnumerableProperties());
  console.log('All own properties:', config.getAllOwnProperties());
  console.log('Property descriptors:', config.getPropertyDescriptors());
  
  // Test enumeration
  console.log('JSON.stringify (only enumerable):', JSON.stringify(config));
  console.log('Object.keys (only enumerable):', Object.keys(config));
  
  // Check property attributes
  console.log('Is databaseHost enumerable?', config.isEnumerable('databaseHost'));
  console.log('Is databasePassword enumerable?', config.isEnumerable('databasePassword'));
  console.log('Is apiVersion writable?', config.isWritable('apiVersion'));
  
  // Modify property attributes
  config.hideProperty('databaseHost');
  console.log('After hiding databaseHost - enumerable properties:', config.getOwnEnumerableProperties());
  
  config.showProperty('databasePassword');
  console.log('After showing databasePassword - enumerable properties:', config.getOwnEnumerableProperties());
  
  // Safe serialization
  console.log('Safe JSON:', config.toSafeJSON());
}

configPropertyDemo();

// ## 2. Advanced Property Inspection and Validation

// Comprehensive property inspection and validation utilities
class PropertyInspector {
  static analyzeObject(obj, options = {}) {
    const {
      includePrototype = false,
      includeNonEnumerable = false,
      depth = 3,
      maxProperties = 100,
      ...analysisOptions
    } = options;
    
    const analysis = {
      objectType: this.getObjectType(obj),
      ownProperties: {},
      prototypeChain: [],
      propertyStatistics: {
        total: 0,
        enumerable: 0,
        nonEnumerable: 0,
        writable: 0,
        readOnly: 0,
        configurable: 0,
        nonConfigurable: 0
      },
      securityAnalysis: {
        hasSensitiveData: false,
        exposedProperties: [],
        potentialIssues: []
      }
    };
    
    // Analyze own properties
    const ownPropertyNames = includeNonEnumerable 
      ? Object.getOwnPropertyNames(obj)
      : Object.keys(obj);
    
    analysis.propertyStatistics.total = ownPropertyNames.length;
    
    ownPropertyNames.slice(0, maxProperties).forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      analysis.ownProperties[prop] = this.analyzeProperty(obj, prop, descriptor, depth);
      
      // Update statistics
      if (descriptor.enumerable) analysis.propertyStatistics.enumerable++;
      else analysis.propertyStatistics.nonEnumerable++;
      
      if (descriptor.writable) analysis.propertyStatistics.writable++;
      else analysis.propertyStatistics.readOnly++;
      
      if (descriptor.configurable) analysis.propertyStatistics.configurable++;
      else analysis.propertyStatistics.nonConfigurable++;
      
      // Security analysis
      if (this.isPotentialSensitiveProperty(prop, obj[prop])) {
        analysis.securityAnalysis.hasSensitiveData = true;
        if (descriptor.enumerable) {
          analysis.securityAnalysis.exposedProperties.push(prop);
        }
      }
    });
    
    // Analyze prototype chain if requested
    if (includePrototype) {
      let proto = Object.getPrototypeOf(obj);
      let level = 0;
      
      while (proto && proto !== Object.prototype && level < depth) {
        analysis.prototypeChain.push({
          level,
          constructor: proto.constructor.name,
          properties: Object.getOwnPropertyNames(proto)
        });
        proto = Object.getPrototypeOf(proto);
        level++;
      }
    }
    
    return analysis;
  }
  
  static analyzeProperty(obj, prop, descriptor, depth = 2) {
    const value = obj[prop];
    const analysis = {
      value: this.safeValueInspection(value, depth),
      descriptor: { ...descriptor },
      type: typeof value,
      isPrimitive: this.isPrimitive(value),
      isFunction: typeof value === 'function',
      isObject: typeof value === 'object' && value !== null,
      isArray: Array.isArray(value),
      isDate: value instanceof Date,
      isBuffer: Buffer.isBuffer(value),
      isPromise: value instanceof Promise,
      hasOwnProperties: false,
      propertyCount: 0,
      circularReference: false
    };
    
    // Analyze nested objects
    if (analysis.isObject && !analysis.isDate && !analysis.isBuffer && depth > 0) {
      try {
        const nestedAnalysis = this.analyzeObject(value, { 
          includeNonEnumerable: false, 
          depth: depth - 1,
          maxProperties: 10 
        });
        analysis.hasOwnProperties = true;
        analysis.propertyCount = nestedAnalysis.propertyStatistics.total;
        analysis.nestedProperties = nestedAnalysis.ownProperties;
      } catch (error) {
        analysis.circularReference = true;
      }
    }
    
    return analysis;
  }
  
  static safeValueInspection(value, depth) {
    if (depth <= 0) {
      return '[Max Depth Reached]';
    }
    
    if (value === null) return null;
    if (value === undefined) return undefined;
    
    // Handle primitives
    if (this.isPrimitive(value)) {
      return value;
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.slice(0, 5).map(item => this.safeValueInspection(item, depth - 1));
    }
    
    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle buffers
    if (Buffer.isBuffer(value)) {
      return `[Buffer: ${value.length} bytes]`;
    }
    
    // Handle promises
    if (value instanceof Promise) {
      return '[Promise]';
    }
    
    // Handle objects - only show enumerable properties
    try {
      const simpleObject = {};
      Object.keys(value).slice(0, 5).forEach(key => {
        simpleObject[key] = this.safeValueInspection(value[key], depth - 1);
      });
      
      if (Object.keys(value).length > 5) {
        simpleObject['_truncated'] = `... ${Object.keys(value).length - 5} more properties`;
      }
      
      return simpleObject;
    } catch (error) {
      return '[Circular or Uninspectable]';
    }
  }
  
  static isPotentialSensitiveProperty(propName, value) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /private/i,
      /ssn/i,
      /credit.?card/i
    ];
    
    // Check property name
    if (sensitivePatterns.some(pattern => pattern.test(propName))) {
      return true;
    }
    
    // Check value patterns
    if (typeof value === 'string') {
      // JWT token pattern
      if (value.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/)) {
        return true;
      }
      
      // API key pattern (long random strings)
      if (value.length > 20 && /^[A-Za-z0-9]+$/.test(value)) {
        return true;
      }
    }
    
    return false;
  }
  
  static isPrimitive(value) {
    return value === null || 
           typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean' || 
           typeof value === 'symbol' || 
           typeof value === 'bigint' || 
           value === undefined;
  }
  
  static getObjectType(obj) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (Array.isArray(obj)) return 'array';
    if (obj instanceof Date) return 'date';
    if (Buffer.isBuffer(obj)) return 'buffer';
    if (obj instanceof Promise) return 'promise';
    if (obj instanceof Map) return 'map';
    if (obj instanceof Set) return 'set';
    if (typeof obj === 'function') return 'function';
    return 'object';
  }
  
  // Property validation and sanitization
  static createPropertyValidator(rules) {
    return function(obj) {
      const violations = [];
      const sanitized = {};
      
      Object.keys(rules).forEach(prop => {
        const rule = rules[prop];
        const value = obj[prop];
        const exists = prop in obj;
        
        // Required check
        if (rule.required && !exists) {
          violations.push(`${prop} is required`);
          return;
        }
        
        // Skip if not required and doesn't exist
        if (!exists) return;
        
        // Type check
        if (rule.type && typeof value !== rule.type) {
          violations.push(`${prop} must be ${rule.type}`);
          return;
        }
        
        // Enum check
        if (rule.enum && !rule.enum.includes(value)) {
          violations.push(`${prop} must be one of: ${rule.enum.join(', ')}`);
          return;
        }
        
        // Pattern check
        if (rule.pattern && !rule.pattern.test(value)) {
          violations.push(`${prop} format is invalid`);
          return;
        }
        
        // Custom validator
        if (rule.validator && !rule.validator(value)) {
          violations.push(`${prop} failed custom validation`);
          return;
        }
        
        // Sanitization
        if (rule.sanitize) {
          sanitized[prop] = rule.sanitize(value);
        } else {
          sanitized[prop] = value;
        }
      });
      
      // Check for extra properties
      if (rules.strict) {
        Object.keys(obj).forEach(prop => {
          if (!rules[prop]) {
            violations.push(`Unexpected property: ${prop}`);
          }
        });
      }
      
      return {
        isValid: violations.length === 0,
        violations,
        sanitized: violations.length === 0 ? sanitized : null
      };
    };
  }
  
  // Freeze object properties based on rules
  static applyPropertySecurity(obj, securityRules) {
    const securedObj = { ...obj };
    
    Object.keys(securityRules).forEach(prop => {
      const rule = securityRules[prop];
      
      if (securedObj[prop] !== undefined) {
        const descriptor = {
          enumerable: rule.enumerable !== false,
          writable: rule.writable !== false,
          configurable: rule.configurable !== false
        };
        
        // Apply redaction for sensitive data
        if (rule.sensitive && descriptor.enumerable) {
          const originalValue = securedObj[prop];
          Object.defineProperty(securedObj, prop, {
            ...descriptor,
            get: () => '***REDACTED***',
            set: (value) => {
              throw new Error(`Cannot modify sensitive property: ${prop}`);
            }
          });
        } else {
          Object.defineProperty(securedObj, prop, descriptor);
        }
      }
    });
    
    return Object.freeze(securedObj);
  }
}

// Usage examples
function propertyInspectionDemo() {
  // Create a complex object for inspection
  const userObject = {
    id: 123,
    username: 'john_doe',
    email: 'john@example.com',
    password: 'super_secret_password_123',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      preferences: {
        theme: 'dark',
        notifications: true
      }
    },
    tokens: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'def50200f3a7a3b7c7c8a8b8c8d8e8f9...'
    },
    _internal: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    },
    // Non-enumerable property
    [Symbol('internal')]: 'secret_symbol'
  };
  
  // Make _internal non-enumerable
  Object.defineProperty(userObject, '_internal', {
    enumerable: false,
    writable: true,
    configurable: true
  });
  
  console.log('=== Property Inspection Demo ===');
  
  // Analyze the object
  const analysis = PropertyInspector.analyzeObject(userObject, {
    includeNonEnumerable: true,
    includePrototype: true,
    depth: 3
  });
  
  console.log('Object Analysis:', JSON.stringify(analysis, null, 2));
  
  // Test property validation
  const userValidator = PropertyInspector.createPropertyValidator({
    username: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9_]{3,20}$/,
      sanitize: (val) => val.trim().toLowerCase()
    },
    email: {
      required: true,
      type: 'string',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: (val) => val.trim().toLowerCase()
    },
    age: {
      required: false,
      type: 'number',
      validator: (val) => val >= 0 && val <= 150
    },
    strict: true
  });
  
  const testUser = {
    username: '  John_Doe  ',
    email: 'JOHN@EXAMPLE.COM',
    age: 30,
    extraField: 'should cause error in strict mode'
  };
  
  const validationResult = userValidator(testUser);
  console.log('Validation Result:', validationResult);
  
  // Test security application
  const securityRules = {
    password: { enumerable: false, writable: false, sensitive: true },
    tokens: { enumerable: false, writable: false, sensitive: true },
    email: { enumerable: true, writable: false, sensitive: false },
    username: { enumerable: true, writable: false, sensitive: false }
  };
  
  const securedUser = PropertyInspector.applyPropertySecurity(userObject, securityRules);
  console.log('Secured User enumerable properties:', Object.keys(securedUser));
  console.log('Secured User JSON:', JSON.stringify(securedUser));
  
  // Try to modify secured properties
  try {
    securedUser.email = 'new@example.com';
  } catch (error) {
    console.log('Expected error when modifying read-only property:', error.message);
  }
}

propertyInspectionDemo();

// ## 3. Advanced Property Management for Database Models

// Advanced property management for database entities
class EntityPropertyManager {
  constructor(entityName, schema) {
    this.entityName = entityName;
    this.schema = schema;
    this.instances = new WeakMap();
    this.propertyHooks = new Map();
    
    this._setupDefaultHooks();
  }
  
  _setupDefaultHooks() {
    // Before set hook for validation
    this.addPropertyHook('beforeSet', (instance, prop, value, descriptor) => {
      const fieldSchema = this.schema[prop];
      if (fieldSchema && fieldSchema.validate) {
        if (!fieldSchema.validate(value)) {
          throw new Error(`Validation failed for ${prop}: ${value}`);
        }
      }
      return value;
    });
    
    // After set hook for side effects
    this.addPropertyHook('afterSet', (instance, prop, value, descriptor) => {
      // Update timestamps for relevant fields
      if (prop !== 'updatedAt' && descriptor.writable) {
        instance.updatedAt = new Date();
      }
      
      // Clear cache for changed properties
      if (instance._cache) {
        instance._cache.delete(prop);
      }
    });
    
    // Before get hook for computed properties
    this.addPropertyHook('beforeGet', (instance, prop, value, descriptor) => {
      if (descriptor.get && !descriptor.enumerable) {
        console.warn(`Accessing non-enumerable computed property: ${prop}`);
      }
      return value;
    });
  }
  
  createEntity(initialData = {}) {
    const entity = Object.create(null);
    this.instances.set(entity, {
      originalData: { ...initialData },
      modifiedFields: new Set(),
      cache: new Map(),
      hooksEnabled: true
    });
    
    // Define properties based on schema
    Object.keys(this.schema).forEach(prop => {
      this._defineProperty(entity, prop, initialData[prop]);
    });
    
    // Define metadata properties
    this._defineMetadataProperties(entity);
    
    return Object.seal(entity);
  }
  
  _defineProperty(entity, prop, initialValue) {
    const fieldSchema = this.schema[prop];
    const instanceData = this.instances.get(entity);
    
    const descriptor = {
      enumerable: fieldSchema.enumerable !== false,
      configurable: false,
      get: () => {
        // Check cache first
        if (instanceData.cache.has(prop)) {
          return instanceData.cache.get(prop);
        }
        
        let value = instanceData.originalData[prop];
        
        // Apply beforeGet hooks
        if (instanceData.hooksEnabled) {
          value = this._executeHooks('beforeGet', entity, prop, value, descriptor);
        }
        
        // Apply computed value if defined
        if (fieldSchema.computed) {
          value = fieldSchema.computed.call(entity);
        }
        
        // Cache the value
        if (fieldSchema.cacheable !== false) {
          instanceData.cache.set(prop, value);
        }
        
        return value;
      },
      set: (newValue) => {
        if (!fieldSchema.writable) {
          throw new Error(`Property ${prop} is read-only`);
        }
        
        let processedValue = newValue;
        
        // Apply beforeSet hooks
        if (instanceData.hooksEnabled) {
          processedValue = this._executeHooks('beforeSet', entity, prop, processedValue, descriptor);
        }
        
        // Type conversion
        if (fieldSchema.type) {
          processedValue = this._convertType(processedValue, fieldSchema.type);
        }
        
        // Update original data
        instanceData.originalData[prop] = processedValue;
        instanceData.modifiedFields.add(prop);
        instanceData.cache.delete(prop); // Invalidate cache
        
        // Apply afterSet hooks
        if (instanceData.hooksEnabled) {
          this._executeHooks('afterSet', entity, prop, processedValue, descriptor);
        }
      }
    };
    
    // Set initial value
    if (initialValue !== undefined) {
      instanceData.originalData[prop] = initialValue;
    }
    
    Object.defineProperty(entity, prop, descriptor);
  }
  
  _defineMetadataProperties(entity) {
    const instanceData = this.instances.get(entity);
    
    // isModified property
    Object.defineProperty(entity, 'isModified', {
      enumerable: false,
      configurable: false,
      get: () => instanceData.modifiedFields.size > 0
    });
    
    // getModifiedFields method
    Object.defineProperty(entity, 'getModifiedFields', {
      enumerable: false,
      configurable: false,
      value: () => Array.from(instanceData.modifiedFields)
    });
    
    // getOriginalValue method
    Object.defineProperty(entity, 'getOriginalValue', {
      enumerable: false,
      configurable: false,
      value: (prop) => instanceData.originalData[prop]
    });
    
    // reset method
    Object.defineProperty(entity, 'reset', {
      enumerable: false,
      configurable: false,
      value: (props = null) => {
        const fieldsToReset = props || Array.from(instanceData.modifiedFields);
        fieldsToReset.forEach(prop => {
          if (this.schema[prop]) {
            entity[prop] = instanceData.originalData[prop];
            instanceData.modifiedFields.delete(prop);
          }
        });
      }
    });
    
    // toDatabaseObject method
    Object.defineProperty(entity, 'toDatabaseObject', {
      enumerable: false,
      configurable: false,
      value: (options = {}) => {
        const {
          includeNonEnumerable = false,
          includeComputed = false,
          includeModifiedOnly = false,
          excludeSensitive = true
        } = options;
        
        const props = includeNonEnumerable 
          ? Object.getOwnPropertyNames(entity)
          : Object.keys(entity);
        
        return props.reduce((result, prop) => {
          // Skip if not in schema (metadata properties)
          if (!this.schema[prop]) return result;
          
          const fieldSchema = this.schema[prop];
          
          // Skip computed fields unless explicitly included
          if (fieldSchema.computed && !includeComputed) return result;
          
          // Skip non-modified fields if requested
          if (includeModifiedOnly && !instanceData.modifiedFields.has(prop)) return result;
          
          // Skip sensitive fields if requested
          if (excludeSensitive && fieldSchema.sensitive) return result;
          
          result[prop] = entity[prop];
          return result;
        }, {});
      }
    });
  }
  
  _convertType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error('Invalid number');
        return num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      case 'date':
        if (typeof value === 'string' || typeof value === 'number') {
          return new Date(value);
        }
        return value;
      default:
        return value;
    }
  }
  
  _executeHooks(hookType, instance, prop, value, descriptor) {
    const hooks = this.propertyHooks.get(hookType) || [];
    let processedValue = value;
    
    for (const hook of hooks) {
      processedValue = hook(instance, prop, processedValue, descriptor);
    }
    
    return processedValue;
  }
  
  addPropertyHook(hookType, hookFunction) {
    if (!this.propertyHooks.has(hookType)) {
      this.propertyHooks.set(hookType, []);
    }
    this.propertyHooks.get(hookType).push(hookFunction);
  }
  
  // Static analysis methods
  static analyzeEntityProperties(entity) {
    const ownProperties = Object.getOwnPropertyNames(entity);
    const enumerableProperties = Object.keys(entity);
    const nonEnumerableProperties = ownProperties.filter(prop => 
      !enumerableProperties.includes(prop)
    );
    
    const analysis = {
      totalProperties: ownProperties.length,
      enumerableProperties,
      nonEnumerableProperties,
      propertyDescriptors: {},
      modificationStatus: {}
    };
    
    ownProperties.forEach(prop => {
      analysis.propertyDescriptors[prop] = Object.getOwnPropertyDescriptor(entity, prop);
      
      if (entity.getModifiedFields && typeof entity.getModifiedFields === 'function') {
        analysis.modificationStatus[prop] = entity.getModifiedFields().includes(prop);
      }
    });
    
    return analysis;
  }
  
  // Bulk property operations
  static freezeProperties(entity, props = []) {
    const propertiesToFreeze = props.length > 0 ? props : Object.getOwnPropertyNames(entity);
    
    propertiesToFreeze.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(entity, prop);
      if (descriptor && descriptor.configurable) {
        Object.defineProperty(entity, prop, {
          ...descriptor,
          writable: false,
          configurable: false
        });
      }
    });
    
    return entity;
  }
  
  static makePropertiesEnumerable(entity, props = []) {
    const propertiesToChange = props.length > 0 ? props : Object.getOwnPropertyNames(entity);
    
    propertiesToChange.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(entity, prop);
      if (descriptor && descriptor.configurable) {
        Object.defineProperty(entity, prop, {
          ...descriptor,
          enumerable: true
        });
      }
    });
    
    return entity;
  }
  
  static makePropertiesNonEnumerable(entity, props = []) {
    const propertiesToChange = props.length > 0 ? props : Object.getOwnPropertyNames(entity);
    
    propertiesToChange.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(entity, prop);
      if (descriptor && descriptor.configurable) {
        Object.defineProperty(entity, prop, {
          ...descriptor,
          enumerable: false
        });
      }
    });
    
    return entity;
  }
}

// Usage examples
function entityPropertyDemo() {
  // Define user schema
  const userSchema = {
    id: {
      type: 'number',
      enumerable: true,
      writable: false,
      validate: (val) => Number.isInteger(val) && val > 0
    },
    username: {
      type: 'string',
      enumerable: true,
      writable: true,
      validate: (val) => typeof val === 'string' && val.length >= 3
    },
    email: {
      type: 'string',
      enumerable: true,
      writable: true,
      validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
    },
    password: {
      type: 'string',
      enumerable: false, // Hide sensitive data
      writable: true,
      sensitive: true,
      validate: (val) => typeof val === 'string' && val.length >= 8
    },
    age: {
      type: 'number',
      enumerable: true,
      writable: true,
      validate: (val) => val >= 0 && val <= 150
    },
    fullName: {
      enumerable: true,
      writable: false,
      computed: function() {
        return `${this.firstName || ''} ${this.lastName || ''}`.trim();
      }
    },
    createdAt: {
      type: 'date',
      enumerable: true,
      writable: false
    },
    updatedAt: {
      type: 'date',
      enumerable: false, // Internal use only
      writable: true
    }
  };
  
  const userManager = new EntityPropertyManager('User', userSchema);
  
  // Create user entity
  const user = userManager.createEntity({
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    password: 'securepassword123',
    age: 30,
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date()
  });
  
  console.log('=== Entity Property Management Demo ===');
  
  // Test property access
  console.log('Username:', user.username);
  console.log('Full Name (computed):', user.fullName);
  
  // Test property modification
  user.age = 31;
  user.email = 'john.doe@example.com';
  
  console.log('Modified fields:', user.getModifiedFields());
  console.log('Is modified:', user.isModified);
  
  // Test database serialization
  console.log('Database object (default):', user.toDatabaseObject());
  console.log('Database object (include all):', user.toDatabaseObject({
    includeNonEnumerable: true,
    includeComputed: true
  }));
  
  // Test property analysis
  const analysis = EntityPropertyManager.analyzeEntityProperties(user);
  console.log('Entity analysis:', analysis);
  
  // Test reset functionality
  user.reset(['age']);
  console.log('After reset - modified fields:', user.getModifiedFields());
  
  // Test bulk property operations
  EntityPropertyManager.makePropertiesNonEnumerable(user, ['username', 'email']);
  console.log('After making username/email non-enumerable - enumerable properties:', Object.keys(user));
  
  EntityPropertyManager.makePropertiesEnumerable(user, ['username']);
  console.log('After making username enumerable - enumerable properties:', Object.keys(user));
  
  // Test freezing properties
  EntityPropertyManager.freezeProperties(user, ['email']);
  try {
    user.email = 'new@example.com';
  } catch (error) {
    console.log('Expected error when modifying frozen property:', error.message);
  }
}

entityPropertyDemo();

// ## 4. Production-Grade Property Utilities

// Production-grade property utilities for backend development
class ProductionPropertyUtils {
  // Secure object creation with property validation
  static createSecureObject(schema, initialData = {}, options = {}) {
    const {
      freeze: shouldFreeze = true,
      seal: shouldSeal = true,
      preventExtensions = true,
      strictValidation = true,
      ...creationOptions
    } = options;
    
    const secureObject = Object.create(null);
    
    // Apply schema properties
    Object.keys(schema).forEach(key => {
      const fieldSchema = schema[key];
      const initialValue = initialData[key];
      
      this.defineSchemaProperty(secureObject, key, fieldSchema, initialValue);
    });
    
    // Add metadata properties
    this.defineMetadataProperties(secureObject, schema, initialData);
    
    // Apply security measures
    if (preventExtensions) {
      Object.preventExtensions(secureObject);
    }
    
    if (shouldSeal) {
      Object.seal(secureObject);
    }
    
    if (shouldFreeze) {
      Object.freeze(secureObject);
    }
    
    return secureObject;
  }
  
  static defineSchemaProperty(obj, key, schema, initialValue) {
    const {
      type,
      required = false,
      defaultValue,
      enumerable = true,
      writable = true,
      configurable = false,
      sensitive = false,
      validate = null,
      transform = null,
      ...fieldOptions
    } = schema;
    
    // Determine initial value
    let value = initialValue;
    if (value === undefined && defaultValue !== undefined) {
      value = defaultValue;
    }
    
    // Validate required field
    if (required && value === undefined) {
      throw new Error(`Required field ${key} is missing`);
    }
    
    // Validate type if value is provided
    if (value !== undefined && type) {
      value = this.validateAndTransformValue(value, type, validate, transform);
    }
    
    const descriptor = {
      enumerable,
      configurable,
      get: () => {
        if (sensitive) {
          return '***REDACTED***';
        }
        return value;
      },
      set: (newValue) => {
        if (!writable) {
          throw new Error(`Property ${key} is read-only`);
        }
        
        const processedValue = this.validateAndTransformValue(
          newValue, 
          type, 
          validate, 
          transform
        );
        
        value = processedValue;
      }
    };
    
    Object.defineProperty(obj, key, descriptor);
    
    // Set initial value through setter to trigger validation
    if (value !== undefined) {
      obj[key] = value;
    }
  }
  
  static validateAndTransformValue(value, type, validate, transform) {
    let processedValue = value;
    
    // Type conversion
    if (type) {
      processedValue = this.convertToType(processedValue, type);
    }
    
    // Custom validation
    if (validate && !validate(processedValue)) {
      throw new Error(`Validation failed for value: ${processedValue}`);
    }
    
    // Transformation
    if (transform) {
      processedValue = transform(processedValue);
    }
    
    return processedValue;
  }
  
  static convertToType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        if (isNaN(num)) throw new Error('Invalid number');
        return num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return date;
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' && value !== null ? value : {};
      default:
        return value;
    }
  }
  
  static defineMetadataProperties(obj, schema, initialData) {
    // Track original data
    const originalData = { ...initialData };
    
    // isModified property
    Object.defineProperty(obj, 'isModified', {
      enumerable: false,
      configurable: false,
      get: () => {
        return Object.keys(schema).some(key => {
          return obj[key] !== originalData[key];
        });
      }
    });
    
    // getModifiedFields method
    Object.defineProperty(obj, 'getModifiedFields', {
      enumerable: false,
      configurable: false,
      value: () => {
        return Object.keys(schema).filter(key => {
          return obj[key] !== originalData[key];
        });
      }
    });
    
    // toJSON method for safe serialization
    Object.defineProperty(obj, 'toJSON', {
      enumerable: false,
      configurable: false,
      value: () => {
        const result = {};
        Object.keys(schema).forEach(key => {
          const fieldSchema = schema[key];
          if (fieldSchema.enumerable && !fieldSchema.sensitive) {
            result[key] = obj[key];
          }
        });
        return result;
      }
    });
  }
  
  // Property enumeration utilities
  static getAllOwnProperties(obj, options = {}) {
    const {
      includeNonEnumerable = true,
      includeSymbols = true,
      filter = null
    } = options;
    
    let properties = [];
    
    if (includeNonEnumerable) {
      properties = Object.getOwnPropertyNames(obj);
    } else {
      properties = Object.keys(obj);
    }
    
    if (includeSymbols) {
      const symbols = Object.getOwnPropertySymbols(obj);
      properties.push(...symbols);
    }
    
    if (filter) {
      properties = properties.filter(filter);
    }
    
    return properties;
  }
  
  static getPropertyDescriptors(obj, options = {}) {
    const {
      includeNonEnumerable = true,
      includeSymbols = true,
      filter = null
    } = options;
    
    const properties = this.getAllOwnProperties(obj, {
      includeNonEnumerable,
      includeSymbols,
      filter
    });
    
    const descriptors = {};
    
    properties.forEach(prop => {
      descriptors[prop] = Object.getOwnPropertyDescriptor(obj, prop);
    });
    
    return descriptors;
  }
  
  static createPropertyMap(obj, options = {}) {
    const {
      includeValues = true,
      includeDescriptors = false,
      filter = null
    } = options;
    
    const properties = this.getAllOwnProperties(obj, { filter });
    const propertyMap = new Map();
    
    properties.forEach(prop => {
      const entry = {
        descriptor: Object.getOwnPropertyDescriptor(obj, prop),
        enumerable: Object.getOwnPropertyDescriptor(obj, prop).enumerable,
        type: typeof obj[prop]
      };
      
      if (includeValues) {
        entry.value = obj[prop];
      }
      
      if (includeDescriptors) {
        entry.fullDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
      }
      
      propertyMap.set(prop, entry);
    });
    
    return propertyMap;
  }
  
  // Property security utilities
  static hideSensitiveProperties(obj, sensitivePatterns = [/password/i, /secret/i, /token/i]) {
    const properties = this.getAllOwnProperties(obj);
    
    properties.forEach(prop => {
      if (sensitivePatterns.some(pattern => pattern.test(String(prop)))) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        if (descriptor && descriptor.configurable) {
          Object.defineProperty(obj, prop, {
            ...descriptor,
            enumerable: false
          });
        }
      }
    });
    
    return obj;
  }
  
  static freezeCriticalProperties(obj, criticalProperties = []) {
    const properties = criticalProperties.length > 0 
      ? criticalProperties 
      : this.getAllOwnProperties(obj);
    
    properties.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      if (descriptor && descriptor.configurable) {
        Object.defineProperty(obj, prop, {
          ...descriptor,
          writable: false,
          configurable: false
        });
      }
    });
    
    return obj;
  }
  
  static createImmutableClone(obj, options = {}) {
    const {
      includeNonEnumerable = false,
      deep = true,
      ...cloneOptions
    } = options;
    
    const properties = this.getAllOwnProperties(obj, { includeNonEnumerable });
    const clone = Object.create(null);
    
    properties.forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      let value = obj[prop];
      
      // Deep clone objects and arrays
      if (deep && value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value = value.map(item => 
            typeof item === 'object' ? this.createImmutableClone(item, options) : item
          );
        } else if (value instanceof Date) {
          value = new Date(value.getTime());
        } else {
          value = this.createImmutableClone(value, options);
        }
      }
      
      Object.defineProperty(clone, prop, {
        value: value,
        writable: false,
        enumerable: descriptor.enumerable,
        configurable: false
      });
    });
    
    return Object.freeze(clone);
  }
  
  // Property validation for API responses
  static validateAPIResponse(obj, schema, options = {}) {
    const {
      strict = true,
      throwOnError = true,
      ...validationOptions
    } = options;
    
    const errors = [];
    const validated = {};
    
    // Check required fields
    Object.keys(schema).forEach(key => {
      const fieldSchema = schema[key];
      
      if (fieldSchema.required && !(key in obj)) {
        errors.push(`Missing required field: ${key}`);
        return;
      }
      
      if (key in obj) {
        try {
          validated[key] = this.validateAndTransformValue(
            obj[key],
            fieldSchema.type,
            fieldSchema.validate,
            fieldSchema.transform
          );
        } catch (error) {
          errors.push(`Validation failed for ${key}: ${error.message}`);
        }
      }
    });
    
    // Check for extra fields in strict mode
    if (strict) {
      Object.keys(obj).forEach(key => {
        if (!schema[key]) {
          errors.push(`Unexpected field: ${key}`);
        }
      });
    }
    
    if (errors.length > 0 && throwOnError) {
      throw new Error(`API response validation failed: ${errors.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      validated: errors.length === 0 ? validated : null
    };
  }
  
  // Performance-optimized property access
  static createPropertyAccessor(obj, properties, options = {}) {
    const {
      cacheable = true,
      defaultValue = undefined,
      transform = null,
      ...accessorOptions
    } = options;
    
    const cache = new Map();
    
    return {
      get: (prop) => {
        if (!properties.includes(prop)) {
          throw new Error(`Invalid property: ${prop}`);
        }
        
        // Check cache
        if (cacheable && cache.has(prop)) {
          return cache.get(prop);
        }
        
        let value = obj[prop];
        
        // Apply default value
        if (value === undefined || value === null) {
          value = defaultValue;
        }
        
        // Apply transformation
        if (transform) {
          value = transform(value, prop);
        }
        
        // Cache the value
        if (cacheable) {
          cache.set(prop, value);
        }
        
        return value;
      },
      
      set: (prop, value) => {
        if (!properties.includes(prop)) {
          throw new Error(`Invalid property: ${prop}`);
        }
        
        obj[prop] = value;
        cache.delete(prop); // Invalidate cache
      },
      
      clearCache: () => {
        cache.clear();
      },
      
      getCachedProperties: () => {
        return Array.from(cache.keys());
      }
    };
  }
}

// Usage examples
function productionUtilsDemo() {
  console.log('=== Production Property Utilities Demo ===');
  
  // Create secure object with schema
  const userSchema = {
    id: { type: 'number', required: true, enumerable: true, writable: false },
    username: { type: 'string', required: true, enumerable: true, writable: true },
    email: { type: 'string', required: true, enumerable: true, writable: true },
    password: { type: 'string', required: true, enumerable: false, writable: true, sensitive: true },
    createdAt: { type: 'date', required: false, enumerable: true, writable: false, defaultValue: new Date() }
  };
  
  const user = ProductionPropertyUtils.createSecureObject(userSchema, {
    id: 1,
    username: 'john_doe',
    email: 'john@example.com',
    password: 'secret123'
  });
  
  console.log('Secure user object:', user);
  console.log('User JSON (safe):', JSON.stringify(user));
  console.log('Is modified:', user.isModified);
  console.log('Enumerable properties:', Object.keys(user));
  
  // Test property utilities
  const allProperties = ProductionPropertyUtils.getAllOwnProperties(user, {
    includeNonEnumerable: true
  });
  console.log('All own properties:', allProperties);
  
  const propertyMap = ProductionPropertyUtils.createPropertyMap(user, {
    includeValues: true,
    includeDescriptors: true
  });
  console.log('Property map:', propertyMap);
  
  // Test API response validation
  const apiResponse = {
    id: '123', // Should be number
    username: 'jane_doe',
    email: 'invalid-email', // Invalid email
    extraField: 'should cause error in strict mode'
  };
  
  const validationResult = ProductionPropertyUtils.validateAPIResponse(
    apiResponse, 
    userSchema, 
    { strict: true, throwOnError: false }
  );
  
  console.log('API validation result:', validationResult);
  
  // Test property accessor
  const accessor = ProductionPropertyUtils.createPropertyAccessor(user, ['username', 'email'], {
    cacheable: true,
    transform: (value, prop) => prop === 'email' ? value.toLowerCase() : value
  });
  
  console.log('Username via accessor:', accessor.get('username'));
  console.log('Email via accessor:', accessor.get('email'));
  console.log('Cached properties:', accessor.getCachedProperties());
  
  // Test immutable clone
  const immutableUser = ProductionPropertyUtils.createImmutableClone(user);
  console.log('Immutable clone created:', immutableUser);
  
  try {
    immutableUser.username = 'new_username';
  } catch (error) {
    console.log('Expected error when modifying immutable object:', error.message);
  }
}

productionUtilsDemo();

// These comprehensive code snippets cover JavaScript object's own properties and enumerable properties for Node.js production-grade backend development, including:

// 1. **Configuration Management** - Secure property handling with validation and metadata
// 2. **Property Inspection** - Advanced analysis and security checking
// 3. **Database Models** - Entity property management with hooks and validation
// 4. **Production Utilities** - Performance-optimized property access and security

// These patterns ensure robust, secure, and maintainable property management in production environments.


































// Here are comprehensive code snippets for the optional chaining operator in Node.js production-grade backend development:

// ## 1. Database Operations with Optional Chaining

// Advanced database service with optional chaining for safe data access
class DatabaseService {
  constructor(options = {}) {
    this.options = options;
    this.connections = new Map();
    this.cache = new Map();
  }

  // Safe database query with optional chaining for nested data
  async findUserWithProfile(userId, options = {}) {
    const {
      includeProfile = true,
      includePreferences = true,
      includeMetadata = false,
      useCache = true,
      ...queryOptions
    } = options;

    const cacheKey = `user:${userId}:${includeProfile}:${includePreferences}`;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('Cache hit for user:', userId);
        return cached;
      }
    }

    try {
      // Simulate database query
      const user = await this._executeQuery('users', { id: userId }, queryOptions);
      
      if (!user) {
        return null;
      }

      // Safe nested data access with optional chaining
      const result = {
        id: user.id,
        username: user.username,
        email: user.email,
        // Safe access to nested profile data
        profile: includeProfile ? {
          firstName: user?.profile?.firstName,
          lastName: user?.profile?.lastName,
          avatar: user?.profile?.avatar?.url,
          // Deep nested optional chaining
          socialLinks: {
            github: user?.profile?.socialLinks?.github,
            twitter: user?.profile?.socialLinks?.twitter,
            linkedin: user?.profile?.socialLinks?.linkedin
          }
        } : undefined,
        
        // Safe access to preferences
        preferences: includePreferences ? {
          theme: user?.preferences?.theme ?? 'light', // Nullish coalescing with optional chaining
          language: user?.preferences?.language ?? 'en',
          notifications: user?.preferences?.notifications ?? true,
          // Complex nested access
          emailSettings: {
            marketing: user?.preferences?.emailSettings?.marketing ?? false,
            security: user?.preferences?.emailSettings?.security ?? true
          }
        } : undefined,
        
        // Metadata with safe fallbacks
        metadata: includeMetadata ? {
          createdAt: user?.metadata?.createdAt,
          updatedAt: user?.metadata?.updatedAt,
          lastLogin: user?.metadata?.lastLogin,
          // Deep nested with multiple fallbacks
          loginCount: user?.metadata?.statistics?.loginCount ?? 0,
          sessionCount: user?.metadata?.statistics?.sessionCount ?? 0
        } : undefined
      };

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      console.error('Database query failed:', error.message);
      throw error;
    }
  }

  // Batch user lookup with optional chaining for missing data
  async findUsersByIds(userIds, options = {}) {
    const {
      includeProfiles = false,
      includeStats = false,
      ...batchOptions
    } = options;

    try {
      // Simulate batch database query
      const users = await this._executeBatchQuery('users', { ids: userIds }, batchOptions);
      
      return users?.map(user => ({
        id: user?.id,
        username: user?.username,
        email: user?.email,
        status: user?.status ?? 'active',
        
        // Optional profile data
        ...(includeProfiles && {
          profile: {
            fullName: [user?.profile?.firstName, user?.profile?.lastName]
              .filter(Boolean)
              .join(' ') || 'Unknown',
            avatar: user?.profile?.avatar?.url,
            bio: user?.profile?.bio
          }
        }),
        
        // Optional statistics
        ...(includeStats && {
          statistics: {
            postCount: user?.statistics?.postCount ?? 0,
            commentCount: user?.statistics?.commentCount ?? 0,
            likeCount: user?.statistics?.likeCount ?? 0,
            // Deep nested with calculations
            engagement: {
              rate: user?.statistics?.engagement?.rate ?? 0,
              score: user?.statistics?.engagement?.score ?? 0
            }
          }
        }),
        
        // Safe timestamp access
        timestamps: {
          createdAt: user?.createdAt ?? new Date(),
          updatedAt: user?.updatedAt,
          lastSeen: user?.lastSeenAt ?? user?.metadata?.lastActivity
        }
      })) ?? []; // Fallback to empty array if users is null/undefined

    } catch (error) {
      console.error('Batch query failed:', error.message);
      return [];
    }
  }

  // Complex data transformation with optional chaining
  async transformUserData(rawData, transformations = {}) {
    const {
      normalizeProfile = true,
      calculateStats = true,
      enrichWithExternal = false,
      ...transformOptions
    } = transformations;

    // Safe data extraction with optional chaining
    const baseData = {
      id: rawData?.id,
      type: rawData?.type ?? 'user',
      attributes: {
        username: rawData?.attributes?.username,
        email: rawData?.attributes?.email,
        // Deep nested with fallbacks
        status: rawData?.attributes?.status ?? 'inactive',
        verified: rawData?.attributes?.verified ?? false
      }
    };

    // Normalize profile data
    if (normalizeProfile) {
      baseData.profile = {
        // Safe array access and transformation
        name: {
          first: rawData?.profile?.name?.first?.trim()?.toLowerCase() ?? '',
          last: rawData?.profile?.name?.last?.trim()?.toLowerCase() ?? '',
          full: [rawData?.profile?.name?.first, rawData?.profile?.name?.last]
            ?.filter(Boolean)
            ?.map(name => name?.trim())
            ?.join(' ') || 'Unknown'
        },
        
        // Safe object access with transformation
        contact: {
          email: rawData?.profile?.contact?.email,
          phone: rawData?.profile?.contact?.phone?.replace(/\D/g, '') // Remove non-digits
        },
        
        // Safe array mapping with optional chaining
        addresses: rawData?.profile?.addresses?.map?.(address => ({
          type: address?.type ?? 'home',
          street: address?.street?.trim(),
          city: address?.city?.trim(),
          country: address?.country?.trim()?.toUpperCase()
        })) ?? []
      };
    }

    // Calculate statistics
    if (calculateStats) {
      baseData.statistics = {
        // Safe number calculations
        totalPosts: rawData?.statistics?.posts?.total ?? 0,
        publishedPosts: rawData?.statistics?.posts?.published?.length ?? 0,
        draftPosts: rawData?.statistics?.posts?.drafts?.length ?? 0,
        
        // Safe array operations
        recentActivity: rawData?.activity?.slice?.(0, 5)?.map?.(activity => ({
          type: activity?.type,
          timestamp: activity?.timestamp,
          data: activity?.data
        })) ?? [],
        
        // Complex calculations with safe access
        engagement: {
          likes: rawData?.engagement?.likes?.count ?? 0,
          comments: rawData?.engagement?.comments?.count ?? 0,
          shares: rawData?.engagement?.shares?.count ?? 0,
          // Calculate rate with safe division
          rate: (rawData?.engagement?.likes?.count ?? 0) / 
                Math.max((rawData?.statistics?.posts?.total ?? 1), 1)
        }
      };
    }

    // Enrich with external data
    if (enrichWithExternal) {
      try {
        const externalData = await this._fetchExternalData(rawData?.id);
        baseData.external = {
          socialScore: externalData?.scores?.social ?? 0,
          reputation: externalData?.reputation?.score ?? 0,
          badges: externalData?.badges?.map?.(badge => badge?.name) ?? []
        };
      } catch (error) {
        console.warn('External data enrichment failed:', error.message);
      }
    }

    return baseData;
  }

  // Safe database operations with transaction support
  async executeInTransaction(operations, options = {}) {
    const {
      retryCount = 3,
      isolationLevel = 'READ_COMMITTED',
      ...txOptions
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        // Simulate transaction start
        const transaction = await this._beginTransaction(isolationLevel);
        
        const results = {};
        
        // Execute operations with safe error handling
        for (const [operationName, operation] of Object.entries(operations)) {
          try {
            results[operationName] = await operation(transaction);
          } catch (error) {
            // Rollback transaction on operation failure
            await this._rollbackTransaction(transaction);
            throw new Error(`Operation ${operationName} failed: ${error.message}`);
          }
        }
        
        // Commit transaction
        await this._commitTransaction(transaction);
        
        return results;

      } catch (error) {
        lastError = error;
        console.warn(`Transaction attempt ${attempt} failed:`, error.message);
        
        if (attempt < retryCount) {
          await this._sleep(100 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`Transaction failed after ${retryCount} attempts: ${lastError?.message}`);
  }

  // Mock database methods
  async _executeQuery(collection, query, options) {
    // Simulate database delay
    await this._sleep(50);
    
    // Mock user data with nested structure
    if (collection === 'users' && query.id === 1) {
      return {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: {
            url: '/avatars/john.jpg',
            size: 1024
          },
          socialLinks: {
            github: 'https://github.com/johndoe',
            twitter: 'https://twitter.com/johndoe'
          }
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          emailSettings: {
            marketing: false,
            security: true
          }
        },
        metadata: {
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-12-01'),
          statistics: {
            loginCount: 42,
            sessionCount: 15
          }
        }
      };
    }
    
    return null;
  }

  async _executeBatchQuery(collection, query, options) {
    await this._sleep(100);
    
    if (collection === 'users' && query.ids?.includes(1)) {
      return [
        {
          id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          profile: {
            firstName: 'John',
            lastName: 'Doe'
          },
          statistics: {
            postCount: 10,
            engagement: {
              rate: 0.85
            }
          }
        }
      ];
    }
    
    return [];
  }

  async _fetchExternalData(userId) {
    await this._sleep(30);
    return {
      scores: { social: 85 },
      reputation: { score: 92 },
      badges: [{ name: 'early-adopter' }, { name: 'contributor' }]
    };
  }

  async _beginTransaction(isolationLevel) {
    return { id: `tx_${Date.now()}`, isolationLevel };
  }

  async _commitTransaction(transaction) {
    console.log('Committed transaction:', transaction.id);
  }

  async _rollbackTransaction(transaction) {
    console.log('Rolled back transaction:', transaction.id);
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage examples
async function databaseOptionalChainingDemo() {
  const dbService = new DatabaseService();

  console.log('=== Database Optional Chaining Demo ===');

  // Test safe user lookup
  const user = await dbService.findUserWithProfile(1, {
    includeProfile: true,
    includePreferences: true,
    includeMetadata: true
  });

  console.log('User with profile:', JSON.stringify(user, null, 2));

  // Test batch lookup
  const users = await dbService.findUsersByIds([1, 2, 3], {
    includeProfiles: true,
    includeStats: true
  });

  console.log('Batch users:', JSON.stringify(users, null, 2));

  // Test data transformation
  const rawData = {
    id: 1,
    attributes: {
      username: 'jane_doe',
      email: 'jane@example.com'
    },
    profile: {
      name: {
        first: 'Jane',
        last: 'Doe'
      },
      contact: {
        phone: '+1-555-0123'
      }
    },
    statistics: {
      posts: {
        total: 15,
        published: [1, 2, 3],
        drafts: [4, 5]
      }
    },
    activity: [
      { type: 'login', timestamp: new Date() },
      { type: 'post', timestamp: new Date() }
    ]
  };

  const transformed = await dbService.transformUserData(rawData, {
    normalizeProfile: true,
    calculateStats: true,
    enrichWithExternal: true
  });

  console.log('Transformed data:', JSON.stringify(transformed, null, 2));

  // Test transaction with safe operations
  try {
    const results = await dbService.executeInTransaction({
      createUser: async (tx) => {
        return { id: 100, username: 'new_user' };
      },
      updateProfile: async (tx) => {
        return { success: true };
      }
    });

    console.log('Transaction results:', results);
  } catch (error) {
    console.error('Transaction failed:', error.message);
  }
}

databaseOptionalChainingDemo();

// ## 2. API Response Handling with Optional Chaining

// Advanced API response handler with comprehensive optional chaining
class APIResponseHandler {
  constructor(options = {}) {
    this.options = {
      defaultValues: {
        page: 1,
        limit: 10,
        sort: 'createdAt',
        order: 'desc',
        ...options.defaultValues
      },
      validation: {
        strict: false,
        logWarnings: true,
        ...options.validation
      },
      transformation: {
        normalize: true,
        sanitize: true,
        ...options.transformation
      },
      ...options
    };

    this.validators = new Map();
    this.transformers = new Map();
  }

  // Process API response with safe optional chaining
  processResponse(rawResponse, schema, context = {}) {
    const {
      validate = true,
      transform = true,
      normalize = true,
      ...processOptions
    } = context;

    try {
      let processed = { ...rawResponse };

      // Validate response structure
      if (validate) {
        const validationResult = this.validateResponse(processed, schema);
        if (!validationResult.isValid) {
          throw new Error(`Response validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Transform response data
      if (transform) {
        processed = this.transformResponse(processed, schema);
      }

      // Normalize response structure
      if (normalize) {
        processed = this.normalizeResponse(processed, schema);
      }

      return {
        success: true,
        data: processed,
        metadata: this.extractMetadata(rawResponse, context)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null,
        metadata: this.extractMetadata(rawResponse, { ...context, error: true })
      };
    }
  }

  // Validate response structure with optional chaining
  validateResponse(response, schema) {
    const errors = [];

    // Check required fields with safe access
    schema.required?.forEach(field => {
      const value = this.getNestedValue(response, field);
      if (value === undefined || value === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate field types
    schema.fields?.forEach(field => {
      const value = this.getNestedValue(response, field.path);
      const fieldSchema = schema.fieldSchemas?.[field.path];

      if (value !== undefined && value !== null && fieldSchema) {
        // Type validation
        if (fieldSchema.type && typeof value !== fieldSchema.type) {
          errors.push(`Field ${field.path} must be ${fieldSchema.type}`);
        }

        // Pattern validation
        if (fieldSchema.pattern && !fieldSchema.pattern.test(String(value))) {
          errors.push(`Field ${field.path} format is invalid`);
        }

        // Custom validation
        if (fieldSchema.validate && !fieldSchema.validate(value)) {
          errors.push(`Field ${field.path} failed validation`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Transform response with safe optional chaining
  transformResponse(response, schema) {
    const transformed = {};

    // Transform data based on schema
    schema.fields?.forEach(field => {
      const originalValue = this.getNestedValue(response, field.path);
      
      // Apply transformations with safe fallbacks
      transformed[field.name || field.path] = this.applyTransformations(
        originalValue,
        field.transformations,
        field.path
      );
    });

    // Apply global transformations
    if (schema.transformations) {
      Object.keys(schema.transformations).forEach(key => {
        const transformer = schema.transformations[key];
        if (typeof transformer === 'function') {
          transformed[key] = transformer(response);
        }
      });
    }

    return transformed;
  }

  // Normalize response structure
  normalizeResponse(response, schema) {
    const normalized = {
      data: {},
      meta: {},
      links: {}
    };

    // Extract data with safe optional chaining
    normalized.data = response?.data ?? 
                     response?.items ?? 
                     response?.results ?? 
                     response;

    // Extract metadata with safe access
    normalized.meta = {
      pagination: {
        page: response?.meta?.pagination?.page ?? 
              response?.pagination?.page ?? 
              this.options.defaultValues.page,
        limit: response?.meta?.pagination?.limit ?? 
               response?.pagination?.limit ?? 
               this.options.defaultValues.limit,
        total: response?.meta?.pagination?.total ?? 
               response?.pagination?.total ?? 
               normalized.data?.length ?? 0,
        pages: response?.meta?.pagination?.pages ?? 
               response?.pagination?.pages ?? 
               Math.ceil((response?.meta?.pagination?.total ?? 0) / 
                        (response?.meta?.pagination?.limit ?? this.options.defaultValues.limit))
      },
      sort: {
        by: response?.meta?.sort?.by ?? 
            response?.sort?.field ?? 
            this.options.defaultValues.sort,
        order: response?.meta?.sort?.order ?? 
               response?.sort?.order ?? 
               this.options.defaultValues.order
      },
      // Safe nested metadata extraction
      filters: response?.meta?.filters ?? 
               response?.filters ?? 
               {},
      timestamp: response?.meta?.timestamp ?? 
                 response?.timestamp ?? 
                 new Date().toISOString()
    };

    // Extract links with safe access
    normalized.links = {
      self: response?.links?.self ?? 
            response?.meta?.links?.self,
      next: response?.links?.next ?? 
            response?.meta?.links?.next,
      prev: response?.links?.prev ?? 
            response?.meta?.links?.prev,
      first: response?.links?.first ?? 
             response?.meta?.links?.first,
      last: response?.links?.last ?? 
            response?.meta?.links?.last
    };

    return normalized;
  }

  // Extract metadata from response
  extractMetadata(response, context = {}) {
    const {
      requestId,
      timestamp = new Date(),
      error = false,
      ...metaContext
    } = context;

    return {
      requestId: requestId ?? response?.meta?.requestId,
      timestamp: timestamp.toISOString(),
      processedAt: new Date().toISOString(),
      responseTime: response?.meta?.responseTime ?? 
                   response?.responseTime ?? 
                   Date.now() - timestamp.getTime(),
      status: error ? 'error' : (response?.status ?? 'success'),
      // Safe nested metadata extraction
      rateLimit: {
        remaining: response?.headers?.['x-ratelimit-remaining'] ?? 
                  response?.meta?.rateLimit?.remaining,
        limit: response?.headers?.['x-ratelimit-limit'] ?? 
               response?.meta?.rateLimit?.limit,
        reset: response?.headers?.['x-ratelimit-reset'] ?? 
               response?.meta?.rateLimit?.reset
      },
      ...metaContext
    };
  }

  // Safe nested value access with optional chaining
  getNestedValue(obj, path, defaultValue = undefined) {
    if (!path || typeof path !== 'string') {
      return defaultValue;
    }

    return path.split('.').reduce((current, key) => {
      // Handle array indices
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.slice(0, key.indexOf('['));
        const index = key.slice(key.indexOf('[') + 1, key.indexOf(']'));
        
        const array = current?.[arrayKey];
        if (Array.isArray(array)) {
          return array?.[parseInt(index)] ?? defaultValue;
        }
        return defaultValue;
      }
      
      return current?.[key] ?? defaultValue;
    }, obj);
  }

  // Apply transformations with safe optional chaining
  applyTransformations(value, transformations, path) {
    if (!transformations) {
      return value;
    }

    let transformed = value;

    transformations.forEach(transformation => {
      try {
        switch (transformation.type) {
          case 'default':
            if (transformed === undefined || transformed === null) {
              transformed = transformation.value;
            }
            break;
            
          case 'type':
            transformed = this.convertType(transformed, transformation.target);
            break;
            
          case 'format':
            transformed = this.formatValue(transformed, transformation.format);
            break;
            
          case 'sanitize':
            transformed = this.sanitizeValue(transformed, transformation.rules);
            break;
            
          case 'custom':
            if (typeof transformation.handler === 'function') {
              transformed = transformation.handler(transformed, path);
            }
            break;
        }
      } catch (error) {
        if (this.options.validation?.logWarnings) {
          console.warn(`Transformation failed for ${path}:`, error.message);
        }
      }
    });

    return transformed;
  }

  // Type conversion with safe optional chaining
  convertType(value, targetType) {
    if (value === undefined || value === null) {
      return value;
    }

    switch (targetType) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date() : date;
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }

  // Value formatting with safe access
  formatValue(value, format) {
    if (value === undefined || value === null) {
      return value;
    }

    switch (format) {
      case 'lowercase':
        return String(value).toLowerCase();
      case 'uppercase':
        return String(value).toUpperCase();
      case 'trim':
        return String(value).trim();
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(Number(value) || 0);
      case 'percentage':
        return `${((Number(value) || 0) * 100).toFixed(2)}%`;
      default:
        return value;
    }
  }

  // Value sanitization
  sanitizeValue(value, rules) {
    if (value === undefined || value === null) {
      return value;
    }

    let sanitized = value;

    rules?.forEach(rule => {
      switch (rule.type) {
        case 'redact':
          if (rule.pattern?.test(String(sanitized))) {
            sanitized = '***REDACTED***';
          }
          break;
        case 'escape':
          sanitized = String(sanitized)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
          break;
        case 'truncate':
          if (rule.maxLength && String(sanitized).length > rule.maxLength) {
            sanitized = String(sanitized).substring(0, rule.maxLength) + '...';
          }
          break;
      }
    });

    return sanitized;
  }

  // Batch process multiple responses
  async processBatchResponses(responses, schema, options = {}) {
    const {
      concurrency = 5,
      stopOnError = false,
      ...processOptions
    } = options;

    const results = [];
    const errors = [];

    // Process responses in batches
    for (let i = 0; i < responses.length; i += concurrency) {
      const batch = responses.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (response, index) => {
          try {
            return await this.processResponse(response, schema, {
              ...processOptions,
              requestId: `batch_${i + index}`
            });
          } catch (error) {
            if (stopOnError) {
              throw error;
            }
            return {
              success: false,
              error: error.message,
              data: null
            };
          }
        })
      );

      batchResults.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({
            index: i + batchIndex,
            error: result.reason?.message ?? 'Unknown error'
          });
        }
      });

      if (stopOnError && errors.length > 0) {
        break;
      }
    }

    return {
      results,
      errors,
      total: responses.length,
      successful: results.filter(r => r.success).length,
      failed: errors.length
    };
  }
}

// Usage examples
function apiResponseHandlerDemo() {
  const responseHandler = new APIResponseHandler({
    defaultValues: {
      page: 1,
      limit: 20,
      sort: 'name',
      order: 'asc'
    },
    validation: {
      strict: true,
      logWarnings: true
    }
  });

  console.log('=== API Response Handler Demo ===');

  // Define response schema
  const userSchema = {
    required: ['data.id', 'data.attributes.username'],
    fields: [
      {
        path: 'data.id',
        name: 'id',
        transformations: [
          { type: 'type', target: 'number' }
        ]
      },
      {
        path: 'data.attributes.username',
        name: 'username',
        transformations: [
          { type: 'format', format: 'lowercase' },
          { type: 'format', format: 'trim' }
        ]
      },
      {
        path: 'data.attributes.email',
        name: 'email',
        transformations: [
          { type: 'format', format: 'lowercase' },
          { type: 'format', format: 'trim' },
          { 
            type: 'sanitize', 
            rules: [
              { type: 'redact', pattern: /token|password/i }
            ]
          }
        ]
      },
      {
        path: 'data.attributes.profile.avatar',
        name: 'avatarUrl',
        transformations: [
          { 
            type: 'default', 
            value: '/images/default-avatar.png' 
          }
        ]
      },
      {
        path: 'data.metadata.createdAt',
        name: 'createdAt',
        transformations: [
          { type: 'type', target: 'date' }
        ]
      }
    ],
    transformations: {
      fullName: (response) => {
        const firstName = responseHandler.getNestedValue(response, 'data.attributes.profile.firstName');
        const lastName = responseHandler.getNestedValue(response, 'data.attributes.profile.lastName');
        return [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      }
    }
  };

  // Test response processing
  const apiResponse = {
    data: {
      id: '123',
      type: 'users',
      attributes: {
        username: '  John_Doe  ',
        email: 'JOHN@EXAMPLE.COM',
        profile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      },
      metadata: {
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-12-01T00:00:00Z'
      }
    },
    meta: {
      pagination: {
        page: 1,
        limit: 10,
        total: 100
      },
      timestamp: '2023-12-01T12:00:00Z'
    },
    links: {
      self: '/api/users/123',
      next: '/api/users?page=2'
    }
  };

  const processed = responseHandler.processResponse(apiResponse, userSchema, {
    validate: true,
    transform: true,
    normalize: true,
    requestId: 'req_123'
  });

  console.log('Processed response:', JSON.stringify(processed, null, 2));

  // Test batch processing
  const batchResponses = [
    apiResponse,
    { data: null }, // Invalid response
    {
      data: {
        id: '124',
        attributes: {
          username: 'jane_doe'
        }
      }
    }
  ];

  responseHandler.processBatchResponses(batchResponses, userSchema, {
    concurrency: 2,
    stopOnError: false
  }).then(batchResult => {
    console.log('Batch processing result:', batchResult);
  });

  // Test safe nested value access
  const complexObject = {
    users: [
      {
        id: 1,
        profile: {
          contacts: [
            { type: 'email', value: 'test@example.com' },
            { type: 'phone', value: '+1234567890' }
          ]
        }
      }
    ]
  };

  const email = responseHandler.getNestedValue(
    complexObject, 
    'users[0].profile.contacts[0].value', 
    'default@example.com'
  );

  console.log('Extracted email:', email);
}

apiResponseHandlerDemo();

// ## 3. Configuration Management with Optional Chaining

// Advanced configuration management with optional chaining for safe access
class ConfigurationManager {
  constructor(config = {}) {
    this._config = this._deepFreeze(this._normalizeConfig(config));
    this._overrides = new Map();
    this._validators = new Map();
    this._watchers = new Map();
  }

  // Safe configuration access with optional chaining
  get(path, defaultValue = undefined) {
    if (!path || typeof path !== 'string') {
      return defaultValue;
    }

    // Check overrides first
    const overrideValue = this._getOverrideValue(path);
    if (overrideValue !== undefined) {
      return overrideValue;
    }

    // Safe nested access with optional chaining
    const value = path.split('.').reduce((current, key) => {
      // Handle array indices
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current?.[arrayKey]?.[parseInt(index)];
      }
      
      return current?.[key];
    }, this._config);

    return value !== undefined ? value : defaultValue;
  }

  // Safe configuration access with type coercion
  getString(path, defaultValue = '') {
    const value = this.get(path, defaultValue);
    return String(value ?? '');
  }

  getNumber(path, defaultValue = 0) {
    const value = this.get(path, defaultValue);
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  getBoolean(path, defaultValue = false) {
    const value = this.get(path, defaultValue);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  getArray(path, defaultValue = []) {
    const value = this.get(path, defaultValue);
    return Array.isArray(value) ? value : defaultValue;
  }

  getObject(path, defaultValue = {}) {
    const value = this.get(path, defaultValue);
    return value && typeof value === 'object' && !Array.isArray(value) 
      ? value 
      : defaultValue;
  }

  // Check if configuration path exists and has value
  has(path) {
    const value = this.get(path);
    return value !== undefined && value !== null;
  }

  // Set configuration override with validation
  setOverride(path, value, options = {}) {
    const {
      validate = true,
      temporary = false,
      ...overrideOptions
    } = options;

    // Validate value if validator exists
    if (validate) {
      const validator = this._validators.get(path);
      if (validator && !validator(value)) {
        throw new Error(`Validation failed for configuration path: ${path}`);
      }
    }

    const override = {
      value,
      temporary,
      setAt: new Date(),
      ...overrideOptions
    };

    this._overrides.set(path, override);

    // Notify watchers
    this._notifyWatchers(path, value, 'override');

    return this;
  }

  // Remove configuration override
  clearOverride(path) {
    const hadOverride = this._overrides.has(path);
    
    if (hadOverride) {
      const oldValue = this._overrides.get(path).value;
      this._overrides.delete(path);
      
      // Notify watchers of removal
      this._notifyWatchers(path, oldValue, 'clear_override');
    }

    return hadOverride;
  }

  // Clear all temporary overrides
  clearTemporaryOverrides() {
    const cleared = [];
    
    for (const [path, override] of this._overrides.entries()) {
      if (override.temporary) {
        this._overrides.delete(path);
        cleared.push(path);
      }
    }

    return cleared;
  }

  // Add configuration validator
  addValidator(path, validator) {
    this._validators.set(path, validator);
    return this;
  }

  // Watch for configuration changes
  watch(path, callback, options = {}) {
    const {
      immediate = false,
      once = false,
      ...watchOptions
    } = options;

    if (!this._watchers.has(path)) {
      this._watchers.set(path, []);
    }

    const watcher = {
      callback,
      once,
      options: watchOptions
    };

    this._watchers.get(path).push(watcher);

    // Immediate callback with current value
    if (immediate) {
      const currentValue = this.get(path);
      callback(currentValue, undefined, 'immediate');
    }

    // Return unwatch function
    return () => {
      const watchers = this._watchers.get(path);
      if (watchers) {
        const index = watchers.indexOf(watcher);
        if (index > -1) {
          watchers.splice(index, 1);
        }
        if (watchers.length === 0) {
          this._watchers.delete(path);
        }
      }
    };
  }

  // Create scoped configuration
  createScope(prefix, overrides = {}) {
    const scopedConfig = new ConfigurationManager(this._config);
    
    // Apply scope-specific overrides
    Object.keys(overrides).forEach(key => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      scopedConfig.setOverride(fullPath, overrides[key], { temporary: true });
    });

    // Proxy methods to work within scope
    const proxyHandler = {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }
        
        // Intercept get methods to add prefix
        if (prop.startsWith('get')) {
          return (path, ...args) => {
            const scopedPath = prefix ? `${prefix}.${path}` : path;
            return target[prop](scopedPath, ...args);
          };
        }
        
        return undefined;
      }
    };

    return new Proxy(scopedConfig, proxyHandler);
  }

  // Merge configurations with safe optional chaining
  merge(config, options = {}) {
    const {
      strategy = 'deep', // 'deep', 'shallow', 'overwrite'
      priority = 'source', // 'source', 'target'
      ...mergeOptions
    } = options;

    const merged = this._deepClone(this._config);

    this._mergeObjects(merged, config, strategy, priority);

    return new ConfigurationManager(merged);
  }

  // Validate entire configuration
  validate() {
    const errors = [];

    for (const [path, validator] of this._validators.entries()) {
      const value = this.get(path);
      
      if (value !== undefined && !validator(value)) {
        errors.push(`Validation failed for ${path}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Export configuration for different environments
  toEnvironment(environment, options = {}) {
    const {
      includeOverrides = true,
      redactSensitive = true,
      ...exportOptions
    } = options;

    const config = { ...this._config };

    // Apply environment-specific transformations
    if (environment === 'production' && redactSensitive) {
      this._redactSensitiveData(config);
    }

    // Include overrides if requested
    if (includeOverrides) {
      for (const [path, override] of this._overrides.entries()) {
        this._setNestedValue(config, path, override.value);
      }
    }

    return config;
  }

  // Private methods
  _getOverrideValue(path) {
    const override = this._overrides.get(path);
    return override?.value;
  }

  _notifyWatchers(path, newValue, changeType) {
    const watchers = this._watchers.get(path);
    
    if (watchers) {
      const oldValue = this.get(path);
      
      watchers.forEach((watcher, index) => {
        try {
          watcher.callback(newValue, oldValue, changeType);
          
          // Remove once watchers
          if (watcher.once) {
            watchers.splice(index, 1);
          }
        } catch (error) {
          console.error('Configuration watcher error:', error);
        }
      });

      // Clean up empty watcher arrays
      if (watchers.length === 0) {
        this._watchers.delete(path);
      }
    }
  }

  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  _normalizeConfig(config) {
    const normalized = { ...config };

    // Ensure required structure exists
    normalized.database = normalized.database ?? {};
    normalized.server = normalized.server ?? {};
    normalized.security = normalized.security ?? {};
    normalized.features = normalized.features ?? {};

    return normalized;
  }

  _deepFreeze(obj) {
    Object.freeze(obj);
    
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj[prop] !== null && 
          (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') && 
          !Object.isFrozen(obj[prop])) {
        this._deepFreeze(obj[prop]);
      }
    });
    
    return obj;
  }

  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => this._deepClone(item));
    
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = this._deepClone(obj[key]);
    });
    
    return cloned;
  }

  _mergeObjects(target, source, strategy, priority) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (strategy === 'deep' && 
          sourceValue && typeof sourceValue === 'object' && 
          targetValue && typeof targetValue === 'object' &&
          !Array.isArray(sourceValue) && !Array.isArray(targetValue)) {
        // Deep merge objects
        this._mergeObjects(targetValue, sourceValue, strategy, priority);
      } else {
        // Overwrite based on priority
        if (priority === 'source' || targetValue === undefined) {
          target[key] = sourceValue;
        }
      }
    });
  }

  _redactSensitiveData(config) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i
    ];

    const redact = (obj) => {
      Object.keys(obj).forEach(key => {
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          obj[key] = '***REDACTED***';
        } else if (obj[key] && typeof obj[key] === 'object') {
          redact(obj[key]);
        }
      });
    };

    redact(config);
  }

  // Static factory methods
  static fromEnv(prefix = 'APP_') {
    const config = {};

    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length)
          .toLowerCase()
          .split('_')
          .reduce((result, part, index) => {
            if (index === 0) return part;
            return result + part.charAt(0).toUpperCase() + part.slice(1);
          }, '');

        let value = process.env[key];

        // Type conversion
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(value) && value !== '') value = Number(value);

        config[configKey] = value;
      }
    });

    return new ConfigurationManager(config);
  }

  static fromFile(filePath, options = {}) {
    const { watch = false, ...fileOptions } = options;
    
    try {
      const config = require(filePath);
      const manager = new ConfigurationManager(config);

      if (watch) {
        // Set up file watching for hot reload
        const fs = require('fs');
        fs.watchFile(filePath, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            try {
              delete require.cache[require.resolve(filePath)];
              const newConfig = require(filePath);
              // Would need to implement hot reload logic
              console.log('Configuration file changed, reload required');
            } catch (error) {
              console.error('Failed to reload configuration:', error);
            }
          }
        });
      }

      return manager;
    } catch (error) {
      throw new Error(`Failed to load configuration from ${filePath}: ${error.message}`);
    }
  }
}

// Usage examples
function configurationManagerDemo() {
  console.log('=== Configuration Manager Demo ===');

  // Create configuration manager
  const config = new ConfigurationManager({
    app: {
      name: 'MyApp',
      version: '1.0.0',
      environment: 'development'
    },
    server: {
      port: 3000,
      host: 'localhost',
      cors: {
        origins: ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      }
    },
    database: {
      host: 'localhost',
      port: 5432,
      name: 'myapp',
      username: 'admin',
      password: 'secret123',
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000
      }
    },
    features: {
      caching: true,
      compression: true,
      rateLimiting: {
        enabled: true,
        maxRequests: 100,
        windowMs: 900000
      }
    }
  });

  // Test safe configuration access
  console.log('Server port:', config.get('server.port'));
  console.log('Database host:', config.get('database.host'));
  console.log('Non-existent path:', config.get('non.existent.path', 'default-value'));

  // Test typed accessors
  console.log('Caching enabled:', config.getBoolean('features.caching'));
  console.log('CORS origins:', config.getArray('server.cors.origins'));
  console.log('Database pool config:', config.getObject('database.pool'));

  // Test overrides
  config.setOverride('server.port', 8080, { temporary: true });
  console.log('Overridden port:', config.get('server.port'));

  // Test scoped configuration
  const dbConfig = config.createScope('database', { port: 5433 });
  console.log('Scoped DB port:', dbConfig.get('port'));
  console.log('Scoped DB host:', dbConfig.get('host'));

  // Test validation
  config.addValidator('server.port', (port) => port > 0 && port < 65536);
  
  try {
    config.setOverride('server.port', 70000); // Should fail validation
  } catch (error) {
    console.log('Validation error:', error.message);
  }

  // Test watching
  const unwatch = config.watch('server.port', (newValue, oldValue) => {
    console.log(`Port changed from ${oldValue} to ${newValue}`);
  }, { immediate: true });

  // Test environment export
  const productionConfig = config.toEnvironment('production');
  console.log('Production config (redacted):', JSON.stringify(productionConfig, null, 2));

  // Test from environment variables
  process.env.APP_SERVER_PORT = '4000';
  process.env.APP_DATABASE_HOST = 'prod-db.example.com';
  
  const envConfig = ConfigurationManager.fromEnv('APP_');
  console.log('Env config server port:', envConfig.get('server.port'));
  console.log('Env config DB host:', envConfig.get('database.host'));
}

configurationManagerDemo();

// ## 4. Error Handling and Safe Operations with Optional Chaining

// Comprehensive error handling with optional chaining for safe operations
class SafeOperationHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      timeout: 5000,
      logErrors: true,
      throwOnCritical: true,
      defaultValues: {},
      ...options
    };

    this.retryStrategies = new Map();
    this.circuitBreakers = new Map();
    this.fallbacks = new Map();

    this._setupDefaultRetryStrategies();
  }

  // Execute operation with comprehensive error handling and optional chaining
  async execute(operation, context = {}) {
    const {
      operationName = 'unknown',
      maxRetries = this.options.maxRetries,
      timeout = this.options.timeout,
      fallback = null,
      critical = false,
      ...operationContext
    } = context;

    const circuitBreaker = this._getCircuitBreaker(operationName);
    
    // Check circuit breaker
    if (circuitBreaker?.isOpen()) {
      throw new Error(`Circuit breaker is open for ${operationName}`);
    }

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;

      try {
        // Set timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Operation ${operationName} timed out`)), timeout);
        });

        // Execute operation with timeout
        const result = await Promise.race([
          operation(operationContext),
          timeoutPromise
        ]);

        // Record success
        circuitBreaker?.recordSuccess();
        
        if (this.options.logErrors) {
          console.log(`Operation ${operationName} succeeded on attempt ${attempt}`);
        }

        return result;

      } catch (error) {
        lastError = error;
        
        // Record failure
        circuitBreaker?.recordFailure();

        if (this.options.logErrors) {
          console.error(`Operation ${operationName} failed on attempt ${attempt}:`, error.message);
        }

        // Check if we should retry
        const shouldRetry = attempt < maxRetries && this._shouldRetry(error, attempt);
        
        if (!shouldRetry) {
          break;
        }

        // Calculate retry delay
        const delay = this._calculateRetryDelay(attempt, operationName);
        if (delay > 0) {
          await this._sleep(delay);
        }
      }
    }

    // All retries failed, try fallback
    if (fallback) {
      try {
        console.warn(`Using fallback for ${operationName}`);
        return await fallback(operationContext, lastError);
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }

    // Handle final failure
    return this._handleFailure(operationName, lastError, critical, context);
  }

  // Safe data processing with optional chaining
  async processData(data, processors, context = {}) {
    const {
      stopOnError = false,
      validateInput = true,
      validateOutput = true,
      ...processContext
    } = context;

    let currentData = data;
    const results = [];
    const errors = [];

    // Validate input
    if (validateInput) {
      const validation = this._validateData(currentData, processContext.inputSchema);
      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }
    }

    for (const [index, processor] of processors.entries()) {
      const processorName = processor.name || `processor_${index}`;

      try {
        const result = await this.execute(
          async (ctx) => processor.fn(currentData, ctx),
          {
            operationName: processorName,
            fallback: processor.fallback,
            ...processContext
          }
        );

        currentData = result?.data ?? result ?? currentData;
        results.push({
          processor: processorName,
          success: true,
          data: currentData,
          metadata: result?.metadata
        });

      } catch (error) {
        errors.push({
          processor: processorName,
          error: error.message,
          data: currentData
        });

        if (stopOnError) {
          break;
        }

        // Continue with next processor even if one fails
        continue;
      }
    }

    // Validate output
    if (validateOutput && errors.length === 0) {
      const validation = this._validateData(currentData, processContext.outputSchema);
      if (!validation.isValid) {
        errors.push({
          processor: 'output_validation',
          error: `Output validation failed: ${validation.errors.join(', ')}`,
          data: currentData
        });
      }
    }

    return {
      success: errors.length === 0,
      data: currentData,
      results,
      errors,
      metadata: {
        totalProcessors: processors.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  // Safe batch operations with optional chaining
  async processBatch(items, processor, options = {}) {
    const {
      batchSize = 10,
      concurrency = 3,
      stopOnBatchError = false,
      ...batchOptions
    } = options;

    const results = [];
    const errors = [];
    const batches = [];

    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += concurrency) {
      const currentBatches = batches.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        currentBatches.map(async (batch, batchIndex) => {
          const batchNumber = i + batchIndex + 1;
          
          try {
            const result = await this.processData(
              batch,
              [{ fn: processor }],
              {
                operationName: `batch_${batchNumber}`,
                ...batchOptions
              }
            );

            return {
              batch: batchNumber,
              success: true,
              data: result.data,
              metadata: result.metadata
            };

          } catch (error) {
            if (stopOnBatchError) {
              throw error;
            }
            
            return {
              batch: batchNumber,
              success: false,
              error: error.message,
              data: batch
            };
          }
        })
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.success) {
            results.push(value);
          } else {
            errors.push(value);
          }
        } else {
          errors.push({
            batch: i + index + 1,
            success: false,
            error: result.reason?.message ?? 'Unknown error'
          });
        }
      });

      if (stopOnBatchError && errors.length > 0) {
        break;
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      metadata: {
        totalItems: items.length,
        totalBatches: batches.length,
        processedBatches: results.length + errors.length,
        successfulBatches: results.length,
        failedBatches: errors.length
      }
    };
  }

  // Safe property access with comprehensive error handling
  safeAccess(obj, path, options = {}) {
    const {
      defaultValue = undefined,
      throwOnError = false,
      logErrors = true,
      ...accessOptions
    } = options;

    try {
      if (!obj || typeof obj !== 'object') {
        throw new Error('Invalid object provided');
      }

      if (!path || typeof path !== 'string') {
        throw new Error('Invalid path provided');
      }

      const value = path.split('.').reduce((current, key) => {
        // Handle array indices
        const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayKey, index] = arrayMatch;
          const array = current?.[arrayKey];
          
          if (!Array.isArray(array)) {
            throw new Error(`Expected array at ${arrayKey}, got ${typeof array}`);
          }
          
          const item = array?.[parseInt(index)];
          if (item === undefined) {
            throw new Error(`Index ${index} out of bounds for array ${arrayKey}`);
          }
          
          return item;
        }
        
        // Handle regular properties
        if (current?.[key] === undefined) {
          throw new Error(`Property ${key} not found`);
        }
        
        return current[key];
      }, obj);

      return value;

    } catch (error) {
      if (logErrors) {
        console.warn(`Safe access failed for path "${path}":`, error.message);
      }

      if (throwOnError) {
        throw error;
      }

      return defaultValue;
    }
  }

  // Safe function execution with optional chaining
  safeCall(fn, args = [], context = {}) {
    const {
      defaultValue = undefined,
      throwOnError = false,
      bindTo = null,
      ...callContext
    } = context;

    try {
      if (typeof fn !== 'function') {
        throw new Error('Provided value is not a function');
      }

      const boundFn = bindTo ? fn.bind(bindTo) : fn;
      const result = boundFn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch(error => {
          if (throwOnError) throw error;
          return defaultValue;
        });
      }

      return result;

    } catch (error) {
      if (throwOnError) {
        throw error;
      }

      return defaultValue;
    }
  }

  // Add retry strategy for specific error types
  addRetryStrategy(errorPattern, strategy) {
    this.retryStrategies.set(errorPattern, strategy);
    return this;
  }

  // Add circuit breaker for operation
  addCircuitBreaker(operationName, options = {}) {
    const circuitBreaker = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 3,
      timeout: options.timeout ?? 60000,
      failures: 0,
      successes: 0,
      state: 'CLOSED',
      lastFailure: null,
      
      isOpen() {
        if (this.state === 'OPEN') {
          const timeSinceFailure = Date.now() - this.lastFailure;
          if (timeSinceFailure > this.timeout) {
            this.state = 'HALF_OPEN';
          }
        }
        return this.state === 'OPEN';
      },
      
      recordSuccess() {
        this.successes++;
        this.failures = 0;
        
        if (this.state === 'HALF_OPEN' && this.successes >= this.successThreshold) {
          this.state = 'CLOSED';
          this.successes = 0;
        }
      },
      
      recordFailure() {
        this.failures++;
        this.successes = 0;
        this.lastFailure = Date.now();
        
        if (this.failures >= this.failureThreshold) {
          this.state = 'OPEN';
        }
      }
    };

    this.circuitBreakers.set(operationName, circuitBreaker);
    return this;
  }

  // Private methods
  _setupDefaultRetryStrategies() {
    // Retry on network errors
    this.addRetryStrategy(/network|timeout|connection/i, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    });

    // Retry on temporary server errors
    this.addRetryStrategy(/5\d{2}/, {
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 5000
    });
  }

  _getCircuitBreaker(operationName) {
    return this.circuitBreakers.get(operationName);
  }

  _shouldRetry(error, attempt) {
    const errorMessage = error.message;
    
    for (const [pattern, strategy] of this.retryStrategies.entries()) {
      if (pattern.test(errorMessage) && attempt <= strategy.maxRetries) {
        return true;
      }
    }
    
    // Don't retry client errors (4xx) except 429 (rate limit)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    
    return true;
  }

  _calculateRetryDelay(attempt, operationName) {
    const strategy = Array.from(this.retryStrategies.values())
      .find(s => s.maxRetries >= attempt);

    if (strategy) {
      const delay = Math.min(
        strategy.baseDelay * Math.pow(2, attempt - 1),
        strategy.maxDelay
      );
      
      // Add jitter
      return delay * (0.5 + Math.random() * 0.5);
    }
    
    return 0;
  }

  _handleFailure(operationName, error, critical, context) {
    const failureContext = {
      operationName,
      error: error.message,
      timestamp: new Date().toISOString(),
      ...context
    };

    if (critical && this.options.throwOnCritical) {
      throw new Error(`Critical operation ${operationName} failed: ${error.message}`);
    }

    // Return safe default value
    const defaultValue = this.options.defaultValues[operationName];
    
    if (this.options.logErrors) {
      console.error(`Operation ${operationName} failed:`, error.message, failureContext);
    }

    return defaultValue;
  }

  _validateData(data, schema) {
    if (!schema) {
      return { isValid: true, errors: [] };
    }

    const errors = [];
    
    // Simple validation - in production, use a proper validation library
    if (schema.required) {
      schema.required.forEach(field => {
        if (this.safeAccess(data, field) === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage examples
async function safeOperationsDemo() {
  const handler = new SafeOperationHandler({
    maxRetries: 3,
    timeout: 3000,
    logErrors: true,
    defaultValues: {
      getUser: null,
      processData: {}
    }
  });

  console.log('=== Safe Operations Demo ===');

  // Test safe operation execution
  const result = await handler.execute(
    async () => {
      // Simulate API call
      await handler._sleep(100);
      return { data: { user: { id: 1, name: 'John' } } };
    },
    {
      operationName: 'getUser',
      fallback: async () => ({ data: { user: { id: 0, name: 'Fallback User' } } })
    }
  );

  console.log('Operation result:', result);

  // Test safe data processing
  const dataProcessors = [
    {
      name: 'validate',
      fn: async (data) => {
        if (!data?.user?.id) {
          throw new Error('Invalid user data');
        }
        return data;
      }
    },
    {
      name: 'transform',
      fn: async (data) => {
        return {
          ...data,
          user: {
            ...data.user,
            name: data.user.name.toUpperCase(),
            email: data.user.email?.toLowerCase() ?? 'default@example.com'
          }
        };
      }
    },
    {
      name: 'enrich',
      fn: async (data) => {
        // Simulate external API call
        await handler._sleep(50);
        return {
          ...data,
          metadata: {
            processedAt: new Date(),
            source: 'api'
          }
        };
      }
    }
  ];

  const testData = {
    user: {
      id: 1,
      name: 'john doe',
      email: 'JOHN@EXAMPLE.COM'
    }
  };

  const processed = await handler.processData(testData, dataProcessors, {
    stopOnError: false,
    inputSchema: {
      required: ['user.id', 'user.name']
    }
  });

  console.log('Processed data:', JSON.stringify(processed, null, 2));

  // Test batch processing
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, value: `item_${i + 1}` }));
  
  const batchResult = await handler.processBatch(
    items,
    async (batch) => {
      // Process each batch
      return batch.map(item => ({
        ...item,
        processed: true,
        timestamp: new Date()
      }));
    },
    {
      batchSize: 5,
      concurrency: 2
    }
  );

  console.log('Batch processing:', {
    total: batchResult.metadata.totalItems,
    successful: batchResult.metadata.successfulBatches,
    failed: batchResult.metadata.failedBatches
  });

  // Test safe property access
  const complexObject = {
    users: [
      {
        id: 1,
        profile: {
          contacts: [
            { type: 'email', value: 'test@example.com' }
          ]
        }
      }
    ]
  };

  const email = handler.safeAccess(complexObject, 'users[0].profile.contacts[0].value', {
    defaultValue: 'default@example.com'
  });

  console.log('Safe access result:', email);

  // Test safe function call
  const dangerousFn = (a, b) => {
    if (a === 0) throw new Error('Division by zero');
    return b / a;
  };

  const safeResult = handler.safeCall(dangerousFn, [0, 10], {
    defaultValue: 0
  });

  console.log('Safe function result:', safeResult);
}

safeOperationsDemo();

// These comprehensive code snippets demonstrate the optional chaining operator in Node.js production-grade backend development across:

// 1. **Database Operations** - Safe nested data access in database queries and transactions
// 2. **API Response Handling** - Robust response processing with safe property access
// 3. **Configuration Management** - Safe configuration access with overrides and validation
// 4. **Error Handling & Safe Operations** - Comprehensive error handling with fallbacks and retries

// These patterns ensure robust, maintainable, and safe code by leveraging optional chaining to prevent runtime errors from undefined or null properties.





























// Here are comprehensive code snippets for object literal syntax extensions in Node.js production-grade backend development:

// ## 1. Enhanced Configuration Management with Object Literal Extensions

// Advanced configuration management using modern object literal syntax
class ConfigBuilder {
  constructor(baseConfig = {}) {
    this.config = { ...baseConfig };
    this.validationRules = new Map();
    this.transformers = new Map();
  }

  // Enhanced object literal methods for configuration building
  buildProductionConfig(environment = 'production') {
    const databaseConfig = {
      // Property value shorthands
      environment,
      timestamp: new Date().toISOString(),
      
      // Method definitions shorthand
      validate() {
        return this.host && this.database && this.username;
      },
      
      // Computed property names
      [`${environment}_connection_string`]: function() {
        return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}`;
      },
      
      // Object spread for defaults
      ...this.getDatabaseDefaults(environment),
    };

    // Enhanced configuration with nested object literals
    const productionConfig = {
      // Basic properties
      name: 'Production API',
      version: process.env.APP_VERSION || '1.0.0',
      
      // Nested objects with enhanced syntax
      server: {
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        // Method in nested object
        getFullAddress() {
          return `http://${this.host}:${this.port}`;
        }
      },
      
      // Database configuration using computed properties
      database: {
        ...databaseConfig,
        // Dynamic property names based on environment
        [`max_connections_${environment}`]: environment === 'production' ? 100 : 20,
        
        // Enhanced connection options
        connection: {
          pool: {
            min: 2,
            max: environment === 'production' ? 20 : 5,
            acquire: 30000,
            idle: 10000,
          },
          // Computed property for SSL
          ...(environment === 'production' && {
            ssl: {
              rejectUnauthorized: false,
              ca: process.env.DB_SSL_CA
            }
          })
        }
      },
      
      // Security configuration with computed properties
      security: {
        jwt: {
          secret: process.env.JWT_SECRET,
          expiresIn: '24h',
          issuer: 'myapp.com',
          // Dynamic audience based on environment
          audience: environment === 'production' ? 'https://api.myapp.com' : 'http://localhost:3000'
        },
        cors: {
          origins: [
            environment === 'production' 
              ? 'https://myapp.com' 
              : 'http://localhost:3000'
          ],
          credentials: true,
        },
        rateLimit: {
          windowMs: 15 * 60 * 1000,
          max: environment === 'production' ? 100 : 1000
        }
      },
      
      // Features with feature flags
      features: {
        // Using nullish coalescing for feature flags
        caching: process.env.ENABLE_CACHING ?? true,
        compression: process.env.ENABLE_COMPRESSION ?? true,
        websockets: process.env.ENABLE_WEBSOCKETS ?? false,
        
        // Computed feature names
        [`${environment}_features`]: this.getEnabledFeatures(environment),
        
        // Method to check feature availability
        isEnabled(feature) {
          return this[feature] === true;
        }
      },
      
      // Monitoring and logging
      monitoring: {
        enabled: environment === 'production',
        // Dynamic property names for different environments
        ...this.getMonitoringConfig(environment),
        
        // Method to get metrics configuration
        getMetricsConfig() {
          return {
            interval: this.enabled ? 60000 : 300000,
            retention: this.enabled ? '30d' : '7d'
          };
        }
      },
      
      // Utility methods
      toSafeJSON() {
        const safeConfig = { ...this };
        // Remove sensitive data
        if (safeConfig.database?.password) {
          safeConfig.database.password = '***';
        }
        if (safeConfig.security?.jwt?.secret) {
          safeConfig.security.jwt.secret = '***';
        }
        return safeConfig;
      },
      
      // Dynamic validation method
      validateConfig() {
        const errors = [];
        if (!this.database?.validate?.()) {
          errors.push('Database configuration is invalid');
        }
        if (!this.security?.jwt?.secret) {
          errors.push('JWT secret is required');
        }
        return errors;
      }
    };

    return productionConfig;
  }

  // Factory method using enhanced object literals
  static createFromEnv() {
    const env = process.env.NODE_ENV || 'development';
    
    const config = {
      // Property value shorthand
      env,
      
      // Computed property names based on environment
      [`is${env.charAt(0).toUpperCase() + env.slice(1)}`]: true,
      
      // Services configuration with enhanced syntax
      services: {
        database: {
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT) || 5432,
          database: process.env.DB_NAME,
          username: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          
          // Method to get connection string
          getConnectionString() {
            return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}`;
          }
        },
        
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          // Optional configuration using nullish coalescing
          password: process.env.REDIS_PASSWORD ?? null,
          
          // Computed property for key prefixes
          get keyPrefix() {
            return `${this.host}:${process.env.NODE_ENV || 'development'}:`;
          }
        },
        
        email: {
          provider: process.env.EMAIL_PROVIDER || 'smtp',
          apiKey: process.env.EMAIL_API_KEY,
          from: process.env.EMAIL_FROM || 'noreply@example.com',
          
          // Method to validate email configuration
          isValid() {
            return this.provider && this.from;
          }
        }
      },
      
      // Feature toggles with computed properties
      features: Object.fromEntries(
        Object.entries(process.env)
          .filter(([key]) => key.startsWith('FEATURE_'))
          .map(([key, value]) => [
            key.replace('FEATURE_', '').toLowerCase(),
            value === 'true' || value === '1'
          ])
      ),
      
      // Utility methods
      getServiceConfig(serviceName) {
        return this.services?.[serviceName] || {};
      },
      
      isFeatureEnabled(feature) {
        return this.features?.[feature] === true;
      },
      
      // Enhanced toString method
      toString() {
        return `Config(env: ${this.env}, services: ${Object.keys(this.services).join(', ')})`;
      }
    };

    return config;
  }

  // Method to create dynamic configuration based on inputs
  createDynamicConfig(inputs = {}) {
    const { region, tier, features = [] } = inputs;
    
    return {
      // Basic properties
      region,
      tier,
      deployedAt: new Date(),
      
      // Computed properties based on inputs
      ...(region && { [`${region}_config`]: this.getRegionConfig(region) }),
      ...(tier && { 
        resources: this.getTierResources(tier),
        scaling: this.getScalingConfig(tier)
      }),
      
      // Features with dynamic enabling
      enabledFeatures: features.reduce((acc, feature) => ({
        ...acc,
        [feature]: true
      }), {}),
      
      // Dynamic methods based on configuration
      ...this.createDynamicMethods(inputs),
      
      // Validation
      isValid() {
        return this.region && this.tier && Object.keys(this.enabledFeatures).length > 0;
      },
      
      // Serialization
      toDeploymentConfig() {
        return {
          region: this.region,
          tier: this.tier,
          features: Object.keys(this.enabledFeatures),
          resources: this.resources,
          timestamp: this.deployedAt.toISOString()
        };
      }
    };
  }

  // Private helper methods
  getDatabaseDefaults(environment) {
    const defaults = {
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '',
      database: 'app_db'
    };
    
    return {
      ...defaults,
      ...(environment === 'production' && {
        host: process.env.DB_HOST || 'prod-db.example.com',
        username: process.env.DB_USER || 'app_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'app_production'
      })
    };
  }

  getEnabledFeatures(environment) {
    const baseFeatures = ['authentication', 'authorization', 'logging'];
    const productionFeatures = ['monitoring', 'caching', 'compression', 'rate-limiting'];
    
    return [
      ...baseFeatures,
      ...(environment === 'production' ? productionFeatures : [])
    ];
  }

  getMonitoringConfig(environment) {
    if (environment === 'production') {
      return {
        metrics: {
          enabled: true,
          endpoint: '/metrics',
          collectDefaultMetrics: true
        },
        healthChecks: {
          enabled: true,
          endpoint: '/health',
          timeout: 5000
        }
      };
    }
    
    return {
      metrics: { enabled: false },
      healthChecks: { enabled: true, endpoint: '/health' }
    };
  }

  getRegionConfig(region) {
    const regions = {
      'us-east-1': { timezone: 'America/New_York', locale: 'en-US' },
      'eu-west-1': { timezone: 'Europe/Dublin', locale: 'en-IE' },
      'ap-southeast-1': { timezone: 'Asia/Singapore', locale: 'en-SG' }
    };
    
    return regions[region] || { timezone: 'UTC', locale: 'en-US' };
  }

  getTierResources(tier) {
    const tiers = {
      basic: { cpu: '1', memory: '2Gi', storage: '10Gi' },
      standard: { cpu: '2', memory: '4Gi', storage: '50Gi' },
      premium: { cpu: '4', memory: '8Gi', storage: '100Gi' }
    };
    
    return tiers[tier] || tiers.basic;
  }

  getScalingConfig(tier) {
    const scaling = {
      basic: { minReplicas: 1, maxReplicas: 3, targetCPU: 80 },
      standard: { minReplicas: 2, maxReplicas: 10, targetCPU: 70 },
      premium: { minReplicas: 3, maxReplicas: 20, targetCPU: 60 }
    };
    
    return scaling[tier] || scaling.basic;
  }

  createDynamicMethods(inputs) {
    const methods = {};
    
    if (inputs.features.includes('caching')) {
      methods.getCacheConfig = function() {
        return {
          ttl: 300, // 5 minutes
          maxSize: 1000,
          strategy: 'lru'
        };
      };
    }
    
    if (inputs.features.includes('background-jobs')) {
      methods.getQueueConfig = function() {
        return {
          concurrency: 5,
          attempts: 3,
          backoff: 'exponential'
        };
      };
    }
    
    return methods;
  }
}

// Usage examples
function configBuilderDemo() {
  console.log('=== Config Builder Demo ===');
  
  const builder = new ConfigBuilder();
  
  // Build production configuration
  const productionConfig = builder.buildProductionConfig('production');
  console.log('Production Config:', JSON.stringify(productionConfig.toSafeJSON(), null, 2));
  
  // Test configuration validation
  const validationErrors = productionConfig.validateConfig();
  console.log('Validation Errors:', validationErrors);
  
  // Create from environment variables
  process.env.NODE_ENV = 'development';
  process.env.DB_HOST = 'localhost';
  process.env.DB_USER = 'dev_user';
  process.env.FEATURE_CACHING = 'true';
  process.env.FEATURE_WEBSOCKETS = 'false';
  
  const envConfig = ConfigBuilder.createFromEnv();
  console.log('Environment Config:', envConfig.toString());
  console.log('Is caching enabled?', envConfig.isFeatureEnabled('caching'));
  console.log('Database connection:', envConfig.getServiceConfig('database').getConnectionString());
  
  // Create dynamic configuration
  const dynamicConfig = builder.createDynamicConfig({
    region: 'us-east-1',
    tier: 'standard',
    features: ['caching', 'background-jobs', 'api-gateway']
  });
  
  console.log('Dynamic Config:', dynamicConfig.toDeploymentConfig());
  console.log('Is valid?', dynamicConfig.isValid());
  
  if (dynamicConfig.getCacheConfig) {
    console.log('Cache Config:', dynamicConfig.getCacheConfig());
  }
  
  if (dynamicConfig.getQueueConfig) {
    console.log('Queue Config:', dynamicConfig.getQueueConfig());
  }
}

configBuilderDemo();

// ## 2. Enhanced API Response Builder with Object Literal Extensions

// Advanced API response builder using modern object literal syntax
class APIResponseBuilder {
  constructor(options = {}) {
    this.options = {
      includeMetadata: true,
      includeLinks: true,
      camelCase: true,
      ...options
    };
    
    this.transformers = new Map();
    this.validators = new Map();
  }

  // Enhanced success response with object literal extensions
  success(data, meta = {}) {
    const {
      message = 'Operation completed successfully',
      statusCode = 200,
      pagination,
      ...responseMeta
    } = meta;

    const response = {
      // Basic response structure
      success: true,
      data,
      message,
      
      // Metadata with enhanced syntax
      ...(this.options.includeMetadata && {
        meta: {
          timestamp: new Date().toISOString(),
          statusCode,
          ...responseMeta,
          
          // Computed properties for pagination
          ...(pagination && {
            pagination: {
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              pages: Math.ceil(pagination.total / pagination.limit),
              // Method to generate pagination links
              getOffset() {
                return (this.page - 1) * this.limit;
              }
            }
          })
        }
      }),
      
      // Links with computed properties
      ...(this.options.includeLinks && {
        links: {
          self: meta.requestUrl,
          ...this.generateResourceLinks(data, meta)
        }
      }),
      
      // Utility methods
      toJSON() {
        const json = { ...this };
        // Remove methods for JSON serialization
        delete json.toJSON;
        delete json.transform;
        if (json.meta?.pagination) {
          delete json.meta.pagination.getOffset;
        }
        return json;
      },
      
      // Transformation method
      transform(transformer) {
        if (typeof transformer === 'function') {
          return transformer(this);
        }
        return this;
      }
    };

    return this.applyCaseConversion(response);
  }

  // Enhanced error response
  error(error, meta = {}) {
    const {
      statusCode = 500,
      requestId,
      ...errorMeta
    } = meta;

    const errorResponse = {
      success: false,
      error: {
        // Error information with safe access
        message: error?.message || 'An unexpected error occurred',
        code: error?.code || 'INTERNAL_ERROR',
        ...(error?.details && { details: error.details }),
        
        // Computed property for error type
        get type() {
          return this.code?.endsWith('_ERROR') 
            ? this.code.replace('_ERROR', '').toLowerCase()
            : 'unknown';
        }
      },
      
      // Metadata
      ...(this.options.includeMetadata && {
        meta: {
          timestamp: new Date().toISOString(),
          statusCode,
          requestId,
          ...errorMeta
        }
      }),
      
      // Debug information in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          stack: error?.stack,
          ...errorMeta.debug
        }
      }),
      
      // Utility methods
      toClientSafe() {
        const safe = { ...this };
        // Remove sensitive debug information
        delete safe.debug;
        return safe;
      },
      
      log() {
        console.error(`[${this.meta.statusCode}] ${this.error.message}`, {
          code: this.error.code,
          requestId: this.meta.requestId,
          timestamp: this.meta.timestamp
        });
      }
    };

    return this.applyCaseConversion(errorResponse);
  }

  // Paginated response with enhanced object literals
  paginated(data, paginationInfo, meta = {}) {
    const {
      baseUrl,
      queryParams = {},
      ...responseMeta
    } = meta;

    const pagination = {
      page: paginationInfo.page,
      limit: paginationInfo.limit,
      total: paginationInfo.total,
      // Computed properties
      get pages() {
        return Math.ceil(this.total / this.limit);
      },
      get hasNext() {
        return this.page < this.pages;
      },
      get hasPrev() {
        return this.page > 1;
      }
    };

    const response = this.success(data, {
      ...responseMeta,
      pagination,
      // Enhanced links for pagination
      ...(baseUrl && {
        requestUrl: this.buildPaginatedUrl(baseUrl, paginationInfo.page, paginationInfo.limit, queryParams)
      })
    });

    // Enhance links with pagination
    if (response.links && baseUrl) {
      response.links = {
        ...response.links,
        first: this.buildPaginatedUrl(baseUrl, 1, paginationInfo.limit, queryParams),
        last: this.buildPaginatedUrl(baseUrl, pagination.pages, paginationInfo.limit, queryParams),
        ...(pagination.hasNext && {
          next: this.buildPaginatedUrl(baseUrl, paginationInfo.page + 1, paginationInfo.limit, queryParams)
        }),
        ...(pagination.hasPrev && {
          prev: this.buildPaginatedUrl(baseUrl, paginationInfo.page - 1, paginationInfo.limit, queryParams)
        })
      };
    }

    return response;
  }

  // Batch operation response
  batch(operations, meta = {}) {
    const results = operations.map(op => ({
      id: op.id,
      operation: op.type,
      status: op.status,
      ...(op.data && { data: op.data }),
      ...(op.error && { error: { message: op.error.message, code: op.error.code } }),
      // Computed property for quick status check
      get isSuccess() {
        return this.status === 'success';
      }
    }));

    const batchResponse = {
      batchId: meta.batchId || `batch_${Date.now()}`,
      processedAt: new Date().toISOString(),
      operations: results,
      
      // Computed statistics
      get statistics() {
        const total = this.operations.length;
        const successful = this.operations.filter(op => op.isSuccess).length;
        const failed = total - successful;
        
        return {
          total,
          successful,
          failed,
          successRate: total > 0 ? (successful / total) * 100 : 0
        };
      },
      
      // Utility methods
      getOperation(id) {
        return this.operations.find(op => op.id === id);
      },
      
      getFailedOperations() {
        return this.operations.filter(op => !op.isSuccess);
      },
      
      toSummary() {
        const stats = this.statistics;
        return {
          batchId: this.batchId,
          total: stats.total,
          successful: stats.successful,
          failed: stats.failed,
          successRate: `${stats.successRate.toFixed(2)}%`
        };
      }
    };

    return this.applyCaseConversion(batchResponse);
  }

  // Dynamic response builder based on content type
  createResponseBuilder(contentType) {
    const builders = {
      'application/json': this.buildJSONResponse.bind(this),
      'application/xml': this.buildXMLResponse.bind(this),
      'text/csv': this.buildCSVResponse.bind(this),
      'application/vnd.api+json': this.buildJSONAPIResponse.bind(this)
    };

    return builders[contentType] || builders['application/json'];
  }

  // JSON:API compliant response
  buildJSONAPIResponse(data, meta = {}) {
    const isArray = Array.isArray(data);
    
    const jsonApiResponse = {
      jsonapi: { version: '1.0' },
      // Dynamic data structure
      data: isArray ? data.map(item => this.buildJSONAPIResource(item)) : this.buildJSONAPIResource(data),
      
      // Included resources (for compound documents)
      ...(meta.included && {
        included: meta.included.map(item => this.buildJSONAPIResource(item))
      }),
      
      // JSON:API metadata
      meta: {
        ...meta,
        timestamp: new Date().toISOString()
      },
      
      // Links
      ...(meta.links && { links: meta.links }),
      
      // Utility methods
      toJSON() {
        return JSON.parse(JSON.stringify(this));
      }
    };

    return jsonApiResponse;
  }

  // Resource transformation for JSON:API
  buildJSONAPIResource(item) {
    if (!item) return null;
    
    return {
      type: item.type || item.constructor.name.toLowerCase(),
      id: item.id?.toString(),
      attributes: Object.entries(item).reduce((attrs, [key, value]) => {
        if (!['id', 'type'].includes(key)) {
          attrs[this.toCamelCase(key)] = value;
        }
        return attrs;
      }, {}),
      
      // Relationships
      ...(item.relationships && {
        relationships: item.relationships
      }),
      
      // Links
      ...(item.links && {
        links: item.links
      })
    };
  }

  // Helper methods
  buildPaginatedUrl(baseUrl, page, limit, queryParams = {}) {
    const url = new URL(baseUrl);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', limit.toString());
    
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    });
    
    return url.toString();
  }

  generateResourceLinks(data, meta) {
    const links = {};
    
    if (data?.id && meta.resourceType) {
      links.self = `/${meta.resourceType}/${data.id}`;
      
      if (meta.relationships) {
        Object.keys(meta.relationships).forEach(relation => {
          links[relation] = `/${meta.resourceType}/${data.id}/${relation}`;
        });
      }
    }
    
    return links;
  }

  applyCaseConversion(obj) {
    if (!this.options.camelCase) return obj;
    
    const convert = (value) => {
      if (Array.isArray(value)) {
        return value.map(convert);
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.entries(value).reduce((acc, [key, val]) => {
          acc[this.toCamelCase(key)] = convert(val);
          return acc;
        }, {});
      }
      return value;
    };
    
    return convert(obj);
  }

  toCamelCase(str) {
    return str.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
  }

  // Static factory methods
  static create(options = {}) {
    return new APIResponseBuilder(options);
  }

  static forContentType(contentType, options = {}) {
    const builder = new APIResponseBuilder(options);
    return builder.createResponseBuilder(contentType);
  }
}

// Enhanced service using object literal extensions
class APIService {
  constructor() {
    this.responseBuilder = APIResponseBuilder.create({
      includeMetadata: true,
      includeLinks: true,
      camelCase: true
    });
    
    this.middleware = [];
  }

  // Enhanced CRUD operations with object literal responses
  async findUsers(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      include = [],
      ...queryOptions
    } = options;

    try {
      // Simulate database query
      const { data, total } = await this.queryUsers(filters, {
        page,
        limit,
        ...queryOptions
      });

      // Enhanced response with object literal extensions
      return this.responseBuilder.paginated(data, {
        page,
        limit,
        total
      }, {
        baseUrl: '/api/users',
        queryParams: filters,
        resourceType: 'users',
        // Computed properties for metadata
        get queryTime() {
          return Date.now() - this.timestamp;
        }
      });

    } catch (error) {
      return this.responseBuilder.error(error, {
        statusCode: 500,
        requestId: `req_${Date.now()}`,
        operation: 'findUsers'
      });
    }
  }

  async createUser(userData, options = {}) {
    const {
      validate = true,
      sendWelcomeEmail = true,
      ...createOptions
    } = options;

    try {
      // Validation
      if (validate) {
        const validation = this.validateUserData(userData);
        if (!validation.isValid) {
          throw {
            message: 'User data validation failed',
            code: 'VALIDATION_ERROR',
            details: validation.errors
          };
        }
      }

      // Simulate user creation
      const user = await this.createUserInDatabase(userData);
      
      // Side effects
      if (sendWelcomeEmail) {
        await this.sendWelcomeEmail(user);
      }

      // Enhanced success response
      return this.responseBuilder.success(user, {
        statusCode: 201,
        message: 'User created successfully',
        resourceType: 'users',
        requestUrl: `/api/users/${user.id}`
      });

    } catch (error) {
      return this.responseBuilder.error(error, {
        statusCode: 400,
        requestId: `req_${Date.now()}`,
        operation: 'createUser'
      });
    }
  }

  async batchUpdateUsers(updates, options = {}) {
    const {
      validate = true,
      notifyUsers = false,
      ...batchOptions
    } = options;

    const operations = updates.map(update => ({
      id: update.userId,
      type: 'update',
      data: update.changes,
      // Enhanced operation object
      get description() {
        return `Update user ${this.id}`;
      }
    }));

    const results = await Promise.allSettled(
      operations.map(async (operation) => {
        try {
          if (validate) {
            const validation = this.validateUserData(operation.data);
            if (!validation.isValid) {
              throw {
                message: `Validation failed for user ${operation.id}`,
                code: 'VALIDATION_ERROR',
                details: validation.errors
              };
            }
          }

          const result = await this.updateUserInDatabase(operation.id, operation.data);
          
          if (notifyUsers) {
            await this.notifyUserUpdated(operation.id);
          }

          return {
            ...operation,
            status: 'success',
            data: result
          };

        } catch (error) {
          return {
            ...operation,
            status: 'error',
            error: {
              message: error.message,
              code: error.code
            }
          };
        }
      })
    );

    const completedOperations = results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        id: 'unknown',
        type: 'unknown',
        status: 'error',
        error: { message: result.reason?.message || 'Unknown error' }
      }
    );

    return this.responseBuilder.batch(completedOperations, {
      batchId: `batch_${Date.now()}`,
      operation: 'batchUpdateUsers'
    });
  }

  // Enhanced query method with object literal options
  async queryUsers(filters, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      fields = [],
      ...queryOptions
    } = options;

    // Enhanced query object using object literal extensions
    const query = {
      // Basic properties
      filters,
      pagination: { page, limit },
      sorting: { field: sort, order },
      
      // Computed properties
      get offset() {
        return (this.pagination.page - 1) * this.pagination.limit;
      },
      
      // Method to build database query
      toDatabaseQuery() {
        return {
          where: this.filters,
          limit: this.pagination.limit,
          offset: this.offset,
          order: [[this.sorting.field, this.sorting.order]],
          attributes: fields.length > 0 ? fields : undefined,
          ...queryOptions
        };
      },
      
      // Method to validate query
      validate() {
        const errors = [];
        if (this.pagination.page < 1) {
          errors.push('Page must be at least 1');
        }
        if (this.pagination.limit < 1 || this.pagination.limit > 100) {
          errors.push('Limit must be between 1 and 100');
        }
        return errors;
      }
    };

    // Validate query
    const validationErrors = query.validate();
    if (validationErrors.length > 0) {
      throw {
        message: 'Query validation failed',
        code: 'QUERY_VALIDATION_ERROR',
        details: validationErrors
      };
    }

    // Simulate database query
    const dbQuery = query.toDatabaseQuery();
    const { data, total } = await this.executeDatabaseQuery(dbQuery);

    return {
      data,
      total,
      query: dbQuery
    };
  }

  // Mock methods for demonstration
  async queryUsers(filters, options) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mockUsers = [
      { id: 1, name: 'John Doe', email: 'john@example.com', createdAt: new Date() },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date() }
    ];
    
    return {
      data: mockUsers,
      total: 2
    };
  }

  async createUserInDatabase(userData) {
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateUserInDatabase(userId, changes) {
    await new Promise(resolve => setTimeout(resolve, 30));
    return {
      id: userId,
      ...changes,
      updatedAt: new Date()
    };
  }

  async sendWelcomeEmail(user) {
    console.log(`Welcome email sent to ${user.email}`);
  }

  async notifyUserUpdated(userId) {
    console.log(`User ${userId} notified of update`);
  }

  validateUserData(userData) {
    const errors = [];
    
    if (!userData.email || !userData.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (!userData.name || userData.name.length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async executeDatabaseQuery(query) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      data: [{ id: 1, name: 'Test User' }],
      total: 1
    };
  }
}

// Usage examples
async function apiServiceDemo() {
  console.log('=== API Service Demo ===');
  
  const apiService = new APIService();
  
  // Test user query
  const usersResponse = await apiService.findUsers(
    { status: 'active' },
    { page: 1, limit: 10, include: ['profile'] }
  );
  
  console.log('Users Response:', JSON.stringify(usersResponse, null, 2));
  
  // Test user creation
  const createResponse = await apiService.createUser({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    profile: { avatar: 'default.jpg' }
  });
  
  console.log('Create Response:', JSON.stringify(createResponse, null, 2));
  
  // Test batch update
  const batchResponse = await apiService.batchUpdateUsers([
    { userId: 1, changes: { name: 'John Updated' } },
    { userId: 2, changes: { name: 'Jane Updated' } },
    { userId: 999, changes: {} } // This will fail
  ], {
    validate: true,
    notifyUsers: true
  });
  
  console.log('Batch Response:', JSON.stringify(batchResponse.toSummary(), null, 2));
  console.log('Failed Operations:', batchResponse.getFailedOperations());
  
  // Test JSON:API response
  const jsonApiBuilder = APIResponseBuilder.forContentType('application/vnd.api+json');
  const jsonApiResponse = jsonApiBuilder(
    { id: 1, type: 'users', name: 'Test User', email: 'test@example.com' },
    { included: [{ id: 1, type: 'profiles', bio: 'Test bio' }] }
  );
  
  console.log('JSON:API Response:', JSON.stringify(jsonApiResponse, null, 2));
}

apiServiceDemo();

// ## 3. Enhanced Database Model with Object Literal Extensions

// Advanced database model using modern object literal syntax
class DatabaseModel {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      timestamps: true,
      softDelete: false,
      validate: true,
      ...options
    };
    
    this.hooks = new Map();
    this.validators = new Map();
    this.transforms = new Map();
    
    this._setupDefaultHooks();
  }

  // Enhanced model instance creation
  create(data, options = {}) {
    const {
      validate = this.options.validate,
      transform = true,
      ...createOptions
    } = options;

    // Enhanced instance using object literal extensions
    const instance = {
      // Basic data
      ...data,
      
      // Metadata
      ...(this.options.timestamps && {
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      
      // Soft delete support
      ...(this.options.softDelete && {
        deletedAt: null
      }),
      
      // Computed properties
      get isNew() {
        return !this.id;
      },
      
      get isDeleted() {
        return this.options.softDelete && this.deletedAt !== null;
      },
      
      // Validation method
      validate() {
        const errors = [];
        
        // Schema validation
        Object.entries(this.schema.fields).forEach(([field, rules]) => {
          const value = this[field];
          
          if (rules.required && (value === undefined || value === null)) {
            errors.push(`${field} is required`);
          }
          
          if (value !== undefined && value !== null) {
            if (rules.type && typeof value !== rules.type) {
              errors.push(`${field} must be ${rules.type}`);
            }
            
            if (rules.validate && !rules.validate(value)) {
              errors.push(`${field} failed validation`);
            }
          }
        });
        
        return {
          isValid: errors.length === 0,
          errors
        };
      },
      
      // Transformation method
      toJSON() {
        const json = { ...this };
        
        // Remove methods and internal properties
        delete json.validate;
        delete json.toJSON;
        delete json.save;
        delete json.update;
        delete json.delete;
        
        // Apply field transformations
        Object.entries(this.schema.fields).forEach(([field, rules]) => {
          if (rules.transform && json[field] !== undefined) {
            json[field] = rules.transform(json[field]);
          }
        });
        
        return json;
      },
      
      // Database operations
      async save() {
        await this.executeHook('beforeSave');
        
        const validation = this.validate();
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Simulate save operation
        if (this.isNew) {
          this.id = this.generateId();
          await this.executeHook('afterCreate');
        } else {
          this.updatedAt = new Date();
          await this.executeHook





























// Here are comprehensive code snippets covering Object Literal Syntax Extensions in JavaScript for Node.js backend development:

// ## 1. Property Value Shorthand

// Traditional way
const createUser = (name, email, age) => {
  return {
    name: name,
    email: email,
    age: age,
    createdAt: new Date()
  };
};

// With property value shorthand
const createUserShort = (name, email, age) => {
  return {
    name,
    email,
    age,
    createdAt: new Date()
  };
};

// Usage in production
class UserService {
  constructor(name, email, role = 'user') {
    this.config = {
      name,
      email,
      role,
      timestamp: Date.now()
    };
  }
}

// ## 2. Computed Property Names

// Dynamic property names
const createDynamicConfig = (environment, featureFlags) => {
  const prefix = environment.toUpperCase();
  
  return {
    [`${prefix}_API_KEY`]: process.env[`${prefix}_API_KEY`],
    [`${prefix}_DATABASE_URL`]: process.env[`${prefix}_DB_URL`],
    [`${prefix}_CACHE_TTL`]: 3600,
    ...featureFlags,
    // Dynamic method names
    [`validate${environment.charAt(0).toUpperCase() + environment.slice(1)}Config`]() {
      return this[`${prefix}_API_KEY`] && this[`${prefix}_DATABASE_URL`];
    }
  };
};

// Usage with Symbols
const LOG_LEVELS = {
  DEBUG: Symbol('DEBUG'),
  INFO: Symbol('INFO'),
  ERROR: Symbol('ERROR')
};

const Logger = {
  [LOG_LEVELS.DEBUG]: (message) => console.debug(`[DEBUG] ${message}`),
  [LOG_LEVELS.INFO]: (message) => console.info(`[INFO] ${message}`),
  [LOG_LEVELS.ERROR]: (message) => console.error(`[ERROR] ${message}`)
};

// ## 3. Method Definition Shorthand

// Traditional way
const apiClient = {
  get: function(url) {
    return fetch(url);
  },
  post: function(url, data) {
    return fetch(url, { method: 'POST', body: JSON.stringify(data) });
  }
};

// With method shorthand
const apiClient = {
  async get(url) {
    const response = await fetch(url);
    return response.json();
  },
  
  async post(url, data) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  async delete(url) {
    const response = await fetch(url, { method: 'DELETE' });
    return response.status === 204;
  },
  
  // Generator methods
  *paginate(endpoint, pageSize = 100) {
    let page = 1;
    while (true) {
      const results = await this.get(`${endpoint}?page=${page}&size=${pageSize}`);
      if (!results.length) break;
      yield results;
      page++;
    }
  }
};

// ## 4. Spread Operator with Objects

// Merging configurations
const createServerConfig = (baseConfig, environmentConfig, overrides = {}) => {
  const defaultConfig = {
    port: 3000,
    host: 'localhost',
    logging: {
      level: 'info',
      format: 'json'
    },
    database: {
      poolSize: 10,
      timeout: 30000
    }
  };
  
  return {
    ...defaultConfig,
    ...baseConfig,
    ...environmentConfig,
    ...overrides,
    // Deep merge for nested objects (simple approach)
    logging: {
      ...defaultConfig.logging,
      ...baseConfig?.logging,
      ...environmentConfig?.logging,
      ...overrides?.logging
    }
  };
};

// Immutable updates
const updateUserProfile = (user, updates) => {
  return {
    ...user,
    ...updates,
    updatedAt: new Date(),
    profile: {
      ...user.profile,
      ...updates.profile
    }
  };
};

// Removing properties (immutable way)
const removeSensitiveFields = (user) => {
  const { password, ssn, ...safeUser } = user;
  return safeUser;
};

// ## 5. Practical Production Examples

// ### Database Model Configuration
class DatabaseModel {
  static createModelDefinition(fields, options = {}) {
    const {
      tableName,
      timestamps = true,
      paranoid = false,
      indexes = []
    } = options;
    
    return {
      // Computed table name
      [`${tableName}Table`]: tableName,
      
      // Field definitions with shorthand
      fields,
      
      // Method definitions
      validate() {
        return Object.values(this.fields).every(field => field.required !== true || field.value);
      },
      
      // Spread operator for options
      options: {
        timestamps,
        paranoid,
        indexes: [
          { fields: ['createdAt'] },
          ...indexes
        ],
        ...options
      },
      
      // Static methods
      static: {
        async findByEmail(email) {
          // Database lookup implementation
          return this.findOne({ where: { email } });
        }
      }
    };
  }
}

// ### API Response Builder
class ResponseBuilder {
  static success(data, meta = {}) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    // Add request ID if available
    if (global.requestId) {
      response.requestId = global.requestId;
    }
    
    return response;
  }
  
  static error(message, code = 'INTERNAL_ERROR', details = {}) {
    return {
      success: false,
      error: {
        code,
        message,
        ...details,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  static paginated(data, pagination) {
    const { page, limit, total } = pagination;
    
    return this.success(data, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  }
}

// ### Middleware Configuration
const createMiddlewareStack = (baseMiddlewares, environment) => {
  const developmentMiddlewares = {
    logger: require('morgan')('dev'),
    cors: require('cors')({ origin: true }),
    helmet: require('helmet')()
  };
  
  const productionMiddlewares = {
    logger: require('morgan')('combined'),
    cors: require('cors')({ origin: process.env.ALLOWED_ORIGINS }),
    helmet: require('helmet')({
      contentSecurityPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }),
    rateLimit: require('express-rate-limit')({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    })
  };
  
  const environmentConfig = environment === 'production' 
    ? productionMiddlewares 
    : developmentMiddlewares;
  
  return {
    // Order matters - spread base first, then environment specific
    ...baseMiddlewares,
    ...environmentConfig,
    
    // Custom method to get middleware array in correct order
    getOrderedStack() {
      return [
        this.helmet,
        this.cors,
        this.rateLimit,
        this.logger,
        ...Object.values(this).filter(mw => 
          typeof mw === 'function' && 
          !['helmet', 'cors', 'rateLimit', 'logger'].includes(mw.name)
        )
      ].filter(Boolean);
    }
  };
}

// ### Environment-based Configuration
const loadConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const baseConfig = {
    env,
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isTest: env === 'test',
    
    // Method to check environment
    is(environment) {
      return this.env === environment;
    }
  };
  
  const environmentConfigs = {
    development: {
      database: {
        url: 'postgresql://localhost:5432/dev_db',
        logging: true
      },
      redis: {
        host: 'localhost',
        port: 6379
      }
    },
    
    production: {
      database: {
        url: process.env.DATABASE_URL,
        logging: false,
        ssl: { rejectUnauthorized: false }
      },
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    }
  };
  
  return {
    ...baseConfig,
    ...environmentConfigs[env],
    
    // Computed property for full configuration
    get fullConfig() {
      return {
        ...this,
        // Add any computed values
        [Symbol.for('nodejs.config.loadedAt')]: new Date()
      };
    }
  };
};

// These code snippets demonstrate how object literal syntax extensions can be effectively used in Node.js backend development for creating clean, maintainable, and production-ready code.