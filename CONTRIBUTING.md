# Contributing to AEM MCP Server

Thank you for your interest in contributing to AEM MCP Server! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/aem-mcp-server.git
   cd aem-mcp-server
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### Setting Up Your Environment

1. Copy `.env.example` to `.env` and configure your AEM instance
2. Build the project: `npm run build`
3. Run tests: `npm test`
4. Start development server: `npm run dev`

### Making Changes

1. Make your changes in the `src/` directory
2. Add tests for new features in `src/__tests__/`
3. Update documentation as needed
4. Ensure all tests pass: `npm test`
5. Check for linting errors: `npm run lint`

## Contributor License Agreement (CLA)

### Why We Need a CLA

To maintain the dual-licensing model (AGPL-3.0 + Commercial), we need clear rights to the code. The CLA ensures:

1. **Legal Clarity**: We can offer commercial licenses without legal complications
2. **Protection**: Contributors retain copyright while granting necessary rights
3. **Sustainability**: Enables the project to continue offering both open source and commercial licenses

### CLA Terms

By contributing to this project, you agree that:

1. **You grant us a perpetual, worldwide, non-exclusive, royalty-free license** to use, modify, and distribute your contributions under:
   - The GNU Affero General Public License v3.0 (AGPL-3.0), AND
   - Commercial licenses as offered by the project maintainers

2. **You retain copyright** to your contributions

3. **You certify that**:
   - The contribution is your original work, OR
   - You have the right to submit it under these terms, AND
   - You understand the contribution is public and will be maintained indefinitely

4. **You grant users of the project** a license to your contributions under AGPL-3.0

### How to Sign the CLA

**For Individual Contributors:**

Add the following to your first pull request:

```
I agree to the Contributor License Agreement as outlined in CONTRIBUTING.md.

Signed: [Your Full Name]
Date: [YYYY-MM-DD]
GitHub: @your-github-username
Email: your-email@example.com
```

**For Corporate Contributors:**

If you're contributing on behalf of your employer, we need a Corporate CLA. Please contact us at indrasish00@gmail.com before submitting your contribution.

## Pull Request Process

1. **Update documentation** for any changed functionality
2. **Add tests** for new features or bug fixes
3. **Ensure all tests pass**: `npm test`
4. **Update CHANGELOG.md** with details of your changes
5. **Sign the CLA** (if this is your first contribution)
6. **Submit your pull request** with a clear description of the changes

### PR Title Format

Use conventional commits format:
- `feat: Add new feature`
- `fix: Fix bug in component`
- `docs: Update documentation`
- `test: Add tests for feature`
- `refactor: Refactor code`
- `chore: Update dependencies`

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
Describe the tests you ran and how to reproduce them

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass
- [ ] I have updated the documentation accordingly
- [ ] I have signed the CLA (if first contribution)
```

## Coding Standards

### TypeScript Style Guide

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer `const` over `let`, avoid `var`
- Use async/await over promises where possible

### File Organization

```
src/
├── operations/          # AEM operation implementations
├── interfaces/          # TypeScript interfaces
├── config/             # Configuration files
├── __tests__/          # Test files
└── [other modules]     # Core modules
```

### Naming Conventions

- **Files**: kebab-case (e.g., `page-operations.ts`)
- **Classes**: PascalCase (e.g., `AEMConnector`)
- **Functions**: camelCase (e.g., `createPage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IPageProperties`)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- page-operations.test.ts
```

### Writing Tests

- Place tests in `src/__tests__/` directory
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies (AEM API calls)
- Aim for >80% code coverage

Example test:

```typescript
describe('createPage', () => {
  it('should create a page with the specified template', async () => {
    // Arrange
    const params = {
      parentPath: '/content/test',
      title: 'Test Page',
      template: '/conf/test/templates/page'
    };
    
    // Act
    const result = await createPage(params);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.data.path).toBeDefined();
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for all public functions and classes
- Include parameter descriptions and return types
- Add usage examples for complex functions

Example:

```typescript
/**
 * Creates a new page in AEM with the specified template
 * 
 * @param params - Page creation parameters
 * @param params.parentPath - Path to the parent page
 * @param params.title - Title of the new page
 * @param params.template - Template path to use
 * @returns Promise resolving to the created page information
 * 
 * @example
 * ```typescript
 * const result = await createPage({
 *   parentPath: '/content/mysite/en',
 *   title: 'New Page',
 *   template: '/conf/mysite/templates/page'
 * });
 * ```
 */
export async function createPage(params: CreatePageParams): Promise<PageResult> {
  // Implementation
}
```

### README Updates

- Update README.md if you add new features
- Add usage examples for new functionality
- Update API documentation as needed

## Questions?

If you have questions about contributing, please:

1. Check existing issues and pull requests
2. Read the documentation
3. Open a new issue with the "question" label
4. Contact us at indrasish00@gmail.com

## Recognition

Contributors will be recognized in:
- The project README
- Release notes
- The project website (if applicable)

Thank you for contributing to AEM MCP Server! 🎉

---

## License Notice

By contributing to this project, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) and may also be used in commercial licenses as described in the CLA.

**Copyright (C) 2025 Indra**

