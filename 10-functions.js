// # JavaScript Functions - Real-World Scenarios from Large Codebases

// ## 1. Function Declarations & Expressions

// ### Traditional Function Declarations (Hoisted)
// GitHub-style utility functions
function formatCommitMessage(message, prefix = 'feat') {
    const trimmed = message.trim();
    const formatted = `${prefix}: ${trimmed}`;
    return formatted.length > 72 ? formatted.substring(0, 69) + '...' : formatted;
}

// Hoisting allows calling before declaration
console.log(formatCommitMessage('add user authentication')); // Works

// Express.js middleware pattern
function loggerMiddleware(req, res, next) {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = verifyToken(token);
    next();
}

// ### Function Expressions (Not Hoisted)
// GitLab-style configuration handlers
const validateConfig = function(config) {
    const errors = [];
    
    !config.database && errors.push('Database configuration required');
    config.database && !config.database.url && errors.push('Database URL required');
    !config.server && errors.push('Server configuration required');
    
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

// Must be declared before use
const config = { database: { url: 'postgresql://localhost:5432' } };
console.log(validateConfig(config));

// AWS Lambda handler pattern
const handler = async function(event, context) {
    try {
        const body = JSON.parse(event.body);
        const result = await processRequest(body);
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// ## 2. Arrow Functions (ES6+)

// ### Concise Arrow Functions
// React/Node.js array operations
const users = [
    { id: 1, name: 'John', active: true },
    { id: 2, name: 'Jane', active: false },
    { id: 3, name: 'Bob', active: true }
];

// GitHub-style data transformations
const activeUsers = users.filter(user => user.active);
const userNames = users.map(user => user.name);
const userMap = users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {});

// Express.js route handlers
const getUsers = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const users = await User.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    
    res.json({
        data: users,
        pagination: { page, limit, total: await User.countDocuments() }
    });
};

const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ### Multi-line Arrow Functions
// GitLab CI/CD pipeline simulation
const runPipeline = async (projectId, branch = 'main') => {
    const pipeline = await Pipeline.create({
        projectId,
        branch,
        status: 'running',
        startedAt: new Date()
    });
    
    await executeStages(pipeline.stages);
    await updatePipelineStatus(pipeline.id, 'success');
    
    return pipeline;
};

// MongoDB aggregation helpers
const getUserAnalytics = (startDate, endDate) => [
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    { $group: { 
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        users: { $sum: 1 },
        activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } }
    }},
    { $sort: { _id: 1 } }
];

// ## 3. IIFE (Immediately Invoked Function Expressions)

// ### Module Pattern & Configuration
// Database connection module (Node.js pattern)
const dbConnection = (function() {
    let connection = null;
    let isConnected = false;
    
    function connect(config) {
        return new Promise((resolve, reject) => {
            mongoose.connect(config.url, config.options)
                .then(conn => {
                    connection = conn;
                    isConnected = true;
                    console.log('Database connected successfully');
                    resolve(conn);
                })
                .catch(reject);
        });
    }
    
    function getConnection() {
        if (!isConnected) {
            throw new Error('Database not connected');
        }
        return connection;
    }
    
    return { connect, getConnection };
})();

// Usage
await dbConnection.connect({
    url: process.env.DATABASE_URL,
    options: { useNewUrlParser: true, useUnifiedTopology: true }
});

// Configuration loader with private variables
const config = (function() {
    const privateConfig = {
        secrets: new Map(),
        env: process.env.NODE_ENV || 'development'
    };
    
    function get(key) {
        if (privateConfig.secrets.has(key)) {
            return privateConfig.secrets.get(key);
        }
        return process.env[key];
    }
    
    function setSecret(key, value) {
        privateConfig.secrets.set(key, value);
    }
    
    return { get, setSecret };
})();

