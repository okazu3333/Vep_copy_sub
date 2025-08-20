# SalesGuard Alert System

A comprehensive sales alert and monitoring system built with Next.js, PostgreSQL, and Google Cloud Platform.

## Features

- **Real-time Alert Monitoring**: Track sales activities and detect potential issues
- **Customer Management**: Manage customer information and relationships
- **Data Analysis**: Advanced analytics and reporting capabilities
- **Email Integration**: Process and analyze email communications
- **Cloud-Native**: Built on Google Cloud Platform for scalability

## Architecture

- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Database**: PostgreSQL on CloudSQL
- **Cloud Services**: Google Cloud Storage, BigQuery, Cloud Functions
- **Authentication**: Basic Authentication for security

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 10.12.1+
- PostgreSQL database (CloudSQL recommended)
- Google Cloud Platform account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Vep
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   
   Copy the example environment file and configure your settings:
   ```bash
   cp env.example .env.local
   ```
   
   Update the following variables in `.env.local`:
   ```env
   # Database Configuration (CloudSQL)
   DB_HOST=your-cloudsql-instance-ip
   DB_PORT=5432
   DB_NAME=salesguard
   DB_USER=your-db-username
   DB_PASSWORD=your-db-password
   
   # Google Cloud Storage Configuration
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
   GCS_BUCKET_NAME=your-gcs-bucket-name
   
   # Basic Authentication
   BASIC_AUTH_USERNAME=admin-user
   BASIC_AUTH_PASSWORD=your-secure-password
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   ```

5. **Access the application**
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   
   **Note**: The application is protected by Basic Authentication. Use the credentials configured in your environment variables.

## Basic Authentication

The application is protected by Basic Authentication to ensure security. You can configure the credentials using environment variables:

- `BASIC_AUTH_USERNAME`: Username for authentication (default: admin-user)
- `BASIC_AUTH_PASSWORD`: Password for authentication (default: password123)

### Changing Authentication Credentials

1. Update the environment variables in your `.env.local` file
2. Restart the development server
3. Clear your browser cache if you've previously authenticated

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

### Project Structure

```
Vep/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── ...
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   └── ...
├── lib/                  # Utility functions
├── scripts/              # Data processing scripts
└── ...
```

## Database Schema

The system uses PostgreSQL with the following main tables:

- `alerts` - Sales alerts and notifications
- `customers` - Customer information
- `users` - System users
- `gmail_messages` - Processed email data
- `important_messages` - Flagged important communications

## Data Processing

The system includes scripts for:

- Email header decoding (MIME format support)
- BigQuery data analysis
- Data migration and transformation
- Real-time alert processing

## Deployment

### Vercel Deployment

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

1. Build the application: `pnpm build`
2. Start the production server: `pnpm start`

## Security Considerations

- Basic Authentication is enabled by default
- Environment variables should be properly secured
- Database connections use SSL/TLS
- Google Cloud credentials should be properly managed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary software. All rights reserved.
