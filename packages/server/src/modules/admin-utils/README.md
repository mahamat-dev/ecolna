# Admin Utils Module - Audit Log & Global Search

This module provides administrative utilities for the ecolna application, including audit logging and global search functionality.

## Features

### 1. Audit Log System
- **Comprehensive Event Tracking**: Records all significant system events
- **Cursor-based Pagination**: Efficient pagination for large datasets
- **Advanced Filtering**: Filter by entity type, action, actor, date range, and text search
- **Full-text Search**: PostgreSQL FTS support with ILIKE fallback
- **Actor Information**: Tracks user ID, roles, and IP address
- **Metadata Support**: JSON metadata for complex event data

### 2. Global Search
- **Multi-entity Search**: Search across users, students, teachers, and sections
- **Flexible Type Selection**: Choose which entity types to search
- **Performance Optimized**: Efficient queries with proper indexing
- **Configurable Limits**: Prevent resource exhaustion

## API Endpoints

### Audit Endpoints

#### `GET /api/admin/audit`
Retrieve audit logs with filtering and pagination.

**Query Parameters:**
- `entityType` (optional): Filter by entity type
- `entityId` (optional): Filter by specific entity ID
- `action` (optional): Filter by action type
- `actorUserId` (optional): Filter by actor user ID
- `from` (optional): Start date filter (ISO string)
- `to` (optional): End date filter (ISO string)
- `q` (optional): Text search in summary and metadata
- `limit` (optional): Number of results (1-200, default: 50)
- `cursorAt` (optional): Cursor timestamp for pagination
- `cursorId` (optional): Cursor ID for pagination

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "at": "2024-01-01T00:00:00.000Z",
      "actorUserId": "uuid",
      "actorRoles": ["ADMIN"],
      "ip": "192.168.1.1",
      "action": "USER_CREATE",
      "entityType": "USER",
      "entityId": "uuid",
      "summary": "Created new user",
      "meta": { "additional": "data" }
    }
  ],
  "nextCursor": {
    "cursorAt": "2024-01-01T00:00:00.000Z",
    "cursorId": "uuid"
  }
}
```

#### `GET /api/admin/audit/:id`
Retrieve a specific audit log entry.

### Search Endpoints

#### `GET /api/admin/search`
Global search across multiple entity types.

**Query Parameters:**
- `q` (required): Search query (minimum 2 characters)
- `types` (optional): Comma-separated entity types (users,students,teachers,sections,guardians)
- `limit` (optional): Number of results per type (1-50, default: 20)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "loginId": "user123",
      "isActive": true
    }
  ],
  "students": [
    {
      "profileId": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "userId": "uuid"
    }
  ],
  "teachers": [...],
  "sections": [...],
  "guardians": [...]
}
```

## Usage Examples

### Writing Audit Events

```typescript
import { writeAudit, actorFromReq } from './audit.service';
import { db } from '../../db/client';

// In a route handler
app.post('/api/users', async (req, res) => {
  const actor = actorFromReq(req);
  
  // Create user logic...
  const newUser = await createUser(userData);
  
  // Log the event
  await writeAudit(db, {
    action: 'USER_CREATE',
    entityType: 'USER',
    entityId: newUser.id,
    summary: `Created user ${newUser.email}`,
    meta: { userData },
    ...actor
  });
  
  res.json(newUser);
});
```

### Using in Transactions

```typescript
import { auditTx } from './audit.service';

db.transaction(async (tx) => {
  // Business logic...
  const result = await tx.insert(users).values(userData);
  
  // Log within transaction
  await auditTx(tx, {
    action: 'USER_CREATE',
    entityType: 'USER',
    entityId: result.id,
    summary: 'User created in transaction',
    actorUserId: req.session.user.id
  });
});
```

## Database Schema

The audit system uses the `audit_log` table with the following key columns:

- `id`: UUID primary key
- `at`: Timestamp with timezone
- `actor_user_id`: Foreign key to users table
- `actor_roles`: Array of role strings
- `ip`: IP address of the actor
- `action`: Action identifier (free text)
- `entity_type`: Type of entity affected
- `entity_id`: ID of the affected entity
- `summary`: Human-readable description
- `meta`: JSONB metadata
- `tsv`: Full-text search vector (generated)

## Security & RBAC

- **Admin-only Access**: All endpoints require ADMIN role
- **IP Tracking**: Automatically captures client IP addresses
- **Role Tracking**: Records user roles at time of action
- **Audit Trail**: All access is logged for security auditing

## Performance Considerations

- **Indexes**: Optimized indexes on frequently queried columns
- **Cursor Pagination**: Efficient pagination for large datasets
- **Query Limits**: Configurable limits to prevent resource exhaustion
- **FTS Optimization**: PostgreSQL full-text search with GIN indexes

## Error Handling

The module provides comprehensive error handling:

- **Validation Errors**: 400 status with detailed error information
- **Not Found**: 404 status for missing resources
- **Server Errors**: 500 status with generic error messages
- **Audit Failures**: Non-blocking audit failures to prevent business logic interruption

## Backward Compatibility

The module maintains backward compatibility with the legacy audit system through:

- Legacy column support in database schema
- Re-export of legacy functions in `src/utils/audit.ts`
- Gradual migration path for existing code