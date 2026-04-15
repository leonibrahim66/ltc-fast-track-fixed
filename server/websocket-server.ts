import { createServer } from 'http';
// @ts-ignore
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import { EventEmitter } from 'events';

interface WebSocketClient {
  id: string;
  userId: string;
  ws: WebSocket;
  connectedAt: number;
  lastHeartbeat: number;
  subscriptions: Set<string>;
}

interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface RouteUpdate {
  routeId: string;
  collectorId: string;
  currentWaypoint: { latitude: number; longitude: number };
  waypointIndex: number;
  totalWaypoints: number;
  distanceTraveled: number;
  estimatedTimeRemaining: number;
  timestamp: number;
}

interface GeofenceEvent {
  eventType: 'entry' | 'exit';
  zoneId: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface DrawingSession {
  id: string;
  zoneId: number;
  createdBy: number;
  participants: Set<string>;
  coordinates: Array<[number, number]>;
  geometryType: 'polygon' | 'circle' | 'point';
  createdAt: Date;
}

interface JobAlert {
  id: string;
  pickupId: number;
  zoneId: number;
  customerId: number;
  location: [number, number];
  status: 'pending' | 'accepted' | 'assigned';
  createdAt: Date;
  recipients: Set<number>;
}

export class WebSocketServerManager extends EventEmitter {
  private wss: any; // WebSocketServer
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: Array<{ clientId: string; message: any }> = [];
  private maxClients: number = 1000;
  private heartbeatTimeout: number = 30000; // 30 seconds
  private drawingSessions: Map<string, DrawingSession> = new Map();
  private jobAlerts: Map<string, JobAlert> = new Map();
  private zoneSubscriptions: Map<number, Set<string>> = new Map();

