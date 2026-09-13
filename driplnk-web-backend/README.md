# DripLnk Web Backend Module (`driplnk-web-backend/`)

This directory houses the entire backend layer for the DripLnk web platform. It is isolated from client-side bundles and protected via Next.js `server-only` boundaries.

## Security Architecture

1. **`server-only` Enforced**:
   All files in this directory (and subdirectories) import `"server-only"`. Any inadvertent import from a Client Component (`"use client"`) will cause compilation to fail immediately at build time, preventing secret keys or database connection logic from leaking into client bundles.

2. **Zero Client Secrets**:
   Private environment variables such as `CLERK_SECRET_KEY` and Supabase backend service keys are strictly confined to this backend module.

3. **Request Cookie Bound**:
   Database clients authenticate requests using session cookies (`cookies()` from `next/headers`), guaranteeing proper Row-Level Security (RLS) enforcement per user.

## Directory Structure

```
driplnk-web-backend/
├── auth/
│   └── clerk.ts         # Clerk user synchronization, profile RPC, unified user resolution
├── db/
│   ├── client.ts        # SSR Supabase client & current user resolution
│   └── queries.ts       # All database queries (models, listings, mart orders, ledger, library)
├── actions/
│   ├── account.ts       # User account updates & deletion actions
│   ├── library.ts       # Library claiming actions
│   └── upload.ts        # Model & listing storage upload sessions and database records
├── index.ts             # Public API barrel export
└── README.md            # Architecture & security documentation
```

## Usage

Import from `@/driplnk-web-backend`:

```ts
import { getProfile, getModels, getUnifiedUser } from "@/driplnk-web-backend";
```
