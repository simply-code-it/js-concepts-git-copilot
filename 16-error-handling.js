// Here's a comprehensive collection of production-grade try...catch patterns for Node.js backend development:

// ## 1. Basic Error Handling Patterns

// ### Basic Try-Catch
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('Failed to complete operation');
}

// ### With Error Classification
try {
  const result = await databaseQuery();
  return result;
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new DatabaseConnectionError('Database unavailable');
  } else if (error.code === '23505') {
    throw new ConflictError('Duplicate entry');
  } else {
    throw new InternalServerError('Unexpected error occurred');
  }
}

// ## 2. Async/Await Error Handling
// 
// ### Wrapper Function Pattern
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (error.retryable === false || attempt === maxRetries) {
        break;
      }
      
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
  
  throw lastError;
}

// ### Parallel Operations with Error Handling
async function executeParallelOperations(operations) {
  try {
    const results = await Promise.all(
      operations.map(op => 
        op().catch(error => {
          // Convert rejection to resolution with error
          return { error, success: false };
        })
      )
    );

    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(e => e.error),
        `${errors.length} operations failed`
      );
    }

    return results;
  } catch (error) {
    logger.error('Parallel operations failed', { error });
    throw error;
  }
}

// ## 3. Production Error Classes

// ### Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 503);
    this.originalError = originalError;
    this.code = originalError?.code;
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400);
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

// ## 4. Express.js Middleware Patterns

// ### Global Error Handler
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Operational error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      error: {
        message: err.message,
        code: err.code,
        timestamp: err.timestamp
      }
    });
  }

  // Programming or unknown errors: don't leak details
  return res.status(500).json({
    error: {
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    }
  });
}

// ### Async Error Wrapper Middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage in routes
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }
  res.json(user);
}));

// ### Route-specific Error Handling
function createUserHandler() {
  return async (req, res, next) => {
    try {
      const { email, password, name } = req.body;
      
      // Validation
      if (!email || !password) {
        throw new ValidationError('Email and password are required');
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new ConflictError('User already exists');
      }

      const user = await User.create({ email, password, name });
      
      res.status(201).json({
        success: true,
        data: user.toJSON()
      });
    } catch (error) {
      next(error);
    }
  };
}

// ## 5. Database Operation Patterns

// ### Transaction with Error Handling
async function executeTransaction(operations) {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const results = [];
    for (const operation of operations) {
      const result = await operation(session);
      results.push(result);
    }
    
    await session.commitTransaction();
    return results;
  } catch (error) {
    await session.abortTransaction();
    
    if (error.code === 112) { // Write conflict
      throw new ConflictError('Transaction conflict, please retry');
    }
    
    logger.error('Transaction failed', { error });
    throw new DatabaseError('Transaction failed', error);
  } finally {
    session.endSession();
  }
}

// ### Database Connection Error Handling
class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('Database connected successfully');
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      
      logger.error('Database connection failed', {
        error: error.message,
        attempt: this.connectionRetries
      });

      if (this.connectionRetries < this.maxRetries) {
        setTimeout(() => this.connect(), 
          Math.pow(2, this.connectionRetries) * 1000
        );
      } else {
        logger.error('Max database connection retries exceeded');
        process.exit(1);
      }
    }
  }
}

// ## 6. External API Call Patterns

// ### HTTP Request with Retry Logic
async function makeAPICall(url, options = {}, retries = 3) {
  try {
    const response = await fetch(url, {
      timeout: 10000,
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      await new Promise(resolve => 
        setTimeout(resolve, 1000 * (4 - retries))
      );
      return makeAPICall(url, options, retries - 1);
    }
    
    throw new ExternalServiceError(
      `API call to ${url} failed`,
      error
    );
  }
}

function isRetryableError(error) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  
  return retryableCodes.includes(error.code) || 
         retryableStatuses.includes(error.statusCode);
}

// ## 7. File Operation Patterns

// ### File Processing with Cleanup
async function processFile(filePath) {
  let fileHandle;
  
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const content = await fileHandle.readFile({ encoding: 'utf8' });
    
    const processedData = await transformContent(content);
    return processedData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('File not found');
    } else if (error.code === 'EACCES') {
      throw new ForbiddenError('No permission to read file');
    } else {
      throw new InternalServerError('File processing failed', error);
    }
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(closeError => {
        logger.warn('Failed to close file handle', { error: closeError });
      });
    }
  }
}

// ## 8. Process-Level Error Handling

// ### Unhandled Rejection and Exception Handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
  
  // In production, might want to exit after logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  
  // Give time to flush logs
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// ### Graceful Shutdown
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close database connections
    await mongoose.connection.close();
    logger.info('Database connection closed');

    // Close other resources
    await redisClient.quit();
    logger.info('Redis client closed');

    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ## 9. Validation and Sanitization

// ### Input Validation with Detailed Errors
function validateUserInput(input) {
  const errors = [];

  if (!input.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(input.email)) {
    errors.push('Invalid email format');
  }

  if (!input.password) {
    errors.push('Password is required');
  } else if (input.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid input data', errors);
  }

  return sanitizeInput(input);
}

// ## 10. Monitoring and Logging Integration

// ### Structured Error Logging
class ErrorLogger {
  static logError(error, context = {}) {
    const logEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
      isOperational: error.isOperational,
      ...(error.originalError && {
        originalError: {
          message: error.originalError.message,
          code: error.originalError.code
        }
      })
    };

    // Log to different transports based on environment
    if (process.env.NODE_ENV === 'production') {
      logger.error(logEntry);
      
      // Send to error tracking service
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, { extra: context });
      }
    } else {
      console.error(JSON.stringify(logEntry, null, 2));
    }
  }
}

