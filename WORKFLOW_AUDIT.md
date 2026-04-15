# LTC Fast Track - Workflow Routing Audit Report

## Executive Summary

The current system has a **fragmented architecture** with missing database tables, incomplete API endpoints, and no automatic assignment logic. The workflow hierarchy is not properly implemented.

**Current State**: ❌ **BROKEN** - Mock data, incomplete routing, no zone-based customer assignment

---

## 1. CURRENT ARCHITECTURE ANALYSIS

### 1.1 Database Schema Status

#### ✅ EXISTING TABLES
- `zones` - Zone definitions (name, city, boundaries, status)
- `zoneCollectors` - Many-to-many junction (zone ↔ collector)
- `users` - Core users table (with role: user, admin, driver, carrier)
- `driverProfiles` - Driver-specific data
- `transportJobs` - Transport bookings
- `customerWallets` - Customer balance tracking
- `paymentTransactions` - Payment ledger

#### ❌ MISSING TABLES (CRITICAL)
1. **zone_managers** - Zone manager profiles and assignments
   - Missing: userId, zoneId, assignedAt, status, commissionRate
   
2. **zone_manager_drivers** - Zone manager → drivers relationship
   - Missing: zoneManagerId, driverId, assignedAt, status
   
3. **customer_zone_assignments** - Automatic customer → zone mapping
   - Missing: customerId, zoneId, assignedAt, address, latitude, longitude
   
4. **garbage_pickups** - Garbage collection jobs (different from transport jobs)
   - Missing: customerId, zoneId, zoneManagerId, driverId, status, scheduledTime, completedTime
   
5. **pickup_assignments** - Manual driver assignment by zone manager
   - Missing: pickupId, driverId, assignedBy (zoneManagerId), assignedAt, status

### 1.2 API Router Status

#### ✅ EXISTING ROUTERS
- `zoneRouter` - Zone CRUD operations (mostly mock data)
- `collectorRouter` - Collector zone details (mock data)
- `bookingsRouter` - Transport job handling
- `driverRouter` - Driver profiles and status

#### ❌ MISSING ROUTERS / ENDPOINTS
1. **Zone Manager Management**
   - ❌ Assign zone manager to zone
   - ❌ List zone managers by zone
   - ❌ Get zone manager details
   - ❌ Remove zone manager from zone

2. **Driver Assignment by Zone Manager**
   - ❌ Assign driver to zone manager
   - ❌ List drivers under zone manager
   - ❌ Remove driver from zone manager
   - ❌ Get driver availability in zone

3. **Customer Auto-Assignment**
   - ❌ Auto-assign customer to zone (based on location/address)
   - ❌ Get customers in zone
   - ❌ Reassign customer to different zone
   - ❌ Get customer's assigned zone manager

4. **Garbage Pickup Job Management**
   - ❌ Create pickup request (customer)
   - ❌ Get available pickups (drivers in zone)
   - ❌ Accept pickup (driver)
   - ❌ Manual assign pickup (zone manager → driver)
   - ❌ Complete pickup (driver)
   - ❌ Get pickup history (customer/driver/manager)

### 1.3 Business Logic Status

#### ❌ MISSING WORKFLOWS

**Workflow 1: Zone Admin → Zone Manager Assignment**
```
Zone Admin selects zone → Assigns zone manager
Currently: ❌ NO ENDPOINT
Should: Create zone_manager record, link to zone
```

**Workflow 2: Zone Manager → Driver Assignment**
```
Zone Manager selects drivers → Assigns to their zone
Currently: ❌ NO ENDPOINT
Should: Create zone_manager_drivers record, verify driver is in same zone
```

**Workflow 3: Customer Auto-Assignment to Zone**
```
Customer subscribes with address → Auto-assigned to zone → Auto-assigned to zone manager
Currently: ❌ NO LOGIC
Should: 
  1. Geocode customer address
  2. Find zone containing coordinates
  3. Create customer_zone_assignments record
  4. Link to zone manager(s) in that zone
```

**Workflow 4: Driver Receives Pinned Pickup Jobs**
```
Customer requests pickup → Drivers in zone see job → Driver accepts
Currently: ❌ NO LOGIC
Should:
  1. Create garbage_pickup record
  2. Query drivers assigned to zone
  3. Broadcast to drivers' real-time feed
  4. Driver accepts → Update pickup_assignments
```

**Workflow 5: Zone Manager Manual Driver Assignment**
```
Zone Manager sees unassigned pickup → Manually assigns to driver
Currently: ❌ NO ENDPOINT
Should:
  1. Zone manager calls assignPickupToDriver endpoint
  2. Verify driver is under zone manager
  3. Create pickup_assignments record
  4. Notify driver
```

