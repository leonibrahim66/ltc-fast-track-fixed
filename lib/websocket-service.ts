/**
 * WebSocket Service
 * Handles real-time location updates and event broadcasting
 */

export interface WebSocketMessage {
  type: 'location' | 'route' | 'geofence' | 'notification' | 'ping' | 'pong';
  data: any;
  timestamp: number;
  userId?: string;
}

export interface LocationBroadcast {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface RouteBroadcast {
  routeId: string;
  collectorId: string;
  currentWaypoint: { latitude: number; longitude: number };
  waypointIndex: number;
  totalWaypoints: number;
  distanceTraveled: number;
  estimatedTimeRemaining: number;
  timestamp: number;
}

export interface GeofenceBroadcast {
  eventType: 'entry' | 'exit' | 'dwell';
  zoneId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export type WebSocketEventListener = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners: Map<string, Set<WebSocketEventListener>> = new Map();
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageId: number = 0;

  constructor(url: string = '') {
    // Default to empty string — callers must pass the real server URL.
    // ws://localhost:3000 is invalid on Android devices (localhost = the device itself).
    this.url = url;
    this.initializeEventTypes();
  }

  /**
   * Initialize event types
   */
  private initializeEventTypes(): void {
    this.eventListeners.set('location', new Set());
    this.eventListeners.set('route', new Set());
    this.eventListeners.set('geofence', new Set());
    this.eventListeners.set('notification', new Set());
    this.eventListeners.set('connection', new Set());
    this.eventListeners.set('error', new Set());
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connectionState === 'connected') {
        resolve();
        return;
      }

      this.connectionState = 'connecting';

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.emit('connection', { type: 'connected', timestamp: Date.now() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.emit('error', { type: 'websocket_error', error, timestamp: Date.now() });
          reject(error);
        };

        this.ws.onclose = () => {
          this.connectionState = 'disconnected';
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', {
        type: 'max_reconnect_attempts_reached',
        timestamp: Date.now(),
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.send({
          type: 'ping',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message
   */
  send(message: WebSocketMessage): void {
    if (this.connectionState === 'connected' && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
        this.messageQueue.push(message);
      }
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.connectionState === 'connected') {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      if (message.type === 'pong') {
        return; // Ignore pong messages
      }

      this.emit(message.type, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Broadcast location
   */
  broadcastLocation(location: LocationBroadcast): void {
    this.send({
      type: 'location',
      data: location,
      timestamp: Date.now(),
      userId: location.userId,
    });
  }

  /**
   * Broadcast route update
   */
  broadcastRoute(route: RouteBroadcast): void {
    this.send({
      type: 'route',
      data: route,
      timestamp: Date.now(),
      userId: route.collectorId,
    });
  }

  /**
   * Broadcast geofence event
   */
  broadcastGeofenceEvent(event: GeofenceBroadcast): void {
    this.send({
      type: 'geofence',
      data: event,
      timestamp: Date.now(),
      userId: event.userId,
    });
  }

  /**
   * Subscribe to event
   */
  subscribe(eventType: string, listener: WebSocketEventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    this.eventListeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Emit event
   */
  private emit(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener({
            type: eventType as any,
            data,
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error(`Error in listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionState;
  }

  /**
   * Get message queue size
   */
  getMessageQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    connectionState: string;
    messageQueueSize: number;
    reconnectAttempts: number;
    eventListenerCount: number;
  } {
    let eventListenerCount = 0;
    this.eventListeners.forEach((listeners) => {
      eventListenerCount += listeners.size;
    });

    return {
      connectionState: this.connectionState,
      messageQueueSize: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts,
      eventListenerCount,
    };
  }

  /**
   * Clear message queue
   */
  clearMessageQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Reset connection
   */
  reset(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.eventListeners.clear();
    this.initializeEventTypes();
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

export function initializeWebSocketService(url?: string): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(url);
  }
  return wsService;
}

export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService();
  }
  return wsService;
}