// These patterns provide robust error handling for production Node.js applications, ensuring proper error classification, logging, and user-friendly error responses while maintaining application stability.



























// Here's a comprehensive collection of production-grade `try...catch...finally` patterns for Node.js backend development:

// ## 1. Basic Try-Catch-Finally Patterns

// ### Basic Structure with Resource Cleanup
async function processData() {
  let resource = null;
  
  try {
    resource = await acquireResource();
    const result = await performOperation(resource);
    return result;
  } catch (error) {
    logger.error('Operation failed', { error: error.message });
    throw new ApplicationError('Processing failed', error);
  } finally {
    if (resource) {
      await releaseResource(resource).catch(releaseError => {
        logger.warn('Resource release failed', { error: releaseError.message });
      });
    }
  }
}

// ### Database Connection Management
async function executeQuery(query, params) {
  let connection = null;
  
  try {
    connection = await database.getConnection();
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ConflictError('Duplicate entry found');
    } else if (error.code === 'ER_NO_REFERENCED_ROW') {
      throw new ValidationError('Referenced entity not found');
    }
    throw new DatabaseError('Query execution failed', error);
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (releaseError) {
        logger.error('Connection release failed', { 
          error: releaseError.message 
        });
      }
    }
  }
}

// ## 2. File System Operations

// ### File Processing with Guaranteed Cleanup
async function processLargeFile(filePath) {
  let fileHandle = null;
  let tempFileHandle = null;
  
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    tempFileHandle = await fs.promises.open('/tmp/processed.txt', 'w');
    
    const stream = fileHandle.createReadStream();
    const processedStream = await transformStream(stream);
    
    for await (const chunk of processedStream) {
      await tempFileHandle.write(chunk);
    }
    
    await tempFileHandle.sync();
    return '/tmp/processed.txt';
  } catch (error) {
    logger.error('File processing failed', { 
      filePath, 
      error: error.message 
    });
    throw new FileProcessingError('Failed to process file', error);
  } finally {
    const cleanupPromises = [];
    
    if (fileHandle) {
      cleanupPromises.push(
        fileHandle.close().catch(closeError => 
          logger.warn('File handle close failed', { error: closeError.message })
        )
      );
    }
    
    if (tempFileHandle) {
      cleanupPromises.push(
        tempFileHandle.close().catch(closeError => 
          logger.warn('Temp file close failed', { error: closeError.message })
        )
      );
    }
    
    await Promise.allSettled(cleanupPromises);
  }
}

// ### Temporary File Creation with Cleanup
async function createTemporaryFile(content) {
  const tempPath = `/tmp/temp-${Date.now()}.txt`;
  let fileHandle = null;
  
  try {
    fileHandle = await fs.promises.open(tempPath, 'w');
    await fileHandle.writeFile(content);
    await fileHandle.sync();
    return tempPath;
  } catch (error) {
    // Clean up if file was created but write failed
    await fs.promises.unlink(tempPath).catch(() => {});
    throw new FileSystemError('Failed to create temporary file', error);
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(closeError => {
        logger.warn('Failed to close file handle', { error: closeError.message });
      });
    }
  }
}

// ## 3. Transaction Management

// ### Database Transaction with Rollback
async function executeTransactionalOperations(operations) {
  const session = await mongoose.startSession();
  let transactionCommitted = false;
  
  try {
    session.startTransaction();
    
    const results = [];
    for (const operation of operations) {
      const result = await operation(session);
      results.push(result);
    }
    
    await session.commitTransaction();
    transactionCommitted = true;
    
    return results;
  } catch (error) {
    if (!transactionCommitted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        logger.error('Transaction abort failed', { 
          error: abortError.message 
        });
      }
    }
    
    if (error.code === 112) { // Write conflict
      throw new ConflictError('Transaction conflict occurred');
    }
    
    throw new DatabaseTransactionError('Transaction failed', error);
  } finally {
    try {
      await session.endSession();
    } catch (endError) {
      logger.warn('Session end failed', { error: endError.message });
    }
  }
}

// ## 4. External API Calls with Circuit Breaker

// ### API Call with Timeout and Cleanup
async function callExternalAPI(url, data, options = {}) {
  let timeoutId = null;
  let response = null;
  
  try {
    const controller = new AbortController();
    const { timeout = 10000 } = options;
    
    timeoutId = setTimeout(() => controller.abort(), timeout);
    
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TimeoutError('API request timed out');
    }
    
    logger.error('External API call failed', { 
      url, 
      error: error.message 
    });
    throw new ExternalServiceError('Service temporarily unavailable');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (response && typeof response.body?.cancel === 'function') {
      response.body.cancel().catch(() => {});
    }
  }
}

// ## 5. Resource Pool Management

// ### Connection Pool with Guaranteed Release
class ResourcePool {
  async withResource(callback) {
    let resource = null;
    let acquired = false;
    
    try {
      resource = await this.acquire();
      acquired = true;
      
      const result = await callback(resource);
      return result;
    } catch (error) {
      if (acquired) {
        this.markResourceAsFaulty(resource);
      }
      throw error;
    } finally {
      if (resource && acquired) {
        try {
          await this.release(resource);
        } catch (releaseError) {
          logger.error('Resource release failed', {
            error: releaseError.message
          });
        }
      }
    }
  }
}

// Usage
const pool = new ResourcePool();
const result = await pool.withResource(async (resource) => {
  return await resource.performOperation();
});

// ## 6. Stream Processing

