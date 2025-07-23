import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  lazyConnect: boolean;
  connectTimeout: number;
  commandTimeout: number;
  enableAutoPipelining: boolean;
}

export interface RedisHealth {
  isConnected: boolean;
  isHealthy: boolean;
  connectionAttempts: number;
  lastConnectionTime: Date | null;
  lastError: string | null;
  uptime: number;
  commandsExecuted: number;
  commandsFailed: number;
  lastHealthCheck: Date;
}

export interface FallbackStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// In-memory fallback storage
class MemoryFallbackStorage implements FallbackStorage {
  private storage = new Map<string, { value: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.storage.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.storage.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const item: { value: string; expires?: number } = { value };
    if (ttl) {
      item.expires = Date.now() + ttl * 1000;
    }
    this.storage.set(key, item);
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.storage.get(key);
    if (!item) return false;
    
    if (item.expires && Date.now() > item.expires) {
      this.storage.delete(key);
      return false;
    }
    
    return true;
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  // Cleanup expired items
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.storage.entries()) {
      if (item.expires && now > item.expires) {
        this.storage.delete(key);
      }
    }
  }
}

export class RedisManager extends EventEmitter {
  private redis: Redis | null = null;
  private config: RedisConfig;
  private health: RedisHealth;
  private fallbackStorage: FallbackStorage;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private connectionAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000; // Start with 1 second
  private maxReconnectDelay: number = 30000; // Max 30 seconds
  private startTime: Date;
  private isShuttingDown: boolean = false;

  constructor(config: Partial<RedisConfig> = {}) {
    super();
    
    this.startTime = new Date();
    
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      connectTimeout: 10000, // 10 seconds
      commandTimeout: 5000,  // 5 seconds
      enableAutoPipelining: true,
      ...config
    };

    this.health = {
      isConnected: false,
      isHealthy: false,
      connectionAttempts: 0,
      lastConnectionTime: null,
      lastError: null,
      uptime: 0,
      commandsExecuted: 0,
      commandsFailed: 0,
      lastHealthCheck: new Date()
    };

    this.fallbackStorage = new MemoryFallbackStorage();
    
