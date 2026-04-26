/**
 * Rule Engine for applying analysis rules
 */

import { Config, AnalysisResult, AnalysisCategory, Rule, Severity, AnalysisContext, Finding, Priority, Recommendation } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface ParsedFiles {
  htmlASTs: Map<string, any>;
  cssASTs: Map<string, any>;
  jsASTs: Map<string, any>;
}

export class RuleEngine {
  private builtInRules: Map<string, Rule> = new Map();
  private customRules: Map<string, Rule> = new Map();
  private rulePriorities: Map<string, number> = new Map();

  constructor() {
    this.initializeBuiltInRules();
  }

  /**
   * Initialize built-in rules
   */
  private initializeBuiltInRules(): void {
    // Code Quality Rules
    this.builtInRules.set('CQ001', {
      id: 'CQ001',
      name: 'Missing HTML Doctype',
      description: 'Check for missing HTML5 doctype declaration',
      category: AnalysisCategory.CODE_QUALITY,
      severity: Severity.MEDIUM,
      condition: (_ast: any) => {
        // Implementation will be added in Task 2
        return false;
      },
      message: 'HTML file is missing doctype declaration',
      recommendation: 'Add <!DOCTYPE html> at the beginning of the HTML file'
    });

    this.builtInRules.set('CQ002', {
      id: 'CQ002',
      name: 'Unused CSS Selectors',
      description: 'Detect CSS selectors that are not used in HTML',
      category: AnalysisCategory.CODE_QUALITY,
      severity: Severity.LOW,
      condition: (_ast: any) => {
        // Implementation will be added in Task 2
        return false;
      },
      message: 'CSS selector is not used in any HTML file',
      recommendation: 'Remove unused CSS selectors to reduce file size'
    });

    // Performance Rules
    this.builtInRules.set('PERF001', {
      id: 'PERF001',
      name: 'Large Unoptimized Images',
      description: 'Detect images that could be optimized',
      category: AnalysisCategory.PERFORMANCE,
      severity: Severity.MEDIUM,
      condition: (_ast: any) => {
        // Implementation will be added in Task 4
        return false;
      },
      message: 'Image file could be optimized for better performance',
      recommendation: 'Compress images using tools like ImageOptim or Squoosh'
    });

    // Security Rules
    this.builtInRules.set('SEC001', {
      id: 'SEC001',
      name: 'Potential XSS Vulnerability',
      description: 'Detect potential Cross-Site Scripting vulnerabilities',
      category: AnalysisCategory.SECURITY,
      severity: Severity.HIGH,
      condition: (_ast: any) => {
        // Implementation will be added in Task 6
        return false;
      },
      message: 'Potential XSS vulnerability detected',
      recommendation: 'Use proper input sanitization and output encoding'
    });

    // Accessibility Rules
    this.builtInRules.set('ACC001', {
      id: 'ACC001',
      name: 'Missing Image Alt Text',
      description: 'Check for images without alt text',
      category: AnalysisCategory.ACCESSIBILITY,
      severity: Severity.MEDIUM,
      condition: (_ast: any) => {
        // Implementation will be added in Task 6
        return false;
      },
      message: 'Image is missing alt text attribute',
      recommendation: 'Add descriptive alt text to all images'
    });

    // Best Practices Rules
    this.builtInRules.set('BP001', {
      id: 'BP001',
      name: 'Missing Viewport Meta Tag',
      description: 'Check for missing viewport meta tag for responsive design',
      category: AnalysisCategory.BEST_PRACTICES,
      severity: Severity.MEDIUM,
      condition: (_ast: any) => {
        // Implementation will be added in Task 6
        return false;
      },
      message: 'Missing viewport meta tag',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">'
    });

    // Set default priorities (higher number = higher priority)
    this.rulePriorities.set('CQ001', 50);
    this.rulePriorities.set('CQ002', 30);
    this.rulePriorities.set('PERF001', 60);
    this.rulePriorities.set('SEC001', 100); // Security rules have highest priority
    this.rulePriorities.set('ACC001', 70);
    this.rulePriorities.set('BP001', 40);
  }