---

## 2. DETAILED ISSUES

### Issue 1: No Zone Manager Hierarchy
**Problem**: System treats "collectors" as drivers but doesn't distinguish zone managers
**Impact**: Zone admins can't assign managers to zones
**Solution**: Create zone_managers table with proper hierarchy

### Issue 2: No Customer Zone Assignment
**Problem**: Customers aren't automatically assigned to zones
**Impact**: Customers can't receive pickups, zone managers can't see customers
**Solution**: Implement auto-assignment based on address/coordinates

### Issue 3: No Garbage Pickup Jobs Table
**Problem**: Using generic "transportJobs" for everything
**Impact**: Can't distinguish garbage pickups from carrier jobs
**Solution**: Create dedicated garbage_pickups table with zone/manager/driver fields

### Issue 4: No Driver Job Broadcasting
**Problem**: Drivers don't receive real-time pickup notifications
**Impact**: Drivers can't see available jobs in their zone
**Solution**: Implement WebSocket/polling for real-time job feed

### Issue 5: No Manual Assignment Workflow
**Problem**: Zone managers can't manually assign drivers to pickups
**Impact**: Zone managers have no control over job distribution
**Solution**: Create pickup_assignments table and endpoint

### Issue 6: Mock Data Everywhere
**Problem**: Zone router, collector router use hardcoded mock data
**Impact**: Can't test real workflows
**Solution**: Replace all mock data with actual database queries

---

## 3. PROPOSED SOLUTION ARCHITECTURE

### 3.1 Hierarchy Structure
```
Zone Admin (role: admin)
  ↓
Zone Manager (new table: zone_managers)
  ├─ Assigned to specific zone
  ├─ Can assign drivers
  └─ Can manually assign pickups
  
  ↓
Garbage Collection Drivers (existing: driverProfiles + new: zone_manager_drivers)
  ├─ Assigned to zone manager
  ├─ Receive pinned jobs in zone
  └─ Can accept/complete pickups

Customers (existing: users with role=user)
  ├─ Auto-assigned to zone (new: customer_zone_assignments)
  ├─ Auto-assigned to zone manager
  └─ Can request pickups
```

### 3.2 Data Flow
```
1. Customer requests pickup
   ↓
   Create garbage_pickup record
   ↓
   Query drivers in customer's zone
   ↓
   Broadcast to drivers' real-time feed
   ↓
   Driver accepts pickup
   ↓
   Create pickup_assignments record
   ↓
   Notify customer "Driver assigned"

2. Zone Manager Manual Override
   ↓
   Zone manager sees unassigned pickup
   ↓
   Calls assignPickupToDriver(pickupId, driverId)
   ↓
   Verify: driver is under zone manager + in same zone
   ↓
   Create pickup_assignments record
   ↓
   Notify driver
```

---

## 4. IMPLEMENTATION ROADMAP

### Phase 1: Database (Tables)
- [ ] Create zone_managers table
- [ ] Create zone_manager_drivers table
- [ ] Create customer_zone_assignments table
- [ ] Create garbage_pickups table
- [ ] Create pickup_assignments table

### Phase 2: API Endpoints
- [ ] Zone manager assignment endpoints
- [ ] Driver assignment endpoints
- [ ] Customer auto-assignment logic
- [ ] Garbage pickup CRUD endpoints
- [ ] Manual assignment endpoints

### Phase 3: Business Logic
- [ ] Auto-assign customers to zones (geocoding)
- [ ] Broadcast pickups to drivers
- [ ] Real-time job notifications
- [ ] Zone manager override logic

### Phase 4: Testing
- [ ] Unit tests for assignment logic
- [ ] Integration tests for workflows
- [ ] End-to-end tests

---

## 5. CURRENT CODE REFERENCES

### Routers
- `server/routers-zone.ts` - Zone management (has mock data)
- `server/routers-collector.ts` - Collector details (has mock data)
- `server/routers-bookings.ts` - Booking management
- `server/db-zones.ts` - Zone database functions

### Schema
- `drizzle/schema.ts` - Database definitions (missing zone_managers, etc.)

---

## 6. NEXT STEPS

1. **Create missing database tables** (Phase 3)
2. **Implement zone manager assignment logic** (Phase 4)
3. **Implement customer auto-assignment** (Phase 4)
4. **Create garbage pickup endpoints** (Phase 6)
5. **Implement driver job broadcasting** (Phase 6)
6. **Write comprehensive tests** (Phase 7)

---

**Status**: ⚠️ INCOMPLETE - Ready for implementation
**Priority**: CRITICAL - Core business logic missing
**Estimated Effort**: 4-5 days for full implementation
