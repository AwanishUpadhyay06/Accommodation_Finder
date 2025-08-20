# Accommodation Finder Backend

A Node.js + Express + MongoDB backend for the Accommodation Finder Web Application.

## Features

- 🔐 Authentication with JWT
- 👥 Role-based access (Tenant/Property Owner)
- 🏠 Property management (CRUD operations)
- ⭐ Review and rating system
- 🔍 Advanced search and filtering
- 📊 User statistics and dashboards

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file:**
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/accommodation-finder
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   ```

3. **Start MongoDB:**
   Make sure MongoDB is running on your system.

4. **Run the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Properties
- `GET /api/properties` - Get all properties with filters
- `GET /api/properties/:id` - Get single property
- `POST /api/properties` - Create new property (Owner only)
- `PUT /api/properties/:id` - Update property (Owner only)
- `DELETE /api/properties/:id` - Delete property (Owner only)
- `GET /api/properties/owner/my-properties` - Get owner's properties

### Reviews
- `POST /api/reviews` - Submit review (Tenant only)
- `PUT /api/reviews/:id` - Update review (Tenant only)
- `DELETE /api/reviews/:id` - Delete review (Tenant only)
- `GET /api/reviews/tenant/my-reviews` - Get tenant's reviews
- `GET /api/reviews/owner/my-property-reviews` - Get owner's property reviews
- `GET /api/reviews/property/:propertyId` - Get property reviews

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password
- `GET /api/users/stats` - Get user statistics

## Database Models

### User
- name, email, username, password, role, phone
- System-generated username and password on registration

### Property
- title, description, price, location, features, facilities
- propertyType, area, bedrooms, bathrooms, availability
- Owner reference and timestamps

### Review
- property, tenant, owner references
- rating (1-5), comment, timestamps
- One review per tenant per property

## Security Features

- Password hashing with bcrypt
- JWT authentication
- Role-based authorization
- Input validation with express-validator
- Soft deletes for data integrity 