  /**
   * Load custom rules from configuration file
   */
  async loadCustomRules(configPath: string): Promise<Rule[]> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const extension = path.extname(configPath).toLowerCase();
      
      let rulesConfig: any;
      
      if (extension === '.json') {
        rulesConfig = JSON.parse(content);
      } else if (extension === '.yaml' || extension === '.yml') {
        rulesConfig = yaml.load(content);
      } else {
        throw new Error(`Unsupported configuration file format: ${extension}. Supported formats: .json, .yaml, .yml`);
      }

      // Validate rules configuration structure
      this.validateRulesConfig(rulesConfig);
      
      const rules: Rule[] = [];
      
      if (Array.isArray(rulesConfig.rules)) {
        for (const ruleData of rulesConfig.rules) {
          const rule = this.createRuleFromConfig(ruleData);
          if (rule) {
            rules.push(rule);
            this.customRules.set(rule.id, rule);
            
            // Set custom rule priority (default to 50 if not specified)
            this.rulePriorities.set(rule.id, ruleData.priority || 50);
          }
        }
      } else if (rulesConfig.rules && typeof rulesConfig.rules === 'object') {
        // Handle object format where keys are rule IDs
        for (const [ruleId, ruleData] of Object.entries(rulesConfig.rules)) {
          const rule = this.createRuleFromConfig({ id: ruleId, ...(ruleData as any) });
          if (rule) {
            rules.push(rule);
            this.customRules.set(rule.id, rule);
            
            // Set custom rule priority
            this.rulePriorities.set(rule.id, (ruleData as any).priority || 50);
          }
        }
      }
      