// ### Stream Handling with Proper Cleanup
async function processStream(inputStream, outputStream) {
  let inputClosed = false;
  let outputClosed = false;
  
  try {
    return new Promise((resolve, reject) => {
      inputStream
        .pipe(transformStream)
        .pipe(outputStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  } catch (error) {
    logger.error('Stream processing failed', { error: error.message });
    throw new StreamProcessingError('Stream operation failed', error);
  } finally {
    // Ensure streams are properly destroyed
    if (!inputClosed) {
      inputStream.destroy().catch(() => {});
    }
    
    if (!outputClosed) {
      outputStream.destroy().catch(() => {});
    }
  }
}

// ## 7. Cache Operations

// ### Cache Operation with Fallback
async function getWithCache(key, fallbackOperation, ttl = 300) {
  let cacheUsed = false;
  
  try {
    // Try to get from cache first
    const cached = await redis.get(key);
    if (cached) {
      cacheUsed = true;
      return JSON.parse(cached);
    }
    
    // Fallback to actual operation
    const result = await fallbackOperation();
    
    // Cache the result (fire and forget)
    redis.setex(key, ttl, JSON.stringify(result))
      .catch(error => 
        logger.warn('Cache set failed', { error: error.message })
      );
    
    return result;
  } catch (error) {
    if (cacheUsed) {
      // If we got data from cache but it's invalid, clear it
      await redis.del(key).catch(() => {});
    }
    throw error;
  } finally {
    // Perform any cleanup or metrics collection
    metrics.increment(`cache.${cacheUsed ? 'hit' : 'miss'}`);
  }
}

// ## 8. Mutex/Lock Patterns

// ### Distributed Lock with Guaranteed Release
async function withLock(lockKey, operation, ttl = 10000) {
  let lockAcquired = false;
  let lock = null;
  
  try {
    lock = await redlock.acquire([lockKey], ttl);
    lockAcquired = true;
    
    const result = await operation();
    return result;
  } catch (error) {
    if (error.name === 'LockError') {
      throw new ResourceBusyError('Resource is currently locked');
    }
    throw error;
  } finally {
    if (lock && lockAcquired) {
      try {
        await lock.release();
      } catch (releaseError) {
        logger.warn('Lock release failed', { 
          lockKey, 
          error: releaseError.message 
        });
        
        // Attempt to force release after timeout
        setTimeout(async () => {
          try {
            await redlock.forceRelease(lock);
          } catch (forceError) {
            logger.error('Force lock release failed', {
              lockKey,
              error: forceError.message
            });
          }
        }, ttl);
      }
    }
  }
}

// ## 9. Child Process Management

// ### Child Process with Timeout and Cleanup
async function executeChildProcess(command, args, options = {}) {
  let childProcess = null;
  let timeoutId = null;
  
  try {
    childProcess = spawn(command, args, {
      timeout: options.timeout || 30000,
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set up timeout
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, options.timeout);
    }
    
    const exitCode = await new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve(stdout);
        } else {
          const error = new Error(`Process exited with code ${code}`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.exitCode = code;
          reject(error);
        }
      });
      
      childProcess.on('error', reject);
    });
    
    return exitCode;
  } catch (error) {
    if (error.killed) {
      throw new TimeoutError('Process execution timed out');
    }
    throw new ProcessExecutionError('Child process failed', error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGKILL');
    }
  }
}

// ## 10. Complex Workflow with Multiple Resources

// ### Multi-resource Workflow
async function complexWorkflow(data) {
  let dbConnection = null;
  let fileHandle = null;
  let externalAPIConnection = null;
  let success = false;
  
  try {
    // Step 1: Database operation
    dbConnection = await getDatabaseConnection();
    const dbResult = await dbConnection.execute('INSERT INTO ...', data);
    
    // Step 2: File operation
    fileHandle = await fs.promises.open('/tmp/data.txt', 'w');
    await fileHandle.writeFile(JSON.stringify(dbResult));
    
    // Step 3: External API call
    externalAPIConnection = await connectToExternalAPI();
    const apiResult = await externalAPIConnection.send(data);
    
    success = true;
    return apiResult;
  } catch (error) {
    logger.error('Complex workflow failed', {
      step: 'workflow_execution',
      error: error.message
    });
    
    // Compensating actions based on what succeeded
    if (dbConnection) {
      await performRollback(dbConnection).catch(rollbackError =>
        logger.warn('Rollback failed', { error: rollbackError.message })
      );
    }
    
    throw new WorkflowError('Workflow execution failed', error);
  } finally {
    const cleanupTasks = [];
    
    if (dbConnection) {
      cleanupTasks.push(
        dbConnection.release().catch(releaseError =>
          logger.warn('DB connection release failed', { 
            error: releaseError.message 
          })
        )
      );
    }
    
    if (fileHandle) {
      cleanupTasks.push(
        fileHandle.close().catch(closeError =>
          logger.warn('File handle close failed', { 
            error: closeError.message 
          })
        )
      );
    }
    
    if (externalAPIConnection) {
      cleanupTasks.push(
        externalAPIConnection.disconnect().catch(disconnectError =>
          logger.warn('API disconnect failed', { 
            error: disconnectError.message 
          })
        )
      );
    }
    
    await Promise.allSettled(cleanupTasks);
    
    // Log workflow completion
    logger.info('Workflow completed', { success });
  }
}

// ## 11. Metrics and Monitoring Integration