    this.connect();
    this.startHealthMonitoring();
    this.startCleanupTimer();
  }

  private async connect(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      console.log(`🔄 Attempting Redis connection (attempt ${this.connectionAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        // retryDelayOnFailover: this.config.retryDelayOnFailover, // Not a valid Redis option
        lazyConnect: this.config.lazyConnect,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        enableAutoPipelining: this.config.enableAutoPipelining,
        // Enhanced retry strategy
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`🔄 Redis retry strategy: attempt ${times}, delay ${delay}ms`);
          return delay;
        },
        // Reconnect on failure
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      });

      this.setupRedisEventListeners();
      
      // Attempt to connect
      await this.redis.connect();
      
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.handleConnectionFailure(error);
    }
  }

  private setupRedisEventListeners(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
      this.health.isConnected = true;
      this.health.isHealthy = true;
      this.health.lastConnectionTime = new Date();
      this.health.connectionAttempts = this.connectionAttempts;
      this.health.lastError = null;
      
      // Reset reconnection parameters on successful connection
      this.connectionAttempts = 0;
      this.reconnectDelay = 1000;
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      this.emit('connected');
    });

    this.redis.on('ready', () => {
      console.log('🚀 Redis is ready');
      this.health.isHealthy = true;
      this.emit('ready');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.health.lastError = (error as Error).message;
      this.health.isHealthy = false;
      this.emit('error', error);
      
      // Don't immediately reconnect on error, let the close event handle it
    });

    this.redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
      this.health.isConnected = false;
      this.health.isHealthy = false;
      this.emit('disconnected');
      
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.redis.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
      this.emit('reconnecting');
    });

    // Monitor command execution
    this.redis.on('end', () => {
      console.warn('⚠️ Redis connection ended');
      this.health.isConnected = false;
      this.health.isHealthy = false;
    });
  }

  private handleConnectionFailure(error: any): void {
    this.health.lastError = (error as Error).message;
    this.health.isConnected = false;
    this.health.isHealthy = false;
    this.connectionAttempts++;
    
    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max Redis reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }
    
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) return;

    console.log(`🔄 Scheduling Redis reconnection in ${this.reconnectDelay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with jitter
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2 + Math.random() * 1000,
      this.maxReconnectDelay
    );
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.updateHealthStatus();
    }, 30000); // Check every 30 seconds

    // Initial health check
    this.updateHealthStatus();
  }

  private startCleanupTimer(): void {
    // Clean up expired fallback storage items every 5 minutes
    this.cleanupTimer = setInterval(() => {
      if (this.fallbackStorage instanceof MemoryFallbackStorage) {
        this.fallbackStorage.cleanup();
      }
    }, 5 * 60 * 1000);
  }

  private updateHealthStatus(): void {
    const now = new Date();
    this.health.uptime = now.getTime() - this.startTime.getTime();
    this.health.lastHealthCheck = now;

    // Perform a simple health check if connected
    if (this.redis && this.health.isConnected) {
      this.redis.ping()
        .then(() => {
          this.health.isHealthy = true;
          this.health.commandsExecuted++;
        })
        .catch((error) => {
          console.error('❌ Redis health check failed:', error);
          this.health.isHealthy = false;
          this.health.commandsFailed++;
          this.health.lastError = (error as Error).message;
        });
    }
  }

  // Public methods with fallback support
  public async get(key: string): Promise<string | null> {
    try {
      if (this.redis && this.health.isConnected) {
        const result = await this.redis.get(key);
        this.health.commandsExecuted++;
        return result;
      }
    } catch (error) {
      console.error(`❌ Redis GET failed for key ${key}:`, error);
      this.health.commandsFailed++;
      this.health.lastError = (error as Error).message;
    }

    // Fallback to memory storage
    console.warn(`⚠️ Using fallback storage for GET ${key}`);
    return await this.fallbackStorage.get(key);
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (this.redis && this.health.isConnected) {
        if (ttl) {
          await this.redis.setex(key, ttl, value);
        } else {
          await this.redis.set(key, value);
        }
        this.health.commandsExecuted++;
        
        // Also store in fallback for consistency
        await this.fallbackStorage.set(key, value, ttl);
        return;
      }
    } catch (error) {
      console.error(`❌ Redis SET failed for key ${key}:`, error);
      this.health.commandsFailed++;
      this.health.lastError = (error as Error).message;
    }

    // Fallback to memory storage
    console.warn(`⚠️ Using fallback storage for SET ${key}`);
    await this.fallbackStorage.set(key, value, ttl);
  }

  public async del(key: string): Promise<void> {
    try {
      if (this.redis && this.health.isConnected) {
        await this.redis.del(key);
        this.health.commandsExecuted++;
      }
    } catch (error) {
      console.error(`❌ Redis DEL failed for key ${key}:`, error);
      this.health.commandsFailed++;
      this.health.lastError = (error as Error).message;
    }

    // Always delete from fallback storage
    await this.fallbackStorage.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    try {
      if (this.redis && this.health.isConnected) {
        const result = await this.redis.exists(key);
        this.health.commandsExecuted++;
        return result === 1;
      }
    } catch (error) {
      console.error(`❌ Redis EXISTS failed for key ${key}:`, error);
      this.health.commandsFailed++;
      this.health.lastError = (error as Error).message;
    }

    // Fallback to memory storage
    return await this.fallbackStorage.exists(key);
  }

  public async flushall(): Promise<void> {
    try {
      if (this.redis && this.health.isConnected) {
        await this.redis.flushall();
        this.health.commandsExecuted++;
      }
    } catch (error) {
      console.error('❌ Redis FLUSHALL failed:', error);
      this.health.commandsFailed++;
      this.health.lastError = (error as Error).message;
    }

    // Clear fallback storage
    await this.fallbackStorage.clear();
  }

  // Get the raw Redis instance (for BullMQ and other libraries)
  public getRedisInstance(): Redis | null {
    return this.redis;
  }

  public getHealth(): RedisHealth {
    return { ...this.health };
  }

  public isConnected(): boolean {
    return this.health.isConnected && this.health.isHealthy;
  }

  public async forceReconnect(): Promise<void> {
    console.log('🔄 Force reconnecting Redis...');
    
    if (this.redis) {
      this.redis.disconnect();
    }
    
    this.connectionAttempts = 0;
    this.reconnectDelay = 1000;
    
    await this.connect();
  }

  public resetConnectionAttempts(): void {
    this.connectionAttempts = 0;
    this.reconnectDelay = 1000;
    console.log('🔄 Redis connection attempts reset');
  }

  public async close(): Promise<void> {
    console.log('🛑 Shutting down Redis manager...');
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    await this.fallbackStorage.clear();
    
    this.health.isConnected = false;
    this.health.isHealthy = false;
    
    console.log('✅ Redis manager shut down');
  }
}

export default RedisManager;