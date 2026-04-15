# LTC Fast Track - Complete Workflow Design

## 1. ZONE HIERARCHY STRUCTURE

```
┌─────────────────────────────────────────────────────────────┐
│ ZONE ADMIN (role: admin)                                    │
│ - Creates zones                                             │
│ - Assigns zone managers to zones                            │
│ - Views all zones and their assignments                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ assigns zone managers
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ ZONE MANAGER (role: zone_manager)                           │
│ - Assigned to 1+ zones                                      │
│ - Assigns drivers to their zones                            │
│ - Manually assigns pickups to drivers                       │
│ - Views customers in their zones                            │
│ - Views pickup history                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ assigns drivers
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ GARBAGE COLLECTION DRIVER (role: driver)                    │
│ - Assigned to zone manager + zone                           │
│ - Receives pinned pickup jobs in zone                       │
│ - Accepts/rejects pickup jobs                               │
│ - Completes pickups                                         │
│ - Views earnings and history                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CUSTOMER (role: user)                                       │
│ - Auto-assigned to zone (based on address/location)         │
│ - Auto-linked to zone manager(s) in that zone               │
│ - Requests pickups                                          │
│ - Sees assigned driver                                      │
│ - Pays for pickups                                          │
│ - Views pickup history                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. WORKFLOW SEQUENCES

### Workflow A: Zone Admin Creates Zone and Assigns Manager

```
Step 1: Zone Admin creates zone
  Input: name, city, boundaries (GeoJSON)
  Output: zone_id
  Database: INSERT INTO zones (name, city, boundaries, status='active')

Step 2: Zone Admin assigns zone manager
  Input: zone_id, user_id (zone manager)
  Validation: 
    - user_id must exist in users table
    - user_id role must be 'zone_manager' or promoted to it
  Output: zone_manager_id
  Database: 
    INSERT INTO zone_managers (userId, zoneId, status='active', assignedAt=NOW())
    UPDATE users SET role='zone_manager' WHERE id=user_id

Step 3: Zone Admin views zone details
  Input: zone_id
  Output: zone details + assigned managers + drivers + customers
  Database: 
    SELECT * FROM zones WHERE id=zone_id
    SELECT * FROM zone_managers WHERE zoneId=zone_id
    SELECT * FROM zone_manager_drivers WHERE zoneManagerId IN (...)
    SELECT * FROM customer_zone_assignments WHERE zoneId=zone_id
```

---

### Workflow B: Zone Manager Assigns Drivers

```
Step 1: Zone Manager views available drivers
  Input: zone_manager_id
  Validation: Verify zone manager exists and is active
  Output: List of drivers not yet assigned to this zone manager
  Database:
    SELECT d.* FROM driverProfiles d
    WHERE d.id NOT IN (
      SELECT driverId FROM zone_manager_drivers 
      WHERE zoneManagerId=zone_manager_id
    )
    AND d.isApproved=true AND d.isSuspended=false

Step 2: Zone Manager assigns driver
  Input: zone_manager_id, driver_id
  Validation:
    - driver_id must exist and be approved
    - driver_id must not already be assigned to this zone manager
  Output: assignment_id
  Database:
    INSERT INTO zone_manager_drivers (zoneManagerId, driverId, assignedAt=NOW(), status='active')
    
Step 3: Zone Manager views assigned drivers
  Input: zone_manager_id
  Output: List of drivers assigned to this zone manager
  Database:
    SELECT d.* FROM driverProfiles d
    INNER JOIN zone_manager_drivers zmd ON d.id=zmd.driverId
    WHERE zmd.zoneManagerId=zone_manager_id AND zmd.status='active'

Step 4: Zone Manager removes driver
  Input: zone_manager_id, driver_id
  Validation: Verify assignment exists
  Output: success
  Database:
    UPDATE zone_manager_drivers 
    SET status='inactive', unassignedAt=NOW()
    WHERE zoneManagerId=zone_manager_id AND driverId=driver_id
