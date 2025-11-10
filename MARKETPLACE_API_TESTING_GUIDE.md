# Marketplace API Testing Guide

## Base URL
```
http://localhost:YOUR_PORT/api/v1/marketplace
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 1. Create Listing (POST)

**Endpoint:** `POST /api/v1/marketplace`

**Description:** Create a new marketplace listing

**Request Body:**
```json
{
  "title": "Vintage Bicycle",
  "description": "A beautiful vintage bicycle in excellent condition. Perfect for commuting.",
  "price": 250.00,
  "category": "Electronics",
  "mediaUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}
```

**cURL Command:**
```bash
curl -X POST http://localhost:3000/api/v1/marketplace \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Vintage Bicycle",
    "description": "A beautiful vintage bicycle in excellent condition.",
    "price": 250.00,
    "category": "Electronics",
    "mediaUrls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }'
```

**Response (201 Created):**
```json
{
  "id": "123456789",
  "seller_id": "550e8400-e29b-41d4-a716-446655440000",
  "neighborhood_id": "987654321",
  "title": "Vintage Bicycle",
  "description": "A beautiful vintage bicycle in excellent condition.",
  "price": 250.00,
  "category": "Electronics",
  "status": "available",
  "location": "POINT(-122.4194 37.7749)",
  "created_at": "2024-01-15T10:30:00.000Z",
  "media": [
    {
      "id": "111",
      "url": "https://example.com/image1.jpg"
    },
    {
      "id": "112",
      "url": "https://example.com/image2.jpg"
    }
  ]
}
```

---

## 2. Search Listings (GET)

**Endpoint:** `GET /api/v1/marketplace`

**Description:** Search for listings by location, category, and keywords

**Query Parameters:**
- `lat` (required): Latitude (e.g., 37.7749)
- `lon` (required): Longitude (e.g., -122.4194)
- `radius` (optional): Search radius in meters (default: 5000)
- `category` (optional): Filter by category
- `q` (optional): Search query for title/description

**cURL Command:**
```bash
# Basic search
curl -X GET "http://localhost:3000/api/v1/marketplace?lat=37.7749&lon=-122.4194&radius=5000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Search with category filter
curl -X GET "http://localhost:3000/api/v1/marketplace?lat=37.7749&lon=-122.4194&category=Electronics&radius=3000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Search with keyword
curl -X GET "http://localhost:3000/api/v1/marketplace?lat=37.7749&lon=-122.4194&q=bicycle&radius=5000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
[
  {
    "id": "123456789",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "neighborhood_id": "987654321",
    "title": "Vintage Bicycle",
    "description": "A beautiful vintage bicycle...",
    "price": 250.00,
    "category": "Electronics",
    "status": "available",
    "created_at": "2024-01-15T10:30:00.000Z",
    "distance_meters": 1234.56,
    "media": [
      {
        "id": "111",
        "url": "https://example.com/image1.jpg"
      }
    ],
    "seller": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe"
    }
  }
]
```

---

## 3. Get Listing by ID (GET)

**Endpoint:** `GET /api/v1/marketplace/:id`

**Description:** Get a specific listing by its ID

**cURL Command:**
```bash
curl -X GET http://localhost:3000/api/v1/marketplace/123456789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "id": "123456789",
  "seller_id": "550e8400-e29b-41d4-a716-446655440000",
  "neighborhood_id": "987654321",
  "title": "Vintage Bicycle",
  "description": "A beautiful vintage bicycle in excellent condition.",
  "price": 250.00,
  "category": "Electronics",
  "status": "available",
  "location": "POINT(-122.4194 37.7749)",
  "created_at": "2024-01-15T10:30:00.000Z",
  "media": [
    {
      "id": "111",
      "url": "https://example.com/image1.jpg"
    }
  ],
  "seller": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "full_name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## 4. Get My Listings (GET)

**Endpoint:** `GET /api/v1/marketplace/my-listings`

**Description:** Get all listings created by the current authenticated user

**cURL Command:**
```bash
curl -X GET http://localhost:3000/api/v1/marketplace/my-listings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
[
  {
    "id": "123456789",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "neighborhood_id": "987654321",
    "title": "Vintage Bicycle",
    "description": "A beautiful vintage bicycle...",
    "price": 250.00,
    "category": "Electronics",
    "status": "available",
    "created_at": "2024-01-15T10:30:00.000Z",
    "media": [
      {
        "id": "111",
        "url": "https://example.com/image1.jpg"
      }
    ],
    "seller": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe"
    },
    "neighborhood": {
      "id": "987654321",
      "name": "Downtown Neighborhood"
    }
  }
]
```

---

## 5. Update Listing (PUT/PATCH)

**Endpoint:** `PUT /api/v1/marketplace/:id` or `PATCH /api/v1/marketplace/:id`

**Description:** Update a listing (seller only - must own the listing)

**Request Body (all fields optional):**
```json
{
  "title": "Updated Bicycle Title",
  "description": "Updated description",
  "price": 200.00,
  "category": "Sports",
  "status": "sold",
  "mediaUrls": [
    "https://example.com/new-image1.jpg",
    "https://example.com/new-image2.jpg"
  ],
  "updateLocation": false
}
```

**cURL Command:**
```bash
# Update with PUT
curl -X PUT http://localhost:3000/api/v1/marketplace/123456789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Updated Bicycle Title",
    "price": 200.00,
    "status": "sold",
    "mediaUrls": [
      "https://example.com/new-image1.jpg"
    ]
  }'

# Update with PATCH (same as PUT)
curl -X PATCH http://localhost:3000/api/v1/marketplace/123456789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "description": "Updated description",
    "category": "Sports"
  }'
```

