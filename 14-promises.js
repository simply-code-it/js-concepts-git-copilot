// I'll provide you with comprehensive code snippets for Promises in JavaScript for Node.js production-grade backend development.

// ## 1. Basic Promise Usage

// Basic promise creation and consumption
const fetchUserData = (userId) => {
  return new Promise((resolve, reject) => {
    // Simulate async operation
    setTimeout(() => {
      if (userId) {
        resolve({ id: userId, name: 'John Doe', email: 'john@example.com' });
      } else {
        reject(new Error('User ID is required'));
      }
    }, 1000);
  });
};

// Usage
fetchUserData(123)
  .then(user => console.log('User:', user))
  .catch(error => console.error('Error:', error.message));

// ## 2. Promise Chaining

class UserService {
  static getUser(userId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (userId) {
          resolve({ id: userId, name: 'John Doe' });
        } else {
          reject(new Error('Invalid user ID'));
        }
      }, 500);
    });
  }

  static getUserProfile(user) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...user, profile: { age: 30, city: 'New York' } });
      }, 300);
    });
  }

  static getUserSettings(profile) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...profile, settings: { theme: 'dark', notifications: true } });
      }, 200);
    });
  }
}

// Promise chaining
UserService.getUser(123)
  .then(user => {
    console.log('User fetched:', user);
    return UserService.getUserProfile(user);
  })
  .then(profile => {
    console.log('Profile fetched:', profile);
    return UserService.getUserSettings(profile);
  })
  .then(fullData => {
    console.log('Full user data:', fullData);
  })
  .catch(error => {
    console.error('Error in user service:', error.message);
  });

// ## 3. Error Handling Patterns

// Comprehensive error handling
class DatabaseService {
  static connect() {
    return new Promise((resolve, reject) => {
      // Simulate database connection
      const isConnected = Math.random() > 0.2;
      
      setTimeout(() => {
        if (isConnected) {
          resolve({ connection: 'established', timestamp: new Date() });
        } else {
          reject(new Error('Database connection failed'));
        }
      }, 1000);
    });
  }

  static query(connection, sql) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (sql.includes('SELECT')) {
          resolve([{ id: 1, data: 'sample' }]);
        } else {
          reject(new Error('Invalid query'));
        }
      }, 500);
    });
  }
}

// Production-grade error handling
async function executeDatabaseOperation() {
  try {
    const connection = await DatabaseService.connect();
    console.log('Database connected:', connection);
    
    const results = await DatabaseService.query(connection, 'SELECT * FROM users');
    console.log('Query results:', results);
    
    return results;
  } catch (error) {
    console.error('Database operation failed:', error.message);
    
    // Different error handling based on error type
    if (error.message.includes('connection')) {
      // Retry logic or fallback
      console.error('Connection error - implement retry logic');
    } else if (error.message.includes('query')) {
      console.error('Query error - validate input');
    }
    
    throw error; // Re-throw for higher level handling
  }
}

// ## 4. Promise Utility Methods

// Promise.all - parallel execution
const fetchMultipleResources = async () => {
  try {
    const [users, posts, comments] = await Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/posts').then(r => r.json()),
      fetch('/api/comments').then(r => r.json())
    ]);

    return { users, posts, comments };
  } catch (error) {
    console.error('Failed to fetch resources:', error);
    throw error;
  }
};

// Promise.allSettled - handle all promises regardless of rejection
const executeBatchOperations = async (operations) => {
  const results = await Promise.allSettled(operations);
  
  const successful = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');
  
  console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);
  
  return {
    successful: successful.map(r => r.value),
    failed: failed.map(r => r.reason)
  };
};

// Promise.race - first to settle wins
const withTimeout = (promise, timeoutMs) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
};

// Promise.any - first to fulfill wins
const fetchFromMultipleSources = async (urls) => {
  const promises = urls.map(url => 
    fetch(url)
      .then(response => response.json())
      .catch(error => Promise.reject(error))
  );
  
  return Promise.any(promises);
};

// ## 5. Production-Grade Service Class

class ApiService {
  constructor(baseURL, timeout = 5000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint);
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

// Usage
const apiService = new ApiService('https://api.example.com');

// With proper error handling
apiService.get('/users')
  .then(users => console.log('Users:', users))
  .catch(error => console.error('API Error:', error.message));

// ## 6. Advanced Promise Patterns

// Retry mechanism with exponential backoff
const retryWithBackoff = async (
  operation,
  maxRetries = 3,
  baseDelay = 1000
) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Circuit breaker pattern
class CircuitBreaker {
  constructor(timeout, failureThreshold, resetTimeout) {
    this.timeout = timeout;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }

  async call(service) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await Promise.race([
        service(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);

      this.success();
      return result;
    } catch (error) {
      this.failure();
      throw error;
    }
  }

  success() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  failure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}

// ## 7. Database Operations with Promises

const mysql = require('mysql2/promise');

class Database {
  constructor(config) {
    this.pool = mysql.createPool({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: 10,
      acquireTimeout: 60000,
      timeout: 60000,
    });
  }

  async query(sql, params = []) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const [rows] = await connection.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async transaction(operations) {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await operations(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

// Usage
const db = new Database({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'myapp'
});

// Transaction example
async function transferFunds(fromAccount, toAccount, amount) {
  return await db.transaction(async (connection) => {
    // Deduct from source account
    await connection.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?',
      [amount, fromAccount, amount]
    );

    // Add to destination account
    await connection.execute(
      'UPDATE accounts SET balance = balance + ? WHERE id = ?',
      [amount, toAccount]
    );

    return { success: true, amount };
  });
}

// ## 8. File Operations with Promises

const fs = require('fs').promises;
const path = require('path');

class FileService {
  static async readFileSafe(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  static async writeFileSafe(filePath, data) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, data, 'utf8');
      return { success: true, path: filePath };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  static async processMultipleFiles(filePaths) {
    const filePromises = filePaths.map(async (filePath) => {
      try {
        const content = await this.readFileSafe(filePath);
        return { filePath, content, status: 'success' };
      } catch (error) {
        return { filePath, error: error.message, status: 'error' };
      }
    });

    return Promise.allSettled(filePromises);
  }
}

// ## 9. Promise Pool for Concurrent Operations

class PromisePool {
  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.running = 0;
  }

  async add(promiseFactory) {
    return new Promise((resolve, reject) => {
      this.queue.push({ promiseFactory, resolve, reject });
      this.process();
    });
  }

  process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { promiseFactory, resolve, reject } = this.queue.shift();

    promiseFactory()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this.process();
      });
  }

  async drain() {
    while (this.queue.length > 0 || this.running > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Usage
const pool = new PromisePool(3);

const tasks = Array.from({ length: 10 }, (_, i) => 
  pool.add(() => someAsyncOperation(i))
);

Promise.all(tasks).then(results => {
  console.log('All tasks completed:', results);
});

// ## 10. Testing Promises

// Using Jest for testing promises
describe('Promise Operations', () => {
  test('should resolve with user data', async () => {
    const userData = await fetchUserData(123);
    expect(userData).toHaveProperty('id', 123);
    expect(userData).toHaveProperty('name');
  });

  test('should reject with error for invalid user ID', async () => {
    await expect(fetchUserData(null)).rejects.toThrow('User ID is required');
  });

  test('should handle multiple parallel requests', async () => {
    const requests = [1, 2, 3].map(id => fetchUserData(id));
    const users = await Promise.all(requests);
    
    expect(users).toHaveLength(3);
    users.forEach(user => {
      expect(user).toHaveProperty('id');
    });
  });

  test('should timeout if operation takes too long', async () => {
    const slowOperation = () => new Promise(resolve => 
      setTimeout(resolve, 2000)
    );
    
    await expect(withTimeout(slowOperation(), 1000))
      .rejects.toThrow('Operation timeout');
  });
});

// These code snippets cover essential Promise patterns for production-grade Node.js backend development, including error handling, concurrent operations, database interactions, and advanced patterns like circuit breakers and promise pools.






























// Here are comprehensive code snippets for Promise Chaining in JavaScript for Node.js production-grade backend development:

// ## 1. Basic Promise Chaining Patterns

// Basic promise chaining with transformation
class UserService {
  static async getUserChain(userId) {
    return Promise.resolve()
      .then(() => {
        console.log('Starting user fetch...');
        return { id: userId, name: 'John Doe' };
      })
      .then(user => {
        console.log('Fetching profile...');
        return { ...user, profile: { age: 30, city: 'New York' } };
      })
      .then(userWithProfile => {
        console.log('Fetching settings...');
        return { 
          ...userWithProfile, 
          settings: { theme: 'dark', notifications: true } 
        };
      })
      .then(fullUserData => {
        console.log('Final processing...');
        return { 
          ...fullUserData, 
          timestamp: new Date().toISOString() 
        };
      });
  }
}

// Usage
UserService.getUserChain(123)
  .then(user => console.log('Final user:', user))
  .catch(error => console.error('Error:', error));

// ## 2. Database Operation Chaining

const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      user: 'your_username',
      host: 'localhost',
      database: 'your_database',
      password: 'your_password',
      port: 5432,
    });
  }

  // Chain database operations in a transaction-like flow
  async createUserWithProfile(userData, profileData) {
    let client;
    
    try {
      client = await this.pool.connect();
      
      return Promise.resolve()
        .then(() => {
          console.log('Starting transaction...');
          return client.query('BEGIN');
        })
        .then(() => {
          console.log('Creating user...');
          return client.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
            [userData.name, userData.email]
          );
        })
        .then(userResult => {
          const userId = userResult.rows[0].id;
          console.log('User created with ID:', userId);
          
          return client.query(
            'INSERT INTO profiles (user_id, bio, avatar) VALUES ($1, $2, $3)',
            [userId, profileData.bio, profileData.avatar]
          )
          .then(() => userId);
        })
        .then(userId => {
          console.log('Profile created, committing transaction...');
          return client.query('COMMIT')
            .then(() => userId);
        })
        .then(userId => {
          console.log('Transaction completed successfully');
          return { success: true, userId, message: 'User created successfully' };
        })
        .catch(error => {
          console.error('Error in chain, rolling back:', error);
          return client.query('ROLLBACK')
            .then(() => Promise.reject(error));
        })
        .finally(() => {
          if (client) client.release();
        });
    } catch (error) {
      if (client) client.release();
      throw error;
    }
  }
}

// ## 3. API Call Chaining with Error Handling

class ApiService {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async fetchUserCompleteData(userId) {
    return Promise.resolve()
      // Step 1: Fetch basic user info
      .then(() => {
        console.log(`Fetching user ${userId}...`);
        return fetch(`${this.baseURL}/users/${userId}`)
          .then(response => {
            if (!response.ok) throw new Error(`User API failed: ${response.status}`);
            return response.json();
          });
      })
      // Step 2: Fetch user's posts
      .then(user => {
        console.log(`Fetching posts for user ${userId}...`);
        return Promise.all([
          user,
          fetch(`${this.baseURL}/users/${userId}/posts`)
            .then(response => {
              if (!response.ok) throw new Error(`Posts API failed: ${response.status}`);
              return response.json();
            })
        ]);
      })
      // Step 3: Fetch user's comments
      .then(([user, posts]) => {
        console.log(`Fetching comments for user ${userId}...`);
        return Promise.all([
          user,
          posts,
          fetch(`${this.baseURL}/users/${userId}/comments`)
            .then(response => {
              if (!response.ok) throw new Error(`Comments API failed: ${response.status}`);
              return response.json();
            })
        ]);
      })
      // Step 4: Combine all data
      .then(([user, posts, comments]) => {
        console.log('Combining all user data...');
        return {
          user,
          posts,
          comments,
          summary: {
            postCount: posts.length,
            commentCount: comments.length,
            lastUpdated: new Date().toISOString()
          }
        };
      })
      // Step 5: Validate and finalize
      .then(completeData => {
        if (!completeData.user || !completeData.posts) {
          throw new Error('Incomplete user data');
        }
        return completeData;
      })
      .catch(error => {
        console.error('Error in user data fetch chain:', error.message);
        throw new Error(`Failed to fetch complete user data: ${error.message}`);
      });
  }
}

// Usage
const apiService = new ApiService('https://api.example.com');
apiService.fetchUserCompleteData(123)
  .then(data => console.log('Complete user data:', data))
  .catch(error => console.error('Final error:', error.message));

// ## 4. File Processing Chain

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

class FileProcessor {
  static async processFileChain(inputPath, outputPath) {
    return Promise.resolve()
      // Step 1: Read file
      .then(() => {
        console.log('Reading input file...');
        return fs.readFile(inputPath, 'utf8');
      })
      // Step 2: Validate content
      .then(content => {
        console.log('Validating content...');
        if (!content || content.trim().length === 0) {
          throw new Error('File is empty or invalid');
        }
        return content;
      })
      // Step 3: Process content
      .then(content => {
        console.log('Processing content...');
        // Example processing: convert to JSON array
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map((line, index) => ({
          id: index + 1,
          content: line.trim(),
          length: line.length,
          processedAt: new Date().toISOString()
        }));
      })
      // Step 4: Compress data
      .then(processedData => {
        console.log('Compressing data...');
        const jsonData = JSON.stringify(processedData, null, 2);
        return gzip(Buffer.from(jsonData, 'utf8'))
          .then(compressedData => ({ compressedData, originalSize: jsonData.length }));
      })
      // Step 5: Write output
      .then(({ compressedData, originalSize }) => {
        console.log('Writing output file...');
        return fs.writeFile(outputPath, compressedData)
          .then(() => ({
            inputPath,
            outputPath,
            originalSize,
            compressedSize: compressedData.length,
            compressionRatio: (compressedData.length / originalSize * 100).toFixed(2) + '%',
            timestamp: new Date().toISOString()
          }));
      })
      // Step 6: Cleanup and finalize
      .then(stats => {
        console.log('File processing completed successfully');
        return {
          success: true,
          stats,
          message: 'File processed and compressed successfully'
        };
      })
      .catch(error => {
        console.error('File processing failed:', error.message);
        // Cleanup on failure
        return fs.unlink(outputPath)
          .catch(() => {}) // Ignore cleanup errors
          .then(() => Promise.reject(error));
      });
  }
}

// Usage
FileProcessor.processFileChain('./input.txt', './output.gz')
  .then(result => console.log('Processing result:', result))
  .catch(error => console.error('Processing failed:', error.message));

// ## 5. Authentication & Authorization Chain

class AuthService {
  constructor() {
    this.blacklistedTokens = new Set();
  }

  async authenticateRequestChain(request) {
    return Promise.resolve()
      // Step 1: Extract and validate token
      .then(() => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
          throw new Error('No authorization token provided');
        }
        return token;
      })
      // Step 2: Check blacklist
      .then(token => {
        if (this.blacklistedTokens.has(token)) {
          throw new Error('Token is blacklisted');
        }
        return token;
      })
      // Step 3: Verify token signature
      .then(token => {
        console.log('Verifying token signature...');
        // Simulate JWT verification
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (token === 'valid-token') {
              resolve({ userId: 123, role: 'admin' });
            } else {
              reject(new Error('Invalid token signature'));
            }
          }, 100);
        });
      })
      // Step 4: Check user permissions
      .then(decodedToken => {
        console.log('Checking user permissions...');
        if (decodedToken.role !== 'admin') {
          throw new Error('Insufficient permissions');
        }
        return decodedToken;
      })
      // Step 5: Log authentication success
      .then(user => {
        console.log(`User ${user.userId} authenticated successfully`);
        return {
          authenticated: true,
          user,
          timestamp: new Date().toISOString()
        };
      })
      .catch(error => {
        console.error('Authentication failed:', error.message);
        return {
          authenticated: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      });
  }
}

// Usage
const authService = new AuthService();
const request = {
  headers: {
    authorization: 'Bearer valid-token'
  }
};

authService.authenticateRequestChain(request)
  .then(result => console.log('Auth result:', result))
  .catch(error => console.error('Auth error:', error));

// ## 6. E-commerce Order Processing Chain

class OrderService {
  constructor() {
    this.inventory = new Map([
      ['product1', 10],
      ['product2', 5],
      ['product3', 0]
    ]);
  }

  async processOrderChain(order) {
    return Promise.resolve()
      // Step 1: Validate order structure
      .then(() => {
        console.log('Validating order structure...');
        if (!order.items || order.items.length === 0) {
          throw new Error('Order must contain items');
        }
        if (!order.customerId) {
          throw new Error('Customer ID is required');
        }
        return order;
      })
      // Step 2: Check inventory
      .then(validatedOrder => {
        console.log('Checking inventory...');
        const unavailableItems = validatedOrder.items.filter(item => 
          !this.inventory.has(item.productId) || this.inventory.get(item.productId) < item.quantity
        );

        if (unavailableItems.length > 0) {
          throw new Error(`Insufficient inventory for: ${unavailableItems.map(i => i.productId).join(', ')}`);
        }

        return validatedOrder;
      })
      // Step 3: Calculate total
      .then(validatedOrder => {
        console.log('Calculating order total...');
        const total = validatedOrder.items.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);

        return { ...validatedOrder, total };
      })
      // Step 4: Process payment
      .then(orderWithTotal => {
        console.log('Processing payment...');
        // Simulate payment processing
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (orderWithTotal.paymentMethod === 'valid') {
              resolve({ ...orderWithTotal, paymentStatus: 'completed' });
            } else {
              reject(new Error('Payment processing failed'));
            }
          }, 500);
        });
      })
      // Step 5: Update inventory
      .then(paidOrder => {
        console.log('Updating inventory...');
        paidOrder.items.forEach(item => {
          const currentStock = this.inventory.get(item.productId);
          this.inventory.set(item.productId, currentStock - item.quantity);
        });
        return paidOrder;
      })
      // Step 6: Generate order confirmation
      .then(processedOrder => {
        console.log('Generating order confirmation...');
        return {
          orderId: `ORD-${Date.now()}`,
          customerId: processedOrder.customerId,
          items: processedOrder.items,
          total: processedOrder.total,
          status: 'completed',
          estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString()
        };
      })
      .catch(error => {
        console.error('Order processing failed:', error.message);
        // Compensating actions for failed order
        return this.compensateOrder(order)
          .then(() => Promise.reject(error));
      });
  }

  async compensateOrder(order) {
    console.log('Performing compensation actions...');
    // Rollback any changes made during the failed processing
    return Promise.resolve();
  }
}

// Usage
const orderService = new OrderService();
const order = {
  customerId: 'cust123',
  paymentMethod: 'valid',
  items: [
    { productId: 'product1', quantity: 2, price: 25 },
    { productId: 'product2', quantity: 1, price: 50 }
  ]
};

orderService.processOrderChain(order)
  .then(confirmation => console.log('Order confirmed:', confirmation))
  .catch(error => console.error('Order failed:', error.message));

// ## 7. Data Validation & Transformation Chain

class DataPipeline {
  static async processDataChain(rawData) {
    return Promise.resolve(rawData)
      // Step 1: Validate input data
      .then(data => {
        console.log('Validating input data...');
        if (!Array.isArray(data)) {
          throw new Error('Input must be an array');
        }
        return data;
      })
      // Step 2: Filter invalid entries
      .then(data => {
        console.log('Filtering invalid entries...');
        return data.filter(entry => 
          entry && 
          typeof entry === 'object' && 
          entry.id && 
          entry.value !== undefined
        );
      })
      // Step 3: Transform data structure
      .then(validData => {
        console.log('Transforming data structure...');
        return validData.map(entry => ({
          identifier: `item-${entry.id}`,
          value: Number(entry.value),
          category: entry.value > 50 ? 'high' : 'low',
          processed: true,
          timestamp: new Date().toISOString()
        }));
      })
      // Step 4: Enrich with additional data
      .then(transformedData => {
        console.log('Enriching with additional data...');
        return Promise.all(
          transformedData.map(item => 
            this.fetchAdditionalData(item.identifier)
              .then(additionalData => ({
                ...item,
                metadata: additionalData,
                enriched: true
              }))
              .catch(() => ({
                ...item,
                metadata: null,
                enriched: false
              }))
          )
        );
      })
      // Step 5: Group by category
      .then(enrichedData => {
        console.log('Grouping data by category...');
        return enrichedData.reduce((groups, item) => {
          const category = item.category;
          if (!groups[category]) {
            groups[category] = [];
          }
          groups[category].push(item);
          return groups;
        }, {});
      })
      // Step 6: Generate summary statistics
      .then(groupedData => {
        console.log('Generating summary statistics...');
        const categories = Object.keys(groupedData);
        const totalItems = categories.reduce((sum, category) => 
          sum + groupedData[category].length, 0
        );
        
        return {
          data: groupedData,
          summary: {
            totalItems,
            categories,
            highValueCount: groupedData.high?.length || 0,
            lowValueCount: groupedData.low?.length || 0,
            processingTime: new Date().toISOString()
          }
        };
      });
  }

  static async fetchAdditionalData(identifier) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          source: 'external-api',
          confidence: Math.random(),
          tags: ['processed', 'validated']
        });
      }, 100);
    });
  }
}

// Usage
const rawData = [
  { id: 1, value: '75' },
  { id: 2, value: '25' },
  { id: 3, value: 'invalid' },
  { id: 4, value: '90' }
];

DataPipeline.processDataChain(rawData)
  .then(result => console.log('Processing result:', JSON.stringify(result, null, 2)))
  .catch(error => console.error('Processing error:', error.message));

// ## 8. Error Recovery & Fallback Chain

class ResilientService {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async resilientOperationChain(primaryOperation, fallbackOperations = []) {
    return Promise.resolve()
      // Attempt primary operation
      .then(() => {
        console.log('Attempting primary operation...');
        return primaryOperation();
      })
      // If primary fails, try fallbacks in sequence
      .catch(primaryError => {
        console.log('Primary operation failed, attempting fallbacks...');
        return this.executeFallbacks(fallbackOperations, primaryError);
      })
      // Final validation
      .then(result => {
        console.log('Validating final result...');
        if (!this.isValidResult(result)) {
          throw new Error('Final result validation failed');
        }
        return result;
      })
      // Final error handling
      .catch(finalError => {
        console.error('All operations failed:', finalError.message);
        return this.getDefaultResponse();
      });
  }

  async executeFallbacks(fallbackOperations, originalError) {
    if (fallbackOperations.length === 0) {
      throw originalError;
    }

    const [currentFallback, ...remainingFallbacks] = fallbackOperations;

    return Promise.resolve()
      .then(() => {
        console.log(`Attempting fallback operation: ${currentFallback.name}`);
        return currentFallback();
      })
      .catch(fallbackError => {
        console.log(`Fallback failed: ${fallbackError.message}`);
        if (remainingFallbacks.length > 0) {
          return this.executeFallbacks(remainingFallbacks, fallbackError);
        }
        throw fallbackError;
      });
  }

  isValidResult(result) {
    return result !== null && result !== undefined;
  }

  getDefaultResponse() {
    return {
      success: false,
      message: 'Service unavailable, please try again later',
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }
}

// Usage
const resilientService = new ResilientService();

const primaryOp = () => Promise.reject(new Error('Primary service down'));
const fallback1 = () => Promise.reject(new Error('Fallback 1 down'));
const fallback2 = () => Promise.resolve({ data: 'from fallback 2', success: true });

resilientService.resilientOperationChain(primaryOp, [fallback1, fallback2])
  .then(result => console.log('Final result:', result))
  .catch(error => console.error('Unexpected error:', error));

// These production-grade promise chaining patterns demonstrate:

// 1. **Sequential operations** with data transformation
// 2. **Proper error handling** and recovery mechanisms
// 3. **Database transaction**-like flows
// 4. **API call sequencing** with dependency management
// 5. **File processing** pipelines
// 6. **Authentication/authorization** chains
// 7. **Business logic** flows (e-commerce, data processing)
// 8. **Resilient operations** with fallback strategies

// Each chain includes comprehensive logging, error handling, and follows production best practices for maintainable and reliable backend services.





























// Here are comprehensive code snippets for `Promise.all()` in JavaScript for Node.js production-grade backend development:

// ## 1. Basic Promise.all() Patterns

// Basic parallel execution with Promise.all()
class BasicParallelOperations {
  static async fetchMultipleResources() {
    try {
      const [users, products, orders] = await Promise.all([
        this.fetchUsers(),
        this.fetchProducts(),
        this.fetchOrders()
      ]);

      return {
        users,
        products,
        orders,
        summary: {
          totalUsers: users.length,
          totalProducts: products.length,
          totalOrders: orders.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error fetching resources:', error);
      throw new Error('Failed to fetch multiple resources');
    }
  }

  static async fetchUsers() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]);
      }, 100);
    });
  }

  static async fetchProducts() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([{ id: 1, name: 'Product A' }, { id: 2, name: 'Product B' }]);
      }, 150);
    });
  }

  static async fetchOrders() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([{ id: 1, total: 100 }, { id: 2, total: 200 }]);
      }, 200);
    });
  }
}

// Usage
BasicParallelOperations.fetchMultipleResources()
  .then(result => console.log('Resources:', result))
  .catch(error => console.error('Error:', error.message));

// ## 2. Database Operations with Promise.all()

