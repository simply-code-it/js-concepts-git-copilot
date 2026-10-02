// # JavaScript Modules - Production Grade Code Snippets

// ## 1. Module Structure and Organization

// ### Main Application Entry Point
// app.js - Main application entry point
import { createServer } from './server.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './database/client.js';
import { setupErrorHandlers } from './middleware/errorHandlers.js';

class Application {
    constructor() {
        this.server = null;
        this.isShuttingDown = false;
    }

    async start() {
        try {
            logger.info('Starting application...');
            
            // Initialize core components
            await this.initializeDatabase();
            await this.initializeServices();
            
            // Create and start server
            this.server = await createServer();
            
            logger.info(`Application started successfully on port ${config.port}`);
            return this;
        } catch (error) {
            logger.error('Failed to start application:', error);
            await this.shutdown(1);
        }
    }

    async initializeDatabase() {
        await connectDatabase();
        logger.info('Database connected successfully');
    }

    async initializeServices() {
        // Initialize other services (cache, message queues, etc.)
        const { cache } = await import('./services/cache.js');
        await cache.connect();
        logger.info('Cache service initialized');
    }

    async shutdown(exitCode = 0) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        logger.info('Shutting down application...');

        try {
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => resolve());
                });
            }

            await disconnectDatabase();
            logger.info('Application shutdown completed');
            
            if (exitCode !== undefined) {
                process.exit(exitCode);
            }
        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    application.shutdown(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received');
    application.shutdown(0);
});

// Create and start application
const application = new Application();
export default application.start();




// ### Configuration Management
// config/index.js - Centralized configuration management
import { config as dotenvConfig } from 'dotenv';
import Joi from 'joi';

dotenvConfig();

// Configuration validation schema
const configSchema = Joi.object({
    // Server
    nodeEnv: Joi.string().valid('development', 'production', 'test').default('development'),
    port: Joi.number().port().default(3000),
    
    // Database
    databaseUrl: Joi.string().uri().required(),
    databasePoolSize: Joi.number().min(1).max(20).default(10),
    
    // JWT
    jwtSecret: Joi.string().min(32).required(),
    jwtExpiresIn: Joi.string().default('1d'),
    
    // Redis
    redisUrl: Joi.string().uri().default('redis://localhost:6379'),
    
    // Rate limiting
    rateLimitWindowMs: Joi.number().default(900000), // 15 minutes
    rateLimitMax: Joi.number().default(100),
    
    // External APIs
    paymentServiceUrl: Joi.string().uri().required(),
    emailServiceUrl: Joi.string().uri().required(),
}).unknown(); // Allow extra fields for flexibility

class Config {
    constructor() {
        this._config = this.validateConfig(process.env);
    }

    validateConfig(env) {
        const { error, value } = configSchema.validate(env, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            throw new Error(`Config validation error: ${error.details.map(d => d.message).join(', ')}`);
        }

        return value;
    }

    get(key, defaultValue = undefined) {
        return this._config[key] ?? defaultValue;
    }

    getAll() {
        return { ...this._config };
    }

    // Environment-specific getters
    get isProduction() {
        return this.get('nodeEnv') === 'production';
    }

    get isDevelopment() {
        return this.get('nodeEnv') === 'development';
    }

    get isTest() {
        return this.get('nodeEnv') === 'test';
    }
}

// Singleton instance
export const config = new Config();


// ## 2. Service Layer Modules

// ### Base Service Class
// services/BaseService.js
import { logger } from '../utils/logger.js';

export class BaseService {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.logger = logger.child({ service: serviceName });
    }

    async executeWithRetry(operation, maxRetries = 3, delayMs = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                this.logger.warn(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) break;
                
                await new Promise(resolve => 
                    setTimeout(resolve, delayMs * Math.pow(2, attempt - 1))
                );
            }
        }
        
        throw lastError;
    }

    async withTimeout(operation, timeoutMs, timeoutMessage = 'Operation timeout') {
        let timeoutId;
        
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        });

        try {
            return await Promise.race([operation(), timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    handleServiceError(error, context = '') {
        const errorContext = context ? ` in ${context}` : '';
        this.logger.error(`Service error${errorContext}:`, error);
        
        // Convert to standardized error format
        if (error.isOperational) {
            throw error;
        }
        
        throw new Error(`Service unavailable${errorContext}`);
    }
}

// ### User Service with Dependency Injection
// services/UserService.js
import { BaseService } from './BaseService.js';
import { AppError } from '../errors/AppError.js';

export class UserService extends BaseService {
    constructor(userRepository, emailService, cacheService) {
        super('UserService');
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.cacheService = cacheService;
    }

    async createUser(userData) {
        try {
            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(userData.email);
            if (existingUser) {
                throw new AppError('User with this email already exists', 409);
            }

            // Create user
            const user = await this.userRepository.create(userData);
            
            // Send welcome email (fire and forget)
            this.emailService.sendWelcomeEmail(user.email, user.name)
                .catch(error => this.logger.error('Failed to send welcome email:', error));

            // Invalidate cache
            await this.cacheService.del('users:all');
            
            this.logger.info(`User created successfully: ${user.id}`);
            return user;
        } catch (error) {
            this.handleServiceError(error, 'createUser');
        }
    }

    async getUserById(userId, useCache = true) {
        const cacheKey = `user:${userId}`;
        
        if (useCache) {
            const cachedUser = await this.cacheService.get(cacheKey);
            if (cachedUser) {
                return JSON.parse(cachedUser);
            }
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Cache user data
        await this.cacheService.setex(cacheKey, 300, JSON.stringify(user)); // 5 minutes
        
        return user;
    }

    async updateUser(userId, updateData) {
        try {
            const user = await this.userRepository.update(userId, updateData);
            if (!user) {
                throw new AppError('User not found', 404);
            }

            // Invalidate relevant cache entries
            await Promise.all([
                this.cacheService.del(`user:${userId}`),
                this.cacheService.del('users:all')
            ]);

            this.logger.info(`User updated successfully: ${userId}`);
            return user;
        } catch (error) {
            this.handleServiceError(error, 'updateUser');
        }
    }
}

// Factory function for dependency injection
export function createUserService(dependencies) {
    return new UserService(
        dependencies.userRepository,
        dependencies.emailService,
        dependencies.cacheService
    );
}

// ## 3. Repository Pattern with Database

// ### Base Repository
// repositories/BaseRepository.js
import { logger } from '../utils/logger.js';

export class BaseRepository {
    constructor(model, repositoryName) {
        this.model = model;
        this.repositoryName = repositoryName;
        this.logger = logger.child({ repository: repositoryName });
    }

    async findById(id, options = {}) {
        try {
            const query = this.model.findById(id);
            
            if (options.populate) {
                query.populate(options.populate);
            }
            
            if (options.select) {
                query.select(options.select);
            }
            
            return await query.exec();
        } catch (error) {
            this.logger.error(`Error finding ${this.repositoryName} by ID:`, error);
            throw error;
        }
    }

    async findOne(conditions, options = {}) {
        try {
            const query = this.model.findOne(conditions);
            
            if (options.populate) {
                query.populate(options.populate);
            }
            
            return await query.exec();
        } catch (error) {
            this.logger.error(`Error finding ${this.repositoryName}:`, error);
            throw error;
        }
    }

    async find(conditions = {}, options = {}) {
        try {
            let query = this.model.find(conditions);
            
            // Pagination
            if (options.page && options.limit) {
                const skip = (options.page - 1) * options.limit;
                query = query.skip(skip).limit(options.limit);
            }
            
            // Sorting
            if (options.sort) {
                query = query.sort(options.sort);
            }
            
            // Population
            if (options.populate) {
                query = query.populate(options.populate);
            }
            
            // Field selection
            if (options.select) {
                query = query.select(options.select);
            }
            
            return await query.exec();
        } catch (error) {
            this.logger.error(`Error finding ${this.repositoryName}s:`, error);
            throw error;
        }
    }

    async create(data) {
        try {
            const document = new this.model(data);
            return await document.save();
        } catch (error) {
            this.logger.error(`Error creating ${this.repositoryName}:`, error);
            throw error;
        }
    }

    async update(id, data) {
        try {
            const document = await this.model.findByIdAndUpdate(
                id,
                { $set: data },
                { new: true, runValidators: true }
            );
            
            if (!document) {
                return null;
            }
            
            return document;
        } catch (error) {
            this.logger.error(`Error updating ${this.repositoryName}:`, error);
            throw error;
        }
    }

    async delete(id) {
        try {
            const document = await this.model.findByIdAndDelete(id);
            return !!document;
        } catch (error) {
            this.logger.error(`Error deleting ${this.repositoryName}:`, error);
            throw error;
        }
    }

    async count(conditions = {}) {
        try {
            return await this.model.countDocuments(conditions);
        } catch (error) {
            this.logger.error(`Error counting ${this.repositoryName}s:`, error);
            throw error;
        }
    }
}

// ### User Repository Implementation
// repositories/UserRepository.js
import { BaseRepository } from './BaseRepository.js';
import { User } from '../models/User.js';

export class UserRepository extends BaseRepository {
    constructor() {
        super(User, 'UserRepository');
    }

    async findByEmail(email) {
        return await this.findOne({ email });
    }

    async findByUsername(username) {
        return await this.findOne({ username });
    }

    async findActiveUsers(options = {}) {
        return await this.find({ 
            isActive: true,
            emailVerified: true 
        }, options);
    }

    async updateLastLogin(userId) {
        return await this.update(userId, {
            lastLoginAt: new Date(),
            loginCount: { $inc: 1 }
        });
    }

    async searchUsers(searchTerm, options = {}) {
        const conditions = {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
                { username: { $regex: searchTerm, $options: 'i' } }
            ]
        };
        
        return await this.find(conditions, options);
    }
}

// ## 4. Middleware Modules

// ### Authentication Middleware
// middleware/auth.js
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Access token required', 401);
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix
        
        const decoded = jwt.verify(token, config.get('jwtSecret'));
        
        // Attach user to request
        req.user = {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };
        
        next();
    } catch (error) {
        logger.warn('Authentication failed:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            next(new AppError('Invalid token', 401));
        } else if (error.name === 'TokenExpiredError') {
            next(new AppError('Token expired', 401));
        } else {
            next(error);
        }
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401));
        }
        
        if (!roles.includes(req.user.role)) {
            return next(new AppError('Insufficient permissions', 403));
        }
        
        next();
    };
};

