/**
 * Unit tests for RuleEngine component
 * 
 * Tests rule loading from configuration, rule application logic with priority handling,
 * and custom rule support with validation.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { RuleEngine, ParsedFiles } from '../engine/RuleEngine';
import { Config, AnalysisCategory, Severity, Rule, Priority } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;
  let testConfig: Config;
  let mockParsedFiles: ParsedFiles;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
    
    testConfig = {
      rules: {
        enabled: [], // All rules enabled by default
        disabled: [],
        custom: []
      },
      thresholds: {
        minScore: 70,
        failOnCritical: true
      },
      output: {
        format: 'CONSOLE' as any,
        includeCodeSnippets: true,
        detailedFindings: true
      }
    };

    mockParsedFiles = {
      htmlASTs: new Map([
        ['index.html', { type: 'html', content: '<!DOCTYPE html><html><head></head><body></body></html>' }],
        ['about.html', { type: 'html', content: '<html><head></head><body></body></html>' }]
      ]),
      cssASTs: new Map([
        ['styles.css', { type: 'css', selectors: ['.header', '.footer'] }],
        ['components.css', { type: 'css', selectors: ['.button', '.card'] }]
      ]),
      jsASTs: new Map([
        ['app.js', { type: 'js', code: 'console.log("Hello");' }],
        ['utils.js', { type: 'js', code: 'function test() { return 1; }' }]
      ])
    };
  });

  describe('Rule Loading from Configuration', () => {
    test('should load custom rules from JSON configuration file', async () => {
      // Create a temporary JSON config file
      const tempDir = path.join(__dirname, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const configPath = path.join(tempDir, 'custom-rules.json');
      const configContent = {
        rules: [
          {
            id: 'CUSTOM001',
            name: 'Custom HTML Rule',
            description: 'A custom rule for testing',
            category: 'CODE_QUALITY',
            severity: 'MEDIUM',
            condition: '() => true',
            message: 'Custom rule triggered',
            recommendation: 'Fix custom issue',
            priority: 80
          }
        ]
      };
      
      await fs.writeFile(configPath, JSON.stringify(configContent));
      
      const rules = await ruleEngine.loadCustomRules(configPath);
      
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('CUSTOM001');
      expect(rules[0].name).toBe('Custom HTML Rule');
      expect(rules[0].category).toBe(AnalysisCategory.CODE_QUALITY);
      expect(rules[0].severity).toBe(Severity.MEDIUM);
      
      // Clean up
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    test('should load custom rules from YAML configuration file', async () => {
      // Create a temporary YAML config file
      const tempDir = path.join(__dirname, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const configPath = path.join(tempDir, 'custom-rules.yaml');
      const configContent = `
rules:
  - id: CUSTOM002
    name: Custom YAML Rule
    description: A custom rule from YAML
    category: PERFORMANCE
    severity: HIGH
    condition: "() => false"
    message: YAML rule triggered
    recommendation: Fix YAML issue
    priority: 90
`;
      
      await fs.writeFile(configPath, configContent);
      
      const rules = await ruleEngine.loadCustomRules(configPath);
      
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('CUSTOM002');
      expect(rules[0].name).toBe('Custom YAML Rule');
      expect(rules[0].category).toBe(AnalysisCategory.PERFORMANCE);
      expect(rules[0].severity).toBe(Severity.HIGH);
      
      // Clean up
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    test('should throw error for unsupported file format', async () => {
      const tempDir = path.join(__dirname, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const configPath = path.join(tempDir, 'custom-rules.txt');
      await fs.writeFile(configPath, 'Invalid format');
      
      await expect(ruleEngine.loadCustomRules(configPath))
        .rejects
        .toThrow('Unsupported configuration file format');
      
      // Clean up
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });

    test('should handle invalid rule configuration gracefully', async () => {
      const tempDir = path.join(__dirname, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const configPath = path.join(tempDir, 'invalid-rules.json');
      const configContent = {
        rules: [
          {
            id: 'INVALID001',
            // Missing required fields
          }
        ]
      };
      
      await fs.writeFile(configPath, JSON.stringify(configContent));
      
      const rules = await ruleEngine.loadCustomRules(configPath);
      
      // Invalid rules should be skipped
      expect(rules).toHaveLength(0);
      
      // Clean up
      await fs.unlink(configPath);
      await fs.rmdir(tempDir);
    });
  });

  describe('Rule Application with Priority Handling', () => {
    test('should apply rules in priority order', async () => {
      // Add custom rules with different priorities
      const highPriorityRule: Rule = {
        id: 'HIGH001',
        name: 'High Priority Rule',
        description: 'Rule with high priority',
        category: AnalysisCategory.SECURITY,
        severity: Severity.HIGH,
        condition: () => true,
        message: 'High priority rule triggered',
        recommendation: 'Fix high priority issue'
      };

      const mediumPriorityRule: Rule = {
        id: 'MEDIUM001',
        name: 'Medium Priority Rule',
        description: 'Rule with medium priority',
        category: AnalysisCategory.PERFORMANCE,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Medium priority rule triggered',
        recommendation: 'Fix medium priority issue'
      };

      const lowPriorityRule: Rule = {
        id: 'LOW001',
        name: 'Low Priority Rule',
        description: 'Rule with low priority',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.LOW,
        condition: () => true,
        message: 'Low priority rule triggered',
        recommendation: 'Fix low priority issue'
      };

      // Add rules with specific priorities
      ruleEngine.addCustomRule(highPriorityRule, 100); // Highest priority
      ruleEngine.addCustomRule(mediumPriorityRule, 50); // Medium priority
      ruleEngine.addCustomRule(lowPriorityRule, 10); // Lowest priority

      // Enable all rules
      testConfig.rules.enabled = ['HIGH001', 'MEDIUM001', 'LOW001'];

      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      
      // All categories should have findings
      const securityResults = results.get(AnalysisCategory.SECURITY);
      const performanceResults = results.get(AnalysisCategory.PERFORMANCE);
      const codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      
      // Each rule triggers for each file in its category
      // Security rule triggers for 2 JS files
      expect(securityResults?.findings).toHaveLength(2);
      // Performance rule triggers for 2 HTML files
      expect(performanceResults?.findings).toHaveLength(2);
      // Code quality rule triggers for all 6 files (2 HTML + 2 CSS + 2 JS)
      expect(codeQualityResults?.findings).toHaveLength(6);
    });

    test('should respect enabled/disabled rule configuration', async () => {
      // Add a custom rule
      const customRule: Rule = {
        id: 'TEST001',
        name: 'Test Rule',
        description: 'Test rule for enabled/disabled testing',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Test rule triggered',
        recommendation: 'Fix test issue'
      };

      ruleEngine.addCustomRule(customRule);

      // Test 1: Rule enabled
      testConfig.rules.enabled = ['TEST001'];
      testConfig.rules.disabled = [];
      
      let results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      let codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      // Code quality rule triggers for all 6 files
      expect(codeQualityResults?.findings).toHaveLength(6);

      // Test 2: Rule disabled
      testConfig.rules.enabled = [];
      testConfig.rules.disabled = ['TEST001'];
      
      results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      expect(codeQualityResults?.findings).toHaveLength(0);

      // Test 3: Rule explicitly enabled but also disabled (disabled should win)
      testConfig.rules.enabled = ['TEST001'];
      testConfig.rules.disabled = ['TEST001'];
      
      results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      expect(codeQualityResults?.findings).toHaveLength(0);
    });

    test('should handle empty enabled rules array as "all rules enabled"', async () => {
      // Add a custom rule
      const customRule: Rule = {
        id: 'TEST002',
        name: 'Test Rule 2',
        description: 'Another test rule',
        category: AnalysisCategory.PERFORMANCE,
        severity: Severity.LOW,
        condition: () => true,
        message: 'Test rule 2 triggered',
        recommendation: 'Fix test issue 2'
      };

      ruleEngine.addCustomRule(customRule);

      // Empty enabled array should mean all rules are enabled
      testConfig.rules.enabled = [];
      testConfig.rules.disabled = [];
      
      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const performanceResults = results.get(AnalysisCategory.PERFORMANCE);
      // Performance rule triggers for 2 HTML files
      expect(performanceResults?.findings).toHaveLength(2);
    });
  });

  describe('Custom Rule Support with Validation', () => {
    test('should validate custom rules before adding them', () => {
      const validRule: Rule = {
        id: 'VALID001',
        name: 'Valid Rule',
        description: 'A valid custom rule',
        category: AnalysisCategory.ACCESSIBILITY,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Valid rule triggered',
        recommendation: 'Fix valid issue'
      };

      const validation = ruleEngine.validateCustomRule(validRule);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid custom rules', () => {
      const invalidRule = {
        id: 'INVALID001',
        // Missing required fields
      } as any;

      const validation = ruleEngine.validateCustomRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should reject duplicate rule IDs', () => {
      const duplicateRule: Rule = {
        id: 'CQ001', // Using existing built-in rule ID
        name: 'Duplicate Rule',
        description: 'A rule with duplicate ID',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Duplicate rule triggered',
        recommendation: 'Fix duplicate issue'
      };

      const validation = ruleEngine.validateCustomRule(duplicateRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rule ID "CQ001" is already in use');
    });

    test('should add valid custom rules successfully', () => {
      const customRule: Rule = {
        id: 'CUSTOM003',
        name: 'Custom Rule 3',
        description: 'A custom rule for testing',
        category: AnalysisCategory.BEST_PRACTICES,
        severity: Severity.INFO,
        condition: () => false,
        message: 'Custom rule 3 triggered',
        recommendation: 'Fix custom issue 3'
      };

      const result = ruleEngine.addCustomRule(customRule, 75);
      expect(result.success).toBe(true);
      
      const allRules = ruleEngine.getAllRules();
      const ruleIds = allRules.map(r => r.id);
      expect(ruleIds).toContain('CUSTOM003');
    });

    test('should reject invalid custom rules when adding', () => {
      const invalidRule = {
        id: 'INVALID002',
        // Missing required fields
      } as any;

      const result = ruleEngine.addCustomRule(invalidRule);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should remove custom rules', () => {
      const customRule: Rule = {
        id: 'CUSTOM004',
        name: 'Custom Rule 4',
        description: 'A custom rule to be removed',
        category: AnalysisCategory.SECURITY,
        severity: Severity.HIGH,
        condition: () => true,
        message: 'Custom rule 4 triggered',
        recommendation: 'Fix custom issue 4'
      };

      ruleEngine.addCustomRule(customRule);
      
      const removed = ruleEngine.removeCustomRule('CUSTOM004');
      expect(removed).toBe(true);
      
      const allRules = ruleEngine.getAllRules();
      const ruleIds = allRules.map(r => r.id);
      expect(ruleIds).not.toContain('CUSTOM004');
    });

    test('should clear all custom rules', () => {
      // Add multiple custom rules
      const rule1: Rule = {
        id: 'CLEAR001',
        name: 'Rule to Clear 1',
        description: 'First rule to clear',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.LOW,
        condition: () => true,
        message: 'Rule 1 triggered',
        recommendation: 'Fix rule 1'
      };

      const rule2: Rule = {
        id: 'CLEAR002',
        name: 'Rule to Clear 2',
        description: 'Second rule to clear',
        category: AnalysisCategory.PERFORMANCE,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Rule 2 triggered',
        recommendation: 'Fix rule 2'
      };

      ruleEngine.addCustomRule(rule1);
      ruleEngine.addCustomRule(rule2);

      // Verify rules were added
      expect(ruleEngine.getCustomRules()).toHaveLength(2);

      // Clear all custom rules
      ruleEngine.clearCustomRules();

      // Verify rules were cleared
      expect(ruleEngine.getCustomRules()).toHaveLength(0);
      
      // Built-in rules should still exist
      const allRules = ruleEngine.getAllRules();
      expect(allRules.length).toBeGreaterThan(0); // Should have built-in rules
    });
  });

  describe('Rule Priority Management', () => {
    test('should get and set rule priorities', () => {
      const customRule: Rule = {
        id: 'PRIORITY001',
        name: 'Priority Test Rule',
        description: 'Rule for priority testing',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Priority rule triggered',
        recommendation: 'Fix priority issue'
      };

      ruleEngine.addCustomRule(customRule, 75);
      
      // Get priority
      let priority = ruleEngine.getRulePriority('PRIORITY001');
      expect(priority).toBe(75);
      
      // Set new priority
      const success = ruleEngine.setRulePriority('PRIORITY001', 90);
      expect(success).toBe(true);
      
      priority = ruleEngine.getRulePriority('PRIORITY001');
      expect(priority).toBe(90);
    });

    test('should return default priority for non-existent rule', () => {
      const priority = ruleEngine.getRulePriority('NONEXISTENT001');
      expect(priority).toBe(50); // Default priority
    });

    test('should return false when setting priority for non-existent rule', () => {
      const success = ruleEngine.setRulePriority('NONEXISTENT001', 100);
      expect(success).toBe(false);
    });

    test('should handle built-in rule priorities', () => {
      // Security rules should have high priority
      const securityPriority = ruleEngine.getRulePriority('SEC001');
      expect(securityPriority).toBe(100);
      
      // Code quality rules should have medium priority
      const codeQualityPriority = ruleEngine.getRulePriority('CQ001');
      expect(codeQualityPriority).toBe(50);
    });
  });

  describe('Score Calculation', () => {
    test('should calculate scores based on findings severity', async () => {
      // Add rules that will trigger findings
      const criticalRule: Rule = {
        id: 'CRITICAL001',
        name: 'Critical Rule',
        description: 'Rule with critical severity',
        category: AnalysisCategory.SECURITY,
        severity: Severity.CRITICAL,
        condition: () => true,
        message: 'Critical rule triggered',
        recommendation: 'Fix critical issue'
      };

      const highRule: Rule = {
        id: 'HIGH002',
        name: 'High Rule',
        description: 'Rule with high severity',
        category: AnalysisCategory.SECURITY,
        severity: Severity.HIGH,
        condition: () => true,
        message: 'High rule triggered',
        recommendation: 'Fix high issue'
      };

      const mediumRule: Rule = {
        id: 'MEDIUM002',
        name: 'Medium Rule',
        description: 'Rule with medium severity',
        category: AnalysisCategory.SECURITY,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Medium rule triggered',
        recommendation: 'Fix medium issue'
      };

      ruleEngine.addCustomRule(criticalRule);
      ruleEngine.addCustomRule(highRule);
      ruleEngine.addCustomRule(mediumRule);

      testConfig.rules.enabled = ['CRITICAL001', 'HIGH002', 'MEDIUM002'];

      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const securityResults = results.get(AnalysisCategory.SECURITY);
      
      // Calculate expected score: Security rules only check JavaScript files
      // We have 2 JavaScript files in mockParsedFiles.jsASTs
      // Each rule triggers 2 times (once per JS file)
      // Total deductions: (10*2) + (5*2) + (3*2) = 20 + 10 + 6 = 36
      // Score: 100 - 36 = 64
      expect(securityResults?.score).toBe(64);
    });

    test('should keep scores within 0-100 range', async () => {
      // Add many rules that will trigger findings
      const rules: Rule[] = [];
      for (let i = 0; i < 20; i++) {
        const rule: Rule = {
          id: `LOWSCORE${i}`,
          name: `Low Score Rule ${i}`,
          description: `Rule ${i} for low score testing`,
          category: AnalysisCategory.CODE_QUALITY,
          severity: Severity.CRITICAL, // Each deducts 10 points
          condition: () => true,
          message: `Rule ${i} triggered`,
          recommendation: `Fix issue ${i}`
        };
        rules.push(rule);
        ruleEngine.addCustomRule(rule);
      }

      testConfig.rules.enabled = rules.map(r => r.id);

      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      
      // Score should be at least 0
      expect(codeQualityResults?.score).toBeGreaterThanOrEqual(0);
      expect(codeQualityResults?.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Recommendation Generation', () => {
    test('should generate recommendations from findings', async () => {
      const customRule: Rule = {
        id: 'REC001',
        name: 'Recommendation Test Rule',
        description: 'Rule for recommendation testing',
        category: AnalysisCategory.ACCESSIBILITY,
        severity: Severity.HIGH,
        condition: () => true,
        message: 'Recommendation rule triggered',
        recommendation: 'Add proper alt text to images'
      };

      ruleEngine.addCustomRule(customRule);
      testConfig.rules.enabled = ['REC001'];

      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const accessibilityResults = results.get(AnalysisCategory.ACCESSIBILITY);
      
      expect(accessibilityResults?.recommendations).toHaveLength(1);
      
      const recommendation = accessibilityResults?.recommendations[0];
      expect(recommendation?.description).toBe('Add proper alt text to images');
      expect(recommendation?.priority).toBe(Priority.HIGH); // HIGH severity -> HIGH priority
      expect(recommendation?.implementationSteps).toHaveLength(3);
      expect(recommendation?.estimatedImpact).toBeDefined();
    });

    test('should deduplicate recommendations for same rule', async () => {
      const customRule: Rule = {
        id: 'DEDUP001',
        name: 'Deduplication Test Rule',
        description: 'Rule for deduplication testing',
        category: AnalysisCategory.PERFORMANCE,
        severity: Severity.MEDIUM,
        condition: () => true,
        message: 'Deduplication rule triggered',
        recommendation: 'Optimize image loading'
      };

      ruleEngine.addCustomRule(customRule);
      testConfig.rules.enabled = ['DEDUP001'];

      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const performanceResults = results.get(AnalysisCategory.PERFORMANCE);
      
      // Rule triggers for each file, but should only generate one recommendation
      expect(performanceResults?.findings.length).toBeGreaterThan(1); // Multiple findings
      expect(performanceResults?.recommendations).toHaveLength(1); // Single recommendation
    });
  });

  describe('Error Handling', () => {
    test('should handle rule application errors gracefully', async () => {
      const errorRule: Rule = {
        id: 'ERROR001',
        name: 'Error Rule',
        description: 'Rule that throws an error',
        category: AnalysisCategory.CODE_QUALITY,
        severity: Severity.MEDIUM,
        condition: () => { throw new Error('Test error'); },
        message: 'Error rule triggered',
        recommendation: 'Fix error issue'
      };

      ruleEngine.addCustomRule(errorRule);
      testConfig.rules.enabled = ['ERROR001'];

      // Should not throw, should handle error gracefully
      const results = await ruleEngine.analyze(mockParsedFiles, testConfig);
      const codeQualityResults = results.get(AnalysisCategory.CODE_QUALITY);
      
      // Rule should fail silently, no findings added
      expect(codeQualityResults?.findings).toHaveLength(0);
    });
  });
});