# LTC Fast Track - Complete API Documentation

## Zone Manager and Garbage Pickup Workflows

This document describes all API endpoints for the complete zone hierarchy and garbage collection workflows.

---

## Table of Contents

1. [Zone Manager Management](#zone-manager-management)
2. [Driver Assignment](#driver-assignment)
3. [Customer Zone Assignment](#customer-zone-assignment)
4. [Garbage Pickup Management](#garbage-pickup-management)
5. [Error Handling](#error-handling)
6. [Authentication](#authentication)

---

## Zone Manager Management

### Assign Zone Manager to Zone

**Endpoint**: `POST /trpc/zoneManager.assignZoneManager`

**Role**: Admin only

**Input**:
```json
{
  "userId": 1,
  "zoneId": 1,
  "commissionRate": 10.0
}
```

**Response**:
```json
{
  "success": true,
  "zoneManagerId": 1,
  "message": "Zone manager assigned successfully"
}
```

**Errors**:
- `Unauthorized: Admin access required` - User is not admin
- Zone manager already assigned to this zone

---

### Get Zone Managers by Zone

**Endpoint**: `GET /trpc/zoneManager.getZoneManagersByZone`

**Role**: Admin, Zone Manager

**Input**:
```json
{
  "zoneId": 1
}
```

**Response**:
```json
{
  "success": true,
  "managers": [
    {
      "id": 1,
      "userId": 1,
      "zoneId": 1,
      "status": "active",
      "commissionRate": 10.0,
      "assignedAt": "2026-04-07T23:00:00Z",
      "userName": "John Manager",
      "userEmail": "john@example.com",
      "userPhone": "+260971234567"
    }
  ],
  "total": 1
}
```

---

### Get Zone Manager Details

**Endpoint**: `GET /trpc/zoneManager.getZoneManagerDetails`

**Role**: Any authenticated user

**Input**:
```json
{
  "zoneManagerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "manager": {
    "id": 1,
    "userId": 1,
    "zoneId": 1,
    "status": "active",
    "commissionRate": 10.0,
    "assignedAt": "2026-04-07T23:00:00Z",
    "userName": "John Manager",
    "userEmail": "john@example.com",
    "userPhone": "+260971234567",
    "zoneName": "Zone A - Central",
    "zoneCity": "Lusaka"
  }
}
```

---

### Remove Zone Manager

**Endpoint**: `POST /trpc/zoneManager.removeZoneManager`

**Role**: Admin only

**Input**:
```json
{
  "zoneManagerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Zone manager removed successfully"
}
```

---

## Driver Assignment

### Assign Driver to Zone Manager

**Endpoint**: `POST /trpc/zoneManager.assignDriver`

**Role**: Zone Manager only

**Input**:
```json
{
  "zoneManagerId": 1,
  "driverId": 1
}
```

**Response**:
```json
{
  "success": true,
  "assignmentId": 1,
  "message": "Driver assigned successfully"
}
```

**Errors**:
- `Unauthorized: Zone Manager access required`
- `Driver already assigned to this zone manager`

---

### Get Assigned Drivers

**Endpoint**: `GET /trpc/zoneManager.getAssignedDrivers`

**Role**: Any authenticated user

**Input**:
```json
{
  "zoneManagerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "drivers": [
    {
      "id": 1,
      "userId": 1,
      "fullName": "James Driver",
      "phone": "+260971234567",
      "email": "james@example.com",
      "vehicleType": "motorcycle",
      "plateNumber": "ABC123",
      "isOnline": true,
      "isApproved": true,
      "isSuspended": false,
      "averageRating": 4.8,
      "totalCompletedJobs": 150,
      "assignedAt": "2026-04-07T23:00:00Z"
    }
  ],
  "total": 1
}
```

---

### Remove Driver from Zone Manager

**Endpoint**: `POST /trpc/zoneManager.removeDriver`

**Role**: Zone Manager only

**Input**:
```json
{
  "zoneManagerId": 1,
  "driverId": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Driver removed successfully"
}
```

---

## Customer Zone Assignment

### Assign Customer to Zone

**Endpoint**: `POST /trpc/zoneManager.assignCustomerToZone`

**Role**: Customer (self), Admin

**Input**:
```json
{
  "userId": 1,
  "zoneId": 1,
  "address": "123 Main Street, Lusaka",
  "latitude": -15.4067,
  "longitude": 28.2733
}
```

**Response**:
```json
{
  "success": true,
  "assignmentId": 1,
  "message": "Customer assigned to zone successfully"
}
```

---

### Get Customer Zone Assignment

**Endpoint**: `GET /trpc/zoneManager.getCustomerZoneAssignment`

**Role**: Customer (self), Admin

**Input**:
```json
{
  "userId": 1
}
```

**Response**:
```json
{
  "success": true,
  "assignment": {
    "id": 1,
    "userId": 1,
    "zoneId": 1,
    "address": "123 Main Street, Lusaka",
    "latitude": -15.4067,
    "longitude": 28.2733,
    "assignedAt": "2026-04-07T23:00:00Z",
    "zoneName": "Zone A - Central",
    "zoneCity": "Lusaka"
  }
}
```

**Errors**:
- `Customer not assigned to any zone`

---

### Get Customers in Zone

**Endpoint**: `GET /trpc/zoneManager.getCustomersByZone`

**Role**: Admin, Zone Manager

**Input**:
```json
{
  "zoneId": 1
}
```

**Response**:
```json
{
  "success": true,
  "customers": [
    {
      "id": 1,
      "name": "Alice Customer",
      "email": "alice@example.com",
      "phone": "+260971234567",
      "address": "123 Main Street",
      "latitude": -15.4067,
      "longitude": 28.2733,
      "assignedAt": "2026-04-07T23:00:00Z"
    }
  ],
  "total": 1
}
```

---

## Garbage Pickup Management

### Create Pickup Request

**Endpoint**: `POST /trpc/garbagePickup.createPickup`

**Role**: Customer

**Input**:
```json
{
  "customerId": 1,
  "address": "123 Main Street",
  "latitude": -15.4067,
  "longitude": 28.2733,
  "notes": "Please ring doorbell twice"
}
```

**Response**:
```json
{
  "success": true,
  "pickupId": 1,
  "message": "Pickup request created successfully",
  "zoneId": 1
}
```

**Errors**:
- `Customer not assigned to any zone`

---

### Get Pickup Details

**Endpoint**: `GET /trpc/garbagePickup.getPickup`

**Role**: Any authenticated user

**Input**:
```json
{
  "pickupId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickup": {
    "id": 1,
    "customerId": 1,
    "zoneId": 1,
    "zoneManagerId": null,
    "driverId": null,
    "address": "123 Main Street",
    "latitude": -15.4067,
    "longitude": 28.2733,
    "status": "pending",
    "notes": "Please ring doorbell twice",
    "createdAt": "2026-04-07T23:00:00Z"
  }
}
```

---

### Driver Accept Pickup

**Endpoint**: `POST /trpc/garbagePickup.acceptPickup`

**Role**: Driver

**Input**:
```json
{
  "pickupId": 1,
  "driverId": 1
}
```

**Response**:
```json
{
  "success": true,
  "assignmentId": 1,
  "message": "Pickup accepted successfully"
}
```

**Errors**:
- `Pickup not found`
- `Pickup is already {status}`

---

### Driver Mark Arrived

**Endpoint**: `POST /trpc/garbagePickup.markArrived`

**Role**: Driver

**Input**:
```json
{
  "pickupId": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pickup marked as arrived"
}
```

---

### Driver Complete Pickup

**Endpoint**: `POST /trpc/garbagePickup.completePickup`

**Role**: Driver

**Input**:
```json
{
  "pickupId": 1,
  "notes": "Pickup completed successfully"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pickup completed successfully"
}
```

---

### Customer Cancel Pickup

**Endpoint**: `POST /trpc/garbagePickup.cancelPickup`

**Role**: Customer

**Input**:
```json
{
  "pickupId": 1,
  "reason": "Changed my mind"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pickup cancelled successfully"
}
```

**Errors**:
- `Pickup is already {status}`

---

### Get Available Pickups for Driver

**Endpoint**: `GET /trpc/garbagePickup.getAvailablePickupsForDriver`

**Role**: Driver

**Input**:
```json
{
  "zoneId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickups": [
    {
      "id": 1,
      "customerId": 1,
      "zoneId": 1,
      "address": "123 Main Street",
      "latitude": -15.4067,
      "longitude": 28.2733,
      "status": "pending",
      "notes": "Please ring doorbell twice",
      "createdAt": "2026-04-07T23:00:00Z"
    }
  ],
  "total": 1
}
```

---

### Get Driver Active Pickups

**Endpoint**: `GET /trpc/garbagePickup.getDriverActivePickups`

**Role**: Driver, Admin

**Input**:
```json
{
  "driverId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickups": [
    {
      "id": 1,
      "address": "123 Main Street",
      "status": "accepted",
      "driverId": 1,
      "createdAt": "2026-04-07T23:00:00Z",
      "customerName": "Alice Customer",
      "customerPhone": "+260971234567"
    }
  ],
  "total": 1
}
```

---

### Get Driver Completed Pickups

**Endpoint**: `GET /trpc/garbagePickup.getDriverCompletedPickups`

**Role**: Driver, Admin

**Input**:
```json
{
  "driverId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickups": [
    {
      "id": 1,
      "address": "123 Main Street",
      "status": "completed",
      "driverId": 1,
      "createdAt": "2026-04-07T23:00:00Z",
      "completedAt": "2026-04-07T23:30:00Z",
      "customerName": "Alice Customer",
      "customerPhone": "+260971234567"
    }
  ],
  "total": 1
}
```

---

### Get Customer Pickup History

**Endpoint**: `GET /trpc/garbagePickup.getCustomerPickupHistory`

**Role**: Customer (self), Admin

**Input**:
```json
{
  "customerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickups": [
    {
      "id": 1,
      "address": "123 Main Street",
      "status": "completed",
      "driverId": 1,
      "createdAt": "2026-04-07T23:00:00Z",
      "completedAt": "2026-04-07T23:30:00Z",
      "driverName": "James Driver",
      "driverPhone": "+260971234567"
    }
  ],
  "total": 1
}
```

---

### Get Unassigned Pickups for Zone Manager

**Endpoint**: `GET /trpc/garbagePickup.getUnassignedPickupsForManager`

**Role**: Zone Manager

**Input**:
```json
{
  "zoneManagerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "pickups": [
    {
      "id": 1,
      "customerId": 1,
      "zoneId": 1,
      "address": "123 Main Street",
      "latitude": -15.4067,
      "longitude": 28.2733,
      "status": "pending",
      "notes": "Please ring doorbell twice",
      "createdAt": "2026-04-07T23:00:00Z",
      "customerName": "Alice Customer",
      "customerPhone": "+260971234567"
    }
  ],
  "total": 1
}
```

---

### Zone Manager Assign Pickup to Driver

**Endpoint**: `POST /trpc/garbagePickup.assignPickupToDriver`

**Role**: Zone Manager

**Input**:
```json
{
  "pickupId": 1,
  "driverId": 1,
  "zoneManagerId": 1
}
```

**Response**:
```json
{
  "success": true,
  "assignmentId": 1,
  "message": "Pickup assigned to driver successfully"
}
```

**Errors**:
- `Pickup not found`
- `Pickup is already {status}`
- `Driver is not assigned to this zone manager`

---

## Error Handling

### Common Error Responses

**Unauthorized Access**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized: Admin access required"
  }
}
```

**Resource Not Found**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Zone manager not found"
  }
}
```

**Invalid Input**:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Coordinates are outside assigned zone"
  }
}
```

**Conflict**:
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Driver already assigned to this zone manager"
  }
}
```

---

## Authentication

All endpoints require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### User Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access to all endpoints |
| `zone_manager` | Manage drivers, customers, manual assignments |
| `driver` | Accept/complete pickups, view available jobs |
| `user` | Create pickups, view history, cancel |

---

## Workflow Examples

### Example 1: Complete Garbage Pickup Workflow

```bash
# 1. Customer creates pickup
POST /trpc/garbagePickup.createPickup
{
  "customerId": 1,
  "address": "123 Main Street",
  "latitude": -15.4067,
  "longitude": 28.2733
}
# Response: pickupId = 1

# 2. Driver sees available pickup
GET /trpc/garbagePickup.getAvailablePickupsForDriver?zoneId=1

# 3. Driver accepts pickup
POST /trpc/garbagePickup.acceptPickup
{
  "pickupId": 1,
  "driverId": 1
}

# 4. Driver marks arrived
POST /trpc/garbagePickup.markArrived
{
  "pickupId": 1
}

# 5. Driver completes pickup
POST /trpc/garbagePickup.completePickup
{
  "pickupId": 1,
  "notes": "Completed successfully"
}

# 6. Customer views pickup history
GET /trpc/garbagePickup.getCustomerPickupHistory?customerId=1
```

### Example 2: Zone Manager Manual Assignment

```bash
# 1. Zone manager sees unassigned pickups
GET /trpc/garbagePickup.getUnassignedPickupsForManager?zoneManagerId=1

# 2. Zone manager views available drivers
GET /trpc/zoneManager.getAssignedDrivers?zoneManagerId=1

# 3. Zone manager assigns pickup to driver
POST /trpc/garbagePickup.assignPickupToDriver
{
  "pickupId": 1,
  "driverId": 1,
  "zoneManagerId": 1
}

# 4. Driver completes pickup
POST /trpc/garbagePickup.completePickup
{
  "pickupId": 1
}
```

---

## Rate Limiting

No rate limiting is currently implemented. Implement based on your infrastructure requirements.

---

## Versioning

Current API version: **1.0.0**

---

**Last Updated**: April 7, 2026
**Status**: Production Ready
