# NEXUS - Deployment Guide

## Quick Start Deployment

### Option 1: Local Development

```bash
# Terminal 1: Backend
cd backend
go run main.go

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit: `https://localhost:5173`

---

## Option 2: Docker Deployment

### Prerequisites
- Docker installed and running

### Build and Run

```bash
# Build the image
docker build -t nexus-app .

# Run the container
docker run -p 8080:8080 -d nexus-app

# Or use docker-compose for easier management
docker-compose up -d
```

Access at: `http://localhost:8080`

---

## Option 3: Cloud Deployment

### Deploy to Railway.app

1. **Sign up at railway.app**

2. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

3. **Initialize Railway project:**
   ```bash
   railway init
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### Deploy to Render.com

1. **Sign up at render.com**

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Set build command: `npm install --prefix frontend && go mod download -C backend && cd backend && go build -o nexus-backend .`
   - Set start command: `cd backend && ./nexus-backend`

3. **Add environment:**
   - PORT: 8080
   - ENVIRONMENT: production

### Deploy to Vercel (Frontend Only)

1. **Push frontend to GitHub**

2. **Connect to Vercel:**
   - Import project from GitHub
   - Set root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Configure environment variables:**
   ```
   VITE_API_URL=https://your-backend-api.com
   VITE_WS_URL=wss://your-backend-api.com
   ```

### Deploy Backend to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-nexus-app

# Set buildpack
heroku buildpacks:set heroku/go -a your-nexus-app

# Deploy
git push heroku main
```

---

## Environment Variables

### Backend (.env or set in deployment)
```env
PORT=8080
DATABASE_URL=sqlite:nexus.db          # or postgres://...
ENVIRONMENT=production
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=https://yourfrontend.com
```

### Frontend
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

---

## SSL/HTTPS Setup

### Using Let's Encrypt with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Database Setup

### SQLite (Default)
Automatically created on first run. File: `nexus.db`

### PostgreSQL (Production)

```bash
# Create database
createdb nexus

# Update backend/database/db.go:
# os.Getenv("DATABASE_URL") with your connection string
```

Connection string format:
```
postgres://user:password@localhost:5432/nexus?sslmode=disable
```

---

## Monitoring & Logging

### Basic Logging
Backend logs all requests and errors to stdout/stderr

### Production Monitoring
Consider adding:
- **Sentry** for error tracking
- **DataDog** or **New Relic** for performance monitoring
- **Prometheus** for metrics

---

## Security Checklist

- [ ] Update JWT secret in production
- [ ] Enable HTTPS/WSS
- [ ] Configure CORS for frontend domain
- [ ] Set secure database passwords
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Regular backups of database
- [ ] Monitor error logs
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets

---

## Performance Optimization

### Frontend
```bash
# Build optimization
npm run build

# Check bundle size
npm run build --report
```

### Backend
- Connection pooling enabled by default in GORM
- WebSocket connections handled efficiently
- Database indexing on frequently queried fields

---

## Troubleshooting Deployment

### WebSocket Connection Fails
- Check WSS is enabled on domain
- Verify proxy settings forward WebSocket headers
- Ensure backend is running

### Database Connection Issues
- Verify DATABASE_URL format
- Check database service is running
- Review connection pool settings

### Frontend Not Loading
- Verify dist folder is properly included
- Check that frontend build was successful
- Review Nginx/reverse proxy configuration

---

## Scaling Considerations

- Use load balancer for multiple backend instances
- Implement Redis for session management
- Consider message queue for high-volume chats
- Use CDN for frontend assets
- Database replication for redundancy

---

## Backup & Recovery

### Database Backup
```bash
# SQLite
cp nexus.db nexus.db.backup

# PostgreSQL
pg_dump nexus > nexus_backup.sql
```

### Restoration
```bash
# SQLite
cp nexus.db.backup nexus.db

# PostgreSQL
psql nexus < nexus_backup.sql
```

---

For detailed setup instructions, see the main README.md
