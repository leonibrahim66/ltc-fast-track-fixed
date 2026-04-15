# Zone Admin & Zone Creation System Documentation

## Overview

The Zone Admin system enables Super Admins to create zone admins, who can then create and manage garbage collection zones. Zones can be created in two ways:

1. **Map Drawing**: Zone admins draw boundaries directly on a map (polygon, circle, or point)
2. **Name Detection**: System auto-detects zone boundaries based on zone name and coordinates

## Architecture

### Database Schema

#### New Tables

1. **zone_geometries** - Stores polygon/circle boundaries for zones
   - `zoneId` - Reference to zones table
   - `geometryType` - Type: polygon, circle, or point
   - `coordinates` - GeoJSON coordinates array
   - `centerLat/centerLng` - Center point for circle zones
   - `radiusMeters` - Radius for circle zones

2. **zone_admin_profiles** - Zone admin user profiles
   - `userId` - Reference to users table
   - `fullName` - Zone admin name
   - `phone` - Contact phone
   - `email` - Contact email
   - `isApproved` - Approval status by super admin
   - `approvedAt/approvedBy` - Approval tracking

3. **zone_admin_zones** - Many-to-many: zone admins to zones
   - `zoneAdminId` - Reference to zone_admin_profiles
   - `zoneId` - Reference to zones
   - `assignedAt` - When assignment occurred

4. **zone_audit_log** - Audit trail for all zone operations
   - `zoneId` - Zone being modified
   - `action` - Type: created, modified, deleted, boundary_updated, name_detected, auto_assigned_manager
   - `createdBy` - User who performed action
   - `details` - JSON details of changes

### API Endpoints

All endpoints are under `zoneAdmin` router:

#### Zone Admin Management

```typescript
// Create zone admin profile (Super Admin only)
POST /api/trpc/zoneAdmin.createZoneAdmin
{
  userId: number,
  fullName: string,
  phone: string,
  email?: string
}

// Approve zone admin (Super Admin only)
POST /api/trpc/zoneAdmin.approveZoneAdmin
{
  zoneAdminId: number
}

// Get all zone admins (Super Admin only)
GET /api/trpc/zoneAdmin.getAllZoneAdmins

// Get pending approvals (Super Admin only)
GET /api/trpc/zoneAdmin.getPendingApprovals

// Get zone admin profile
GET /api/trpc/zoneAdmin.getZoneAdminProfile
{
  zoneAdminId: number
}

// Assign zone admin to zone (Super Admin only)
POST /api/trpc/zoneAdmin.assignZoneAdminToZone
{
  zoneAdminId: number,
  zoneId: number
}

// Get zones managed by admin
GET /api/trpc/zoneAdmin.getZonesByAdmin
{
  zoneAdminId: number
}
```

#### Zone Creation

```typescript
// Create zone by drawing boundaries (Zone Admin or Super Admin)
POST /api/trpc/zoneAdmin.createZoneByDrawing
{
  name: string,
  city: string,
  description?: string,
  geometryType: "polygon" | "circle" | "point",
  coordinates: number[][] | number[],
  centerLat?: number,
  centerLng?: number,
  radiusMeters?: number
}

// Create zone by name detection (Zone Admin or Super Admin)
POST /api/trpc/zoneAdmin.createZoneByNameDetection
{
  name: string,
  city: string,
  description?: string,
  detectedCoordinates: number[][] | number[],
  centerLat: number,
  centerLng: number,
  radiusMeters: number
}

// Get zone geometry
GET /api/trpc/zoneAdmin.getZoneGeometry
{
  zoneId: number
}

// Update zone geometry (redraw boundaries)
POST /api/trpc/zoneAdmin.updateZoneGeometry
{
  zoneId: number,
  geometryType: "polygon" | "circle" | "point",
  coordinates: number[][] | number[],
  centerLat?: number,
  centerLng?: number,
  radiusMeters?: number
}

// Check if point is within zone
GET /api/trpc/zoneAdmin.isPointInZone
{
  zoneId: number,
  latitude: number,
  longitude: number
}

// Get zone audit log
GET /api/trpc/zoneAdmin.getZoneAuditLog
{
  zoneId: number
}

// Get zone statistics
GET /api/trpc/zoneAdmin.getZoneStatistics
{
  zoneId: number
}
```

## Workflows

### Workflow 1: Create Zone Admin

