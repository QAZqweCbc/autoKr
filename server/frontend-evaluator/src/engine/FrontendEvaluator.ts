/**
 * Main orchestrator for the Frontend Evaluation System
 */

import { FileSet, Config, EvaluationReport, ValidationResult } from '../types';
import { FileParser } from '../parsers/FileParser';
import { InputHandler } from './InputHandler';
import { RuleEngine } from './RuleEngine';
import { ReportGenerator } from '../reports/ReportGenerator';

export class FrontendEvaluator {
  private fileParser: FileParser;
  private inputHandler: InputHandler;
  private ruleEngine: RuleEngine;
  private reportGenerator: ReportGenerator;

  constructor() {
    this.fileParser = new FileParser();
    this.inputHandler = new InputHandler();
    this.ruleEngine = new RuleEngine();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Main evaluation method
   */
  async evaluate(files: FileSet, config: Config): Promise<EvaluationReport> {
    // Validate input
    const validationResult = this.validateInput(files);
    if (!validationResult.isValid) {
      throw new Error(`Input validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Parse files
    const parsedFiles = await this.fileParser.parseFiles(files);

    // Apply rules and analyze
    const analysisResults = await this.ruleEngine.analyze(parsedFiles, config);

    // Generate report
    const report = await this.reportGenerator.generateReport(analysisResults, config);

    return report;
  }

  /**
   * Validate input files
   */
  validateInput(files: FileSet): ValidationResult {
    return this.inputHandler.validateFileSet(files);
  }

  /**
   * Get evaluator version
   */
  getVersion(): string {
    return '1.0.0';
  }

  /**
   * Create FileSet from file paths using InputHandler
   */
  async createFileSetFromPaths(filePaths: string[]): Promise<FileSet> {
    return this.inputHandler.createFileSetFromPaths(filePaths);
  }

  /**
   * Create FileSet from directory using InputHandler
   */
  async createFileSetFromDirectory(directoryPath: string): Promise<FileSet> {
    return this.inputHandler.createFileSetFromDirectory(directoryPath);
  }

  /**
   * Load configuration from file using InputHandler
   */
  async loadConfig(configPath: string): Promise<Config> {
    return this.inputHandler.loadConfig(configPath);
  }

  /**
   * Get default configuration using InputHandler
   */
  getDefaultConfig(): Config {
    return this.inputHandler.createDefaultConfig();
  }

  /**
   * Merge configurations using InputHandler
   */
  mergeConfigs(defaultConfig: Config, customConfig: Partial<Config>): Config {
    return this.inputHandler.mergeConfigs(defaultConfig, customConfig);
  }
}