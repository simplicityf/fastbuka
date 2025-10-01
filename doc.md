## Complete API Endpoints List
Authentication Endpoints
Method	Endpoint	Description	Auth Required	Role Required
POST	/auth/signup	User registration	No	-
POST	/auth/login	User login	No	-
POST	/auth/me	Get ME	No	-

Meals Endpoints
Method	Endpoint	Description	Auth Required	Role Required
GET	/meals	Get all meals (with filters)	No	-
GET	/meals/categories	Get all meal categories	No	-
GET	/meals/:id	Get single meal	No	-
POST	/meals	Create new meal	Yes	VENDOR
PATCH	/meals/:id	Update meal	Yes	VENDOR
DELETE	/meals/:id	Delete meal	Yes	VENDOR

Orders Endpoints
Method	Endpoint	Description	Auth Required	Role Required
POST	/orders	Create new order	Yes	CUSTOMER
GET	/orders	Get user's orders	Yes	CUSTOMER/VENDOR
GET	/orders/:id	Get single order	Yes	CUSTOMER/VENDOR
PATCH	/orders/:id/status	Update order status	Yes	CUSTOMER/VENDOR

## API INTEGRATION Guide

* Step 1: User Registration

- Customer Registration:

```http
POST http://localhost:3000/auth/signup
```
```json
{
  "email": "customer@example.com",
  "password": "password123",
  "name": "John Customer",
  "username": "johncustomer",
  "role": "CUSTOMER",
  "gender": "MALE" | "FEMALE" | "OTHER",
  "phone": "+1234567890",
  "location": "New York"
}
```

- Vendor Registration:

```http
POST http://localhost:3000/auth/signup
```
```json
{
  "email": "vendor@example.com",
  "password": "password123",
  "name": "Jane Vendor",
  "role": "VENDOR",
  "gender": "MALE" | "FEMALE" | "OTHER",
  "phone": "+1234567891",
  "location": "New York",
  "restaurantName": "Tasty Bites",
  "businessId": "BUS123456",
  "companyPhone": "+1234567892"
}
```

* Step 2: User Login
```http
POST http://localhost:3000/auth/login
```
```json
{
  "email": "vendor@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "vendor@example.com",
    "name": "Jane Vendor",
    "role": "VENDOR"
  }
}
```

* Step 3: Create Meal (Vendor)
```http
POST http://localhost:3000/meals
```

```json
{
  "name": "Jollof Rice",
  "description": "Delicious Nigerian jollof rice with chicken",
  "price": 15.99,
  "imageUrl": "https://example.com/jollof.jpg",
  "categories": ["NIGERIA_DISH", "LOCAL"],
  "status": "IN_STOCK"
}
```

* Step 4: Get Meals
Query Parameters:
- categories - Comma-separated list of categories
- vendorId - Filter by vendor ID
- status - Filter by status (IN_STOCK, OUT_OF_STOCK)

```http
GET http://localhost:3000/meals
```

With Filters:
```http
GET http://localhost:3000/meals?categories=NIGERIA_DISH,SOUP&status=IN_STOCK
```

* Step 5: Place Order (Customer)
``` http
POST http://localhost:3000/orders
Content-Type: application/json
```
```json
{
  "mealId": "meal-uuid-here",
  "quantity": 2
}
```
Response:

```json
{
  "id": "order-uuid",
  "quantity": 2,
  "totalPrice": 31.98,
  "status": "ORDERED",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "customerId": "customer-uuid",
  "vendorId": "vendor-uuid",
  "mealId": "meal-uuid",
  "meal": {
    "id": "meal-uuid",
    "name": "Jollof Rice",
    "description": "Delicious Nigerian jollof rice",
    "price": 15.99,
    "imageUrl": "https://example.com/image.jpg",
    "status": "IN_STOCK",
    "categories": ["NIGERIA_DISH", "LOCAL"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "vendorId": "vendor-uuid"
  },
  "customer": {
    "id": "customer-uuid",
    "email": "customer@example.com",
    "name": "John Customer",
    "username": "johncustomer",
    "role": "CUSTOMER",
    "gender": "MALE",
    "phone": "+1234567890",
    "location": "New York",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "vendor": {
    "id": "vendor-uuid",
    "email": "vendor@example.com",
    "name": "Jane Vendor",
    "role": "VENDOR",
    "gender": "FEMALE",
    "phone": "+1234567891",
    "location": "New York",
    "restaurantName": "Tasty Bites",
    "businessId": "BUS123456",
    "companyPhone": "+1234567892",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

* Step 6: Update Order Status (Vendor)
``` http
PATCH http://localhost:3000/orders/order-uuid-here/status
Content-Type: application/json
```
```json
{
  "status": "PROCESSING"
}
```


