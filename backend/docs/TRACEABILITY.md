# SRS traceability

Maps each requirement of *RetailTrack Inventory Management System SRS - Group 17* to what implements it and what tests it. The SRS has no requirement numbers, so the IDs below (AUTH-1, PRD-1, ...) are assigned here, in the order the SRS lists them, for reference only.

Test files are in [`../tests/`](../tests/). "DB" means [`../database/schema.sql`](../database/schema.sql). "Verified in Postgres" means the SQL was run in a real PostgreSQL engine during development; `npm test` itself uses an in-memory fake database.

## Functional requirements

### User authentication and access

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| AUTH-1 | Registered users can log in | `POST /auth/login` | auth.test: login succeeds |
| AUTH-2 | Validate username/email and password | zod `loginBody`; bcrypt comparison | auth.test: login |
| AUTH-3 | Identify the user's role after login | Login returns `role` and `roleLabel`; `GET /auth/me` | auth.test: login, protected routes |
| AUTH-4 | Restrict protected features by role | `authenticate` + `authorize(...)` on every router | role cases in every suite |
| AUTH-5 | Users can log out | Stateless JWT: the client discards the token. Changing the password or deactivating the account invalidates all existing tokens server-side | auth.test: password change revokes tokens, deactivation |
| AUTH-6 | Clear error for invalid credentials | Same 401 message for unknown email and wrong password | auth.test: login rejects generically |

### Product management

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| PRD-1 | Add products | `POST /products` (A, S - see deviation 1) | catalog.test: products create |
| PRD-2 | Edit product information | `PATCH /products/:id` (A, S) | catalog.test: update |
| PRD-3 | View product details | `GET /products`, `GET /products/:id` (all roles; cashiers without cost) | catalog.test: cashiers view |
| PRD-4 | Deactivate products | `PATCH /products/:id/status`; inactive products cannot be sold and leave alerts/totals | catalog.test; sales.test: inactive; inventory.test: inactive |
| PRD-5 | Store names, SKUs, selling prices | `products.name`, `sku` (unique), `selling_price` | catalog.test: duplicate SKU |
| PRD-6 | Maintain stock quantity | `products.current_stock`, changed only by DB functions | inventory.test, sales.test |
| PRD-7 | Define a minimum stock level | `products.minimum_stock` | catalog.test |
| PRD-8 | Validate required product information | zod `createBody` / `updateBody`; DB check constraints | catalog.test: validation |
| PRD-9 | Category management (test scenario) | `/categories` CRUD (A), delete blocked while in use | catalog.test: categories |

### Inventory management

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| INV-1 | Display current stock | `stock` on every product; `GET /inventory/summary` | inventory.test: summary |
| INV-2 | Admin and Inventory Staff record stock additions | `POST /inventory/restock` (A, S); cashiers get 403 | inventory.test: restock, role gate |
| INV-3 | Update stock after a valid addition | `add_stock_atomic` (row lock, history row) | inventory.test; verified in Postgres |
| INV-4 | Reduce stock automatically after a completed sale | `create_sale_atomic`, `complete_sale_atomic` | sales.test: completed sale deducts; verified in Postgres |
| INV-5 | Compare stock with the minimum | Generated column `products.stock_status` | catalog.test, inventory.test: alerts |
| INV-6 | Identify products at or below minimum | `LOW_STOCK` when `stock <= minimum`; `OUT_OF_STOCK` at zero | inventory.test: "stock <= minimum" |
| INV-7 | Display low-stock information | `GET /inventory/alerts`, dashboard `lowStock` | inventory.test, reports.test: dashboard |
| INV-8 | Inventory summaries | `GET /inventory/summary`, `GET /reports/inventory` | inventory.test, reports.test |
| INV-9 | Validate quantities before updating | zod (whole number >= 1); adjustments need a reason and cannot go below zero | inventory.test: validation |
| INV-10 | Prevent a sale from reducing stock below the allowed quantity | Stock check under row lock inside `create_sale_atomic` and `complete_sale_atomic`; DB `check (current_stock >= 0)` | sales.test: overselling; verified in Postgres |

### Sales management

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| SAL-1 | Admin and Cashier record sales | `POST /sales` (A, C); Inventory Staff read-only | sales.test: role access |
| SAL-2 | Search products | `GET /products?search=` (name or SKU) | catalog.test: search |
| SAL-3 | Show available stock of a selected product | `stock` on the product | catalog.test |
| SAL-4 | Add products and quantities to a sale | `items[]` with `productId`, `qty` | sales.test |
| SAL-5 | Subtotal per product and total | Computed in the database from the database price | sales.test: snapshot prices |
| SAL-6 | Validate quantities against stock | `create_sale_atomic` | sales.test: oversell, bad input |
| SAL-7 | Update stock after a successful sale | As INV-4, with a `SALE_DEDUCTION` history row | sales.test; inventory history |
| SAL-8 | Prevent a sale above available stock | As INV-10; nothing is saved on failure | sales.test: no side effects |

### Dashboard

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| DSH-1 | Total active products | `stats.activeProducts` | reports.test: dashboard |
| DSH-2 | Current inventory information | `unitsInStock`, `inventoryValue`, `stockBreakdown` | reports.test |
| DSH-3 | Sales summary | `periodRevenue`, `periodOrders`, `salesSeries` | reports.test |
| DSH-4 | Low-stock products | `lowStock` | reports.test |
| DSH-5 | Recent sales | `recentSales` | reports.test |
| DSH-6 | Relevant inventory statistics | `stats`, `recentTransactions` | reports.test |
| DSH-7 | Role-specific dashboard | One endpoint shaped by role; cashiers see only own sales, no cost data | reports.test: dashboard by role |