export const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, config.get('jwtSecret'));
            req.user = {
                id: decoded.userId,
                email: decoded.email,
                role: decoded.role
            };
        } catch (error) {
            // Ignore token errors for optional auth
            logger.debug('Optional auth token invalid:', error.message);
        }
    }
    
    next();
};

// ### Error Handling Middleware
// middleware/errorHandler.js
import { config } from '../config/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (error, req, res, next) => {
    let appError = error;
    
    // Convert to AppError if not already
    if (!(error instanceof AppError)) {
        // Mongoose validation error
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            appError = new AppError(messages.join(', '), 400);
        }
        // Mongoose duplicate key error
        else if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            appError = new AppError(`${field} already exists`, 409);
        }
        // JWT errors
        else if (error.name === 'JsonWebTokenError') {
            appError = new AppError('Invalid token', 401);
        }
        else if (error.name === 'TokenExpiredError') {
            appError = new AppError('Token expired', 401);
        }
        // Default to internal server error
        else {
            appError = new AppError('Internal server error', 500);
        }
    }
    
    // Log error
    if (appError.statusCode >= 500) {
        logger.error('Server error:', {
            message: error.message,
            stack: error.stack,
            url: req.url,
            method: req.method,
            ip: req.ip
        });
    } else {
        logger.warn('Client error:', {
            message: appError.message,
            statusCode: appError.statusCode,
            url: req.url,
            method: req.method
        });
    }
    
    // Error response
    const errorResponse = {
        success: false,
        error: appError.message,
        ...(config.isDevelopment && { stack: error.stack })
    };
    
    res.status(appError.statusCode).json(errorResponse);
};

export const notFoundHandler = (req, res, next) => {
    next(new AppError(`Route ${req.method} ${req.path} not found`, 404));
};

export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ## 5. Utility Modules

// ### Logger Configuration
// utils/logger.js
import winston from 'winston';
import { config } from '../config/index.js';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Development format (pretty print)
const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
    })
);

// Create logger instance
export const logger = winston.createLogger({
    level: config.isProduction ? 'info' : 'debug',
    format: config.isProduction ? logFormat : devFormat,
    defaultMeta: { service: 'backend-api' },
    transports: [
        // File transports for production
        ...(config.isProduction ? [
            new winston.transports.File({ 
                filename: 'logs/error.log', 
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
            }),
            new winston.transports.File({ 
                filename: 'logs/combined.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
            })
        ] : []),
        
        // Console transport for all environments
        new winston.transports.Console()
    ],
    
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    rejectionHandlers: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        logger.http('Request completed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    
    next();
};

// ### Database Connection Manager
// database/client.js
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class DatabaseManager {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    async connect() {
        if (this.isConnected) {
            return this.connection;
        }

        try {
            const options = {
                maxPoolSize: config.get('databasePoolSize', 10),
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            };

            this.connection = await mongoose.connect(config.get('databaseUrl'), options);
            this.isConnected = true;

            logger.info('Database connected successfully');
            
            // Event handlers
            mongoose.connection.on('error', (error) => {
                logger.error('Database connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('Database disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('Database reconnected');
                this.isConnected = true;
            });

            return this.connection;
        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (!this.isConnected) {
            return;
        }

        try {
            await mongoose.disconnect();
            this.isConnected = false;
            logger.info('Database disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting from database:', error);
            throw error;
        }
    }

    getConnection() {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        return this.connection;
    }

    // Health check
    async healthCheck() {
        try {
            await mongoose.connection.db.admin().ping();
            return {
                status: 'healthy',
                connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

// Singleton instance
export const databaseManager = new DatabaseManager();

// Convenience functions
export const connectDatabase = () => databaseManager.connect();
export const disconnectDatabase = () => databaseManager.disconnect();
export const getDatabaseConnection = () => databaseManager.getConnection();

// ## 6. API Route Modules

// ### Route Definitions with Dependency Injection
// routes/users.js
import { Router } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { userValidation } from '../validations/userValidation.js';

export function createUserRoutes({ userService }) {
    const router = Router();

    // Apply authentication to all routes
    router.use(authenticate);

    // GET /users - Get all users (admin only)
    router.get('/', 
        authorize('admin'),
        asyncHandler(async (req, res) => {
            const { page = 1, limit = 10, search } = req.query;
            
            const users = await userService.getUsers({
                page: parseInt(page),
                limit: parseInt(limit),
                search
            });
            
            res.json({
                success: true,
                data: users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: users.length
                }
            });
        })
    );

    // GET /users/:id - Get user by ID
    router.get('/:id',
        asyncHandler(async (req, res) => {
            // Users can only access their own data unless they're admin
            if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
            
            const user = await userService.getUserById(req.params.id);
            
            res.json({
                success: true,
                data: user
            });
        })
    );

    // PUT /users/:id - Update user
    router.put('/:id',
        validate(userValidation.updateUser),
        asyncHandler(async (req, res) => {
            // Users can only update their own data unless they're admin
            if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }
            
            const user = await userService.updateUser(req.params.id, req.body);
            
            res.json({
                success: true,
                data: user
            });
        })
    );

    // DELETE /users/:id - Delete user
    router.delete('/:id',
        authorize('admin'),
        asyncHandler(async (req, res) => {
            await userService.deleteUser(req.params.id);
            
            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        })
    );

    return router;
}

// ### Main Router Composition
// routes/index.js
import { Router } from 'express';
import { createUserRoutes } from './users.js';
import { createAuthRoutes } from './auth.js';
import { createProductRoutes } from './products.js';
import { createOrderRoutes } from './orders.js';
import { requestLogger } from '../utils/logger.js';
import { notFoundHandler } from '../middleware/errorHandler.js';

export function createRouter(services) {
    const router = Router();
    
    // Global middleware
    router.use(requestLogger);
    
    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV
        });
    });
    
    // API routes
    router.use('/auth', createAuthRoutes(services));
    router.use('/users', createUserRoutes(services));
    router.use('/products', createProductRoutes(services));
    router.use('/orders', createOrderRoutes(services));
    
    // 404 handler
    router.use(notFoundHandler);
    
    return router;
}

// ## 7. Dependency Injection Container

// ### Service Container
// container.js
import { config } from './config/index.js';
import { databaseManager } from './database/client.js';
import { UserRepository } from './repositories/UserRepository.js';
import { createUserService } from './services/UserService.js';
import { EmailService } from './services/EmailService.js';
import { CacheService } from './services/CacheService.js';

class ServiceContainer {
    constructor() {
        this.services = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize core infrastructure
            await databaseManager.connect();
            
            // Initialize repositories
            const userRepository = new UserRepository();
            this.register('userRepository', userRepository);
            
            // Initialize services
            const emailService = new EmailService(config);
            const cacheService = new CacheService(config);
            
            await cacheService.connect();
            
            const userService = createUserService({
                userRepository,
                emailService,
                cacheService
            });
            
            this.register('emailService', emailService);
            this.register('cacheService', cacheService);
            this.register('userService', userService);
            
            this.initialized = true;
            
            console.log('Service container initialized successfully');
        } catch (error) {
            console.error('Failed to initialize service container:', error);
            throw error;
        }
    }

    register(name, instance) {
        this.services.set(name, instance);
    }

    get(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service not found: ${name}`);
        }
        return service;
    }

    async shutdown() {
        for (const [name, service] of this.services) {
            if (typeof service.disconnect === 'function') {
                await service.disconnect().catch(error => {
                    console.error(`Error disconnecting service ${name}:`, error);
                });
            }
        }
        
        await databaseManager.disconnect();
        this.initialized = false;
    }
}

// Singleton container
export const container = new ServiceContainer();

// These production-grade module patterns provide a solid foundation for building maintainable, scalable Node.js backend applications. The modular architecture promotes separation of concerns, testability, and dependency management while following industry best practices.































// # Dynamic Imports - Production Grade Code Snippets

// ## 1. Core Dynamic Import Patterns

// ### Basic Dynamic Import with Error Handling
// utils/dynamicImport.js
import { logger } from './logger.js';

export class DynamicImportManager {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
    }

    async importWithRetry(modulePath, maxRetries = 3, retryDelay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const module = await import(modulePath);
                logger.debug(`Successfully imported module: ${modulePath}`);
                return module;
            } catch (error) {
                lastError = error;
                logger.warn(`Import attempt ${attempt} failed for ${modulePath}:`, error.message);

                if (attempt === maxRetries) break;

                await new Promise(resolve => 
                    setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
                );
            }
        }

        throw new Error(`Failed to import module ${modulePath} after ${maxRetries} attempts: ${lastError.message}`);
    }

    async importWithTimeout(modulePath, timeoutMs = 5000) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Import timeout for ${modulePath}`)), timeoutMs);
        });

        const importPromise = import(modulePath);

        try {
            const module = await Promise.race([importPromise, timeoutPromise]);
            return module;
        } catch (error) {
            logger.error(`Timeout importing module ${modulePath}:`, error);
            throw error;
        }
    }
}

// Singleton instance
export const dynamicImportManager = new DynamicImportManager();