**Actors**: Super Admin

**Steps**:
1. Super Admin navigates to Zone Management Panel
2. Clicks "Create Zone Admin"
3. Fills in zone admin details (name, phone, email)
4. System creates zone admin profile with `isApproved = false`
5. Zone admin appears in "Pending Approvals" list

### Workflow 2: Approve Zone Admin

**Actors**: Super Admin

**Steps**:
1. Super Admin views "Pending Approvals" tab
2. Reviews zone admin details
3. Clicks "Approve"
4. System sets `isApproved = true` and `approvedAt = now()`
5. Zone admin can now create zones

### Workflow 3: Create Zone by Drawing

**Actors**: Zone Admin or Super Admin

**Steps**:
1. Zone Admin navigates to "Create Zone" screen
2. Selects "Draw on Map" method
3. Enters zone name, city, description
4. Selects geometry type (polygon, circle, or point)
5. **For Polygon**:
   - Clicks on map to add points
   - Minimum 3 points required
   - System calculates polygon area
6. **For Circle**:
   - Enters center latitude/longitude
   - Enters radius in meters
7. **For Point**:
   - Clicks single point on map
8. Clicks "Create Zone"
9. System stores zone with geometry
10. Audit log records "created" action
11. Zone is ready for use

### Workflow 4: Create Zone by Name Detection

**Actors**: Zone Admin or Super Admin

**Steps**:
1. Zone Admin navigates to "Create Zone" screen
2. Selects "Auto Detect" method
3. Enters zone name (e.g., "Central Lusaka")
4. Enters city name
5. Enters center coordinates (latitude/longitude)
6. Enters radius in meters
7. Clicks "Create Zone"
8. System auto-detects zone boundaries based on name
9. Creates zone with circle geometry
10. Audit log records "name_detected" action
11. Zone is ready for use

### Workflow 5: Update Zone Boundaries

**Actors**: Zone Admin or Super Admin

**Steps**:
1. Zone Admin navigates to existing zone
2. Clicks "Edit Boundaries"
3. Redraws zone boundaries on map
4. Clicks "Update"
5. System updates zone geometry
6. Audit log records "boundary_updated" action
7. All customers and drivers in zone are notified

### Workflow 6: Assign Zone Admin to Zone

**Actors**: Super Admin

**Steps**:
1. Super Admin navigates to "Assignments" tab
2. Selects zone admin and zone
3. Clicks "Assign"
4. System creates zone_admin_zones record
5. Audit log records "auto_assigned_manager" action
6. Zone admin can now manage that zone

## Geometry Types

### Polygon
- Multiple points forming a closed shape
- Minimum 3 points required
- Used for irregular zone boundaries
- Coordinates: `[[lat1, lng1], [lat2, lng2], [lat3, lng3], ...]`

### Circle
- Center point + radius
- Used for circular service areas
- Coordinates: `[centerLat, centerLng]`
- Radius: meters

### Point
- Single location
- Used for specific addresses or small areas
- Coordinates: `[lat, lng]`

## Point-in-Zone Detection

The system uses two algorithms to determine if a customer/driver is within a zone:

### For Polygon Zones
- **Ray Casting Algorithm**
- Draws a ray from point to infinity
- Counts intersections with polygon edges
- If odd number of intersections, point is inside

### For Circle Zones
- **Haversine Formula**
- Calculates distance from point to center
- If distance ≤ radius, point is inside
- Accounts for Earth's curvature

## Integration with Zone Manager Workflow

When a zone is created:

1. **Auto-Assignment of Zone Manager**
   - If zone admin is assigned to zone
   - Zone admin becomes zone manager
   - Can now assign drivers to zone

2. **Customer Auto-Assignment**
   - When customer's location is detected
   - System checks all zones
   - If customer is within zone, auto-assign to that zone's manager

3. **Driver Auto-Assignment**
   - When driver's location is detected
   - System checks all zones
   - If driver is within zone and assigned to zone manager
   - Driver receives pinned pickup jobs in that zone

## UI Components

### Zone Creation Screen
- **Location**: `app/admin/zone-creation.tsx`
- **Features**:
  - Method selection (Draw vs Auto-Detect)
  - Map drawing interface
  - Geometry type selection
  - Coordinate input
  - Radius configuration
  - Points management (add, undo, clear)

