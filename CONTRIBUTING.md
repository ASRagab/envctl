# Contributing to envctl

Thank you for your interest in contributing to envctl! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 16.0.0 (we recommend using the version specified in `.nvmrc`)
- npm or pnpm (pnpm is recommended for faster installs)

### Getting Started

1. **Fork and Clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/envctl.git
   cd envctl
   ```

2. **Install Dependencies**

   ```bash
   # Using pnpm (recommended)
   pnpm install

   # Or using npm
   npm install
   ```

3. **Set up Git Hooks**

   ```bash
   # This will set up pre-commit hooks for linting and testing
   npm run prepare
   ```

4. **Run Tests**

   ```bash
   npm run test
   ```

5. **Build the Project**

   ```bash
   npm run build
   ```

6. **Test the CLI Locally**

   ```bash
   # Link the package globally for testing
   npm link

   # Now you can use envctl globally
   envctl --help
   ```

## Development Workflow

### Available Scripts

- `npm run dev` - Run the CLI in development mode
- `npm run dev:watch` - Run CLI with file watching
- `npm run build` - Build the project
- `npm run build:watch` - Build with file watching
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint the code
- `npm run lint:fix` - Lint and fix issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types

### Code Style

We use ESLint and Prettier for code formatting and linting:

- **ESLint**: Enforces code quality and consistency
- **Prettier**: Handles code formatting
- **TypeScript**: Strict type checking is enabled

The pre-commit hooks will automatically run linting and formatting.

### Testing

- Write tests for all new features and bug fixes
- Place test files next to the code they test with `.test.ts` extension
- Use the test utilities in `src/__tests__/setup.ts`
- Maintain test coverage above 80%

Example test:

```typescript
import { EnvManager } from '../env-manager'
import { createTempDir } from './__tests__/setup'

describe('EnvManager', () => {
  it('should create a profile', async () => {
    const tempDir = await createTempDir('env-manager-test')
    const envManager = new EnvManager(tempDir)

    await envManager.createProfile('test')
    const profile = await envManager.getProfile('test')

    expect(profile).toBeDefined()
    expect(profile?.name).toBe('test')
  })
})
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

Examples:

```
feat: add support for environment variable interpolation
fix: handle missing profile directory gracefully
docs: update installation instructions
test: add integration tests for CLI commands
```

## Pull Request Process

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**
   - Write code following our style guidelines
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**

   ```bash
   npm run precommit  # Runs linting, type-check, and tests
   ```

4. **Commit Your Changes**

   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

5. **Push and Create PR**

   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a pull request on GitHub.

### PR Requirements

- [ ] All tests pass
- [ ] Code is properly formatted and linted
- [ ] New features have tests
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional format
- [ ] PR description explains the changes

## Project Structure

```
src/
├── __tests__/          # Test utilities and setup
├── cli.ts             # CLI entry point
├── config.ts          # Configuration management
├── env-manager.ts     # Core environment management
├── index.ts           # Main library exports
├── storage.ts         # File storage operations
└── types.ts           # TypeScript type definitions
```

## Getting Help

- Check existing [issues](https://github.com/ASRagab/envctl/issues)
- Create a new issue for bugs or feature requests
- Join discussions in the [GitHub Discussions](https://github.com/ASRagab/envctl/discussions)

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct. By participating, you are expected to uphold this code.

Thank you for contributing! 🎉