const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      user: 'your_username',
      host: 'localhost',
      database: 'your_database',
      password: 'your_password',
      port: 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async getDashboardData(userId) {
    let client;
    
    try {
      client = await this.pool.connect();
      
      const [
        userResult,
        ordersResult,
        paymentsResult,
        notificationsResult
      ] = await Promise.all([
        client.query('SELECT * FROM users WHERE id = $1', [userId]),
        client.query(
          `SELECT * FROM orders 
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days' 
           ORDER BY created_at DESC LIMIT 10`,
          [userId]
        ),
        client.query(
          `SELECT * FROM payments 
           WHERE user_id = $1 AND status = 'completed'
           ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ),
        client.query(
          `SELECT * FROM notifications 
           WHERE user_id = $1 AND read = false 
           ORDER BY created_at DESC LIMIT 20`,
          [userId]
        )
      ]);

      return {
        user: userResult.rows[0] || null,
        recentOrders: ordersResult.rows,
        recentPayments: paymentsResult.rows,
        unreadNotifications: notificationsResult.rows,
        metadata: {
          fetchedAt: new Date().toISOString(),
          ordersCount: ordersResult.rows.length,
          notificationsCount: notificationsResult.rows.length
        }
      };
    } catch (error) {
      console.error('Database dashboard error:', error);
      throw new Error('Failed to fetch dashboard data');
    } finally {
      if (client) client.release();
    }
  }

  async batchUpdateUsers(usersUpdateData) {
    try {
      const updatePromises = usersUpdateData.map(userData =>
        this.pool.query(
          'UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3',
          [userData.name, userData.email, userData.id]
        )
      );

      const results = await Promise.all(updatePromises);

      const summary = {
        totalProcessed: results.length,
        successfulUpdates: results.filter(result => result.rowCount > 0).length,
        failedUpdates: results.filter(result => result.rowCount === 0).length,
        timestamp: new Date().toISOString()
      };

      return summary;
    } catch (error) {
      console.error('Batch update error:', error);
      throw new Error('Failed to batch update users');
    }
  }
}

// Usage
const dbService = new DatabaseService();

// Get dashboard data
dbService.getDashboardData(123)
  .then(dashboard => console.log('Dashboard:', dashboard))
  .catch(error => console.error('Error:', error.message));

// Batch update
const usersToUpdate = [
  { id: 1, name: 'John Updated', email: 'john.updated@example.com' },
  { id: 2, name: 'Jane Updated', email: 'jane.updated@example.com' }
];

dbService.batchUpdateUsers(usersToUpdate)
  .then(summary => console.log('Batch update summary:', summary))
  .catch(error => console.error('Batch update error:', error.message));

// ## 3. API Aggregation with Promise.all()

const axios = require('axios');
const https = require('https');

class ApiAggregationService {
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      httpsAgent: new https.Agent({ keepAlive: true }),
      headers: {
        'User-Agent': 'Production-Backend/1.0.0'
      }
    });

    this.services = {
      userService: 'https://api.users.example.com',
      orderService: 'https://api.orders.example.com',
      inventoryService: 'https://api.inventory.example.com',
      paymentService: 'https://api.payments.example.com'
    };
  }

  async getUserCompleteProfile(userId) {
    try {
      const [
        userProfile,
        userOrders,
        userPreferences,
        loyaltyInfo
      ] = await Promise.all([
        this.fetchWithRetry(`${this.services.userService}/users/${userId}`),
        this.fetchWithRetry(`${this.services.orderService}/orders?userId=${userId}&limit=5`),
        this.fetchWithRetry(`${this.services.userService}/users/${userId}/preferences`),
        this.fetchWithRetry(`${this.services.userService}/users/${userId}/loyalty`)
      ]);

      return {
        profile: userProfile.data,
        recentOrders: userOrders.data.orders || [],
        preferences: userPreferences.data || {},
        loyalty: loyaltyInfo.data || {},
        summary: {
          totalOrders: userOrders.data.total || 0,
          loyaltyTier: loyaltyInfo.data.tier || 'standard',
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('API aggregation error:', error.message);
      throw new Error('Failed to fetch complete user profile');
    }
  }

  async fetchWithRetry(url, retries = 3, backoff = 300) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.axiosInstance.get(url);
        return response;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        console.log(`Attempt ${attempt} failed for ${url}, retrying...`);
        await this.sleep(backoff * attempt);
      }
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async batchProcessWebhooks(webhooks) {
    try {
      const processingPromises = webhooks.map(webhook =>
        this.processSingleWebhook(webhook)
          .then(result => ({ success: true, webhookId: webhook.id, result }))
          .catch(error => ({ 
            success: false, 
            webhookId: webhook.id, 
            error: error.message 
          }))
      );

      const results = await Promise.all(processingPromises);

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        failures: results.filter(r => !r.success).map(r => ({
          webhookId: r.webhookId,
          error: r.error
        })),
        processedAt: new Date().toISOString()
      };

      return { results, summary };
    } catch (error) {
      console.error('Webhook batch processing error:', error);
      throw new Error('Failed to process webhooks batch');
    }
  }

  async processSingleWebhook(webhook) {
    // Simulate webhook processing
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({ status: 'processed', webhookId: webhook.id });
        } else {
          reject(new Error('Webhook processing failed'));
        }
      }, 100);
    });
  }
}

// Usage
const apiService = new ApiAggregationService();

// Get complete user profile
apiService.getUserCompleteProfile(123)
  .then(profile => console.log('Complete profile:', profile))
  .catch(error => console.error('Error:', error.message));

// Process webhooks in batch
const webhooks = [
  { id: 'wh_1', type: 'user.created', data: { userId: 1 } },
  { id: 'wh_2', type: 'order.completed', data: { orderId: 100 } },
  { id: 'wh_3', type: 'payment.failed', data: { paymentId: 200 } }
];

apiService.batchProcessWebhooks(webhooks)
  .then(({ results, summary }) => {
    console.log('Webhook processing summary:', summary);
    console.log('Detailed results:', results);
  })
  .catch(error => console.error('Webhook processing error:', error.message));

// ## 4. File Processing with Promise.all()

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileProcessor {
  constructor() {
    this.allowedExtensions = new Set(['.txt', '.json', '.csv', '.log']);
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async processMultipleFiles(filePaths) {
    try {
      // First, validate all files
      const validationResults = await Promise.all(
        filePaths.map(filePath => this.validateFile(filePath))
      );

      const validFiles = validationResults.filter(result => result.isValid);
      const invalidFiles = validationResults.filter(result => !result.isValid);

      if (validFiles.length === 0) {
        throw new Error('No valid files to process');
      }

      // Process valid files in parallel
      const processingPromises = validFiles.map(validFile =>
        this.processSingleFile(validFile.filePath)
          .then(result => ({ ...result, status: 'success' }))
          .catch(error => ({
            filePath: validFile.filePath,
            status: 'error',
            error: error.message
          }))
      );

      const processingResults = await Promise.all(processingPromises);

      return {
        processed: processingResults.filter(r => r.status === 'success'),
        failed: processingResults.filter(r => r.status === 'error'),
        invalid: invalidFiles,
        summary: {
          totalFiles: filePaths.length,
          processed: processingResults.filter(r => r.status === 'success').length,
          failed: processingResults.filter(r => r.status === 'error').length,
          invalid: invalidFiles.length,
          processingTime: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('File processing error:', error);
      throw new Error(`Failed to process files: ${error.message}`);
    }
  }

  async validateFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();

      if (!this.allowedExtensions.has(extension)) {
        return { filePath, isValid: false, reason: 'Invalid file extension' };
      }

      if (stats.size > this.maxFileSize) {
        return { filePath, isValid: false, reason: 'File too large' };
      }

      if (stats.size === 0) {
        return { filePath, isValid: false, reason: 'File is empty' };
      }

      return { filePath, isValid: true, size: stats.size };
    } catch (error) {
      return { filePath, isValid: false, reason: 'File not accessible' };
    }
  }

  async processSingleFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      filePath,
      hash,
      lineCount: lines.length,
      wordCount: content.split(/\s+/).length,
      size: content.length,
      processedAt: new Date().toISOString()
    };
  }

  async generateMultipleFileReports(filePaths, outputDir) {
    try {
      // Create output directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });

      const reportGenerationPromises = filePaths.map(async (filePath, index) => {
        const fileName = path.basename(filePath, path.extname(filePath));
        const outputPath = path.join(outputDir, `${fileName}_report_${index}.json`);
        
        const fileInfo = await this.processSingleFile(filePath);
        const report = {
          fileInfo,
          analysis: {
            hasBinary: this.containsBinary(fileInfo.content),
            encoding: 'utf8',
            complexity: this.calculateComplexity(fileInfo.content)
          },
          generatedAt: new Date().toISOString()
        };

        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        return { input: filePath, output: outputPath, success: true };
      });

      const results = await Promise.allSettled(reportGenerationPromises);

      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      
      const failed = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason);

      return {
        successful,
        failed: failed.map((error, index) => ({
          filePath: filePaths[results.findIndex(r => r.status === 'rejected' && r.reason === error)],
          error: error.message
        })),
        summary: {
          total: filePaths.length,
          successful: successful.length,
          failed: failed.length
        }
      };
    } catch (error) {
      console.error('Report generation error:', error);
      throw new Error('Failed to generate file reports');
    }
  }

  containsBinary(content) {
    // Simple binary detection
    return /[\x00-\x08\x0E-\x1F]/.test(content);
  }

  calculateComplexity(content) {
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).length;
    return lines > 1000 ? 'high' : lines > 100 ? 'medium' : 'low';
  }
}

// Usage
const fileProcessor = new FileProcessor();

const files = ['./file1.txt', './file2.json', './file3.csv', './invalid.exe'];

fileProcessor.processMultipleFiles(files)
  .then(result => {
    console.log('File processing result:');
    console.log('Summary:', result.summary);
    console.log('Processed:', result.processed);
    console.log('Failed:', result.failed);
    console.log('Invalid:', result.invalid);
  })
  .catch(error => console.error('Error:', error.message));

// ## 5. Cache Warming with Promise.all()

class CacheWarmingService {
  constructor(cacheClient) {
    this.cache = cacheClient;
    this.warmupConfig = {
      userProfiles: { ttl: 3600, concurrency: 5 },
      productData: { ttl: 1800, concurrency: 10 },
      geoData: { ttl: 86400, concurrency: 3 }
    };
  }

  async warmUpCache() {
    try {
      console.log('Starting cache warm-up...');
      const startTime = Date.now();

      const [userResults, productResults, geoResults] = await Promise.all([
        this.warmUserProfiles(),
        this.warmProductData(),
        this.warmGeoData()
      ]);

      const duration = Date.now() - startTime;

      const summary = {
        totalWarmed: userResults.warmed + productResults.warmed + geoResults.warmed,
        userProfiles: userResults,
        productData: productResults,
        geoData: geoResults,
        duration: `${duration}ms`,
        warmedAt: new Date().toISOString()
      };

      console.log('Cache warm-up completed:', summary);
      return summary;
    } catch (error) {
      console.error('Cache warm-up failed:', error);
      throw new Error('Cache warm-up operation failed');
    }
  }

  async warmUserProfiles() {
    const userIds = await this.getActiveUserIds();
    const concurrency = this.warmupConfig.userProfiles.concurrency;
    
    const batches = this.chunkArray(userIds, concurrency);
    let warmed = 0;
    let errors = 0;

    for (const batch of batches) {
      try {
        const warmPromises = batch.map(userId =>
          this.warmSingleUserProfile(userId)
            .then(() => warmed++)
            .catch(() => errors++)
        );

        await Promise.all(warmPromises);
        
        // Small delay between batches to avoid overwhelming the system
        await this.delay(100);
      } catch (batchError) {
        console.error('Batch warm-up failed:', batchError);
        errors += batch.length;
      }
    }

    return { warmed, errors, total: userIds.length };
  }

  async warmProductData() {
    const productIds = await this.getPopularProductIds();
    const warmPromises = productIds.map(productId =>
      this.cache.set(
        `product:${productId}`,
        JSON.stringify(await this.fetchProductData(productId)),
        'EX',
        this.warmupConfig.productData.ttl
      )
    );

    const results = await Promise.allSettled(warmPromises);
    
    const warmed = results.filter(r => r.status === 'fulfilled').length;
    const errors = results.filter(r => r.status === 'rejected').length;

    return { warmed, errors, total: productIds.length };
  }

  async warmGeoData() {
    const locations = await this.getImportantLocations();
    
    const warmPromises = locations.map(location =>
      Promise.all([
        this.cache.set(
          `geo:${location.country}:${location.city}`,
          JSON.stringify(await this.fetchGeoData(location)),
          'EX',
          this.warmupConfig.geoData.ttl
        ),
        this.cache.set(
          `geo:coords:${location.lat}:${location.lon}`,
          JSON.stringify(location),
          'EX',
          this.warmupConfig.geoData.ttl
        )
      ])
    );

    const results = await Promise.allSettled(warmPromises);
    
    const warmed = results.filter(r => r.status === 'fulfilled').length * 2; // 2 keys per location
    const errors = results.filter(r => r.status === 'rejected').length * 2;

    return { warmed, errors, total: locations.length * 2 };
  }

  async warmSingleUserProfile(userId) {
    const userData = await this.fetchUserProfile(userId);
    const cacheKey = `user:profile:${userId}`;
    
    await this.cache.set(
      cacheKey,
      JSON.stringify(userData),
      'EX',
      this.warmupConfig.userProfiles.ttl
    );
  }

  // Utility methods
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock data methods
  async getActiveUserIds() {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  async getPopularProductIds() {
    return [100, 101, 102, 103, 104];
  }

  async getImportantLocations() {
    return [
      { country: 'US', city: 'New York', lat: 40.7128, lon: -74.0060 },
      { country: 'UK', city: 'London', lat: 51.5074, lon: -0.1278 },
      { country: 'JP', city: 'Tokyo', lat: 35.6762, lon: 139.6503 }
    ];
  }

  async fetchUserProfile(userId) {
    return { id: userId, name: `User ${userId}`, email: `user${userId}@example.com` };
  }

  async fetchProductData(productId) {
    return { id: productId, name: `Product ${productId}`, price: 100 };
  }

  async fetchGeoData(location) {
    return { ...location, timezone: 'UTC', currency: 'USD' };
  }
}

// Usage with a mock cache client
const mockCache = {
  set: (key, value, mode, ttl) => Promise.resolve('OK')
};

const cacheWarmer = new CacheWarmingService(mockCache);

cacheWarmer.warmUpCache()
  .then(summary => console.log('Cache warm-up summary:', summary))
  .catch(error => console.error('Cache warm-up error:', error.message));

// ## 6. Concurrent Validation with Promise.all()

class ValidationService {
  constructor() {
    this.validators = {
      email: this.validateEmail.bind(this),
      phone: this.validatePhone.bind(this),
      password: this.validatePassword.bind(this),
      username: this.validateUsername.bind(this)
    };
  }

  async validateUserInput(userData) {
    try {
      const validationPromises = Object.entries(userData).map(([field, value]) =>
        this.validateField(field, value)
          .then(result => ({ field, ...result }))
          .catch(error => ({ 
            field, 
            isValid: false, 
            error: error.message 
          }))
      );

      const validationResults = await Promise.all(validationPromises);

      const isValid = validationResults.every(result => result.isValid);
      const errors = validationResults.filter(result => !result.isValid);
      const warnings = validationResults.filter(result => result.warning);

      return {
        isValid,
        errors,
        warnings,
        validatedFields: validationResults.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Validation error:', error);
      throw new Error('Input validation failed');
    }
  }

  async validateField(field, value) {
    const validator = this.validators[field];
    
    if (!validator) {
      return { isValid: true, warning: `No validator for field: ${field}` };
    }

    return validator(value);
  }

  async validateEmail(email) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        resolve({
          isValid,
          message: isValid ? 'Valid email' : 'Invalid email format',
          ...(isValid ? {} : { suggestion: 'Enter a valid email address' })
        });
      }, 50);
    });
  }

  async validatePhone(phone) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const cleaned = phone.replace(/\D/g, '');
        const isValid = cleaned.length >= 10;
        resolve({
          isValid,
          message: isValid ? 'Valid phone number' : 'Invalid phone number',
          ...(isValid ? {} : { suggestion: 'Enter a 10-digit phone number' })
        });
      }, 30);
    });
  }

  async validatePassword(password) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const hasMinLength = password.length >= 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;

        const warnings = [];
        if (!hasMinLength) warnings.push('Password should be at least 8 characters');
        if (!hasUpperCase) warnings.push('Include uppercase letters');
        if (!hasLowerCase) warnings.push('Include lowercase letters');
        if (!hasNumbers) warnings.push('Include numbers');
        if (!hasSpecialChar) warnings.push('Include special characters');

        resolve({
          isValid,
          message: isValid ? 'Strong password' : 'Weak password',
          warnings: warnings.length > 0 ? warnings : undefined,
          strength: this.calculatePasswordStrength(password)
        });
      }, 100);
    });
  }

  async validateUsername(username) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
        const isAvailable = Math.random() > 0.1; // 90% availability

        resolve({
          isValid: isValid && isAvailable,
          message: isValid ? (isAvailable ? 'Username available' : 'Username taken') : 'Invalid username',
          ...(!isAvailable && { suggestion: 'Try a different username' })
        });
      }, 80);
    });
  }

  calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    return strength >= 5 ? 'strong' : strength >= 3 ? 'medium' : 'weak';
  }

  async batchValidateUsers(users) {
    try {
      const validationPromises = users.map((user, index) =>
        this.validateUserInput(user)
          .then(validationResult => ({
            userId: user.id || index,
            ...validationResult,
            originalData: user
          }))
          .catch(error => ({
            userId: user.id || index,
            isValid: false,
            error: error.message,
            originalData: user
          }))
      );

      const results = await Promise.all(validationPromises);

      const summary = {
        total: results.length,
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        errorCount: results.filter(r => r.error).length,
        warningCount: results.reduce((count, r) => count + (r.warnings ? r.warnings.length : 0), 0)
      };

      return {
        results,
        summary,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Batch validation error:', error);
      throw new Error('Failed to batch validate users');
    }
  }
}

// Usage
const validationService = new ValidationService();

// Single user validation
const userData = {
  email: 'test@example.com',
  phone: '+1-555-0123',
  password: 'StrongPass123!',
  username: 'john_doe'
};

validationService.validateUserInput(userData)
  .then(result => {
    console.log('Validation result:');
    console.log('Is valid:', result.isValid);
    console.log('Errors:', result.errors);
    console.log('Warnings:', result.warnings);
  })
  .catch(error => console.error('Validation error:', error.message));

// Batch validation
const users = [
  { id: 1, email: 'user1@example.com', phone: '1234567890', password: 'pass1', username: 'user1' },
  { id: 2, email: 'invalid-email', phone: '123', password: 'weak', username: 'u' },
  { id: 3, email: 'user3@example.com', phone: '0987654321', password: 'StrongPass123!', username: 'user3' }
];

validationService.batchValidateUsers(users)
  .then(({ results, summary }) => {
    console.log('Batch validation summary:', summary);
    console.log('Detailed results:', results);
  })
  .catch(error => console.error('Batch validation error:', error.message));

// ## 7. Monitoring & Metrics with Promise.all()

class SystemMonitor {
  constructor() {
    this.metrics = new Map();
    this.healthChecks = [
      { name: 'database', check: this.checkDatabase.bind(this) },
      { name: 'cache', check: this.checkCache.bind(this) },
      { name: 'external-api', check: this.checkExternalApi.bind(this) },
      { name: 'file-system', check: this.checkFileSystem.bind(this) },
      { name: 'memory-usage', check: this.checkMemoryUsage.bind(this) }
    ];
  }

  async getSystemStatus() {
    try {
      const healthCheckPromises = this.healthChecks.map(healthCheck =>
        healthCheck.check()
          .then(result => ({ ...result, name: healthCheck.name }))
          .catch(error => ({
            name: healthCheck.name,
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
          }))
      );

      const healthResults = await Promise.all(healthCheckPromises);

      const overallStatus = healthResults.every(result => result.status === 'healthy') 
        ? 'healthy' 
        : healthResults.some(result => result.status === 'error') 
          ? 'error' 
          : 'degraded';

      return {
        status: overallStatus,
        services: healthResults,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        metrics: this.getCurrentMetrics()
      };
    } catch (error) {
      console.error('System monitoring error:', error);
      return {
        status: 'error',
        message: 'Monitoring system failure',
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkDatabase() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isHealthy = Math.random() > 0.1; // 90% healthy
        resolve({
          status: isHealthy ? 'healthy' : 'degraded',
          message: isHealthy ? 'Database connection stable' : 'Database latency high',
          responseTime: Math.random() * 100 + 50,
          timestamp: new Date().toISOString()
        });
      }, 100);
    });
  }

  async checkCache() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isHealthy = Math.random() > 0.05; // 95% healthy
        resolve({
          status: isHealthy ? 'healthy' : 'error',
          message: isHealthy ? 'Cache responsive' : 'Cache connection failed',
          hitRate: Math.random() * 100,
          timestamp: new Date().toISOString()
        });
      }, 50);
    });
  }

  async checkExternalApi() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isHealthy = Math.random() > 0.2; // 80% healthy
        resolve({
          status: isHealthy ? 'healthy' : 'degraded',
          message: isHealthy ? 'External API available' : 'External API slow',
          responseTime: Math.random() * 500 + 100,
          timestamp: new Date().toISOString()
        });
      }, 200);
    });
  }

  async checkFileSystem() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const freeSpace = Math.random() * 100;
        const status = freeSpace > 10 ? 'healthy' : freeSpace > 5 ? 'degraded' : 'error';
        resolve({
          status,
          message: `Disk space: ${freeSpace.toFixed(1)}% free`,
          freeSpace,
          timestamp: new Date().toISOString()
        });
      }, 30);
    });
  }

  async checkMemoryUsage() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const memoryUsage = process.memoryUsage();
        const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const status = usagePercent < 80 ? 'healthy' : usagePercent < 90 ? 'degraded' : 'error';
        
        resolve({
          status,
          message: `Memory usage: ${usagePercent.toFixed(1)}%`,
          usagePercent,
          timestamp: new Date().toISOString()
        });
      }, 20);
    });
  }

  getCurrentMetrics() {
    return {
      activeConnections: Math.floor(Math.random() * 1000),
      requestRate: Math.floor(Math.random() * 100),
      errorRate: Math.random() * 5,
      responseTime: Math.random() * 200 + 50
    };
  }

  async collectPerformanceMetrics() {
    try {
      const metricPromises = [
        this.collectCpuMetrics(),
        this.collectMemoryMetrics(),
        this.collectNetworkMetrics(),
        this.collectDatabaseMetrics(),
        this.collectApplicationMetrics()
      ];

      const metrics = await Promise.all(metricPromises);

      const aggregatedMetrics = metrics.reduce((acc, metric) => ({
        ...acc,
        ...metric
      }), {});

      this.updateMetricsHistory(aggregatedMetrics);

      return {
        metrics: aggregatedMetrics,
        timestamp: new Date().toISOString(),
        collectionDuration: `${Date.now() - this.lastCollectionTime}ms`
      };
    } catch (error) {
      console.error('Metrics collection error:', error);
      throw new Error('Failed to collect performance metrics');
    }
  }

  async collectCpuMetrics() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          cpu: {
            usage: Math.random() * 100,
            load: [Math.random(), Math.random(), Math.random()]
          }
        });
      }, 50);
    });
  }

  async collectMemoryMetrics() {
    const memoryUsage = process.memoryUsage();
    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        usagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      }
    };
  }

  async collectNetworkMetrics() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          network: {
            activeConnections: Math.floor(Math.random() * 1000),
            bytesIn: Math.floor(Math.random() * 1000000),
            bytesOut: Math.floor(Math.random() * 500000)
          }
        });
      }, 30);
    });
  }

  async collectDatabaseMetrics() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          database: {
            connections: Math.floor(Math.random() * 100),
            queryRate: Math.floor(Math.random() * 500),
            slowQueries: Math.floor(Math.random() * 10)
          }
        });
      }, 70);
    });
  }

  async collectApplicationMetrics() {
    return {
      application: {
        uptime: process.uptime(),
        requests: Math.floor(Math.random() * 10000),
        errors: Math.floor(Math.random() * 50),
        responseTime: Math.random() * 200 + 50
      }
    };
  }

  updateMetricsHistory(metrics) {
    const timestamp = new Date().toISOString();
    this.metrics.set(timestamp, metrics);
    
    // Keep only last 1000 metrics
    if (this.metrics.size > 1000) {
      const firstKey = this.metrics.keys().next().value;
      this.metrics.delete(firstKey);
    }
  }
}

// Usage
const monitor = new SystemMonitor();

// Get system status
monitor.getSystemStatus()
  .then(status => {
    console.log('System Status:', status.status);
    console.log('Services:', status.services);
  })
  .catch(error => console.error('Monitoring error:', error));

// Collect performance metrics
monitor.collectPerformanceMetrics()
  .then(metrics => {
    console.log('Performance metrics:', metrics);
  })
  .catch(error => console.error('Metrics collection error:', error));

// These production-grade `Promise.all()` patterns demonstrate:

// 1. **Parallel database operations** for performance optimization
// 2. **API aggregation** to reduce latency
// 3. **Batch file processing** with proper error handling
// 4. **Cache warming** strategies for improved performance
// 5. **Concurrent validation** for user input
// 6. **System monitoring** with parallel health checks
// 7. **Proper error handling** with `Promise.allSettled()` where appropriate
// 8. **Resource management** with concurrency control
// 9. **Comprehensive logging** and monitoring
// 10. **Production-ready error recovery** and fallback mechanisms

// Each example includes proper error handling, logging, monitoring, and follows best practices for scalable backend development.































// Here are comprehensive code snippets for `Promise.race()` in JavaScript for Node.js production-grade backend development:

// ## 1. Request Timeout Patterns

class TimeoutService {
  constructor(defaultTimeout = 5000) {
    this.defaultTimeout = defaultTimeout;
  }

  // Basic timeout wrapper using Promise.race()
  async withTimeout(promise, timeoutMs = this.defaultTimeout) {
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Database query with timeout
  async executeQueryWithTimeout(query, params, timeoutMs = 3000) {
    const queryPromise = this.executeDatabaseQuery(query, params);
    return this.withTimeout(queryPromise, timeoutMs);
  }

  // API call with timeout
  async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const fetchPromise = fetch(url, options);
    return this.withTimeout(fetchPromise, timeoutMs);
  }

  // File operation with timeout
  async readFileWithTimeout(filePath, timeoutMs = 2000) {
    const fs = require('fs').promises;
    const readPromise = fs.readFile(filePath, 'utf8');
    return this.withTimeout(readPromise, timeoutMs);
  }

  // Simulated database query
  async executeDatabaseQuery(query, params) {
    return new Promise((resolve, reject) => {
      // Simulate database operation
      const delay = Math.random() * 5000; // 0-5 seconds
      setTimeout(() => {
        if (delay < 4000) { // 80% success rate
          resolve({ rows: [{ id: 1, data: 'result' }], queryTime: delay });
        } else {
          reject(new Error('Database query failed'));
        }
      }, delay);
    });
  }
}

// Usage examples
const timeoutService = new TimeoutService();

// Database query with timeout
timeoutService.executeQueryWithTimeout('SELECT * FROM users', [], 2000)
  .then(result => console.log('Query succeeded:', result))
  .catch(error => console.error('Query failed:', error.message));

// API call with timeout
timeoutService.fetchWithTimeout('https://api.example.com/data', {}, 5000)
  .then(response => response.json())
  .then(data => console.log('API data:', data))
  .catch(error => console.error('API call failed:', error.message));

// ## 2. Circuit Breaker with Promise.race()

class CircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 3,
      timeout: options.timeout || 10000,
      resetTimeout: options.resetTimeout || 30000,
      ...options
    };
  }

  async call(serviceFunction, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      // Use Promise.race to implement timeout
      const result = await Promise.race([
        serviceFunction(...args),
        this.createTimeoutPromise()
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Circuit breaker timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN' && this.successCount >= this.config.successThreshold) {
      this.state = 'CLOSED';
      this.successCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      isReady: this.state !== 'OPEN' || Date.now() >= this.nextAttempt
    };
  }
}

// Usage with external service
class ExternalApiService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      resetTimeout: 60000
    });
  }

  async callExternalApi(endpoint, data = {}) {
    const apiCall = async () => {
      // Simulate API call with random success/failure
      const delay = Math.random() * 7000; // 0-7 seconds
      const shouldFail = Math.random() < 0.3; // 30% failure rate

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (shouldFail) {
            reject(new Error(`API call to ${endpoint} failed`));
          } else {
            resolve({ data: { message: 'Success', endpoint }, delay });
          }
        }, delay);
      });
    };

    return this.circuitBreaker.call(apiCall, endpoint, data);
  }

  getCircuitStatus() {
    return this.circuitBreaker.getStatus();
  }
}

// Usage
const apiService = new ExternalApiService();

// Make multiple calls to see circuit breaker in action
async function testCircuitBreaker() {
  for (let i = 0; i < 10; i++) {
    try {
      const result = await apiService.callExternalApi(`/api/test/${i}`);
      console.log(`Call ${i}: Success`, result.data);
    } catch (error) {
      console.log(`Call ${i}: Failed -`, error.message);
    }
    
    console.log('Circuit Status:', apiService.getCircuitStatus());
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testCircuitBreaker();

// ## 3. Multi-Source Data Fetching with Race

class MultiSourceDataFetcher {
  constructor() {
    this.sources = {
      primary: 'https://primary-api.example.com/data',
      secondary: 'https://secondary-api.example.com/data',
      fallback: 'https://fallback-api.example.com/data',
      cache: null // In-memory cache
    };
  }

  async fetchDataWithRace(userId, options = {}) {
    const { timeout = 3000, useCache = true } = options;

    const fetchPromises = [];

    // 1. Cache source (fastest)
    if (useCache) {
      fetchPromises.push(
        this.fetchFromCache(userId)
          .then(data => ({ source: 'cache', data }))
      );
    }

    // 2. Primary API
    fetchPromises.push(
      this.fetchFromAPI(this.sources.primary, userId)
        .then(data => ({ source: 'primary', data }))
    );

    // 3. Secondary API
    fetchPromises.push(
      this.fetchFromAPI(this.sources.secondary, userId)
        .then(data => ({ source: 'secondary', data }))
    );

    // 4. Fallback API (slower but more reliable)
    fetchPromises.push(
      this.fetchFromAPI(this.sources.fallback, userId, 5000) // Longer timeout for fallback
        .then(data => ({ source: 'fallback', data }))
    );

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('All data sources timed out')), timeout);
    });

    try {
      // Race between all sources and timeout
      const result = await Promise.race([
        ...fetchPromises,
        timeoutPromise
      ]);

      console.log(`Data fetched from: ${result.source}`);
      
      // Cache the successful result
      if (result.source !== 'cache') {
        await this.cacheData(userId, result.data);
      }

      return result;
    } catch (error) {
      console.error('All data sources failed:', error.message);
      
      // Return stale cache data if available (even if expired)
      const staleData = await this.getStaleCache(userId);
      if (staleData) {
        return { source: 'stale-cache', data: staleData };
      }
      
      throw error;
    }
  }

  async fetchFromCache(userId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.sources.cache && Math.random() > 0.1) { // 90% cache hit rate
          resolve(this.sources.cache[userId]);
        } else {
          reject(new Error('Cache miss'));
        }
      }, 50); // Cache is very fast
    });
  }

  async fetchFromAPI(apiUrl, userId, delay = 1000) {
    return new Promise((resolve, reject) => {
      const actualDelay = delay + Math.random() * 2000; // Add random delay
      
      setTimeout(() => {
        const successRate = apiUrl.includes('primary') ? 0.8 : 
                           apiUrl.includes('secondary') ? 0.7 : 0.9;
        
        if (Math.random() < successRate) {
          resolve({
            userId,
            data: `Data from ${apiUrl}`,
            timestamp: new Date().toISOString(),
            responseTime: actualDelay
          });
        } else {
          reject(new Error(`API ${apiUrl} failed`));
        }
      }, actualDelay);
    });
  }

  async cacheData(userId, data) {
    if (!this.sources.cache) {
      this.sources.cache = {};
    }
    this.sources.cache[userId] = {
      ...data,
      cachedAt: new Date().toISOString()
    };
  }

  async getStaleCache(userId) {
    return this.sources.cache?.[userId];
  }
}

// Usage
const dataFetcher = new MultiSourceDataFetcher();

async function testMultiSourceFetch() {
  try {
    const result = await dataFetcher.fetchDataWithRace('user123', {
      timeout: 2000,
      useCache: true
    });
    
    console.log('Successful result:', result);
  } catch (error) {
    console.error('Failed to fetch data:', error.message);
  }
}

testMultiSourceFetch();

// ## 4. Load Balancer with Health Checks

class LoadBalancer {
  constructor(servers) {
    this.servers = servers.map(server => ({
      ...server,
      healthy: true,
      responseTime: 0,
      lastChecked: null,
      failureCount: 0
    }));
    
    this.healthCheckInterval = 30000; // 30 seconds
    this.startHealthChecks();
  }

  async request(endpoint, data, timeout = 5000) {
    const healthyServers = this.servers.filter(server => server.healthy);
    
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }

    // Create requests to all healthy servers
    const requestPromises = healthyServers.map(server =>
      this.makeRequestToServer(server, endpoint, data)
        .then(response => ({ server, response, source: 'live' }))
        .catch(error => ({ server, error, source: 'live' }))
    );

    // Add timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Load balancer request timeout')), timeout);
    });

    try {
      // Race between all server requests and timeout
      const result = await Promise.race([...requestPromises, timeoutPromise]);
      
      if (result.source === 'live' && result.response) {
        this.recordSuccess(result.server);
        return result.response;
      } else {
        this.recordFailure(result.server);
        // Retry with remaining servers
        return this.retryWithRemainingServers(result.server, endpoint, data, timeout);
      }
    } catch (error) {
      throw new Error(`Load balancing failed: ${error.message}`);
    }
  }

  async makeRequestToServer(server, endpoint, data) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const delay = server.responseTime + Math.random() * 1000;

      setTimeout(() => {
        const successRate = server.healthy ? 0.9 : 0.1;
        
        if (Math.random() < successRate) {
          resolve({
            data: `Response from ${server.url}${endpoint}`,
            server: server.url,
            responseTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          });
        } else {
          reject(new Error(`Request to ${server.url} failed`));
        }
      }, delay);
    });
  }

  async retryWithRemainingServers(failedServer, endpoint, data, timeout) {
    const remainingServers = this.servers.filter(server => 
      server.healthy && server.url !== failedServer.url
    );

    if (remainingServers.length === 0) {
      throw new Error('All servers failed');
    }

    const retryPromises = remainingServers.map(server =>
      this.makeRequestToServer(server, endpoint, data)
        .then(response => ({ server, response }))
    );

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Retry timeout')), timeout);
    });

    const result = await Promise.race([...retryPromises, timeoutPromise]);
    
    if (result.response) {
      this.recordSuccess(result.server);
      return result.response;
    } else {
      throw new Error('All retry attempts failed');
    }
  }

  recordSuccess(server) {
    server.failureCount = 0;
    server.healthy = true;
    server.lastChecked = new Date();
  }

  recordFailure(server) {
    server.failureCount++;
    if (server.failureCount >= 3) {
      server.healthy = false;
    }
    server.lastChecked = new Date();
  }

  startHealthChecks() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  async performHealthChecks() {
    const healthCheckPromises = this.servers.map(server =>
      this.checkServerHealth(server)
        .then(healthy => {
          server.healthy = healthy;
          server.lastChecked = new Date();
        })
        .catch(() => {
          server.healthy = false;
          server.lastChecked = new Date();
        })
    );

    await Promise.allSettled(healthCheckPromises);
    console.log('Health checks completed:', this.getStatus());
  }

  async checkServerHealth(server) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.2); // 80% health rate
      }, 1000);
    });
  }

  getStatus() {
    return this.servers.map(server => ({
      url: server.url,
      healthy: server.healthy,
      failureCount: server.failureCount,
      lastChecked: server.lastChecked
    }));
  }
}

// Usage
const loadBalancer = new LoadBalancer([
  { url: 'https://server1.example.com', weight: 1 },
  { url: 'https://server2.example.com', weight: 1 },
  { url: 'https://server3.example.com', weight: 1 }
]);

// Make requests through load balancer
async function testLoadBalancer() {
  for (let i = 0; i < 5; i++) {
    try {
      const response = await loadBalancer.request('/api/data', { requestId: i });
      console.log(`Request ${i}:`, response);
    } catch (error) {
      console.error(`Request ${i} failed:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testLoadBalancer();

// ## 5. Real-time Bid System

class RealTimeBidSystem {
  constructor() {
    this.bidders = [
      { name: 'Bidder-A', endpoint: 'https://bidder-a.com/bid', timeout: 100 },
      { name: 'Bidder-B', endpoint: 'https://bidder-b.com/bid', timeout: 150 },
      { name: 'Bidder-C', endpoint: 'https://bidder-c.com/bid', timeout: 200 },
      { name: 'Bidder-D', endpoint: 'https://bidder-d.com/bid', timeout: 120 }
    ];
    this.globalTimeout = 250; // Maximum time to wait for any bid
  }

  async conductAuction(adRequest) {
    const bidPromises = this.bidders.map(bidder =>
      this.requestBid(bidder, adRequest)
        .then(bid => ({ bidder: bidder.name, bid, status: 'success' }))
        .catch(error => ({ bidder: bidder.name, error: error.message, status: 'failed' }))
    );

    // Add global timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ status: 'timeout', message: 'Auction timeout' }), this.globalTimeout);
    });

    const results = [];
    let remainingPromises = [...bidPromises];

    // Collect bids as they come in, but stop after global timeout
    while (remainingPromises.length > 0) {
      try {
        const result = await Promise.race([...remainingPromises, timeoutPromise]);
        
        if (result.status === 'timeout') {
          console.log('Auction timeout reached');
          break;
        }

        results.push(result);
        remainingPromises = remainingPromises.filter(p => p !== result.source);
        
        // If we have enough bids, we can break early
        if (this.hasEnoughBids(results)) {
          console.log('Enough bids received, ending auction early');
          break;
        }
      } catch (error) {
        console.error('Error in auction race:', error);
      }
    }

    return this.processAuctionResults(results, adRequest);
  }

  async requestBid(bidder, adRequest) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const processingTime = Math.random() * bidder.timeout;

      setTimeout(() => {
        const bidValue = Math.random() * 10; // Random bid value 0-10
        const responseTime = Date.now() - startTime;

        if (Math.random() > 0.2) { // 80% response rate
          resolve({
            value: bidValue,
            currency: 'USD',
            bidder: bidder.name,
            responseTime,
            ad: `Ad from ${bidder.name}`,
            processingTime
          });
        } else {
          reject(new Error(`Bidder ${bidder.name} no-bid`));
        }
      }, processingTime);
    });
  }

  hasEnoughBids(results) {
    const successfulBids = results.filter(r => r.status === 'success');
    return successfulBids.length >= 2; // At least 2 successful bids
  }

  processAuctionResults(results, adRequest) {
    const successfulBids = results
      .filter(r => r.status === 'success')
      .map(r => r.bid)
      .sort((a, b) => b.value - a.value); // Sort by bid value descending

    const failedBidders = results
      .filter(r => r.status === 'failed')
      .map(r => r.bidder);

    const winner = successfulBids[0];
    const secondPrice = successfulBids[1] ? successfulBids[1].value : 0;

    return {
      auctionId: `auction-${Date.now()}`,
      timestamp: new Date().toISOString(),
      winner: winner ? {
        bidder: winner.bidder,
        bidValue: winner.value,
        winningPrice: secondPrice, // Second price auction
        ad: winner.ad
      } : null,
      allBids: successfulBids,
      failedBidders,
      totalBidders: this.bidders.length,
      successfulBidders: successfulBids.length,
      auctionDuration: this.globalTimeout
    };
  }

  async runMultipleAuctions(count = 10) {
    const auctionResults = [];

    for (let i = 0; i < count; i++) {
      const adRequest = {
        adUnit: 'banner-728x90',
        user: `user-${i}`,
        page: `https://example.com/page-${i}`
      };

      try {
        const result = await this.conductAuction(adRequest);
        auctionResults.push(result);
        console.log(`Auction ${i + 1}: Winner - ${result.winner?.bidder || 'None'}`);
      } catch (error) {
        console.error(`Auction ${i + 1} failed:`, error.message);
      }

      // Small delay between auctions
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.analyzeAuctionPerformance(auctionResults);
  }

  analyzeAuctionPerformance(auctionResults) {
    const successfulAuctions = auctionResults.filter(r => r.winner);
    const totalRevenue = successfulAuctions.reduce((sum, auction) => 
      sum + auction.winner.winningPrice, 0
    );

    return {
      totalAuctions: auctionResults.length,
      successfulAuctions: successfulAuctions.length,
      failureRate: (auctionResults.length - successfulAuctions.length) / auctionResults.length,
      totalRevenue,
      averageRevenue: totalRevenue / successfulAuctions.length || 0,
      bidderPerformance: this.calculateBidderPerformance(auctionResults)
    };
  }

  calculateBidderPerformance(auctionResults) {
    const performance = {};
    
    this.bidders.forEach(bidder => {
      performance[bidder.name] = {
        wins: 0,
        totalBids: 0,
        totalValue: 0
      };
    });

    auctionResults.forEach(auction => {
      auction.allBids.forEach(bid => {
        performance[bid.bidder].totalBids++;
        performance[bid.bidder].totalValue += bid.value;
      });

      if (auction.winner) {
        performance[auction.winner.bidder].wins++;
      }
    });

    return performance;
  }
}

// Usage
const bidSystem = new RealTimeBidSystem();

// Run multiple auctions
bidSystem.runMultipleAuctions(5)
  .then(analysis => {
    console.log('Auction Analysis:', analysis);
  })
  .catch(error => {
    console.error('Auction system error:', error);
  });

// ## 6. Service Dependency Checking

class ServiceDependencyManager {
  constructor() {
    this.dependencies = new Map();
    this.healthCheckTimeout = 3000;
  }

  registerService(name, healthCheckFn, options = {}) {
    this.dependencies.set(name, {
      healthCheckFn,
      critical: options.critical !== false, // Default to critical
      timeout: options.timeout || this.healthCheckTimeout,
      lastStatus: 'unknown',
      lastChecked: null,
      retryCount: 0
    });
  }

  async checkDependencies() {
    const criticalServices = Array.from(this.dependencies.entries())
      .filter(([_, config]) => config.critical)
      .map(([name, config]) => this.checkServiceWithTimeout(name, config));

    const nonCriticalServices = Array.from(this.dependencies.entries())
      .filter(([_, config]) => !config.critical)
      .map(([name, config]) => this.checkServiceWithTimeout(name, config));

    // Use Promise.race to implement overall timeout for critical services
    const criticalCheckPromise = Promise.allSettled(criticalServices);
    const criticalTimeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), 5000);
    });

    const criticalResults = await Promise.race([criticalCheckPromise, criticalTimeoutPromise]);

    // Check non-critical services without blocking
    const nonCriticalResults = await Promise.allSettled(nonCriticalServices);

    return this.analyzeDependencyStatus(criticalResults, nonCriticalResults);
  }

  async checkServiceWithTimeout(serviceName, config) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout for ${serviceName}`)), config.timeout);
    });

    const healthCheckPromise = config.healthCheckFn()
      .then(() => ({ serviceName, status: 'healthy' }))
      .catch(error => ({ serviceName, status: 'unhealthy', error: error.message }));

    try {
      const result = await Promise.race([healthCheckPromise, timeoutPromise]);
      this.updateServiceStatus(serviceName, result.status);
      return result;
    } catch (error) {
      const result = { serviceName, status: 'unhealthy', error: error.message };
      this.updateServiceStatus(serviceName, result.status);
      return result;
    }
  }

  updateServiceStatus(serviceName, status) {
    const service = this.dependencies.get(serviceName);
    if (service) {
      service.lastStatus = status;
      service.lastChecked = new Date();
      
      if (status === 'unhealthy') {
        service.retryCount++;
      } else {
        service.retryCount = 0;
      }
    }
  }

  analyzeDependencyStatus(criticalResults, nonCriticalResults) {
    if (criticalResults === 'timeout') {
      return {
        status: 'degraded',
        message: 'Critical dependency check timeout',
        critical: { status: 'timeout', services: [] },
        nonCritical: this.processResults(nonCriticalResults),
        timestamp: new Date().toISOString()
      };
    }

    const criticalServices = this.processResults(criticalResults);
    const nonCriticalServices = this.processResults(nonCriticalResults);

    const allCriticalHealthy = criticalServices.every(service => service.status === 'healthy');
    const criticalUnhealthy = criticalServices.filter(service => service.status === 'unhealthy');

    const status = allCriticalHealthy ? 'healthy' : 
                  criticalUnhealthy.length === criticalServices.length ? 'unhealthy' : 'degraded';

    return {
      status,
      critical: {
        status: allCriticalHealthy ? 'healthy' : 'degraded',
        services: criticalServices
      },
      nonCritical: {
        status: nonCriticalServices.every(s => s.status === 'healthy') ? 'healthy' : 'degraded',
        services: nonCriticalServices
      },
      timestamp: new Date().toISOString(),
      summary: {
        totalServices: criticalServices.length + nonCriticalServices.length,
        healthyServices: criticalServices.filter(s => s.status === 'healthy').length + 
                         nonCriticalServices.filter(s => s.status === 'healthy').length,
        unhealthyServices: criticalServices.filter(s => s.status === 'unhealthy').length + 
                           nonCriticalServices.filter(s => s.status === 'unhealthy').length
      }
    };
  }

  processResults(results) {
    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { serviceName: 'unknown', status: 'unhealthy', error: 'Check failed' };
      }
    });
  }

  async waitForHealthyDependencies(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.checkDependencies();
      
      if (status.status === 'healthy') {
        return status;
      }
      
      if (status.status === 'unhealthy') {
        throw new Error('Critical dependencies are unhealthy');
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Timeout waiting for healthy dependencies');
  }

  getServiceStatus(serviceName) {
    const service = this.dependencies.get(serviceName);
    return service ? {
      name: serviceName,
      status: service.lastStatus,
      lastChecked: service.lastChecked,
      retryCount: service.retryCount,
      critical: service.critical
    } : null;
  }
}

// Usage
const dependencyManager = new ServiceDependencyManager();

// Register services with health checks
dependencyManager.registerService('database', async () => {
  // Simulate database health check
  await new Promise(resolve => setTimeout(resolve, 500));
  if (Math.random() > 0.1) throw new Error('Database connection failed');
  return true;
}, { critical: true, timeout: 2000 });

dependencyManager.registerService('cache', async () => {
  // Simulate cache health check
  await new Promise(resolve => setTimeout(resolve, 300));
  if (Math.random() > 0.15) throw new Error('Cache unreachable');
  return true;
}, { critical: true, timeout: 1500 });

dependencyManager.registerService('email-service', async () => {
  // Simulate email service health check
  await new Promise(resolve => setTimeout(resolve, 800));
  if (Math.random() > 0.2) throw new Error('Email service down');
  return true;
}, { critical: false, timeout: 3000 });

dependencyManager.registerService('analytics', async () => {
  // Simulate analytics service health check
  await new Promise(resolve => setTimeout(resolve, 200));
  return true; // Always healthy for demo
}, { critical: false, timeout: 1000 });

// Check dependencies
async function monitorDependencies() {
  try {
    const status = await dependencyManager.checkDependencies();
    console.log('Dependency Status:', status);
    
    // Wait for healthy state before starting application
    if (status.status !== 'healthy') {
      console.log('Waiting for healthy dependencies...');
      const healthyStatus = await dependencyManager.waitForHealthyDependencies(10000);
      console.log('Dependencies healthy:', healthyStatus);
    }
  } catch (error) {
    console.error('Dependency check failed:', error.message);
  }
}

monitorDependencies();

// Periodic monitoring
setInterval(monitorDependencies, 30000);

// ## 7. Priority Task Execution

class PriorityTaskQueue {
  constructor() {
    this.tasks = [];
    this.isProcessing = false;
    this.highPriorityTimeout = 100;
    this.normalPriorityTimeout = 1000;
  }

  addTask(task, priority = 'normal') {
    const taskObj = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      task,
      priority,
      createdAt: new Date(),
      status: 'pending'
    };

    if (priority === 'high') {
      this.tasks.unshift(taskObj); // Add to beginning for high priority
    } else {
      this.tasks.push(taskObj); // Add to end for normal priority
    }

    if (!this.isProcessing) {
      this.processQueue();
    }

    return taskObj.id;
  }

  async processQueue() {
    if (this.isProcessing || this.tasks.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.tasks.length > 0) {
      const currentTask = this.tasks[0];
      currentTask.status = 'processing';
      currentTask.startedAt = new Date();

      try {
        // Use Promise.race to implement priority-based timeout
        const timeout = currentTask.priority === 'high' ? 
          this.highPriorityTimeout : this.normalPriorityTimeout;

        const result = await this.executeTaskWithPriority(currentTask, timeout);
        
        currentTask.status = 'completed';
        currentTask.completedAt = new Date();
        currentTask.result = result;

        console.log(`Task ${currentTask.id} completed in ${currentTask.completedAt - currentTask.startedAt}ms`);
      } catch (error) {
        currentTask.status = 'failed';
        currentTask.error = error.message;
        currentTask.completedAt = new Date();

        console.error(`Task ${currentTask.id} failed:`, error.message);
      }

      // Remove completed task
      this.tasks.shift();

      // Brief pause between tasks
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  async executeTaskWithPriority(task, timeout) {
    const taskPromise = task.task();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout);
    });

    return Promise.race([taskPromise, timeoutPromise]);
  }

  getQueueStatus() {
    return {
      totalTasks: this.tasks.length,
      highPriority: this.tasks.filter(t => t.priority === 'high').length,
      normalPriority: this.tasks.filter(t => t.priority === 'normal').length,
      isProcessing: this.isProcessing,
      tasks: this.tasks.map(t => ({
        id: t.id,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt
      }))
    };
  }
}

// Usage
const taskQueue = new PriorityTaskQueue();

// Add some tasks with different priorities
for (let i = 0; i < 5; i++) {
  taskQueue.addTask(async () => {
    const delay = Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return `Normal task ${i} completed after ${delay}ms`;
  }, 'normal');
}

// Add high priority tasks
for (let i = 0; i < 3; i++) {
  taskQueue.addTask(async () => {
    const delay = Math.random() * 500;
    await new Promise(resolve => setTimeout(resolve, delay));
    return `HIGH PRIORITY task ${i} completed after ${delay}ms`;
  }, 'high');
}

// Monitor queue status
setInterval(() => {
  const status = taskQueue.getQueueStatus();
  console.log('Queue Status:', status);
}, 1000);

// These production-grade `Promise.race()` patterns demonstrate:

// 1. **Request timeouts** for preventing hanging operations
// 2. **Circuit breakers** for fault tolerance
// 3. **Multi-source data fetching** for redundancy and performance
// 4. **Load balancing** with health checks
// 5. **Real-time bidding systems** for ad tech
// 6. **Service dependency management** for microservices
// 7. **Priority task execution** for resource management

// Each implementation includes proper error handling, logging, monitoring, and follows production best practices for reliability and performance.




























// Here are comprehensive code snippets for `Promise.any()` in JavaScript for Node.js production-grade backend development:

// ## 1. Multi-Source Data Fetching with Fallback

class MultiSourceDataService {
  constructor() {
    this.sources = {
      primary: 'https://primary-db.example.com',
      replica1: 'https://replica1-db.example.com',
      replica2: 'https://replica2-db.example.com',
      cache: 'redis://cache-cluster.example.com',
      fallback: 'https://fallback-db.example.com'
    };
    this.requestTimeout = 3000;
  }

  async fetchUserData(userId) {
    const dataPromises = [
      this.fetchFromPrimaryDB(userId),
      this.fetchFromReplica1(userId),
      this.fetchFromReplica2(userId),
      this.fetchFromCache(userId),
      this.fetchFromFallback(userId)
    ];

    try {
      // First successful response wins
      const result = await Promise.any(dataPromises);
      
      console.log(`Data fetched from: ${result.source}`);
      this.metrics.recordSuccess(result.source);
      
      return {
        data: result.data,
        source: result.source,
        latency: result.latency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // All promises rejected - handle complete failure
      console.error('All data sources failed:', error.errors);
      this.metrics.recordCompleteFailure();
      
      throw new Error('All data sources unavailable. Service degraded.');
    }
  }

  async fetchFromPrimaryDB(userId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 2000;

      setTimeout(() => {
        if (Math.random() > 0.3) { // 70% success rate
          resolve({
            source: 'primary-db',
            data: { userId, name: 'John Doe', from: 'primary' },
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error('Primary DB unavailable'));
        }
      }, latency);
    });
  }

  async fetchFromReplica1(userId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 1500;

      setTimeout(() => {
        if (Math.random() > 0.2) { // 80% success rate
          resolve({
            source: 'replica-1',
            data: { userId, name: 'John Doe', from: 'replica1' },
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error('Replica 1 unavailable'));
        }
      }, latency);
    });
  }

  async fetchFromReplica2(userId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 1800;

      setTimeout(() => {
        if (Math.random() > 0.25) { // 75% success rate
          resolve({
            source: 'replica-2',
            data: { userId, name: 'John Doe', from: 'replica2' },
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error('Replica 2 unavailable'));
        }
      }, latency);
    });
  }

  async fetchFromCache(userId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 100; // Cache is fast

      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({
            source: 'cache',
            data: { userId, name: 'John Doe', from: 'cache', cached: true },
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error('Cache miss'));
        }
      }, latency);
    });
  }

  async fetchFromFallback(userId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 3000; // Fallback is slower

      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          resolve({
            source: 'fallback',
            data: { userId, name: 'John Doe', from: 'fallback', stale: true },
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error('Fallback service down'));
        }
      }, latency);
    });
  }

  metrics = {
    successes: new Map(),
    failures: new Map(),
    
    recordSuccess(source) {
      const count = this.successes.get(source) || 0;
      this.successes.set(source, count + 1);
    },
    
    recordCompleteFailure() {
      const count = this.failures.get('complete') || 0;
      this.failures.set('complete', count + 1);
    },
    
    getStats() {
      return {
        successes: Object.fromEntries(this.successes),
        failures: Object.fromEntries(this.failures),
        totalRequests: [...this.successes.values()].reduce((a, b) => a + b, 0) +
                      [...this.failures.values()].reduce((a, b) => a + b, 0)
      };
    }
  };
}

// Usage
const dataService = new MultiSourceDataService();

async function testMultiSourceFetch() {
  try {
    const result = await dataService.fetchUserData('user-123');
    console.log('Success:', result);
  } catch (error) {
    console.error('Complete failure:', error.message);
  }
}

// Test multiple requests to see different sources winning
for (let i = 0; i < 10; i++) {
  setTimeout(() => testMultiSourceFetch(), i * 500);
}

// Print metrics after some time
setTimeout(() => {
  console.log('Metrics:', dataService.metrics.getStats());
}, 6000);

// ## 2. Geographic Redundancy with CDN Fallback

class GeographicCDNService {
  constructor() {
    this.regions = [
      { name: 'us-east', url: 'https://cdn-us-east.example.com', weight: 1.0 },
      { name: 'eu-west', url: 'https://cdn-eu-west.example.com', weight: 0.9 },
      { name: 'ap-south', url: 'https://cdn-ap-south.example.com', weight: 0.8 },
      { name: 'sa-east', url: 'https://cdn-sa-east.example.com', weight: 0.7 }
    ];
    
    this.fallbackServers = [
      'https://fallback1.example.com',
      'https://fallback2.example.com',
      'https://fallback3.example.com'
    ];
  }

  async fetchAsset(assetPath, options = {}) {
    const { timeout = 5000, preferRegion = 'auto' } = options;
    
    // Try CDN regions first
    const cdnPromises = this.regions.map(region => 
      this.fetchFromCDN(region.url, assetPath, timeout)
        .then(data => ({ ...data, source: 'cdn', region: region.name }))
    );

    // Add fallback servers
    const fallbackPromises = this.fallbackServers.map((server, index) =>
      this.fetchFromFallback(server, assetPath, timeout)
        .then(data => ({ ...data, source: 'fallback', server: `fallback-${index + 1}` }))
    );

    const allPromises = [...cdnPromises, ...fallbackPromises];

    try {
      const result = await Promise.any(allPromises);
      
      this.recordMetrics(result.source, result.region, true);
      console.log(`Asset fetched from: ${result.source}${result.region ? ` (${result.region})` : ''}`);
      
      return {
        success: true,
        data: result.data,
        source: result.source,
        region: result.region,
        latency: result.latency,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.recordMetrics('all', 'all', false);
      
      console.error('All CDN and fallback servers failed:', error.errors);
      throw new Error('CDN service completely unavailable');
    }
  }

  async fetchFromCDN(cdnUrl, assetPath, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 1000 + 100; // 100-1100ms

      setTimeout(() => {
        const successRate = 0.85; // 85% success rate for CDN
        if (Math.random() < successRate) {
          resolve({
            data: `Asset content from ${cdnUrl}${assetPath}`,
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error(`CDN ${cdnUrl} failed`));
        }
      }, latency);
    });
  }

  async fetchFromFallback(server, assetPath, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const latency = Math.random() * 2000 + 500; // 500-2500ms

      setTimeout(() => {
        const successRate = 0.95; // Fallbacks are more reliable but slower
        if (Math.random() < successRate) {
          resolve({
            data: `Asset content from fallback ${server}${assetPath}`,
            latency: Date.now() - startTime
          });
        } else {
          reject(new Error(`Fallback ${server} failed`));
        }
      }, latency);
    });
  }

  async batchFetchAssets(assetPaths, options = {}) {
    const fetchPromises = assetPaths.map(assetPath =>
      this.fetchAsset(assetPath, options)
        .then(result => ({ assetPath, ...result }))
        .catch(error => ({ 
          assetPath, 
          success: false, 
          error: error.message 
        }))
    );

    const results = await Promise.allSettled(fetchPromises);
    
    const successful = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value);
    
    const failed = results
      .filter(r => r.status === 'fulfilled' && !r.value.success)
      .map(r => r.value);

    return {
      total: assetPaths.length,
      successful: successful.length,
      failed: failed.length,
      assets: successful,
      failures: failed,
      successRate: successful.length / assetPaths.length
    };
  }

  recordMetrics(source, region, success) {
    // In production, this would send to your metrics system
    console.log(`Metrics: ${source} ${region} ${success ? 'SUCCESS' : 'FAILURE'}`);
  }
}

// Usage
const cdnService = new GeographicCDNService();

// Fetch single asset
cdnService.fetchAsset('/images/hero.jpg', { timeout: 3000 })
  .then(result => console.log('Asset fetched:', result))
  .catch(error => console.error('Failed to fetch asset:', error.message));

// Batch fetch multiple assets
const assets = [
  '/css/main.css',
  '/js/app.js',
  '/images/logo.png',
  '/images/banner.jpg'
];

cdnService.batchFetchAssets(assets, { timeout: 5000 })
  .then(batchResult => {
    console.log('Batch fetch completed:');
    console.log(`Success: ${batchResult.successful}/${batchResult.total}`);
    console.log('Failed assets:', batchResult.failures);
  });

// ## 3. Payment Gateway Redundancy

class PaymentGatewayOrchestrator {
  constructor() {
    this.gateways = [
      {
        name: 'stripe',
        processor: this.processStripePayment.bind(this),
        priority: 1,
        enabled: true,
        timeout: 8000
      },
      {
        name: 'paypal',
        processor: this.processPayPalPayment.bind(this),
        priority: 2,
        enabled: true,
        timeout: 10000
      },
      {
        name: 'adyen',
        processor: this.processAdyenPayment.bind(this),
        priority: 3,
        enabled: true,
        timeout: 7000
      },
      {
        name: 'braintree',
        processor: this.processBraintreePayment.bind(this),
        priority: 4,
        enabled: true,
        timeout: 9000
      }
    ];

    this.circuitBreakers = new Map();
    this.setupCircuitBreakers();
  }

  setupCircuitBreakers() {
    this.gateways.forEach(gateway => {
      this.circuitBreakers.set(gateway.name, {
        failures: 0,
        successes: 0,
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        lastFailure: null,
        nextRetry: null
      });
    });
  }

  async processPayment(paymentRequest) {
    const { amount, currency, paymentMethod, customer } = paymentRequest;
    
    console.log(`Processing payment: ${amount} ${currency}`);

    // Get enabled gateways that aren't in open circuit breaker state
    const availableGateways = this.gateways.filter(gateway => {
      const circuit = this.circuitBreakers.get(gateway.name);
      return gateway.enabled && circuit.state !== 'OPEN';
    });

    if (availableGateways.length === 0) {
      throw new Error('No payment gateways available');
    }

    // Create payment promises for all available gateways
    const paymentPromises = availableGateways.map(gateway =>
      this.processWithGateway(gateway, paymentRequest)
        .then(result => ({ ...result, gateway: gateway.name, success: true }))
        .catch(error => ({ 
          gateway: gateway.name, 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        }))
    );

    try {
      // Wait for first successful payment
      const successfulResult = await Promise.any(
        paymentPromises.filter(p => p.then && p.catch) // Filter to only promises
      );

      this.recordGatewaySuccess(successfulResult.gateway);
      console.log(`Payment processed successfully via ${successfulResult.gateway}`);

      return {
        success: true,
        transactionId: successfulResult.transactionId,
        gateway: successfulResult.gateway,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        timestamp: new Date().toISOString(),
        metadata: successfulResult.metadata
      };
    } catch (error) {
      // All gateways failed
      this.recordCompleteFailure();
      
      const errors = error.errors || [];
      console.error('All payment gateways failed:', errors);

      throw new Error(`Payment processing failed. All gateways unavailable.`);
    }
  }

  async processWithGateway(gateway, paymentRequest) {
    const circuit = this.circuitBreakers.get(gateway.name);
    
    if (circuit.state === 'OPEN' && Date.now() < circuit.nextRetry) {
      throw new Error(`Gateway ${gateway.name} circuit breaker open`);
    }

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Gateway ${gateway.name} timeout`)), gateway.timeout);
    });

    // Process payment with timeout
    const paymentPromise = gateway.processor(paymentRequest);

    try {
      const result = await Promise.race([paymentPromise, timeoutPromise]);
      
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.recordGatewayFailure(gateway.name);
      throw error;
    }
  }

  async processStripePayment(paymentRequest) {
    return new Promise((resolve, reject) => {
      const processingTime = Math.random() * 5000;
      
      setTimeout(() => {
        if (Math.random() > 0.15) { // 85% success rate
          resolve({
            transactionId: `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              processor: 'stripe',
              riskScore: Math.floor(Math.random() * 100),
              avsCheck: 'pass'
            }
          });
        } else {
          reject(new Error('Stripe payment failed: Insufficient funds'));
        }
      }, processingTime);
    });
  }

  async processPayPalPayment(paymentRequest) {
    return new Promise((resolve, reject) => {
      const processingTime = Math.random() * 6000;
      
      setTimeout(() => {
        if (Math.random() > 0.2) { // 80% success rate
          resolve({
            transactionId: `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              processor: 'paypal',
              payerId: `P${Math.random().toString(36).substr(2, 8)}`,
              protectionEligibility: 'ELIGIBLE'
            }
          });
        } else {
          reject(new Error('PayPal payment failed: Buyer protection triggered'));
        }
      }, processingTime);
    });
  }

  async processAdyenPayment(paymentRequest) {
    return new Promise((resolve, reject) => {
      const processingTime = Math.random() * 4000;
      
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({
            transactionId: `adyen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              processor: 'adyen',
              pspReference: `PSP${Date.now()}`,
              authCode: `AUTH${Math.floor(Math.random() * 10000)}`
            }
          });
        } else {
          reject(new Error('Adyen payment failed: 3DS authentication failed'));
        }
      }, processingTime);
    });
  }

  async processBraintreePayment(paymentRequest) {
    return new Promise((resolve, reject) => {
      const processingTime = Math.random() * 5500;
      
      setTimeout(() => {
        if (Math.random() > 0.25) { // 75% success rate
          resolve({
            transactionId: `braintree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              processor: 'braintree',
              merchantAccountId: `merchant_${Math.random().toString(36).substr(2, 6)}`,
              cvvCheck: 'match'
            }
          });
        } else {
          reject(new Error('Braintree payment failed: CVV mismatch'));
        }
      }, processingTime);
    });
  }

  recordGatewaySuccess(gatewayName) {
    const circuit = this.circuitBreakers.get(gatewayName);
    circuit.successes++;
    circuit.failures = 0;
    circuit.state = 'CLOSED';
  }

  recordGatewayFailure(gatewayName) {
    const circuit = this.circuitBreakers.get(gatewayName);
    circuit.failures++;
    circuit.lastFailure = new Date();
    
    if (circuit.failures >= 3) {
      circuit.state = 'OPEN';
      circuit.nextRetry = Date.now() + 60000; // Retry after 1 minute
    } else if (circuit.failures >= 1 && circuit.state === 'CLOSED') {
      circuit.state = 'HALF_OPEN';
    }
  }

  recordCompleteFailure() {
    console.error('CRITICAL: All payment gateways failed simultaneously');
    // Alert operations team, log to critical monitoring system
  }

  getGatewayStatus() {
    return this.gateways.map(gateway => {
      const circuit = this.circuitBreakers.get(gateway.name);
      return {
        gateway: gateway.name,
        enabled: gateway.enabled,
        circuitState: circuit.state,
        failures: circuit.failures,
        successes: circuit.successes,
        lastFailure: circuit.lastFailure,
        nextRetry: circuit.nextRetry
      };
    });
  }
}

