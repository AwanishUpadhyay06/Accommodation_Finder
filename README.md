# 🏠 Accommodation Finder Web Application

A full-stack web application for finding and managing rental properties with role-based access control for tenants and property owners.

## ✨ Features

### 🔐 Authentication & Authorization
- **User Registration**: Simple registration with role selection (Tenant/Property Owner)
- **System-Generated Credentials**: Automatic username and password generation
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Different dashboards and permissions for each role

### 🧑‍💼 Property Owner Dashboard
- **Property Management**: Add, edit, and delete property listings
- **Property Details**: Comprehensive property information including:
  - Title and description
  - Pricing and location
  - Property type (1BHK, 2BHK, Studio, etc.)
  - Features (WiFi, AC, Furnished, etc.)
  - Facilities (Gym, Parking, Security, etc.)
  - Availability status and images
- **Review Management**: View and respond to tenant reviews
- **Analytics**: Property performance and rating statistics

### 👤 Tenant Dashboard
- **Property Browsing**: Browse all available properties
- **Advanced Search**: Filter properties by:
  - Location
  - Price range
  - Property type
  - Specific features or facilities
- **Property Details**: View comprehensive property information
- **Review System**: Submit ratings and reviews for properties
- **Review History**: View past reviews and ratings

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Express Validator** - Input validation

### Frontend
- **React 18** - UI library
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **React Icons** - Icon library
- **React Hot Toast** - Toast notifications

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd accommodation-finder
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   npm install
   ```

3. **Create environment file**
   Create a `.env` file in the backend directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/accommodation-finder
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   ```

4. **Start the Backend**
   ```bash
   npm run dev
   ```

5. **Set up the Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

6. **Start the Frontend**
   ```bash
   npm start
   ```

7. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📁 Project Structure

```
accommodation-finder/
├── backend/                 # Node.js + Express backend
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── middleware/         # Custom middleware
│   ├── server.js           # Main server file
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utility functions
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

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

### Reviews
- `POST /api/reviews` - Submit review (Tenant only)
- `GET /api/reviews/tenant/my-reviews` - Get tenant's reviews
- `GET /api/reviews/owner/my-property-reviews` - Get owner's property reviews

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user statistics

## 🎯 Key Features Implementation

### System-Generated Credentials
- Username: `{name}{timestamp}` (e.g., john123456)
- Password: 8-character random string
- Credentials displayed after successful registration

### Role-Based Access Control
- **Tenants**: Can browse properties, submit reviews, view their review history
- **Owners**: Can manage properties, view reviews, access analytics

### Advanced Search & Filtering
- Location-based search
- Price range filtering
- Property type filtering
- Feature and facility filtering

### Review System
- One review per tenant per property
- 1-5 star rating system
- Comment system with character limits
- Review history for both tenants and owners

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- Role-based route protection
- Soft deletes for data integrity

## 📱 Responsive Design

- Mobile-first approach
- Tablet and desktop optimized
- Modern UI with Tailwind CSS
- Intuitive user experience

## 🚀 Deployment

### Backend Deployment
1. Set up MongoDB Atlas or local MongoDB
2. Configure environment variables
3. Deploy to platforms like Heroku, Railway, or Vercel

### Frontend Deployment
1. Build the application: `npm run build`
2. Deploy to platforms like Netlify, Vercel, or GitHub Pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository or contact the development team.

---

**Built with ❤️ using modern web technologies** 