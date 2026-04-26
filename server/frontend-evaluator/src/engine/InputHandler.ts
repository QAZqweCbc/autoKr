/**
 * Input Handler for file input and configuration loading
 * 
 * Responsibilities:
 * 1. Create FileSet data structure from file inputs
 * 2. Validate files (size, format, structure)
 * 3. Load configuration from JSON/YAML files
 * 4. Handle file reading from disk
 */

import { FileSet, Config, ValidationResult, Technology, OutputFormat } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export class InputHandler {
  private maxFileSize: number;
  private supportedExtensions: {
    html: string[];
    css: string[];
    js: string[];
  };

  constructor() {
    // Default configuration
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.supportedExtensions = {
      html: ['.html', '.htm', '.xhtml'],
      css: ['.css', '.scss', '.sass', '.less'],
      js: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
    };
  }

  /**
   * Create FileSet from file paths
   */
  async createFileSetFromPaths(filePaths: string[]): Promise<FileSet> {
    const fileSet: FileSet = {
      htmlFiles: new Map(),
      cssFiles: new Map(),
      jsFiles: new Map(),
      metadata: {
        totalSize: 0,
        fileCount: 0,
        technologies: []
      }
    };

    for (const filePath of filePaths) {
      try {
        const content = await this.readFile(filePath);
        const fileType = this.detectFileType(filePath);
        
        switch (fileType) {
          case 'html':
            fileSet.htmlFiles.set(filePath, content);
            break;
          case 'css':
            fileSet.cssFiles.set(filePath, content);
            break;
          case 'js':
            fileSet.jsFiles.set(filePath, content);
            break;
          default:
            console.warn(`Unsupported file type: ${filePath}`);
        }
      } catch (error) {
        console.warn(`Failed to read file ${filePath}: ${error}`);
      }
    }

    // Update metadata
    fileSet.metadata.fileCount = fileSet.htmlFiles.size + fileSet.cssFiles.size + fileSet.jsFiles.size;
    fileSet.metadata.totalSize = this.calculateTotalSize(fileSet);
    fileSet.metadata.technologies = this.detectTechnologies(fileSet);

    return fileSet;
  }

  /**
   * Create FileSet from directory
   */
  async createFileSetFromDirectory(directoryPath: string): Promise<FileSet> {
    const filePaths = await this.scanDirectory(directoryPath);
    return this.createFileSetFromPaths(filePaths);
  }

  /**
   * Validate FileSet
   */
  validateFileSet(files: FileSet): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if any files are provided
    if (files.metadata.fileCount === 0) {
      errors.push('No files provided for analysis');
    }

    // Check file sizes
    for (const [filename, content] of files.htmlFiles) {
      if (content.length > this.maxFileSize) {
        warnings.push(`HTML file ${filename} exceeds recommended size limit (${this.formatFileSize(content.length)} > ${this.formatFileSize(this.maxFileSize)})`);
      }
    }

    for (const [filename, content] of files.cssFiles) {
      if (content.length > this.maxFileSize) {
        warnings.push(`CSS file ${filename} exceeds recommended size limit (${this.formatFileSize(content.length)} > ${this.formatFileSize(this.maxFileSize)})`);
      }
    }

    for (const [filename, content] of files.jsFiles) {
      if (content.length > this.maxFileSize) {
        warnings.push(`JavaScript file ${filename} exceeds recommended size limit (${this.formatFileSize(content.length)} > ${this.formatFileSize(this.maxFileSize)})`);
      }
    }

    // Check for basic file structure
    this.validateFileStructure(files, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load configuration from file
   */
  async loadConfig(configPath: string): Promise<Config> {
    try {
      const content = await this.readFile(configPath);
      const extension = path.extname(configPath).toLowerCase();
      
      let config: Config;
      
      if (extension === '.json') {
        config = JSON.parse(content);
      } else if (extension === '.yaml' || extension === '.yml') {
        config = yaml.load(content) as Config;
      } else {
        throw new Error(`Unsupported configuration file format: ${extension}. Supported formats: .json, .yaml, .yml`);
      }

      // Validate configuration structure
      this.validateConfig(config);
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create default configuration
   */
  createDefaultConfig(): Config {
    return {
      rules: {
        enabled: [], // All rules enabled by default
        disabled: [], // No rules disabled by default
        custom: [] // No custom rules by default
      },
      thresholds: {
        minScore: 70, // Minimum acceptable score per category
        failOnCritical: true // Fail on critical issues
      },
      output: {
        format: OutputFormat.CONSOLE,
        includeCodeSnippets: true,
        detailedFindings: true
      }
    };
  }

  /**
   * Merge configurations (default + custom)
   */
  mergeConfigs(defaultConfig: Config, customConfig: Partial<Config>): Config {
    return {
      rules: {
        ...defaultConfig.rules,
        ...customConfig.rules,
        enabled: customConfig.rules?.enabled || defaultConfig.rules.enabled,
        disabled: customConfig.rules?.disabled || defaultConfig.rules.disabled,
        custom: customConfig.rules?.custom || defaultConfig.rules.custom
      },
      thresholds: {
        ...defaultConfig.thresholds,
        ...customConfig.thresholds
      },
      output: {
        ...defaultConfig.output,
        ...customConfig.output
      }
    };
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect file type from extension
   */
  private detectFileType(filePath: string): 'html' | 'css' | 'js' | 'unknown' {
    const extension = path.extname(filePath).toLowerCase();
    
    if (this.supportedExtensions.html.includes(extension)) {
      return 'html';
    } else if (this.supportedExtensions.css.includes(extension)) {
      return 'css';
    } else if (this.supportedExtensions.js.includes(extension)) {
      return 'js';
    }
    
    return 'unknown';
  }

  /**
   * Scan directory for supported files
   */
  private async scanDirectory(directoryPath: string): Promise<string[]> {
    const filePaths: string[] = [];
    
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          filePaths.push(fullPath);
        }
      }
    }
    
    await scan(directoryPath);
    return filePaths;
  }

  /**
   * Calculate total size of files
   */
  private calculateTotalSize(files: FileSet): number {
    let totalSize = 0;
    
    for (const content of files.htmlFiles.values()) {
      totalSize += content.length;
    }
    
    for (const content of files.cssFiles.values()) {
      totalSize += content.length;
    }
    
    for (const content of files.jsFiles.values()) {
      totalSize += content.length;
    }
    
    return totalSize;
  }

  /**
   * Detect technologies from file content
   */
  private detectTechnologies(files: FileSet): Technology[] {
    const technologies: Technology[] = [];
    const allContent = [
      ...Array.from(files.htmlFiles.values()),
      ...Array.from(files.cssFiles.values()),
      ...Array.from(files.jsFiles.values())
    ].join('\n');

    // Detect frameworks and libraries
    if (allContent.includes('React') || allContent.includes('react')) {
      technologies.push(Technology.REACT);
    }
    
    if (allContent.includes('Vue') || allContent.includes('vue')) {
      technologies.push(Technology.VUE);
    }
    
    if (allContent.includes('Angular') || allContent.includes('angular')) {
      technologies.push(Technology.ANGULAR);
    }
    
    if (allContent.includes('Next.js') || allContent.includes('nextjs')) {
      technologies.push(Technology.NEXTJS);
    }
    
    if (allContent.includes('Svelte') || allContent.includes('svelte')) {
      technologies.push(Technology.SVELTE);
    }
    
    if (allContent.includes('jQuery') || allContent.includes('$(')) {
      technologies.push(Technology.JQUERY);
    }
    
    if (allContent.includes('Bootstrap') || allContent.includes('bootstrap')) {
      technologies.push(Technology.BOOTSTRAP);
    }
    
    if (allContent.includes('Tailwind') || allContent.includes('tailwind')) {
      technologies.push(Technology.TAILWIND);
    }
    
    if (allContent.includes('Material-UI') || allContent.includes('material-ui')) {
      technologies.push(Technology.MATERIAL_UI);
    }
    
    if (allContent.includes('webpack') || allContent.includes('Webpack')) {
      technologies.push(Technology.WEBPACK);
    }
    
    if (allContent.includes('Vite') || allContent.includes('vite')) {
      technologies.push(Technology.VITE);
    }
    
    if (allContent.includes('TypeScript') || allContent.includes('typescript')) {
      technologies.push(Technology.TYPESCRIPT);
    }

    return technologies;
  }

  /**
   * Validate file structure
   */
  private validateFileStructure(files: FileSet, _errors: string[], warnings: string[]): void {
    // Check for HTML files with proper structure
    for (const [filename, content] of files.htmlFiles) {
      if (!content.includes('<html') && !content.includes('<!DOCTYPE')) {
        warnings.push(`HTML file ${filename} may not have proper HTML structure`);
      }
      
      if (!content.includes('<body')) {
        warnings.push(`HTML file ${filename} may be missing body tag`);
      }
    }

    // Check for CSS files with proper structure
    for (const [filename, content] of files.cssFiles) {
      if (!content.includes('{') || !content.includes('}')) {
        warnings.push(`CSS file ${filename} may not have proper CSS structure`);
      }
    }

    // Check for JavaScript files with proper structure
    for (const [filename, content] of files.jsFiles) {
      if (content.trim().length === 0) {
        warnings.push(`JavaScript file ${filename} is empty`);
      }
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: Config): void {
    const errors: string[] = [];

    // Check required fields
    if (!config.rules) {
      errors.push('Configuration missing "rules" section');
    } else {
      if (!Array.isArray(config.rules.enabled)) {
        errors.push('"rules.enabled" must be an array');
      }
      
      if (!Array.isArray(config.rules.disabled)) {
        errors.push('"rules.disabled" must be an array');
      }
      
      if (!Array.isArray(config.rules.custom)) {
        errors.push('"rules.custom" must be an array');
      }
    }

    if (!config.thresholds) {
      errors.push('Configuration missing "thresholds" section');
    } else {
      if (typeof config.thresholds.minScore !== 'number' || config.thresholds.minScore < 0 || config.thresholds.minScore > 100) {
        errors.push('"thresholds.minScore" must be a number between 0 and 100');
      }
      
      if (typeof config.thresholds.failOnCritical !== 'boolean') {
        errors.push('"thresholds.failOnCritical" must be a boolean');
      }
    }

    if (!config.output) {
      errors.push('Configuration missing "output" section');
    } else {
      if (!['JSON', 'HTML', 'MARKDOWN', 'CONSOLE'].includes(config.output.format)) {
        errors.push('"output.format" must be one of: JSON, HTML, MARKDOWN, CONSOLE');
      }
      
      if (typeof config.output.includeCodeSnippets !== 'boolean') {
        errors.push('"output.includeCodeSnippets" must be a boolean');
      }
      
      if (typeof config.output.detailedFindings !== 'boolean') {
        errors.push('"output.detailedFindings" must be a boolean');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Format file size for human readability
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Set maximum file size
   */
  setMaxFileSize(sizeInBytes: number): void {
    if (sizeInBytes <= 0) {
      throw new Error('Maximum file size must be greater than 0');
    }
    this.maxFileSize = sizeInBytes;
  }

  /**
   * Get current maximum file size
   */
  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  /**
   * Add supported file extensions
   */
  addSupportedExtensions(type: 'html' | 'css' | 'js', extensions: string[]): void {
    for (const ext of extensions) {
      if (!this.supportedExtensions[type].includes(ext)) {
        this.supportedExtensions[type].push(ext);
      }
    }
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): { html: string[]; css: string[]; js: string[] } {
    return { ...this.supportedExtensions };
  }
}