  constructor(port: number = 3001) {
    super();
    const server = createServer();
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.setupWebSocketServer();
    this.startHeartbeat();

    server.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
      this.emit('server-started', { port });
    });
  }

  private setupWebSocketServer(): void {
    (this.wss as any).on('connection', (ws: WebSocket, req: any) => {
      const clientId = this.generateClientId();
      const query = parse(req.url || '', true).query;
      const userId = query.userId as string;

      if (!userId) {
        ws.close(1008, 'Missing userId');
        return;
      }

      if (this.clients.size >= this.maxClients) {
        ws.close(1008, 'Server at capacity');
        return;
      }

      const client: WebSocketClient = {
        id: clientId,
        userId,
        ws,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);
      this.emit('client-connected', { clientId, userId });

      ws.on('message', (data: Buffer) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleClientDisconnect(clientId));
      ws.on('error', (error: any) => this.handleClientError(clientId, error));

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        status: 'connected',
        clientId,
        timestamp: Date.now(),
      });
    });
  }

  private handleMessage(clientId: string, data: Buffer): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message = JSON.parse(data.toString());
      client.lastHeartbeat = Date.now();

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.channel);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.channel);
          break;
        case 'location':
          this.broadcastLocationUpdate(message.data);
          break;
        case 'route':
          this.broadcastRouteUpdate(message.data);
          break;
        case 'geofence':
          this.broadcastGeofenceEvent(message.data);
          break;
        case 'subscribe_zone':
          this.handleSubscribeZone(clientId, message.zoneId);
          break;
        case 'unsubscribe_zone':
          this.handleUnsubscribeZone(clientId, message.zoneId);
          break;
        case 'drawing_start':
          this.handleDrawingStart(clientId, message.data);
          break;
        case 'drawing_update':
          this.handleDrawingUpdate(clientId, message.data);
          break;
        case 'drawing_end':
          this.handleDrawingEnd(clientId, message.data);
          break;
        case 'job_alert':
          this.handleJobAlert(clientId, message.data);
          break;
        case 'driver_location':
          this.handleDriverLocation(clientId, message.data);
          break;
        case 'job_accepted':
          this.handleJobAccepted(clientId, message.data);
          break;
        case 'job_assigned':
          this.handleJobAssigned(clientId, message.data);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          this.emit('unknown-message', { clientId, message });
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
    }
  }

  private handleSubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);

    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      timestamp: Date.now(),
    });

    this.emit('client-subscribed', { clientId, channel });
  }

  private handleUnsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);

    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      timestamp: Date.now(),
    });

    this.emit('client-unsubscribed', { clientId, channel });
  }

  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clean up subscriptions
    client.subscriptions.forEach((channel) => {
      const subscribers = this.subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    });

    this.clients.delete(clientId);
    this.emit('client-disconnected', { clientId, userId: client.userId });
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`WebSocket error for client ${clientId}:`, error);
    this.emit('client-error', { clientId, error: error.message });
  }

  private broadcastLocationUpdate(location: LocationUpdate): void {
    const channel = `location:${location.userId}`;
    const subscribers = this.subscriptions.get(channel);

    if (subscribers) {
      const message = {
        type: 'location',
        data: location,
        timestamp: Date.now(),
      };

      subscribers.forEach((clientId) => {
        this.sendToClient(clientId, message);
      });
    }

    this.emit('location-broadcast', { location, subscriberCount: subscribers?.size || 0 });
  }

  private broadcastRouteUpdate(route: RouteUpdate): void {
    const channel = `route:${route.collectorId}`;
    const subscribers = this.subscriptions.get(channel);

    if (subscribers) {
      const message = {
        type: 'route',
        data: route,
        timestamp: Date.now(),
      };

      subscribers.forEach((clientId) => {
        this.sendToClient(clientId, message);
      });
    }

    this.emit('route-broadcast', { route, subscriberCount: subscribers?.size || 0 });
  }

  private broadcastGeofenceEvent(event: GeofenceEvent): void {
    const channel = `geofence:${event.zoneId}`;
    const subscribers = this.subscriptions.get(channel);

    if (subscribers) {
      const message = {
        type: 'geofence',
        data: event,
        timestamp: Date.now(),
      };

      subscribers.forEach((clientId) => {
        this.sendToClient(clientId, message);
      });
    }

    this.emit('geofence-broadcast', { event, subscriberCount: subscribers?.size || 0 });
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) {
      this.messageQueue.push({ clientId, message });
      return;
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push({ clientId, message });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval((): void => {
      const now = Date.now();
      const deadClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        if (now - client.lastHeartbeat > this.heartbeatTimeout) {
          deadClients.push(clientId);
        } else {
          this.sendToClient(clientId, {
            type: 'heartbeat',
            timestamp: now,
          });
        }
      });

      // Close dead connections
      deadClients.forEach((clientId) => {
        const client = this.clients.get(clientId);
        if (client) {
          client.ws.close(1000, 'Heartbeat timeout');
          this.handleClientDisconnect(clientId);
        }
      });
    }, 10000) as unknown as NodeJS.Timeout; // Check every 10 seconds
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStatistics() {
    return {
      connectedClients: this.clients.size,
      activeChannels: this.subscriptions.size,
      messageQueueSize: this.messageQueue.length,
      maxClients: this.maxClients,
      clients: Array.from(this.clients.values()).map((c) => ({
        id: c.id,
        userId: c.userId,
        connectedAt: c.connectedAt,
        subscriptions: Array.from(c.subscriptions),
      })),
    };
  }

  public broadcast(channel: string, message: any): void {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.forEach((clientId) => {
        this.sendToClient(clientId, {
          type: 'broadcast',
          channel,
          data: message,
          timestamp: Date.now(),
        });
      });
    }
  }

  private handleSubscribeZone(clientId: string, zoneId: number): void {
    const key = `zone:${zoneId}`;
    if (!this.zoneSubscriptions.has(zoneId)) {
      this.zoneSubscriptions.set(zoneId, new Set());
    }
    this.zoneSubscriptions.get(zoneId)!.add(clientId);
    this.sendToClient(clientId, {
      type: 'subscribed_zone',
      zoneId,
      timestamp: Date.now(),
    });
    this.emit('zone-subscribed', { clientId, zoneId });
  }

  private handleUnsubscribeZone(clientId: string, zoneId: number): void {
    this.zoneSubscriptions.get(zoneId)?.delete(clientId);
    this.sendToClient(clientId, {
      type: 'unsubscribed_zone',
      zoneId,
      timestamp: Date.now(),
    });
    this.emit('zone-unsubscribed', { clientId, zoneId });
  }

  private handleDrawingStart(clientId: string, data: any): void {
    const sessionId = `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: DrawingSession = {
      id: sessionId,
      zoneId: data.zoneId,
      createdBy: parseInt(this.clients.get(clientId)?.userId || '0'),
      participants: new Set([clientId]),
      coordinates: [],
      geometryType: data.geometryType,
      createdAt: new Date(),
    };
    this.drawingSessions.set(sessionId, session);
    this.sendToClient(clientId, {
      type: 'drawing_started',
      sessionId,
      timestamp: Date.now(),
    });
    this.broadcastToZone(data.zoneId, {
      type: 'drawing_started',
      sessionId,
      geometryType: data.geometryType,
      timestamp: Date.now(),
    });
    this.emit('drawing-started', { clientId, sessionId, zoneId: data.zoneId });
  }

  private handleDrawingUpdate(clientId: string, data: any): void {
    const session = this.drawingSessions.get(data.sessionId);
    if (!session) {
      this.sendToClient(clientId, { type: 'error', message: 'Session not found' });
      return;
    }
    session.coordinates.push(data.coordinate);
    this.broadcastToZone(session.zoneId, {
      type: 'drawing_update',
      sessionId: data.sessionId,
      coordinate: data.coordinate,
      coordinateCount: session.coordinates.length,
      timestamp: Date.now(),
    });
  }

  private handleDrawingEnd(clientId: string, data: any): void {
    const session = this.drawingSessions.get(data.sessionId);
    if (!session) {
      this.sendToClient(clientId, { type: 'error', message: 'Session not found' });
      return;
    }
    this.broadcastToZone(session.zoneId, {
      type: 'drawing_completed',
      sessionId: data.sessionId,
      coordinates: Array.from(session.coordinates),
      geometryType: session.geometryType,
      timestamp: Date.now(),
    });
    this.drawingSessions.delete(data.sessionId);
    this.emit('drawing-ended', { clientId, sessionId: data.sessionId });
  }

  private handleJobAlert(clientId: string, data: any): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const jobAlert: JobAlert = {
      id: alertId,
      pickupId: data.pickupId,
      zoneId: data.zoneId,
      customerId: data.customerId,
      location: data.location,
      status: 'pending',
      createdAt: new Date(),
      recipients: new Set(),
    };
    this.jobAlerts.set(alertId, jobAlert);
    this.broadcastToZone(data.zoneId, {
      type: 'job_alert',
      alertId,
      pickupId: data.pickupId,
      location: data.location,
      description: data.description,
      timestamp: Date.now(),
    });
    this.sendToClient(clientId, {
      type: 'job_alert_sent',
      alertId,
      timestamp: Date.now(),
    });
    this.emit('job-alert-sent', { clientId, alertId, zoneId: data.zoneId });
  }

  private handleDriverLocation(clientId: string, data: any): void {
    this.broadcastToZone(data.zoneId, {
      type: 'driver_location_update',
      driverId: data.driverId,
      location: data.location,
      timestamp: Date.now(),
    });
  }

  private handleJobAccepted(clientId: string, data: any): void {
    const jobAlert = this.jobAlerts.get(data.alertId);
    if (jobAlert) {
      jobAlert.status = 'accepted';
    }
    this.broadcastToZone(data.zoneId, {
      type: 'job_accepted',
      alertId: data.alertId,
      pickupId: data.pickupId,
      driverId: data.driverId,
      timestamp: Date.now(),
    });
    this.sendToClient(clientId, {
      type: 'job_accepted_confirmed',
      alertId: data.alertId,
      timestamp: Date.now(),
    });
    this.emit('job-accepted', { clientId, alertId: data.alertId, zoneId: data.zoneId });
  }

  private handleJobAssigned(clientId: string, data: any): void {
    const jobAlert = this.jobAlerts.get(data.alertId);
    if (jobAlert) {
      jobAlert.status = 'assigned';
    }
    this.broadcastToZone(data.zoneId, {
      type: 'job_assigned',
      alertId: data.alertId,
      pickupId: data.pickupId,
      driverId: data.driverId,
      zoneManagerId: data.zoneManagerId,
      timestamp: Date.now(),
    });
    this.sendToClient(clientId, {
      type: 'job_assigned_confirmed',
      alertId: data.alertId,
      timestamp: Date.now(),
    });
    this.emit('job-assigned', { clientId, alertId: data.alertId, zoneId: data.zoneId });
  }

  private broadcastToZone(zoneId: number, message: any): void {
    const subscribers = this.zoneSubscriptions.get(zoneId);
    if (!subscribers) return;
    const payload = JSON.stringify(message);
    subscribers.forEach((clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  public getDrawingSession(sessionId: string): DrawingSession | undefined {
    return this.drawingSessions.get(sessionId);
  }

  public getJobAlert(alertId: string): JobAlert | undefined {
    return this.jobAlerts.get(alertId);
  }

  public getZoneStats(zoneId: number) {
    return {
      zoneId,
      subscribers: this.zoneSubscriptions.get(zoneId)?.size || 0,
      activeDrawingSessions: Array.from(this.drawingSessions.values()).filter(
        (s) => s.zoneId === zoneId
      ).length,
      activeJobAlerts: Array.from(this.jobAlerts.values()).filter(
        (a) => a.zoneId === zoneId && a.status !== 'completed'
      ).length,
    };
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
    this.emit('server-closed');
  }
}

// Export singleton instance
let wsServerInstance: WebSocketServerManager | null = null;

export function getWebSocketServer(port?: number): WebSocketServerManager {
  if (!wsServerInstance) {
    wsServerInstance = new WebSocketServerManager(port || 3001);
  }
  return wsServerInstance;
}