// ### Async IIFE for Top-Level Await (Node.js 14.8+)
// Server startup with async initialization
(async function() {
    try {
        await database.connect();
        await redisClient.connect();
        await loadCache();
        
        const server = app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close();
            await database.disconnect();
            await redisClient.quit();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})();

// ## 4. Higher-Order Functions

// ### Middleware Factory (Express.js Pattern)
// GitHub-style middleware factory
function rateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        maxRequests = 100,
        message = 'Too many requests'
    } = options;
    
    const requests = new Map();
    
    return function(req, res, next) {
        const ip = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!requests.has(ip)) {
            requests.set(ip, []);
        }
        
        const userRequests = requests.get(ip);
        // Clean old requests
        while (userRequests.length > 0 && userRequests[0] < windowStart) {
            userRequests.shift();
        }
        
        if (userRequests.length >= maxRequests) {
            return res.status(429).json({ error: message });
        }
        
        userRequests.push(now);
        next();
    };
}

// Usage
app.use(rateLimit({ windowMs: 60000, maxRequests: 10 }));

// Validation middleware factory
function validateBody(schema) {
    return function(req, res, next) {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: error.details 
            });
        }
        req.validatedData = value;
        next();
    };
}

// Joi schema example
const userSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).required()
});

app.post('/users', validateBody(userSchema), createUser);

// ### Decorator Pattern for API Routes
// GitLab-style route decorators
function authenticated(roles = []) {
    return function(target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(req, res, next) {
            try {
                if (!req.user) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                
                if (roles.length > 0 && !roles.includes(req.user.role)) {
                    return res.status(403).json({ error: 'Insufficient permissions' });
                }
                
                await originalMethod.call(this, req, res, next);
            } catch (error) {
                next(error);
            }
        };
        
        return descriptor;
    };
}

function validateQuery(schema) {
    return function(target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(req, res, next) {
            const { error } = schema.validate(req.query);
            if (error) {
                return res.status(400).json({ error: error.details[0].message });
            }
            await originalMethod.call(this, req, res, next);
        };
        
        return descriptor;
    };
}

// Usage in controller
class UserController {
    @authenticated(['admin'])
    @validateQuery(Joi.object({ page: Joi.number().min(1) }))
    async getUsers(req, res) {
        const users = await User.find().lean();
        res.json(users);
    }
}

// ## 5. Generator Functions

// ### Pagination & Large Dataset Processing
// GitHub-style pagination generator
async function* paginate(model, query = {}, pageSize = 100) {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const results = await model.find(query)
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean();
        
        if (results.length === 0) {
            hasMore = false;
        } else {
            yield results;
            page++;
            
            // Small delay to prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

// Usage: Process large dataset in chunks
async function processAllUsers() {
    let processed = 0;
    
    for await (const users of paginate(User, { active: true }, 50)) {
        for (const user of users) {
            await updateUserStats(user);
            processed++;
        }
        console.log(`Processed ${processed} users`);
    }
}

// CSV/File stream processing
function* csvParser(lines) {
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',');
        const obj = {};
        
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j].trim()] = values[j] ? values[j].trim() : '';
        }
        
        yield obj;
    }
}

// ## 6. Async/Await Patterns

// ### Error-First Async Wrappers
// GitHub-style error handling utility
function asyncHandler(fn) {
    return function(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Usage with Express.js
app.get('/users/:id', asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
}));