// ### Instrumented Operation with Finally
async function instrumentedOperation(operationName, operation) {
  const startTime = Date.now();
  let success = false;
  
  try {
    const result = await operation();
    success = true;
    return result;
  } catch (error) {
    metrics.increment(`operation.${operationName}.error`);
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    metrics.timing(`operation.${operationName}.duration`, duration);
    metrics.increment(`operation.${operationName}.${success ? 'success' : 'failure'}`);
    
    logger.debug('Operation completed', {
      operation: operationName,
      duration,
      success
    });
  }
}

// ## Key Production Considerations:

// 1. **Always clean up resources** in finally blocks
// 2. **Use Promise.allSettled()** for multiple cleanup operations
// 3. **Log cleanup failures** but don't let them mask original errors
// 4. **Set resource flags** to track acquisition state
// 5. **Use timeouts** for operations that might hang
// 6. **Implement compensating actions** for partial failures
// 7. **Collect metrics** on operation success/failure rates
// 8. **Handle nested resources** with proper cleanup order

// These patterns ensure that your Node.js application properly handles errors while maintaining resource integrity and providing good observability in production environments.




























// Here's a comprehensive collection of production-grade exception throwing patterns for Node.js backend development:

// ## 1. Custom Exception Classes

// ### Base Application Error Classes
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.code = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, true, details);
    this.type = 'VALIDATION_ERROR';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.type = 'AUTHENTICATION_ERROR';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
    this.type = 'AUTHORIZATION_ERROR';
  }
}

class NotFoundError extends AppError {
  constructor(resource, id = null) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 404);
    this.resource = resource;
    this.id = id;
    this.type = 'NOT_FOUND_ERROR';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.type = 'CONFLICT_ERROR';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429);
    this.retryAfter = retryAfter;
    this.type = 'RATE_LIMIT_ERROR';
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service unavailable') {
    super(`${service}: ${message}`, 502);
    this.service = service;
    this.type = 'EXTERNAL_SERVICE_ERROR';
  }
}

class DatabaseError extends AppError {
  constructor(operation, originalError) {
    super(`Database operation failed: ${operation}`, 503, false);
    this.operation = operation;
    this.originalError = originalError;
    this.type = 'DATABASE_ERROR';
  }
}

// ## 2. Input Validation & Sanitization