```

---

### Workflow C: Customer Auto-Assignment to Zone

```
Step 1: Customer registers/updates address
  Input: user_id, address, latitude, longitude (or just address for geocoding)
  Validation: Address must be valid
  Output: customer_zone_assignment_id
  Database:
    Step 1a: Geocode address if only address provided
      - Call Google Maps Geocoding API
      - Get latitude, longitude
    
    Step 1b: Find zone containing coordinates
      - Query zones table
      - Check if (latitude, longitude) falls within zone boundaries (GeoJSON)
      - SELECT zone_id FROM zones WHERE ST_Contains(boundaries, POINT(lat, lon))
    
    Step 1c: Create/update customer zone assignment
      - DELETE FROM customer_zone_assignments WHERE userId=user_id
      - INSERT INTO customer_zone_assignments 
        (userId, zoneId, address, latitude, longitude, assignedAt=NOW())
    
    Step 1d: Auto-link to zone manager(s)
      - SELECT zone_managers FROM zone_managers WHERE zoneId=zone_id AND status='active'
      - For each zone manager, create notification/link
      - Zone manager can now see this customer

Step 2: Customer views their assigned zone manager
  Input: user_id
  Output: zone_manager details
  Database:
    SELECT zm.* FROM zone_managers zm
    INNER JOIN customer_zone_assignments cza ON zm.zoneId=cza.zoneId
    WHERE cza.userId=user_id AND zm.status='active'

Step 3: Zone Manager views customers in their zone
  Input: zone_manager_id
  Output: List of customers in all zones managed by this zone manager
  Database:
    SELECT c.*, cza.address, cza.latitude, cza.longitude
    FROM users c
    INNER JOIN customer_zone_assignments cza ON c.id=cza.userId
    INNER JOIN zone_managers zm ON cza.zoneId=zm.zoneId
    WHERE zm.id=zone_manager_id AND zm.status='active'
    ORDER BY cza.assignedAt DESC
```

---

### Workflow D: Customer Requests Pickup

```
Step 1: Customer requests garbage pickup
  Input: user_id, pickup_address, latitude, longitude, notes
  Validation: 
    - Customer must be in customer_zone_assignments
    - Address must be within customer's assigned zone
  Output: pickup_id
  Database:
    Step 1a: Get customer's zone
      SELECT zoneId FROM customer_zone_assignments WHERE userId=user_id
    
    Step 1b: Create garbage pickup
      INSERT INTO garbage_pickups (
        customerId=user_id,
        zoneId=zone_id,
        address=pickup_address,
        latitude=lat,
        longitude=lon,
        status='pending',
        scheduledTime=NOW(),
        createdAt=NOW()
      )
    
    Step 1c: Get zone managers in this zone
      SELECT id FROM zone_managers WHERE zoneId=zone_id AND status='active'
    
    Step 1d: Notify zone managers
      For each zone manager:
        INSERT INTO user_notifications (
          userId=zone_manager_id,
          type='pickup_request',
          title='New Pickup Request',
          body='Customer requested pickup at...',
          pickupId=pickup_id
        )

Step 2: Broadcast pickup to drivers in zone
  Input: pickup_id
  Database:
    Step 2a: Get drivers in zone
      SELECT d.* FROM driverProfiles d
      INNER JOIN zone_manager_drivers zmd ON d.id=zmd.driverId
      INNER JOIN zone_managers zm ON zmd.zoneManagerId=zm.id
      WHERE zm.zoneId=(SELECT zoneId FROM garbage_pickups WHERE id=pickup_id)
      AND d.isOnline=true AND d.isApproved=true AND d.isSuspended=false
    
    Step 2b: Send real-time notifications to drivers
      For each driver:
        - WebSocket: Send pickup details
        - Or: Create notification record
        INSERT INTO user_notifications (
          userId=driver_id,
          type='pickup_available',
          title='New Pickup Available',
          body='Pickup at...',
          pickupId=pickup_id
        )

Step 3: Driver accepts pickup
  Input: driver_id, pickup_id
  Validation:
    - Driver must be in same zone as pickup
    - Pickup must be in 'pending' status
  Output: assignment_id
  Database:
    Step 3a: Create pickup assignment
      INSERT INTO pickup_assignments (
        pickupId=pickup_id,
        driverId=driver_id,
        assignedBy=NULL (driver accepted),
        status='accepted',
        acceptedAt=NOW()
      )
    
    Step 3b: Update pickup status
      UPDATE garbage_pickups 
      SET status='accepted', driverId=driver_id, acceptedAt=NOW()
      WHERE id=pickup_id
    
    Step 3c: Notify customer
      INSERT INTO user_notifications (
        userId=customer_id,
        type='driver_accepted',
        title='Driver Assigned',
        body='Driver X accepted your pickup',
        pickupId=pickup_id
      )
