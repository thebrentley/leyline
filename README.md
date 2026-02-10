# Leyline

A full-stack MTG deck management web application using NestJS for the backend API and React Native Web for a cross-platform frontend.

## Features

- **Deck Management**: Sync decks from Archidekt, view deck details, color tags
- **Collection Tracking**: Track owned cards, quantities, prices
- **AI Deck Advisor**: Get intelligent suggestions for deck improvements using Claude AI
- **Cross-Platform**: Works on web, iOS, and Android via React Native Web

## Project Structure

```
leyline/
├── apps/
│   ├── api/              # NestJS backend
│   │   └── src/
│   │       ├── entities/ # TypeORM entities
│   │       ├── modules/  # Feature modules (auth, decks, cards, collection, advisor)
│   │       ├── common/   # Guards, decorators
│   │       └── database/ # TypeORM config
│   │
│   └── mobile/           # React Native Web (Expo)
│       ├── app/          # Expo Router screens
│       ├── components/   # Reusable components
│       ├── services/     # API client
│       └── stores/       # Zustand state
│
├── packages/
│   └── shared/           # Shared TypeScript types
│
└── package.json          # Monorepo root
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm 9+

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd leyline
   npm install
   ```

2. **Set up the database:**
   ```bash
   # Create PostgreSQL database
   createdb leyline

   # Copy environment file
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your database URL and secrets
   ```

3. **Start the API:**
   ```bash
   npm run dev:api
   ```

4. **Start the mobile/web app:**
   ```bash
   npm run dev:mobile
   ```

### Environment Variables (API)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `ANTHROPIC_API_KEY` | Claude API key for AI advisor |
| `PORT` | API port (default: 3001) |

## API Endpoints

### Authentication
- `POST /api/auth/archidekt/login` - Login with Archidekt credentials
- `GET /api/auth/me` - Get current user

### Decks
- `GET /api/decks` - List synced decks
- `GET /api/decks/:id` - Get deck details with cards
- `POST /api/decks/sync/:archidektId` - Sync deck from Archidekt
- `GET /api/decks/archidekt` - List available Archidekt decks

### Collection
- `GET /api/collection` - Get user's collection
- `GET /api/collection/stats` - Get collection statistics
- `POST /api/collection` - Add card to collection
- `PUT /api/collection/:id` - Update collection card
- `DELETE /api/collection/:id` - Remove from collection

### Cards (Scryfall)
- `GET /api/cards/:scryfallId` - Get card by Scryfall ID
- `GET /api/cards/search?q=name` - Search cards
- `GET /api/cards/autocomplete?q=name` - Autocomplete card names

### AI Advisor
- `GET /api/advisor/sessions/:deckId` - Get chat sessions for deck
- `POST /api/advisor/sessions` - Create new chat session
- `POST /api/advisor/chat/:sessionId` - Send message (SSE streaming)
- `PUT /api/advisor/session/:sessionId/change` - Accept/reject suggestion

## Tech Stack

### Backend
- **NestJS** - Node.js framework
- **TypeORM** - Database ORM
- **PostgreSQL** - Database
- **Passport JWT** - Authentication
- **Anthropic SDK** - Claude AI integration

### Frontend
- **Expo** - React Native framework
- **Expo Router** - File-based routing
- **React Native Web** - Web support
- **NativeWind** - Tailwind CSS for React Native
- **TanStack Query** - Data fetching
- **Zustand** - State management

## License

MIT
