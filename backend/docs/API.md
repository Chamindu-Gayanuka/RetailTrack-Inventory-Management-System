# RetailTrack API reference

Base URL `http://localhost:5000/api` (local). All bodies are JSON. A ready-to-use [Postman collection](../postman/) covers every endpoint.

Roles: **A** = Administrator (`ADMIN`), **S** = Inventory Staff (`INVENTORY_STAFF`), **C** = Cashier (`CASHIER`). "Any" means any signed-in user; "Public" needs no token.

## Contents

[Conventions](#conventions) | [Auth](#auth) | [Users and profile](#users-and-profile) | [Categories](#categories) | [Products](#products) | [Inventory](#inventory) | [Sales](#sales) | [Returns](#returns) | [Dashboard](#dashboard) | [Reports](#reports) | [Purchase orders](#purchase-orders) | [Settings](#settings) | [Backup and restore](#backup-and-restore) | [Errors](#errors)

## Conventions

```jsonc
// success
{ "success": true, "data": { }, "message": "optional" }
// list
{ "success": true, "data": [ ], "meta": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 } }
// error
{ "success": false, "message": "Validation failed.", "errors": { "price": ["Selling price cannot be negative."] } }
```

* Send `Authorization: Bearer <token>` on every route except those marked Public.
* IDs are UUIDs. Human numbers are separate fields: `saleNumber` (`SALE-1033`), `returnNumber` (`RET-1001`), `poNumber` (`PO-000001`).
* Paging: `page` (from 1) and `limit` (default and maximum differ per endpoint, see below).
* `from` is inclusive and `to` exclusive for date filters in reports; for list filters both compare `createdAt`. Use ISO 8601, for example `2025-03-01T00:00:00+05:30`.
* Numbers may be sent as numbers or numeric strings.

---

## Auth

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Sign in |
| GET | `/auth/me` | Any | Current user |
| POST | `/auth/change-password` | Any | Change own password |
| POST | `/auth/forgot-password` | Public | Email a reset code |
| POST | `/auth/verify-reset-otp` | Public | Check the code, receive a reset token |
| POST | `/auth/reset-password` | Public | Set a new password with the reset token |
| POST | `/auth/email-verification/send` | Any | Email a verification code |
| POST | `/auth/email-verification/confirm` | Any | Confirm the code |

**Login** `{ "email": "admin@apekade.lk", "password": "..." }`

```json
{ "success": true, "message": "Signed in successfully.",
  "data": { "token": "eyJ...", "user": { "id": "...", "name": "Admin", "email": "admin@apekade.lk", "phone": "", "avatar": null,
    "role": "ADMIN", "roleLabel": "Administrator", "active": true, "emailVerified": true, "lastActive": "2025-03-01T08:00:00Z", "createdAt": "..." } } }
```

Wrong email or password: `401` with the same message either way. Deactivated account: `403`. Login, password and code endpoints are rate limited (`429`).

**Change password** `{ "currentPassword": "...", "newPassword": "min 8 characters" }` returns a fresh `token` and `user`. Every other session is signed out.

**Password recovery**

1. `POST /auth/forgot-password` `{ "email" }` always answers `200` ("If an account exists..."), whether or not the email is registered.
2. `POST /auth/verify-reset-otp` `{ "email", "otp": "123456" }` returns `{ "resetToken" }` (valid 15 minutes). Wrong code: `400` with attempts remaining; 5 wrong attempts lock the code.
3. `POST /auth/reset-password` `{ "resetToken", "newPassword" }`. The token works once.

**Email verification** `send` (no body) then `confirm` `{ "otp" }`. Requesting again within 60 seconds returns `429`.

## Users and profile

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/users/me` | Any | Own profile |
| PATCH | `/users/me` | Any | Update own `name`, `email`, `phone`, `avatar` |
| GET | `/users` | A | List users. Query: `search`, `role`, `active` |
| POST | `/users` | A | Create a user |
| GET | `/users/:id` | A | One user |
| PATCH | `/users/:id` | A | Update `name`, `phone`, `role` |
| PATCH | `/users/:id/status` | A | `{ "active": false }` deactivates or reactivates |

* **Create** `{ "name", "email", "phone"?, "role": "CASHIER" }`. A temporary password is generated and emailed. If email is not configured, the response includes `data.temporaryPassword` once so you can hand it over. `409` if the email exists.
* **Profile** changes to `email` mark it unverified again. `avatar` is an `https://` URL or a small base64 image data URL (JPG, PNG, WebP, GIF), or `null` to remove it. Role cannot be changed here.
* **Safeguards** (400): you cannot deactivate yourself, change your own role, or remove/deactivate the last active administrator. Users are never deleted, only deactivated.

## Categories

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/categories` | Any |
| POST | `/categories` | A |
| PATCH | `/categories/:id` | A |
| DELETE | `/categories/:id` | A |

Body `{ "name": "Plastic Items", "description"?: "...", "color"?: "#6574e8" }`. Names are unique ignoring case (`409`). Response includes `productCount`. Delete returns `409` while products use the category.

## Products

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/products` | Any | List and search |
| GET | `/products/next-sku?categoryId=` | A, S | Suggested next SKU (for example `PL-010`) |
| GET | `/products/:id` | Any | One product |
| POST | `/products` | A, S | Create |
| PATCH | `/products/:id` | A, S | Edit |
| PATCH | `/products/:id/status` | A, S | `{ "active": false }` |
| DELETE | `/products/:id` | A | Delete (only if never sold, moved or ordered) |

**List query**: `search` (name or SKU), `categoryId`, `status` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `INACTIVE`), `active`, `page`, `limit` (default 100, max 500).