// Usage
const paymentOrchestrator = new PaymentGatewayOrchestrator();

// Process multiple payments to see different gateways being used
async function processSamplePayments() {
  const payments = [
    { amount: 2999, currency: 'USD', paymentMethod: 'card', customer: 'cust_123' },
    { amount: 4500, currency: 'EUR', paymentMethod: 'paypal', customer: 'cust_456' },
    { amount: 1500, currency: 'GBP', paymentMethod: 'card', customer: 'cust_789' }
  ];

  for (const payment of payments) {
    try {
      const result = await paymentOrchestrator.processPayment(payment);
      console.log(`Payment successful:`, result);
    } catch (error) {
      console.error(`Payment failed:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('Gateway status:', paymentOrchestrator.getGatewayStatus());
}

processSamplePayments();

// ## 4. Configuration Service with Multiple Sources

class ConfigurationService {
  constructor() {
    this.configSources = [
      {
        name: 'aws-parameter-store',
        loader: this.loadFromAWSParameterStore.bind(this),
        refreshInterval: 300000, // 5 minutes
        priority: 1
      },
      {
        name: 'azure-app-config',
        loader: this.loadFromAzureAppConfig.bind(this),
        refreshInterval: 300000,
        priority: 2
      },
      {
        name: 'google-secret-manager',
        loader: this.loadFromGoogleSecretManager.bind(this),
        refreshInterval: 300000,
        priority: 3
      },
      {
        name: 'local-cache',
        loader: this.loadFromLocalCache.bind(this),
        refreshInterval: 60000, // 1 minute
        priority: 4
      },
      {
        name: 'defaults',
        loader: this.loadDefaults.bind(this),
        refreshInterval: 0, // Never refresh
        priority: 5
      }
    ];

    this.currentConfig = new Map();
    this.configCache = new Map();
    this.setupConfigRefresh();
  }

  async getConfig(configKey, options = {}) {
    const { forceRefresh = false, timeout = 5000 } = options;

    // Check if we have a cached value that's not expired
    if (!forceRefresh && this.configCache.has(configKey)) {
      const cached = this.configCache.get(configKey);
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.value;
      }
    }

    // Try to load from all sources, first successful wins
    const configPromises = this.configSources.map(source =>
      this.loadFromSource(source, configKey, timeout)
        .then(value => ({
          source: source.name,
          value,
          timestamp: new Date().toISOString()
        }))
        .catch(error => ({
          source: source.name,
          error: error.message,
          timestamp: new Date().toISOString()
        }))
    );

    try {
      const result = await Promise.any(configPromises);
      
      // Cache the successful result
      this.configCache.set(configKey, {
        value: result.value,
        timestamp: Date.now(),
        ttl: 60000, // 1 minute TTL
        source: result.source
      });

      this.currentConfig.set(configKey, result.value);
      
      console.log(`Config "${configKey}" loaded from: ${result.source}`);
      return result.value;
    } catch (error) {
      console.error(`All config sources failed for "${configKey}":`, error.errors);
      
      // Return default value if available
      const defaultValue = this.getDefaultValue(configKey);
      if (defaultValue !== undefined) {
        console.log(`Using default value for "${configKey}"`);
        return defaultValue;
      }
      
      throw new Error(`Configuration key "${configKey}" not found in any source`);
    }
  }

  async loadFromSource(source, configKey, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Config source ${source.name} timeout`)), timeout);
    });

    const configPromise = source.loader(configKey);

    return Promise.race([configPromise, timeoutPromise]);
  }

  async loadFromAWSParameterStore(configKey) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.2) { // 80% success rate
          resolve(`aws-value-for-${configKey}-${Date.now()}`);
        } else {
          reject(new Error('AWS Parameter Store unavailable'));
        }
      }, Math.random() * 1000);
    });
  }

  async loadFromAzureAppConfig(configKey) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.25) { // 75% success rate
          resolve(`azure-value-for-${configKey}-${Date.now()}`);
        } else {
          reject(new Error('Azure App Config unavailable'));
        }
      }, Math.random() * 1200);
    });
  }

  async loadFromGoogleSecretManager(configKey) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.15) { // 85% success rate
          resolve(`google-value-for-${configKey}-${Date.now()}`);
        } else {
          reject(new Error('Google Secret Manager unavailable'));
        }
      }, Math.random() * 800);
    });
  }

  async loadFromLocalCache(configKey) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Local cache has older data but is more reliable
        if (Math.random() > 0.05) { // 95% success rate
          resolve(`local-cache-value-for-${configKey}`);
        } else {
          reject(new Error('Local cache corrupted'));
        }
      }, 50); // Very fast
    });
  }

  async loadDefaults(configKey) {
    const defaults = {
      'database.host': 'localhost',
      'database.port': '5432',
      'cache.ttl': '3600',
      'feature.flags': '{}',
      'api.timeout': '30000'
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(defaults[configKey]);
      }, 10);
    });
  }

  getDefaultValue(configKey) {
    const defaults = {
      'database.host': 'localhost',
      'database.port': '5432',
      'cache.ttl': '3600',
      'api.timeout': '30000'
    };
    return defaults[configKey];
  }

  setupConfigRefresh() {
    // Refresh all config values periodically
    setInterval(() => {
      this.refreshAllConfigs();
    }, 60000); // Refresh every minute
  }

  async refreshAllConfigs() {
    const keys = Array.from(this.currentConfig.keys());
    const refreshPromises = keys.map(key => 
      this.getConfig(key, { forceRefresh: true })
        .catch(error => console.error(`Failed to refresh config "${key}":`, error.message))
    );

    await Promise.allSettled(refreshPromises);
    console.log('Config refresh completed');
  }

  async getMultipleConfigs(keys, options = {}) {
    const configPromises = keys.map(key => 
      this.getConfig(key, options)
        .then(value => ({ key, value, success: true }))
        .catch(error => ({ key, error: error.message, success: false }))
    );

    const results = await Promise.all(configPromises);
    
    const configMap = new Map();
    const failures = [];

    results.forEach(result => {
      if (result.success) {
        configMap.set(result.key, result.value);
      } else {
        failures.push(result.key);
      }
    });

    return {
      configs: configMap,
      failures,
      successRate: configMap.size / keys.length
    };
  }

  getCacheStats() {
    return {
      totalCached: this.configCache.size,
      cacheHits: Array.from(this.configCache.values()).filter(c => 
        Date.now() - c.timestamp < c.ttl
      ).length,
      sources: Array.from(this.configCache.values()).reduce((acc, curr) => {
        acc[curr.source] = (acc[curr.source] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

// Usage
const configService = new ConfigurationService();

async function testConfigurationService() {
  try {
    // Get single config
    const dbHost = await configService.getConfig('database.host');
    console.log('Database host:', dbHost);

    // Get multiple configs
    const configs = await configService.getMultipleConfigs([
      'database.host',
      'database.port',
      'cache.ttl',
      'api.timeout',
      'nonexistent.key'
    ]);

    console.log('Multiple configs result:');
    console.log('Successfully loaded:', Array.from(configs.configs.entries()));
    console.log('Failed keys:', configs.failures);
    console.log('Success rate:', configs.successRate);

    // Get cache stats
    console.log('Cache stats:', configService.getCacheStats());
  } catch (error) {
    console.error('Configuration error:', error.message);
  }
}

testConfigurationService();

// ## 5. Health Check Aggregation with Fallback

class HealthCheckOrchestrator {
  constructor() {
    this.services = {
      database: {
        name: 'PostgreSQL Database',
        check: this.checkDatabase.bind(this),
        critical: true,
        timeout: 3000
      },
      redis: {
        name: 'Redis Cache',
        check: this.checkRedis.bind(this),
        critical: false,
        timeout: 2000
      },
      elasticsearch: {
        name: 'Elasticsearch Cluster',
        check: this.checkElasticsearch.bind(this),
        critical: false,
        timeout: 5000
      },
      s3: {
        name: 'AWS S3',
        check: this.checkS3.bind(this),
        critical: false,
        timeout: 4000
      },
      externalApi: {
        name: 'External Payment API',
        check: this.checkExternalApi.bind(this),
        critical: true,
        timeout: 6000
      }
    };

    this.healthCache = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }

  async getOverallHealth() {
    const healthPromises = Object.entries(this.services).map(([serviceKey, service]) =>
      this.checkServiceHealth(serviceKey, service)
        .then(health => ({ service: serviceKey, ...health, success: true }))
        .catch(error => ({
          service: serviceKey,
          success: false,
          error: error.message,
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }))
    );

    const results = await Promise.allSettled(healthPromises);
    const healthResults = results.map(r => r.status === 'fulfilled' ? r.value : {
      service: 'unknown',
      success: false,
      error: 'Health check failed',
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });

    return this.aggregateHealthResults(healthResults);
  }

  async checkServiceHealth(serviceKey, service) {
    // Check cache first
    const cached = this.healthCache.get(serviceKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }

    // Perform actual health check with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout for ${service.name}`)), service.timeout);
    });

    const healthPromise = service.check();

    try {
      const healthResult = await Promise.race([healthPromise, timeoutPromise]);
      
      const result = {
        ...healthResult,
        service: serviceKey,
        name: service.name,
        timestamp: new Date().toISOString(),
        success: true
      };

      // Cache successful result
      this.healthCache.set(serviceKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  aggregateHealthResults(results) {
    const healthyServices = results.filter(r => r.success && r.status === 'healthy');
    const unhealthyServices = results.filter(r => !r.success || r.status !== 'healthy');
    const criticalServices = Object.entries(this.services)
      .filter(([_, service]) => service.critical)
      .map(([key]) => key);

    const unhealthyCritical = unhealthyServices.filter(service => 
      criticalServices.includes(service.service)
    );

    const overallStatus = unhealthyCritical.length > 0 ? 'unhealthy' :
                         unhealthyServices.length > 0 ? 'degraded' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        healthy: healthyServices.length,
        unhealthy: unhealthyServices.length,
        criticalUnhealthy: unhealthyCritical.length
      },
      services: results,
      criticalServicesStatus: criticalServices.map(key => ({
        service: key,
        healthy: healthyServices.some(s => s.service === key),
        ...results.find(r => r.service === key)
      }))
    };
  }

  async getCriticalHealth() {
    const criticalServices = Object.entries(this.services)
      .filter(([_, service]) => service.critical)
      .map(([serviceKey, service]) =>
        this.checkServiceHealth(serviceKey, service)
          .then(health => ({ service: serviceKey, ...health, success: true }))
          .catch(error => ({
            service: serviceKey,
            success: false,
            error: error.message,
            status: 'unhealthy',
            timestamp: new Date().toISOString()
          }))
      );

    try {
      // We need at least one critical service to be healthy
      const results = await Promise.allSettled(criticalServices);
      const healthResults = results.map(r => r.status === 'fulfilled' ? r.value : {
        service: 'unknown',
        success: false,
        error: 'Health check failed',
        status: 'unhealthy'
      });

      const anyHealthy = healthResults.some(r => r.success && r.status === 'healthy');
      
      return {
        operational: anyHealthy,
        services: healthResults,
        timestamp: new Date().toISOString(),
        message: anyHealthy ? 
          'Critical services partially operational' : 
          'All critical services down'
      };
    } catch (error) {
      return {
        operational: false,
        services: [],
        timestamp: new Date().toISOString(),
        message: 'Health check system failure'
      };
    }
  }

  // Mock health check implementations
  async checkDatabase() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% healthy
          resolve({
            status: 'healthy',
            responseTime: Math.random() * 100 + 50,
            connections: Math.floor(Math.random() * 100),
            version: 'PostgreSQL 13.4'
          });
        } else {
          reject(new Error('Database connection failed'));
        }
      }, Math.random() * 1000);
    });
  }

  async checkRedis() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% healthy
          resolve({
            status: 'healthy',
            responseTime: Math.random() * 50 + 10,
            usedMemory: Math.floor(Math.random() * 1000000000),
            connectedClients: Math.floor(Math.random() * 50)
          });
        } else {
          reject(new Error('Redis connection timeout'));
        }
      }, Math.random() * 500);
    });
  }

  async checkElasticsearch() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.15) { // 85% healthy
          resolve({
            status: 'healthy',
            responseTime: Math.random() * 200 + 100,
            clusterStatus: 'green',
            nodeCount: 3
          });
        } else {
          reject(new Error('Elasticsearch cluster yellow status'));
        }
      }, Math.random() * 1500);
    });
  }

  async checkS3() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.02) { // 98% healthy
          resolve({
            status: 'healthy',
            responseTime: Math.random() * 300 + 200,
            bucketCount: 5,
            region: 'us-east-1'
          });
        } else {
          reject(new Error('S3 bucket inaccessible'));
        }
      }, Math.random() * 2000);
    });
  }

  async checkExternalApi() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.2) { // 80% healthy
          resolve({
            status: 'healthy',
            responseTime: Math.random() * 1000 + 500,
            version: 'v2.1.0',
            rateLimitRemaining: Math.floor(Math.random() * 1000)
          });
        } else {
          reject(new Error('External API rate limit exceeded'));
        }
      }, Math.random() * 3000);
    });
  }

  clearCache() {
    this.healthCache.clear();
    console.log('Health check cache cleared');
  }

  getCacheStatus() {
    const now = Date.now();
    const entries = Array.from(this.healthCache.entries());
    
    return {
      totalCached: entries.length,
      validEntries: entries.filter(([_, value]) => now - value.timestamp < this.cacheTTL).length,
      expiredEntries: entries.filter(([_, value]) => now - value.timestamp >= this.cacheTTL).length,
      services: entries.map(([key, value]) => ({
        service: key,
        age: now - value.timestamp,
        valid: now - value.timestamp < this.cacheTTL
      }))
    };
  }
}