// ### Cached Dynamic Imports
// utils/cachedImports.js
import { logger } from './logger.js';

export class CachedImportManager {
    constructor() {
        this.cache = new Map();
        this.loading = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    async getModule(modulePath, useCache = true) {
        // Return cached module if available
        if (useCache && this.cache.has(modulePath)) {
            this.stats.hits++;
            return this.cache.get(modulePath);
        }

        // If module is already loading, return the existing promise
        if (this.loading.has(modulePath)) {
            return this.loading.get(modulePath);
        }

        this.stats.misses++;

        try {
            // Create loading promise
            const loadPromise = this.loadModule(modulePath);
            this.loading.set(modulePath, loadPromise);

            const module = await loadPromise;

            // Cache the loaded module
            if (useCache) {
                this.cache.set(modulePath, module);
            }

            // Remove from loading map
            this.loading.delete(modulePath);

            return module;
        } catch (error) {
            this.stats.errors++;
            this.loading.delete(modulePath);
            logger.error(`Failed to load module ${modulePath}:`, error);
            throw error;
        }
    }

    async loadModule(modulePath) {
        const module = await import(modulePath);
        
        // Add cache metadata
        module._cacheMetadata = {
            loadedAt: new Date(),
            path: modulePath
        };

        return module;
    }

    invalidateCache(modulePath = null) {
        if (modulePath) {
            this.cache.delete(modulePath);
        } else {
            this.cache.clear();
        }
    }

    getCacheStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            loadingCount: this.loading.size
        };
    }

    // Garbage collection for unused modules
    collectGarbage(maxAgeMs = 3600000) { // 1 hour default
        const now = Date.now();
        let collected = 0;

        for (const [path, module] of this.cache.entries()) {
            if (now - module._cacheMetadata.loadedAt > maxAgeMs) {
                this.cache.delete(path);
                collected++;
            }
        }

        logger.debug(`Garbage collected ${collected} modules`);
        return collected;
    }
}

export const cachedImportManager = new CachedImportManager();

// ## 2. Plugin System with Dynamic Imports

// ### Plugin Manager
// plugins/PluginManager.js
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { cachedImportManager } from '../utils/cachedImports.js';

export class PluginManager extends EventEmitter {
    constructor(pluginsDir = './plugins') {
        super();
        this.pluginsDir = pluginsDir;
        this.plugins = new Map();
        this.enabledPlugins = new Set();
    }

    async loadPlugin(pluginName, options = {}) {
        if (this.plugins.has(pluginName)) {
            logger.warn(`Plugin ${pluginName} is already loaded`);
            return this.plugins.get(pluginName);
        }

        try {
            const pluginPath = `${this.pluginsDir}/${pluginName}/index.js`;
            
            // Dynamically import plugin
            const pluginModule = await cachedImportManager.getModule(pluginPath);
            
            if (!pluginModule.default || typeof pluginModule.default !== 'function') {
                throw new Error(`Plugin ${pluginName} must export a default class`);
            }

            // Instantiate plugin
            const PluginClass = pluginModule.default;
            const plugin = new PluginClass(options);
            
            // Validate plugin interface
            this.validatePlugin(plugin, pluginName);

            // Initialize plugin
            if (typeof plugin.initialize === 'function') {
                await plugin.initialize();
            }

            this.plugins.set(pluginName, plugin);
            this.emit('pluginLoaded', pluginName, plugin);

            logger.info(`Plugin ${pluginName} loaded successfully`);
            return plugin;

        } catch (error) {
            logger.error(`Failed to load plugin ${pluginName}:`, error);
            this.emit('pluginLoadError', pluginName, error);
            throw error;
        }
    }

    async loadPlugins(pluginConfigs) {
        const results = {
            loaded: [],
            failed: []
        };

        for (const [pluginName, config] of Object.entries(pluginConfigs)) {
            try {
                const plugin = await this.loadPlugin(pluginName, config);
                results.loaded.push({ name: pluginName, plugin });
            } catch (error) {
                results.failed.push({ name: pluginName, error: error.message });
            }
        }

        return results;
    }

    async enablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} not found`);
        }

        if (typeof plugin.enable === 'function') {
            await plugin.enable();
        }

        this.enabledPlugins.add(pluginName);
        this.emit('pluginEnabled', pluginName, plugin);

        logger.info(`Plugin ${pluginName} enabled`);
    }

    async disablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin ${pluginName} not found`);
        }

        if (typeof plugin.disable === 'function') {
            await plugin.disable();
        }

        this.enabledPlugins.delete(pluginName);
        this.emit('pluginDisabled', pluginName, plugin);

        logger.info(`Plugin ${pluginName} disabled`);
    }

    validatePlugin(plugin, pluginName) {
        const requiredMethods = ['initialize'];
        const optionalMethods = ['enable', 'disable', 'cleanup'];

        for (const method of requiredMethods) {
            if (typeof plugin[method] !== 'function') {
                throw new Error(`Plugin ${pluginName} must implement ${method} method`);
            }
        }

        // Check for unknown methods to ensure interface compliance
        const allowedMethods = [...requiredMethods, ...optionalMethods];
        const pluginMethods = Object.getOwnPropertyNames(
            Object.getPrototypeOf(plugin)
        );

        for (const method of pluginMethods) {
            if (method !== 'constructor' && 
                !allowedMethods.includes(method) && 
                typeof plugin[method] === 'function') {
                logger.warn(`Plugin ${pluginName} has unknown method: ${method}`);
            }
        }
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }

    getEnabledPlugins() {
        return Array.from(this.enabledPlugins).map(name => this.plugins.get(name));
    }

    async shutdown() {
        for (const [pluginName, plugin] of this.plugins.entries()) {
            try {
                if (typeof plugin.cleanup === 'function') {
                    await plugin.cleanup();
                }
                logger.info(`Plugin ${pluginName} cleaned up`);
            } catch (error) {
                logger.error(`Error cleaning up plugin ${pluginName}:`, error);
            }
        }

        this.plugins.clear();
        this.enabledPlugins.clear();
    }
}

// ### Plugin Interface and Implementation
// plugins/payment-gateway/index.js
import { logger } from '../../utils/logger.js';

export default class PaymentGatewayPlugin {
    constructor(options = {}) {
        this.name = 'payment-gateway';
        this.version = '1.0.0';
        this.options = options;
        this.isEnabled = false;
    }

    async initialize() {
        logger.info('Initializing Payment Gateway Plugin');
        
        // Validate required options
        if (!this.options.apiKey) {
            throw new Error('Payment gateway API key is required');
        }

        // Initialize payment gateway client
        this.client = await this.createClient();
        
        logger.info('Payment Gateway Plugin initialized successfully');
    }

    async createClient() {
        // Simulate client creation
        return {
            processPayment: async (paymentData) => {
                // Payment processing logic
                return { success: true, transactionId: 'txn_123' };
            },
            refundPayment: async (transactionId) => {
                // Refund logic
                return { success: true, refundId: 'ref_123' };
            }
        };
    }

    async enable() {
        this.isEnabled = true;
        logger.info('Payment Gateway Plugin enabled');
    }

    async disable() {
        this.isEnabled = false;
        logger.info('Payment Gateway Plugin disabled');
    }

    async processPayment(paymentData) {
        if (!this.isEnabled) {
            throw new Error('Payment gateway is not enabled');
        }

        return await this.client.processPayment(paymentData);
    }

    async cleanup() {
        // Cleanup resources
        this.client = null;
        logger.info('Payment Gateway Plugin cleaned up');
    }
}

// ## 3. Feature Flag Based Dynamic Imports

// ### Feature Flag Manager
// features/FeatureManager.js
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class FeatureManager extends EventEmitter {
    constructor() {
        super();
        this.features = new Map();
        this.featureModules = new Map();
    }

    async registerFeature(featureName, config) {
        const featureConfig = {
            enabled: config.enabled || false,
            modulePath: config.modulePath,
            rolloutPercentage: config.rolloutPercentage || 100,
            targetUsers: config.targetUsers || [],
            ...config
        };

        this.features.set(featureName, featureConfig);

        // Preload module if feature is enabled
        if (featureConfig.enabled && featureConfig.modulePath) {
            await this.loadFeatureModule(featureName);
        }

        this.emit('featureRegistered', featureName, featureConfig);
        logger.info(`Feature ${featureName} registered`);
    }

    async loadFeatureModule(featureName) {
        const feature = this.features.get(featureName);
        if (!feature || !feature.modulePath) {
            throw new Error(`Feature ${featureName} not found or no module path specified`);
        }

        try {
            const module = await import(feature.modulePath);
            this.featureModules.set(featureName, module);
            
            logger.info(`Feature module loaded for ${featureName}`);
            return module;
        } catch (error) {
            logger.error(`Failed to load feature module for ${featureName}:`, error);
            throw error;
        }
    }

    isEnabled(featureName, context = {}) {
        const feature = this.features.get(featureName);
        if (!feature) {
            return false;
        }

        if (!feature.enabled) {
            return false;
        }

        // Check rollout percentage
        if (feature.rolloutPercentage < 100) {
            const userHash = this.getUserHash(context.userId);
            if (userHash % 100 >= feature.rolloutPercentage) {
                return false;
            }
        }

        // Check target users
        if (feature.targetUsers.length > 0 && context.userId) {
            if (!feature.targetUsers.includes(context.userId)) {
                return false;
            }
        }

        return true;
    }

    async getFeatureModule(featureName, context = {}) {
        if (!this.isEnabled(featureName, context)) {
            throw new Error(`Feature ${featureName} is not enabled`);
        }

        let module = this.featureModules.get(featureName);
        
        if (!module) {
            module = await this.loadFeatureModule(featureName);
        }

        return module;
    }

    async executeFeature(featureName, method, args = [], context = {}) {
        try {
            const module = await this.getFeatureModule(featureName, context);
            
            if (!module[method] || typeof module[method] !== 'function') {
                throw new Error(`Method ${method} not found in feature ${featureName}`);
            }

            return await module[method](...args);
        } catch (error) {
            logger.error(`Error executing feature ${featureName}.${method}:`, error);
            throw error;
        }
    }

    getUserHash(userId) {
        if (!userId) return Math.floor(Math.random() * 100);
        
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) % 100;
    }

    async enableFeature(featureName) {
        const feature = this.features.get(featureName);
        if (!feature) {
            throw new Error(`Feature ${featureName} not found`);
        }

        feature.enabled = true;
        
        // Load module if not already loaded
        if (feature.modulePath && !this.featureModules.has(featureName)) {
            await this.loadFeatureModule(featureName);
        }

        this.emit('featureEnabled', featureName, feature);
        logger.info(`Feature ${featureName} enabled`);
    }

    getFeatureStatus(featureName) {
        const feature = this.features.get(featureName);
        return feature ? {
            enabled: feature.enabled,
            rolloutPercentage: feature.rolloutPercentage,
            moduleLoaded: this.featureModules.has(featureName)
        } : null;
    }
}

