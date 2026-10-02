# RetailTrack – Inventory Management System

RetailTrack is a modern **Inventory Management System** designed for retail businesses to efficiently manage products, inventory, sales, orders, and day-to-day store operations.

The system provides role-based functionality for **Administrators, Cashiers, and Inventory Staff**, helping improve inventory visibility, operational efficiency, and record management.

## 🚀 Features

* 🔐 Role-based authentication and authorization
* 📦 Product and inventory management
* ✨ Category management
* 📤 Sales and order management
* 💰 Sales tracking and reporting
* 👥 User and staff management
* 📊 Dashboard and business insights
* 🔄 Inventory stock monitoring
* 📱 Responsive user interface
* 🔎 Product search and filtering

## 👤 User Roles

### Administrator

* Manage system users
* Manage products and categories
* Monitor inventory
* Manage sales and orders
* View reports and system information

### Cashier

* Process sales
* Manage customer transactions
* View product information
* Handle orders and sales records

### Inventory Staff

* Manage product stock
* Update inventory quantities
* Monitor stock levels
* Manage product information
* Track inventory activities

## 📊 System Architecture

        🎨 FRONTEND
    React + Tailwind CSS
             │
             │
             │ HTTP Requests
             │
             ▼
       ⚙️ BACKEND
    Node.js + Express
             │
             │
             │ Mongoose
             │
             ▼
       📂 DATABASE
         MongoDB

## 🛠️ Technology Stack

| Technology   | Purpose                       |
| ------------ | ----------------------------- |
| React.js     | Frontend                      |
| Node.js      | Backend Runtime               |
| Express.js   | Server Framework / REST API   |
| Supabase     | Database and Backend Services |
| PostgreSQL   | Relational Database           |
| Tailwind CSS | UI Styling                    |
| Git & GitHub | Version Control               |

## 📁 Project Structure

```text
RetailTrack/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── ...
│
└── README.md
```

## ⚙️ Installation

### Prerequisites

Make sure you have the following installed:

* Node.js
* npm
* Git
* A Supabase account

### Clone the Repository

```bash
git clone https://github.com/Chamindu-Gayanuka/RetailTrack-Inventory-Management-System.git
```
```angular2html
cd RetailTrack-Inventory-Management-System
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start using the Vite development server.

### Backend Setup

Open another terminal:

```bash
cd backend
npm install
npm run dev
```

## 🔄 Development Workflow

The project follows a structured development workflow using Git and GitHub.

```text
      Create Branch
           ↓
    Develop Feature
           ↓
          Test
           ↓
     Commit Changes
           ↓
     Push to GitHub
           ↓
      Pull Request
           ↓
      Code Review
           ↓
         Merge
```

## 🎨 UI/UX

The system uses **Tailwind CSS** to create a responsive and consistent user interface.

High-fidelity UI designs and wireframes are prepared before implementation to ensure that the system follows the planned user flows and requirements.

## 📌 Project Status

🚧 **Currently in Development**

The system is being developed incrementally, with features and modules implemented according to the project requirements and development plan.

## 👥 Development Team

RetailTrack is developed as a group software project.

* **Chamindu Gayanuka Dharmasiri** – Frontend Developer & Project Manager
* **Sandun Madushan** – QA Engineer & Documentation
* **Chathuranga Sampath** – Business Analyst & UI/UX Designer
* **Dilwan Thennakoon** – Backend Developer & Database Administrator

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/Chamindu-Gayanuka/RetailTrack-Inventory-Management-System/blob/main/LICENSE) file for details.

---
<p style="text-align: center;">
🌟 RetailTrack Inventory Management System<br>
✨ Develop. Manage. Succeed. ✨ <br>
🚀 Built with the power of React, Node.js, and Supabase. <br>
</p>