// Usage
const healthOrchestrator = new HealthCheckOrchestrator();

// Regular health checks
setInterval(async () => {
  const health = await healthOrchestrator.getOverallHealth();
  console.log('Overall Health:', health.status);
  console.log('Summary:', health.summary);
  
  if (health.status !== 'healthy') {
    console.log('Unhealthy services:', health.services.filter(s => !s.success || s.status !== 'healthy'));
  }
}, 15000);

// Critical health check for load balancer
setInterval(async () => {
  const criticalHealth = await healthOrchestrator.getCriticalHealth();
  console.log('Critical Health:', criticalHealth.operational ? 'OPERATIONAL' : 'DEGRADED');
}, 10000);

// Cache status
setInterval(() => {
  console.log('Health Check Cache:', healthOrchestrator.getCacheStatus());
}, 30000);

// ## 6. Feature Flag Service with Multiple Backends

class FeatureFlagService {
  constructor() {
    this.flagSources = [
      {
        name: 'launchdarkly',
        provider: this.getFromLaunchDarkly.bind(this),
        cacheTTL: 30000,
        priority: 1
      },
      {
        name: 'splitio',
        provider: this.getFromSplitIO.bind(this),
        cacheTTL: 30000,
        priority: 2
      },
      {
        name: 'flagsmith',
        provider: this.getFromFlagsmith.bind(this),
        cacheTTL: 30000,
        priority: 3
      },
      {
        name: 'local-file',
        provider: this.getFromLocalFile.bind(this),
        cacheTTL: 60000,
        priority: 4
      },
      {
        name: 'environment',
        provider: this.getFromEnvironment.bind(this),
        cacheTTL: 0, // Never expires
        priority: 5
      }
    ];

    this.flagCache = new Map();
    this.userContext = {
      key: 'anonymous',
      custom: {}
    };
  }

  setUserContext(userKey, customAttributes = {}) {
    this.userContext = {
      key: userKey,
      custom: customAttributes,
      timestamp: new Date().toISOString()
    };
  }

  async isEnabled(featureKey, defaultValue = false) {
    const value = await this.getFeatureFlag(featureKey);
    return value !== null ? value : defaultValue;
  }

  async getFeatureFlag(featureKey, options = {}) {
    const { forceRefresh = false, timeout = 2000 } = options;

    // Check cache first
    if (!forceRefresh && this.flagCache.has(featureKey)) {
      const cached = this.flagCache.get(featureKey);
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.value;
      }
    }

    // Try all flag sources
    const flagPromises = this.flagSources.map(source =>
      this.fetchFromSource(source, featureKey, timeout)
        .then(value => ({
          source: source.name,
          value,
          timestamp: new Date().toISOString()
        }))
        .catch(error => ({
          source: source.name,
          error: error.message,
          timestamp: new Date().toISOString()
        }))
    );

    try {
      const result = await Promise.any(flagPromises);
      
      // Cache the successful result
      const sourceConfig = this.flagSources.find(s => s.name === result.source);
      this.flagCache.set(featureKey, {
        value: result.value,
        timestamp: Date.now(),
        ttl: sourceConfig.cacheTTL,
        source: result.source
      });

      console.log(`Feature flag "${featureKey}" = ${result.value} from ${result.source}`);
      return result.value;
    } catch (error) {
      console.error(`All feature flag sources failed for "${featureKey}":`, error.errors);
      return null; // Indeterminate state
    }
  }

  async fetchFromSource(source, featureKey, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Feature flag source ${source.name} timeout`)), timeout);
    });

    const flagPromise = source.provider(featureKey, this.userContext);

    return Promise.race([flagPromise, timeoutPromise]);
  }

  async getFromLaunchDarkly(featureKey, userContext) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          // Simulate LaunchDarkly logic
          const rollout = this.calculateRollout(featureKey, userContext.key);
          resolve(rollout < 0.5); // 50% rollout
        } else {
          reject(new Error('LaunchDarkly API unavailable'));
        }
      }, Math.random() * 500);
    });
  }

  async getFromSplitIO(featureKey, userContext) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.15) { // 85% success rate
          // Simulate Split.io logic
          const inTreatment = userContext.key.endsWith('1') || userContext.key.endsWith('3');
          resolve(inTreatment);
        } else {
          reject(new Error('Split.io service down'));
        }
      }, Math.random() * 600);
    });
  }

  async getFromFlagsmith(featureKey, userContext) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.2) { // 80% success rate
          // Simulate Flagsmith logic
          const isEnabled = featureKey.includes('beta') || userContext.custom.isInternal;
          resolve(isEnabled);
        } else {
          reject(new Error('Flagsmith connection failed'));
        }
      }, Math.random() * 400);
    });
  }

  async getFromLocalFile(featureKey, userContext) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Local file is very reliable but might have stale data
        if (Math.random() > 0.01) { // 99% success rate
          const localFlags = {
            'new-ui': true,
            'payment-v2': false,
            'search-algolia': true,
            'chat-support': userContext.custom.region === 'US'
          };
          resolve(localFlags[featureKey] || false);
        } else {
          reject(new Error('Local flag file corrupted'));
        }
      }, 10); // Very fast
    });
  }

  async getFromEnvironment(featureKey, userContext) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Environment variables as last resort
        const envFlags = {
            'new-ui': process.env.FEATURE_NEW_UI === 'true',
            'payment-v2': process.env.FEATURE_PAYMENT_V2 === 'true',
            'search-algolia': process.env.FEATURE_ALGOLIA === 'true'
        };
        resolve(envFlags[featureKey] || false);
      }, 5);
    });
  }

  calculateRollout(featureKey, userKey) {
    // Simple consistent hashing for rollout
    const hash = this.stringToHash(userKey + featureKey);
    return (hash % 100) / 100;
  }

  stringToHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async getMultipleFlags(flagKeys, options = {}) {
    const flagPromises = flagKeys.map(key =>
      this.getFeatureFlag(key, options)
        .then(value => ({ key, value, success: true }))
        .catch(error => ({ key, error: error.message, success: false }))
    );

    const results = await Promise.all(flagPromises);
    
    const flags = new Map();
    const failures = [];

    results.forEach(result => {
      if (result.success && result.value !== null) {
        flags.set(result.key, result.value);
      } else {
        failures.push(result.key);
      }
    });

    return {
      flags: Object.fromEntries(flags),
      failures,
      successRate: flags.size / flagKeys.length
    };
  }

  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.flagCache.entries());
    
    const stats = {
      total: entries.length,
      valid: 0,
      sources: {}
    };

    entries.forEach(([key, value]) => {
      const isValid = now - value.timestamp < value.ttl;
      if (isValid) stats.valid++;
      
      stats.sources[value.source] = (stats.sources[value.source] || 0) + 1;
    });

    return stats;
  }

  clearCache() {
    this.flagCache.clear();
    console.log('Feature flag cache cleared');
  }
}

// Usage
const featureService = new FeatureFlagService();

// Set user context
featureService.setUserContext('user-123', {
  region: 'US',
  isInternal: true,
  tier: 'premium'
});

// Check individual feature flags
async function testFeatureFlags() {
  const features = ['new-ui', 'payment-v2', 'search-algolia', 'chat-support'];
  
  for (const feature of features) {
    const isEnabled = await featureService.isEnabled(feature, false);
    console.log(`Feature ${feature}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Get multiple flags at once
  const multipleFlags = await featureService.getMultipleFlags(features);
  console.log('Multiple flags:', multipleFlags);

  // Get cache statistics
  console.log('Cache stats:', featureService.getCacheStats());
}

testFeatureFlags();

// Simulate different users
setTimeout(() => {
  featureService.setUserContext('user-456', {
    region: 'EU',
    isInternal: false,
    tier: 'basic'
  });
  testFeatureFlags();
}, 2000);

// These production-grade `Promise.any()` patterns demonstrate:

// 1. **Multi-source data fetching** with automatic fallback
// 2. **Geographic redundancy** for CDN assets
// 3. **Payment gateway redundancy** for high availability
// 4. **Configuration management** with multiple backends
// 5. **Health check aggregation** with graceful degradation
// 6. **Feature flag services** with multiple providers

// Each implementation includes:
// - Proper error handling and aggregation
// - Caching strategies for performance
// - Circuit breaker patterns
// - Comprehensive logging and metrics
// - Graceful degradation when sources fail
// - Production-ready monitoring and observability

// The key advantage of `Promise.any()` in these scenarios is ensuring service availability by using the first successful response from multiple redundant sources, while properly handling the case where all sources fail.






























// Here are comprehensive code snippets for `Promise.allSettled()` in JavaScript for Node.js production-grade backend development:

// ## 1. Batch Database Operations with Complete Status

class BatchDatabaseService {
  constructor(pool) {
    this.pool = pool;
    this.maxBatchSize = 100;
    this.retryAttempts = 3;
  }

  async batchInsertUsers(users) {
    if (users.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum of ${this.maxBatchSize}`);
    }

    const insertPromises = users.map((user, index) =>
      this.insertUserWithRetry(user, index)
        .then(result => ({
          status: 'fulfilled',
          value: {
            user,
            result,
            position: index
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            user,
            error: error.message,
            position: index,
            timestamp: new Date().toISOString()
          }
        }))
    );

    const results = await Promise.allSettled(insertPromises);
    
    // Flatten the results
    const flattenedResults = this.processBatchResults(results);
    
    return this.generateBatchReport(flattenedResults, users.length);
  }

  async insertUserWithRetry(user, position, attempt = 1) {
    try {
      const client = await this.pool.connect();
      
      try {
        const result = await client.query(
          `INSERT INTO users (email, name, created_at) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (email) DO NOTHING 
           RETURNING id, email`,
          [user.email, user.name, new Date()]
        );

        return {
          id: result.rows[0]?.id || null,
          email: user.email,
          action: result.rowCount > 0 ? 'created' : 'skipped',
          attempt
        };
      } finally {
        client.release();
      }
    } catch (error) {
      if (attempt < this.retryAttempts && this.isRetryableError(error)) {
        console.warn(`Retry ${attempt} for user ${user.email} at position ${position}`);
        await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
        return this.insertUserWithRetry(user, position, attempt + 1);
      }
      throw error;
    }
  }

  isRetryableError(error) {
    const retryableMessages = [
      'connection',
      'timeout',
      'deadlock',
      'lock',
      'try again'
    ];
    
    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg)
    );
  }

  processBatchResults(results) {
    const fulfilled = [];
    const rejected = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        fulfilled.push(result.value);
      } else {
        rejected.push(result.reason);
      }
    });

    return { fulfilled, rejected };
  }

  generateBatchReport(results, totalCount) {
    const { fulfilled, rejected } = results;
    
    const successfulInserts = fulfilled.filter(f => f.result.action === 'created');
    const skippedDuplicates = fulfilled.filter(f => f.result.action === 'skipped');
    
    return {
      summary: {
        totalProcessed: totalCount,
        successful: successfulInserts.length,
        duplicates: skippedDuplicates.length,
        failed: rejected.length,
        successRate: (successfulInserts.length / totalCount) * 100,
        timestamp: new Date().toISOString()
      },
      details: {
        successful: successfulInserts,
        duplicates: skippedDuplicates,
        failed: rejected
      },
      metrics: {
        averageAttempts: this.calculateAverageAttempts(fulfilled),
        errorBreakdown: this.analyzeErrors(rejected)
      }
    };
  }

  calculateAverageAttempts(fulfilled) {
    if (fulfilled.length === 0) return 0;
    
    const totalAttempts = fulfilled.reduce((sum, item) => 
      sum + item.result.attempt, 0
    );
    
    return (totalAttempts / fulfilled.length).toFixed(2);
  }

  analyzeErrors(rejected) {
    const errorCounts = {};
    
    rejected.forEach(failure => {
      const errorMsg = failure.error;
      errorCounts[errorMsg] = (errorCounts[errorMsg] || 0) + 1;
    });
    
    return errorCounts;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async batchUpdateUserProfiles(updates) {
    const updatePromises = updates.map(update =>
      this.pool.query(
        `UPDATE user_profiles 
         SET bio = $1, avatar_url = $2, updated_at = $3 
         WHERE user_id = $4`,
        [update.bio, update.avatarUrl, new Date(), update.userId]
      )
      .then(result => ({
        status: 'fulfilled',
        value: {
          userId: update.userId,
          rowsAffected: result.rowCount,
          timestamp: new Date().toISOString()
        }
      }))
      .catch(error => ({
        status: 'rejected',
        reason: {
          userId: update.userId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }))
    );

    const results = await Promise.allSettled(updatePromises);
    return this.processOperationResults(results, 'update');
  }

  processOperationResults(results, operationType) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    return {
      operation: operationType,
      summary: {
        total: results.length,
        successful: fulfilled.length,
        failed: rejected.length,
        successRate: (fulfilled.length / results.length) * 100
      },
      successful: fulfilled,
      failed: rejected
    };
  }
}

// Mock database pool for demonstration
const mockPool = {
  connect: () => Promise.resolve({
    query: () => Promise.resolve({
      rows: [{ id: Math.random().toString(36).substr(2, 9) }],
      rowCount: 1
    }),
    release: () => {}
  })
};

// Usage
const dbService = new BatchDatabaseService(mockPool);

const users = [
  { email: 'user1@example.com', name: 'User One' },
  { email: 'user2@example.com', name: 'User Two' },
  { email: 'user3@example.com', name: 'User Three' },
  { email: 'user1@example.com', name: 'User One Duplicate' }, // Duplicate email
  { email: 'invalid-email', name: 'Invalid User' } // Will fail
];

dbService.batchInsertUsers(users)
  .then(report => {
    console.log('Batch Insert Report:');
    console.log('Summary:', report.summary);
    console.log('Metrics:', report.metrics);
    console.log('Failed items:', report.details.failed);
  })
  .catch(error => console.error('Batch operation failed:', error));

// ## 2. Microservice Health Check Aggregation

class MicroserviceHealthMonitor {
  constructor() {
    this.services = {
      userService: { url: 'https://users.api.example.com/health', timeout: 5000 },
      orderService: { url: 'https://orders.api.example.com/health', timeout: 3000 },
      paymentService: { url: 'https://payments.api.example.com/health', timeout: 4000 },
      inventoryService: { url: 'https://inventory.api.example.com/health', timeout: 6000 },
      notificationService: { url: 'https://notifications.api.example.com/health', timeout: 2000 }
    };
    
    this.healthCache = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }

  async checkAllServices() {
    const healthCheckPromises = Object.entries(this.services).map(([serviceName, config]) =>
      this.checkServiceHealth(serviceName, config)
        .then(health => ({
          status: 'fulfilled',
          value: {
            service: serviceName,
            ...health,
            status: 'healthy'
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            service: serviceName,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          }
        }))
    );

    const results = await Promise.allSettled(healthCheckPromises);
    return this.aggregateHealthResults(results);
  }

  async checkServiceHealth(serviceName, config) {
    // Check cache first
    const cached = this.healthCache.get(serviceName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${config.timeout}ms`)), config.timeout);
    });

    const healthPromise = this.performHealthCheck(serviceName, config);

    try {
      const healthData = await Promise.race([healthPromise, timeoutPromise]);
      
      // Cache successful health check
      this.healthCache.set(serviceName, {
        data: healthData,
        timestamp: Date.now()
      });
      
      return healthData;
    } catch (error) {
      throw error;
    }
  }

  async performHealthCheck(serviceName, config) {
    // Simulate actual health check - in real implementation, this would be an HTTP request
    return new Promise((resolve, reject) => {
      const latency = Math.random() * 1000;
      const successRate = serviceName.includes('notification') ? 0.7 : 0.9; // Vary success rates
      
      setTimeout(() => {
        if (Math.random() < successRate) {
          resolve({
            responseTime: latency,
            version: '1.0.0',
            uptime: Math.floor(Math.random() * 1000000),
            database: Math.random() > 0.1 ? 'connected' : 'disconnected',
            queue: Math.random() > 0.2 ? 'healthy' : 'backed up',
            timestamp: new Date().toISOString()
          });
        } else {
          reject(new Error(`Service ${serviceName} is unhealthy`));
        }
      }, latency);
    });
  }

  aggregateHealthResults(results) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const healthyServices = fulfilled.filter(s => s.status === 'healthy');
    const criticalServices = ['userService', 'paymentService'];
    
    const unhealthyCritical = rejected.filter(s => 
      criticalServices.includes(s.service)
    );

    const overallStatus = unhealthyCritical.length > 0 ? 'degraded' :
                         rejected.length > 0 ? 'partial_outage' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      summary: {
        totalServices: results.length,
        healthy: healthyServices.length,
        unhealthy: rejected.length,
        successRate: (healthyServices.length / results.length) * 100
      },
      services: {
        healthy: healthyServices,
        unhealthy: rejected
      },
      criticalStatus: {
        allCriticalHealthy: unhealthyCritical.length === 0,
        unhealthyCritical: unhealthyCritical.map(s => s.service)
      },
      metrics: {
        averageResponseTime: this.calculateAverageResponseTime(healthyServices),
        slowestService: this.findSlowestService(healthyServices),
        errorBreakdown: this.analyzeServiceErrors(rejected)
      }
    };
  }

  calculateAverageResponseTime(healthyServices) {
    if (healthyServices.length === 0) return 0;
    
    const totalResponseTime = healthyServices.reduce((sum, service) => 
      sum + service.responseTime, 0
    );
    
    return totalResponseTime / healthyServices.length;
  }

  findSlowestService(healthyServices) {
    if (healthyServices.length === 0) return null;
    
    return healthyServices.reduce((slowest, current) => 
      current.responseTime > slowest.responseTime ? current : slowest
    );
  }

  analyzeServiceErrors(unhealthyServices) {
    const errorAnalysis = {};
    
    unhealthyServices.forEach(service => {
      const errorKey = service.error.includes('timeout') ? 'timeout' :
                      service.error.includes('unhealthy') ? 'service_unhealthy' : 'other';
      
      errorAnalysis[errorKey] = (errorAnalysis[errorKey] || 0) + 1;
    });
    
    return errorAnalysis;
  }

  async getServiceDependencies() {
    const dependencyPromises = Object.keys(this.services).map(serviceName =>
      this.checkServiceDependencies(serviceName)
        .then(dependencies => ({
          status: 'fulfilled',
          value: {
            service: serviceName,
            dependencies,
            timestamp: new Date().toISOString()
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            service: serviceName,
            error: error.message,
            timestamp: new Date().toISOString()
          }
        }))
    );

    const results = await Promise.allSettled(dependencyPromises);
    
    const dependencyMap = new Map();
    const failures = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        dependencyMap.set(result.value.service, result.value.dependencies);
      } else {
        failures.push(result.reason);
      }
    });

    return {
      dependencies: Object.fromEntries(dependencyMap),
      failures,
      timestamp: new Date().toISOString()
    };
  }

  async checkServiceDependencies(serviceName) {
    // Simulate dependency checking
    return new Promise((resolve) => {
      setTimeout(() => {
        const dependencies = {
          userService: ['database', 'redis', 'email-service'],
          orderService: ['userService', 'paymentService', 'inventoryService'],
          paymentService: ['database', 'fraud-detection', 'bank-api'],
          inventoryService: ['database', 'cache'],
          notificationService: ['email-service', 'sms-gateway', 'push-service']
        };
        
        resolve(dependencies[serviceName] || []);
      }, Math.random() * 500);
    });
  }
}