### Reporting and analytics

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| RPT-1 | Inventory reports | `GET /reports/inventory` (A, S) | reports.test: inventory report |
| RPT-2 | Sales summaries | `GET /reports/sales` (A) | reports.test: sales report |
| RPT-3 | Analyse product sales activity | `topProducts`, `byCategory`; `/reports/profit` `byProduct` | reports.test |
| RPT-4 | Identify fast-moving products | `GET /reports/movement` -> `FAST` | reports.test: movement |
| RPT-5 | Identify slow-moving products | `SLOW` and `NO_SALES` (rule in API.md) | reports.test: movement, classifyMovement |
| RPT-6 | Filter reports | `from`, `to`, `bucket`, `categoryId`, `status`, `movement`, `search` | reports.test: filters |

### Search, filtering and alerts

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| SRC-1 | Search products by name or code | `GET /products?search=` (filter-injection safe) | catalog.test |
| SRC-2 | Filter inventory | Product list `status`, `categoryId`, `active`; alerts `severity`; history `type`, dates | catalog.test, inventory.test |
| SRC-3 | Filter reports | As RPT-6 | reports.test |
| ALR-1 | Compare stock with minimum and identify low products | As INV-5, INV-6 | inventory.test |
| ALR-2 | Display low-stock alerts to authorized users | `/inventory/alerts` (A, S), dashboard `lowStock` | inventory.test |
| ALR-3 | Low-stock products visually distinguishable | `stockStatus` and alert `severity` for the UI to style | catalog.test, inventory.test |

### Roles and privileges

| ID | SRS requirement | Implementation | Tests |
| --- | --- | --- | --- |
| ROL-1 | Admin: manage users | `/users` (A only), safeguards for the last admin and self | auth.test: admin manages users, safeguards |
| ROL-2 | Admin: products, inventory, sales, dashboard, reports, alerts, search | All routes allow `ADMIN` | every suite |
| ROL-3 | Cashier: log in, search, view products, check stock, process sales | Products read-only; `POST /sales`; own-sales view | sales.test, catalog.test |
| ROL-4 | Inventory Staff: view products, add stock, manage inventory, stock levels, alerts, inventory reports, product movement | `/inventory/*`, `/reports/inventory`, `/reports/movement`, product edit | inventory.test, reports.test |

## Non-functional requirements

| ID | SRS requirement | How it is met | Evidence |
| --- | --- | --- | --- |
| NFR-1 | Responsive performance, prompt stock updates, acceptable dashboard time | Indexes on hot columns; reports aggregate inside PostgreSQL; list endpoints are paged; stock changes are single transactions | `schema.sql` indexes; report functions verified in Postgres |
| NFR-2 | Acceptable performance as data grows | Paging everywhere; reading more than 1000 rows pages through results instead of truncating | `utils/db.js` `fetchAll` |
| NFR-3 | Passwords never stored in plain text; securely hashed | bcrypt (12 rounds), 8-72 characters | auth.test: login never exposes the hash |
| NFR-4 | Only registered users reach protected functions; credentials validated | `authenticate` middleware, live user lookup per request | auth.test: protected routes |
| NFR-5 | RBAC validated by the backend, unauthorized requests rejected | `authorize(...)` on every route; 401/403 | role cases in every suite |
| NFR-6 | Sensitive data not exposed through APIs; database access restricted | Explicit column lists (no `select *` of users), no hashes/costs for cashiers, Row Level Security with no policies, public roles revoked | auth.test, catalog.test; verified in Postgres |
| NFR-7 | HTTPS in production | Deployment concern: terminate TLS at the host and set `TRUST_PROXY=1` (see README) | Checklist in SUPABASE.md |
| NFR-8 | Testing: functional, unit, API, integration, role-based access, invalid input | 63 automated API/integration tests across 9 suites covering the SRS "main test scenarios": valid/invalid login, role access, product creation/editing, categories, stock addition, sales, automatic deduction, invalid quantity, low-stock detection, dashboard, reports, search, filtering | `npm test` |
| NFR-9 | Software interface: Node.js, Express, Supabase | As specified | `package.json`, `database/` |
| NFR-10 | Browser compatibility, UI design, usability | Frontend concern (not part of the API) | n/a |
| NFR-11 | Manual UI testing and user acceptance testing | Process activities for the team; the Postman collection supports API-level manual testing | [`../postman/`](../postman/) |

## Deviations from the SRS and additions

1. **Product add / edit / deactivate is open to Inventory Staff as well as Admin.** The SRS says "the Admin" for these, but also lets Inventory Staff "manage inventory operations", and the project owner decided both roles maintain products. Deleting a product and managing categories stay Admin-only.
2. **Logout** is client-side (the token is discarded). There is no server-side session list; password change, password reset and deactivation revoke all tokens.
3. **Fast / slow moving** has no numeric definition in the SRS. The rule used (top / bottom third of products that sold, plus no-sales) is documented in API.md and easy to change in `reportService.js`.
4. **Frontend stack:** the SRS names React/Next.js and Tailwind CSS; the frontend is React with Vite and plain CSS. This does not affect the API.
5. **Additions beyond the SRS, requested by the project owner to match the frontend:** pending orders, customer returns with restocking, purchase orders, cost price with gross profit/loss reporting (Admin only), store settings, email verification and password recovery by one-time code, optional Cloudinary images, and JSON backup/restore (also able to import backups from the old browser-only frontend).
6. **Out of scope per the SRS** and not built: accounting, barcode scanners, receipt printers, multi-store.
