# Project Structure

## Monorepo Organization

```
├── apps/
│   ├── web/          # React frontend application
│   └── api/          # Node.js backend API
├── packages/
│   └── types/        # Shared Zod schemas and TypeScript types
└── .kiro/
    └── specs/        # Product specifications and requirements
```

## Frontend Structure (apps/web)

```
src/
├── components/       # React components
│   ├── ui/          # shadcn/ui base components
│   └── *.tsx        # Feature components (Timeline, Preview, etc.)
├── store/           # Zustand state management
│   ├── __tests__/   # Store unit tests
│   └── *.ts         # Store slices and hooks
├── utils/           # Utility functions
├── test/            # Test setup and utilities
└── App.tsx          # Main application component
```

## Backend Structure (apps/api)

```
src/
├── index.ts         # Main API server
├── worker.ts        # Background job worker
└── routes/          # API route handlers (if expanded)

# Root level files:
├── uploads/         # User uploaded assets
├── downloads/       # Rendered video outputs
├── test-*.js        # Testing utilities
└── start-all.js     # Development script
```

## Shared Types (packages/types)

```
src/
├── index.ts         # Main exports
├── schemas/         # Zod schema definitions
└── types/           # TypeScript type definitions
```

## Configuration Files

### Web App
- `vite.config.ts` - Vite build configuration with path aliases
- `tailwind.config.js` - Tailwind CSS with shadcn/ui theme
- `components.json` - shadcn/ui component configuration
- `tsconfig.json` - TypeScript configuration

### API
- `tsconfig.json` - TypeScript with CommonJS output
- `.env` - Environment variables (Redis, ports, etc.)

### Shared
- Each package has its own `package.json` and `tsconfig.json`
- Scoped packages use `@aether-editor/` namespace

## Key Conventions

- **Import Aliases**: Use `@/` for src-relative imports in web app
- **File Naming**: PascalCase for components, camelCase for utilities
- **State Management**: Single Zustand store with typed actions
- **Schema Validation**: Zod schemas for all data structures
- **Testing**: Co-located test files in `__tests__/` directories
- **Asset Handling**: UUID-based filenames, public URL references