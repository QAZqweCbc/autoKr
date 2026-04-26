/**
 * Command Line Interface for the Frontend Evaluation System
 */

import { FrontendEvaluator } from '../engine/FrontendEvaluator';
import { FileSet, Config, OutputFormat } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CommandLineInterface {
  private evaluator: FrontendEvaluator;

  constructor() {
    this.evaluator = new FrontendEvaluator();
  }

  /**
   * Parse command line arguments
   */
  async parseArguments(args: string[]): Promise<void> {
    if (args.length < 3) {
      this.showHelp();
      process.exit(1);
    }

    const command = args[2];

    switch (command) {
      case 'analyze':
        await this.handleAnalyzeCommand(args.slice(3));
        break;
      case 'version':
        this.showVersion();
        break;
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }

  /**
   * Handle analyze command
   */
  private async handleAnalyzeCommand(args: string[]): Promise<void> {
    let htmlFiles: string[] = [];
    let cssFiles: string[] = [];
    let jsFiles: string[] = [];
    let directory: string | null = null;
    let configFile: string | null = null;
    let outputFormat: OutputFormat = OutputFormat.CONSOLE;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--html' && i + 1 < args.length) {
        htmlFiles = args[++i].split(',').filter(f => f.trim());
      } else if (arg === '--css' && i + 1 < args.length) {
        cssFiles = args[++i].split(',').filter(f => f.trim());
      } else if (arg === '--js' && i + 1 < args.length) {
        jsFiles = args[++i].split(',').filter(f => f.trim());
      } else if (arg === '--directory' && i + 1 < args.length) {
        directory = args[++i];
      } else if (arg === '--config' && i + 1 < args.length) {
        configFile = args[++i];
      } else if (arg === '--format' && i + 1 < args.length) {
        const format = args[++i].toUpperCase();
        if (Object.values(OutputFormat).includes(format as OutputFormat)) {
          outputFormat = format as OutputFormat;
        } else {
          console.error(`Invalid output format: ${format}. Valid formats: ${Object.values(OutputFormat).join(', ')}`);
          process.exit(1);
        }
      } else if (arg === '--help' || arg === '-h') {
        this.showAnalyzeHelp();
        process.exit(0);
      }
    }

    // Validate input
    if (!directory && htmlFiles.length === 0 && cssFiles.length === 0 && jsFiles.length === 0) {
      console.error('Error: No files or directory specified for analysis');
      this.showAnalyzeHelp();
      process.exit(1);
    }

    try {
      // Load configuration
      const config = await this.loadConfig(configFile);

      // Collect files
      const fileSet = directory 
        ? await this.collectFilesFromDirectory(directory)
        : await this.collectFilesFromLists(htmlFiles, cssFiles, jsFiles);

      // Run evaluation
      const report = await this.evaluator.evaluate(fileSet, config);

      // Output results
      this.outputResults(report, outputFormat, config);

      // Determine exit code
      const exitCode = this.determineExitCode(report, config);
      process.exit(exitCode);

    } catch (error) {
      console.error(`Analysis failed: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Load configuration from file or use defaults
   */
  private async loadConfig(configFile: string | null): Promise<Config> {
    const defaultConfig: Config = {
      rules: {
        enabled: ['CQ001', 'CQ002', 'PERF001', 'SEC001', 'ACC001', 'BP001'],
        disabled: [],
        custom: []
      },
      thresholds: {
        minScore: 70,
        failOnCritical: true
      },
      output: {
        format: OutputFormat.CONSOLE,
        includeCodeSnippets: true,
        detailedFindings: true
      }
    };

    if (!configFile) {
      return defaultConfig;
    }

    try {
      const configContent = await fs.readFile(configFile, 'utf-8');
      const fileConfig = JSON.parse(configContent);
      
      // Merge with defaults
      return {
        ...defaultConfig,
        ...fileConfig,
        rules: {
          ...defaultConfig.rules,
          ...(fileConfig.rules || {})
        },
        thresholds: {
          ...defaultConfig.thresholds,
          ...(fileConfig.thresholds || {})
        },
        output: {
          ...defaultConfig.output,
          ...(fileConfig.output || {})
        }
      };
    } catch (error) {
      console.warn(`Failed to load config file ${configFile}: ${error}. Using default configuration.`);
      return defaultConfig;
    }
  }

  /**
   * Collect files from directory
   */
  private async collectFilesFromDirectory(dirPath: string): Promise<FileSet> {
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

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(dirPath, file.name);
          const content = await fs.readFile(filePath, 'utf-8');
          
          if (file.name.endsWith('.html')) {
            fileSet.htmlFiles.set(filePath, content);
          } else if (file.name.endsWith('.css')) {
            fileSet.cssFiles.set(filePath, content);
          } else if (file.name.endsWith('.js') || file.name.endsWith('.jsx') || file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
            fileSet.jsFiles.set(filePath, content);
          }
        }
      }

      // Update metadata
      let totalSize = 0;
      for (const content of fileSet.htmlFiles.values()) totalSize += content.length;
      for (const content of fileSet.cssFiles.values()) totalSize += content.length;
      for (const content of fileSet.jsFiles.values()) totalSize += content.length;

      fileSet.metadata.totalSize = totalSize;
      fileSet.metadata.fileCount = fileSet.htmlFiles.size + fileSet.cssFiles.size + fileSet.jsFiles.size;

    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error}`);
    }

    return fileSet;
  }

  /**
   * Collect files from lists
   */
  private async collectFilesFromLists(
    htmlFiles: string[],
    cssFiles: string[],
    jsFiles: string[]
  ): Promise<FileSet> {
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

    // Load HTML files
    for (const filePath of htmlFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileSet.htmlFiles.set(filePath, content);
      } catch (error) {
        throw new Error(`Failed to read HTML file ${filePath}: ${error}`);
      }
    }

    // Load CSS files
    for (const filePath of cssFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileSet.cssFiles.set(filePath, content);
      } catch (error) {
        throw new Error(`Failed to read CSS file ${filePath}: ${error}`);
      }
    }

    // Load JavaScript files
    for (const filePath of jsFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileSet.jsFiles.set(filePath, content);
      } catch (error) {
        throw new Error(`Failed to read JavaScript file ${filePath}: ${error}`);
      }
    }

    // Update metadata
    let totalSize = 0;
    for (const content of fileSet.htmlFiles.values()) totalSize += content.length;
    for (const content of fileSet.cssFiles.values()) totalSize += content.length;
    for (const content of fileSet.jsFiles.values()) totalSize += content.length;

    fileSet.metadata.totalSize = totalSize;
    fileSet.metadata.fileCount = fileSet.htmlFiles.size + fileSet.cssFiles.size + fileSet.jsFiles.size;

    return fileSet;
  }

  /**
   * Output results in specified format
   */
  private outputResults(report: any, _format: OutputFormat, _config: Config): void {
    // Implementation will be enhanced in Task 10
    console.log(`Frontend Evaluation Complete`);
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Findings: ${report.summary.totalFindings}`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
  }

  /**
   * Determine exit code based on evaluation results and thresholds
   */
  private determineExitCode(report: any, config: Config): number {
    // Check for critical issues
    if (config.thresholds.failOnCritical && report.summary.criticalIssues > 0) {
      return 1;
    }

    // Check minimum score threshold
    if (report.overallScore < config.thresholds.minScore) {
      return 1;
    }

    return 0;
  }

  /**
   * Show version information
   */
  private showVersion(): void {
    console.log(`Frontend Evaluator v${this.evaluator.getVersion()}`);
  }

  /**
   * Show general help
   */
  private showHelp(): void {
    console.log(`
Frontend Evaluator - Comprehensive frontend webpage evaluation system

Usage: frontend-evaluator <command> [options]

Commands:
  analyze     Analyze frontend files or directories
  version     Show version information
  help        Show this help message

Examples:
  frontend-evaluator analyze --directory ./src
  frontend-evaluator analyze --html index.html --css styles.css --js app.js
  frontend-evaluator analyze --config .evaluatorrc.json

For more information on a specific command, use:
  frontend-evaluator <command> --help
    `);
  }

  /**
   * Show analyze command help
   */
  private showAnalyzeHelp(): void {
    console.log(`
Usage: frontend-evaluator analyze [options]

Options:
  --html <files>          Comma-separated list of HTML files to analyze
  --css <files>           Comma-separated list of CSS files to analyze
  --js <files>            Comma-separated list of JavaScript files to analyze
  --directory <path>      Directory containing files to analyze
  --config <file>         Configuration file (JSON)
  --format <format>       Output format: json, html, markdown, console (default: console)
  --help, -h              Show this help message

Examples:
  frontend-evaluator analyze --html index.html,about.html --css styles.css --js app.js
  frontend-evaluator analyze --directory ./src --config .evaluatorrc.json
  frontend-evaluator analyze --directory ./public --format json
    `);
  }
}