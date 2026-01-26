# CLAUDE.md - DeckTutor Project Guide

This document provides context for AI assistants working on the DeckTutor codebase.

## Project Overview

DeckTutor is a full-stack MTG (Magic: The Gathering) deck management application with AI-powered deck advisory features. It's built as a monorepo with a NestJS backend API and React Native Web frontend for cross-platform support.

## Architecture

### Monorepo Structure

```
decktutor/
├── apps/
│   ├── api/              # NestJS backend (TypeScript)
│   └── mobile/           # React Native Web frontend (Expo)
├── packages/
│   └── shared/           # Shared TypeScript types
└── package.json          # Workspace root
```

### Technology Stack

**Backend (apps/api):**
- NestJS - Node.js framework with dependency injection
- TypeORM - Database ORM with entities
- PostgreSQL - Relational database
- Passport JWT - Authentication strategy
- Anthropic SDK - Claude AI integration for deck advisor
- Server-Sent Events (SSE) - Streaming AI responses

**Frontend (apps/mobile):**
- Expo - React Native framework
- Expo Router - File-based routing
- React Native Web - Web compatibility layer
- NativeWind - Tailwind CSS for React Native
- TanStack Query - Server state management
- Zustand - Client state management

**Shared (packages/shared):**
- TypeScript types and interfaces used across frontend/backend

## Core Features

### 1. Deck Management
- Sync decks from Archidekt (third-party deck building platform)
- View deck details with card lists
- Color tagging and organization
- Deck versioning support

### 2. Collection Tracking
- Track owned cards and quantities
- Price tracking for collection value
- Collection statistics

### 3. AI Deck Advisor (Claude Integration)
- Chat-based interface for deck improvement suggestions
- Streaming responses via SSE
- Session-based conversations per deck
- Suggestion tracking (accepted/rejected changes)

### 4. Card Data
- Scryfall API integration for card data
- Card search and autocomplete
- Card details and metadata

## Database Schema (TypeORM Entities)

Key entities in `apps/api/src/entities/`:

- **User** - User accounts with Archidekt authentication
- **Deck** - Deck metadata (name, format, Archidekt ID)
- **DeckVersion** - Versioned snapshots of deck configurations
- **DeckCard** - Cards within a deck (many-to-many with quantities)
- **Card** - Card data from Scryfall (cached)
- **CollectionCard** - User's owned cards with quantities
- **ChatSession** - AI advisor conversation sessions

## API Modules

Located in `apps/api/src/modules/`:

### auth/
- Archidekt credential-based login
- JWT token generation and validation
- User session management

### decks/
- Deck CRUD operations
- Archidekt sync functionality
- Deck listing and filtering

### collection/
- Collection management
- Statistics calculation
- Card addition/removal

### cards/
- Scryfall integration
- Card search
- Card data caching

### advisor/
- AI chat sessions
- Claude API integration
- Streaming SSE responses
- Suggestion change tracking

### events/
- Event-driven architecture support

## Development Workflow

### Running the Application

```bash
# Install dependencies (from monorepo root)
npm install

# Start API server (port 3001)
npm run dev:api

# Start mobile/web app
npm run dev:mobile
```

### Environment Setup

**Required for API (`apps/api/.env`):**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `ANTHROPIC_API_KEY` - Claude API key for AI features
- `PORT` - API port (default: 3001)

### Database

- PostgreSQL 14+
- TypeORM handles migrations and schema
- Connection configured via `DATABASE_URL`

## Code Patterns & Conventions

### Backend (NestJS)
- Module-based architecture with dependency injection
- Controllers handle HTTP routing
- Services contain business logic
- Guards protect routes (JWT authentication)
- Decorators for custom metadata (e.g., @CurrentUser)
- TypeORM repositories for data access

### Frontend (React Native)
- File-based routing via Expo Router in `app/` directory
- Components in `components/` directory
- API client in `services/`
- Zustand stores in `stores/`
- NativeWind for styling (Tailwind classes)

### Shared Types
- Import from `@decktutor/shared` package
- Ensures type safety between frontend/backend

## AI Advisor Implementation

The AI advisor is a key feature leveraging Claude AI:

1. **Session Management**: Each deck can have multiple chat sessions
2. **Streaming**: Uses SSE to stream Claude's responses in real-time
3. **Context**: Sends deck list and card details to Claude
4. **Suggestions**: Tracks proposed changes and user acceptance
5. **History**: Maintains conversation history for context

**Key Files:**
- `apps/api/src/modules/advisor/advisor.service.ts` - Claude integration logic
- `apps/api/src/modules/advisor/advisor.controller.ts` - SSE endpoints
- `apps/api/src/entities/chat-session.entity.ts` - Session persistence

## External Dependencies

### Archidekt API
- Third-party deck building platform
- Used for deck imports and user authentication
- Private API (requires credentials)

### Scryfall API
- Official MTG card database API
- Free, public API
- Used for card data, search, and images

### Anthropic (Claude AI)
- Requires API key in environment
- Used for deck analysis and suggestions
- Streaming responses via SDK

## Common Development Tasks

### Adding a New API Endpoint
1. Add route to appropriate controller in `apps/api/src/modules/`
2. Implement service method
3. Add DTOs for request/response validation
4. Update guards if authentication required

### Adding a New Screen
1. Create file in `apps/mobile/app/` (Expo Router)
2. Add components in `apps/mobile/components/`
3. Use TanStack Query for data fetching
4. Use Zustand for local state if needed

### Adding Shared Types
1. Define in `packages/shared/src/`
2. Export from index
3. Import via `@decktutor/shared` in both apps

### Database Changes
1. Update entity in `apps/api/src/entities/`
2. TypeORM will sync on dev (or create migration for prod)
3. Update related services and DTOs

## Testing

- Test scripts available via `npm run test` in workspaces
- Each workspace can have its own test configuration

## Build & Deployment

```bash
# Build API
npm run build:api

# Output: apps/api/dist/
```

## Important Considerations

### Authentication Flow
- Users log in with Archidekt credentials
- Backend validates with Archidekt, creates local user
- JWT token issued for subsequent requests
- Token required for most endpoints (JwtAuthGuard)

### Data Sync
- Decks are periodically synced from Archidekt
- Card data cached locally from Scryfall
- Collection managed entirely locally

### Performance
- TanStack Query handles caching and refetching on frontend
- Database queries optimized with TypeORM relations
- SSE used for streaming to avoid timeout issues

### Cross-Platform Support
- React Native Web enables web deployment
- Expo handles iOS/Android builds
- Shared component library for consistency

## Future Enhancements

Potential areas for expansion:
- Real-time deck collaboration
- More AI advisor features (meta analysis, budget optimization)
- Deck playtesting simulator
- Integration with other deck building platforms
- Mobile native features (camera card recognition)

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Expo Documentation](https://docs.expo.dev/)
- [TypeORM Documentation](https://typeorm.io/)
- [Scryfall API](https://scryfall.com/docs/api)
- [Anthropic API](https://docs.anthropic.com/)
