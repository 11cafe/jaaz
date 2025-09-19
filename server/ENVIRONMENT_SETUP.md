# Environment Variables Setup

To run the server properly, you need to set up the following environment variables:

## Required Environment Variables

### Google OAuth Configuration

```bash
export GOOGLE_CLIENT_ID="your_google_client_id_here"
export GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
export GOOGLE_REDIRECT_URI="https://www.magicart.cc"
export JWT_SECRET="your_jwt_secret_here"  # Optional, will generate random if not set
```

## Optional Environment Variables

### Server Configuration

```bash
export UI_DIST_DIR="path/to/ui/dist"
export DEFAULT_PORT=8000
export USER_DATA_DIR="path/to/user/data"
export BASE_API_URL="https://jaaz.app"
export OLLAMA_HOST="http://localhost:11434"
export WAVESPEED_CHANNEL="jaaz_main"
```

## Setup Instructions

1. Create a `.env` file in the server directory with the above variables
2. Or export them in your shell before running the server
3. Make sure to never commit actual secrets to version control

## Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 client credentials
5. Add your redirect URI to the authorized redirect URIs list
