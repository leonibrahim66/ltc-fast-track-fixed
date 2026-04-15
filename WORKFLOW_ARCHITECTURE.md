# Complete Workflow Architecture: Customers, Zone Managers, Drivers, Zone Admins

## Overview

This document describes the complete operational workflow for the trash pickup service, involving four key roles:

1. **Customers** - Request trash pickups
2. **Zone Managers** - Manage drivers and assignments in their zone
3. **Garbage Collection Drivers** - Accept and complete pickups
4. **Zone Admins** - Oversee zones and managers

## System Architecture

### Service Separation

The system maintains **complete separation** between two independent services:

| Aspect | Trash Pickup Service | Carrier Booking Service |
|--------|---------------------|------------------------|
| **Purpose** | Garbage collection | Parcel/cargo transport |
| **Users** | Customers, drivers, zone managers | Customers, drivers |
| **Vehicles** | Garbage trucks | Carrier vehicles |
| **Workflow** | Pin bin → Driver accepts → Pickup complete | Book shipment → Driver accepts → Delivery complete |
| **Database Tables** | garbage_pickups, pickup_assignments | bookings, booking_assignments |
| **API Endpoints** | /api/trpc/garbagePickup.* | /api/trpc/booking.* |
| **WebSocket Channels** | zone:{zoneId}, job_alert | booking:{bookingId} |
| **Drivers** | Garbage drivers (role: garbage_driver) | Carrier drivers (role: carrier_driver) |
| **Notifications** | Job alerts, pickup updates | Booking alerts, delivery updates |

**Key Rule**: Garbage drivers NEVER see carrier bookings. Carrier drivers NEVER see garbage pickups. Database queries are filtered by service type.

---

## Workflow 1: Customer Pins Trash Pickup

### Actors
- **Customer** - Initiates pickup request
- **Zone Manager** - Receives alert, can manually assign
- **Garbage Drivers** - Receive job alert, can accept
- **Zone Admin** - Oversees the process

### Step-by-Step Flow

#### Step 1: Customer Pins Bin on Map
```
Customer App:
1. Open "Request Pickup" screen
2. Tap location on map (or use current location)
3. Enter bin size/type (small, medium, large)
4. Enter special instructions (optional)
5. Tap "Request Pickup"

API Call:
POST /api/trpc/garbagePickup.createPickup
{
  customerId: number,
  location: [latitude, longitude],
  binSize: "small" | "medium" | "large",
  description?: string,
  zoneId?: number
}

Response:
{
  pickupId: string,
  status: "pending",
  estimatedWaitTime: number,
  createdAt: timestamp
}
```

#### Step 2: System Auto-Detects Zone
```
Backend:
1. Receive pickup request
2. Call geocoding service to detect zone from coordinates
3. Query database: SELECT * FROM zones WHERE ST_Contains(geometry, point)
4. If multiple zones, select smallest/most specific
5. Assign pickupId to zone

Database Update:
INSERT INTO garbage_pickups (
  id, customerId, location, zoneId, status, createdAt
)
VALUES (...)
```

#### Step 3: Zone Manager & Drivers Receive Alert
```
WebSocket Broadcast to Zone:
{
  type: "job_alert",
  alertId: string,
  pickupId: string,
  zoneId: number,
  location: [lat, lng],
  binSize: string,
  description: string,
  timestamp: number
}

Recipients:
- Zone Manager (subscribed to zone:{zoneId})
- All Garbage Drivers in zone (subscribed to zone:{zoneId})

NOT Sent To:
- Carrier drivers
- Customers in other zones
- Zone admins (they see via dashboard, not real-time)
```