// Usage
const healthMonitor = new MicroserviceHealthMonitor();

// Regular health monitoring
setInterval(async () => {
  const healthStatus = await healthMonitor.checkAllServices();
  
  console.log(`\n=== Health Check ${new Date().toISOString()} ===`);
  console.log(`Overall Status: ${healthStatus.status}`);
  console.log(`Healthy: ${healthStatus.summary.healthy}/${healthStatus.summary.totalServices}`);
  console.log(`Success Rate: ${healthStatus.summary.successRate.toFixed(1)}%`);
  
  if (healthStatus.services.unhealthy.length > 0) {
    console.log('Unhealthy Services:', healthStatus.services.unhealthy.map(s => s.service));
  }
  
  // Alert if critical services are down
  if (!healthStatus.criticalStatus.allCriticalHealthy) {
    console.error('🚨 CRITICAL ALERT: Critical services down:', healthStatus.criticalStatus.unhealthyCritical);
  }
}, 30000);

// Get dependency map
healthMonitor.getServiceDependencies()
  .then(dependencies => {
    console.log('Service Dependencies:', dependencies);
  });

// ## 3. File Processing Pipeline with Error Tolerance

class FileProcessingPipeline {
  constructor() {
    this.stages = [
      'validation',
      'parsing',
      'transformation',
      'enrichment',
      'export'
    ];
    
    this.processedFiles = new Map();
    this.maxConcurrentFiles = 5;
  }

  async processFiles(filePaths, options = {}) {
    const { 
      validate = true, 
      transform = true, 
      enrich = true,
      onProgress = () => {}
    } = options;

    const processingPromises = filePaths.map((filePath, index) =>
      this.processSingleFile(filePath, index, { validate, transform, enrich })
        .then(result => ({
          status: 'fulfilled',
          value: {
            filePath,
            ...result,
            processedAt: new Date().toISOString()
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            filePath,
            error: error.message,
            stage: error.stage || 'unknown',
            processedAt: new Date().toISOString()
          }
        }))
    );

    // Process files in batches to avoid resource exhaustion
    const batches = this.chunkArray(processingPromises, this.maxConcurrentFiles);
    const allResults = [];

    for (const batch of batches) {
      onProgress({ stage: 'processing', batch: batches.indexOf(batch) + 1, totalBatches: batches.length });
      
      const batchResults = await Promise.allSettled(batch);
      allResults.push(...batchResults);
      
      // Small delay between batches
      await this.delay(100);
    }

    return this.aggregateProcessingResults(allResults, filePaths.length);
  }

  async processSingleFile(filePath, index, options) {
    const stages = [];
    let currentData = { content: `Content of ${filePath}`, metadata: {} };

    try {
      // Stage 1: Validation
      if (options.validate) {
        stages.push('validation');
        currentData = await this.validateFile(filePath, currentData);
      }

      // Stage 2: Parsing
      stages.push('parsing');
      currentData = await this.parseFile(filePath, currentData);

      // Stage 3: Transformation
      if (options.transform) {
        stages.push('transformation');
        currentData = await this.transformData(filePath, currentData);
      }

      // Stage 4: Enrichment
      if (options.enrich) {
        stages.push('enrichment');
        currentData = await this.enrichData(filePath, currentData);
      }

      // Stage 5: Export
      stages.push('export');
      const exportResult = await this.exportData(filePath, currentData);

      return {
        success: true,
        stages,
        data: currentData,
        exportResult,
        fileSize: Math.random() * 10000,
        processingTime: Math.random() * 2000
      };
    } catch (error) {
      // Enhance error with stage information
      error.stage = stages[stages.length - 1] || 'unknown';
      throw error;
    }
  }

  async validateFile(filePath, data) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          data.metadata.validated = true;
          data.metadata.validationTime = new Date().toISOString();
          resolve(data);
        } else {
          reject(new Error(`File validation failed: ${filePath}`));
        }
      }, Math.random() * 100);
    });
  }

  async parseFile(filePath, data) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.03) { // 97% success rate
          data.parsed = true;
          data.records = Array.from({ length: Math.floor(Math.random() * 100) + 1 }, (_, i) => ({
            id: i + 1,
            content: `Record ${i + 1} from ${filePath}`,
            timestamp: new Date().toISOString()
          }));
          resolve(data);
        } else {
          reject(new Error(`File parsing failed: ${filePath}`));
        }
      }, Math.random() * 200);
    });
  }

  async transformData(filePath, data) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.02) { // 98% success rate
          data.transformed = true;
          data.records = data.records.map(record => ({
            ...record,
            transformed: true,
            processedAt: new Date().toISOString()
          }));
          resolve(data);
        } else {
          reject(new Error(`Data transformation failed: ${filePath}`));
        }
      }, Math.random() * 300);
    });
  }

  async enrichData(filePath, data) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.04) { // 96% success rate
          data.enriched = true;
          data.metadata.enrichmentSource = 'external-api';
          data.records = data.records.map(record => ({
            ...record,
            enriched: true,
            additionalData: { source: 'enrichment', value: Math.random() }
          }));
          resolve(data);
        } else {
          reject(new Error(`Data enrichment failed: ${filePath}`));
        }
      }, Math.random() * 400);
    });
  }

  async exportData(filePath, data) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.01) { // 99% success rate
          resolve({
            exported: true,
            destination: `s3://bucket/processed/${filePath}`,
            recordCount: data.records?.length || 0,
            exportTime: new Date().toISOString()
          });
        } else {
          reject(new Error(`Data export failed: ${filePath}`));
        }
      }, Math.random() * 500);
    });
  }

  aggregateProcessingResults(results, totalFiles) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const stageFailures = this.analyzeStageFailures(rejected);

    return {
      summary: {
        totalFiles,
        processed: fulfilled.length,
        failed: rejected.length,
        successRate: (fulfilled.length / totalFiles) * 100
      },
      successfulFiles: fulfilled,
      failedFiles: rejected,
      analysis: {
        averageProcessingTime: this.calculateAverageProcessingTime(fulfilled),
        stageFailureBreakdown: stageFailures,
        largestFile: this.findLargestFile(fulfilled),
        totalRecords: this.calculateTotalRecords(fulfilled)
      },
      timestamp: new Date().toISOString()
    };
  }

  analyzeStageFailures(failedFiles) {
    const stageFailures = {};
    
    failedFiles.forEach(failure => {
      const stage = failure.stage;
      stageFailures[stage] = (stageFailures[stage] || 0) + 1;
    });
    
    return stageFailures;
  }

  calculateAverageProcessingTime(successfulFiles) {
    if (successfulFiles.length === 0) return 0;
    
    const totalTime = successfulFiles.reduce((sum, file) => 
      sum + file.processingTime, 0
    );
    
    return totalTime / successfulFiles.length;
  }

  findLargestFile(successfulFiles) {
    if (successfulFiles.length === 0) return null;
    
    return successfulFiles.reduce((largest, current) => 
      current.fileSize > largest.fileSize ? current : largest
    );
  }

  calculateTotalRecords(successfulFiles) {
    return successfulFiles.reduce((total, file) => 
      total + (file.data.records?.length || 0), 0
    );
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const fileProcessor = new FileProcessingPipeline();

const filePaths = [
  '/data/file1.csv',
  '/data/file2.json',
  '/data/file3.xml',
  '/data/file4.txt',
  '/data/file5.csv',
  '/data/file6.json',
  '/data/file7.xml',
  '/data/file8.txt'
];

fileProcessor.processFiles(filePaths, {
  validate: true,
  transform: true,
  enrich: true,
  onProgress: (progress) => {
    console.log(`Progress: Processing batch ${progress.batch} of ${progress.totalBatches}`);
  }
})
.then(results => {
  console.log('\n=== File Processing Results ===');
  console.log('Summary:', results.summary);
  console.log('Analysis:', results.analysis);
  
  if (results.failedFiles.length > 0) {
    console.log('Failed files:', results.failedFiles.map(f => ({
      file: f.filePath,
      stage: f.stage,
      error: f.error
    })));
  }
})
.catch(error => {
  console.error('Processing pipeline failed:', error);
});

// ## 4. Bulk API Call Handler with Partial Success

class BulkAPICallHandler {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.concurrency = options.concurrency || 10;
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 2;
    this.rateLimitDelay = options.rateLimitDelay || 100;
    
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      retried: 0
    };
  }

  async makeBulkRequests(requests, options = {}) {
    const {
      method = 'GET',
      headers = {},
      onProgress = () => {},
      stopOnCriticalFailure = false
    } = options;

    const requestPromises = requests.map((request, index) =>
      this.makeSingleRequest(request, method, headers, index)
        .then(response => ({
          status: 'fulfilled',
          value: {
            request,
            response,
            position: index,
            timestamp: new Date().toISOString()
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            request,
            error: error.message,
            statusCode: error.statusCode,
            position: index,
            timestamp: new Date().toISOString(),
            attempts: error.attempts || 1
          }
        }))
    );

    // Process requests with concurrency control
    const batches = this.chunkArray(requestPromises, this.concurrency);
    const allResults = [];
    let criticalFailure = false;

    for (const [batchIndex, batch] of batches.entries()) {
      if (criticalFailure && stopOnCriticalFailure) {
        console.log('Stopping due to critical failure in previous batch');
        break;
      }

      onProgress({
        stage: 'processing',
        batch: batchIndex + 1,
        totalBatches: batches.length,
        completed: allResults.length
      });

      const batchResults = await Promise.allSettled(batch);
      allResults.push(...batchResults);

      // Check for critical failures in this batch
      if (stopOnCriticalFailure) {
        const criticalErrors = batchResults
          .filter(r => r.status === 'rejected')
          .filter(r => this.isCriticalError(r.reason.error));
        
        if (criticalErrors.length > 0) {
          criticalFailure = true;
          console.error('Critical failure detected in batch', batchIndex + 1);
        }
      }

      // Rate limiting between batches
      await this.delay(this.rateLimitDelay);
    }

    return this.aggregateRequestResults(allResults, requests.length);
  }

  async makeSingleRequest(request, method, headers, position, attempt = 1) {
    const url = typeof request === 'string' ? request : request.url;
    const data = typeof request === 'string' ? null : request.data;
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${this.timeout}ms`)), this.timeout);
    });

    const requestPromise = this.executeRequest(url, method, data, headers);

    try {
      const response = await Promise.race([requestPromise, timeoutPromise]);
      this.requestMetrics.successful++;
      return response;
    } catch (error) {
      this.requestMetrics.failed++;

      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        this.requestMetrics.retried++;
        console.warn(`Retry ${attempt} for request ${url} at position ${position}`);
        
        await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
        return this.makeSingleRequest(request, method, headers, position, attempt + 1);
      }

      // Enhance error with attempt information
      error.attempts = attempt;
      throw error;
    }
  }

  async executeRequest(url, method, data, headers) {
    // Simulate API request - in real implementation, use axios/fetch
    return new Promise((resolve, reject) => {
      const latency = Math.random() * 2000;
      const successRate = 0.9; // 90% success rate

      setTimeout(() => {
        if (Math.random() < successRate) {
          resolve({
            status: 200,
            data: {
              message: `Success response for ${url}`,
              method,
              timestamp: new Date().toISOString(),
              requestData: data
            },
            headers: {},
            latency
          });
        } else {
          const error = new Error(`API request failed for ${url}`);
          error.statusCode = Math.random() > 0.5 ? 500 : 429;
          reject(error);
        }
      }, latency);
    });
  }

  shouldRetry(error) {
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    const retryableMessages = ['timeout', 'network', 'connection'];
    
    return retryableStatusCodes.includes(error.statusCode) ||
           retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
  }

  isCriticalError(errorMessage) {
    const criticalErrors = [
      'authentication failed',
      'invalid api key',
      'permission denied',
      'account suspended'
    ];
    
    return criticalErrors.shenzhen(msg => errorMessage.toLowerCase().includes(msg));
  }

  aggregateRequestResults(results, totalRequests) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const statusCodeAnalysis = this.analyzeStatusCodes(fulfilled, rejected);

    return {
      summary: {
        totalRequests,
        successful: fulfilled.length,
        failed: rejected.length,
        successRate: (fulfilled.length / totalRequests) * 100,
        timestamp: new Date().toISOString()
      },
      successfulRequests: fulfilled,
      failedRequests: rejected,
      analysis: {
        statusCodes: statusCodeAnalysis,
        errorTypes: this.analyzeErrorTypes(rejected),
        averageLatency: this.calculateAverageLatency(fulfilled),
        retryStatistics: this.requestMetrics
      },
      metrics: this.requestMetrics
    };
  }

  analyzeStatusCodes(fulfilled, rejected) {
    const statusCodes = {};
    
    fulfilled.forEach(req => {
      const status = req.response.status;
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });
    
    rejected.forEach(req => {
      const status = req.statusCode || 'unknown';
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });
    
    return statusCodes;
  }

  analyzeErrorTypes(rejected) {
    const errorTypes = {};
    
    rejected.forEach(failure => {
      const error = failure.error;
      let type = 'unknown';
      
      if (error.includes('timeout')) type = 'timeout';
      else if (error.includes('network')) type = 'network';
      else if (error.includes('authentication')) type = 'auth';
      else if (error.includes('rate limit')) type = 'rate_limit';
      else type = 'server_error';
      
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    
    return errorTypes;
  }

  calculateAverageLatency(fulfilled) {
    if (fulfilled.length === 0) return 0;
    
    const totalLatency = fulfilled.reduce((sum, req) => 
      sum + req.response.latency, 0
    );
    
    return totalLatency / fulfilled.length;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  resetMetrics() {
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      retried: 0
    };
  }

  getMetrics() {
    return { ...this.requestMetrics };
  }
}

// Usage
const apiHandler = new BulkAPICallHandler('https://api.example.com', {
  concurrency: 5,
  timeout: 5000,
  retryAttempts: 2,
  rateLimitDelay: 200
});

const requests = [
  '/api/users/1',
  '/api/users/2',
  '/api/users/3',
  { url: '/api/orders', data: { status: 'pending' } },
  '/api/products',
  '/api/inventory',
  '/api/analytics',
  '/api/settings'
];

apiHandler.makeBulkRequests(requests, {
  method: 'GET',
  onProgress: (progress) => {
    console.log(`Progress: Batch ${progress.batch}/${progress.totalBatches}`);
  },
  stopOnCriticalFailure: true
})
.then(results => {
  console.log('\n=== Bulk API Results ===');
  console.log('Summary:', results.summary);
  console.log('Analysis:', results.analysis);
  console.log('Metrics:', results.metrics);
  
  if (results.failedRequests.length > 0) {
    console.log('Sample failures:', results.failedRequests.slice(0, 3));
  }
})
.catch(error => {
  console.error('Bulk API call failed:', error);
});

// ## 5. Distributed Cache Warming with Complete Status

class DistributedCacheWarmer {
  constructor(redisClients, options = {}) {
    this.redisClients = redisClients; // Array of Redis clients for different nodes
    this.batchSize = options.batchSize || 100;
    this.ttl = options.ttl || 3600; // 1 hour
    this.concurrency = options.concurrency || 3;
    this.retryAttempts = options.retryAttempts || 2;
    
    this.warmupStats = {
      totalKeys: 0,
      successfulWarms: 0,
      failedWarms: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  async warmCache(keys, dataFetcher, options = {}) {
    const {
      forceRefresh = false,
      onProgress = () => {},
      strategy = 'parallel' // 'parallel' or 'sequential'
    } = options;

    this.warmupStats.totalKeys = keys.length;

    // Split keys into batches
    const keyBatches = this.chunkArray(keys, this.batchSize);
    const allResults = [];

    for (const [batchIndex, keyBatch] of keyBatches.entries()) {
      onProgress({
        stage: 'processing',
        batch: batchIndex + 1,
        totalBatches: keyBatches.length,
        completed: allResults.length
      });

      let batchResults;

      if (strategy === 'parallel') {
        batchResults = await this.warmBatchParallel(keyBatch, dataFetcher, forceRefresh);
      } else {
        batchResults = await this.warmBatchSequential(keyBatch, dataFetcher, forceRefresh);
      }

      allResults.push(...batchResults);

      // Small delay between batches to avoid overwhelming the system
      await this.delay(50);
    }

    return this.aggregateWarmupResults(allResults, keys.length);
  }

  async warmBatchParallel(keys, dataFetcher, forceRefresh) {
    const warmPromises = keys.map(key =>
      this.warmSingleKey(key, dataFetcher, forceRefresh)
        .then(result => ({
          status: 'fulfilled',
          value: {
            key,
            ...result,
            timestamp: new Date().toISOString()
          }
        }))
        .catch(error => ({
          status: 'rejected',
          reason: {
            key,
            error: error.message,
            timestamp: new Date().toISOString(),
            attempts: error.attempts || 1
          }
        }))
    );

    const results = await Promise.allSettled(warmPromises);
    return results;
  }

  async warmBatchSequential(keys, dataFetcher, forceRefresh) {
    const results = [];

    for (const key of keys) {
      try {
        const result = await this.warmSingleKey(key, dataFetcher, forceRefresh);
        results.push({
          status: 'fulfilled',
          value: {
            key,
            ...result,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        results.push({
          status: 'rejected',
          reason: {
            key,
            error: error.message,
            timestamp: new Date().toISOString(),
            attempts: error.attempts || 1
          }
        });
      }

      // Small delay between keys in sequential mode
      await this.delay(10);
    }

    return results;
  }

  async warmSingleKey(key, dataFetcher, forceRefresh, attempt = 1) {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.getFromCache(key);
      if (cached) {
        this.warmupStats.cacheHits++;
        return { status: 'cached', value: cached, source: 'cache' };
      }
    }

    this.warmupStats.cacheMisses++;

    try {
      // Fetch fresh data
      const freshData = await dataFetcher(key);
      
      // Store in all Redis nodes
      const setPromises = this.redisClients.map((client, index) =>
        this.setInCache(client, key, freshData, index)
          .then(() => ({ node: index, status: 'success' }))
          .catch(error => ({ node: index, status: 'failed', error: error.message }))
      );

      const setResults = await Promise.allSettled(setPromises);
      
      const successfulSets = setResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 'success'
      ).length;

      if (successfulSets === 0) {
        throw new Error('All cache nodes failed');
      }

      this.warmupStats.successfulWarms++;

      return {
        status: 'warmed',
        value: freshData,
        source: 'fresh',
        cacheNodes: {
          total: this.redisClients.length,
          successful: successfulSets,
          failed: this.redisClients.length - successfulSets
        }
      };
    } catch (error) {
      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        await this.delay(Math.pow(2, attempt) * 100);
        return this.warmSingleKey(key, dataFetcher, forceRefresh, attempt + 1);
      }

      this.warmupStats.failedWarms++;
      error.attempts = attempt;
      throw error;
    }
  }

  async getFromCache(key) {
    // Simulate cache get - in real implementation, call Redis
    return new Promise((resolve) => {
      setTimeout(() => {
        // 60% cache hit rate for simulation
        resolve(Math.random() < 0.6 ? `cached-value-for-${key}` : null);
      }, Math.random() * 10);
    });
  }

  async setInCache(client, key, value, nodeIndex) {
    // Simulate cache set - in real implementation, call Redis
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          resolve();
        } else {
          reject(new Error(`Cache node ${nodeIndex} set failed`));
        }
      }, Math.random() * 50);
    });
  }

  shouldRetry(error) {
    const retryableErrors = [
      'timeout',
      'connection',
      'network',
      'temporary'
    ];
    
    return retryableErrors.some(msg => error.message.toLowerCase().includes(msg));
  }

  aggregateWarmupResults(results, totalKeys) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const statusBreakdown = this.analyzeWarmupStatus(fulfilled);

    return {
      summary: {
        totalKeys,
        processed: fulfilled.length,
        failed: rejected.length,
        successRate: (fulfilled.length / totalKeys) * 100,
        timestamp: new Date().toISOString()
      },
      status: {
        warmed: fulfilled.filter(f => f.status === 'warmed'),
        cached: fulfilled.filter(f => f.status === 'cached'),
        failed: rejected
      },
      analysis: {
        statusBreakdown,
        cachePerformance: {
          hitRate: (this.warmupStats.cacheHits / totalKeys) * 100,
          missRate: (this.warmupStats.cacheMisses / totalKeys) * 100
        },
        nodeDistribution: this.analyzeNodeDistribution(fulfilled),
        errorAnalysis: this.analyzeWarmupErrors(rejected)
      },
      metrics: { ...this.warmupStats }
    };
  }

  analyzeWarmupStatus(fulfilled) {
    const statusCounts = {};
    
    fulfilled.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
    
    return statusCounts;
  }

  analyzeNodeDistribution(fulfilled) {
    const nodeStats = {};
    
    fulfilled.forEach(item => {
      if (item.cacheNodes) {
        nodeStats.successfulNodes = (nodeStats.successfulNodes || 0) + item.cacheNodes.successful;
        nodeStats.failedNodes = (nodeStats.failedNodes || 0) + item.cacheNodes.failed;
      }
    });
    
    return nodeStats;
  }

  analyzeWarmupErrors(rejected) {
    const errorAnalysis = {};
    
    rejected.forEach(failure => {
      const error = failure.error;
      let category = 'unknown';
      
      if (error.includes('cache node')) category = 'cache_node';
      else if (error.includes('timeout')) category = 'timeout';
      else if (error.includes('connection')) category = 'connection';
      else category = 'data_fetch';
      
      errorAnalysis[category] = (errorAnalysis[category] || 0) + 1;
    });
    
    return errorAnalysis;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  resetStats() {
    this.warmupStats = {
      totalKeys: 0,
      successfulWarms: 0,
      failedWarms: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

// Mock data fetcher
const mockDataFetcher = (key) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.02) { // 98% success rate
        resolve(`fresh-data-for-${key}-${Date.now()}`);
      } else {
        reject(new Error(`Data fetch failed for ${key}`));
      }
    }, Math.random() * 100);
  });
};

// Mock Redis clients
const mockRedisClients = Array.from({ length: 3 }, (_, i) => ({}));

// Usage
const cacheWarmer = new DistributedCacheWarmer(mockRedisClients, {
  batchSize: 50,
  ttl: 3600,
  concurrency: 2,
  retryAttempts: 1
});

const cacheKeys = Array.from({ length: 200 }, (_, i) => `key-${i + 1}`);

cacheWarmer.warmCache(cacheKeys, mockDataFetcher, {
  forceRefresh: false,
  strategy: 'parallel',
  onProgress: (progress) => {
    console.log(`Warming cache: Batch ${progress.batch}/${progress.totalBatches}`);
  }
})
.then(results => {
  console.log('\n=== Cache Warming Results ===');
  console.log('Summary:', results.summary);
  console.log('Status Breakdown:', results.analysis.statusBreakdown);
  console.log('Cache Performance:', results.analysis.cachePerformance);
  console.log('Node Distribution:', results.analysis.nodeDistribution);
  
  if (results.status.failed.length > 0) {
    console.log('Sample failures:', results.status.failed.slice(0, 5));
  }
})
.catch(error => {
  console.error('Cache warming failed:', error);
});

// These production-grade `Promise.allSettled()` patterns demonstrate:

// 1. **Batch database operations** with complete success/failure reporting
// 2. **Microservice health monitoring** with comprehensive status aggregation
// 3. **File processing pipelines** with error tolerance and stage tracking
// 4. **Bulk API calls** with partial success handling and retry logic
// 5. **Distributed cache warming** with node-level status reporting

// Key benefits of `Promise.allSettled()` in production:

// - **Complete visibility** into all operation outcomes
// - **Graceful error handling** without stopping entire batches
// - **Detailed analytics** and reporting on success/failure patterns
// - **Resource management** through batching and concurrency control
// - **Retry mechanisms** for transient failures
// - **Comprehensive monitoring** and metrics collection

// Each implementation includes proper error handling, logging, metrics collection, and follows production best practices for reliability and observability.






























// Here are comprehensive code snippets for `Promise.prototype.finally()` in JavaScript for Node.js production-grade backend development:

// ## 1. Database Connection Management with Cleanup

class DatabaseConnectionManager {
  constructor(poolConfig) {
    this.pool = this.createPool(poolConfig);
    this.activeConnections = new Map();
    this.metrics = {
      totalConnections: 0,
      successfulQueries: 0,
      failedQueries: 0,
      connectionTimeouts: 0
    };
  }

  async executeTransaction(operations, options = {}) {
    const { timeout = 30000, retryAttempts = 3 } = options;
    let connection = null;
    let attempt = 0;

    while (attempt < retryAttempts) {
      try {
        connection = await this.getConnectionWithTimeout(timeout);
        const connectionId = this.trackConnection(connection);
        
        await connection.query('BEGIN');
        
        const results = [];
        for (const operation of operations) {
          const result = await this.executeOperation(connection, operation);
          results.push(result);
        }
        
        await connection.query('COMMIT');
        
        this.metrics.successfulQueries += operations.length;
        return results;
        
      } catch (error) {
        attempt++;
        
        if (connection) {
          try {
            await connection.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
          }
        }

        if (attempt === retryAttempts) {
          this.metrics.failedQueries += operations.length;
          throw new Error(`Transaction failed after ${retryAttempts} attempts: ${error.message}`);
        }
        
        console.warn(`Transaction attempt ${attempt} failed, retrying...`);
        await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
      } finally {
        // Always release connection back to pool
        if (connection) {
          this.releaseConnection(connection);
        }
      }
    }
  }

  async getConnectionWithTimeout(timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        this.metrics.connectionTimeouts++;
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);
    });

    const connectionPromise = this.pool.connect();

    try {
      const connection = await Promise.race([connectionPromise, timeoutPromise]);
      return connection;
    } catch (error) {
      throw error;
    }
  }

  trackConnection(connection) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeConnections.set(connectionId, {
      connection,
      acquiredAt: new Date(),
      lastActivity: new Date()
    });
    this.metrics.totalConnections++;
    return connectionId;
  }

  async executeOperation(connection, operation) {
    const startTime = Date.now();
    
    try {
      const result = await connection.query(operation.sql, operation.params);
      
      // Update connection activity
      this.updateConnectionActivity(connection);
      
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Operation failed: ${error.message}`);
    }
  }

  updateConnectionActivity(connection) {
    for (const [id, info] of this.activeConnections) {
      if (info.connection === connection) {
        info.lastActivity = new Date();
        break;
      }
    }
  }

  releaseConnection(connection) {
    try {
      connection.release();
    } catch (error) {
      console.error('Error releasing connection:', error);
    } finally {
      // Always remove from tracking, even if release fails
      this.cleanupConnectionTracking(connection);
    }
  }

  cleanupConnectionTracking(connection) {
    for (const [id, info] of this.activeConnections) {
      if (info.connection === connection) {
        this.activeConnections.delete(id);
        break;
      }
    }
  }

  async cleanup() {
    console.log('Cleaning up database connections...');
    
    let releasedCount = 0;
    for (const [id, info] of this.activeConnections) {
      try {
        info.connection.release();
        releasedCount++;
      } catch (error) {
        console.error(`Failed to release connection ${id}:`, error);
      }
    }
    
    this.activeConnections.clear();
    console.log(`Released ${releasedCount} connections`);
    
    return this.pool.end().finally(() => {
      console.log('Database pool closed');
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeConnections: this.activeConnections.size,
      connectionDetails: Array.from(this.activeConnections.entries()).map(([id, info]) => ({
        id,
        acquiredAt: info.acquiredAt,
        lastActivity: info.lastActivity,
        age: Date.now() - info.acquiredAt.getTime()
      }))
    };
  }

  createPool(config) {
    // Mock pool implementation for demonstration
    return {
      connect: () => Promise.resolve({
        query: () => Promise.resolve({ rows: [], rowCount: 0 }),
        release: () => console.log('Connection released')
      }),
      end: () => Promise.resolve()
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const dbManager = new DatabaseConnectionManager({
  host: 'localhost',
  database: 'myapp',
  user: 'user',
  password: 'pass',
  max: 20,
  idleTimeoutMillis: 30000
});

const transactionOperations = [
  { sql: 'UPDATE accounts SET balance = balance - $1 WHERE id = $2', params: [100, 1] },
  { sql: 'UPDATE accounts SET balance = balance + $1 WHERE id = $2', params: [100, 2] },
  { sql: 'INSERT INTO transactions (from_account, to_account, amount) VALUES ($1, $2, $3)', params: [1, 2, 100] }
];

dbManager.executeTransaction(transactionOperations, { timeout: 10000, retryAttempts: 2 })
  .then(results => {
    console.log('Transaction completed successfully');
    console.log('Results:', results);
  })
  .catch(error => {
    console.error('Transaction failed:', error.message);
  })
  .finally(() => {
    console.log('Transaction attempt completed');
    console.log('Database metrics:', dbManager.getMetrics());
  });

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, cleaning up...');
  await dbManager.cleanup();
  process.exit(0);
});

// ## 2. API Rate Limiter with Request Tracking

class RateLimitedAPIClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.requestsPerMinute = options.requestsPerMinute || 60;
    this.retryAttempts = options.retryAttempts || 3;
    this.timeout = options.timeout || 10000;
    
    this.requestQueue = [];
    this.requestTimestamps = [];
    this.isProcessing = false;
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      retriedRequests: 0
    };
    
    this.startQueueProcessor();
  }

  async makeRequest(endpoint, options = {}) {
    const { method = 'GET', data = null, headers = {} } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.totalRequests++;

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestId,
        endpoint,
        method,
        data,
        headers,
        resolve,
        reject,
        attempts: 0,
        addedAt: new Date()
      });
    });
  }

  startQueueProcessor() {
    setInterval(() => {
      this.processQueue();
    }, 1000 / (this.requestsPerMinute / 60)); // Spread requests evenly
  }

  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const now = Date.now();

    // Clean old timestamps (last minute)
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 60000
    );

    // Check rate limit
    if (this.requestTimestamps.length >= this.requestsPerMinute) {
      this.isProcessing = false;
      return;
    }

    const request = this.requestQueue.shift();
    if (!request) {
      this.isProcessing = false;
      return;
    }

    this.requestTimestamps.push(now);
    await this.executeRequest(request).finally(() => {
      this.isProcessing = false;
    });
  }

  async executeRequest(request) {
    const { requestId, endpoint, method, data, headers, resolve, reject, attempts } = request;
    const url = `${this.baseURL}${endpoint}`;
    
    let response = null;
    let startTime = Date.now();

    try {
      console.log(`[${requestId}] Making ${method} request to ${endpoint} (attempt ${attempts + 1})`);
      
      response = await this.makeActualRequest(url, method, data, headers);
      
      this.metrics.successfulRequests++;
      
      resolve({
        data: response,
        requestId,
        attempts: attempts + 1,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.status === 429 && attempts < this.retryAttempts) {
        // Rate limited - retry after delay
        this.metrics.rateLimitedRequests++;
        this.metrics.retriedRequests++;
        
        console.warn(`[${requestId}] Rate limited, retrying after delay...`);
        
        await this.delay(this.calculateRetryDelay(attempts));
        
        // Re-queue the request with incremented attempt count
        this.requestQueue.unshift({
          ...request,
          attempts: attempts + 1
        });
        
      } else {
        this.metrics.failedRequests++;
        
        reject({
          error: error.message,
          status: error.status,
          requestId,
          attempts: attempts + 1,
          duration
        });
      }
    } finally {
      // Always log the request for auditing
      this.logRequest({
        requestId,
        url,
        method,
        status: response ? 'success' : 'error',
        attempts: attempts + 1,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  async makeActualRequest(url, method, data, headers) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), this.timeout);
    });

    const requestPromise = new Promise((resolve, reject) => {
      // Simulate API request
      setTimeout(() => {
        const successRate = 0.9; // 90% success rate
        
        if (Math.random() < successRate) {
          resolve({ data: `Response from ${url}`, status: 200 });
        } else {
          const error = new Error('API request failed');
          error.status = Math.random() > 0.5 ? 500 : 429; // 50% chance of rate limit
          reject(error);
        }
      }, Math.random() * 1000);
    });

    return Promise.race([requestPromise, timeoutPromise]);
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  logRequest(logEntry) {
    // In production, this would send to your logging system
    console.log('Request Log:', logEntry);
    
    // Also track for metrics
    this.trackMetrics(logEntry);
  }

  trackMetrics(logEntry) {
    // Update any real-time metrics dashboards
    // This could send to StatsD, Prometheus, etc.
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      recentRequests: this.requestTimestamps.length,
      rateLimit: this.requestsPerMinute,
      metrics: { ...this.metrics }
    };
  }

  async flushQueue() {
    console.log('Flushing request queue...');
    
    const flushPromises = this.requestQueue.map(request => 
      new Promise(resolve => {
        request.reject({
          error: 'Queue flushed',
          status: 0,
          requestId: request.requestId,
          attempts: request.attempts
        });
        resolve();
      })
    );

    await Promise.allSettled(flushPromises).finally(() => {
      this.requestQueue = [];
      console.log('Queue flushed successfully');
    });
  }
}

