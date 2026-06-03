# Agent Configuration

## File Scanning Rules

### Excluded Directories
When scanning the codebase, ignore the following directories:
- `node_modules/` - Node.js dependencies
- `frontend/node_modules/` - Frontend dependencies
- `dist/` - Build output
- `frontend/dist/` - Frontend build output
- `.git/` - Git repository data
- `logs/` - Log files
- `data/` - Runt `backups/` - Backup files
- `*.backup/` - Any backup directories

### Excluded File Patterns
Ignore the following file types and patterns:
- `*.backup` - Backup files
- `*.bak` - Backup files
- `*.old` - Old versions
- `*.tmp` - Temporary files
- `*.log` - Log files
- `*~` - Editor backup files
- `.DS_Store` - macOS system files
- `Thumbs.db` - Windows thumbnail cache

### Excluded Image Files
Skip image files during code scanning:
- `*.jpg`, `*.jpeg` - JPEG images
- `*.png` - PNG images
- `*.gif` - GIF images
- `*.svg` - SVG images
- `*.ico` - Icon files
- `*.webp` - WebP images
- `*.bmp` - Bitmap images

### Excluded Binary and Media Files
- `*.pdf` - PDF documents
- `*.zip`, `*.tar`, `*.gz`, `*.rar` - Archives
- `*.exe`, `*.dll`, `*.so` - Executables and libraries
- `*.mp4`, `*.avi`, `*.mov` - Video files
- `*.mp3`, `*.wav`, `*.ogg` - Audio files

## Search Patterns

### When using Glob tool
```bash
# Good - excludes node_modules
**/*.ts

# Bad - includes everything
*
```

### When using Grep tool
Always use appropriate glob patterns to exclude unwanted directories:
```bash
# Search TypeScript files, excluding node_modules
grep -r "pattern" --include="*.ts" --exclude-dir="node_modules" --exclude-dir="dist"
```

## Code Review Focus

### Priority Files
Focus on these directories for code review:
- `src/` - Main source code
- utes/` - Route definitions
- `src/models/` - Data models
- `src/utils/` - Utility functions
- `src/middleware/` - Express middleware
- `src/config/` - Configuration files

### Configuration Files
Review these configuration files:
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `ecosystem.config.js` - PM2 configuration
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore rules

## Performance Guidelines

### Large File Handling
- Skip files larger than 1MB during initial scans
- Use targeted reads for large log files
- Avoid loading entire `package-lock.json` or `yarn.lock`

### Efficient Scannieded
3. Use `Glob` with specific patterns instead of broad searches
4. Limit `Grep` results with `head_limit` parameter

## Project-Specific Rules

### Database Files
- Skip `data/*.json` - Runtime database files
eview `frontend/src/` - Source code only

### Documentation
- Focus on `README.md` for project overview
- Skip archived documentation in root directory
- Review inline code comments and JSDoc

## Example Glob Patterns

### TypeScript Source Files
```
src/**/*.ts
frontend/src/**/*.ts
```

### Configuration Files
```
*.config.js
*.config.ts
tsconfig.json
```

### Test Files
```
src/**/*.test.ts
src/**/*.spec.ts
```

### Exclude Everything Unwanted
```
**/*.ts
!node_modules/**
!dist/**
!*.backup
!logs/**
```

## Code Standards

### File Size and Organization
- 单个文件代码行数控制在 500 行，必要时可超出，但不应显著超过
- 按功能模块拆分文件，避免将无关逻辑堆叠在同一文件中

### Comments and Documentation
- 注释使用中文
- 保持注释简洁明了，说明代码意图而非重复代码逻辑
- 对复杂业务逻辑和关键决策点添加注释

## Noiently by avoiding unnecessary file scans
- Update this file when adding new directories or file types to exclude
- Agents should respect these rules unless explicitly asked to scan excluded areas