// ### Feature Implementation
// features/advanced-analytics/index.js
import { logger } from '../../utils/logger.js';

export class AdvancedAnalytics {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        logger.info('Initializing Advanced Analytics');
        
        // Initialize analytics service
        this.analyticsClient = await this.createAnalyticsClient();
        this.initialized = true;
        
        logger.info('Advanced Analytics initialized');
    }

    async createAnalyticsClient() {
        // Simulate analytics client creation
        return {
            trackEvent: async (event, properties) => {
                // Analytics tracking logic
                console.log(`Tracking event: ${event}`, properties);
                return { success: true };
            },
            trackUser: async (userId, traits) => {
                // User tracking logic
                console.log(`Tracking user: ${userId}`, traits);
                return { success: true };
            }
        };
    }

    async trackEvent(event, properties = {}) {
        if (!this.initialized) {
            throw new Error('Advanced Analytics not initialized');
        }

        const enhancedProperties = {
            ...properties,
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId()
        };

        return await this.analyticsClient.trackEvent(event, enhancedProperties);
    }

    async trackUser(userId, traits = {}) {
        if (!this.initialized) {
            throw new Error('Advanced Analytics not initialized');
        }

        return await this.analyticsClient.trackUser(userId, traits);
    }

    generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export as default for dynamic import
export default AdvancedAnalytics;

// ## 4. Database Driver Dynamic Loading

// ### Database Driver Manager
// database/DriverManager.js
import { logger } from '../utils/logger.js';
import { cachedImportManager } from '../utils/cachedImports.js';

export class DatabaseDriverManager {
    constructor() {
        this.drivers = new Map();
        this.activeDriver = null;
    }

    async loadDriver(driverName, connectionConfig) {
        if (this.drivers.has(driverName)) {
            logger.warn(`Driver ${driverName} already loaded`);
            return this.drivers.get(driverName);
        }

        try {
            // Dynamic import based on driver name
            const driverPath = `../drivers/${driverName}/index.js`;
            const driverModule = await cachedImportManager.getModule(driverPath);
            
            if (!driverModule.default || typeof driverModule.default !== 'function') {
                throw new Error(`Driver ${driverName} must export a default class`);
            }

            const DriverClass = driverModule.default;
            const driver = new DriverClass(connectionConfig);

            // Validate driver interface
            await this.validateDriver(driver, driverName);

            this.drivers.set(driverName, driver);
            logger.info(`Database driver ${driverName} loaded successfully`);

            return driver;
        } catch (error) {
            logger.error(`Failed to load database driver ${driverName}:`, error);
            throw error;
        }
    }

    async validateDriver(driver, driverName) {
        const requiredMethods = [
            'connect', 
            'disconnect', 
            'query', 
            'healthCheck'
        ];

        for (const method of requiredMethods) {
            if (typeof driver[method] !== 'function') {
                throw new Error(`Driver ${driverName} must implement ${method} method`);
            }
        }
    }

    async setActiveDriver(driverName) {
        const driver = this.drivers.get(driverName);
        if (!driver) {
            throw new Error(`Driver ${driverName} not loaded`);
        }

        // Connect driver if not already connected
        if (typeof driver.isConnected === 'function' && !driver.isConnected()) {
            await driver.connect();
        }

        this.activeDriver = driver;
        logger.info(`Active database driver set to: ${driverName}`);
    }

    getActiveDriver() {
        if (!this.activeDriver) {
            throw new Error('No active database driver');
        }
        return this.activeDriver;
    }

    async executeQuery(query, params = []) {
        const driver = this.getActiveDriver();
        return await driver.query(query, params);
    }

    async healthCheck() {
        const driver = this.getActiveDriver();
        return await driver.healthCheck();
    }

    async switchDriver(newDriverName, connectionConfig) {
        const oldDriver = this.activeDriver;
        
        try {
            // Load new driver
            const newDriver = await this.loadDriver(newDriverName, connectionConfig);
            
            // Set as active
            await this.setActiveDriver(newDriverName);
            
            // Disconnect old driver if it exists
            if (oldDriver && typeof oldDriver.disconnect === 'function') {
                await oldDriver.disconnect().catch(error => {
                    logger.warn('Error disconnecting old driver:', error);
                });
            }

            logger.info(`Successfully switched to driver: ${newDriverName}`);
            return newDriver;
        } catch (error) {
            logger.error(`Failed to switch to driver ${newDriverName}:`, error);
            throw error;
        }
    }
}

// ### Database Driver Implementation
// drivers/postgres/index.js
import { logger } from '../../utils/logger.js';

export default class PostgresDriver {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.connected = false;
    }

    async connect() {
        try {
            // Dynamically import pg module only when needed
            const { Client } = await import('pg');
            
            this.client = new Client(this.config);
            await this.client.connect();
            this.connected = true;
            
            logger.info('PostgreSQL driver connected successfully');
        } catch (error) {
            logger.error('Failed to connect PostgreSQL driver:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.end();
            this.connected = false;
            logger.info('PostgreSQL driver disconnected');
        }
    }

    async query(sql, params = []) {
        if (!this.connected) {
            throw new Error('PostgreSQL driver not connected');
        }

        try {
            const result = await this.client.query(sql, params);
            return result.rows;
        } catch (error) {
            logger.error('PostgreSQL query error:', error);
            throw error;
        }
    }

    async healthCheck() {
        if (!this.connected) {
            return { status: 'disconnected', error: 'Not connected to database' };
        }

        try {
            await this.client.query('SELECT 1');
            return { status: 'healthy' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    isConnected() {
        return this.connected;
    }

    // Driver-specific methods
    async transaction(callback) {
        if (!this.connected) {
            throw new Error('PostgreSQL driver not connected');
        }

        try {
            await this.client.query('BEGIN');
            const result = await callback(this);
            await this.client.query('COMMIT');
            return result;
        } catch (error) {
            await this.client.query('ROLLBACK');
            throw error;
        }
    }
}

// ## 5. Localization Dynamic Loading

// ### Localization Manager
// i18n/LocalizationManager.js
import { logger } from '../utils/logger.js';

export class LocalizationManager {
    constructor(defaultLocale = 'en', localesDir = './locales') {
        this.defaultLocale = defaultLocale;
        this.localesDir = localesDir;
        this.locales = new Map();
        this.fallbackEnabled = true;
    }

    async loadLocale(locale) {
        if (this.locales.has(locale)) {
            return this.locales.get(locale);
        }

        try {
            const localePath = `${this.localesDir}/${locale}.js`;
            const localeModule = await import(localePath);
            
            if (!localeModule.default || typeof localeModule.default !== 'object') {
                throw new Error(`Locale ${locale} must export a default object`);
            }

            this.locales.set(locale, localeModule.default);
            logger.info(`Locale ${locale} loaded successfully`);
            
            return localeModule.default;
        } catch (error) {
            logger.error(`Failed to load locale ${locale}:`, error);
            
            if (locale !== this.defaultLocale) {
                // Fallback to default locale
                return await this.loadLocale(this.defaultLocale);
            }
            
            throw error;
        }
    }

    async getTranslation(key, locale = this.defaultLocale, params = {}) {
        let localeData;

        try {
            localeData = await this.loadLocale(locale);
        } catch (error) {
            if (this.fallbackEnabled && locale !== this.defaultLocale) {
                logger.warn(`Falling back to default locale for key: ${key}`);
                localeData = await this.loadLocale(this.defaultLocale);
            } else {
                throw error;
            }
        }

        const value = this.getNestedValue(localeData, key);
        
        if (value === undefined) {
            logger.warn(`Translation key not found: ${key} for locale: ${locale}`);
            return key; // Return key as fallback
        }

        return this.interpolateParams(value, params);
    }

    getNestedValue(obj, key) {
        return key.split('.').reduce((current, part) => {
            return current ? current[part] : undefined;
        }, obj);
    }

    interpolateParams(template, params) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
            return params[paramName] !== undefined ? params[paramName] : match;
        });
    }

    async preloadCommonLocales(locales = ['en', 'es', 'fr']) {
        const results = {
            loaded: [],
            failed: []
        };

        for (const locale of locales) {
            try {
                await this.loadLocale(locale);
                results.loaded.push(locale);
            } catch (error) {
                results.failed.push({ locale, error: error.message });
            }
        }

        return results;
    }

    getLoadedLocales() {
        return Array.from(this.locales.keys());
    }

    setFallbackEnabled(enabled) {
        this.fallbackEnabled = enabled;
    }
}