// GitLab-style database transaction wrapper
async function withTransaction(fn) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const result = await fn(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

// Usage
await withTransaction(async (session) => {
    await User.create([{ name: 'John' }], { session });
    await Profile.create([{ userId: user._id }], { session });
});

// Retry mechanism for external API calls
async function retry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        
        console.log(`Retrying... ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
}

// Usage
const data = await retry(() => fetchExternalAPI(url));

// ## 7. Currying & Partial Application

// ### API Client Configuration
// GitHub-style API client builder
function createAPIClient(baseConfig) {
    return function(endpointConfig) {
        return async function(requestData) {
            const config = { ...baseConfig, ...endpointConfig };
            const url = `${config.baseURL}${config.path}`;
            
            const response = await fetch(url, {
                method: config.method,
                headers: config.headers,
                body: requestData ? JSON.stringify(requestData) : undefined
            });
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }
            
            return response.json();
        };
    };
}

// Usage
const githubClient = createAPIClient({
    baseURL: 'https://api.github.com',
    headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'MyApp/1.0'
    }
});

const getUser = githubClient({ path: '/users/:username', method: 'GET' });
const createRepo = githubClient({ path: '/user/repos', method: 'POST' });

// Later usage
const user = await getUser({ username: 'octocat' });
const repo = await createRepo({ name: 'new-repo', private: true });

// Database query builder with currying
function where(conditions) {
    return function(model) {
        let query = model.find();
        
        Object.entries(conditions).forEach(([field, value]) => {
            if (Array.isArray(value)) {
                query = query.where(field).in(value);
            } else {
                query = query.where(field, value);
            }
        });
        
        return query;
    };
}

function sort(field, direction = 'asc') {
    return function(query) {
        return query.sort({ [field]: direction === 'asc' ? 1 : -1 });
    };
}

// Usage
const activeUsersQuery = where({ status: 'active' })(User);
const sortedActiveUsers = sort('createdAt', 'desc')(activeUsersQuery);
const users = await sortedActiveUsers.exec();

// ## 8. Memoization & Caching

// ### Expensive Function Memoization
// GitHub-style memoization with cache invalidation
function memoize(fn, options = {}) {
    const {
        ttl = 5 * 60 * 1000, // 5 minutes
        maxSize = 100,
        serializer = JSON.stringify
    } = options;
    
    const cache = new Map();
    const timestamps = new Map();
    
    return function(...args) {
        const key = serializer(args);
        const now = Date.now();
        
        // Check cache validity
        if (cache.has(key)) {
            const timestamp = timestamps.get(key);
            if (now - timestamp < ttl) {
                return cache.get(key);
            }
            // Remove expired entry
            cache.delete(key);
            timestamps.delete(key);
        }
        
        // Cleanup if cache is too large
        if (cache.size >= maxSize) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
            timestamps.delete(firstKey);
        }
        
        const result = fn.apply(this, args);
        cache.set(key, result);
        timestamps.set(key, now);
        
        return result;
    };
}

// Usage with expensive calculations
const expensiveCalculation = memoize(function(data) {
    console.log('Performing expensive calculation...');
    // Simulate heavy computation
    return data.reduce((acc, item) => acc + item.value, 0);
}, { ttl: 60000 });

// Database query memoization
const getUserById = memoize(async function(userId) {
    return await User.findById(userId).lean();
}, { ttl: 30000, maxSize: 1000 });

// ## 9. Function Composition & Pipelines

// ### GitLab-style Pipeline Composition
// Function composition utility
function compose(...fns) {
    return function(initialValue) {
        return fns.reduceRight((value, fn) => fn(value), initialValue);
    };
}

function pipe(...fns) {
    return function(initialValue) {
        return fns.reduce((value, fn) => fn(value), initialValue);
    };
}

// Data processing pipeline
const processUserData = pipe(
    // Step 1: Validate input
    (data) => {
        if (!data.email || !data.name) {
            throw new Error('Invalid user data');
        }
        return data;
    },
    
    // Step 2: Normalize data
    (data) => ({
        ...data,
        email: data.email.toLowerCase().trim(),
        name: data.name.trim().replace(/\s+/g, ' ')
    }),
    
    // Step 3: Add metadata
    (data) => ({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
    }),
    
    // Step 4: Hash password if provided
    async (data) => {
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 12);
        }
        return data;
    }
);

// Usage
try {
    const processedUser = await processUserData(rawUserData);
    const user = await User.create(processedUser);
    console.log('User created successfully');
} catch (error) {
    console.error('Failed to process user data:', error);
}

// Middleware composition (Express.js)
const applyMiddlewares = compose(
    helmet(),
    cors(),
    compression(),
    express.json(),
    express.urlencoded({ extended: true })
);

applyMiddlewares(app);

// ## 10. Real-World Enterprise Patterns

// ### Dependency Injection & Service Layer
// GitHub-style service factory
function createUserService(dependencies) {
    const { userRepository, emailService, logger } = dependencies;
    
    return {
        async createUser(userData) {
            try {
                logger.info('Creating user', { email: userData.email });
                
                const existingUser = await userRepository.findByEmail(userData.email);
                if (existingUser) {
                    throw new Error('User already exists');
                }
                
                const user = await userRepository.create(userData);
                await emailService.sendWelcomeEmail(user.email);
                
                logger.info('User created successfully', { userId: user.id });
                return user;
            } catch (error) {
                logger.error('Failed to create user', { error: error.message });
                throw error;
            }
        },
        
        async deactivateUser(userId) {
            const user = await userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            await userRepository.update(userId, { isActive: false });
            await emailService.sendDeactivationEmail(user.email);
            
            logger.info('User deactivated', { userId });
        }
    };
}

// Usage with dependency injection
const userService = createUserService({
    userRepository: userRepository,
    emailService: emailService,
    logger: logger
});

// Command pattern for undoable operations
function createCommandManager() {
    const history = [];
    const redoStack = [];
    
    return {
        execute(command) {
            command.execute();
            history.push(command);
            redoStack.length = 0; // Clear redo stack
        },
        
        undo() {
            if (history.length === 0) return;
            
            const command = history.pop();
            command.undo();
            redoStack.push(command);
        },
        
        redo() {
            if (redoStack.length === 0) return;
            
            const command = redoStack.pop();
            command.execute();
            history.push(command);
        },
        
        getHistory() {
            return history.slice();
        }
    };
}

// Command implementation
const createUserCommand = (userService, userData) => ({
    async execute() {
        this.executedUser = await userService.createUser(userData);
    },
    
    async undo() {
        if (this.executedUser) {
            await userService.deactivateUser(this.executedUser.id);
        }
    }
});

// These patterns are extracted from large-scale Node.js applications like GitHub, GitLab, and enterprise codebases, demonstrating how functions are used for modularity, reusability, and maintainability in real-world scenarios.









































// # JavaScript Functions as First-Class Citizens - Production Grade Use Cases

// ## 1. Functions as Arguments (Callbacks)

// ### Express.js Middleware System
// Production: Composable middleware pipeline
const securityMiddleware = [
    helmet(), // Functions passed as arguments
    cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
        credentials: true
    }),
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
    })
];

// Applying middleware functions
securityMiddleware.forEach(middleware => app.use(middleware));

// Custom middleware factory
const createValidationMiddleware = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => detail.message)
        });
    }
    next();
};

// Usage with Joi schemas
app.post('/api/users', 
    createValidationMiddleware(userSchema), // Function passed as argument
    createValidationMiddleware(emailSchema),
    asyncHandler(async (req, res) => {
        const user = await UserService.create(req.body);
        res.status(201).json(user);
    })
);

// ### Database Operations with Callbacks
// Production: MongoDB with transaction support
class DatabaseService {
    async withTransaction(operation) { // Function as parameter
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const result = await operation(session); // Function execution
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async createUserWithProfile(userData, profileData) {
        return this.withTransaction(async (session) => {
            const user = await User.create([userData], { session });
            const profile = await Profile.create([{ ...profileData, userId: user[0]._id }], { session });
            return { user: user[0], profile: profile[0] };
        });
    }
}

// Usage
const dbService = new DatabaseService();
const result = await dbService.createUserWithProfile(
    { name: 'John', email: 'john@example.com' },
    { bio: 'Software Engineer', avatar: 'avatar.jpg' }
);

// ## 2. Functions Returning Functions (Higher-Order Functions)

// ### Authentication & Authorization
// Production: Role-based access control
const createAuthorization = (requiredPermissions) => {
    return (req, res, next) => {
        const userPermissions = req.user?.permissions || [];
        const hasPermission = requiredPermissions.every(permission => 
            userPermissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: requiredPermissions,
                has: userPermissions
            });
        }
        next();
    };
};

// Usage in routes
app.get('/api/admin/users', 
    authenticate, // Regular middleware
    createAuthorization(['users:read', 'admin']), // HOF returning middleware
    async (req, res) => {
        const users = await User.find().select('-password');
        res.json(users);
    }
);

app.post('/api/admin/users',
    authenticate,
    createAuthorization(['users:write', 'admin']),
    async (req, res) => {
        const user = await User.create(req.body);
        res.status(201).json(user);
    }
);

// ### Configuration & Environment-Based Behavior
// Production: Environment-specific logging
const createLogger = (environment) => {
    const isProduction = environment === 'production';
    
    return {
        info: (message, meta = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                message,
                ...meta
            };
            
            if (isProduction) {
                // JSON format for production log aggregation
                console.log(JSON.stringify(logEntry));
            } else {
                // Pretty format for development
                console.log(`[${logEntry.timestamp}] INFO: ${message}`, meta);
            }
        },
        
        error: (message, error, meta = {}) => {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message,
                error: error?.message,
                stack: isProduction ? undefined : error?.stack,
                ...meta
            };
            
            console.error(JSON.stringify(logEntry));
        }
    };
};

// Usage across the application
const logger = createLogger(process.env.NODE_ENV);

logger.info('Server started', { 
    port: process.env.PORT,
    environment: process.env.NODE_ENV 
});

try {
    await someOperation();
} catch (error) {
    logger.error('Operation failed', error, { operation: 'someOperation' });
}

// ## 3. Functions Assigned to Variables

// ### Service Factory Pattern
// Production: Database service factory
const createUserService = (dependencies) => {
    const { userRepository, emailService, cacheService, logger } = dependencies;
    
    const validateUserData = (userData) => {
        const errors = [];
        if (!userData.email?.includes('@')) errors.push('Invalid email');
        if (!userData.password || userData.password.length < 8) errors.push('Password too weak');
        return errors;
    };
    
    const createUser = async (userData) => {
        const validationErrors = validateUserData(userData);
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }
        
        const existingUser = await userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('User already exists');
        }
        
        const user = await userRepository.create(userData);
        await emailService.sendWelcomeEmail(user.email);
        await cacheService.del('all-users'); // Invalidate cache
        
        logger.info('User created successfully', { userId: user.id });
        return user;
    };
    
    const getUserById = async (userId) => {
        const cacheKey = `user:${userId}`;
        const cachedUser = await cacheService.get(cacheKey);
        
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }
        
        const user = await userRepository.findById(userId);
        if (user) {
            await cacheService.set(cacheKey, JSON.stringify(user), 3600); // Cache for 1 hour
        }
        
        return user;
    };
    
    // Return service methods
    return { createUser, getUserById, validateUserData };
};

// Usage
const userService = createUserService({
    userRepository: userRepository,
    emailService: emailService,
    cacheService: redisClient,
    logger: logger
});

// Functions can be passed around and used independently
const userValidator = userService.validateUserData;
const isValid = userValidator({ email: 'test@example.com', password: 'securepass' });

// ## 4. Functions Stored in Data Structures

// ### Router Configuration & Plugin System
// Production: Dynamic route registration
const routes = {
    // Public routes
    public: [
        {
            method: 'POST',
            path: '/api/auth/login',
            handler: AuthController.login,
            validation: loginSchema
        },
        {
            method: 'POST',
            path: '/api/auth/register',
            handler: AuthController.register,
            validation: registerSchema
        }
    ],
    
    // Protected routes
    protected: [
        {
            method: 'GET',
            path: '/api/users/me',
            handler: UserController.getCurrentUser,
            middleware: [authenticate]
        },
        {
            method: 'PUT',
            path: '/api/users/me',
            handler: UserController.updateCurrentUser,
            middleware: [authenticate, validateBody(updateUserSchema)]
        }
    ],
    
    // Admin routes
    admin: [
        {
            method: 'GET',
            path: '/api/admin/users',
            handler: AdminController.getAllUsers,
            middleware: [authenticate, requireRole('admin')]
        }
    ]
};

// Dynamic route registration function
const registerRoutes = (app, routeConfig) => {
    Object.entries(routeConfig).forEach(([type, routeList]) => {
        routeList.forEach(route => {
            const middlewares = Array.isArray(route.middleware) ? route.middleware : [];
            
            app[route.method.toLowerCase()](
                route.path,
                ...middlewares,
                asyncHandler(route.handler)
            );
            
            logger.info(`Registered ${type} route: ${route.method} ${route.path}`);
        });
    });
};

// Register all routes
registerRoutes(app, routes);

// ### Command Pattern for Undoable Operations
// Production: Command registry and executor
class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.history = [];
    }
    
    register(commandName, executeFn, undoFn) {
        this.commands.set(commandName, { execute: executeFn, undo: undoFn });
    }
    
    async execute(commandName, ...args) {
        const command = this.commands.get(commandName);
        if (!command) {
            throw new Error(`Command not found: ${commandName}`);
        }
        
        const result = await command.execute(...args);
        this.history.push({ commandName, args, timestamp: new Date() });
        
        return result;
    }
    
    async undo() {
        if (this.history.length === 0) return;
        
        const lastCommand = this.history.pop();
        const command = this.commands.get(lastCommand.commandName);
        
        if (command.undo) {
            await command.undo(...lastCommand.args);
        }
    }
    
    getHistory() {
        return this.history.slice();
    }
}

// Usage in e-commerce application
const commandRegistry = new CommandRegistry();

// Register commands with their execute and undo functions
commandRegistry.register(
    'createOrder',
    async (orderData) => {
        const order = await Order.create(orderData);
        await InventoryService.reserveItems(order.items);
        await EmailService.sendOrderConfirmation(order.userEmail, order);
        return order;
    },
    async (orderData) => {
        await Order.deleteOne({ _id: orderData._id });
        await InventoryService.releaseItems(orderData.items);
        await EmailService.sendOrderCancellation(orderData.userEmail, orderData);
    }
);

commandRegistry.register(
    'updateUserProfile',
    async (userId, updates) => {
        const oldProfile = await User.findById(userId);
        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
        return { old: oldProfile, new: updatedUser };
    },
    async (userId, updates, originalState) => {
        await User.findByIdAndUpdate(userId, originalState.old);
    }
);

// Execute commands
const order = await commandRegistry.execute('createOrder', {
    userId: '123',
    items: [{ productId: '456', quantity: 2 }],
    total: 99.98
});

// ## 5. Function Composition & Pipelines

// ### Data Processing Pipeline
// Production: ETL (Extract, Transform, Load) pipeline
const pipe = (...fns) => (value) => fns.reduce((acc, fn) => fn(acc), value);

const asyncPipe = (...fns) => async (value) => {
    let result = value;
    for (const fn of fns) {
        result = await fn(result);
    }
    return result;
};

// Data processing functions
const fetchUserData = async (userId) => {
    const response = await fetch(`${USERS_API}/${userId}`);
    return response.json();
};

const validateUserData = (userData) => {
    if (!userData.id || !userData.email) {
        throw new Error('Invalid user data');
    }
    return userData;
};

const enrichWithProfile = async (userData) => {
    const profile = await Profile.findOne({ userId: userData.id });
    return { ...userData, profile };
};

const normalizeData = (userData) => ({
    id: userData.id,
    email: userData.email.toLowerCase(),
    name: userData.name?.trim(),
    profile: userData.profile || {},
    processedAt: new Date().toISOString()
});

const saveToDatabase = async (normalizedData) => {
    return await ProcessedUser.create(normalizedData);
};

// Composed pipeline
const processUserPipeline = asyncPipe(
    fetchUserData,
    validateUserData,
    enrichWithProfile,
    normalizeData,
    saveToDatabase
);

// Usage
try {
    const result = await processUserPipeline('user-123');
    logger.info('User processing completed', { userId: 'user-123' });
} catch (error) {
    logger.error('User processing failed', error, { userId: 'user-123' });
}

// ### Request Processing Middleware Pipeline
// Production: Request processing chain
const createRequestProcessor = (middlewares) => async (req, res) => {
    let context = { req, res, data: {} };
    
    for (const middleware of middlewares) {
        context = await middleware(context);
        if (context.responseSent) break; // Stop if response was sent
    }
    
    return context;
};

// Individual middleware functions
const parseBody = async (context) => {
    if (context.req.body) {
        context.data.parsedBody = context.req.body;
    }
    return context;
};

const validateRequest = async (context) => {
    const { schema } = context.req.routeConfig || {};
    if (schema) {
        const { error } = schema.validate(context.data.parsedBody);
        if (error) {
            context.res.status(400).json({ error: error.details[0].message });
            context.responseSent = true;
        }
    }
    return context;
};

const authenticate = async (context) => {
    const token = context.req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        context.res.status(401).json({ error: 'Authentication required' });
        context.responseSent = true;
        return context;
    }
    
    try {
        context.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        context.res.status(401).json({ error: 'Invalid token' });
        context.responseSent = true;
    }
    
    return context;
};

const processBusinessLogic = async (context) => {
    if (context.responseSent) return context;
    
    // Actual business logic here
    context.result = await someBusinessOperation(context.data.parsedBody, context.user);
    return context;
};

// Composed processor
const apiRequestProcessor = createRequestProcessor([
    parseBody,
    validateRequest,
    authenticate,
    processBusinessLogic
]);

// Usage in route handler
app.post('/api/data', async (req, res) => {
    const context = await apiRequestProcessor({ req, res });
    if (!context.responseSent) {
        res.json(context.result);
    }
});

// ## 6. Functions in Object-Oriented Patterns

// ### Strategy Pattern
// Production: Payment processing strategies
class PaymentProcessor {
    constructor() {
        this.strategies = new Map();
    }
    
    registerStrategy(paymentMethod, strategy) {
        this.strategies.set(paymentMethod, strategy);
    }
    
    async processPayment(paymentMethod, amount, paymentData) {
        const strategy = this.strategies.get(paymentMethod);
        if (!strategy) {
            throw new Error(`Unsupported payment method: ${paymentMethod}`);
        }
        
        try {
            const result = await strategy.process(amount, paymentData);
            await this.logPayment(paymentMethod, amount, 'success');
            return result;
        } catch (error) {
            await this.logPayment(paymentMethod, amount, 'failed', error.message);
            throw error;
        }
    }
    
    async logPayment(method, amount, status, error = null) {
        await PaymentLog.create({
            method,
            amount,
            status,
            error,
            timestamp: new Date()
        });
    }
}

// Strategy implementations (functions as objects)
const creditCardStrategy = {
    async process(amount, paymentData) {
        const { cardNumber, expiry, cvv, holderName } = paymentData;
        
        // Validate card details
        if (!this.validateCard(cardNumber, expiry, cvv)) {
            throw new Error('Invalid card details');
        }
        
        // Process via payment gateway
        const result = await PaymentGateway.chargeCreditCard({
            amount,
            cardNumber,
            expiry,
            cvv,
            holderName
        });
        
        return { transactionId: result.id, status: 'completed' };
    },
    
    validateCard(cardNumber, expiry, cvv) {
        // Actual validation logic
        return cardNumber?.length === 16 && cvv?.length === 3;
    }
};

const paypalStrategy = {
    async process(amount, paymentData) {
        const { paypalToken } = paymentData;
        
        if (!paypalToken) {
            throw new Error('PayPal token required');
        }
        
        const result = await PayPalService.executePayment(paypalToken, amount);
        return { transactionId: result.transaction_id, status: 'completed' };
    }
};

const cryptoStrategy = {
    async process(amount, paymentData) {
        const { walletAddress, cryptocurrency } = paymentData;
        
        const transaction = await CryptoService.createTransaction(
            walletAddress,
            cryptocurrency,
            amount
        );
        
        return { 
            transactionId: transaction.hash, 
            status: 'pending',
            confirmationUrl: transaction.confirmationUrl
        };
    }
};

// Usage
const paymentProcessor = new PaymentProcessor();
paymentProcessor.registerStrategy('credit_card', creditCardStrategy);
paymentProcessor.registerStrategy('paypal', paypalStrategy);
paymentProcessor.registerStrategy('crypto', cryptoStrategy);

// Process payments using different strategies
const creditCardResult = await paymentProcessor.processPayment(
    'credit_card', 
    99.99, 
    { cardNumber: '4111111111111111', expiry: '12/25', cvv: '123', holderName: 'John Doe' }
);

const paypalResult = await paymentProcessor.processPayment(
    'paypal',
    49.99,
    { paypalToken: 'EC-123456789' }
);

// ## 7. Functional Reactive Programming (FRP) Patterns

// ### Event Bus with Functional Handlers
// Production: Event-driven architecture
class EventBus {
    constructor() {
        this.handlers = new Map();
        this.middlewares = [];
    }
    
    // Register event handler functions
    on(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);
        return this; // For chaining
    }
    
    // Register middleware functions
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }
    
    // Emit event through middleware pipeline
    async emit(eventType, eventData) {
        let context = { eventType, eventData, processed: false };
        
        // Run through middleware pipeline
        for (const middleware of this.middlewares) {
            context = await middleware(context);
            if (context.processed) break;
        }
        
        // Execute handlers
        const handlers = this.handlers.get(eventType) || [];
        await Promise.all(
            handlers.map(handler => handler(context.eventData))
        );
        
        return context;
    }
}

// Middleware functions
const loggingMiddleware = async (context) => {
    logger.info(`Event emitted: ${context.eventType}`, context.eventData);
    return context;
};

const validationMiddleware = async (context) => {
    if (context.eventType === 'user.created' && !context.eventData.email) {
        logger.warn('Invalid user.created event - missing email');
        context.processed = true;
    }
    return context;
};

const enrichmentMiddleware = async (context) => {
    if (context.eventType === 'order.placed') {
        context.eventData.timestamp = new Date().toISOString();
        context.eventData.eventId = generateId();
    }
    return context;
};

// Handler functions
const sendWelcomeEmail = async (userData) => {
    await EmailService.sendTemplate('welcome', userData.email, {
        name: userData.name,
        loginUrl: `${process.env.APP_URL}/login`
    });
};

const updateUserMetrics = async (userData) => {
    await AnalyticsService.track('user_registered', {
        userId: userData.id,
        source: userData.source,
        timestamp: new Date()
    });
};

const notifyAdmins = async (userData) => {
    await NotificationService.sendToRole('admin', 'new_user', {
        userId: userData.id,
        userEmail: userData.email,
        registrationDate: new Date()
    });
};

// Setup event bus
const eventBus = new EventBus()
    .use(loggingMiddleware)
    .use(validationMiddleware)
    .use(enrichmentMiddleware)
    .on('user.created', sendWelcomeEmail)
    .on('user.created', updateUserMetrics)
    .on('user.created', notifyAdmins)
    .on('order.placed', async (orderData) => {
        await InventoryService.updateStock(orderData.items);
        await AnalyticsService.track('purchase', orderData);
    });

// Usage in application
app.post('/api/users', async (req, res) => {
    const user = await UserService.create(req.body);
    
    // Emit event - all handlers execute automatically
    await eventBus.emit('user.created', {
        id: user.id,
        email: user.email,
        name: user.name,
        source: 'web_registration'
    });
    
    res.status(201).json(user);
});

// These production-grade patterns demonstrate how JavaScript's first-class functions enable:
// - **Modularity**: Breaking down complex operations into composable functions
// - **Flexibility**: Runtime behavior changes through function assignment
// - **Testability**: Easy mocking and testing of individual functions
// - **Maintainability**: Clear separation of concerns
// - **Scalability**: Easy addition of new functionality through function registration
// - **Reusability**: Functions can be shared across different parts of the application