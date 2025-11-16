📍 CivicLens

A real-time geospatial dashboard for exploring crime, 311, and fire incidents across San Francisco.

CivicLens visualizes live civic datasets on an interactive Mapbox map with user accounts, saved settings, and a modern UI — built end-to-end using a startup-grade full-stack architecture.

🚀 Features

Interactive Mapbox dashboard with real-time crime, 311, and fire incident data

Detailed incident sidebar with timestamps, categories, and metadata

User accounts & saved preferences (datasets, filters, map style, default location)

Supabase caching pipeline to reduce API calls and normalize civic datasets

Modern UI using Tailwind CSS with dark mode, filters, and animated components

Serverless API routes for data ingestion, caching, and user settings

🧰 Tech Stack

Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Mapbox GL

Backend: Next.js API Routes, Supabase Postgres (JSONB cache), Supabase Auth

Deployment: Vercel + Supabase

Data Sources: San Francisco OpenData API (Crime, 311, Fire/Emergency)

🏗️ Architecture

Real-time external dataset ingestion → cleaned + normalized

Supabase JSONB caching with TTL → fast, stable responses

User-specific settings stored in Postgres (RLS-protected)

Server-rendered pages + client-side Mapbox for dynamic UI