#### Step 4: Garbage Drivers Receive Notification
```
Driver App:
1. Receive job alert notification
2. See pickup location on map
3. Calculate distance to pickup
4. Decide: Accept or Skip

If Accept:
POST /api/trpc/garbagePickup.acceptPickup
{
  pickupId: string,
  driverId: number
}

Database Update:
UPDATE garbage_pickups SET status = "accepted", acceptedBy = driverId
INSERT INTO pickup_assignments (pickupId, driverId, status = "accepted")

WebSocket Broadcast:
{
  type: "job_accepted",
  pickupId: string,
  driverId: number,
  driverName: string,
  estimatedArrival: number
}

Recipients:
- Customer (so they know driver is coming)
- Zone Manager (for tracking)
- Other drivers in zone (so they know it's taken)
```

#### Step 5: Zone Manager Manual Assignment (if needed)
```
If no driver accepts within timeout (e.g., 5 minutes):

Zone Manager App:
1. See unassigned pickup in dashboard
2. View available drivers in zone
3. Select driver
4. Tap "Assign Driver"

API Call:
POST /api/trpc/garbagePickup.assignDriver
{
  pickupId: string,
  driverId: number,
  zoneManagerId: number
}

Database Update:
UPDATE garbage_pickups SET status = "assigned", assignedBy = zoneManagerId
INSERT INTO pickup_assignments (pickupId, driverId, status = "assigned")

WebSocket Broadcast:
{
  type: "job_assigned",
  pickupId: string,
  driverId: number,
  assignedBy: zoneManagerId
}

Recipients:
- Assigned driver (notification: "You've been assigned a pickup")
- Zone Manager (confirmation)
- Customer (updated status)
```

---

## Workflow 2: Driver Completes Pickup

### Actors
- **Driver** - Completes the pickup
- **Customer** - Receives confirmation
- **Zone Manager** - Tracks completion
- **Zone Admin** - Oversees statistics

### Step-by-Step Flow

#### Step 1: Driver Arrives at Location
```
Driver App:
1. Navigate to pickup location (using map)
2. Tap "Arrived" when at location

API Call:
POST /api/trpc/garbagePickup.markArrived
{
  pickupId: string,
  driverId: number,
  location: [latitude, longitude]
}

Database Update:
UPDATE garbage_pickups SET status = "arrived", arrivedAt = now()

WebSocket Broadcast:
{
  type: "driver_arrived",
  pickupId: string,
  driverId: number,
  arrivedAt: timestamp
}

Recipients:
- Customer (real-time notification)
- Zone Manager (tracking)
```

#### Step 2: Driver Completes Pickup
```
Driver App:
1. Collect bin from customer
2. Load into truck
3. Tap "Pickup Complete"
4. Optional: Take photo/video proof
5. Get customer signature (if required)

API Call:
POST /api/trpc/garbagePickup.completePickup
{
  pickupId: string,
  driverId: number,
  completedAt: timestamp,
  proofPhoto?: string,
  notes?: string
}

Database Update:
UPDATE garbage_pickups SET status = "completed", completedAt = now()
UPDATE pickup_assignments SET status = "completed"

WebSocket Broadcast:
{
  type: "pickup_completed",
  pickupId: string,
  driverId: number,
  completedAt: timestamp
}

Recipients:
- Customer (confirmation + rating prompt)
- Zone Manager (statistics)
- Zone Admin (dashboard update)
```

#### Step 3: Customer Rates Driver
```
Customer App:
1. Receive "Pickup Complete" notification
2. See rating prompt
3. Rate driver (1-5 stars)
4. Add optional comment
5. Submit rating

API Call:
POST /api/trpc/garbagePickup.ratePickup
{
  pickupId: string,
  rating: 1-5,
  comment?: string
}

Database Update:
INSERT INTO pickup_ratings (pickupId, rating, comment)
UPDATE drivers SET averageRating = (recalculate)
```

---

## Workflow 3: Zone Admin Oversees Operations

### Actors
- **Zone Admin** - Monitors zones and managers
- **Zone Manager** - Manages drivers and pickups
- **Drivers** - Execute pickups
- **Customers** - Request pickups

### Step-by-Step Flow