      return rules;
    } catch (error) {
      throw new Error(`Failed to load custom rules from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a rule from configuration data
   */
  private createRuleFromConfig(ruleData: any): Rule | null {
    try {
      // Validate required fields
      if (!ruleData.id || typeof ruleData.id !== 'string') {
        throw new Error('Rule must have a string "id" field');
      }
      
      if (!ruleData.name || typeof ruleData.name !== 'string') {
        throw new Error(`Rule ${ruleData.id} must have a string "name" field`);
      }
      
      if (!ruleData.description || typeof ruleData.description !== 'string') {
        throw new Error(`Rule ${ruleData.id} must have a string "description" field`);
      }
      
      if (!ruleData.category || !Object.values(AnalysisCategory).includes(ruleData.category)) {
        throw new Error(`Rule ${ruleData.id} must have a valid "category" field (${Object.values(AnalysisCategory).join(', ')})`);
      }
      
      if (!ruleData.severity || !Object.values(Severity).includes(ruleData.severity)) {
        throw new Error(`Rule ${ruleData.id} must have a valid "severity" field (${Object.values(Severity).join(', ')})`);
      }
      
      if (!ruleData.message || typeof ruleData.message !== 'string') {
        throw new Error(`Rule ${ruleData.id} must have a string "message" field`);
      }
      
      if (!ruleData.recommendation || typeof ruleData.recommendation !== 'string') {
        throw new Error(`Rule ${ruleData.id} must have a string "recommendation" field`);
      }
      
      // Create condition function
      let condition: (ast: any, context: AnalysisContext) => boolean;
      
      if (typeof ruleData.condition === 'function') {
        // Already a function (e.g., from JSON.parse with reviver)
        condition = ruleData.condition;
      } else if (typeof ruleData.condition === 'string') {
        // String representation of function
        try {
          // Note: In production, you'd want to sandbox this evaluation
          condition = eval(`(${ruleData.condition})`);
        } catch (e) {
          throw new Error(`Rule ${ruleData.id} has invalid condition function: ${e}`);
        }
      } else {
        // Default condition that always returns false
        condition = () => false;
      }
      
      return {
        id: ruleData.id,
        name: ruleData.name,
        description: ruleData.description,
        category: ruleData.category,
        severity: ruleData.severity,
        condition,
        message: ruleData.message,
        recommendation: ruleData.recommendation
      };
    } catch (error) {
      console.warn(`Failed to create rule from config: ${error}`);
      return null;
    }
  }

  /**
   * Validate rules configuration structure
   */
  private validateRulesConfig(config: any): void {
    const errors: string[] = [];
    
    if (!config) {
      errors.push('Configuration is empty or null');
    }
    
    if (!config.rules) {
      errors.push('Configuration missing "rules" field');
    } else if (!Array.isArray(config.rules) && typeof config.rules !== 'object') {
      errors.push('"rules" must be an array or object');
    }
    
    if (errors.length > 0) {
      throw new Error(`Rules configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Apply rules to parsed files with priority handling
   */
  async analyze(parsedFiles: ParsedFiles, config: Config): Promise<Map<AnalysisCategory, AnalysisResult>> {
    const results = new Map<AnalysisCategory, AnalysisResult>();

    // Initialize results for each category
    Object.values(AnalysisCategory).forEach(category => {
      results.set(category, {
        category,
        findings: [],
        score: 100, // Start with perfect score
        recommendations: []
      });
    });

    // Get all rules to apply (built-in + custom)
    const rulesToApply: Rule[] = [];
    
    // Get enabled/disabled rule IDs
    const enabledRules = config.rules.enabled;
    const disabledRules = config.rules.disabled;
    
    // Add built-in rules
    for (const [ruleId, rule] of this.builtInRules) {
      if ((enabledRules.length === 0 || enabledRules.includes(ruleId)) && !disabledRules.includes(ruleId)) {
        rulesToApply.push(rule);
      }
    }
    
    // Add custom rules from config
    for (const rule of config.rules.custom) {
      if ((enabledRules.length === 0 || enabledRules.includes(rule.id)) && !disabledRules.includes(rule.id)) {
        rulesToApply.push(rule);
      }
    }
    
    // Add custom rules loaded from files
    for (const [ruleId, rule] of this.customRules) {
      if ((enabledRules.length === 0 || enabledRules.includes(ruleId)) && !disabledRules.includes(ruleId)) {
        rulesToApply.push(rule);
      }
    }

    // Sort rules by priority (higher priority first)
    rulesToApply.sort((a, b) => {
      const priorityA = this.rulePriorities.get(a.id) || 50;
      const priorityB = this.rulePriorities.get(b.id) || 50;
      return priorityB - priorityA; // Higher priority first
    });

    // Apply rules to appropriate files
    for (const rule of rulesToApply) {
      await this.applyRule(rule, parsedFiles, results, config);
    }

    // Calculate scores based on findings
    this.calculateScores(results);

    // Generate recommendations from findings
    this.generateRecommendations(results);

    return results;
  }

  /**
   * Apply a single rule to parsed files
   */
  private async applyRule(
    rule: Rule, 
    parsedFiles: ParsedFiles, 
    results: Map<AnalysisCategory, AnalysisResult>,
    config: Config
  ): Promise<void> {
    const result = results.get(rule.category);
    if (!result) return;

    // Determine which ASTs to check based on rule category
    let astsToCheck: Map<string, any> = new Map();
    let fileType: 'html' | 'css' | 'js' = 'html';
    
    switch (rule.category) {
      case AnalysisCategory.CODE_QUALITY:
        // Check all file types for code quality
        astsToCheck = new Map([...parsedFiles.htmlASTs, ...parsedFiles.cssASTs, ...parsedFiles.jsASTs]);
        break;
      case AnalysisCategory.PERFORMANCE:
        // Check HTML for resource references
        astsToCheck = parsedFiles.htmlASTs;
        fileType = 'html';
        break;
      case AnalysisCategory.SECURITY:
        // Check JavaScript for security issues
        astsToCheck = parsedFiles.jsASTs;
        fileType = 'js';
        break;
      case AnalysisCategory.ACCESSIBILITY:
        // Check HTML for accessibility issues
        astsToCheck = parsedFiles.htmlASTs;
        fileType = 'html';
        break;
      case AnalysisCategory.BEST_PRACTICES:
        // Check all file types for best practices
        astsToCheck = new Map([...parsedFiles.htmlASTs, ...parsedFiles.cssASTs, ...parsedFiles.jsASTs]);
        break;
    }

    // Apply rule to each AST
    for (const [filePath, ast] of astsToCheck) {
      try {
        const context: AnalysisContext = {
          filePath,
          fileType,
          technologyStack: {
            frameworks: [],
            libraries: [],
            buildTools: [],
            detectedVersions: new Map()
          }
        };

        const ruleApplies = rule.condition(ast, context);
        
        if (ruleApplies) {
          const finding: Finding = {
            id: `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            severity: rule.severity,
            message: rule.message,
            location: {
              file: filePath,
              line: 1, // Default line, will be refined by specific analyzers
              column: 1
            },
            codeSnippet: this.extractCodeSnippet(filePath, ast, config),
            ruleId: rule.id
          };
          
          result.findings.push(finding);
        }
      } catch (error) {
        console.warn(`Failed to apply rule ${rule.id} to file ${filePath}: ${error}`);
      }
    }
  }

  /**
   * Extract code snippet from AST for reporting
   */
  private extractCodeSnippet(filePath: string, _ast: any, config: Config): string {
    if (!config.output.includeCodeSnippets) {
      return '';
    }
    
    // For now, return a placeholder. This will be implemented by specific analyzers.
    return `Code snippet from ${filePath}`;
  }

  /**
   * Generate recommendations from findings
   */
  private generateRecommendations(results: Map<AnalysisCategory, AnalysisResult>): void {
    for (const [_category, result] of results) {
      const recommendationsByRule = new Map<string, Recommendation>();
      
      for (const finding of result.findings) {
        const rule = this.builtInRules.get(finding.ruleId) || this.customRules.get(finding.ruleId);
        if (!rule) continue;
        
        if (!recommendationsByRule.has(rule.id)) {
          const priority = this.getRecommendationPriority(rule.severity);
          
          const recommendation: Recommendation = {
            description: rule.recommendation,
            priority,
            implementationSteps: this.generateImplementationSteps(rule),
            estimatedImpact: this.estimateImpact(rule.severity)
          };
          
          recommendationsByRule.set(rule.id, recommendation);
        }
      }
      
      result.recommendations = Array.from(recommendationsByRule.values());
    }
  }

  /**
   * Get recommendation priority based on severity
   */
  private getRecommendationPriority(severity: Severity): Priority {
    switch (severity) {
      case Severity.CRITICAL:
      case Severity.HIGH:
        return Priority.HIGH;
      case Severity.MEDIUM:
        return Priority.MEDIUM;
      case Severity.LOW:
      case Severity.INFO:
        return Priority.LOW;
    }
  }

  /**
   * Generate implementation steps for a rule
   */
  private generateImplementationSteps(rule: Rule): string[] {
    const steps: string[] = [];
    
    switch (rule.category) {
      case AnalysisCategory.CODE_QUALITY:
        steps.push(`Review the ${rule.name.toLowerCase()} issue`);
        steps.push(`Apply the suggested fix: ${rule.recommendation}`);
        steps.push(`Test the fix to ensure it resolves the issue`);
        break;
      case AnalysisCategory.PERFORMANCE:
        steps.push(`Identify the performance issue: ${rule.name}`);
        steps.push(`Implement optimization: ${rule.recommendation}`);
        steps.push(`Measure performance improvement`);
        break;
      case AnalysisCategory.SECURITY:
        steps.push(`Address security vulnerability: ${rule.name}`);
        steps.push(`Apply security fix: ${rule.recommendation}`);
        steps.push(`Verify vulnerability is resolved`);
        break;
      case AnalysisCategory.ACCESSIBILITY:
        steps.push(`Fix accessibility issue: ${rule.name}`);
        steps.push(`Implement accessibility improvement: ${rule.recommendation}`);
        steps.push(`Test with accessibility tools`);
        break;
      case AnalysisCategory.BEST_PRACTICES:
        steps.push(`Review best practice violation: ${rule.name}`);
        steps.push(`Apply best practice: ${rule.recommendation}`);
        steps.push(`Validate implementation`);
        break;
    }
    
    return steps;
  }

  /**
   * Estimate impact of fixing an issue
   */
  private estimateImpact(severity: Severity): string {
    switch (severity) {
      case Severity.CRITICAL:
        return 'High impact - critical for functionality or security';
      case Severity.HIGH:
        return 'Significant impact - important for user experience or security';
      case Severity.MEDIUM:
        return 'Moderate impact - improves quality or performance';
      case Severity.LOW:
        return 'Low impact - minor improvement';
      case Severity.INFO:
        return 'Informational - best practice or optimization opportunity';
    }
  }

  /**
   * Calculate scores for each category based on findings
   */
  private calculateScores(results: Map<AnalysisCategory, AnalysisResult>): void {
    for (const [_category, result] of results) {
      let score = 100;

      // Deduct points based on severity of findings
      for (const finding of result.findings) {
        switch (finding.severity) {
          case Severity.CRITICAL:
            score -= 10;
            break;
          case Severity.HIGH:
            score -= 5;
            break;
          case Severity.MEDIUM:
            score -= 3;
            break;
          case Severity.LOW:
            score -= 1;
            break;
          case Severity.INFO:
            score -= 0.5;
            break;
        }
      }

      // Ensure score stays within 0-100 range
      result.score = Math.max(0, Math.min(100, score));
    }
  }

  /**
   * Get all available rules (built-in + custom)
   */
  getAllRules(): Rule[] {
    return [
      ...Array.from(this.builtInRules.values()),
      ...Array.from(this.customRules.values())
    ];
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): Rule | undefined {
    return this.builtInRules.get(ruleId) || this.customRules.get(ruleId);
  }

  /**
   * Validate a custom rule before adding it
   */
  validateCustomRule(rule: Rule): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    if (!rule.id || typeof rule.id !== 'string') {
      errors.push('Rule must have a string "id" field');
    }
    
    if (!rule.name || typeof rule.name !== 'string') {
      errors.push('Rule must have a string "name" field');
    }
    
    if (!rule.description || typeof rule.description !== 'string') {
      errors.push('Rule must have a string "description" field');
    }
    
    if (!rule.category || !Object.values(AnalysisCategory).includes(rule.category)) {
      errors.push(`Rule must have a valid "category" field (${Object.values(AnalysisCategory).join(', ')})`);
    }
    
    if (!rule.severity || !Object.values(Severity).includes(rule.severity)) {
      errors.push(`Rule must have a valid "severity" field (${Object.values(Severity).join(', ')})`);
    }
    
    if (!rule.message || typeof rule.message !== 'string') {
      errors.push('Rule must have a string "message" field');
    }
    
    if (!rule.recommendation || typeof rule.recommendation !== 'string') {
      errors.push('Rule must have a string "recommendation" field');
    }
    
    if (typeof rule.condition !== 'function') {
      errors.push('Rule must have a "condition" function');
    }
    
    // Check for duplicate rule ID
    if (this.builtInRules.has(rule.id) || this.customRules.has(rule.id)) {
      errors.push(`Rule ID "${rule.id}" is already in use`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Add a custom rule with validation
   */
  addCustomRule(rule: Rule, priority: number = 50): { success: boolean; error?: string } {
    const validation = this.validateCustomRule(rule);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid rule: ${validation.errors.join(', ')}`
      };
    }
    
    this.customRules.set(rule.id, rule);
    this.rulePriorities.set(rule.id, priority);
    
    return { success: true };
  }

  /**
   * Remove a custom rule
   */
  removeCustomRule(ruleId: string): boolean {
    if (this.customRules.has(ruleId)) {
      this.customRules.delete(ruleId);
      this.rulePriorities.delete(ruleId);
      return true;
    }
    return false;
  }

  /**
   * Set rule priority
   */
  setRulePriority(ruleId: string, priority: number): boolean {
    if (this.builtInRules.has(ruleId) || this.customRules.has(ruleId)) {
      this.rulePriorities.set(ruleId, priority);
      return true;
    }
    return false;
  }

  /**
   * Get rule priority
   */
  getRulePriority(ruleId: string): number {
    return this.rulePriorities.get(ruleId) || 50;
  }

  /**
   * Get all custom rules
   */
  getCustomRules(): Rule[] {
    return Array.from(this.customRules.values());
  }

  /**
   * Clear all custom rules
   */
  clearCustomRules(): void {
    this.customRules.clear();
    
    // Remove custom rule priorities
    for (const ruleId of this.rulePriorities.keys()) {
      if (!this.builtInRules.has(ruleId)) {
        this.rulePriorities.delete(ruleId);
      }
    }
  }
}