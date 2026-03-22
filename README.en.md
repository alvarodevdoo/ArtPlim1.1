# ArtPlim ERP - Detailed System Guide

**ArtPlim ERP** is a robust management (ERP) and automation platform specifically designed for the **visual communication and printing industry**. The system utilizes a modern, scalable, and multi-tenant architecture.

---

## 🏛️ Project Architecture and Structure

### Folder Hierarchy (Root)
- **`backend/`**: REST API built with Fastify and Node.js. Uses Prisma as the ORM.
  - `prisma/`: Database schema and migrations.
  - `src/modules/`: Business logic separated by domain.
  - `src/shared/`: Global middlewares, utilities, and errors.
- **`frontend/`**: React Single Page Application (Vite).
  - `src/pages/`: Main system screens.
  - `src/components/`: Reusable UI components (based on Shadcn/Radix).
  - `src/hooks/`: Shared logic for state and WebSockets.
- **`docs/`**: Repository for technical documentation, fix history, and usage guides.
- **`scripts/`**: Maintenance utilities, database seeds, and performance tests.

---

## ⚙️ System Modules (Backend)

Each module in `backend/src/modules/` operates in isolation, communicating via the database:

1.  **Auth**:
    - Multi-tenant login (validation by organization).
    - JWT tokens and RBAC (Role-Based Access Control: Admin, Manager, Production, Sales).
2.  **Catalog (Catalog and Pricing)**:
    - **Products**: Sellable items with dimensions (area), units, or formulas.
    - **Pricing Rules**: Dynamic engine that evaluates complex JSON formulas. Supports automatic versioning to ensure old orders maintain their original price even if the rule changes.
3.  **Sales**:
    - **Budgets (Quotes)**: Quick quote creation with automatic calculation.
    - **Orders**: Conversion of quotes into firm orders, generating a full status history.
4.  **Production**:
    - **Production Queue**: Management of items entering the factory floor.
    - **Change Requests**: Approval system for changes to orders that have already started production, ensuring financial and productive integrity.
5.  **Finance**:
    - Cash flow, order integration, payment methods, and bank reconciliation.
6.  **WMS (Inventory Management)**:
    - Tracking of raw materials and leftovers (offcuts).
    - Critical level alerts using configurable thresholds per material.

---

## 🖥️ Screen Guide (Frontend)

- **Dashboard**: Dynamic panel with sales charts, Average Ticket, and real-time production status.
- **Orders**: Central sales list. Includes filters by status, customer, and date. Allows viewing the full history of who moved the order through each phase.
- **Production (Kanban)**: Visual board where production items are moved between columns (e.g., Art, Printing, Finishing, Shipping). Uses **WebSockets** for instant updates across all logged-in users.
- **Products**: Catalog management. Includes the **Formula Editor**, where you can configure how each item is calculated (markup, material costs, machine operation).
- **Customers (CRM)**: Unified profile registration. A profile can be both a Customer and a Supplier simultaneously.
- **Settings**: Admin panel to enable/disable modules (e.g., "Use WMS", "Enable Automation") and configure company data.

---

## 🔄 Typical Workflow (Business Workflow)

1.  **Quote**: Salesperson creates a quote -> System calculates the price using **Pricing Rules** -> Customer approves.
2.  **Conversion**: The quote becomes an **Order** -> Finance confirms payment/conditions.
3.  **Production**: The order generates items in the **Production Queue** -> Operators move items on the **Kanban**.
4.  **Change (Optional)**: If the customer changes the dimensions, the system generates a **Change Request** -> Manager approves -> Price and production are automatically updated.
5.  **Finalization**: The item is marked as delivered -> Status migrates to Finished -> Stock is automatically updated via **Inventory** modules.

---

## 📊 Data Structure (Prisma Deep Dive)

- **Organization (Tenant)**: The heart of the system. All tables have an `organizationId`.
- **Profiles**: Generic entity for people/companies. Boolean attributes determine the role (`isCustomer`, `isSupplier`, `isEmployee`).
- **Standard Sizes / Materials**: Supporting tables that feed the calculation engine, allowing for standardization of dimensions and input costs.
- **InventoryMovements**: Auditable log of every stock entry and exit.

---

## 🚀 How to Run

See simplified instructions in the main [README.en.md](./README.en.md) or use `pnpm run dev` in the root to start the full ecosystem.