```

---

### Workflow E: Zone Manager Manually Assigns Driver to Pickup

```
Step 1: Zone Manager views unassigned pickups
  Input: zone_manager_id
  Output: List of pending pickups in zones managed by this zone manager
  Database:
    SELECT gp.* FROM garbage_pickups gp
    INNER JOIN zone_managers zm ON gp.zoneId=zm.zoneId
    WHERE zm.id=zone_manager_id AND gp.status='pending' AND gp.driverId IS NULL

Step 2: Zone Manager selects driver and assigns
  Input: zone_manager_id, pickup_id, driver_id
  Validation:
    - Pickup must be in 'pending' status
    - Pickup must be in zone managed by zone_manager_id
    - Driver must be assigned to zone_manager_id
    - Driver must be online and approved
  Output: assignment_id
  Database:
    Step 2a: Create pickup assignment
      INSERT INTO pickup_assignments (
        pickupId=pickup_id,
        driverId=driver_id,
        assignedBy=zone_manager_id (manual assignment),
        status='assigned',
        assignedAt=NOW()
      )
    
    Step 2b: Update pickup status
      UPDATE garbage_pickups 
      SET status='assigned', driverId=driver_id, assignedAt=NOW()
      WHERE id=pickup_id
    
    Step 2c: Notify driver
      INSERT INTO user_notifications (
        userId=driver_id,
        type='pickup_assigned',
        title='Pickup Assigned by Manager',
        body='Zone manager assigned pickup at...',
        pickupId=pickup_id
      )
    
    Step 2d: Notify customer
      INSERT INTO user_notifications (
        userId=customer_id,
        type='driver_assigned',
        title='Driver Assigned',
        body='Your pickup has been assigned to driver X',
        pickupId=pickup_id
      )
```

---

### Workflow F: Driver Completes Pickup

```
Step 1: Driver arrives at pickup location
  Input: driver_id, pickup_id
  Validation: Pickup must be assigned to driver
  Output: success
  Database:
    UPDATE garbage_pickups 
    SET status='arrived', arrivedAt=NOW()
    WHERE id=pickup_id
    
    Notify customer: "Driver arrived"

Step 2: Driver completes pickup
  Input: driver_id, pickup_id, notes, photos (optional)
  Validation: Pickup must be in 'arrived' status
  Output: success
  Database:
    UPDATE garbage_pickups 
    SET status='completed', completedAt=NOW(), notes=notes
    WHERE id=pickup_id
    
    Create payment transaction (10% platform commission)
    
    Notify customer: "Pickup completed"
    Notify zone manager: "Pickup completed"