// ### Request Validation with Detailed Errors
function validateUserRegistration(input) {
  const errors = [];

  // Email validation
  if (!input.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Password validation
  if (!input.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else {
    if (input.password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(input.password)) {
      errors.push({ 
        field: 'password', 
        message: 'Password must contain uppercase, lowercase, and numbers' 
      });
    }
  }

  // Name validation
  if (input.name && input.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must be less than 100 characters' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid input data', errors);
  }
}

// Usage in controller
async function registerUser(req, res, next) {
  try {
    validateUserRegistration(req.body);
    
    const user = await UserService.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

// ### Database Entity Validation
class UserService {
  static async findByEmail(email) {
    if (!email) {
      throw new ValidationError('Email is required for user lookup');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError('User', email);
    }

    return user;
  }

  static async createUser(userData) {
    // Check for existing user
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    try {
      return await User.create(userData);
    } catch (error) {
      if (error.code === 11000) { // MongoDB duplicate key
        throw new ConflictError('User already exists');
      }
      throw new DatabaseError('createUser', error);
    }
  }
}

// ## 3. Business Logic Exceptions

// ### Domain-Specific Business Rules
class OrderService {
  static async placeOrder(userId, orderData) {
    // Validate user exists and is active
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    if (!user.isActive) {
      throw new AuthorizationError('User account is suspended');
    }

    // Check product availability
    for (const item of orderData.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new NotFoundError('Product', item.productId);
      }
      if (product.stock < item.quantity) {
        throw new ConflictError(`Insufficient stock for product: ${product.name}`);
      }
    }

    // Validate payment method
    if (!orderData.paymentMethod) {
      throw new ValidationError('Payment method is required');
    }

    // Check order limits
    const dailyOrderCount = await Order.count({
      userId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (dailyOrderCount >= 10) {
      throw new RateLimitError('Daily order limit exceeded', 24 * 60 * 60);
    }

    try {
      return await Order.create({ userId, ...orderData });
    } catch (error) {
      throw new DatabaseError('placeOrder', error);
    }
  }
}

// ### Workflow State Validation
class WorkflowService {
  static async transitionTask(taskId, newStatus, userId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }

    // Validate user permissions
    if (!await this.canModifyTask(userId, task)) {
      throw new AuthorizationError('You do not have permission to modify this task');
    }

    // Validate state transition
    const validTransitions = {
      'PENDING': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['COMPLETED', 'BLOCKED'],
      'BLOCKED': ['IN_PROGRESS'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    if (!validTransitions[task.status]?.includes(newStatus)) {
      throw new ConflictError(
        `Invalid state transition from ${task.status} to ${newStatus}`
      );
    }

    // Business rule: Cannot complete task without required fields
    if (newStatus === 'COMPLETED' && !task.completedAt) {
      throw new ValidationError('Completion date is required for completed tasks');
    }

    task.status = newStatus;
    return await task.save();
  }
}

// ## 4. Authentication & Authorization

// ### JWT Token Validation
class AuthService {
  static async verifyToken(token) {
    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      if (!user.isActive) {
        throw new AuthorizationError('Account deactivated');
      }

      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token');
      }
      throw new AuthenticationError('Token verification failed');
    }
  }

  static async requireRole(requiredRole) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        if (!req.user.roles.includes(requiredRole)) {
          throw new AuthorizationError(
            `Required role: ${requiredRole}. Your roles: ${req.user.roles.join(', ')}`
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

// ## 5. External Service Integration

// ### API Client with Error Mapping
class PaymentServiceClient {
  constructor() {
    this.baseURL = process.env.PAYMENT_SERVICE_URL;
    this.timeout = 10000;
  }

  async processPayment(paymentData) {
    let response;
    
    try {
      response = await fetch(`${this.baseURL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PAYMENT_SERVICE_TOKEN}`
        },
        body: JSON.stringify(paymentData),
        timeout: this.timeout
      });
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new ExternalServiceError('PaymentService', 'Request timeout');
      }
      if (error.code === 'ECONNREFUSED') {
        throw new ExternalServiceError('PaymentService', 'Service unavailable');
      }
      throw new ExternalServiceError('PaymentService', `Network error: ${error.message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      
      switch (response.status) {
        case 400:
          throw new ValidationError(`Payment validation failed: ${errorBody}`);
        case 401:
          throw new AuthenticationError('Payment service authentication failed');
        case 402:
          throw new ConflictError(`Payment failed: ${errorBody}`);
        case 429:
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError('Payment rate limit exceeded', parseInt(retryAfter));
        case 503:
          throw new ExternalServiceError('PaymentService', 'Service temporarily unavailable');
        default:
          throw new ExternalServiceError('PaymentService', `HTTP ${response.status}: ${errorBody}`);
      }
    }

    return await response.json();
  }
}

// ## 6. Database Operation Exceptions

// ### Database Error Handling with Context
class UserRepository {
  static async updateUser(userId, updateData) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new NotFoundError('User', userId);
      }

      return user;
    } catch (error) {
      // MongoDB specific error handling
      if (error.name === 'ValidationError') {
        const details = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        throw new ValidationError('Database validation failed', details);
      }

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictError(`${field} already exists`);
      }

      if (error.name === 'CastError') {
        throw new ValidationError(`Invalid ${error.path}: ${error.value}`);
      }

      throw new DatabaseError('updateUser', error);
    }
  }

  static async transactionalOperation(operations) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const results = [];
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      
      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      
      if (error.code === 112) { // Write conflict
        throw new ConflictError('Transaction conflict, please retry');
      }
      
      throw new DatabaseError('transactionalOperation', error);
    } finally {
      session.endSession();
    }
  }
}

// ## 7. File Operations & Streams

// ### File Processing with Validation
class FileService {
  static async validateAndProcessFile(filePath, allowedTypes = ['image/jpeg', 'image/png']) {
    // Check file exists
    try {
      await fs.promises.access(filePath);
    } catch (error) {
      throw new NotFoundError('File', filePath);
    }

    // Check file size
    const stats = await fs.promises.stat(filePath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (stats.size > maxSize) {
      throw new ValidationError(`File size exceeds limit of ${maxSize} bytes`);
    }

    if (stats.size === 0) {
      throw new ValidationError('File is empty');
    }

    // Validate file type (basic extension check)
    const ext = path.extname(filePath).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    
    if (!allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
      );
    }

    try {
      // Process file
      return await this.processImage(filePath);
    } catch (error) {
      if (error.code === 'ENOSPC') {
        throw new ExternalServiceError('FileSystem', 'Insufficient disk space');
      }
      throw new Error(`File processing failed: ${error.message}`);
    }
  }

  static async uploadFile(userId, file, options = {}) {
    // Check user storage quota
    const userStorage = await this.calculateUserStorage(userId);
    const maxStorage = options.maxStorage || 100 * 1024 * 1024; // 100MB
    
    if (userStorage + file.size > maxStorage) {
      throw new AuthorizationError('Storage quota exceeded');
    }

    // Validate file type using magic numbers
    const actualType = await this.detectFileType(file.buffer);
    if (!options.allowedTypes.includes(actualType)) {
      throw new ValidationError(`File type ${actualType} not allowed`);
    }

    // Check for malicious content
    if (await this.containsMaliciousContent(file.buffer)) {
      throw new ValidationError('File contains potentially malicious content');
    }

    return await this.saveFile(userId, file);
  }
}

// ## 8. Rate Limiting & Throttling

// ### Custom Rate Limiting Implementation
class RateLimitService {
  static async checkRateLimit(identifier, limit, windowMs) {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    
    try {
      const current = await redis.get(key);
      
      if (current) {
        const [count, resetTime] = current.split(':');
        
        if (now < parseInt(resetTime)) {
          if (parseInt(count) >= limit) {
            const retryAfter = Math.ceil((parseInt(resetTime) - now) / 1000);
            throw new RateLimitError(
              `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
              retryAfter
            );
          }
        }
      }

      // Reset or increment counter
      const newCount = current && now < parseInt(resetTime) ? parseInt(count) + 1 : 1;
      const newResetTime = now + windowMs;
      
      await redis.setex(key, Math.ceil(windowMs / 1000), `${newCount}:${newResetTime}`);
      
      return {
        limit,
        remaining: limit - newCount,
        reset: new Date(newResetTime)
      };
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      // Don't block requests if Redis is down
      logger.warn('Rate limit check failed, allowing request', { error: error.message });
      return { limit, remaining: limit, reset: new Date(now + windowMs) };
    }
  }
}

// Usage in middleware
const rateLimiter = (limit = 100, windowMs = 900000) => {
  return async (req, res, next) => {
    try {
      const identifier = req.ip || req.connection.remoteAddress;
      const limits = await RateLimitService.checkRateLimit(identifier, limit, windowMs);
      
      res.set({
        'X-RateLimit-Limit': limits.limit,
        'X-RateLimit-Remaining': limits.remaining,
        'X-RateLimit-Reset': Math.floor(limits.reset.getTime() / 1000)
      });
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.set('Retry-After', error.retryAfter);
      }
      next(error);
    }
  };
};