// Usage
const apiClient = new RateLimitedAPIClient('https://api.example.com', {
  requestsPerMinute: 10, // Very low for testing
  retryAttempts: 2,
  timeout: 5000
});

// Make multiple requests to see rate limiting in action
for (let i = 0; i < 15; i++) {
  apiClient.makeRequest(`/users/${i}`, { method: 'GET' })
    .then(response => {
      console.log(`Request ${i} succeeded:`, response.data);
    })
    .catch(error => {
      console.error(`Request ${i} failed:`, error.error);
    })
    .finally(() => {
      console.log(`Request ${i} completed`);
    });
}

// Monitor queue status
setInterval(() => {
  const status = apiClient.getQueueStatus();
  console.log('Queue Status:', status);
}, 5000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down API client...');
  await apiClient.flushQueue();
  process.exit(0);
});

// ## 3. File Upload Handler with Resource Cleanup

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FileUploadHandler {
  constructor(uploadDir, options = {}) {
    this.uploadDir = uploadDir;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = options.allowedMimeTypes || ['image/jpeg', 'image/png', 'application/pdf'];
    this.cleanupInterval = options.cleanupInterval || 3600000; // 1 hour
    
    this.tempFiles = new Map();
    this.uploadMetrics = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalBytes: 0
    };
    
    this.ensureUploadDirectory();
    this.startCleanupJob();
  }

  async handleFileUpload(fileStream, filename, options = {}) {
    const uploadId = uuidv4();
    const tempFilePath = path.join(this.uploadDir, `temp_${uploadId}_${filename}`);
    const finalFilePath = path.join(this.uploadDir, filename);
    
    let tempFileHandle = null;
    let bytesWritten = 0;

    this.tempFiles.set(uploadId, {
      tempPath: tempFilePath,
      startTime: new Date(),
      filename,
      uploadId
    });

    this.uploadMetrics.totalUploads++;

    try {
      // Validate file size
      if (options.fileSize && options.fileSize > this.maxFileSize) {
        throw new Error(`File size ${options.fileSize} exceeds maximum ${this.maxFileSize}`);
      }

      // Validate MIME type
      if (options.mimeType && !this.allowedMimeTypes.includes(options.mimeType)) {
        throw new Error(`MIME type ${options.mimeType} not allowed`);
      }

      // Create temp file
      tempFileHandle = await fs.open(tempFilePath, 'w');
      
      // Stream file to disk
      for await (const chunk of fileStream) {
        bytesWritten += chunk.length;
        
        // Check size during upload
        if (bytesWritten > this.maxFileSize) {
          throw new Error('File size exceeded during upload');
        }
        
        await tempFileHandle.write(chunk);
      }

      // Validate file after upload
      await this.validateUploadedFile(tempFilePath, options);

      // Move to final location
      await fs.rename(tempFilePath, finalFilePath);

      this.uploadMetrics.successfulUploads++;
      this.uploadMetrics.totalBytes += bytesWritten;

      return {
        success: true,
        uploadId,
        filename,
        finalPath: finalFilePath,
        size: bytesWritten,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.uploadMetrics.failedUploads++;
      
      throw new Error(`File upload failed: ${error.message}`);
    } finally {
      // Always clean up resources
      await this.cleanupUploadResources(uploadId, tempFileHandle, tempFilePath);
    }
  }

  async validateUploadedFile(filePath, options) {
    const stats = await fs.stat(filePath);
    
    if (stats.size === 0) {
      throw new Error('Uploaded file is empty');
    }

    if (stats.size > this.maxFileSize) {
      throw new Error('Uploaded file exceeds size limit');
    }

    // Additional validation could include:
    // - Virus scanning
    // - Image dimension checking
    // - File type verification
    if (options.validateImageDimensions) {
      await this.validateImageDimensions(filePath, options.validateImageDimensions);
    }
  }

  async validateImageDimensions(filePath, dimensions) {
    // Simulate image dimension validation
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          resolve();
        } else {
          reject(new Error('Image dimensions invalid'));
        }
      }, 100);
    });
  }

  async cleanupUploadResources(uploadId, fileHandle, tempFilePath) {
    const cleanupTasks = [];

    // Close file handle if open
    if (fileHandle) {
      cleanupTasks.push(
        fileHandle.close().catch(error => {
          console.error(`Error closing file handle for ${uploadId}:`, error);
        })
      );
    }

    // Remove temp file if it exists
    cleanupTasks.push(
      fs.access(tempFilePath)
        .then(() => fs.unlink(tempFilePath))
        .catch(error => {
          // File might not exist, which is fine
          if (error.code !== 'ENOENT') {
            console.error(`Error deleting temp file ${tempFilePath}:`, error);
          }
        })
    );

    // Remove from tracking
    cleanupTasks.push(
      Promise.resolve().then(() => {
        this.tempFiles.delete(uploadId);
      })
    );

    // Execute all cleanup tasks
    await Promise.allSettled(cleanupTasks).finally(() => {
      console.log(`Cleanup completed for upload ${uploadId}`);
    });
  }

  async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.uploadDir, { recursive: true });
        console.log(`Created upload directory: ${this.uploadDir}`);
      } else {
        throw error;
      }
    }
  }

  startCleanupJob() {
    setInterval(() => {
      this.cleanupStaleTempFiles();
    }, this.cleanupInterval);
  }

  async cleanupStaleTempFiles() {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour
    
    console.log('Cleaning up stale temporary files...');

    for (const [uploadId, fileInfo] of this.tempFiles) {
      const fileAge = now - fileInfo.startTime.getTime();
      
      if (fileAge > staleThreshold) {
        console.log(`Removing stale temp file: ${fileInfo.tempPath}`);
        
        try {
          await fs.unlink(fileInfo.tempPath);
          this.tempFiles.delete(uploadId);
        } catch (error) {
          console.error(`Failed to remove stale file ${fileInfo.tempPath}:`, error);
        }
      }
    }
  }

  async processBatchUpload(files, options = {}) {
    const uploadPromises = files.map(file =>
      this.handleFileUpload(file.stream, file.filename, {
        fileSize: file.size,
        mimeType: file.mimeType,
        ...options
      })
      .then(result => ({
        status: 'fulfilled',
        value: result
      }))
      .catch(error => ({
        status: 'rejected',
        reason: {
          filename: file.filename,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }))
    );

    const results = await Promise.allSettled(uploadPromises);

    return this.aggregateUploadResults(results);
  }

  aggregateUploadResults(results) {
    const fulfilled = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const rejected = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    return {
      summary: {
        total: results.length,
        successful: fulfilled.length,
        failed: rejected.length,
        successRate: (fulfilled.length / results.length) * 100
      },
      successful: fulfilled,
      failed: rejected,
      metrics: { ...this.uploadMetrics }
    };
  }

  getUploadStatus(uploadId) {
    return this.tempFiles.get(uploadId) || null;
  }

  getMetrics() {
    return {
      ...this.uploadMetrics,
      activeUploads: this.tempFiles.size,
      tempFiles: Array.from(this.tempFiles.values()).map(file => ({
        uploadId: file.uploadId,
        filename: file.filename,
        startTime: file.startTime,
        age: Date.now() - file.startTime.getTime()
      }))
    };
  }

  async shutdown() {
    console.log('Shutting down file upload handler...');
    
    // Clean up all temp files
    const cleanupPromises = Array.from(this.tempFiles.values()).map(file =>
      fs.unlink(file.tempPath).catch(error => {
        console.error(`Error cleaning up ${file.tempPath}:`, error);
      })
    );

    await Promise.allSettled(cleanupPromises).finally(() => {
      this.tempFiles.clear();
      console.log('File upload handler shutdown complete');
    });
  }
}

// Usage
const uploadHandler = new FileUploadHandler('./uploads', {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png'],
  cleanupInterval: 1800000 // 30 minutes
});

// Mock file stream for demonstration
class MockFileStream {
  constructor(chunks) {
    this.chunks = chunks;
    this[Symbol.asyncIterator] = function* () {
      for (const chunk of this.chunks) {
        yield chunk;
      }
    };
  }
}

// Simulate file upload
const mockFile = {
  stream: new MockFileStream([Buffer.from('chunk1'), Buffer.from('chunk2')]),
  filename: 'test-image.jpg',
  size: 1024,
  mimeType: 'image/jpeg'
};

uploadHandler.handleFileUpload(mockFile.stream, mockFile.filename, {
  fileSize: mockFile.size,
  mimeType: mockFile.mimeType,
  validateImageDimensions: { width: 800, height: 600 }
})
.then(result => {
  console.log('Upload successful:', result);
})
.catch(error => {
  console.error('Upload failed:', error.message);
})
.finally(() => {
  console.log('Upload processing completed');
  console.log('Upload metrics:', uploadHandler.getMetrics());
});

// Batch upload example
const batchFiles = [
  { stream: new MockFileStream([Buffer.from('file1')]), filename: 'file1.txt', size: 100, mimeType: 'text/plain' },
  { stream: new MockFileStream([Buffer.from('file2')]), filename: 'file2.txt', size: 200, mimeType: 'text/plain' },
  { stream: new MockFileStream([Buffer.from('file3')]), filename: 'file3.txt', size: 150, mimeType: 'text/plain' }
];

uploadHandler.processBatchUpload(batchFiles)
  .then(results => {
    console.log('Batch upload results:', results);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await uploadHandler.shutdown();
  process.exit(0);
});

// ## 4. Distributed Lock Manager with Guaranteed Release

class DistributedLockManager {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.defaultTTL = options.defaultTTL || 30000; // 30 seconds
    this.retryDelay = options.retryDelay || 100;
    this.maxRetries = options.maxRetries || 10;
    
    this.activeLocks = new Map();
    this.lockMetrics = {
      totalAcquisitions: 0,
      successfulAcquisitions: 0,
      failedAcquisitions: 0,
      timeouts: 0,
      staleLocks: 0
    };
    