```

---

## 3. DATABASE SCHEMA DESIGN

### New Tables

#### zone_managers
```sql
CREATE TABLE zone_managers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL UNIQUE,
  zoneId INT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  commissionRate DECIMAL(5,2) DEFAULT 10.00,
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unassignedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (zoneId) REFERENCES zones(id),
  UNIQUE KEY unique_zone_manager (userId, zoneId)
);
```

#### zone_manager_drivers
```sql
CREATE TABLE zone_manager_drivers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  zoneManagerId INT NOT NULL,
  driverId INT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unassignedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (zoneManagerId) REFERENCES zone_managers(id),
  FOREIGN KEY (driverId) REFERENCES driverProfiles(id),
  UNIQUE KEY unique_manager_driver (zoneManagerId, driverId)
);
```

#### customer_zone_assignments
```sql
CREATE TABLE customer_zone_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL UNIQUE,
  zoneId INT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (zoneId) REFERENCES zones(id),
  INDEX idx_zone (zoneId),
  INDEX idx_user (userId)
);
```

#### garbage_pickups
```sql
CREATE TABLE garbage_pickups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customerId INT NOT NULL,
  zoneId INT NOT NULL,
  zoneManagerId INT,
  driverId INT,
  address TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  status ENUM('pending', 'accepted', 'assigned', 'arrived', 'completed', 'cancelled') DEFAULT 'pending',
  notes TEXT,
  scheduledTime TIMESTAMP,
  acceptedAt TIMESTAMP NULL,
  assignedAt TIMESTAMP NULL,
  arrivedAt TIMESTAMP NULL,
  completedAt TIMESTAMP NULL,
  cancelledAt TIMESTAMP NULL,
  cancellationReason TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES users(id),
  FOREIGN KEY (zoneId) REFERENCES zones(id),
  FOREIGN KEY (zoneManagerId) REFERENCES zone_managers(id),
  FOREIGN KEY (driverId) REFERENCES driverProfiles(id),
  INDEX idx_zone (zoneId),
  INDEX idx_customer (customerId),
  INDEX idx_driver (driverId),
  INDEX idx_status (status)
);
```

#### pickup_assignments
```sql
CREATE TABLE pickup_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pickupId INT NOT NULL,
  driverId INT NOT NULL,
  assignedBy INT, -- NULL if driver accepted, zoneManagerId if manual assignment
  status ENUM('pending', 'accepted', 'assigned', 'completed', 'cancelled') DEFAULT 'pending',
  acceptedAt TIMESTAMP NULL,
  assignedAt TIMESTAMP NULL,
  completedAt TIMESTAMP NULL,
  cancelledAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pickupId) REFERENCES garbage_pickups(id),
  FOREIGN KEY (driverId) REFERENCES driverProfiles(id),
  FOREIGN KEY (assignedBy) REFERENCES zone_managers(id),
  UNIQUE KEY unique_pickup_driver (pickupId, driverId),
  INDEX idx_driver (driverId),
  INDEX idx_status (status)
);
```

---

## 4. API ENDPOINT DESIGN

### Zone Manager Endpoints
```
POST   /api/zone-managers/assign
GET    /api/zone-managers/:zoneManagerId
GET    /api/zones/:zoneId/managers
DELETE /api/zone-managers/:zoneManagerId/remove
```

### Driver Assignment Endpoints
```
POST   /api/zone-managers/:zoneManagerId/drivers/assign
GET    /api/zone-managers/:zoneManagerId/drivers
DELETE /api/zone-managers/:zoneManagerId/drivers/:driverId/remove
```

### Customer Zone Assignment Endpoints
```
POST   /api/customers/assign-zone (auto-assign based on address)
GET    /api/customers/:customerId/zone
GET    /api/zones/:zoneId/customers
```

### Garbage Pickup Endpoints
```
POST   /api/pickups/create (customer requests pickup)
GET    /api/pickups/available (drivers in zone)
POST   /api/pickups/:pickupId/accept (driver accepts)
POST   /api/pickups/:pickupId/assign (zone manager assigns)
POST   /api/pickups/:pickupId/complete (driver completes)
GET    /api/pickups/:pickupId
GET    /api/pickups/history/:userId
```

---

## 5. ROLE-BASED ACCESS CONTROL

| Role | Can Do |
|------|--------|
| admin | Create zones, assign zone managers, view all data |
| zone_manager | Assign drivers, manually assign pickups, view customers, view pickups |
| driver | Accept pickups, complete pickups, view earnings |
| user (customer) | Request pickups, view status, pay |

---

## 6. REAL-TIME FEATURES

### WebSocket Events
- `pickup_available` - Broadcast to drivers when new pickup created
- `pickup_assigned` - Notify driver when manually assigned
- `driver_accepted` - Notify customer when driver accepts
- `driver_arrived` - Notify customer when driver arrives
- `pickup_completed` - Notify customer when pickup completed

### Polling Fallback
- Drivers poll `/api/pickups/available` every 10 seconds
- Customers poll `/api/pickups/:pickupId` for status updates

---

## 7. VALIDATION RULES

| Action | Validation |
|--------|-----------|
| Assign zone manager | User must exist, role must be admin or zone_manager |
| Assign driver | Driver must be approved, not suspended, not already assigned |
| Request pickup | Customer must be in customer_zone_assignments |
| Accept pickup | Pickup must be pending, driver must be in same zone |
| Manual assign | Zone manager must manage zone, driver must be under manager |
| Complete pickup | Pickup must be assigned/arrived |

---

## 8. ERROR HANDLING

| Error | Status | Message |
|-------|--------|---------|
| Zone not found | 404 | Zone does not exist |
| Driver not in zone | 400 | Driver is not assigned to this zone |
| Pickup already assigned | 400 | Pickup has already been assigned |
| Unauthorized | 403 | You don't have permission for this action |
| Invalid coordinates | 400 | Coordinates are outside assigned zone |

---

**Status**: ✅ DESIGN COMPLETE - Ready for implementation