#### Zone Admin Dashboard
```
Zone Admin App:
1. Open admin dashboard
2. See all zones they manage
3. For each zone:
   - Total pickups today
   - Completed pickups
   - Pending pickups
   - Active drivers
   - Zone managers
   - Performance metrics

API Calls:
GET /api/trpc/zoneAdmin.getZoneStatistics
{
  zoneId: number
}

Response:
{
  zoneId: number,
  totalPickups: number,
  completedPickups: number,
  pendingPickups: number,
  activeDrivers: number,
  zoneManagers: number,
  averageCompletionTime: number,
  customerSatisfaction: number,
  revenueToday: number
}
```

#### Zone Admin Assigns Zone Manager
```
Zone Admin App:
1. Go to "Zone Managers" tab
2. See list of approved zone managers
3. Select zone manager
4. Select zone
5. Tap "Assign"

API Call:
POST /api/trpc/zoneAdmin.assignZoneManagerToZone
{
  zoneManagerId: number,
  zoneId: number
}

Database Update:
INSERT INTO zone_manager_zones (zoneManagerId, zoneId, assignedAt)

WebSocket Broadcast:
{
  type: "zone_manager_assigned",
  zoneManagerId: number,
  zoneId: number
}

Recipients:
- Zone Manager (notification: "You're now managing Zone X")
- Zone Admin (confirmation)
```

#### Zone Admin Approves Zone Manager
```
Zone Admin App:
1. Go to "Pending Approvals" tab
2. Review zone manager profile
3. Tap "Approve"

API Call:
POST /api/trpc/zoneAdmin.approveZoneManager
{
  zoneManagerId: number
}

Database Update:
UPDATE zone_admin_profiles SET isApproved = true, approvedAt = now()

WebSocket Broadcast:
{
  type: "zone_manager_approved",
  zoneManagerId: number
}

Recipients:
- Zone Manager (notification: "Your profile has been approved!")
- Zone Admin (confirmation)
```

---

## Workflow 4: Zone Manager Manages Drivers

### Actors
- **Zone Manager** - Manages drivers in their zone
- **Drivers** - Work under zone manager
- **Customers** - Request pickups

### Step-by-Step Flow

#### Zone Manager Assigns Driver to Zone
```
Zone Manager App:
1. Go to "Drivers" tab
2. See available drivers
3. Select driver
4. Tap "Assign to Zone"

API Call:
POST /api/trpc/zoneManager.assignDriverToZone
{
  driverId: number,
  zoneId: number,
  zoneManagerId: number
}

Database Update:
INSERT INTO zone_manager_drivers (zoneManagerId, driverId, zoneId, assignedAt)

WebSocket Broadcast:
{
  type: "driver_assigned_to_zone",
  driverId: number,
  zoneId: number,
  zoneManagerId: number
}

Recipients:
- Driver (notification: "You're assigned to Zone X under Manager Y")
- Zone Manager (confirmation)
```

#### Zone Manager Monitors Driver Performance
```
Zone Manager App:
1. Go to "Driver Performance" dashboard
2. See each driver:
   - Pickups completed today
   - Average rating
   - Response time
   - Current location (if opted in)
   - Status (online/offline)

API Call:
GET /api/trpc/zoneManager.getDriverPerformance
{
  zoneManagerId: number,
  zoneId: number
}

Response:
{
  drivers: [
    {
      driverId: number,
      name: string,
      completedToday: number,
      averageRating: number,
      responseTime: number,
      status: "online" | "offline",
      location: [lat, lng]
    }
  ]
}
```

