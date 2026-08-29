# VoltSpare: Flutter UI to API Map

This document maps all the screens from the Flutter frontend application to their required RESTful API endpoints on the backend server.

---

## 1. Admin Screens (Management Panel)

These endpoints are restricted to authenticated users with roles: `admin` or `staff`.

| Flutter Screen | UI Component / View Model / Action | Target REST API Endpoint | HTTP Method | Description / Payloads |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Login** | Login form for administrative staff | `/api/v1/auth/admin/login` | `POST` | Authenticate admin, returns JWT access and refresh tokens. |
| **Admin Dashboard** | Stats summary, cards & overview charts | `/api/v1/reports/dashboard-stats` | `GET` | Returns aggregated metrics: total sales, pending orders, rare request counts, active users. |
| **Orders (Admin)** | List of all system orders with search/filters | `/api/v1/orders` | `GET` | Get all orders, supports query params `?status=processing&page=1`. |
| **Order Detail (Admin)**| Individual order, items, addresses, payment status | `/api/v1/orders/:id` | `GET` | Retrieve complete details of a specific order. |
| | Update status of order (e.g. processing -> shipped) | `/api/v1/orders/:id/status` | `PATCH` | Body: `{ "status": "shipped" }`. |
| **Products (Admin)** | Product catalog table, add/edit/delete triggers | `/api/v1/products` | `GET` | List all products with advanced administration fields. |
| | Add new product details | `/api/v1/products` | `POST` | Body: product fields + compatibility details. |
| | Update an existing product | `/api/v1/products/:id` | `PUT` | Body: updated product properties. |
| | Delete/Archive product | `/api/v1/products/:id` | `DELETE` | Soft-deletes or archives the product. |
| **Inventory** | Stock levels list, alert for low stock | `/api/v1/inventory` | `GET` | List inventory item levels, stock counts, compatibility list. |
| | Update stock count manually | `/api/v1/inventory/:productId/stock` | `PATCH` | Body: `{ "quantity": 15 }`. |
| **Purchases** | Log vendor purchases to top up inventory | `/api/v1/purchases` | `GET` | Retrieve historic purchases from suppliers. |
| | Record a new supplier purchase | `/api/v1/purchases` | `POST` | Body: supplier ID, items list, unit cost, quantity. |
| **Suppliers** | Vendor listings, contact person & outstanding payments | `/api/v1/suppliers` | `GET` | List all active/inactive spare parts suppliers. |
| **Supplier Detail** | Details of individual supplier, purchase history | `/api/v1/suppliers/:id` | `GET` | Detailed profile of a specific supplier. |
| **Supplier Form** | Create new supplier | `/api/v1/suppliers` | `POST` | Body: company details, categories, Ev/Petrol flags. |
| | Update supplier profile | `/api/v1/suppliers/:id` | `PUT` | Body: updated supplier fields. |
| **Customers** | Registered customers list with profile links | `/api/v1/customers` | `GET` | View list of all retail customers, search by email/phone. |
| **Billing/POS** | In-store billing, POS transactions checkout | `/api/v1/billing/checkout` | `POST` | Body: customer info, items, discount, cash/card payment confirmation. |
| **Reports** | Periodic sales report data & charts | `/api/v1/reports/sales` | `GET` | Query params: `?startDate=...&endDate=...&format=json`. |
| **Staff Management**| List administrative staff users | `/api/v1/staff` | `GET` | Retrieve list of staff users (roles: `admin`, `inventory_staff`, `sales_staff`, `delivery_staff`). |
| | Add new staff member | `/api/v1/staff` | `POST` | Body: `{ "name", "email", "password", "phone", "role", "permissions", "status" }`. |
| | Get individual staff details | `/api/v1/staff/:id` | `GET` | Retrieve details of specific staff user. |
| | Update staff details | `/api/v1/staff/:id` | `PATCH` | Body: `{ "name", "email", "phone", "profileImage" }`. |
| | Update staff status | `/api/v1/staff/:id/status` | `PATCH` | Body: `{ "status": "active" \| "disabled" \| "suspended" }`. |
| | Update staff role & overrides | `/api/v1/staff/:id/role` | `PATCH` | Body: `{ "role": "...", "permissions": [...] }`. |
| | Soft-delete staff member | `/api/v1/staff/:id` | `DELETE` | Soft-deletes a staff user profile. |
| **Roles & Perms** | List all roles in system | `/api/v1/roles` | `GET` | List role catalog and permissions mapped. |
| | Create a new role | `/api/v1/roles` | `POST` | Body: `{ "name", "description", "permissions" }`. |
| | Update a role's permissions | `/api/v1/roles/:id` | `PATCH` | Body: `{ "permissions": [...] }`. |
| | Get all permissions | `/api/v1/permissions` | `GET` | Get flat list of all system permissions. |
| **Settings** | App globals: pricing rules, banner configurations | `/api/v1/settings` | `GET` / `PUT` | Read and write settings document. |
| **Rare Requests** | List of all submitted customer rare part requests | `/api/v1/rare-requests` | `GET` | Retrieve list of rare request models, sorted by urgency/date. |
| **Rare Request Chat** | Admin view of support chat log | `/api/v1/chat/:requestId` | `GET` | Retrieve message list for the conversation. |
| | Admin sends message to customer | `/api/v1/chat/:requestId/messages` | `POST` | Body: `{ "message": "...", "messageType": "text" }` |
| **Create Quotation** | Generate pricing quote for rare request | `/api/v1/quotations` | `POST` | Body: `{ "requestId", "partName", "price", "shippingCharge", "gst", "discount", "grandTotal", "deliveryTimeline", "expiryDate", "adminNotes" }`. |
| **Approved Request** | Admin processes and converts approved quote | `/api/v1/rare-requests/:id/approve` | `PATCH` | Triggers conversion of the approved rare request into an active order. |
| **Cancelled Request** | Admin handles declined request or cancels it | `/api/v1/rare-requests/:id/cancel` | `PATCH` | Body: `{ "reason": "Supplier out of stock" }`. Marks status as `cancelled`. |

