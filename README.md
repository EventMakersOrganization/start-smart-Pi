# User Management System

A comprehensive user management system built with Angular, NestJS, and MongoDB.

## Project Structure

```
user-management-system/
├── backend/               # NestJS backend
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── user/         # User management module
│   │   ├── shared/       # Shared modules and utilities
│   │   └── main.ts       # Application entry point
│   └── package.json
│
└── frontend/             # Angular frontend
    ├── src/
    │   ├── app/
    │   │   ├── auth/     # Authentication components
    │   │   ├── profile/  # User profile components
    │   │   ├── admin/    # Admin dashboard
    │   │   └── shared/   # Shared modules
    │   └── main.ts
    └── package.json
```

## Getting Started

### Prerequisites
- Node.js (v16 or later)
- MongoDB
- Angular CLI
- NestJS CLI

### Installation

1. Clone the repository
2. Install dependencies for both frontend and backend
3. Configure environment variables
4. Start the development servers

## Features

- JWT Authentication
- Role-based Access Control
- User Profile Management
- Activity Tracking
- Secure API Endpoints
- Responsive UI

## Development

### Backend
```bash
cd backend
npm install
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
ng serve
```

## License

This project is licensed under the MIT License.