#### Zone Manager Manually Assigns Pickup
```
Zone Manager App:
1. See unassigned pickup in dashboard
2. View available drivers
3. Select driver
4. Tap "Assign"

API Call:
POST /api/trpc/garbagePickup.assignDriver
{
  pickupId: string,
  driverId: number,
  zoneManagerId: number
}

Database Update:
UPDATE garbage_pickups SET status = "assigned", assignedBy = zoneManagerId
INSERT INTO pickup_assignments (pickupId, driverId, status = "assigned")

WebSocket Broadcast:
{
  type: "job_assigned",
  pickupId: string,
  driverId: number
}

Recipients:
- Driver (notification: "New pickup assigned to you")
- Zone Manager (confirmation)
- Customer (status update)
```

---

## Real-Time Communication

### WebSocket Events

#### Job Alert Events
```
Channel: zone:{zoneId}

Events:
1. job_alert - New pickup request
   {
     type: "job_alert",
     pickupId: string,
     location: [lat, lng],
     binSize: string,
     description: string
   }

2. job_accepted - Driver accepted pickup
   {
     type: "job_accepted",
     pickupId: string,
     driverId: number,
     driverName: string,
     estimatedArrival: number
   }

3. job_assigned - Zone manager assigned driver
   {
     type: "job_assigned",
     pickupId: string,
     driverId: number,
     assignedBy: number
   }

4. driver_arrived - Driver at location
   {
     type: "driver_arrived",
     pickupId: string,
     driverId: number,
     arrivedAt: timestamp
   }

5. pickup_completed - Pickup finished
   {
     type: "pickup_completed",
     pickupId: string,
     driverId: number,
     completedAt: timestamp
   }
```

#### Driver Location Events
```
Channel: zone:{zoneId}

Event: driver_location_update
{
  type: "driver_location_update",
  driverId: number,
  location: [lat, lng],
  timestamp: number
}

Recipients: Zone managers only (privacy)
```

#### Zone Drawing Events
```
Channel: zone:{zoneId}

Events:
1. drawing_started
2. drawing_update
3. drawing_completed

Used for: Real-time collaborative zone boundary drawing
```

---

## Data Flow Diagram

```
Customer Pins Pickup
        ↓
System Detects Zone
        ↓
Zone Managers & Drivers Receive Alert
        ↓
Driver Accepts OR Zone Manager Assigns
        ↓
Driver Navigates to Location
        ↓
Driver Marks Arrived
        ↓
Driver Completes Pickup
        ↓
Customer Rates Driver
        ↓
Zone Admin Sees Statistics
```

---

## Database Schema

### Core Tables

**garbage_pickups**
- id (string, primary key)
- customerId (number, foreign key)
- zoneId (number, foreign key)
- location (point geometry)
- binSize (enum: small, medium, large)
- status (enum: pending, accepted, assigned, arrived, completed)
- acceptedBy (number, nullable)
- assignedBy (number, nullable)
- createdAt (timestamp)
- completedAt (timestamp, nullable)

**pickup_assignments**
- id (number, primary key)
- pickupId (string, foreign key)
- driverId (number, foreign key)
- status (enum: pending, accepted, assigned, completed)
- assignedAt (timestamp)
- completedAt (timestamp, nullable)

**zone_manager_drivers**
- id (number, primary key)
- zoneManagerId (number, foreign key)
- driverId (number, foreign key)
- zoneId (number, foreign key)
- assignedAt (timestamp)

**zone_admin_zones**
- id (number, primary key)
- zoneAdminId (number, foreign key)
- zoneId (number, foreign key)
- assignedAt (timestamp)

---

## Separation: Trash Pickup vs Carrier Booking

### Database Separation

```typescript
// Trash Pickup Queries
SELECT * FROM garbage_pickups WHERE zoneId = ?
SELECT * FROM pickup_assignments WHERE driverId = ? AND status = 'pending'

// Carrier Booking Queries
SELECT * FROM bookings WHERE zoneId = ?
SELECT * FROM booking_assignments WHERE driverId = ? AND status = 'pending'

// NEVER Mix:
// ❌ SELECT * FROM garbage_pickups JOIN bookings
// ✅ Separate queries for each service
```

### API Endpoint Separation