    this.startLockMonitor();
  }

  async acquireLock(lockKey, options = {}) {
    const { ttl = this.defaultTTL, retry = true } = options;
    const lockId = uuidv4();
    const startTime = Date.now();
    
    this.lockMetrics.totalAcquisitions++;

    let attempt = 0;
    let acquired = false;

    try {
      while (!acquired && attempt < this.maxRetries) {
        attempt++;
        
        // Try to acquire lock using Redis SET with NX and PX options
        const result = await this.redis.set(
          `lock:${lockKey}`,
          lockId,
          'PX', ttl,
          'NX'
        );

        if (result === 'OK') {
          acquired = true;
          this.lockMetrics.successfulAcquisitions++;
          
          // Track the active lock
          this.activeLocks.set(lockKey, {
            lockId,
            acquiredAt: new Date(),
            ttl,
            lockKey
          });
          
          console.log(`Lock acquired: ${lockKey} (${lockId})`);
          
          return {
            success: true,
            lockId,
            lockKey,
            acquiredAt: new Date(),
            ttl
          };
        }

        if (!retry) {
          break;
        }

        // Wait before retrying
        await this.delay(this.retryDelay);
      }

      if (!acquired) {
        this.lockMetrics.failedAcquisitions++;
        throw new Error(`Failed to acquire lock for ${lockKey} after ${attempt} attempts`);
      }

    } catch (error) {
      this.lockMetrics.failedAcquisitions++;
      throw error;
    } finally {
      // Always log the acquisition attempt
      this.logLockAttempt({
        lockKey,
        lockId,
        success: acquired,
        attempts: attempt,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  async executeWithLock(lockKey, operation, options = {}) {
    let lock = null;

    try {
      // Acquire lock
      lock = await this.acquireLock(lockKey, options);
      
      // Execute the operation
      const result = await operation();
      
      return {
        success: true,
        result,
        lockInfo: lock
      };
      
    } catch (error) {
      throw new Error(`Locked operation failed: ${error.message}`);
    } finally {
      // Always release the lock, even if operation fails
      if (lock) {
        await this.releaseLock(lockKey, lock.lockId).catch(releaseError => {
          console.error(`Failed to release lock ${lockKey}:`, releaseError);
        });
      }
    }
  }

  async releaseLock(lockKey, lockId) {
    const startTime = Date.now();
    let released = false;

    try {
      // Use Lua script for atomic release
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, `lock:${lockKey}`, lockId);
      
      released = result === 1;
      
      if (released) {
        console.log(`Lock released: ${lockKey} (${lockId})`);
      } else {
        console.warn(`Lock release failed - mismatch or expired: ${lockKey}`);
      }

      return released;
      
    } catch (error) {
      console.error(`Error releasing lock ${lockKey}:`, error);
      return false;
    } finally {
      // Always remove from active locks tracking
      this.activeLocks.delete(lockKey);
      
      // Log the release attempt
      this.logLockRelease({
        lockKey,
        lockId,
        success: released,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  async extendLock(lockKey, lockId, additionalTime) {
    let extended = false;

    try {
      // Use Lua script for atomic extension
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, `lock:${lockKey}`, lockId, additionalTime);
      
      extended = result === 1;
      
      if (extended) {
        console.log(`Lock extended: ${lockKey} for ${additionalTime}ms`);
        
        // Update tracking
        const lockInfo = this.activeLocks.get(lockKey);
        if (lockInfo) {
          lockInfo.ttl += additionalTime;
        }
      }

      return extended;
      
    } catch (error) {
      console.error(`Error extending lock ${lockKey}:`, error);
      return false;
    } finally {
      this.logLockExtension({
        lockKey,
        lockId,
        success: extended,
        additionalTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  startLockMonitor() {
    // Monitor for stale locks and cleanup
    setInterval(() => {
      this.checkStaleLocks();
    }, 30000); // Check every 30 seconds
  }

  async checkStaleLocks() {
    const now = Date.now();
    
    for (const [lockKey, lockInfo] of this.activeLocks) {
      const lockAge = now - lockInfo.acquiredAt.getTime();
      
      // If lock is older than TTL, it might be stale
      if (lockAge > lockInfo.ttl) {
        console.warn(`Potential stale lock detected: ${lockKey}, age: ${lockAge}ms`);
        this.lockMetrics.staleLocks++;
        
        // Try to verify and cleanup
        await this.verifyAndCleanupLock(lockKey, lockInfo.lockId);
      }
    }
  }

  async verifyAndCleanupLock(lockKey, expectedLockId) {
    try {
      const currentLockId = await this.redis.get(`lock:${lockKey}`);
      
      if (currentLockId === expectedLockId) {
        // Lock is still held by us but expired - force release
        console.warn(`Force releasing expired lock: ${lockKey}`);
        await this.redis.del(`lock:${lockKey}`);
        this.activeLocks.delete(lockKey);
      } else if (currentLockId) {
        // Lock is held by someone else - remove from our tracking
        console.warn(`Lock ${lockKey} acquired by another process`);
        this.activeLocks.delete(lockKey);
      } else {
        // Lock doesn't exist - clean up tracking
        this.activeLocks.delete(lockKey);
      }
    } catch (error) {
      console.error(`Error verifying lock ${lockKey}:`, error);
    }
  }

  logLockAttempt(attempt) {
    console.log('Lock Attempt:', attempt);
  }

  logLockRelease(release) {
    console.log('Lock Release:', release);
  }

  logLockExtension(extension) {
    console.log('Lock Extension:', extension);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveLocks() {
    return Array.from(this.activeLocks.values()).map(lock => ({
      ...lock,
      age: Date.now() - lock.acquiredAt.getTime()
    }));
  }

  getMetrics() {
    return {
      ...this.lockMetrics,
      activeLocks: this.activeLocks.size,
      lockDetails: this.getActiveLocks()
    };
  }

  async shutdown() {
    console.log('Shutting down lock manager...');
    
    // Release all active locks
    const releasePromises = Array.from(this.activeLocks.entries()).map(([lockKey, lockInfo]) =>
      this.releaseLock(lockKey, lockInfo.lockId)
        .catch(error => {
          console.error(`Failed to release lock ${lockKey} during shutdown:`, error);
        })
    );

    await Promise.allSettled(releasePromises).finally(() => {
      this.activeLocks.clear();
      console.log('Lock manager shutdown complete');
    });
  }
}

// Mock Redis client for demonstration
const mockRedisClient = {
  set: () => Promise.resolve('OK'),
  eval: () => Promise.resolve(1),
  get: () => Promise.resolve('lock-id'),
  del: () => Promise.resolve(1)
};

// Usage
const lockManager = new DistributedLockManager(mockRedisClient, {
  defaultTTL: 10000,
  retryDelay: 50,
  maxRetries: 5
});

// Example: Process payment with lock
async function processPayment(orderId, amount) {
  const lockKey = `payment:${orderId}`;
  
  return lockManager.executeWithLock(lockKey, async () => {
    console.log(`Processing payment for order ${orderId}`);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (Math.random() > 0.1) { // 90% success rate
      return { success: true, transactionId: uuidv4() };
    } else {
      throw new Error('Payment processing failed');
    }
  }, { ttl: 5000 });
}

// Test concurrent payment processing
const orderId = 'order-123';
const concurrentRequests = 3;

for (let i = 0; i < concurrentRequests; i++) {
  processPayment(orderId, 100)
    .then(result => {
      console.log(`Payment ${i} succeeded:`, result);
    })
    .catch(error => {
      console.error(`Payment ${i} failed:`, error.message);
    })
    .finally(() => {
      console.log(`Payment attempt ${i} completed`);
      console.log('Lock metrics:', lockManager.getMetrics());
    });
}

// Monitor active locks
setInterval(() => {
  const activeLocks = lockManager.getActiveLocks();
  if (activeLocks.length > 0) {
    console.log('Active locks:', activeLocks);
  }
}, 5000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await lockManager.shutdown();
  process.exit(0);
});

// ## 5. Circuit Breaker with State Management

class ProductionCircuitBreaker {
  constructor(options = {}) {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = null;
    
    this.config = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 3,
      timeout: options.timeout || 10000,
      resetTimeout: options.resetTimeout || 60000,
      ...options
    };
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitOpens: 0,
      circuitCloses: 0,
      rejectedRequests: 0
    };
    
    this.eventHandlers = {
      onOpen: [],
      onClose: [],
      onHalfOpen: []
    };
    
    this.startMetricsCollection();
  }

  async call(serviceFunction, ...args) {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.metrics.totalRequests++;

    // Check circuit state
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.metrics.rejectedRequests++;
        throw new Error(`Circuit breaker is OPEN. Retry after ${new Date(this.nextAttempt).toISOString()}`);
      }
      
      this.state = 'HALF_OPEN';
      this.emit('onHalfOpen', { callId, timestamp: new Date() });
    }

    let result = null;
    let success = false;

    try {
      // Execute with timeout
      result = await this.executeWithTimeout(serviceFunction, args, this.config.timeout);
      success = true;
      this.metrics.successfulRequests++;
      
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    } finally {
      // Always update circuit state
      await this.updateCircuitState(success, callId, Date.now() - startTime);
    }

    return result;
  }

  async executeWithTimeout(serviceFunction, args, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Service call timeout')), timeout);
    });

    const servicePromise = serviceFunction(...args);

    return Promise.race([servicePromise, timeoutPromise]);
  }

  async updateCircuitState(success, callId, duration) {
    const previousState = this.state;

    try {
      if (success) {
        this.onSuccess(callId, duration);
      } else {
        this.onFailure(callId, duration);
      }
    } catch (error) {
      console.error('Error updating circuit state:', error);
    } finally {
      // Always emit state change events if state changed
      if (this.state !== previousState) {
        this.emitStateChange(previousState, this.state, callId);
      }
      
      // Always log the call for monitoring
      this.logCall({
        callId,
        success,
        duration,
        state: this.state,
        failureCount: this.failureCount,
        successCount: this.successCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  onSuccess(callId, duration) {
    this.successCount++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        this.metrics.circuitCloses++;
        console.log(`Circuit breaker CLOSED after successful calls`);
      }
    }
  }

  onFailure(callId, duration) {
    this.failureCount++;
    this.successCount = 0;

    if (this.state === 'HALF_OPEN') {
      // Immediate return to OPEN state on failure in HALF_OPEN
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      this.metrics.circuitOpens++;
      console.log(`Circuit breaker re-OPENED due to failure in HALF_OPEN state`);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      this.metrics.circuitOpens++;
      console.log(`Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  emitStateChange(fromState, toState, callId) {
    const eventMap = {
      'CLOSED_TO_OPEN': 'onOpen',
      'OPEN_TO_HALF_OPEN': 'onHalfOpen',
      'HALF_OPEN_TO_CLOSED': 'onClose'
    };
    
    const eventKey = `${fromState}_TO_${toState}`;
    const eventName = eventMap[eventKey];
    
    if (eventName) {
      this.emit(eventName, {
        fromState,
        toState,
        callId,
        timestamp: new Date(),
        metrics: { ...this.metrics }
      });
    }
  }

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  logCall(callInfo) {
    // In production, send to your logging system
    console.log('Circuit Breaker Call:', callInfo);
  }

  startMetricsCollection() {
    // Report metrics periodically
    setInterval(() => {
      this.reportMetrics();
    }, 30000);
  }

  reportMetrics() {
    const metricsReport = {
      ...this.metrics,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      timestamp: new Date().toISOString()
    };
    
    // Send to metrics system (StatsD, Prometheus, etc.)
    console.log('Circuit Breaker Metrics:', metricsReport);
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      metrics: { ...this.metrics }
    };
  }

  forceState(newState) {
    const previousState = this.state;
    this.state = newState;
    
    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextAttempt = null;
    }
    
    console.log(`Circuit breaker manually changed from ${previousState} to ${newState}`);
  }

  async shutdown() {
    console.log('Shutting down circuit breaker...');
    
    // Report final metrics
    this.reportMetrics();
    
    // Clear any intervals
    // (in real implementation, clear the metrics collection interval)
    
    console.log('Circuit breaker shutdown complete');
  }
}

// Usage
const circuitBreaker = new ProductionCircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 5000,
  resetTimeout: 30000
});

// Add event handlers
circuitBreaker.on('onOpen', (data) => {
  console.error('🚨 CIRCUIT OPENED:', data);
  // Send alert to operations team
});

circuitBreaker.on('onClose', (data) => {
  console.log('✅ CIRCUIT CLOSED:', data);
});

circuitBreaker.on('onHalfOpen', (data) => {
  console.log('🟡 CIRCUIT HALF-OPEN:', data);
});

// Mock service with intermittent failures
const unreliableService = async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Fail 40% of the time
  if (Math.random() < 0.4) {
    throw new Error('Service temporarily unavailable');
  }
  
  return { data: 'Service response', timestamp: new Date().toISOString() };
};

// Test the circuit breaker
async function testCircuitBreaker() {
  for (let i = 0; i < 10; i++) {
    try {
      const result = await circuitBreaker.call(unreliableService);
      console.log(`Call ${i} succeeded:`, result.data);
    } catch (error) {
      console.log(`Call ${i} failed:`, error.message);
    } finally {
      console.log(`Call ${i} completed - State:`, circuitBreaker.getState().state);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testCircuitBreaker();

// Monitor state changes
setInterval(() => {
  const state = circuitBreaker.getState();
  console.log('Current state:', state.state, 'Failures:', state.failureCount);
}, 5000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await circuitBreaker.shutdown();
  process.exit(0);
});

// These production-grade `Promise.prototype.finally()` patterns demonstrate:

// 1. **Database connection management** with guaranteed cleanup
// 2. **API rate limiting** with request tracking and queue management
// 3. **File upload handling** with resource cleanup and temp file management
// 4. **Distributed locking** with guaranteed lock release
// 5. **Circuit breaker pattern** with state management and metrics

// Key benefits of `finally()` in production:

// - **Resource cleanup** - Always release connections, files, locks
// - **State management** - Always update circuit states and metrics
// - **Error recovery** - Clean up even when operations fail
// - **Monitoring** - Always log attempts and outcomes
// - **Graceful degradation** - Ensure system stability during failures
// - **Audit trails** - Maintain complete operation logs

// Each implementation includes proper error handling, resource management, monitoring, and follows production best practices for reliability and observability.






























// Here are comprehensive code snippets for Promise Error Handling in JavaScript for Node.js production-grade backend development:

// ## 1. Centralized Error Handling Framework

class AppError extends Error {
  constructor(message, statusCode, errorCode, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, validationErrors = []) {
    super(message, 400, 'VALIDATION_ERROR', { validationErrors });
  }
}

class DatabaseError extends AppError {
  constructor(message, query = null) {
    super(message, 503, 'DATABASE_ERROR', { query });
  }
}

class ExternalServiceError extends AppError {
  constructor(message, service, originalError = null) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', { service, originalError });
  }
}

class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: options.logErrors !== false,
      sendNotifications: options.sendNotifications || false,
      notificationService: options.notificationService || null,
      ...options
    };
    
    this.errorCounts = new Map();
    this.setupProcessHandlers();
  }

  async handleError(error, context = {}) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Increment error count for this type
    const errorType = error.name || 'UnknownError';
    this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);

    try {
      // Log the error
      if (this.options.logErrors) {
        await this.logError(error, errorId, context);
      }

      // Send notifications for critical errors
      if (this.shouldNotify(error)) {
        await this.sendNotification(error, errorId, context);
      }

      // Transform error for client response
      const clientError = this.transformErrorForClient(error);

      return {
        errorId,
        clientError,
        logged: this.options.logErrors,
        notified: this.shouldNotify(error)
      };
    } catch (handlingError) {
      // If error handling fails, log to console as last resort
      console.error('Error handling failed:', handlingError);
      console.error('Original error:', error);
      
      return {
        errorId,
        clientError: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
        logged: false,
        notified: false
      };
    }
  }

  async logError(error, errorId, context) {
    const logEntry = {
      errorId,
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.errorCode,
      statusCode: error.statusCode,
      context: error.context || {},
      additionalContext: context,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Log to different transports based on environment
    if (process.env.NODE_ENV === 'production') {
      // Send to structured logging service
      await this.sendToLogService(logEntry);
    } else {
      // Development logging
      console.error(JSON.stringify(logEntry, null, 2));
    }
  }

  async sendToLogService(logEntry) {
    // Simulate sending to logging service (ELK, Splunk, etc.)
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('📋 LOGGED TO SERVICE:', {
          id: logEntry.errorId,
          type: logEntry.name,
          message: logEntry.message
        });
        resolve();
      }, 10);
    });
  }

  shouldNotify(error) {
    const notifyConditions = [
      !error.isOperational, // All programming errors
      error.statusCode >= 500, // All server errors
      error.name === 'DatabaseError',
      error.name === 'ExternalServiceError'
    ];
    
    return notifyConditions.some(condition => condition) && this.options.sendNotifications;
  }

  async sendNotification(error, errorId, context) {
    if (!this.options.notificationService) return;

    const notification = {
      title: `🚨 ${error.name} occurred`,
      message: error.message,
      errorId,
      severity: this.getErrorSeverity(error),
      context: { ...error.context, ...context },
      timestamp: new Date().toISOString()
    };

    try {
      await this.options.notificationService.send(notification);
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  getErrorSeverity(error) {
    if (error.statusCode >= 500) return 'high';
    if (error.name === 'DatabaseError') return 'critical';
    if (error.name === 'ExternalServiceError') return 'high';
    return 'medium';
  }

  transformErrorForClient(error) {
    if (error.isOperational) {
      return {
        message: error.message,
        code: error.errorCode,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        ...(error.context && { details: error.context })
      };
    }

    // Don't expose internal error details to client
    return {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    };
  }

  setupProcessHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED REJECTION:', reason);
      this.handleError(reason, { type: 'unhandledRejection' })
        .catch(console.error);
    });

    process.on('uncaughtException', (error) => {
      console.error('UNCAUGHT EXCEPTION:', error);
      this.handleError(error, { type: 'uncaughtException' })
        .finally(() => {
          // Graceful shutdown
          process.exit(1);
        });
    });
  }

  getErrorStats() {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      byType: Object.fromEntries(this.errorCounts),
      uptime: process.uptime()
    };
  }
}

// Usage
const errorHandler = new ErrorHandler({
  logErrors: true,
  sendNotifications: true,
  notificationService: {
    send: (notification) => {
      console.log('🔔 NOTIFICATION:', notification);
      return Promise.resolve();
    }
  }
});

// Example service with proper error handling
class UserService {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
  }

  async getUser(userId) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required', [
          { field: 'userId', message: 'User ID must be provided' }
        ]);
      }

      if (userId === 'invalid') {
        throw new DatabaseError('User not found', `SELECT * FROM users WHERE id = '${userId}'`);
      }

      // Simulate successful operation
      return { id: userId, name: 'John Doe' };
    } catch (error) {
      const handlingResult = await this.errorHandler.handleError(error, {
        service: 'UserService',
        method: 'getUser',
        userId
      });

      throw handlingResult.clientError;
    }
  }

  async createUser(userData) {
    try {
      // Validation
      if (!userData.email) {
        throw new ValidationError('Email is required', [
          { field: 'email', message: 'Email must be provided' }
        ]);
      }

      // Simulate external service call
      await this.validateEmailWithExternalService(userData.email);

      return { id: '123', ...userData };
    } catch (error) {
      const handlingResult = await this.errorHandler.handleError(error, {
        service: 'UserService',
        method: 'createUser',
        userData
      });

      throw handlingResult.clientError;
    }
  }

  async validateEmailWithExternalService(email) {
    try {
      // Simulate external service call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() < 0.3) {
            reject(new ExternalServiceError('Email validation service unavailable', 'EmailValidationService'));
          } else {
            resolve();
          }
        }, 100);
      });
    } catch (error) {
      throw error;
    }
  }
}

// Test the error handling
const userService = new UserService(errorHandler);

async function testErrorHandling() {
  try {
    await userService.getUser(''); // Validation error
  } catch (error) {
    console.log('Client received:', error);
  }

  try {
    await userService.getUser('invalid'); // Database error
  } catch (error) {
    console.log('Client received:', error);
  }

  try {
    await userService.createUser({ name: 'John' }); // External service error
  } catch (error) {
    console.log('Client received:', error);
  }

  // Test unhandled rejection
  Promise.reject(new Error('This is an unhandled rejection'));
}

testErrorHandling();

// Monitor error stats
setInterval(() => {
  console.log('Error Stats:', errorHandler.getErrorStats());
}, 10000);

// ## 2. Promise Error Handling Patterns & Utilities

class PromiseErrorHandlers {
  static async withRetry(operation, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      backoff = true,
      retryCondition = () => true,
      onRetry = () => {}
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const result = await operation(attempt);
        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt > retries || !retryCondition(error)) {
          break;
        }

        onRetry(error, attempt, retries);
        
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await this.delay(waitTime);
      }
    }

    throw lastError;
  }

  static async withTimeout(promise, timeoutMs, timeoutError = 'Operation timeout') {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutError));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  static async withCircuitBreaker(operation, circuitBreaker) {
    if (circuitBreaker.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await operation();
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();
      throw error;
    }
  }

  static async allSettledWithLogging(promises, context = 'unknown') {
    const results = await Promise.allSettled(promises);
    
    const rejected = results.filter(result => result.status === 'rejected');
    if (rejected.length > 0) {
      console.warn(`[${context}] ${rejected.length} promises rejected:`, 
        rejected.map(r => r.reason.message));
    }
    
    return results;
  }

  static createAsyncHandler(fn, errorHandler) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (errorHandler) {
          return errorHandler(error, ...args);
        }
        throw error;
      }
    };
  }

  static wrapAsync(controller) {
    return (req, res, next) => {
      Promise.resolve(controller(req, res, next)).catch(next);
    };
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Advanced retry strategies
class RetryStrategies {
  static exponentialBackoff(baseDelay, maxDelay = 30000) {
    return (attempt) => {
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.1 * Math.random(); // Add 10% jitter
      return delay + jitter;
    };
  }

  static linearBackoff(baseDelay, increment = 1000) {
    return (attempt) => baseDelay + (increment * attempt);
  }

  static fixedDelay(delay) {
    return () => delay;
  }
}

// Usage examples
class APIService {
  constructor() {
    this.circuitBreaker = {
      state: 'CLOSED',
      failures: 0,
      recordSuccess: function() {
        this.failures = 0;
        this.state = 'CLOSED';
      },
      recordFailure: function() {
        this.failures++;
        if (this.failures >= 5) {
          this.state = 'OPEN';
          setTimeout(() => {
            this.state = 'HALF_OPEN';
            this.failures = 0;
          }, 60000);
        }
      }
    };
  }

  async fetchWithRetry(url, options = {}) {
    return PromiseErrorHandlers.withRetry(
      async (attempt) => {
        console.log(`Attempt ${attempt + 1} for ${url}`);
        
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      {
        retries: 3,
        delay: 1000,
        backoff: true,
        retryCondition: (error) => {
          // Only retry on 5xx errors or network issues
          return error.message.includes('500') || 
                 error.message.includes('502') ||
                 error.message.includes('503') ||
                 error.message.includes('Network');
        },
        onRetry: (error, attempt, maxRetries) => {
          console.log(`Retry ${attempt}/${maxRetries} after error:`, error.message);
        }
      }
    );
  }

  async fetchWithTimeoutAndRetry(url, options = {}) {
    const operation = () => this.fetchWithRetry(url, options);
    return PromiseErrorHandlers.withTimeout(operation, 10000, 'API request timeout');
  }

  async fetchWithCircuitBreaker(url) {
    const operation = () => this.fetchWithRetry(url);
    return PromiseErrorHandlers.withCircuitBreaker(operation, this.circuitBreaker);
  }

  async batchFetch(urls, options = {}) {
    const { concurrency = 5 } = options;
    
    const batches = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      batches.push(urls.slice(i, i + concurrency));
    }

    const allResults = [];
    
    for (const batch of batches) {
      const batchPromises = batch.map(url =>
        this.fetchWithTimeoutAndRetry(url).catch(error => ({
          url,
          error: error.message,
          success: false
        }))
      );

      const batchResults = await PromiseErrorHandlers.allSettledWithLogging(
        batchPromises,
        'batchFetch'
      );
      
      allResults.push(...batchResults);
      
      // Rate limiting between batches
      await PromiseErrorHandlers.delay(100);
    }

    return allResults;
  }
}

// Test the error handling patterns
const apiService = new APIService();

async function testErrorPatterns() {
  // Test retry with timeout
  try {
    const result = await apiService.fetchWithTimeoutAndRetry('https://httpstat.us/500');
    console.log('Success:', result);
  } catch (error) {
    console.log('Failed after retries:', error.message);
  }

  // Test circuit breaker
  for (let i = 0; i < 10; i++) {
    try {
      await apiService.fetchWithCircuitBreaker('https://httpstat.us/500');
    } catch (error) {
      console.log(`Request ${i + 1}:`, error.message);
    }
  }

  // Test batch operations with error handling
  const urls = [
    'https://httpstat.us/200',
    'https://httpstat.us/404',
    'https://httpstat.us/500',
    'https://httpstat.us/200'
  ];

  const batchResults = await apiService.batchFetch(urls, { concurrency: 2 });
  console.log('Batch results:', batchResults);
}

testErrorPatterns();

// ## 3. Database Operation Error Handling

class DatabaseErrorHandler {
  constructor(pool, errorHandler) {
    this.pool = pool;
    this.errorHandler = errorHandler;
    this.queryMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      slowQueries: 0
    };
  }

  async executeQuery(sql, params = [], options = {}) {
    const { timeout = 10000, retryOnDeadlock = true } = options;
    const startTime = Date.now();
    this.queryMetrics.total++;

    try {
      const result = await PromiseErrorHandlers.withTimeout(
        this.pool.query(sql, params),
        timeout,
        `Query timeout after ${timeout}ms`
      );

      const duration = Date.now() - startTime;
      this.queryMetrics.successful++;

      // Log slow queries
      if (duration > 1000) {
        this.queryMetrics.slowQueries++;
        console.warn(`Slow query detected (${duration}ms):`, sql);
      }

      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        duration
      };

    } catch (error) {
      this.queryMetrics.failed++;
      
      const handledError = await this.handleDatabaseError(error, {
        sql,
        params,
        duration: Date.now() - startTime,
        ...options
      });

      throw handledError;
    }
  }

  async handleDatabaseError(error, context) {
    let appError;

    // Map database errors to application errors
    if (error.code === '23505') { // Unique violation
      appError = new ValidationError('Duplicate entry found', [
        { field: this.extractFieldFromConstraint(error), message: 'Must be unique' }
      ]);
    } else if (error.code === '23503') { // Foreign key violation
      appError = new ValidationError('Referenced record not found');
    } else if (error.code === '23502') { // Not null violation
      appError = new ValidationError('Required field missing');
    } else if (error.code === '40001') { // Serialization failure
      appError = new DatabaseError('Transaction conflict, please retry', context.sql);
    } else if (error.code === '40P01') { // Deadlock detected
      appError = new DatabaseError('Deadlock detected', context.sql);
    } else if (error.message.includes('timeout')) {
      appError = new DatabaseError('Database operation timeout', context.sql);
    } else if (error.message.includes('connection')) {
      appError = new DatabaseError('Database connection error', context.sql);
    } else {
      appError = new DatabaseError('Database operation failed', context.sql);
    }

    // Add original error for debugging
    appError.originalError = error;

    const handlingResult = await this.errorHandler.handleError(appError, {
      ...context,
      databaseErrorCode: error.code,
      databaseMessage: error.message
    });

    return handlingResult.clientError;
  }

  extractFieldFromConstraint(error) {
    // Extract field name from constraint error message
    const match = error.detail && error.detail.match(/Key \((.*?)\)=/);
    return match ? match[1] : 'unknown';
  }

  async executeTransaction(operations, options = {}) {
    const client = await this.pool.connect();
    let transactionCompleted = false;

    try {
      await client.query('BEGIN');

      const results = [];
      for (const operation of operations) {
        const result = await this.executeQueryWithClient(client, operation.sql, operation.params, options);
        results.push(result);
      }

      await client.query('COMMIT');
      transactionCompleted = true;

      return results;

    } catch (error) {
      if (!transactionCompleted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async executeQueryWithClient(client, sql, params, options) {
    return PromiseErrorHandlers.withRetry(
      async (attempt) => {
        try {
          const result = await client.query(sql, params);
          return {
            success: true,
            data: result.rows,
            rowCount: result.rowCount
          };
        } catch (error) {
          // Only retry on deadlock or serialization failures
          if (error.code === '40P01' || error.code === '40001') {
            throw error;
          }
          // For other errors, don't retry
          throw error;
        }
      },
      {
        retries: 3,
        delay: 100,
        backoff: true,
        retryCondition: (error) => {
          return error.code === '40P01' || error.code === '40001'; // Deadlock or serialization
        }
      }
    );
  }

  async batchInsert(table, records, options = {}) {
    const { batchSize = 100, onProgress } = options;
    const batches = [];

    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    const results = {
      total: records.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        const placeholders = batch.map((_, index) => {
          const offset = index * Object.keys(records[0]).length;
          const values = Object.keys(records[0]).map((_, j) => `$${offset + j + 1}`);
          return `(${values.join(', ')})`;
        }).join(', ');

        const values = batch.flatMap(record => Object.values(record));
        const columns = Object.keys(records[0]).join(', ');

        const sql = `INSERT INTO ${table} (${columns}) VALUES ${placeholders}`;
        
        await this.executeQuery(sql, values);
        results.successful += batch.length;

      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: i,
          error: error.message,
          records: batch.length
        });

        // Continue with next batch even if one fails
        console.error(`Batch ${i} failed:`, error.message);
      }

      if (onProgress) {
        onProgress({
          completed: (i + 1) * batchSize,
          total: records.length,
          successful: results.successful,
          failed: results.failed
        });
      }
    }

    return results;
  }

  getMetrics() {
    return { ...this.queryMetrics };
  }
}

// Mock database pool for demonstration
const mockPool = {
  connect: () => Promise.resolve({
    query: (sql, params) => {
      // Simulate various database errors
      if (sql.includes('ERROR')) {
        const error = new Error('Database error');
        error.code = '23505'; // Unique violation
        error.detail = 'Key (email)=(test@example.com) already exists';
        throw error;
      }
      
      if (sql.includes('TIMEOUT')) {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), 2000);
        });
      }

      return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
    },
    release: () => {}
  })
};

// Usage
const errorHandler = new ErrorHandler();
const dbHandler = new DatabaseErrorHandler(mockPool, errorHandler);

async function testDatabaseErrorHandling() {
  try {
    // Test successful query
    const result = await dbHandler.executeQuery('SELECT * FROM users WHERE id = $1', [1]);
    console.log('Query success:', result);
  } catch (error) {
    console.log('Query failed:', error);
  }

  try {
    // Test error handling
    await dbHandler.executeQuery('INSERT INTO users ERROR');
  } catch (error) {
    console.log('Handled error:', error);
  }

  // Test batch insert
  const records = Array.from({ length: 250 }, (_, i) => ({
    name: `User ${i}`,
    email: `user${i}@example.com`
  }));

  const batchResult = await dbHandler.batchInsert('users', records, {
    batchSize: 100,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.completed}/${progress.total}`);
    }
  });

  console.log('Batch result:', batchResult);
  console.log('Database metrics:', dbHandler.getMetrics());
}

testDatabaseErrorHandling();

// ## 4. External Service Integration Error Handling

class ExternalServiceClient {
  constructor(serviceName, baseURL, options = {}) {
    this.serviceName = serviceName;
    this.baseURL = baseURL;
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.circuitBreaker = options.circuitBreaker;
    
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      timeouts: 0
    };
    
    this.setupAxiosInstance();
  }

  setupAxiosInstance() {
    this.axios = require('axios').create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Production-Backend/1.0.0',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        this.metrics.requests++;
        console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        this.metrics.successes++;
        console.log(`← ${response.status} ${response.config.url} (${duration}ms)`);
        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || Date.now());
        this.metrics.failures++;
        
        console.log(`← ERROR ${error.config?.url} (${duration}ms):`, error.message);
        
        // Enhance error with additional context
        error.serviceName = this.serviceName;
        error.duration = duration;
        error.url = error.config?.url;
        
        return Promise.reject(error);
      }
    );
  }

  async request(config, options = {}) {
    const {
      retry = true,
      timeout = this.timeout,
      fallback = null
    } = options;

    try {
      if (this.circuitBreaker) {
        return await PromiseErrorHandlers.withCircuitBreaker(
          () => this.makeRequestWithRetry(config, { retry, timeout }),
          this.circuitBreaker
        );
      }

      return await this.makeRequestWithRetry(config, { retry, timeout });
    } catch (error) {
      // If all attempts fail and we have a fallback, use it
      if (fallback) {
        console.warn(`Using fallback for ${this.serviceName} request`);
        return fallback;
      }

      throw this.transformServiceError(error);
    }
  }

  async makeRequestWithRetry(config, options) {
    return PromiseErrorHandlers.withRetry(
      async (attempt) => {
        if (attempt > 0) {
          this.metrics.retries++;
        }

        const response = await this.axios({
          ...config,
          timeout: options.timeout
        });

        return response.data;
      },
      {
        retries: options.retry ? this.retryAttempts : 0,
        delay: 1000,
        backoff: true,
        retryCondition: (error) => this.shouldRetry(error),
        onRetry: (error, attempt) => {
          console.warn(`Retry ${attempt} for ${this.serviceName}:`, error.message);
        }
      }
    );
  }

  shouldRetry(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const retryableCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'];
    
    return (
      retryableStatuses.includes(error.response?.status) ||
      retryableCodes.includes(error.code) ||
      error.message.includes('timeout')
    );
  }

  transformServiceError(error) {
    if (error.response) {
      // Server responded with error status
      return new ExternalServiceError(
        `Service ${this.serviceName} returned ${error.response.status}`,
        this.serviceName,
        {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        }
      );
    } else if (error.request) {
      // Request was made but no response received
      return new ExternalServiceError(
        `Service ${this.serviceName} unavailable`,
        this.serviceName,
        { code: error.code, message: error.message }
      );
    } else {
      // Something else happened
      return new ExternalServiceError(
        `Error calling ${this.serviceName}: ${error.message}`,
        this.serviceName,
        { message: error.message }
      );
    }
  }

  async get(url, options = {}) {
    return this.request({ method: 'GET', url }, options);
  }

  async post(url, data, options = {}) {
    return this.request({ method: 'POST', url, data }, options);
  }

  async put(url, data, options = {}) {
    return this.request({ method: 'PUT', url, data }, options);
  }

  async delete(url, options = {}) {
    return this.request({ method: 'DELETE', url }, options);
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// Service Orchestrator with Error Handling
class ServiceOrchestrator {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.services = new Map();
    this.dependencyGraph = new Map();
  }

  registerService(name, serviceClient) {
    this.services.set(name, serviceClient);
  }

  addDependency(service, dependsOn) {
    if (!this.dependencyGraph.has(service)) {
      this.dependencyGraph.set(service, new Set());
    }
    this.dependencyGraph.get(service).add(dependsOn);
  }

  async callService(serviceName, method, ...args) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    try {
      // Check dependencies
      await this.checkDependencies(serviceName);

      const result = await service[method](...args);
      return result;
    } catch (error) {
      const handlingResult = await this.errorHandler.handleError(error, {
        service: serviceName,
        method,
        args
      });

      throw handlingResult.clientError;
    }
  }

  async checkDependencies(serviceName) {
    const dependencies = this.dependencyGraph.get(serviceName);
    if (!dependencies) return;

    for (const dependency of dependencies) {
      const dependencyService = this.services.get(dependency);
      if (!dependencyService) {
        throw new Error(`Dependency ${dependency} for ${serviceName} not found`);
      }

      // In a real implementation, you might check if the dependency is healthy
      console.log(`Checked dependency: ${dependency} for ${serviceName}`);
    }
  }

  async executeWithFallback(primaryService, fallbackService, method, ...args) {
    try {
      return await this.callService(primaryService, method, ...args);
    } catch (error) {
      console.warn(`Primary service ${primaryService} failed, using fallback ${fallbackService}`);
      
      try {
        return await this.callService(fallbackService, method, ...args);
      } catch (fallbackError) {
        throw new Error(`Both primary and fallback services failed: ${error.message}, ${fallbackError.message}`);
      }
    }
  }

  async parallelCall(serviceCalls, options = {}) {
    const { failFast = false } = options;
    
    const promises = serviceCalls.map(call =>
      this.callService(call.service, call.method, ...call.args)
        .then(result => ({ service: call.service, success: true, result }))
        .catch(error => ({ service: call.service, success: false, error }))
    );

    const results = await Promise.allSettled(promises);
    
    const successful = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value);
    
    const failed = results
      .filter(r => r.status === 'fulfilled' && !r.value.success)
      .map(r => r.value);

    if (failFast && failed.length > 0) {
      throw new Error(`Parallel call failed: ${failed[0].error.message}`);
    }

    return {
      successful,
      failed,
      allSucceeded: failed.length === 0
    };
  }
}

// Usage example
const errorHandler = new ErrorHandler();

// Create service clients
const userService = new ExternalServiceClient('UserService', 'https://users.api.example.com');
const paymentService = new ExternalServiceClient('PaymentService', 'https://payments.api.example.com');
const notificationService = new ExternalServiceClient('NotificationService', 'https://notifications.api.example.com');

// Create orchestrator
const orchestrator = new ServiceOrchestrator(errorHandler);
orchestrator.registerService('users', userService);
orchestrator.registerService('payments', paymentService);
orchestrator.registerService('notifications', notificationService);

// Define dependencies
orchestrator.addDependency('payments', 'users');
orchestrator.addDependency('notifications', 'users');

async function testServiceOrchestration() {
  try {
    // Single service call
    const user = await orchestrator.callService('users', 'get', '/users/123');
    console.log('User:', user);
  } catch (error) {
    console.log('Service call failed:', error);
  }

  // Parallel calls
  const parallelResults = await orchestrator.parallelCall([
    { service: 'users', method: 'get', args: ['/users/123'] },
    { service: 'payments', method: 'get', args: ['/payments/456'] }
  ]);

  console.log('Parallel results:', parallelResults);

  // Service metrics
  console.log('UserService metrics:', userService.getMetrics());
  console.log('PaymentService metrics:', paymentService.getMetrics());
}

testServiceOrchestration();

// ## 5. Comprehensive Error Recovery Strategies

class ErrorRecoveryManager {
  constructor(strategies = {}) {
    this.strategies = {
      retry: strategies.retry || this.defaultRetryStrategy,
      fallback: strategies.fallback || this.defaultFallbackStrategy,
      circuitBreaker: strategies.circuitBreaker || this.defaultCircuitBreaker,
      ...strategies
    };
    
    this.recoveryAttempts = new Map();
    this.successfulRecoveries = new Map();
  }

