# OWL Evaluation Framework

A unified TypeScript platform for evaluating and comparing world models through human evaluation studies.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd eval/frontend
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Run the application:**
   ```bash
   npm run dev
   ```

4. **Use the CLI:**
   ```bash
   cd eval
   ./evalctl --help
   ```

## Documentation

### 🏗️ **System Architecture**
- [`docs/concepts.md`](docs/concepts.md) - Core concepts and evaluation methodology
- [`docs/evaluation-system.md`](docs/evaluation-system.md) - Evaluation system overview and workflow
- [`docs/multitenant.md`](docs/multitenant.md) - Multi-tenant architecture and organization management

### 🛠️ **Development**
- [`docs/frontend-development.md`](docs/frontend-development.md) - Frontend development setup and guidelines
- [`docs/cli-scripts.md`](docs/cli-scripts.md) - CLI tools and automation scripts
- [`docs/contributing.md`](docs/contributing.md) - Contributing guidelines and development workflow
- [`docs/defensive-programming.md`](docs/defensive-programming.md) - Security and defensive programming practices

### 🔌 **Integrations**
- [`docs/prolific-integration.md`](docs/prolific-integration.md) - Prolific platform integration for participant recruitment

### 📋 **Project Management**
- [`docs/todo.md`](docs/todo.md) - Current tasks and project roadmap

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** Stack Auth
- **Storage:** AWS S3 / Tigris
- **CLI:** TypeScript with Commander.js
- **Deployment:** Docker, GitHub Actions

## Key Features

- ✅ **Multi-tenant organizations** with role-based access control
- ✅ **Unified TypeScript CLI** for experiment management
- ✅ **Prolific integration** for human evaluation studies
- ✅ **Video comparison workflows** for model evaluation
- ✅ **Real-time progress tracking** and analytics dashboard
- ✅ **Cloud storage integration** for video assets

## Project Structure

```
eval/
├── frontend/           # Next.js web application
├── scripts/           # TypeScript CLI tools
├── evalctl           # Main CLI executable
└── docker-compose.yml # Local development setup

docs/                  # All documentation
├── concepts.md
├── evaluation-system.md
├── cli-scripts.md
└── ...

config.ts              # Centralized configuration
```

## Support

For questions, issues, or contributions, please refer to the documentation in the `docs/` directory or check the GitHub issues.