---

## 2. Customer Screens

These endpoints are typically authenticated for the customer role, except catalog viewing.

| Flutter Screen | UI Component / View Model / Action | Target REST API Endpoint | HTTP Method | Description / Payloads |
| :--- | :--- | :--- | :--- | :--- |
| **Customer Login** | Sign in with email and password | `/api/v1/auth/customer/login` | `POST` | Authenticate customer, returns token payloads. |
| **Customer Register** | Create account view form | `/api/v1/auth/customer/register` | `POST` | Create a new user profile. Body: `{ name, email, password, phone }`. |
| **OTP Send** | Send OTP verification code to user | `/api/v1/auth/send-otp` | `POST` | Body: `{ email: "..." }` or `{ phone: "..." }`. Returns safe development mock OTP. |
| **OTP Verify** | Verify OTP verification code | `/api/v1/auth/verify-otp` | `POST` | Body: `{ identifier: "...", otp: "123456" }`. Marks phone/email as verified. |
| **Token Refresh** | Refresh access token | `/api/v1/auth/refresh-token` | `POST` | Body: `{ refreshToken: "..." }`. Returns rotated tokens. |
| **Logout** | Invalidate refresh token | `/api/v1/auth/logout` | `POST` | Body: `{ refreshToken: "..." }`. Revokes refresh token. |
| **Logout All** | Invalidate all refresh tokens | `/api/v1/auth/logout-all` | `POST` | Revokes all refresh tokens for current user (Header: `Authorization: Bearer <token>`). |
| **Profile (Me)** | Get profile data | `/api/v1/auth/me` | `GET` | Returns currently logged-in user profile and permissions list (Header: `Authorization: Bearer <token>`). |
| **Forgot Password** | Send password reset token | `/api/v1/auth/forgot-password` | `POST` | Body: `{ email }`. Generates reset token. |
| **Reset Password** | Reset password with token | `/api/v1/auth/reset-password` | `POST` | Body: `{ token, password }`. Resets user password. |
| **Change Password** | Change password while logged in | `/api/v1/auth/change-password` | `PATCH` | Body: `{ oldPassword, newPassword }`. Changes password (Header: `Authorization: Bearer <token>`). |
| **Customer Home** | Main landing page: banners, categories, products | `/api/v1/categories` | `GET` | List categories for motorcycle/scooter parts. |
| | Featured list & compatibility products | `/api/v1/products?featured=true` | `GET` | Fetch list of main featured items. |
| **Petrol/EV Selection** | Choose ev or petrol bike options | `/api/v1/settings/vehicle-selection` | `GET` | Retrieve system-supported vehicle types, brands, and models. |
| **Categories** | Browse items by custom category filters | `/api/v1/categories` | `GET` | Fetch categories list. |
| **Products** | Main catalog browser page | `/api/v1/products` | `GET` | Search and filter catalog by category, type, and compatibility. |
| **Product Detail** | Deep dive page for spare parts, rating, description | `/api/v1/products/:id` | `GET` | Detailed information including compatible bike list. |
| **Search** | Query bar with suggestions and filters | `/api/v1/products` | `GET` | Query params: `?search=chain+sprocket&compatibility=veh_ola_s1`. |
| **Wishlist** | Favorite items list | `/api/v1/wishlist` | `GET` | Retrieve current user's liked products. |
| | Add product to favorites | `/api/v1/wishlist` | `POST` | Body: `{ "productId": "..." }`. |
| | Remove item from wishlist | `/api/v1/wishlist/:productId` | `DELETE` | Remove relationship. |
| **Cart** | Current shopping cart contents | `/api/v1/cart` | `GET` | Fetch user's cart entries with parsed product info. |
| | Add / Update item quantity | `/api/v1/cart` | `POST` | Body: `{ "productId": "...", "quantity": 1 }`. |
| | Remove item from cart | `/api/v1/cart/:productId` | `DELETE` | Delete cart entry. |
| **Checkout** | Review order, select address and payment options | `/api/v1/orders` | `POST` | Body: `{ "addressId": "...", "paymentMethod": "...", "cartItems": [...] }`. |
| **Orders (Customer)**| Customer's historical purchases dashboard | `/api/v1/orders/my` | `GET` | List customer's orders, sorted by date. |
| **Order Detail** | Order summary and progress tracking | `/api/v1/orders/:id` | `GET` | Fetch order details, tracking steps, invoice details. |
| **Profile** | User profile form, updates, vehicle configurations | `/api/v1/users/profile` | `GET` / `PUT` | Read and write personal contact details. |
| **Addresses** | Addresses list | `/api/v1/addresses` | `GET` | List saved addresses. |
| | Add new delivery address | `/api/v1/addresses` | `POST` | Body: `{ name, phone, addressLine, isDefault }`. |
| | Edit address | `/api/v1/addresses/:id` | `PUT` | Update details. |
| | Remove address | `/api/v1/addresses/:id` | `DELETE` | Delete selected address. |
| **Rare Product Request**| Sourcing form: upload image, description, budget | `/api/v1/rare-requests` | `POST` | Multi-part form-data: upload photos and request data. |
| **My Rare Requests** | Customer's requested parts history table | `/api/v1/rare-requests/my` | `GET` | List all historical sourcing requests of this user. |
| **Customer Rare Chat**| Instant chat with admin support | `/api/v1/chat/:requestId` | `GET` | Load chat message history logs. |
| | Customer sends text/photo message | `/api/v1/chat/:requestId/messages` | `POST` | Body: `{ "message": "...", "messageType": "text" }`. |
| **Customer Quotation** | Detailed quote view: price breakdown, accept/decline | `/api/v1/quotations/:id` | `GET` | Retrieve pricing quote for the specific request. |
| **Approved Request** | Customer accepts quote, converts it to order | `/api/v1/rare-requests/:id/quotation/approve` | `PATCH` | Accept quote, changes status to `approved`. |
| **Cancelled Request** | Customer declines/cancels quote | `/api/v1/rare-requests/:id/quotation/decline` | `PATCH` | Body: `{ "reason": "Too expensive" }`. Changes status to `cancelled`. |
