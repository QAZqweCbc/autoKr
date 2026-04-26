# Frontend Evaluation System

A comprehensive tool for analyzing frontend webpages without requiring external API access. Provides static analysis capabilities for code quality, performance, security, accessibility, and best practices validation.

## Features

- **Static Code Analysis**: Analyze HTML structure, CSS quality, and JavaScript patterns
- **Performance Assessment**: Calculate critical rendering path, identify unoptimized assets
- **Security Vulnerability Detection**: Detect XSS, CSRF, and other security issues
- **Accessibility Compliance Check**: Verify WCAG 2.1 AA compliance
- **Best Practices Validation**: Check responsive design, SEO meta tags, framework best practices
- **Technology Stack Analysis**: Detect frameworks, libraries, and build tools
- **Custom Rule Support**: Define team-specific coding standards
- **Multiple Output Formats**: JSON, HTML, Markdown, and console output
- **CI/CD Integration**: Command-line interface with exit code determination

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd frontend-evaluator

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Command Line Interface

```bash
# Analyze a directory
npx frontend-evaluator analyze --directory ./src

# Analyze specific files
npx frontend-evaluator analyze --html index.html --css styles.css --js app.js

# Use configuration file
npx frontend-evaluator analyze --directory ./public --config .evaluatorrc.json

# Output in different formats
npx frontend-evaluator analyze --directory ./src --format json
npx frontend-evaluator analyze --directory ./src --format html
npx frontend-evaluator analyze --directory ./src --format markdown
```

### Programmatic Usage

```typescript
import { FrontendEvaluator } from 'frontend-evaluator';

const evaluator = new FrontendEvaluator();
const fileSet = {
  htmlFiles: new Map([['index.html', '<html>...</html>']]),
  cssFiles: new Map([['styles.css', 'body { color: red; }']]),
  jsFiles: new Map([['app.js', 'console.log("test");']]),
  metadata: {
    totalSize: 0,
    fileCount: 0,
    technologies: []
  }
};

const config = {
  rules: {
    enabled: ['CQ001', 'CQ002', 'PERF001'],
    disabled: [],
    custom: []
  },
  thresholds: {
    minScore: 70,
    failOnCritical: true
  },
  output: {
    format: 'JSON',
    includeCodeSnippets: true,
    detailedFindings: true
  }
};

const report = await evaluator.evaluate(fileSet, config);
console.log(`Overall Score: ${report.overallScore}`);
```

## Configuration

Create a `.evaluatorrc.json` file:

```json
{
  "rules": {
    "enabled": ["CQ001", "CQ002", "PERF001", "SEC001", "ACC001", "BP001"],
    "disabled": [],
    "custom": [
      {
        "id": "CUSTOM001",
        "name": "Custom Company Rule",
        "description": "Check for company-specific patterns",
        "category": "CODE_QUALITY",
        "severity": "MEDIUM",
        "message": "Custom rule violation detected",
        "recommendation": "Follow company coding standards"
      }
    ]
  },
  "thresholds": {
    "minScore": 80,
    "failOnCritical": true
  },
  "output": {
    "format": "JSON",
    "includeCodeSnippets": true,
    "detailedFindings": true
  }
}
```

## Development

### Project Structure

```
frontend-evaluator/
├── src/
│   ├── types/           # Core type definitions
│   ├── parsers/         # File parsing components
│   ├── analyzers/       # Analysis components
│   ├── engine/          # Core engine and rule engine
│   ├── reports/         # Report generation
│   ├── cli/             # Command-line interface
│   └── __tests__/       # Test files
├── dist/                # Compiled output
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

### Building

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Testing

The project uses Jest for testing with both unit tests and property-based tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Requirements Coverage

This system implements all requirements from the specification:

- **Requirement 1**: Static Code Analysis ✓
- **Requirement 2**: Performance Assessment ✓
- **Requirement 3**: Security Vulnerability Detection ✓
- **Requirement 4**: Accessibility Compliance Check ✓
- **Requirement 5**: Best Practices Validation ✓
- **Requirement 6**: Report Generation ✓
- **Requirement 7**: External API Restriction Compliance ✓
- **Requirement 8**: Integration and Automation ✓
- **Requirement 9**: Technology Stack Analysis ✓
- **Requirement 10**: Custom Rule Support ✓

## Design Principles

1. **Privacy-First**: No external API calls, all analysis performed offline
2. **Extensible**: Plugin architecture for custom analyzers and rules
3. **Actionable Insights**: Specific recommendations with implementation steps
4. **Automation-Friendly**: Designed for CI/CD pipeline integration
5. **Comprehensive**: Multi-faceted analysis across all frontend concerns

## License

MIT