### Zone Management Panel
- **Location**: `app/admin/zone-management-panel.tsx`
- **Features**:
  - Zones tab: List, create, edit, delete zones
  - Admins tab: List, create, approve zone admins
  - Assignments tab: View zone admin to zone assignments
  - Statistics: Household count, collector count
  - Audit log: Track all zone modifications

## Security & Access Control

### Role-Based Access

| Operation | Super Admin | Zone Admin | Driver | Customer |
|-----------|-------------|-----------|--------|----------|
| Create Zone Admin | ✅ | ❌ | ❌ | ❌ |
| Approve Zone Admin | ✅ | ❌ | ❌ | ❌ |
| Create Zone | ✅ | ✅ | ❌ | ❌ |
| Update Zone | ✅ | ✅ | ❌ | ❌ |
| Delete Zone | ✅ | ❌ | ❌ | ❌ |
| Assign Zone Admin | ✅ | ❌ | ❌ | ❌ |
| View Zones | ✅ | ✅ | ✅ | ✅ |
| View Audit Log | ✅ | ✅ | ❌ | ❌ |

### Data Validation

- **Coordinates**: Must be valid latitude (-90 to 90) and longitude (-180 to 180)
- **Radius**: Must be positive, max 50km
- **Zone Name**: Required, minimum 1 character
- **City**: Required, minimum 1 character
- **Polygon**: Minimum 3 points required

## Testing

Comprehensive test suite in `tests/zone-admin-creation.test.ts`:

- Zone admin profile creation and approval
- Zone creation workflows (drawing and name detection)
- Geometry validation
- Point-in-zone detection algorithms
- Audit logging
- Role-based access control
- Error handling
- End-to-end workflows

**Run tests**:
```bash
npm test
```

## Database Migration

To apply the schema changes to production:

```sql
-- Run migration file
source drizzle/migrations/0001_zone_hierarchy.sql;
```

Or use Drizzle CLI:
```bash
pnpm drizzle-kit migrate
```

## Future Enhancements

1. **Real-Time Map Drawing**
   - WebSocket updates for live boundary drawing
   - Multi-user collaboration on zone creation

2. **Geocoding Integration**
   - Auto-detect zone boundaries from address
   - Reverse geocoding for zone lookup

3. **Zone Optimization**
   - Suggest optimal zone boundaries based on demand
   - Automatic zone splitting when too large

4. **Advanced Geometry**
   - Support for multi-polygon zones
   - Donut/ring-shaped zones
   - Custom boundary shapes

5. **Mobile App Integration**
   - Zone creation from mobile app
   - Real-time zone visualization
   - Driver location tracking within zones

## Support & Troubleshooting

### Issue: Zone creation fails
- Check all required fields are filled
- Verify coordinates are valid
- Ensure at least 3 points for polygon

### Issue: Point-in-zone detection not working
- Verify zone geometry exists
- Check coordinate format (lat, lng)
- Ensure zone is active

### Issue: Zone admin can't see assigned zones
- Verify zone admin is approved
- Check zone_admin_zones table for assignment
- Verify zone status is active

## API Examples

### Create Zone by Drawing (Polygon)
```typescript
const response = await trpc.zoneAdmin.createZoneByDrawing.mutate({
  name: "Central Lusaka",
  city: "Lusaka",
  description: "Central business district",
  geometryType: "polygon",
  coordinates: [
    [-15.4067, 28.2733],
    [-15.4100, 28.2800],
    [-15.4000, 28.2800],
    [-15.4067, 28.2733],
  ],
});
```

### Create Zone by Name Detection
```typescript
const response = await trpc.zoneAdmin.createZoneByNameDetection.mutate({
  name: "Central Lusaka",
  city: "Lusaka",
  detectedCoordinates: [[-15.4067, 28.2733]],
  centerLat: -15.4067,
  centerLng: 28.2733,
  radiusMeters: 5000,
});
```

### Check if Point is in Zone
```typescript
const response = await trpc.zoneAdmin.isPointInZone.query({
  zoneId: 1,
  latitude: -15.4080,
  longitude: 28.2750,
});

if (response.isInZone) {
  // Customer/driver is within zone
}
```

## Conclusion

The Zone Admin system provides a complete solution for creating and managing garbage collection zones. Zone admins can create zones through intuitive map drawing or automatic name detection, while Super Admins maintain oversight through the Zone Management Panel.