  async executeWithRecovery(operation, context = {}, recoveryOptions = {}) {
    const {
      maxRecoveryAttempts = 3,
      recoveryTimeout = 30000,
      enableFallback = true,
      enableRetry = true
    } = recoveryOptions;

    const operationId = context.operationId || `op_${Date.now()}`;
    let lastError;

    try {
      // Initial attempt
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Operation ${operationId} failed:`, error.message);

      // Recovery attempts
      for (let attempt = 1; attempt <= maxRecoveryAttempts; attempt++) {
        try {
          console.log(`Recovery attempt ${attempt} for ${operationId}`);
          
          const recoveredResult = await this.attemptRecovery(
            operation, 
            error, 
            { ...context, attempt, operationId },
            recoveryOptions
          );

          this.recordSuccessfulRecovery(operationId, attempt);
          console.log(`Recovery successful for ${operationId} on attempt ${attempt}`);
          
          return recoveredResult;
        } catch (recoveryError) {
          lastError = recoveryError;
          console.warn(`Recovery attempt ${attempt} failed:`, recoveryError.message);
          
          if (attempt === maxRecoveryAttempts) {
            this.recordFailedRecovery(operationId, maxRecoveryAttempts);
          }
        }
      }

      // All recovery attempts failed
      throw this.wrapWithRecoveryContext(lastError, {
        operationId,
        recoveryAttempts: maxRecoveryAttempts,
        context
      });
    }
  }

  async attemptRecovery(operation, originalError, context, options) {
    const recoveryPromises = [];

    // Try retry strategy
    if (options.enableRetry) {
      recoveryPromises.push(
        this.strategies.retry(operation, originalError, context)
          .then(result => ({ strategy: 'retry', result }))
      );
    }

    // Try fallback strategy
    if (options.enableFallback) {
      recoveryPromises.push(
        this.strategies.fallback(operation, originalError, context)
          .then(result => ({ strategy: 'fallback', result }))
      );
    }

    // Wait for first successful recovery
    if (recoveryPromises.length === 0) {
      throw new Error('No recovery strategies enabled');
    }

    return PromiseErrorHandlers.withTimeout(
      Promise.any(recoveryPromises),
      options.recoveryTimeout || 30000
    ).then(winner => winner.result);
  }

  defaultRetryStrategy = async (operation, error, context) => {
    const { attempt } = context;
    
    // Only retry on network or temporary errors
    if (!this.isRetryableError(error)) {
      throw new Error('Error not retryable');
    }

    // Exponential backoff with jitter
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = delay * 0.1 * Math.random();
    
    await PromiseErrorHandlers.delay(delay + jitter);

    return operation();
  };

  defaultFallbackStrategy = async (operation, error, context) => {
    // Implement fallback logic based on operation type
    const fallbackMap = {
      'DatabaseError': this.databaseFallback,
      'ExternalServiceError': this.serviceFallback,
      'NetworkError': this.networkFallback
    };

    const fallbackHandler = fallbackMap[error.name] || this.genericFallback;
    return fallbackHandler(operation, error, context);
  };

  databaseFallback = async (operation, error, context) => {
    // Try alternative database connection
    // Use cached data
    // Return default values
    console.log('Using database fallback for:', context.operationId);
    throw new Error('Database fallback not implemented');
  };

  serviceFallback = async (operation, error, context) => {
    // Use alternative service
    // Return cached response
    // Use default values
    console.log('Using service fallback for:', context.operationId);
    throw new Error('Service fallback not implemented');
  };

  networkFallback = async (operation, error, context) => {
    // Use local cache
    // Queue for later processing
    console.log('Using network fallback for:', context.operationId);
    throw new Error('Network fallback not implemented');
  };

  genericFallback = async (operation, error, context) => {
    // Last resort fallback
    console.log('Using generic fallback for:', context.operationId);
    throw new Error('No fallback available');
  };

  isRetryableError(error) {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /deadlock/i,
      /temporary/i,
      /busy/i,
      /rate.?limit/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || 
      pattern.test(error.name)
    );
  }

  wrapWithRecoveryContext(error, recoveryContext) {
    const recoveryError = new Error(
      `Operation failed after ${recoveryContext.recoveryAttempts} recovery attempts: ${error.message}`
    );
    recoveryError.name = 'RecoveryFailedError';
    recoveryError.originalError = error;
    recoveryError.recoveryContext = recoveryContext;
    recoveryError.isOperational = true;
    
    return recoveryError;
  }

  recordSuccessfulRecovery(operationId, attempt) {
    const key = `${operationId}_success`;
    this.successfulRecoveries.set(key, {
      operationId,
      attempt,
      timestamp: new Date().toISOString()
    });
  }

  recordFailedRecovery(operationId, attempts) {
    const key = `${operationId}_fail`;
    this.recoveryAttempts.set(key, {
      operationId,
      attempts,
      timestamp: new Date().toISOString()
    });
  }

  getRecoveryStats() {
    return {
      totalRecoveryAttempts: this.recoveryAttempts.size,
      successfulRecoveries: this.successfulRecoveries.size,
      recoveryRate: this.successfulRecoveries.size / 
                   (this.recoveryAttempts.size + this.successfulRecoveries.size) || 0,
      recentFailures: Array.from(this.recoveryAttempts.values())
        .slice(-10)
        .map(f => ({ operationId: f.operationId, attempts: f.attempts }))
    };
  }
}

// Usage with comprehensive error recovery
class ResilientService {
  constructor(recoveryManager, errorHandler) {
    this.recoveryManager = recoveryManager;
    this.errorHandler = errorHandler;
  }

  async processOrder(orderData) {
    const operationId = `order_${orderData.id}`;
    
    return this.recoveryManager.executeWithRecovery(
      async () => {
        // Main operation logic
        await this.validateOrder(orderData);
        await this.processPayment(orderData);
        await this.updateInventory(orderData);
        await this.sendConfirmation(orderData);
        
        return { success: true, orderId: orderData.id };
      },
      { operationId, service: 'OrderService', method: 'processOrder' },
      {
        maxRecoveryAttempts: 2,
        recoveryTimeout: 15000,
        enableFallback: true,
        enableRetry: true
      }
    ).catch(async (error) => {
      // Final error handling if recovery fails
      const handlingResult = await this.errorHandler.handleError(error, {
        operationId,
        orderData,
        finalAttempt: true
      });

      throw handlingResult.clientError;
    });
  }

  async validateOrder(orderData) {
    // Simulate validation that might fail
    await PromiseErrorHandlers.delay(100);
    if (Math.random() < 0.1) {
      throw new ValidationError('Order validation failed');
    }
  }

  async processPayment(orderData) {
    // Simulate payment processing that might fail
    await PromiseErrorHandlers.delay(200);
    if (Math.random() < 0.2) {
      throw new ExternalServiceError('Payment processing failed', 'PaymentGateway');
    }
  }

  async updateInventory(orderData) {
    // Simulate inventory update that might fail
    await PromiseErrorHandlers.delay(150);
    if (Math.random() < 0.15) {
      throw new DatabaseError('Inventory update failed');
    }
  }

  async sendConfirmation(orderData) {
    // Simulate notification that might fail
    await PromiseErrorHandlers.delay(100);
    if (Math.random() < 0.1) {
      throw new ExternalServiceError('Notification failed', 'EmailService');
    }
  }
}

// Test the recovery system
const recoveryManager = new ErrorRecoveryManager();
const errorHandler = new ErrorHandler();
const resilientService = new ResilientService(recoveryManager, errorHandler);

async function testErrorRecovery() {
  const orders = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, amount: 100 }));

  for (const order of orders) {
    try {
      const result = await resilientService.processOrder(order);
      console.log(`Order ${order.id}: SUCCESS`);
    } catch (error) {
      console.log(`Order ${order.id}: FAILED - ${error.message}`);
    }
  }

  console.log('Recovery stats:', recoveryManager.getRecoveryStats());
}

testErrorRecovery();

// Monitor recovery effectiveness
setInterval(() => {
  console.log('Recovery Statistics:', recoveryManager.getRecoveryStats());
}, 30000);

// These production-grade Promise error handling patterns demonstrate:

// 1. **Centralized error handling** with proper error classification
// 2. **Retry strategies** with exponential backoff and circuit breakers
// 3. **Database error handling** with transaction management
// 4. **External service integration** with timeouts and fallbacks
// 5. **Comprehensive recovery strategies** with multiple fallback mechanisms

// Key features include:

// - **Error classification** (Operational vs Programming errors)
// - **Structured logging** with context and error IDs
// - **Graceful degradation** with fallback mechanisms
// - **Circuit breakers** to prevent cascading failures
// - **Retry logic** with intelligent backoff strategies
// - **Monitoring and metrics** for error tracking
// - **Resource cleanup** in finally blocks
// - **Client-friendly error messages** without exposing internals

// Each implementation follows production best practices for reliability, observability, and maintainability.




























// I'll provide you with comprehensive, production-grade async/await code snippets for Node.js backend development.

// ## 1. Basic Async/Await Patterns

// ### Basic Function with Error Handling
// Basic async function with proper error handling
async function fetchUserData(userId) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error; // Re-throw for higher level handling
    }
}

// ### Multiple Sequential Operations
async function processUserOrder(userId, orderId) {
    try {
        // Sequential operations
        const user = await User.findById(userId);
        const order = await Order.findById(orderId);
        const inventory = await Inventory.checkAvailability(order.items);
        
        return { user, order, inventory };
    } catch (error) {
        console.error('Order processing failed:', error);
        throw new Error('Order processing failed');
    }
}

// ## 2. Parallel Execution Patterns

// ### Promise.all for Independent Operations
async function getUserDashboard(userId) {
    try {
        const [user, orders, notifications, preferences] = await Promise.all([
            User.findById(userId),
            Order.find({ userId }),
            Notification.find({ userId, read: false }),
            UserPreference.findById(userId)
        ]);

        return {
            user,
            orders: orders || [],
            notifications: notifications || [],
            preferences: preferences || {}
        };
    } catch (error) {
        console.error('Dashboard data fetch failed:', error);
        throw new Error('Failed to load dashboard');
    }
}

// ### Promise.allSettled for Partial Failures
async function getAggregatedUserData(userId) {
    const results = await Promise.allSettled([
        User.findById(userId),
        UserProfile.findById(userId),
        UserActivity.find({ userId }).limit(10),
        UserSettings.findById(userId)
    ]);

    const [user, profile, activities, settings] = results.map((result, index) => {
        if (result.status === 'rejected') {
            console.warn(`Operation ${index} failed:`, result.reason);
            return null; // or appropriate default
        }
        return result.value;
    });

    return { user, profile, activities, settings };
}

// ## 3. Advanced Control Flow Patterns

// ### Retry Mechanism with Exponential Backoff
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) break;
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms:`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// Usage
async function fetchExternalAPI() {
    return await retryWithBackoff(
        async () => {
            const response = await axios.get('https://api.example.com/data');
            return response.data;
        },
        3, // maxRetries
        1000 // baseDelay
    );
}

// ### Timeout Wrapper
function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise])
        .finally(() => clearTimeout(timeoutId));
}

// Usage
async function fetchWithTimeout() {
    try {
        const data = await withTimeout(
            fetchUserData(userId),
            5000, // 5 second timeout
            'User data fetch timeout'
        );
        return data;
    } catch (error) {
        if (error.message === 'User data fetch timeout') {
            // Handle timeout specifically
            throw new Error('Service unavailable. Please try again.');
        }
        throw error;
    }
}

// ## 4. Database Operations Patterns

// ### Transaction Handling
async function transferFunds(senderId, receiverId, amount) {
    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        // Deduct from sender
        const sender = await User.findById(senderId).session(session);
        if (sender.balance < amount) {
            throw new Error('Insufficient funds');
        }
        sender.balance -= amount;
        await sender.save();
        
        // Add to receiver
        const receiver = await User.findById(receiverId).session(session);
        receiver.balance += amount;
        await receiver.save();
        
        // Create transaction record
        await Transaction.create([{
            from: senderId,
            to: receiverId,
            amount,
            type: 'transfer'
        }], { session });
        
        await session.commitTransaction();
        
        return { success: true, newBalance: sender.balance };
    } catch (error) {
        await session.abortTransaction();
        console.error('Fund transfer failed:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ### Batch Processing with Concurrency Control
async function processBatchWithConcurrency(items, processorFn, concurrency = 5) {
    const results = [];
    const errors = [];
    
    // Process items in batches
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (item, index) => {
            try {
                const result = await processorFn(item);
                return { success: true, data: result, item };
            } catch (error) {
                console.error(`Processing failed for item ${item.id}:`, error);
                return { success: false, error, item };
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
            if (result.success) {
                results.push(result.data);
            } else {
                errors.push({
                    item: result.item,
                    error: result.error.message
                });
            }
        });
        
        // Optional: Add delay between batches to avoid overwhelming systems
        if (i + concurrency < items.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return { results, errors };
}

// ## 5. API Route Handlers

// ### Express.js Route with Async/Await
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// User registration with comprehensive error handling
const registerUser = asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Input validation
    if (!email || !password || !name) {
        return res.status(400).json({
            success: false,
            error: 'Email, password, and name are required'
        });
    }

    try {
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists with this email'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            email,
            password: hashedPassword,
            name
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from response
        const userResponse = { ...user.toObject() };
        delete userResponse.password;

        res.status(201).json({
            success: true,
            data: {
                user: userResponse,
                token
            }
        });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during registration'
        });
    }
});

// ## 6. Error Handling Middleware

// ### Global Error Handler
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error('Error:', err);

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
        error = new AppError(message.join(', '), 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        error = new AppError('Token expired', 401);
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error'
    });
};

module.exports = errorHandler;

// ## 7. Utility Functions

// ### Async Filter and Map
async function asyncFilter(array, predicate) {
    const results = await Promise.all(array.map(predicate));
    return array.filter((_, index) => results[index]);
}

async function asyncMap(array, mapper) {
    return Promise.all(array.map(mapper));
}

// Usage example
async function getActiveUsers(userIds) {
    return await asyncFilter(userIds, async (userId) => {
        const user = await User.findById(userId);
        return user && user.isActive;
    });
}

// ### Circuit Breaker Pattern
class CircuitBreaker {
    constructor(failureThreshold = 5, resetTimeout = 60000) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async call(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
}

// Usage
const databaseBreaker = new CircuitBreaker();

async function safeDatabaseOperation(query) {
    return await databaseBreaker.call(() => database.query(query));
}

// ## 8. Production Best Practices

// ### Configuration and Environment
// config/asyncConfig.js
const asyncConfig = {
    defaultTimeout: 30000,
    retryAttempts: 3,
    batchSize: 100,
    concurrency: {
        database: 10,
        api: 5,
        fileProcessing: 3
    }
};

// Async operation with config
async function configuredAsyncOperation(data) {
    return await withTimeout(
        processData(data),
        asyncConfig.defaultTimeout,
        'Operation timeout'
    );
}

// ### Logging and Monitoring
const logger = require('./logger');

async function monitoredAsyncOperation(operationName, operation) {
    const startTime = Date.now();
    
    try {
        logger.info(`Starting async operation: ${operationName}`);
        const result = await operation();
        const duration = Date.now() - startTime;
        
        logger.info(`Async operation completed: ${operationName}`, {
            duration,
            success: true
        });
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Async operation failed: ${operationName}`, {
            duration,
            error: error.message,
            stack: error.stack
        });
        
        throw error;
    }
}

// These patterns provide a solid foundation for production-grade async/await usage in Node.js backend development. They emphasize error handling, performance, monitoring, and maintainability.






























// # Promise.withResolvers() - Production Grade Code Snippets

// ## 1. Basic Promise.withResolvers() Patterns

// ### Basic Implementation and Polyfill
// Polyfill for Node.js versions < 21 (if needed)
if (!Promise.withResolvers) {
    Promise.withResolvers = function() {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

// Basic usage pattern
function createAsyncOperation() {
    const { promise, resolve, reject } = Promise.withResolvers();
    
    // Simulate async work
    setTimeout(() => {
        const success = Math.random() > 0.3;
        if (success) {
            resolve({ data: 'Operation completed', timestamp: Date.now() });
        } else {
            reject(new Error('Operation failed'));
        }
    }, 1000);
    
    return promise;
}

// ### Event Emitter to Promise Conversion
const EventEmitter = require('events');

class AsyncEventProcessor {
    constructor() {
        this.pendingRequests = new Map();
    }
    
    // Convert event-based API to promise-based
    waitForEvent(eventName, timeoutMs = 5000) {
        const { promise, resolve, reject } = Promise.withResolvers();
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
            this.pendingRequests.delete(eventName);
        }, timeoutMs);
        
        this.pendingRequests.set(eventName, { resolve, reject, timeoutId });
        return promise;
    }
    
    emitEvent(eventName, data) {
        const request = this.pendingRequests.get(eventName);
        if (request) {
            clearTimeout(request.timeoutId);
            request.resolve(data);
            this.pendingRequests.delete(eventName);
        }
    }
    
    emitError(eventName, error) {
        const request = this.pendingRequests.get(eventName);
        if (request) {
            clearTimeout(request.timeoutId);
            request.reject(error);
            this.pendingRequests.delete(eventName);
        }
    }
}

// ## 2. Advanced Control Flow Patterns

// ### Debounced Promise Queue
class DebouncedPromiseQueue {
    constructor(delayMs = 100) {
        this.delayMs = delayMs;
        this.queue = [];
        this.timeoutId = null;
        this.currentBatch = Promise.withResolvers();
    }
    
    add(operation) {
        this.queue.push(operation);
        
        if (!this.timeoutId) {
            this.timeoutId = setTimeout(() => this.processBatch(), this.delayMs);
        }
        
        return this.currentBatch.promise.then(results => 
            results[this.queue.length - 1]
        );
    }
    
    async processBatch() {
        const batch = this.queue;
        this.queue = [];
        this.timeoutId = null;
        
        // Create new batch for next operations
        this.currentBatch = Promise.withResolvers();
        
        try {
            const results = await Promise.all(batch.map(op => op()));
            this.currentBatch.resolve(results);
        } catch (error) {
            this.currentBatch.reject(error);
        }
    }
}

// Usage
const queue = new DebouncedPromiseQueue(50);

async function debouncedDatabaseLookup(key) {
    return queue.add(() => database.get(key));
}

// ### Promise Pool with Resource Management
class PromisePool {
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
        this.active = new Set();
        this.queue = [];
        this.resolvers = Promise.withResolvers();
        this.completed = 0;
        this.total = 0;
    }
    
    async add(task) {
        this.total++;
        
        if (this.active.size >= this.maxConcurrent) {
            // Queue the task
            const { promise, resolve } = Promise.withResolvers();
            this.queue.push({ task, resolve });
            return promise;
        }
        
        return this.execute(task);
    }
    
    async execute(task) {
        const taskId = Symbol('task');
        this.active.add(taskId);
        
        try {
            const result = await task();
            this.completed++;
            this.checkCompletion();
            return result;
        } catch (error) {
            this.completed++;
            this.checkCompletion();
            throw error;
        } finally {
            this.active.delete(taskId);
            this.processQueue();
        }
    }
    
    processQueue() {
        if (this.queue.length > 0 && this.active.size < this.maxConcurrent) {
            const { task, resolve } = this.queue.shift();
            resolve(this.execute(task));
        }
    }
    
    checkCompletion() {
        if (this.completed === this.total) {
            this.resolvers.resolve();
        }
    }
    
    async waitForCompletion() {
        return this.resolvers.promise;
    }
}

// Usage
const pool = new PromisePool(3);

async function processBatch(tasks) {
    const results = [];
    const errors = [];
    
    for (const task of tasks) {
        try {
            const result = await pool.add(task);
            results.push(result);
        } catch (error) {
            errors.push({ task, error });
        }
    }
    
    await pool.waitForCompletion();
    return { results, errors };
}

// ## 3. Database Operation Patterns

// ### Transaction Management with Manual Control
class TransactionManager {
    constructor() {
        this.activeTransactions = new Map();
    }
    
    beginTransaction(transactionId) {
        const { promise, resolve, reject } = Promise.withResolvers();
        
        this.activeTransactions.set(transactionId, {
            promise,
            resolve,
            reject,
            status: 'pending'
        });
        
        // Simulate transaction start
        setTimeout(() => {
            const transaction = this.activeTransactions.get(transactionId);
            if (transaction && transaction.status === 'pending') {
                transaction.resolve(transactionId);
            }
        }, 100);
        
        return promise;
    }
    
    commitTransaction(transactionId) {
        const transaction = this.activeTransactions.get(transactionId);
        if (transaction) {
            transaction.resolve(`Transaction ${transactionId} committed`);
            this.activeTransactions.delete(transactionId);
        }
    }
    
    rollbackTransaction(transactionId, error) {
        const transaction = this.activeTransactions.get(transactionId);
        if (transaction) {
            transaction.reject(error || new Error(`Transaction ${transactionId} rolled back`));
            this.activeTransactions.delete(transactionId);
        }
    }
    
    getTransactionPromise(transactionId) {
        const transaction = this.activeTransactions.get(transactionId);
        return transaction ? transaction.promise : null;
    }
}

// ### Connection Pool with Promise-based Acquisition
class DatabaseConnectionPool {
    constructor(poolSize = 10) {
        this.poolSize = poolSize;
        this.available = Array.from({ length: poolSize }, (_, i) => 
            this.createConnection(i)
        );
        this.waitingQueue = [];
        this.acquired = new Set();
    }
    
    createConnection(id) {
        return { id, connected: true, lastUsed: Date.now() };
    }
    
    async acquire() {
        if (this.available.length > 0) {
            const connection = this.available.pop();
            this.acquired.add(connection);
            return connection;
        }
        
        // No connections available, add to waiting queue
        const { promise, resolve } = Promise.withResolvers();
        this.waitingQueue.push(resolve);
        
        return promise;
    }
    
    release(connection) {
        this.acquired.delete(connection);
        
        if (this.waitingQueue.length > 0) {
            const resolve = this.waitingQueue.shift();
            this.acquired.add(connection);
            resolve(connection);
        } else {
            this.available.push(connection);
        }
    }
    
    async withConnection(callback) {
        const connection = await this.acquire();
        try {
            return await callback(connection);
        } finally {
            this.release(connection);
        }
    }
}

// ## 4. API and Request Handling

// ### HTTP Request/Response Coordination
class RequestCoordinator {
    constructor() {
        this.pendingRequests = new Map();
        this.requestTimeout = 30000;
    }
    
    async sendRequest(requestId, requestData) {
        // Check if request already pending
        if (this.pendingRequests.has(requestId)) {
            return this.pendingRequests.get(requestId).promise;
        }
        
        const { promise, resolve, reject } = Promise.withResolvers();
        
        const timeoutId = setTimeout(() => {
            this.cleanupRequest(requestId);
            reject(new Error(`Request timeout: ${requestId}`));
        }, this.requestTimeout);
        
        this.pendingRequests.set(requestId, { resolve, reject, timeoutId, requestData });
        
        // Send the actual request
        this.doSendRequest(requestId, requestData);
        
        return promise;
    }
    
    handleResponse(requestId, responseData) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeoutId);
            request.resolve(responseData);
            this.pendingRequests.delete(requestId);
        }
    }
    
    handleError(requestId, error) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeoutId);
            request.reject(error);
            this.pendingRequests.delete(requestId);
        }
    }
    
    cleanupRequest(requestId) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeoutId);
            this.pendingRequests.delete(requestId);
        }
    }
    
    doSendRequest(requestId, requestData) {
        // Implementation for actual request sending
        console.log('Sending request:', requestId, requestData);
    }
}

// ### WebSocket Message Correlation
class WebSocketMessageHandler {
    constructor(websocket) {
        this.websocket = websocket;
        this.pendingMessages = new Map();
        this.messageId = 0;
        
        this.websocket.on('message', (data) => {
            this.handleIncomingMessage(JSON.parse(data));
        });
    }
    
    sendWithResponse(message) {
        const messageId = ++this.messageId;
        const { promise, resolve, reject } = Promise.withResolvers();
        
        const timeoutId = setTimeout(() => {
            this.pendingMessages.delete(messageId);
            reject(new Error('WebSocket response timeout'));
        }, 10000);
        
        this.pendingMessages.set(messageId, { resolve, reject, timeoutId });
        
        this.websocket.send(JSON.stringify({
            ...message,
            messageId,
            timestamp: Date.now()
        }));
        
        return promise;
    }
    
    handleIncomingMessage(data) {
        if (data.responseTo) {
            const pending = this.pendingMessages.get(data.responseTo);
            if (pending) {
                clearTimeout(pending.timeoutId);
                
                if (data.error) {
                    pending.reject(new Error(data.error));
                } else {
                    pending.resolve(data);
                }
                
                this.pendingMessages.delete(data.responseTo);
            }
        }
    }
}

// ## 5. File Processing and Streams

// ### Stream Completion Detection
const fs = require('fs');
const { pipeline } = require('stream/promises');

class StreamProcessor {
    static async processFileWithCompletion(inputPath, outputPath, transformer) {
        const { promise, resolve, reject } = Promise.withResolvers();
        
        const readStream = fs.createReadStream(inputPath);
        const writeStream = fs.createWriteStream(outputPath);
        
        let completed = false;
        
        const handleCompletion = (error) => {
            if (completed) return;
            completed = true;
            
            if (error) {
                reject(error);
            } else {
                resolve({ inputPath, outputPath, bytesProcessed: writeStream.bytesWritten });
            }
        };
        
        // Use pipeline for proper error handling and cleanup
        pipeline(readStream, transformer, writeStream)
            .then(() => handleCompletion(null))
            .catch(handleCompletion);
        
        return promise;
    }
    
    static createTransformStream(transformFn) {
        const { Transform } = require('stream');
        
        return new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                try {
                    const result = transformFn(chunk);
                    callback(null, result);
                } catch (error) {
                    callback(error);
                }
            }
        });
    }
}

// ### Batch File Processor
class BatchFileProcessor {
    constructor(batchSize = 10) {
        this.batchSize = batchSize;
        this.currentBatch = [];
        this.batchResolvers = null;
    }
    
    async processFile(filePath) {
        if (!this.batchResolvers) {
            this.startNewBatch();
        }
        
        this.currentBatch.push(filePath);
        
        if (this.currentBatch.length >= this.batchSize) {
            return this.flushBatch();
        }
        
        // Schedule batch flush if not full within timeout
        setTimeout(() => this.flushBatchIfPending(), 1000);
        
        return this.batchResolvers.promise.then(results => 
            results[this.currentBatch.length - 1]
        );
    }
    
    startNewBatch() {
        this.batchResolvers = Promise.withResolvers();
        this.currentBatch = [];
    }
    
    async flushBatch() {
        if (!this.batchResolvers || this.currentBatch.length === 0) {
            return;
        }
        
        const batch = this.currentBatch;
        const resolvers = this.batchResolvers;
        
        this.startNewBatch();
        
        try {
            const results = await Promise.all(
                batch.map(filePath => this.processSingleFile(filePath))
            );
            resolvers.resolve(results);
        } catch (error) {
            resolvers.reject(error);
        }
    }
    
    async flushBatchIfPending() {
        if (this.currentBatch.length > 0) {
            await this.flushBatch();
        }
    }
    
    async processSingleFile(filePath) {
        // Actual file processing logic
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ filePath, processed: true, size: Math.random() * 1000 });
            }, 100);
        });
    }
}

// ## 6. Testing and Mocking Patterns

// ### Mock Async Operations for Testing
class MockAsyncService {
    constructor() {
        this.operations = new Map();
        this.delay = 100;
    }
    
    createMockOperation(operationId, shouldSucceed = true) {
        const { promise, resolve, reject } = Promise.withResolvers();
        
        this.operations.set(operationId, { resolve, reject });
        
        setTimeout(() => {
            if (shouldSucceed) {
                resolve({ id: operationId, status: 'completed', data: 'mock data' });
            } else {
                reject(new Error(`Mock error for operation: ${operationId}`));
            }
            this.operations.delete(operationId);
        }, this.delay);
        
        return promise;
    }
    
    // For testing - manually resolve/reject operations
    manuallyResolve(operationId, data) {
        const operation = this.operations.get(operationId);
        if (operation) {
            operation.resolve(data);
            this.operations.delete(operationId);
        }
    }
    
    manuallyReject(operationId, error) {
        const operation = this.operations.get(operationId);
        if (operation) {
            operation.reject(error);
            this.operations.delete(operationId);
        }
    }
}

// ### Test Utility for Async Coordination
class AsyncTestCoordinator {
    constructor() {
        this.operations = new Map();
    }
    
    createOperation(name) {
        const { promise, resolve, reject } = Promise.withResolvers();
        
        this.operations.set(name, {
            promise,
            resolve,
            reject,
            createdAt: Date.now(),
            completed: false
        });
        
        return promise;
    }
    
    resolveOperation(name, value) {
        const operation = this.operations.get(name);
        if (operation && !operation.completed) {
            operation.completed = true;
            operation.resolve(value);
        }
    }
    
    rejectOperation(name, error) {
        const operation = this.operations.get(name);
        if (operation && !operation.completed) {
            operation.completed = true;
            operation.reject(error);
        }
    }
    
    async waitForOperation(name, timeout = 5000) {
        const operation = this.operations.get(name);
        if (!operation) {
            throw new Error(`Operation not found: ${name}`);
        }
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout waiting for operation: ${name}`)), timeout);
        });
        
        return Promise.race([operation.promise, timeoutPromise]);
    }
    
    getPendingOperations() {
        return Array.from(this.operations.entries())
            .filter(([_, op]) => !op.completed)
            .map(([name]) => name);
    }
}

// ## 7. Production Utility Classes

// ### Rate Limiter with Promise Queue
class RateLimiter {
    constructor(requestsPerSecond = 10) {
        this.requestsPerSecond = requestsPerSecond;
        this.queue = [];
        this.processing = false;
        this.lastProcessed = 0;
    }
    
    async execute(fn) {
        const { promise, resolve, reject } = Promise.withResolvers();
        
        this.queue.push({ fn, resolve, reject });
        
        if (!this.processing) {
            this.processQueue();
        }
        
        return promise;
    }
    
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLast = now - this.lastProcessed;
            const minInterval = 1000 / this.requestsPerSecond;
            
            if (timeSinceLast < minInterval) {
                await new Promise(resolve => 
                    setTimeout(resolve, minInterval - timeSinceLast)
                );
            }
            
            const { fn, resolve, reject } = this.queue.shift();
            this.lastProcessed = Date.now();
            
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }
        
        this.processing = false;
    }
}

// ### Health Check Coordinator
class HealthCheckCoordinator {
    constructor(services) {
        this.services = services;
        this.healthChecks = new Map();
        this.checkInterval = 30000; // 30 seconds
    }
    
    startHealthChecks() {
        this.services.forEach(service => {
            const { promise, resolve, reject } = Promise.withResolvers();
            
            this.healthChecks.set(service.name, {
                promise,
                resolve,
                reject,
                healthy: null,
                lastChecked: null
            });
            
            this.performHealthCheck(service);
        });
        
        // Schedule periodic health checks
        this.intervalId = setInterval(() => {
            this.services.forEach(service => this.performHealthCheck(service));
        }, this.checkInterval);
    }
    
    stopHealthChecks() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    
    async performHealthCheck(service) {
        try {
            const isHealthy = await service.healthCheck();
            
            const healthCheck = this.healthChecks.get(service.name);
            healthCheck.healthy = isHealthy;
            healthCheck.lastChecked = new Date();
            
            if (isHealthy) {
                healthCheck.resolve({ service: service.name, healthy: true });
            } else {
                healthCheck.reject(new Error(`Service ${service.name} is unhealthy`));
            }
            
            // Create new promise for next health check
            const { promise, resolve, reject } = Promise.withResolvers();
            this.healthChecks.set(service.name, {
                promise,
                resolve,
                reject,
                healthy: isHealthy,
                lastChecked: healthCheck.lastChecked
            });
            
        } catch (error) {
            const healthCheck = this.healthChecks.get(service.name);
            healthCheck.healthy = false;
            healthCheck.lastChecked = new Date();
            healthCheck.reject(error);
            
            // Create new promise for next health check
            const { promise, resolve, reject } = Promise.withResolvers();
            this.healthChecks.set(service.name, {
                promise,
                resolve,
                reject,
                healthy: false,
                lastChecked: healthCheck.lastChecked
            });
        }
    }
    
    async waitForHealthyService(serviceName, timeout = 60000) {
        const healthCheck = this.healthChecks.get(serviceName);
        if (!healthCheck) {
            throw new Error(`No health check found for service: ${serviceName}`);
        }
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout waiting for healthy service: ${serviceName}`)), timeout);
        });
        
        return Promise.race([healthCheck.promise, timeoutPromise]);
    }
}

// These production-grade patterns demonstrate how `Promise.withResolvers()` provides cleaner, more maintainable code for managing asynchronous operations where you need explicit control over promise resolution. The patterns emphasize proper error handling, resource management, and coordination between different parts of your application.




