**Response (200 OK):**
```json
{
  "id": "123456789",
  "seller_id": "550e8400-e29b-41d4-a716-446655440000",
  "neighborhood_id": "987654321",
  "title": "Updated Bicycle Title",
  "description": "Updated description",
  "price": 200.00,
  "category": "Sports",
  "status": "sold",
  "location": "POINT(-122.4194 37.7749)",
  "created_at": "2024-01-15T10:30:00.000Z",
  "media": [
    {
      "id": "222",
      "url": "https://example.com/new-image1.jpg"
    }
  ]
}
```

**Note:** 
- Only the seller can update their own listing
- If `mediaUrls` is provided, it will replace all existing media
- Set `updateLocation: true` to update location from user's address

---

## 6. Delete Listing (DELETE)

**Endpoint:** `DELETE /api/v1/marketplace/:id`

**Description:** Delete a listing (seller only - must own the listing)

**cURL Command:**
```bash
curl -X DELETE http://localhost:3000/api/v1/marketplace/123456789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "message": "Listing deleted successfully"
}
```

**Error Response (403 Forbidden - if not owner):**
```json
{
  "message": "Not authorized to delete this listing"
}
```

---

## 7. Admin: Get All Listings (GET)

**Endpoint:** `GET /api/v1/marketplace/admin/all`

**Description:** Get all listings with optional filters (admin function)

**Query Parameters (all optional):**
- `status`: Filter by status (e.g., "available", "sold")
- `category`: Filter by category
- `sellerId`: Filter by seller user ID
- `neighborhoodId`: Filter by neighborhood ID
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset (default: 0)

**cURL Command:**
```bash
# Get all listings
curl -X GET http://localhost:3000/api/v1/marketplace/admin/all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get with filters
curl -X GET "http://localhost:3000/api/v1/marketplace/admin/all?status=available&category=Electronics&limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get by seller
curl -X GET "http://localhost:3000/api/v1/marketplace/admin/all?sellerId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
[
  {
    "id": "123456789",
    "seller_id": "550e8400-e29b-41d4-a716-446655440000",
    "neighborhood_id": "987654321",
    "title": "Vintage Bicycle",
    "description": "A beautiful vintage bicycle...",
    "price": 250.00,
    "category": "Electronics",
    "status": "available",
    "created_at": "2024-01-15T10:30:00.000Z",
    "media": [
      {
        "id": "111",
        "url": "https://example.com/image1.jpg"
      }
    ],
    "seller": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "full_name": "John Doe",
      "email": "john@example.com"
    },
    "neighborhood": {
      "id": "987654321",
      "name": "Downtown Neighborhood"
    }
  }
]
```

---

## 8. Admin: Update Listing Status (PATCH)

**Endpoint:** `PATCH /api/v1/marketplace/admin/:id`

**Description:** Update listing status (admin can update any listing)

**Request Body:**
```json
{
  "status": "sold"
}
```

**cURL Command:**
```bash
curl -X PATCH http://localhost:3000/api/v1/marketplace/admin/123456789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "status": "sold"
  }'
```

**Response (200 OK):**
```json
{
  "id": "123456789",
  "seller_id": "550e8400-e29b-41d4-a716-446655440000",
  "neighborhood_id": "987654321",
  "title": "Vintage Bicycle",
  "description": "A beautiful vintage bicycle...",
  "price": 250.00,
  "category": "Electronics",
  "status": "sold",
  "created_at": "2024-01-15T10:30:00.000Z",
  "media": [
    {
      "id": "111",
      "url": "https://example.com/image1.jpg"
    }
  ],
  "seller": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "full_name": "John Doe"
  }
}
```

**Common Status Values:**
- `"available"` - Listing is available
- `"sold"` - Item has been sold
- `"pending"` - Sale is pending
- `"removed"` - Listing has been removed

---

## 9. Admin: Delete Listing (DELETE)

**Endpoint:** `DELETE /api/v1/marketplace/admin/:id`

**Description:** Delete any listing (admin function)

**cURL Command:**
```bash
curl -X DELETE http://localhost:3000/api/v1/marketplace/admin/123456789 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "message": "Listing deleted successfully by admin"
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "message": "Not authorized, no token"
}
```

### 403 Forbidden (Not Owner)
```json
{
  "message": "Not authorized to update this listing"
}
```

### 404 Not Found
```json
{
  "message": "Listing not found"
}
```

### 400 Bad Request
```json
{
  "message": "Invalid listing data. Title and numeric price are required."
}
```

---

## Testing Workflow Example

1. **Create a listing:**
   ```bash
   POST /api/v1/marketplace
   ```

2. **Get your listings:**
   ```bash
   GET /api/v1/marketplace/my-listings
   ```

3. **Update the listing:**
   ```bash
   PUT /api/v1/marketplace/{listing_id}
   ```

4. **Search for listings:**
   ```bash
   GET /api/v1/marketplace?lat=37.7749&lon=-122.4194
   ```

5. **Get specific listing:**
   ```bash
   GET /api/v1/marketplace/{listing_id}
   ```

6. **Delete the listing:**
   ```bash
   DELETE /api/v1/marketplace/{listing_id}
   ```

---

## Postman Collection

You can import these endpoints into Postman:

1. Create a new collection: "Marketplace API"
2. Set collection variable: `base_url` = `http://localhost:3000/api/v1/marketplace`
3. Set collection variable: `token` = `YOUR_JWT_TOKEN`
4. Add Authorization header to all requests: `Bearer {{token}}`

---

## Notes

- All endpoints require authentication
- User endpoints verify ownership (seller_id must match authenticated user)
- Admin endpoints are currently accessible to all authenticated users (add admin middleware if needed)
- BigInt IDs are automatically converted to strings in responses
- Location is stored as PostGIS geography type
- Media URLs are stored separately in the media table