// ### Locale Files
// locales/en.js
export default {
    common: {
        welcome: "Welcome to our application",
        error: "An error occurred",
        success: "Operation completed successfully"
    },
    auth: {
        login: {
            success: "Login successful",
            failure: "Invalid credentials",
            welcome: "Welcome back, {{name}}!"
        },
        register: {
            success: "Registration successful",
            email_taken: "Email already registered"
        }
    },
    validation: {
        required: "{{field}} is required",
        email: "Please enter a valid email address",
        min_length: "{{field}} must be at least {{min}} characters"
    },
    user: {
        profile: {
            updated: "Profile updated successfully",
            not_found: "User not found"
        }
    }
};


// locales/es.js
export default {
    common: {
        welcome: "Bienvenido a nuestra aplicación",
        error: "Ocurrió un error",
        success: "Operación completada con éxito"
    },
    auth: {
        login: {
            success: "Inicio de sesión exitoso",
            failure: "Credenciales inválidas",
            welcome: "¡Bienvenido de nuevo, {{name}}!"
        },
        register: {
            success: "Registro exitoso",
            email_taken: "El correo electrónico ya está registrado"
        }
    },
    // ... more translations
};

// ## 6. Middleware Dynamic Loading

// ### Dynamic Middleware Loader
// middleware/MiddlewareLoader.js
import { logger } from '../utils/logger.js';

export class MiddlewareLoader {
    constructor(middlewareDir = './middleware') {
        this.middlewareDir = middlewareDir;
        this.middlewareCache = new Map();
        this.middlewareConfigs = new Map();
    }

    async loadMiddleware(middlewareName, config = {}) {
        const cacheKey = `${middlewareName}_${JSON.stringify(config)}`;
        
        if (this.middlewareCache.has(cacheKey)) {
            return this.middlewareCache.get(cacheKey);
        }

        try {
            const middlewarePath = `${this.middlewareDir}/${middlewareName}.js`;
            const middlewareModule = await import(middlewarePath);
            
            let middleware;

            if (typeof middlewareModule.default === 'function') {
                // Factory function
                middleware = middlewareModule.default(config);
            } else if (typeof middlewareModule.create === 'function') {
                // Create method
                middleware = middlewareModule.create(config);
            } else {
                throw new Error(`Middleware ${middlewareName} must export a factory function or create method`);
            }

            // Validate it's a valid middleware function
            if (typeof middleware !== 'function') {
                throw new Error(`Middleware ${middlewareName} must return a function`);
            }

            this.middlewareCache.set(cacheKey, middleware);
            this.middlewareConfigs.set(middlewareName, config);

            logger.info(`Middleware ${middlewareName} loaded successfully`);
            return middleware;

        } catch (error) {
            logger.error(`Failed to load middleware ${middlewareName}:`, error);
            throw error;
        }
    }

    async loadMiddlewareStack(middlewareStack) {
        const loadedMiddlewares = [];

        for (const middlewareDef of middlewareStack) {
            const { name, config = {}, enabled = true } = middlewareDef;

            if (!enabled) {
                logger.debug(`Middleware ${name} is disabled, skipping`);
                continue;
            }

            try {
                const middleware = await this.loadMiddleware(name, config);
                loadedMiddlewares.push({
                    name,
                    middleware,
                    config
                });
            } catch (error) {
                logger.error(`Failed to load middleware ${name}, skipping:`, error);
                // Continue loading other middlewares
            }
        }

        return loadedMiddlewares;
    }

    async createMiddlewarePipeline(middlewareStack) {
        const loadedMiddlewares = await this.loadMiddlewareStack(middlewareStack);
        
        return (req, res, next) => {
            let index = 0;

            const executeNext = async () => {
                if (index >= loadedMiddlewares.length) {
                    return next();
                }

                const { middleware, name } = loadedMiddlewares[index++];

                try {
                    await new Promise((resolve, reject) => {
                        middleware(req, res, (error) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve();
                            }
                        });
                    });

                    await executeNext();
                } catch (error) {
                    logger.error(`Middleware ${name} execution failed:`, error);
                    next(error);
                }
            };

            executeNext().catch(next);
        };
    }

    clearCache(middlewareName = null) {
        if (middlewareName) {
            for (const [key] of this.middlewareCache.entries()) {
                if (key.startsWith(middlewareName)) {
                    this.middlewareCache.delete(key);
                }
            }
        } else {
            this.middlewareCache.clear();
        }
    }

    getLoadedMiddleware() {
        return Array.from(this.middlewareConfigs.keys());
    }
}

// ### Middleware Implementation
// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

export function createRateLimiter(config = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // limit each IP to 100 requests per windowMs
        skipSuccessfulRequests = false,
        keyGenerator = (req) => req.ip,
        ...restConfig
    } = config;

    return rateLimit({
        windowMs,
        max,
        skipSuccessfulRequests,
        keyGenerator,
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                error: 'Too many requests, please try again later'
            });
        },
        ...restConfig
    });
}

// Alternative export for dynamic loading
export default createRateLimiter;

// ## 7. Strategy Pattern with Dynamic Imports

// ### Strategy Manager
// strategies/StrategyManager.js
import { logger } from '../utils/logger.js';

export class StrategyManager {
    constructor(strategiesDir = './strategies') {
        this.strategiesDir = strategiesDir;
        this.strategies = new Map();
        this.activeStrategies = new Map();
    }

    async registerStrategy(strategyName, context, config = {}) {
        const strategyKey = `${strategyName}_${context}`;

        try {
            const strategyPath = `${this.strategiesDir}/${context}/${strategyName}.js`;
            const strategyModule = await import(strategyPath);
            
            if (!strategyModule.default || typeof strategyModule.default !== 'function') {
                throw new Error(`Strategy ${strategyName} must export a default class`);
            }

            const StrategyClass = strategyModule.default;
            const strategy = new StrategyClass(config);

            // Validate strategy interface
            this.validateStrategy(strategy, strategyName);

            this.strategies.set(strategyKey, strategy);
            logger.info(`Strategy ${strategyName} registered for context ${context}`);

            return strategy;
        } catch (error) {
            logger.error(`Failed to register strategy ${strategyName}:`, error);
            throw error;
        }
    }

    validateStrategy(strategy, strategyName) {
        if (typeof strategy.execute !== 'function') {
            throw new Error(`Strategy ${strategyName} must implement execute method`);
        }
    }

    setActiveStrategy(context, strategyName) {
        const strategyKey = `${strategyName}_${context}`;
        const strategy = this.strategies.get(strategyKey);
        
        if (!strategy) {
            throw new Error(`Strategy ${strategyName} not found for context ${context}`);
        }

        this.activeStrategies.set(context, strategy);
        logger.info(`Active strategy for ${context} set to: ${strategyName}`);
    }

    async executeStrategy(context, ...args) {
        const strategy = this.activeStrategies.get(context);
        
        if (!strategy) {
            throw new Error(`No active strategy found for context: ${context}`);
        }

        try {
            return await strategy.execute(...args);
        } catch (error) {
            logger.error(`Strategy execution failed for context ${context}:`, error);
            throw error;
        }
    }

    getActiveStrategy(context) {
        return this.activeStrategies.get(context);
    }

    async loadStrategyContext(context, strategyConfigs) {
        const results = {
            registered: [],
            failed: []
        };

        for (const [strategyName, config] of Object.entries(strategyConfigs)) {
            try {
                const strategy = await this.registerStrategy(strategyName, context, config);
                results.registered.push({ name: strategyName, strategy });
            } catch (error) {
                results.failed.push({ name: strategyName, error: error.message });
            }
        }

        return results;
    }
}

// ### Strategy Implementation
// strategies/payment/StripeStrategy.js
import { logger } from '../../utils/logger.js';

export default class StripePaymentStrategy {
    constructor(config) {
        this.config = config;
        this.initialized = false;
    }

    async initialize() {
        // Dynamically import Stripe only when this strategy is used
        const stripeModule = await import('stripe');
        this.stripe = stripeModule.default(this.config.apiKey);
        this.initialized = true;
        
        logger.info('Stripe payment strategy initialized');
    }

