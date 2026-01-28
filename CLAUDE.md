# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude AI to generate React components that are displayed in real-time using a virtual file system (no files written to disk). The application can run without an API key, in which case it uses a mock provider that returns static components.

## Code Style Guidelines

- Use comments sparingly. Only comment complex code.

## Development Commands

### Setup
```bash
npm run setup
```
Installs dependencies, generates Prisma client, and runs database migrations.

### Development
```bash
npm run dev
```
Starts the Next.js development server with Turbopack on port 3000.

```bash
npm run dev:daemon
```
Starts the dev server in the background, writing logs to `logs.txt`.

### Testing
```bash
npm test
```
Runs all tests using Vitest.

To run a single test file:
```bash
npm test -- path/to/test-file.test.tsx
```

### Database
```bash
npx prisma generate
```
Generates Prisma client (outputs to `src/generated/prisma`).

```bash
npx prisma migrate dev
```
Creates and applies database migrations.

```bash
npm run db:reset
```
Resets the database, clearing all data.

### Linting
```bash
npm run lint
```
Runs ESLint.

## Architecture

### Virtual File System (VFS)

The core innovation is the `VirtualFileSystem` class in `src/lib/file-system.ts`. This in-memory file system stores generated React components without writing to disk. The VFS:

- Stores files and directories in a `Map<string, FileNode>` structure
- Normalizes paths (ensures leading `/`, removes trailing slashes)
- Supports file operations: create, read, update, delete, rename
- Serializes/deserializes to JSON for database persistence
- Is passed to AI tools so Claude can manipulate files

### AI Tool System

The AI generates components using two main tools defined in `src/lib/tools/`:

1. **str_replace_editor** (`str-replace.ts`): Provides text editor commands
   - `view`: Display file contents with line numbers
   - `create`: Create new files with parent directories
   - `str_replace`: Replace all occurrences of a string in a file
   - `insert`: Insert text at a specific line number

2. **file_manager** (`file-manager.ts`): File management operations
   - `rename`: Rename/move files and directories
   - `delete`: Delete files and directories

Both tools operate on the same `VirtualFileSystem` instance passed during tool creation.

### Mock Provider System

When `ANTHROPIC_API_KEY` is not set, the app uses `MockLanguageModel` in `src/lib/provider.ts`. This:

- Implements the AI SDK's `LanguageModelV1` interface
- Generates realistic multi-step interactions (create component → enhance → create App.jsx → summary)
- Detects component type from user prompt (counter, form, card)
- Returns pre-written code for each component type
- Used when `getLanguageModel()` finds no API key

### JSX Transformation Pipeline

Components are transformed client-side for preview in `src/lib/transform/jsx-transformer.ts`:

1. **Transform**: Babel transforms JSX/TSX to vanilla JS using `@babel/standalone`
2. **Import Map**: Creates an import map mapping import paths to blob URLs
   - Maps `@/` alias to root directory `/`
   - Third-party packages route to `esm.sh`
   - Local files get blob URLs from transformed code
3. **Preview HTML**: Generates an HTML document with:
   - Tailwind CDN for styling
   - Import map in `<script type="importmap">`
   - Error boundary component
   - Dynamic module loading via `import()`
   - Inline syntax error display if transformation fails

The preview iframe (`src/components/preview/PreviewFrame.tsx`) receives this HTML via `srcdoc`.

### Project Persistence

Projects are stored in SQLite via Prisma (`prisma/schema.prisma`):

- **User**: Email, hashed password (bcrypt), timestamps
- **Project**: Name, messages (JSON), data (serialized VFS), userId, timestamps

The `messages` field stores the AI conversation history. The `data` field stores the serialized virtual file system. Both are JSON strings in the database.

### Authentication Flow

Authentication uses JWT tokens (`src/lib/auth.ts`):

1. Sign up/in forms hash passwords with bcrypt
2. `createSession()` creates a JWT token using `jose` library
3. Token stored in HTTP-only cookie
4. `getSession()` verifies and decodes token from cookie
5. Middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem` routes
6. Anonymous users can use the app but can't save projects

### Chat API Route

The main route is `src/app/api/chat/route.ts`:

1. Receives messages, files (serialized VFS), and projectId
2. Adds system prompt (`generationPrompt`) with caching
3. Reconstructs VFS from serialized nodes
4. Streams response using Vercel AI SDK's `streamText()`
5. On finish: persists messages and VFS to database if user is authenticated
6. Uses 120s timeout (`maxDuration = 120`)

The mock provider limits to 4 steps (`maxSteps: 4`) to prevent repetition, while real API allows up to 40.

### Next.js App Router Structure

- `/` - Home page, redirects authenticated users to latest project
- `/[projectId]` - Project page, loads project data and renders MainContent
- `/api/chat/route.ts` - Streaming AI chat endpoint
- `src/app/main-content.tsx` - Main UI combining chat, editor, and preview

Anonymous users see the main content without a project. Authenticated users always have a project (created on first visit if needed).

### Component Structure

- **Chat** (`src/components/chat/`): Message display, input, markdown rendering
- **Editor** (`src/components/editor/`): Monaco-based code editor with file tree
- **Preview** (`src/components/preview/`): Iframe-based component preview
- **Auth** (`src/components/auth/`): Sign up/sign in forms and dialog

The UI uses Radix UI primitives (dialog, tabs, etc.) with Tailwind CSS v4.

### System Prompt

The AI receives this prompt in `src/lib/prompts/generation.tsx`:

- Keep responses brief
- Create React components with Tailwind CSS
- Every project needs `/App.jsx` as root entry point (default export)
- No HTML files - App.jsx is the entry point
- All local imports use `@/` alias (e.g., `@/components/Calculator`)
- Operating on virtual FS root `/`

## Important Technical Details

### Database Schema

The database schema is defined in the `prisma/schema.prisma` file. Reference it anytime you need to understand the structure of data stored in the database.

### Path Resolution

The VFS normalizes all paths:
- Adds leading `/` if missing
- Removes trailing `/` except for root
- Collapses multiple slashes

The import map in jsx-transformer creates multiple aliases:
- `/path/to/file.jsx` → blob URL
- `path/to/file.jsx` → same blob URL
- `@/path/to/file` → same blob URL (with and without extension)

### Prisma Output Location

Prisma client is generated to `src/generated/prisma` (not the default `node_modules/@prisma/client`). Import it as:
```typescript
import { prisma } from '@/lib/prisma'
```

### Testing Setup

Tests use Vitest with jsdom environment (`vitest.config.mts`). React Testing Library is available for component tests. Path aliases from `tsconfig.json` work in tests via `vite-tsconfig-paths`.

### Tailwind CSS Version

This project uses **Tailwind CSS v4** (not v3), which has a different setup. It's loaded via `@tailwindcss/postcss` and the preview uses the Tailwind CDN.