```
Trash Pickup:
/api/trpc/garbagePickup.createPickup
/api/trpc/garbagePickup.acceptPickup
/api/trpc/garbagePickup.completePickup

Carrier Booking:
/api/trpc/booking.createBooking
/api/trpc/booking.acceptBooking
/api/trpc/booking.completeDelivery

NEVER:
/api/trpc/pickup.* (ambiguous)
```

### Driver Role Separation

```typescript
// Driver Queries
if (driver.role === 'garbage_driver') {
  // Show garbage pickups only
  const pickups = await getGarbagePickups(driverId);
} else if (driver.role === 'carrier_driver') {
  // Show carrier bookings only
  const bookings = await getCarrierBookings(driverId);
}

// NEVER:
const allJobs = await getAllJobs(driverId); // ❌ Wrong
```

### Notification Separation

```typescript
// Trash Pickup Notifications
broadcastToZone(zoneId, {
  type: 'job_alert',
  service: 'trash_pickup', // Explicit marker
  pickupId: string
});

// Carrier Booking Notifications
broadcastToZone(zoneId, {
  type: 'booking_alert',
  service: 'carrier_booking', // Explicit marker
  bookingId: string
});

// Driver App Filters
if (notification.service === 'trash_pickup' && driver.role === 'garbage_driver') {
  showNotification(notification);
}
```

---

## Error Handling

### Timeout Scenarios

```
If driver doesn't accept within 5 minutes:
1. Send alert to zone manager
2. Zone manager can manually assign
3. If still no response after 10 minutes:
   - Mark as "unassigned"
   - Escalate to zone admin
   - Customer receives notification
```

### Network Failures

```
If WebSocket disconnects:
1. Client reconnects automatically
2. Server maintains message queue
3. Client receives missed events on reconnect
4. Fallback to polling if WebSocket unavailable
```

### Duplicate Prevention

```
If customer accidentally requests twice:
1. Check for duplicate within 30 seconds
2. Return existing pickup ID
3. Log duplicate attempt
4. Alert customer
```

---

## Security & Access Control

### Role-Based Permissions

| Action | Customer | Driver | Zone Manager | Zone Admin | Super Admin |
|--------|----------|--------|--------------|-----------|------------|
| Create Pickup | ✅ | ❌ | ❌ | ❌ | ❌ |
| Accept Pickup | ❌ | ✅ | ❌ | ❌ | ❌ |
| Assign Driver | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Zone Stats | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve Manager | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create Zone | ❌ | ❌ | ❌ | ✅ | ✅ |

### Data Isolation

```
Customer can only see:
- Their own pickups
- Assigned driver info

Driver can only see:
- Pickups in their zone
- Their own performance stats

Zone Manager can see:
- All pickups in their zone
- All drivers in their zone
- Performance metrics

Zone Admin can see:
- All zones they manage
- All zone managers
- System-wide statistics
```

---

## Performance Metrics

### Key Metrics Tracked

1. **Average Response Time** - Time from pickup request to driver acceptance
2. **Completion Rate** - % of pickups completed same day
3. **Customer Satisfaction** - Average rating (1-5 stars)
4. **Driver Efficiency** - Pickups completed per hour
5. **Zone Coverage** - % of zone with available drivers

### Monitoring

```
Real-Time Dashboard:
- Active pickups
- Pending assignments
- Driver locations
- Performance trends

Alerts:
- Pickup unassigned for >10 minutes
- Driver offline unexpectedly
- Customer complaint
- Zone manager inactive
```

---

## Conclusion

This architecture ensures:

✅ **Complete separation** between trash pickup and carrier booking services
✅ **Real-time communication** via WebSocket for instant alerts
✅ **Automatic assignment** with manual override capability
✅ **Role-based access control** for security
✅ **Scalability** with zone-based distribution
✅ **Reliability** with fallback mechanisms
✅ **Transparency** for all stakeholders