    async execute(paymentData) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const { amount, currency, source, description } = paymentData;

            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency || 'usd',
                payment_method: source,
                confirmation_method: 'manual',
                confirm: true,
                description
            });

            return {
                success: true,
                transactionId: paymentIntent.id,
                status: paymentIntent.status,
                clientSecret: paymentIntent.client_secret
            };
        } catch (error) {
            logger.error('Stripe payment failed:', error);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    async refund(transactionId, amount = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const refundParams = { payment_intent: transactionId };
            if (amount) {
                refundParams.amount = Math.round(amount * 100);
            }

            const refund = await this.stripe.refunds.create(refundParams);

            return {
                success: true,
                refundId: refund.id,
                status: refund.status
            };
        } catch (error) {
            logger.error('Stripe refund failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// These production-grade dynamic import patterns provide powerful capabilities for building flexible, modular, and maintainable Node.js applications. They enable features like plugin systems, feature flags, database driver abstraction, and runtime strategy selection while maintaining performance and reliability.






























// # Top-Level Await - Production Grade Code Snippets

// ## 1. Application Initialization with Top-Level Await

// ### Main Application Bootstrapper
// app.js - Main application entry point with top-level await
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { databaseManager } from './database/manager.js';
import { cacheManager } from './cache/manager.js';
import { serviceManager } from './services/manager.js';
import { createServer } from './server/server.js';

class Application {
    constructor() {
        this.server = null;
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            logger.info('🚀 Starting application initialization...');

            // Initialize core services in parallel
            await Promise.all([
                this.initializeDatabase(),
                this.initializeCache(),
                this.initializeServices()
            ]);

            // Create HTTP server
            this.server = await createServer();

            logger.info('✅ Application initialized successfully');
            this.registerShutdownHandlers();

        } catch (error) {
            logger.error('❌ Application initialization failed:', error);
            await this.emergencyShutdown(1);
        }
    }

    async initializeDatabase() {
        logger.info('📊 Initializing database connections...');
        await databaseManager.connectAll();
        logger.info('✅ Database connections established');
    }

    async initializeCache() {
        logger.info('🔮 Initializing cache layers...');
        await cacheManager.initialize();
        logger.info('✅ Cache layers initialized');
    }

    async initializeServices() {
        logger.info('⚙️ Initializing business services...');
        await serviceManager.initializeAll();
        logger.info('✅ Business services initialized');
    }

    registerShutdownHandlers() {
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => this.handleUncaughtException(error));
        process.on('unhandledRejection', (reason, promise) => this.handleUnhandledRejection(reason, promise));
    }

    async gracefulShutdown(signal) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

        try {
            // Close HTTP server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        logger.info('✅ HTTP server closed');
                        resolve();
                    });
                });
            }

            // Close services in reverse initialization order
            await serviceManager.shutdownAll();
            await cacheManager.shutdown();
            await databaseManager.disconnectAll();

            logger.info('✅ Graceful shutdown completed');
            process.exit(0);

        } catch (error) {
            logger.error('❌ Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    async emergencyShutdown(exitCode = 1) {
        logger.error('🚨 Emergency shutdown initiated');
        
        try {
            await databaseManager.disconnectAll().catch(() => {});
            await cacheManager.shutdown().catch(() => {});
        } finally {
            process.exit(exitCode);
        }
    }

    handleUncaughtException(error) {
        logger.error('💥 Uncaught Exception:', error);
        this.emergencyShutdown(1);
    }

    handleUnhandledRejection(reason, promise) {
        logger.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't exit here, just log - let the application continue
    }
}

// Top-level await for application initialization
const application = new Application();
await application.initialize();

export default application;

// ### Configuration Loader with Top-Level Await
// config/index.js - Configuration loading with top-level await
import { readFile } from 'fs/promises';
import { config as loadEnv } from 'dotenv';
import Joi from 'joi';
import { logger } from '../utils/logger.js';

// Load environment variables
loadEnv();

// Configuration schema validation
const configSchema = Joi.object({
    // Server
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().port().default(3000),
    HOST: Joi.string().hostname().default('localhost'),
    
    // Database
    DATABASE_URL: Joi.string().uri().required(),
    DATABASE_POOL_SIZE: Joi.number().min(1).max(20).default(10),
    
    // Redis
    REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),
    REDIS_PASSWORD: Joi.string().optional(),
    
    // JWT
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('7d'),
    
    // External Services
    PAYMENT_SERVICE_URL: Joi.string().uri().required(),
    EMAIL_SERVICE_URL: Joi.string().uri().required(),
    FILE_STORAGE_URL: Joi.string().uri().required(),
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
}).unknown(); // Allow extra environment variables

class Config {
    constructor() {
        this._config = null;
        this._secrets = new Map();
    }

