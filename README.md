# 🚀 CallTracker Pro - AI-Powered Call Management System

[![Deployment Status](https://img.shields.io/badge/Deployment-Live%20on%20Vercel-brightgreen)](https://calltrackerpro-backend-k1sb8ryx3-arsalan507s-projects.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20MongoDB-blue)](https://github.com/arsalan507/calltrackerpro-backend)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-green)](https://www.mongodb.com/cloud/atlas)
[![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20BCrypt-orange)](https://jwt.io/)

A modern, production-ready CallTracker Pro system with AI-powered insights, comprehensive user management, and secure authentication. Built for scale with MongoDB Atlas and deployed on Vercel.

## 🌐 **Live Demo**

**🔗 Backend API:** [https://calltrackerpro-backend-k1sb8ryx3-arsalan507s-projects.vercel.app](https://calltrackerpro-backend-k1sb8ryx3-arsalan507s-projects.vercel.app)

**📱 Android App:** *Production Ready - Contact for access*

**🔐 Authentication:** Full JWT-based auth system with user registration, login, and protected routes

## ✨ **Current Features**

### 🔐 **Authentication & User Management**
- **User Registration**: Complete signup with organization management
- **JWT Authentication**: Secure token-based authentication
- **Password Security**: BCrypt hashing with salt rounds
- **Role-based Access**: Admin, Manager, Agent, Viewer roles
- **Profile Management**: User profiles with permissions and limits

### 📞 **Call Management System**
- **Real-time Call Logging**: Production-ready call data capture
- **Contact Integration**: Smart contact matching and management
- **Call History**: Comprehensive analytics and reporting
- **Bulk Operations**: Efficient bulk call log synchronization

### 🛡️ **Security & Production Features**
- **Environment Configuration**: Secure production environment setup
- **Database Connection**: MongoDB Atlas cloud database integration
- **Error Handling**: Comprehensive error management and logging
- **Input Validation**: Complete request validation and sanitization
- **CORS Support**: Cross-origin resource sharing configured

### 📊 **Analytics & Insights**
- **User Statistics**: Call limits, usage tracking, and analytics
- **Organization Management**: Multi-tenant organization support
- **Subscription Plans**: Free, Pro, Business, Enterprise tiers
- **Usage Monitoring**: Real-time usage tracking and limits

## 🏗️ **Tech Stack**

| Component | Technology | Status |
|-----------|------------|--------|
| **Backend** | Node.js 18+, Express.js 5 | ✅ Production |
| **Database** | MongoDB Atlas | ✅ Connected |
| **Authentication** | JWT + BCrypt | ✅ Implemented |
| **Deployment** | Vercel Serverless | ✅ Live |
| **Security** | CORS, Input Validation | ✅ Configured |
| **Environment** | Production Ready | ✅ Deployed |

## 🚀 **Quick Start**

### Prerequisites
- Node.js 16+ 
- MongoDB Atlas account
- Vercel account (for deployment)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/arsalan507/calltrackerpro-backend.git
cd calltrackerpro-backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

Create a `.env` file:

```env
# Production MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/telecrm?retryWrites=true&w=majority&appName=Cluster0

# JWT Security
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Server Configuration
NODE_ENV=production
PORT=5000
```

### Start Development Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📡 **API Endpoints**

### 🔐 **Authentication**
```http
POST   /api/auth/register           # User registration
POST   /api/auth/login              # User login
POST   /api/auth/check-email        # Check email availability
GET    /api/auth/debug              # Debug endpoint
GET    /api/auth/test               # Test auth system
```

### 📞 **Call Management**
```http
GET    /api/call-logs/test          # Test endpoint
POST   /api/call-logs               # Create call log
GET    /api/call-logs               # Fetch all call logs (authenticated)
GET    /api/call-logs/:id           # Get single call log
PUT    /api/call-logs/:id           # Update call log
DELETE /api/call-logs/:id           # Delete call log
POST   /api/call-logs/bulk          # Bulk sync call logs
```

### 👥 **User & Organization Management**
```http
GET    /api/auth/profile            # Get user profile (authenticated)
PUT    /api/auth/profile            # Update user profile
GET    /api/users/organization      # Get organization users
POST   /api/users/invite            # Invite team members
```

## 📊 **User Registration Example**

```json
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "phone": "1234567890",
  "organizationName": "Acme Corp",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully! Welcome to CallTracker Pro.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d5ecb74b24c1001f5e4e1a",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@company.com",
    "organizationName": "Acme Corp",
    "role": "admin",
    "subscriptionPlan": "free",
    "callLimit": 50,
    "callsUsed": 0
  },
  "expiresIn": 604800
}
```

## 🔄 **Current Status**

### ✅ **Production Ready Features**
- [x] **Backend API Infrastructure** - Complete Express.js server
- [x] **MongoDB Atlas Integration** - Cloud database with connection pooling
- [x] **User Authentication System** - JWT-based auth with registration/login
- [x] **Password Security** - BCrypt hashing with secure salt rounds
- [x] **Call Logs Management** - Full CRUD operations
- [x] **Error Handling** - Comprehensive error management
- [x] **Input Validation** - Request validation and sanitization
- [x] **Vercel Deployment** - Production deployment with environment variables
- [x] **CORS Configuration** - Cross-origin resource sharing
- [x] **Environment Management** - Production/development configurations

### 🚧 **In Development**
- [ ] **Mobile App Integration** - Android app API integration
- [ ] **Team Management** - Multi-user organization features
- [ ] **Advanced Analytics** - Call statistics and reporting
- [ ] **Rate Limiting** - API rate limiting implementation

### 📋 **Future Enhancements**
- [ ] **AI Integration** - Voice transcription and sentiment analysis
- [ ] **Real-time Features** - WebSocket support for live updates
- [ ] **Advanced Security** - OAuth2 integration, 2FA
- [ ] **API Documentation** - Swagger/OpenAPI documentation
- [ ] **Monitoring** - Application performance monitoring

## 🌟 **Deployment Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Android App   │────│  Vercel Backend  │────│  MongoDB Atlas  │
│                 │    │                  │    │                 │
│ • User Auth     │    │ • JWT Auth       │    │ • User Data     │
│ • Call Logging  │    │ • API Endpoints  │    │ • Call Logs     │
│ • Local Storage │    │ • Validation     │    │ • Organizations │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 💰 **Subscription Plans**

| Plan | Price | Call Limit | Features |
|------|-------|------------|----------|
| **Free** | $0/month | 50 calls | Basic logging, 1 user |
| **Pro** | $29/month | 1,000 calls | AI insights, 5 users |
| **Business** | $99/month | 10,000 calls | Team management, Analytics |
| **Enterprise** | $299/month | Unlimited | Custom integrations, Priority support |

## 🔧 **Development Commands**

```bash
# Development
npm run dev          # Start with nodemon (hot reload)
npm start            # Start production server
npm run test         # Run authentication tests

# Database Testing
node test-mongo.js   # Test MongoDB connection
node test/test-auth.js  # Test authentication system

# Deployment
vercel --prod        # Deploy to Vercel production
vercel env ls        # List environment variables
```

## 🛠️ **Project Structure**

```
CallTrackerPro/
├── api/
│   └── index.js           # Vercel serverless entry point
├── config/
│   └── database.js        # MongoDB Atlas connection
├── models/
│   ├── User.js           # User schema with auth
│   ├── CallLog.js        # Call logging schema
│   ├── Contact.js        # Contact management
│   └── Organization.js   # Organization model
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── callLogs.js       # Call management endpoints
│   └── contacts.js       # Contact endpoints
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── test/
│   └── test-auth.js      # Authentication tests
├── app.js                # Express application setup
├── server.js             # Local development server
├── vercel.json           # Vercel deployment config
└── package.json          # Dependencies and scripts
```

## 🔒 **Security Features**

- **Password Hashing**: BCrypt with 12 salt rounds
- **JWT Tokens**: 7-day expiration with secure secret
- **Input Validation**: Email format, password strength validation
- **Error Handling**: Secure error messages without data leakage
- **CORS Configuration**: Proper cross-origin request handling
- **Environment Security**: Production environment variable management

## 🚀 **Vercel Deployment**

This project is optimized for Vercel serverless deployment:

- **Serverless Functions**: API routes as serverless functions
- **Environment Variables**: Secure environment configuration
- **MongoDB Atlas**: Cloud database with global availability
- **Production Optimization**: Connection pooling and timeout management

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 **Support**

- **Email**: arsalanahmed507@gmail.com
- **GitHub Issues**: [Report bugs](https://github.com/arsalan507/calltrackerpro-backend/issues)
- **Documentation**: API documentation available at deployed endpoint

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 **Author**

**Arsalan Ahmed**
- GitHub: [@arsalan507](https://github.com/arsalan507)
- Email: arsalanahmed507@gmail.com
- LinkedIn: [Connect with me](https://linkedin.com/in/arsalan507)

## 🙏 **Acknowledgments**

- MongoDB Atlas for reliable cloud database
- Vercel for seamless serverless deployment
- JWT.io for authentication standards
- Express.js community for robust web framework

---

**🎯 Ready for Production | 🔐 Secure by Design | 📱 Mobile Ready**

*CallTracker Pro - Professional call management with enterprise-grade security*