**Product**

```json
{ "id": "...", "sku": "PL-001", "name": "Plastic Bucket 10L", "categoryId": "...", "categoryName": "Plastic Items",
  "price": 450, "cost": 285, "stock": 45, "minStock": 10, "active": true, "stockStatus": "IN_STOCK",
  "image": "https://...", "createdAt": "...", "updatedAt": "..." }
```

Cashiers do not receive `cost`. Low stock means `stock <= minStock` (and above zero); `OUT_OF_STOCK` is zero.

**Create** `{ "name", "categoryId", "price", "cost"?: 0, "stock"?: 0, "minStock"?: 0, "sku"?: auto, "active"?: true, "image"?: "" }`. A non-zero `stock` is recorded as opening stock in the stock history. Duplicate SKU: `409`.

**Edit** accepts any of `name`, `sku`, `categoryId`, `price`, `cost`, `minStock`, `active`, `image`. **Stock cannot be edited here**; use [Inventory](#inventory) so there is a history record.

**Images**: send `image` as a JPG/PNG/WebP data URL (`data:image/png;base64,...`) or an `https://` URL; `""` or `null` removes it. With Cloudinary configured the image is uploaded (max 800x800) and replaced/removed images are cleaned up; otherwise images up to about 700 KB are stored in the database. Sending the current URL back leaves it unchanged.

## Inventory

Roles: **A, S** for every endpoint.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/inventory/summary` | `activeProducts`, `totalUnits`, `stockValue` (at cost), `lowStockCount`, `outOfStockCount` |
| GET | `/inventory/alerts?severity=` | Active products at or below minimum, most urgent first |
| GET | `/inventory/transactions` | Stock history. Query: `productId`, `type`, `from`, `to`, `page`, `limit` (default 50, max 500) |
| POST | `/inventory/restock` | `{ "productId", "quantity", "note"? }` |
| POST | `/inventory/adjustments` | `{ "productId", "change": -3, "reason": "Damaged" }` |

* **Alert** `{ id, sku, name, stock, minStock, severity, suggestedRestock, ... }`. Severity: `critical` (zero), `warning` (<= 35% of minimum, at least 2), `attention` (otherwise). Suggested restock is `max(2 x minimum - stock, minimum)`.
* **Transaction** `{ type: "inbound"|"outbound", transactionType: "STOCK_ADDED"|"SALE_DEDUCTION"|"ADJUSTMENT"|"RETURN", title, productName, sku, quantity, quantityChange, previousQuantity, newQuantity, reason, note, performedBy, saleId, returnId, createdAt }`.
* **Restock / adjustment** return `{ productId, previousQuantity, newQuantity }`. Quantity must be a whole number of at least 1. An adjustment needs a reason (3+ characters), cannot be zero, and cannot take stock below zero (`400`).

## Sales

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/sales` | A, S: all sales. C: own sales | List. Query: `search` (sale number or customer), `status`, `payment`, `cashierId`, `from`, `to`, `page`, `limit` (50/500) |
| GET | `/sales/:id` | same | Detail with items and returns |
| POST | `/sales` | A, C | Create |
| POST | `/sales/:id/complete` | A, C | Complete a pending sale |
| POST | `/sales/:id/cancel` | A, C | Cancel a pending sale |

**Create**

```json
{ "customer": "Kamal", "payment": "Cash", "status": "Completed",
  "items": [ { "productId": "...", "qty": 3 }, { "productId": "...", "quantity": 1 } ] }
```

`payment`: `Cash`, `Card` or `Other` (default Cash). `status`: `Completed` (default) or `Pending`. `qty` and `quantity` are equivalent; repeated products are merged. **Prices come from the database** and are saved on the sale. A completed sale deducts stock immediately and records it in the stock history; a pending sale checks availability but takes no stock until completed. Selling more than the available stock, or an inactive product, returns `400` ("Insufficient stock for X (available: n)") and changes nothing.

**Sale**

```json
{ "id": "...", "saleNumber": "SALE-1033", "numericId": 1033, "customer": "Kamal",
  "items": [ { "productId": "...", "name": "Bucket", "sku": "PL-001", "qty": 3, "price": 450, "subtotal": 1350 } ],
  "itemCount": 3, "total": 1350, "payment": "CASH", "paymentLabel": "Cash", "status": "COMPLETED", "statusLabel": "Completed",
  "cashier": "Nimal", "cashierId": "...", "refundedTotal": 0, "returnStatus": null, "returnStatusLabel": null,
  "createdAt": "...", "completedAt": "..." }
```

`returnStatus` is `PARTIALLY_RETURNED` or `RETURNED` once customers return items. A cashier asking for another cashier's sale gets `404`. Inventory Staff get `403` on every write.

## Returns

All roles can process returns; cashiers see only returns they processed.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/returns` | List. Query: `saleId`, `from`, `to`, `page`, `limit` |
| GET | `/returns/eligible-sales?search=` | Completed sales that still have items to return, with `returnable` quantity per line. Open to every role so any staff member can find a receipt |
| GET | `/returns/:id` | One return |
| POST | `/returns` | `{ "saleId", "reason"?, "items": [ { "productId", "qty" } ] }` |

Only **completed** sales can be returned, never more than was sold minus earlier returns (`400` with the remaining quantity). Stock goes back automatically and appears in the stock history as an inbound `RETURN`. The return is valued at the price on the original sale.

## Dashboard

`GET /dashboard` (any role). Query: `from`, `to`, `bucket` (`auto|day|week|month|year`), `tz`. Default period: the last 7 days.

Returns `stats` (`activeProducts`, `categories`, `unitsInStock`, `lowStockProducts`, `periodRevenue`, `periodOrders`, `salesRecords`, and `inventoryValue` for A and S), `salesSeries`, `stockBreakdown` (`inStock`, `lowStock`, `critical`, `outOfStock`), `lowStock` (top 5), `recentSales` (5) and `recentTransactions` (4, A and S only). **Cashiers** see only their own sales figures and no inventory value or stock movements.

## Reports

Shared query: `from`, `to`, `bucket` (`auto` picks day/week/month/year by span), `tz` (minutes east of UTC, default 330), `categoryId`. Missing `from` means since the first sale; missing `to` means now. All figures are **net of customer returns**, and only completed sales count. Weeks start on Monday. Series are zero-filled.

| Method | Path | Roles | Returns |
| --- | --- | --- | --- |
| GET | `/reports/sales` | A | `totals` (`revenue`, `orders`, `units`, `averageOrderValue`), `bestPeriod`, `series`, `byCategory`, `topProducts` |
| GET | `/reports/profit` | A | `totals` (`revenue`, `cogs`, `grossProfit`, `marginPercent`), `series` (with `cost`, `profit`), `byProduct` sorted by profit |
| GET | `/reports/inventory` | A, S | Stock valuation. Query: `categoryId`, `status`, `search`. `totals` (`costValue`, `retailValue`, `potentialMargin`, counts) and `products` |
| GET | `/reports/movement` | A, S | Fast / slow / non-moving analysis. Extra query: `movement` (`FAST`, `NORMAL`, `SLOW`, `NO_SALES`) |

Profit uses the cost recorded on each sale, so later cost edits do not rewrite history. **Movement rule:** among products that sold in the period, the top third by units sold is `FAST`, the bottom third `SLOW`, the rest `NORMAL`; products with equal units share a class; products with no sales are `NO_SALES`. Each row has `unitsSold`, `unitsPerDay`, `stock`, `lastSoldAt`.

## Purchase orders

Roles: **A, S**.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/purchase-orders` | Query: `search` (PO number or supplier), `productId`, `from`, `to`, `page`, `limit` (50/500) |
| GET | `/purchase-orders/:id` | One order |
| POST | `/purchase-orders` | `{ "productId", "quantity", "supplier"? }` |

The order records the product's stock, minimum and cost at creation (`currentStock`, `minStock`, `unitCost`, `totalCost`), so it never changes later. Status is `CREATED`. The frontend renders the PDF from this data.

## Settings

| Method | Path | Roles | Purpose |
| --- | --- | --- | --- |
| GET | `/settings/public` | Public | `storeName`, `location` only (for the sign-in page) |
| GET | `/settings` | Any | All settings |
| PATCH | `/settings` | A | Any of `storeName`, `location`, `address`, `phone`, `email`, `currency`, `lowStockAlerts`, `saleNotifications`, `weeklySummary`, `emailAlerts` |

## Backup and restore

Roles: **A** only.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/backup/export` | Downloads one JSON file (`formatVersion: 3`) with settings, users, categories, products, sales, returns, stock history and purchase orders. No password hashes, tokens or codes |
| POST | `/backup/import` | Validate or restore |

**Import body**

```json
{ "backup": { "...": "contents of a backup file" }, "mode": "validate" }
```

```json
{ "backup": { }, "mode": "replace", "password": "your own password", "confirm": "REPLACE ALL DATA" }
```

* `mode: "validate"` (default) checks the file and returns `{ valid, applied: false, summary, warnings }`. Nothing changes.
* `mode: "replace"` needs your password and the exact phrase, then replaces all business data (categories, products, sales, returns, stock history, purchase orders, store settings) **in one transaction**; a failure changes nothing. Export a backup first.
* **User accounts are never deleted.** Accounts present only in the backup are added with an unusable password (they must use "Forgot password"). People referenced by the backup who are not accounts are replaced by you, with a warning.
* Totals, refunds and return status are recomputed from line items. The file is rejected with a clear message for duplicate SKUs or numbers, unknown categories/products/sales, returning more than was sold, or inconsistent stock numbers.
* Backups downloaded from the old browser-only frontend (`formatVersion` 1 or 2) are accepted and converted: labels such as `Cash` and `Administrator` are mapped, cashiers are matched by name, and stock history is rebuilt from current stock (movements that do not add up are skipped with a warning). Invalid or oversized images are dropped.

## Errors

| Status | Meaning | Example `message` |
| --- | --- | --- |
| 400 | Invalid input or business rule | `Validation failed.`, `Insufficient stock for X (available: 2)` |
| 401 | Missing, invalid or expired token; wrong credentials | `Authentication required.` |
| 403 | Role not allowed, or account deactivated | `You do not have permission to perform this action.` |
| 404 | Not found (also for records the caller may not see) | `Sale not found.` |
| 409 | Duplicate or in use | `SKU "PL-001" already exists in the system.` |
| 413 | Request body too large | `Request body is too large.` |
| 429 | Rate limited, or code requested too soon | `Too many authentication attempts. Please try again later.` |
| 502 / 503 | Optional service failed | `The image could not be uploaded. Please try again.` |
| 500 | Unexpected; details are only in the server log | `Internal server error.` |

Rate limits (per IP, per 15 minutes): 3000 requests overall, 30 authentication attempts, 10 code requests or checks.