    async load() {
        try {
            logger.info('🔧 Loading configuration...');
            
            // Validate environment variables
            const { error, value: envConfig } = configSchema.validate(process.env, {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                throw new Error(`Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            // Load secrets from files if in production
            if (envConfig.NODE_ENV === 'production') {
                await this.loadSecrets(envConfig);
            }

            this._config = envConfig;
            logger.info('✅ Configuration loaded successfully');

        } catch (error) {
            logger.error('❌ Failed to load configuration:', error);
            throw error;
        }
    }

    async loadSecrets(envConfig) {
        const secretFiles = [
            { envKey: 'JWT_SECRET_FILE', configKey: 'JWT_SECRET' },
            { envKey: 'DATABASE_PASSWORD_FILE', configKey: 'DATABASE_PASSWORD' },
            { envKey: 'REDIS_PASSWORD_FILE', configKey: 'REDIS_PASSWORD' },
        ];

        for (const { envKey, configKey } of secretFiles) {
            if (process.env[envKey]) {
                try {
                    const secret = await readFile(process.env[envKey], 'utf8');
                    this._secrets.set(configKey, secret.trim());
                    envConfig[configKey] = secret.trim();
                } catch (error) {
                    logger.warn(`Failed to load secret from ${envKey}:`, error.message);
                }
            }
        }
    }

    get(key, defaultValue = undefined) {
        if (!this._config) {
            throw new Error('Configuration not loaded. Call await config.load() first.');
        }
        return this._config[key] ?? defaultValue;
    }

    get all() {
        if (!this._config) {
            throw new Error('Configuration not loaded. Call await config.load() first.');
        }
        return { ...this._config };
    }

    // Environment-specific getters
    get isProduction() {
        return this.get('NODE_ENV') === 'production';
    }

    get isDevelopment() {
        return this.get('NODE_ENV') === 'development';
    }

    get isTest() {
        return this.get('NODE_ENV') === 'test';
    }
}

// Top-level await for configuration loading
export const config = new Config();
await config.load();

// ## 2. Database Connection Management

// ### Database Manager with Top-Level Await
// database/manager.js - Database connection management
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class DatabaseManager {
    constructor() {
        this.connections = new Map();
        this.isConnected = false;
    }

    async connectAll() {
        if (this.isConnected) {
            logger.warn('Database connections already established');
            return;
        }

        try {
            logger.info('🔗 Establishing database connections...');

            // Main database connection
            const mainConnection = await this.createConnection(
                'main',
                config.get('DATABASE_URL'),
                {
                    maxPoolSize: config.get('DATABASE_POOL_SIZE'),
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                }
            );

            this.connections.set('main', mainConnection);

            // Analytics database connection (if configured)
            if (config.get('ANALYTICS_DATABASE_URL')) {
                const analyticsConnection = await this.createConnection(
                    'analytics',
                    config.get('ANALYTICS_DATABASE_URL'),
                    {
                        maxPoolSize: 5,
                        serverSelectionTimeoutMS: 5000,
                    }
                );
                this.connections.set('analytics', analyticsConnection);
            }

            this.isConnected = true;
            this.setupEventHandlers();
            
            logger.info('✅ All database connections established');

        } catch (error) {
            logger.error('❌ Failed to establish database connections:', error);
            throw error;
        }
    }

    async createConnection(name, url, options) {
        try {
            logger.debug(`Creating ${name} database connection...`);
            
            const connection = await mongoose.createConnection(url, {
                ...options,
                bufferCommands: false,
                bufferMaxEntries: 0,
            }).asPromise();

            logger.debug(`✅ ${name} database connection ready`);
            return connection;

        } catch (error) {
            logger.error(`❌ Failed to create ${name} database connection:`, error);
            throw error;
        }
    }

    setupEventHandlers() {
        for (const [name, connection] of this.connections) {
            connection.on('error', (error) => {
                logger.error(`📛 ${name} database connection error:`, error);
            });

            connection.on('disconnected', () => {
                logger.warn(`🔌 ${name} database connection disconnected`);
                this.isConnected = false;
            });

            connection.on('reconnected', () => {
                logger.info(`🔗 ${name} database connection reestablished`);
                this.isConnected = true;
            });
        }
    }

    getConnection(name = 'main') {
        const connection = this.connections.get(name);
        if (!connection) {
            throw new Error(`Database connection '${name}' not found`);
        }
        return connection;
    }

    async healthCheck() {
        const results = {};
        
        for (const [name, connection] of this.connections) {
            try {
                await connection.db.admin().ping();
                results[name] = { status: 'healthy', readyState: connection.readyState };
            } catch (error) {
                results[name] = { status: 'unhealthy', error: error.message, readyState: connection.readyState };
            }
        }

        return results;
    }

    async disconnectAll() {
        if (!this.isConnected) return;

        logger.info('🔌 Disconnecting all database connections...');

        for (const [name, connection] of this.connections) {
            try {
                await connection.close();
                logger.debug(`✅ ${name} database connection closed`);
            } catch (error) {
                logger.error(`❌ Error closing ${name} database connection:`, error);
            }
        }

        this.connections.clear();
        this.isConnected = false;
        logger.info('✅ All database connections disconnected');
    }
}

// Top-level await for database initialization
export const databaseManager = new DatabaseManager();
await databaseManager.connectAll();

// ## 3. Cache Layer Initialization

// ### Cache Manager with Top-Level Await
// cache/manager.js - Multi-layer cache initialization
import { createClient } from 'redis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MemoryCache } from './memory-cache.js';
import { RedisCache } from './redis-cache.js';

class CacheManager {
    constructor() {
        this.layers = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) {
            logger.warn('Cache manager already initialized');
            return;
        }

        try {
            logger.info('💾 Initializing cache layers...');

            // Initialize memory cache (L1)
            const memoryCache = new MemoryCache({
                maxSize: 1000,
                ttl: 300000, // 5 minutes
            });
            this.layers.set('memory', memoryCache);

            // Initialize Redis cache (L2) if configured
            if (config.get('REDIS_URL')) {
                const redisCache = await this.initializeRedisCache();
                this.layers.set('redis', redisCache);
            }

            this.initialized = true;
            logger.info('✅ Cache layers initialized');

        } catch (error) {
            logger.error('❌ Failed to initialize cache layers:', error);
            throw error;
        }
    }

    async initializeRedisCache() {
        try {
            logger.debug('Initializing Redis cache...');
            
            const redisClient = createClient({
                url: config.get('REDIS_URL'),
                password: config.get('REDIS_PASSWORD'),
                socket: {
                    connectTimeout: 10000,
                    timeout: 5000,
                    reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
                },
            });

            redisClient.on('error', (error) => {
                logger.error('Redis client error:', error);
            });

            redisClient.on('connect', () => {
                logger.debug('Redis client connected');
            });

            await redisClient.connect();

            return new RedisCache(redisClient, {
                prefix: `${config.get('NODE_ENV')}:`,
                defaultTTL: 3600, // 1 hour
            });

        } catch (error) {
            logger.error('❌ Failed to initialize Redis cache:', error);
            throw error;
        }
    }

    async get(key) {
        // Try memory cache first
        const memoryCache = this.layers.get('memory');
        let value = await memoryCache.get(key);

        if (value !== undefined) {
            return value;
        }

        // Try Redis cache if available
        const redisCache = this.layers.get('redis');
        if (redisCache) {
            value = await redisCache.get(key);
            if (value !== undefined) {
                // Populate memory cache
                await memoryCache.set(key, value);
                return value;
            }
        }

        return undefined;
    }

    async set(key, value, ttl = null) {
        const promises = [];

        // Set in memory cache
        const memoryCache = this.layers.get('memory');
        promises.push(memoryCache.set(key, value, ttl));

        // Set in Redis cache if available
        const redisCache = this.layers.get('redis');
        if (redisCache) {
            promises.push(redisCache.set(key, value, ttl));
        }

        await Promise.allSettled(promises);
    }

    async delete(key) {
        const promises = [];

        // Delete from memory cache
        const memoryCache = this.layers.get('memory');
        promises.push(memoryCache.delete(key));

        // Delete from Redis cache if available
        const redisCache = this.layers.get('redis');
        if (redisCache) {
            promises.push(redisCache.delete(key));
        }

        await Promise.allSettled(promises);
    }

    async clear() {
        const promises = [];

        for (const [name, layer] of this.layers) {
            promises.push(layer.clear().catch(error => {
                logger.warn(`Error clearing ${name} cache:`, error);
            }));
        }

        await Promise.allSettled(promises);
    }

    async healthCheck() {
        const results = {};

        for (const [name, layer] of this.layers) {
            try {
                const health = await layer.healthCheck();
                results[name] = health;
            } catch (error) {
                results[name] = { status: 'unhealthy', error: error.message };
            }
        }

        return results;
    }

    async shutdown() {
        if (!this.initialized) return;

        logger.info('🔌 Shutting down cache layers...');

        for (const [name, layer] of this.layers) {
            try {
                if (typeof layer.disconnect === 'function') {
                    await layer.disconnect();
                }
                logger.debug(`✅ ${name} cache layer shutdown`);
            } catch (error) {
                logger.error(`❌ Error shutting down ${name} cache layer:`, error);
            }
        }

        this.initialized = false;
        logger.info('✅ Cache layers shutdown completed');
    }
}

// Top-level await for cache initialization
export const cacheManager = new CacheManager();
await cacheManager.initialize();

// ## 4. Service Dependency Resolution

// ### Service Manager with Top-Level Await
// services/manager.js - Service dependency management
import { logger } from '../utils/logger.js';
import { UserService } from './user-service.js';
import { AuthService } from './auth-service.js';
import { PaymentService } from './payment-service.js';
import { EmailService } from './email-service.js';
import { NotificationService } from './notification-service.js';

class ServiceManager {
    constructor() {
        this.services = new Map();
        this.dependencies = new Map();
        this.initialized = false;
    }

    async initializeAll() {
        if (this.initialized) {
            logger.warn('Services already initialized');
            return;
        }

        try {
            logger.info('⚙️ Initializing business services...');

            // Define service dependencies
            this.dependencies.set('userService', []);
            this.dependencies.set('authService', ['userService']);
            this.dependencies.set('paymentService', ['userService']);
            this.dependencies.set('emailService', []);
            this.dependencies.set('notificationService', ['emailService']);

            // Initialize services in dependency order
            await this.initializeServiceGraph();

            this.initialized = true;
            logger.info('✅ All business services initialized');

        } catch (error) {
            logger.error('❌ Failed to initialize services:', error);
            throw error;
        }
    }

    async initializeServiceGraph() {
        const initialized = new Set();
        const maxAttempts = this.dependencies.size * 2; // Prevent infinite loops
        let attempts = 0;

        while (initialized.size < this.dependencies.size && attempts < maxAttempts) {
            attempts++;

            for (const [serviceName, deps] of this.dependencies) {
                if (initialized.has(serviceName)) continue;

                // Check if all dependencies are initialized
                const allDepsReady = deps.every(dep => initialized.has(dep));
                
                if (allDepsReady) {
                    await this.initializeService(serviceName);
                    initialized.add(serviceName);
                }
            }
        }

        if (initialized.size !== this.dependencies.size) {
            const missing = Array.from(this.dependencies.keys()).filter(name => !initialized.has(name));
            throw new Error(`Circular dependency or missing dependencies detected: ${missing.join(', ')}`);
        }
    }

    async initializeService(serviceName) {
        try {
            logger.debug(`Initializing ${serviceName}...`);

            const dependencies = this.dependencies.get(serviceName).map(dep => this.services.get(dep));
            const service = await this.createService(serviceName, dependencies);

            this.services.set(serviceName, service);
            logger.debug(`✅ ${serviceName} initialized`);

        } catch (error) {
            logger.error(`❌ Failed to initialize ${serviceName}:`, error);
            throw error;
        }
    }

    async createService(serviceName, dependencies) {
        switch (serviceName) {
            case 'userService':
                return await UserService.create(...dependencies);
            case 'authService':
                return await AuthService.create(...dependencies);
            case 'paymentService':
                return await PaymentService.create(...dependencies);
            case 'emailService':
                return await EmailService.create(...dependencies);
            case 'notificationService':
                return await NotificationService.create(...dependencies);
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }
    }

    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service '${serviceName}' not found or not initialized`);
        }
        return service;
    }

    async healthCheck() {
        const results = {};

        for (const [name, service] of this.services) {
            try {
                if (typeof service.healthCheck === 'function') {
                    const health = await service.healthCheck();
                    results[name] = health;
                } else {
                    results[name] = { status: 'unknown', reason: 'Health check not implemented' };
                }
            } catch (error) {
                results[name] = { status: 'unhealthy', error: error.message };
            }
        }

        return results;
    }

    async shutdownAll() {
        if (!this.initialized) return;

        logger.info('🔌 Shutting down business services...');

        // Shutdown in reverse initialization order
        const serviceNames = Array.from(this.services.keys()).reverse();

        for (const serviceName of serviceNames) {
            const service = this.services.get(serviceName);
            try {
                if (typeof service.shutdown === 'function') {
                    await service.shutdown();
                }
                logger.debug(`✅ ${serviceName} shutdown`);
            } catch (error) {
                logger.error(`❌ Error shutting down ${serviceName}:`, error);
            }
        }

        this.services.clear();
        this.initialized = false;
        logger.info('✅ All business services shutdown');
    }
}

// Top-level await for service initialization
export const serviceManager = new ServiceManager();
await serviceManager.initializeAll();

// ## 5. External Service Integration

// ### External Service Connector with Top-Level Await
// services/external-service-connector.js - External API integration
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class ExternalServiceConnector {
    constructor(serviceName, baseURL, defaultHeaders = {}) {
        this.serviceName = serviceName;
        this.baseURL = baseURL;
        this.defaultHeaders = defaultHeaders;
        this.client = null;
        this.healthStatus = 'unknown';
    }

    async initialize() {
        try {
            logger.info(`🔗 Initializing ${this.serviceName} connector...`);

            // Dynamically import axios only when needed
            const axios = await import('axios');

            this.client = axios.create({
                baseURL: this.baseURL,
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `App-Server/${config.get('NODE_ENV')}`,
                    ...this.defaultHeaders,
                },
            });

            // Add request interceptor for logging
            this.client.interceptors.request.use(
                (config) => {
                    logger.debug(`➡️ ${this.serviceName} Request: ${config.method?.toUpperCase()} ${config.url}`);
                    return config;
                },
                (error) => {
                    logger.error(`❌ ${this.serviceName} Request Error:`, error);
                    return Promise.reject(error);
                }
            );

            // Add response interceptor for logging and error handling
            this.client.interceptors.response.use(
                (response) => {
                    logger.debug(`⬅️ ${this.serviceName} Response: ${response.status} ${response.statusText}`);
                    return response;
                },
                (error) => {
                    logger.error(`❌ ${this.serviceName} Response Error:`, {
                        status: error.response?.status,
                        message: error.message,
                        url: error.config?.url,
                    });
                    return Promise.reject(this.normalizeError(error));
                }
            );

            // Perform initial health check
            await this.healthCheck();
            
            logger.info(`✅ ${this.serviceName} connector initialized`);

        } catch (error) {
            logger.error(`❌ Failed to initialize ${this.serviceName} connector:`, error);
            throw error;
        }
    }

    async request(method, endpoint, data = null, options = {}) {
        if (!this.client) {
            throw new Error(`${this.serviceName} connector not initialized`);
        }

        try {
            const response = await this.client.request({
                method,
                url: endpoint,
                data,
                ...options,
            });

            return response.data;

        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    normalizeError(error) {
        if (error.response) {
            // Server responded with error status
            return new ExternalServiceError(
                error.response.data?.message || error.message,
                error.response.status,
                error.response.data
            );
        } else if (error.request) {
            // Request made but no response received
            return new ExternalServiceError(
                'No response received from external service',
                0,
                { originalError: error.message }
            );
        } else {
            // Something else happened
            return new ExternalServiceError(
                error.message,
                0,
                { originalError: error.message }
            );
        }
    }

    async healthCheck() {
        try {
            await this.client.get('/health');
            this.healthStatus = 'healthy';
            return { status: 'healthy', service: this.serviceName };
        } catch (error) {
            this.healthStatus = 'unhealthy';
            return { 
                status: 'unhealthy', 
                service: this.serviceName, 
                error: error.message 
            };
        }
    }

    getHealthStatus() {
        return this.healthStatus;
    }
}

class ExternalServiceError extends Error {
    constructor(message, statusCode, details = {}) {
        super(message);
        this.name = 'ExternalServiceError';
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }
}

// Payment Service Connector with Top-Level Await
export const paymentServiceConnector = new ExternalServiceConnector(
    'PaymentService',
    config.get('PAYMENT_SERVICE_URL'),
    {
        'Authorization': `Bearer ${config.get('PAYMENT_SERVICE_API_KEY')}`,
    }
);
await paymentServiceConnector.initialize();

// Email Service Connector with Top-Level Await
export const emailServiceConnector = new ExternalServiceConnector(
    'EmailService',
    config.get('EMAIL_SERVICE_URL'),
    {
        'X-API-Key': config.get('EMAIL_SERVICE_API_KEY'),
    }
);
await emailServiceConnector.initialize();

export { ExternalServiceError };

// ## 6. Data Seeding and Migration

// ### Database Seeder with Top-Level Await
// database/seeder.js - Production data seeding
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { databaseManager } from './manager.js';
import { readFile } from 'fs/promises';
import path from 'path';

class DatabaseSeeder {
    constructor() {
        this.seeded = false;
        this.seedData = new Map();
    }

    async loadSeedData() {
        if (this.seedData.size > 0) return;

        try {
            logger.info('📥 Loading seed data...');

            const seedFiles = [
                { name: 'users', file: 'users.json' },
                { name: 'products', file: 'products.json' },
                { name: 'categories', file: 'categories.json' },
            ];

            for (const { name, file } of seedFiles) {
                const filePath = path.join(process.cwd(), 'database', 'seeds', file);
                try {
                    const data = await readFile(filePath, 'utf8');
                    this.seedData.set(name, JSON.parse(data));
                    logger.debug(`✅ Loaded seed data: ${name}`);
                } catch (error) {
                    logger.warn(`⚠️ Could not load seed data for ${name}:`, error.message);
                }
            }

            logger.info('✅ Seed data loaded');

        } catch (error) {
            logger.error('❌ Failed to load seed data:', error);
            throw error;
        }
    }

    async seed() {
        if (this.seeded) {
            logger.warn('Database already seeded');
            return;
        }

        // Only seed in development or if explicitly enabled
        if (config.isProduction && !config.get('FORCE_SEED')) {
            logger.info('🚫 Skipping seeding in production');
            return;
        }

        try {
            await this.loadSeedData();
            logger.info('🌱 Starting database seeding...');

            const connection = databaseManager.getConnection('main');

            // Seed users
            if (this.seedData.has('users')) {
                await this.seedUsers(connection);
            }

            // Seed categories
            if (this.seedData.has('categories')) {
                await this.seedCategories(connection);
            }

            // Seed products
            if (this.seedData.has('products')) {
                await this.seedProducts(connection);
            }

            this.seeded = true;
            logger.info('✅ Database seeding completed');

        } catch (error) {
            logger.error('❌ Database seeding failed:', error);
            throw error;
        }
    }

    async seedUsers(connection) {
        const users = this.seedData.get('users');
        const User = connection.model('User');

        // Clear existing users (optional)
        if (config.get('CLEAR_BEFORE_SEED')) {
            await User.deleteMany({});
            logger.debug('🧹 Cleared existing users');
        }

        // Hash passwords before inserting
        const bcrypt = await import('bcryptjs');
        const hashedUsers = await Promise.all(
            users.map(async (user) => ({
                ...user,
                password: await bcrypt.hash(user.password, 12),
                createdAt: new Date(),
                updatedAt: new Date(),
            }))
        );

        await User.insertMany(hashedUsers);
        logger.info(`✅ Seeded ${hashedUsers.length} users`);
    }

    async seedCategories(connection) {
        const categories = this.seedData.get('categories');
        const Category = connection.model('Category');

        if (config.get('CLEAR_BEFORE_SEED')) {
            await Category.deleteMany({});
            logger.debug('🧹 Cleared existing categories');
        }

        const timestampedCategories = categories.map(category => ({
            ...category,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        await Category.insertMany(timestampedCategories);
        logger.info(`✅ Seeded ${timestampedCategories.length} categories`);
    }

    async seedProducts(connection) {
        const products = this.seedData.get('products');
        const Product = connection.model('Product');

        if (config.get('CLEAR_BEFORE_SEED')) {
            await Product.deleteMany({});
            logger.debug('🧹 Cleared existing products');
        }

        const timestampedProducts = products.map(product => ({
            ...product,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        await Product.insertMany(timestampedProducts);
        logger.info(`✅ Seeded ${timestampedProducts.length} products`);
    }

    async clearAll() {
        try {
            logger.warn('🗑️ Clearing all seeded data...');

            const connection = databaseManager.getConnection('main');
            const models = ['User', 'Product', 'Category'];

            for (const modelName of models) {
                const Model = connection.model(modelName);
                await Model.deleteMany({});
                logger.debug(`🧹 Cleared ${modelName}`);
            }

            this.seeded = false;
            logger.warn('✅ All seeded data cleared');

        } catch (error) {
            logger.error('❌ Failed to clear seeded data:', error);
            throw error;
        }
    }
}

// Top-level await for database seeding
export const databaseSeeder = new DatabaseSeeder();

// Only run seeding if this is the main module and not in production
if (import.meta.url === `file://${process.argv[1]}` && !config.isProduction) {
    await databaseSeeder.seed();
} else {
    // In production, we might want to seed only if explicitly requested
    if (config.get('RUN_SEED_ON_STARTUP')) {
        await databaseSeeder.seed();
    }
}

// ## 7. Monitoring and Health Checks

// ### Health Check Registry with Top-Level Await
// monitoring/health-registry.js - Centralized health monitoring
import { logger } from '../utils/logger.js';

class HealthRegistry {
    constructor() {
        this.checks = new Map();
        this.healthStatus = 'unknown';
        this.lastCheck = null;
    }

    registerCheck(name, checkFn, options = {}) {
        const checkConfig = {
            timeout: options.timeout || 10000,
            critical: options.critical !== false, // Default to critical
            ...options,
        };

        this.checks.set(name, {
            fn: checkFn,
            config: checkConfig,
            lastResult: null,
            lastChecked: null,
        });

        logger.debug(`✅ Registered health check: ${name}`);
    }

    async runAllChecks() {
        logger.debug('🏥 Running all health checks...');

        const results = {};
        const checkPromises = [];

        for (const [name, check] of this.checks) {
            const promise = this.runSingleCheck(name, check)
                .then(result => {
                    results[name] = result;
                    return result;
                })
                .catch(error => {
                    results[name] = {
                        status: 'error',
                        error: error.message,
                        critical: check.config.critical,
                    };
                    return results[name];
                });

            checkPromises.push(promise);
        }

        await Promise.allSettled(checkPromises);

        // Determine overall health status
        const allHealthy = Object.values(results).every(result => 
            result.status === 'healthy' || (!result.critical && result.status === 'error')
        );

        this.healthStatus = allHealthy ? 'healthy' : 'unhealthy';
        this.lastCheck = new Date();

        logger.debug(`🏥 Health check completed: ${this.healthStatus}`);

        return {
            status: this.healthStatus,
            timestamp: this.lastCheck.toISOString(),
            checks: results,
        };
    }

    async runSingleCheck(name, check) {
        const { fn, config } = check;

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
        });

        const checkPromise = Promise.resolve(fn());

        try {
            const result = await Promise.race([checkPromise, timeoutPromise]);
            
            const checkResult = {
                status: 'healthy',
                ...(typeof result === 'object' ? result : {}),
            };

            check.lastResult = checkResult;
            check.lastChecked = new Date();

            return checkResult;

        } catch (error) {
            const errorResult = {
                status: 'error',
                error: error.message,
                critical: config.critical,
            };

            check.lastResult = errorResult;
            check.lastChecked = new Date();

            throw error;
        }
    }

    getStatus() {
        return {
            status: this.healthStatus,
            lastCheck: this.lastCheck,
            checks: Array.from(this.checks.entries()).reduce((acc, [name, check]) => {
                acc[name] = {
                    lastResult: check.lastResult,
                    lastChecked: check.lastChecked,
                    critical: check.config.critical,
                };
                return acc;
            }, {}),
        };
    }

    async startPeriodicChecks(intervalMs = 60000) { // 1 minute
        logger.info(`🔄 Starting periodic health checks every ${intervalMs}ms`);
        
        // Run initial check
        await this.runAllChecks();

        // Set up interval
        setInterval(async () => {
            try {
                await this.runAllChecks();
            } catch (error) {
                logger.error('Periodic health check failed:', error);
            }
        }, intervalMs);
    }
}

// Top-level await for health registry setup
export const healthRegistry = new HealthRegistry();

// Register core health checks
healthRegistry.registerCheck('database', async () => {
    const { databaseManager } = await import('../database/manager.js');
    return await databaseManager.healthCheck();
}, { critical: true });

healthRegistry.registerCheck('cache', async () => {
    const { cacheManager } = await import('../cache/manager.js');
    return await cacheManager.healthCheck();
}, { critical: false });

healthRegistry.registerCheck('external-services', async () => {
    const { serviceManager } = await import('../services/manager.js');
    return await serviceManager.healthCheck();
}, { critical: false });

// Start periodic health checks
await healthRegistry.startPeriodicChecks();

// These production-grade top-level await patterns provide robust initialization, dependency management, and error handling for Node.js backend applications. They ensure that all critical resources are properly initialized before the application starts serving requests, with comprehensive monitoring and graceful shutdown capabilities.