// ## 9. Configuration & Environment Validation

// ### Startup Validation
class ConfigValidator {
  static validateRequiredConfig() {
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'JWT_SECRET',
      'REDIS_URL',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY'
    ];

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please check your .env file or deployment configuration.'
      );
    }

    // Validate specific format requirements
    if (process.env.NODE_ENV && !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
      throw new Error(
        `Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: development, production, test`
      );
    }

    // Validate JWT secret strength in production
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET?.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters long in production environment'
      );
    }
  }

  static async validateDatabaseConnection() {
    try {
      await mongoose.connect(process.env.DATABASE_URL, {
        serverSelectionTimeoutMS: 5000
      });
      logger.info('Database connection validated');
    } catch (error) {
      throw new Error(
        `Database connection failed: ${error.message}. ` +
        'Please check DATABASE_URL and ensure database is accessible.'
      );
    }
  }
}

// Application startup
async function startServer() {
  try {
    ConfigValidator.validateRequiredConfig();
    await ConfigValidator.validateDatabaseConnection();
    
    app.listen(process.env.PORT, () => {
      logger.info(`Server running on port ${process.env.PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// ## 10. Utility Functions for Exception Handling

// ### Exception Factory Functions
class ExceptionFactory {
  static notFound(resource, id = null) {
    return new NotFoundError(resource, id);
  }

  static validation(field, message) {
    return new ValidationError(message, [{ field, message }]);
  }

  static unauthorized(message = 'Authentication required') {
    return new AuthenticationError(message);
  }

  static forbidden(message = 'Insufficient permissions') {
    return new AuthorizationError(message);
  }

  static conflict(message = 'Resource conflict') {
    return new ConflictError(message);
  }

  static externalService(service, message) {
    return new ExternalServiceError(service, message);
  }

  static database(operation, error) {
    return new DatabaseError(operation, error);
  }
}

// Usage
async function getUserProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw ExceptionFactory.notFound('User', userId);
  }
  
  if (!user.isProfilePublic) {
    throw ExceptionFactory.forbidden('User profile is private');
  }
  
  return user;
}

// ## Key Production Considerations:

// 1. **Use specific error types** for different scenarios
// 2. **Include contextual information** in errors
// 3. **Map external service errors** to your domain
// 4. **Validate inputs early** and throw meaningful errors
// 5. **Use operational vs programmer errors** appropriately
// 6. **Include error codes** for client-side handling
// 7. **Log sufficient context** for debugging
// 8. **Consider internationalization** for error messages

// These patterns ensure consistent, meaningful exception handling throughout your Node.js backend application.































// Here's a comprehensive collection of production-grade optional catch binding patterns for Node.js backend development:

// ## 1. Basic Optional Catch Binding Patterns

// ### Silent Error Ignoring (Use with Caution)
// Only use when you're absolutely sure errors can be safely ignored
async function sendAnalyticsEvent(eventData) {
  try {
    await analyticsClient.track(eventData);
  } catch {
    // Silently ignore analytics errors - don't affect main functionality
    // Logging might still be appropriate in some cases
  }
}

async function cleanupTempFiles() {
  try {
    await fs.promises.rm('/tmp/old_files', { recursive: true });
  } catch {
    // Ignore if temp files don't exist or can't be deleted
    // Common in cleanup operations
  }
}

// ### Fire-and-Forget Operations
class NotificationService {
  async sendBackgroundNotification(userId, message) {
    try {
      await this.queueNotification(userId, message);
    } catch {
      // Background notifications shouldn't break main flow
      metrics.increment('notification.queue_failed');
    }
  }

  async flushMetrics() {
    try {
      await this.sendMetricsToExternalService();
    } catch {
      // Metric collection failures shouldn't affect application
      // They're important but not critical
    }
  }
}

// ## 2. Logging-Centric Error Handling

// ### Logging Without Error Details
async function cacheWarmup() {
  try {
    const data = await fetchPopularData();
    await redis.setex('popular_data', 300, JSON.stringify(data));
    logger.info('Cache warmup completed successfully');
  } catch {
    // We don't care why it failed, just that it failed
    logger.warn('Cache warmup failed - proceeding without cached data');
    metrics.increment('cache.warmup_failed');
  }
}

async function databaseHealthCheck() {
  try {
    await mongoose.connection.db.admin().ping();
    logger.debug('Database health check passed');
    return true;
  } catch {
    logger.warn('Database health check failed');
    return false;
  }
}

// ### Conditional Logging Based on Context
class FeatureFlagService {
  async isFeatureEnabled(featureName, userId) {
    try {
      const flags = await this.fetchFeatureFlags(userId);
      return flags[featureName] || false;
    } catch {
      // If feature service is down, default to safe behavior
      logger.warn(`Feature flag service unavailable, defaulting to false for: ${featureName}`);
      
      // Critical features might default differently
      if (this.isCriticalFeature(featureName)) {
        logger.error(`Critical feature flag unavailable: ${featureName}`);
        return true; // Or false based on business logic
      }
      
      return false;
    }
  }
}

// ## 3. Fallback Pattern with Optional Catch

// ### Graceful Degradation
class ContentService {
  async getContentWithFallback(contentId) {
    let content;
    
    // Try primary source
    try {
      content = await this.fetchFromPrimarySource(contentId);
      return content;
    } catch {
      // Silently fall back to secondary source
      logger.debug(`Primary source failed for content ${contentId}, trying secondary`);
    }
    
    // Try secondary source
    try {
      content = await this.fetchFromSecondarySource(contentId);
      return content;
    } catch {
      // Final fallback
      logger.warn(`All content sources failed for ${contentId}, using default`);
      return this.getDefaultContent();
    }
  }
}

class PaymentService {
  async processPayment(paymentData) {
    // Try primary payment gateway
    try {
      return await this.primaryGateway.charge(paymentData);
    } catch {
      // Fall back to secondary gateway without logging specific error
      metrics.increment('payment.primary_gateway_failed');
    }
    
    try {
      return await this.secondaryGateway.charge(paymentData);
    } catch {
      // If both fail, we need to know why
      throw new Error('All payment gateways failed');
    }
  }
}

// ### Cache Fallback Patterns
class DataService {
  async getWithCachedFallback(key, dataFetcher, ttl = 300) {
    // Try cache first
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache is unavailable, proceed to fetch fresh data
      metrics.increment('cache.unavailable');
    }
    
    // Fetch fresh data
    const freshData = await dataFetcher();
    
    // Try to cache, but don't fail if caching doesn't work
    try {
      await redis.setex(key, ttl, JSON.stringify(freshData));
    } catch {
      // Cache set failed, but we still return fresh data
      metrics.increment('cache.set_failed');
    }
    
    return freshData;
  }
}

// ## 4. Background Job Patterns

// ### Non-Critical Background Tasks
class BackgroundJobService {
  async runCleanupJob() {
    try {
      await this.cleanupExpiredSessions();
      await this.aggregateDailyMetrics();
      await this.removeOldTempFiles();
    } catch {
      // Background cleanup jobs shouldn't crash the application
      // Log generic failure but don't expose details
      logger.warn('Background cleanup job completed with errors');
      metrics.increment('background_jobs.cleanup_failed');
    }
  }
  
  async syncWithExternalService() {
    try {
      await this.performSync();
      logger.info('External service sync completed');
    } catch {
      // External service might be temporarily unavailable
      // We'll try again on next scheduled run
      logger.warn('External service sync failed - will retry later');
      metrics.increment('sync.failed');
    }
  }
}

// ### Periodic Health Checks
class HealthMonitor {
  async checkDependencies() {
    const results = {
      database: false,
      redis: false,
      externalService: false
    };
    
    // Check database
    try {
      await mongoose.connection.db.admin().ping();
      results.database = true;
    } catch {
      results.database = false;
    }
    
    // Check Redis
    try {
      await redis.ping();
      results.redis = true;
    } catch {
      results.redis = false;
    }
    
    // Check external service
    try {
      await this.checkExternalService();
      results.externalService = true;
    } catch {
      results.externalService = false;
    }
    
    return results;
  }
}

// ## 5. Event-Driven Architecture Patterns

// ### Event Emission with Error Suppression
class EventEmitterService {
  async emitUserEvent(eventType, userData) {
    const event = { type: eventType, data: userData, timestamp: Date.now() };
    
    // Emit to multiple subscribers, don't let one failure affect others
    const subscribers = [this.analyticsService, this.notificationService, this.auditService];
    
    for (const subscriber of subscribers) {
      try {
        await subscriber.handleUserEvent(event);
      } catch {
        // Individual subscriber failures shouldn't stop other subscribers
        logger.debug(`Event subscriber failed: ${subscriber.constructor.name}`);
        metrics.increment(`events.${eventType}.delivery_failed`);
      }
    }
  }
}

class MessageQueueConsumer {
  async processMessage(message) {
    try {
      await this.handleMessage(message);
      await this.ackMessage(message);
    } catch {
      // Don't ack the message so it can be retried
      // But don't log the specific error to avoid noise
      metrics.increment('message_processing.failed');
    }
  }
}

// ## 6. Resource Cleanup Patterns

// ### Best-Effort Cleanup Operations
class ResourceManager {
  async cleanupResources(resources) {
    const cleanupPromises = resources.map(async (resource) => {
      try {
        await resource.cleanup();
      } catch {
        // Individual resource cleanup failures shouldn't stop others
        metrics.increment('resource_cleanup.failed');
      }
    });
    
    await Promise.allSettled(cleanupPromises);
  }
  
  async releaseDatabaseConnections(connections) {
    for (const connection of connections) {
      try {
        await connection.release();
      } catch {
        // Connection might already be closed or in a bad state
        // Nothing we can do, just continue with others
      }
    }
  }
}

// ### File System Cleanup
async function cleanupWorkspace(workspacePath) {
  const filesToDelete = [
    `${workspacePath}/temp`,
    `${workspacePath}/cache`,
    `${workspacePath}/logs`
  ];
  
  for (const filePath of filesToDelete) {
    try {
      await fs.promises.rm(filePath, { recursive: true, force: true });
    } catch {
      // Files might not exist or we might not have permission
      // Continue cleaning up other files
    }
  }
}

// ## 7. Monitoring & Metrics Collection

// ### Metrics-First Error Handling
class MetricsCollector {
  async recordOperation(operationName, operation) {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      metrics.timing(`operation.${operationName}.duration`, duration);
      metrics.increment(`operation.${operationName}.success`);
      
      return result;
    } catch {
      const duration = Date.now() - startTime;
      
      metrics.timing(`operation.${operationName}.duration`, duration);
      metrics.increment(`operation.${operationName}.failure`);
      
      throw new Error(`Operation ${operationName} failed`);
    }
  }
}

class CircuitBreaker {
  async executeWithCircuitBreaker(operation) {
    if (this.state === 'OPEN') {
      metrics.increment('circuit_breaker.open_rejected');
      throw new Error('Service unavailable');
    }
    
    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch {
      this.recordFailure();
      metrics.increment('circuit_breaker.operation_failed');
      throw new Error('Operation failed');
    }
  }
}

// ## 8. Configuration & Feature Toggles

// ### Optional Configuration Loading
class ConfigLoader {
  async loadOptionalConfig(configPath) {
    try {
      const configData = await fs.promises.readFile(configPath, 'utf8');
      return JSON.parse(configData);
    } catch {
      // Config file doesn't exist or is invalid
      // Return empty config and use defaults
      return {};
    }
  }
  
  async loadExternalConfig(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch {
      // External config service is down
      // Use local fallback configuration
      logger.warn('External config unavailable, using local fallback');
      return this.loadLocalFallbackConfig();
    }
  }
}

class FeatureToggle {
  async isExperimentalFeatureEnabled() {
    try {
      const toggle = await this.fetchFeatureToggle('experimental_feature');
      return toggle.enabled || false;
    } catch {
      // If feature service is down, default to disabled for safety
      return false;
    }
  }
}

// ## 9. API Response Normalization

// ### Consistent Error Response Formatting
class APIResponseHandler {
  async handleResponse(operation, context) {
    try {
      const data = await operation();
      return {
        success: true,
        data,
        timestamp: new Date().toISOString()
      };
    } catch {
      // We don't care about the specific error for client response
      // All operational errors get the same response format
      return {
        success: false,
        error: {
          message: 'Operation failed',
          code: 'OPERATION_FAILED',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
  
  async processBatchOperations(operations) {
    const results = await Promise.allSettled(operations.map(async (op) => {
      try {
        return { success: true, data: await op() };
      } catch {
        return { success: false, data: null };
      }
    }));
    
    return {
      total: operations.length,
      successful: results.filter(r => r.value.success).length,
      failed: results.filter(r => !r.value.success).length,
      results: results.map(r => r.value)
    };
  }
}

// ## 10. Database Operation Patterns

// ### Non-Critical Database Operations
class AuditLogger {
  async logAuditEvent(event) {
    try {
      await AuditLog.create(event);
    } catch {
      // Audit logging failures shouldn't affect main business logic
      // But we might want to fall back to alternative logging
      await this.fallbackLogging(event);
      metrics.increment('audit_logging.failed');
    }
  }
}

class StatisticsService {
  async incrementViewCount(itemId) {
    try {
      await Statistics.updateOne(
        { itemId },
        { $inc: { viewCount: 1 } },
        { upsert: true }
      );
    } catch {
      // View count statistics are non-critical
      // We can afford to lose some statistical data
      metrics.increment('statistics.update_failed');
    }
  }
}

// ## 11. Third-Party Service Integration

// ### Resilient External Calls
class ExternalServiceClient {
  async sendOptionalWebhook(url, data) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 5000
      });
    } catch {
      // Webhooks are best-effort, don't fail the main operation
      metrics.increment('webhook.delivery_failed');
    }
  }
  
  async syncWithExternalSystem(data) {
    // Try primary sync method
    try {
      return await this.primarySync(data);
    } catch {
      // Try secondary sync method
      metrics.increment('sync.primary_failed');
    }
    
    try {
      return await this.secondarySync(data);
    } catch {
      // If both fail, this might be important enough to log specifically
      logger.error('All sync methods failed');
      throw new Error('Sync failed with all methods');
    }
  }
}

// ## 12. Safe Value Extraction Patterns

// ### Graceful Data Access
class SafeDataAccess {
  static getNestedValue(obj, path, defaultValue = null) {
    try {
      return path.split('.').reduce((current, key) => current[key], obj);
    } catch {
      return defaultValue;
    }
  }
  
  static async parseJSONSafe(jsonString, defaultValue = {}) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return defaultValue;
    }
  }
  
  static async readFileSafe(filePath, defaultValue = '') {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch {
      return defaultValue;
    }
  }
}

// Usage examples
const userPreference = SafeDataAccess.getNestedValue(user, 'preferences.theme', 'default');
const config = await SafeDataAccess.parseJSONSafe(rawConfig, {});
const template = await SafeDataAccess.readFileSafe('/templates/welcome.html', '<h1>Welcome</h1>');

// ## Production Best Practices:

// ### When to Use Optional Catch Binding:

// 1. **Cleanup operations** - Failure shouldn't affect main logic
// 2. **Non-critical background tasks** - Analytics, metrics, logging
// 3. **Fallback scenarios** - When you have alternative implementations
// 4. **Third-party integrations** - When external service failure is expected
// 5. **Best-effort operations** - Where failure is acceptable

// ### When to Avoid Optional Catch Binding:

// 1. **Critical business logic** - Where failure must be understood
// 2. **Financial transactions** - Where errors need investigation
// 3. **User-facing operations** - Where users need specific error messages
// 4. **Security-sensitive code** - Where failures might indicate attacks
// 5. **Data integrity operations** - Where corruption must be prevented

// ### Monitoring Pattern:
class MonitoredOptionalCatch {
  async executeWithMonitoring(operation, context) {
    try {
      return await operation();
    } catch {
      // Even when using optional catch, track failures
      metrics.increment(`optional_catch.${context}.failed`);
      
      // Consider logging at appropriate level
      if (this.isCriticalContext(context)) {
        logger.warn(`Optional operation failed in critical context: ${context}`);
      }
      
      return this.getDefaultForContext(context);
    }
  }
}

// Optional catch binding is powerful for writing clean, resilient code, but should be used judiciously with proper monitoring to ensure you're not silently ignoring important failures.