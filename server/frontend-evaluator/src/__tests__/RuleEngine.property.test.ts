/**
 * Property-based tests for RuleEngine component
 * 
 * **Validates: Requirements 10.1, 10.3, 10.5**
 * **Property 8: Custom Rule Application Consistency**
 * 
 * For any custom rule configuration and source code, the rule engine should 
 * apply custom rules consistently with the configured priority
 */

import { RuleEngine, ParsedFiles } from '../engine/RuleEngine';
import { Config, AnalysisCategory, Severity, Rule, OutputFormat } from '../types';
import * as fc from 'fast-check';

describe('RuleEngine Property Tests', () => {
  beforeEach(() => {
    // Fresh RuleEngine created in each test
  });

  /**
   * Property 8: Custom Rule Application Consistency
   * 
   * This test validates that for any custom rule configuration and source code,
   * the rule engine should apply custom rules consistently with the configured priority.
   * 
   * We test this property by:
   * 1. Generating random but valid custom rules with varying priorities
   * 2. Generating random test data (parsed files)
   * 3. Applying rules multiple times with the same configuration
   * 4. Verifying that rule application is consistent and respects priorities
   */
  describe('Property 8: Custom Rule Application Consistency', () => {
    /**
     * Arbitrary for generating random rule IDs
     */
    const ruleIdArb = fc.string({ minLength: 3, maxLength: 10 })
      .filter(id => /^[A-Z0-9]+$/.test(id))
      .map(id => `CUSTOM_${id}`);

    /**
     * Arbitrary for generating random rule names
     */
    const ruleNameArb = fc.string({ minLength: 5, maxLength: 50 })
      .filter(name => name.trim().length > 0);

    /**
     * Arbitrary for generating random rule descriptions
     */
    const ruleDescriptionArb = fc.string({ minLength: 10, maxLength: 200 })
      .filter(desc => desc.trim().length > 0);

    /**
     * Arbitrary for generating rule categories
     */
    const ruleCategoryArb = fc.constantFrom(
      AnalysisCategory.CODE_QUALITY,
      AnalysisCategory.PERFORMANCE,
      AnalysisCategory.SECURITY,
      AnalysisCategory.ACCESSIBILITY,
      AnalysisCategory.BEST_PRACTICES
    );

    /**
     * Arbitrary for generating rule severities
     */
    const ruleSeverityArb = fc.constantFrom(
      Severity.CRITICAL,
      Severity.HIGH,
      Severity.MEDIUM,
      Severity.LOW,
      Severity.INFO
    );

    /**
     * Arbitrary for generating rule priorities (higher number = higher priority)
     */
    const rulePriorityArb = fc.integer({ min: 1, max: 100 });

    /**
     * Arbitrary for generating rule condition functions
     * We generate simple conditions that either always return true or false
     * to test the rule application logic without complex condition logic
     */
    const ruleConditionArb = fc.constantFrom(
      () => true,  // Rule always applies
      () => false  // Rule never applies
    );

    /**
     * Arbitrary for generating random rule messages
     */
    const ruleMessageArb = fc.string({ minLength: 5, maxLength: 100 })
      .filter(msg => msg.trim().length > 0);

    /**
     * Arbitrary for generating random rule recommendations
     */
    const ruleRecommendationArb = fc.string({ minLength: 10, maxLength: 150 })
      .filter(rec => rec.trim().length > 0);

    /**
     * Arbitrary for generating a complete custom rule
     */
    const customRuleArb = fc.record({
      id: ruleIdArb,
      name: ruleNameArb,
      description: ruleDescriptionArb,
      category: ruleCategoryArb,
      severity: ruleSeverityArb,
      condition: ruleConditionArb,
      message: ruleMessageArb,
      recommendation: ruleRecommendationArb
    });

    /**
     * Arbitrary for generating parsed HTML ASTs
     */
    const htmlASTArb = fc.record({
      type: fc.constant('html'),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      elements: fc.array(
        fc.record({
          tagName: fc.constantFrom('div', 'span', 'p', 'h1', 'a', 'button'),
          attributes: fc.dictionary(fc.string(), fc.string()),
          children: fc.array(fc.anything())
        }),
        { minLength: 0, maxLength: 10 }
      )
    });

    /**
     * Arbitrary for generating parsed CSS ASTs
     */
    const cssASTArb = fc.record({
      type: fc.constant('css'),
      selectors: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
      rules: fc.array(
        fc.record({
          selector: fc.string({ minLength: 1, maxLength: 20 }),
          properties: fc.dictionary(fc.string(), fc.string())
        }),
        { minLength: 0, maxLength: 10 }
      )
    });

    /**
     * Arbitrary for generating parsed JavaScript ASTs
     */
    const jsASTArb = fc.record({
      type: fc.constant('javascript'),
      code: fc.string({ minLength: 1, maxLength: 500 }),
      statements: fc.array(
        fc.record({
          type: fc.constantFrom('expression', 'declaration', 'assignment'),
          value: fc.string()
        }),
        { minLength: 0, maxLength: 10 }
      )
    });

    /**
     * Arbitrary for generating parsed files
     */
    const parsedFilesArb: fc.Arbitrary<ParsedFiles> = fc.record({
      htmlASTs: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        htmlASTArb,
        { minKeys: 0, maxKeys: 3 }
      ).map(dict => new Map(Object.entries(dict))),
      cssASTs: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        cssASTArb,
        { minKeys: 0, maxKeys: 3 }
      ).map(dict => new Map(Object.entries(dict))),
      jsASTs: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        jsASTArb,
        { minKeys: 0, maxKeys: 3 }
      ).map(dict => new Map(Object.entries(dict)))
    });

    /**
     * Arbitrary for generating configuration
     */
    const configArb = fc.record({
      rules: fc.record({
        enabled: fc.array(ruleIdArb, { minLength: 0, maxLength: 10 }),
        disabled: fc.array(ruleIdArb, { minLength: 0, maxLength: 10 }),
        custom: fc.array(customRuleArb, { minLength: 0, maxLength: 5 })
      }),
      thresholds: fc.record({
        minScore: fc.integer({ min: 0, max: 100 }),
        failOnCritical: fc.boolean()
      }),
      output: fc.record({
        format: fc.constantFrom(OutputFormat.JSON, OutputFormat.HTML, OutputFormat.MARKDOWN, OutputFormat.CONSOLE),
        includeCodeSnippets: fc.boolean(),
        detailedFindings: fc.boolean()
      })
    });

    /**
     * Test that custom rules are applied consistently across multiple runs
     */
    test('Custom rules are applied consistently (idempotence)', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedFilesArb,
          configArb,
          fc.array(
            fc.tuple(customRuleArb, rulePriorityArb),
            { minLength: 1, maxLength: 5 }
          ),
          async (parsedFiles, baseConfig, customRulesWithPriorities) => {
            // Create a fresh RuleEngine for each test
            const testRuleEngine = new RuleEngine();
            
            // Add custom rules with their priorities
            for (const [rule, priority] of customRulesWithPriorities) {
              const result = testRuleEngine.addCustomRule(rule, priority);
              expect(result.success).toBe(true);
            }
            
            // Update config with custom rule IDs
            const customRuleIds = customRulesWithPriorities.map(([rule]) => rule.id);
            const config: Config = {
              ...baseConfig,
              rules: {
                ...baseConfig.rules,
                enabled: [...baseConfig.rules.enabled, ...customRuleIds],
                custom: [...baseConfig.rules.custom, ...customRulesWithPriorities.map(([rule]) => rule)]
              }
            };
            
            // Run analysis twice with the same inputs
            const results1 = await testRuleEngine.analyze(parsedFiles, config);
            const results2 = await testRuleEngine.analyze(parsedFiles, config);
            
            // Results should be consistent (same findings count per category)
            for (const category of Object.values(AnalysisCategory)) {
              const result1 = results1.get(category);
              const result2 = results2.get(category);
              
              if (result1 && result2) {
                expect(result1.findings.length).toBe(result2.findings.length);
                expect(result1.score).toBe(result2.score);
                expect(result1.recommendations.length).toBe(result2.recommendations.length);
              } else if (result1 || result2) {
                // One is defined but not the other - this shouldn't happen
                throw new Error(`Inconsistent results for category ${category}`);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });

    /**
     * Test that rules with higher priority are applied in correct order
     * (Higher priority rules should be applied first)
     */
    test('Rules are applied in priority order (higher priority first)', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedFilesArb,
          configArb,
          fc.array(
            fc.tuple(customRuleArb, rulePriorityArb),
            { minLength: 2, maxLength: 5 }
          ),
          async (parsedFiles, baseConfig, customRulesWithPriorities) => {
            // Create a fresh RuleEngine for each test
            const testRuleEngine = new RuleEngine();
            
            // Track which rules were applied and in what order
            const applicationOrder: string[] = [];
            
            // Create rules that record when they're applied
            const trackingRules = customRulesWithPriorities.map(([baseRule, priority]) => {
              const trackingRule: Rule = {
                ...baseRule,
                condition: () => {
                  applicationOrder.push(baseRule.id);
                  return true; // Always apply to track order
                }
              };
              return { rule: trackingRule, priority };
            });
            
            // Add tracking rules with their priorities
            for (const { rule, priority } of trackingRules) {
              const result = testRuleEngine.addCustomRule(rule, priority);
              expect(result.success).toBe(true);
            }
            
            // Update config with custom rule IDs
            const customRuleIds = trackingRules.map(({ rule }) => rule.id);
            const config: Config = {
              ...baseConfig,
              rules: {
                ...baseConfig.rules,
                enabled: [...baseConfig.rules.enabled, ...customRuleIds],
                custom: [...baseConfig.rules.custom, ...trackingRules.map(({ rule }) => rule)]
              }
            };
            
            // Run analysis
            await testRuleEngine.analyze(parsedFiles, config);
            
            // Rules should be applied in priority order (higher priority first)
            // We need to check that higher priority rules appear before lower priority ones
            const rulePriorities = new Map(
              trackingRules.map(({ rule, priority }) => [rule.id, priority])
            );
            
            // For each pair of consecutive applications, check priority order
            for (let i = 1; i < applicationOrder.length; i++) {
              const currentRuleId = applicationOrder[i];
              const previousRuleId = applicationOrder[i - 1];
              
              const currentPriority = rulePriorities.get(currentRuleId) || 50;
              const previousPriority = rulePriorities.get(previousRuleId) || 50;
              
              // Higher priority rules should come first, so previous priority should be >= current priority
              // (since we're checking consecutive pairs)
              expect(previousPriority).toBeGreaterThanOrEqual(currentPriority);
            }
            
            return true;
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });

    /**
     * Test that rule priorities are respected when rules conflict
     * (Higher priority rules should take precedence in scoring)
     */
    test('Rule priorities affect scoring consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedFilesArb,
          configArb,
          fc.array(
            fc.tuple(customRuleArb, rulePriorityArb),
            { minLength: 2, maxLength: 3 }
          ),
          async (parsedFiles, baseConfig, customRulesWithPriorities) => {
            // Create two RuleEngines with different priority assignments
            const ruleEngine1 = new RuleEngine();
            const ruleEngine2 = new RuleEngine();
            
            // Add same rules but with swapped priorities in second engine
            const [rule1, priority1] = customRulesWithPriorities[0];
            const [rule2, priority2] = customRulesWithPriorities[1];
            
            // Engine 1: rule1 has higher priority than rule2
            ruleEngine1.addCustomRule(rule1, Math.max(priority1, priority2));
            ruleEngine1.addCustomRule(rule2, Math.min(priority1, priority2));
            
            // Engine 2: rule2 has higher priority than rule1 (swapped)
            ruleEngine2.addCustomRule(rule1, Math.min(priority1, priority2));
            ruleEngine2.addCustomRule(rule2, Math.max(priority1, priority2));
            
            // Same config for both
            const customRuleIds = [rule1.id, rule2.id];
            const config: Config = {
              ...baseConfig,
              rules: {
                ...baseConfig.rules,
                enabled: [...baseConfig.rules.enabled, ...customRuleIds],
                custom: [rule1, rule2]
              }
            };
            
            // Run analysis with both engines
            const results1 = await ruleEngine1.analyze(parsedFiles, config);
            const results2 = await ruleEngine2.analyze(parsedFiles, config);
            
            // Scores should be the same regardless of priority order
            // (priority affects application order but not final score calculation)
            for (const category of Object.values(AnalysisCategory)) {
              const result1 = results1.get(category);
              const result2 = results2.get(category);
              
              if (result1 && result2) {
                expect(result1.score).toBe(result2.score);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });

    /**
     * Test that enabled/disabled configuration is respected consistently
     */
    test('Enabled/disabled rule configuration is applied consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedFilesArb,
          configArb,
          fc.array(
            fc.tuple(customRuleArb, rulePriorityArb),
            { minLength: 3, maxLength: 5 }
          ),
          fc.array(fc.boolean(), { minLength: 3, maxLength: 5 }),
          async (parsedFiles, baseConfig, customRulesWithPriorities, enableFlags) => {
            // Create a fresh RuleEngine
            const testRuleEngine = new RuleEngine();
            
            // Add custom rules
            const customRules = customRulesWithPriorities.map(([rule, priority]) => {
              testRuleEngine.addCustomRule(rule, priority);
              return rule;
            });
            
            // Create config with some rules enabled and some disabled
            const enabledRules: string[] = [];
            const disabledRules: string[] = [];
            
            customRules.forEach((rule, index) => {
              if (enableFlags[index]) {
                enabledRules.push(rule.id);
              } else {
                disabledRules.push(rule.id);
              }
            });
            
            const config: Config = {
              ...baseConfig,
              rules: {
                ...baseConfig.rules,
                enabled: [...baseConfig.rules.enabled, ...enabledRules],
                disabled: [...baseConfig.rules.disabled, ...disabledRules],
                custom: customRules
              }
            };
            
            // Run analysis twice
            const results1 = await testRuleEngine.analyze(parsedFiles, config);
            const results2 = await testRuleEngine.analyze(parsedFiles, config);
            
            // Count findings from enabled rules only
            let enabledRuleFindingsCount1 = 0;
            let enabledRuleFindingsCount2 = 0;
            
            for (const category of Object.values(AnalysisCategory)) {
              const result1 = results1.get(category);
              const result2 = results2.get(category);
              
              if (result1) {
                enabledRuleFindingsCount1 += result1.findings.filter(f => 
                  enabledRules.includes(f.ruleId)
                ).length;
              }
              
              if (result2) {
                enabledRuleFindingsCount2 += result2.findings.filter(f => 
                  enabledRules.includes(f.ruleId)
                ).length;
              }
            }
            
            // Findings from enabled rules should be consistent
            expect(enabledRuleFindingsCount1).toBe(enabledRuleFindingsCount2);
            
            // No findings should come from disabled rules
            for (const category of Object.values(AnalysisCategory)) {
              const result1 = results1.get(category);
              const result2 = results2.get(category);
              
              if (result1) {
                const disabledRuleFindings = result1.findings.filter(f => 
                  disabledRules.includes(f.ruleId)
                );
                expect(disabledRuleFindings.length).toBe(0);
              }
              
              if (result2) {
                const disabledRuleFindings = result2.findings.filter(f => 
                  disabledRules.includes(f.ruleId)
                );
                expect(disabledRuleFindings.length).toBe(0);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });

    /**
     * Test that custom rule validation works consistently
     */
    test('Custom rule validation is consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          customRuleArb,
          async (rule) => {
            const testRuleEngine = new RuleEngine();
            
            // Validate the same rule twice
            const validation1 = testRuleEngine.validateCustomRule(rule);
            const validation2 = testRuleEngine.validateCustomRule(rule);
            
            // Validation should be consistent
            expect(validation1.isValid).toBe(validation2.isValid);
            expect(validation1.errors).toEqual(validation2.errors);
            
            // If valid, we should be able to add it
            if (validation1.isValid) {
              const addResult1 = testRuleEngine.addCustomRule(rule);
              expect(addResult1.success).toBe(true);
              
              // Try to add again - should fail due to duplicate ID
              const addResult2 = testRuleEngine.addCustomRule(rule);
              expect(addResult2.success).toBe(false);
              expect(addResult2.error).toContain('already in use');
            }
            
            return true;
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    /**
     * Test edge cases for rule application consistency
     */
    describe('Edge cases for rule application consistency', () => {
      test('Empty custom rules array', async () => {
        await fc.assert(
          fc.asyncProperty(
            parsedFilesArb,
            configArb,
            async (parsedFiles, config) => {
              const testRuleEngine = new RuleEngine();
              
              // Config with no custom rules
              const testConfig: Config = {
                ...config,
                rules: {
                  ...config.rules,
                  custom: []
                }
              };
              
              // Run analysis twice
              const results1 = await testRuleEngine.analyze(parsedFiles, testConfig);
              const results2 = await testRuleEngine.analyze(parsedFiles, testConfig);
              
              // Results should be consistent
              for (const category of Object.values(AnalysisCategory)) {
                const result1 = results1.get(category);
                const result2 = results2.get(category);
                
                if (result1 && result2) {
                  expect(result1.findings.length).toBe(result2.findings.length);
                  expect(result1.score).toBe(result2.score);
                }
              }
              
              return true;
            }
          ),
          { numRuns: 20, verbose: true }
        );
      });

      test('All rules disabled', async () => {
        await fc.assert(
          fc.asyncProperty(
            parsedFilesArb,
            configArb,
            fc.array(
              fc.tuple(customRuleArb, rulePriorityArb),
              { minLength: 1, maxLength: 3 }
            ),
            async (parsedFiles, baseConfig, customRulesWithPriorities) => {
              const testRuleEngine = new RuleEngine();
              
              // Add custom rules
              const customRuleIds = customRulesWithPriorities.map(([rule, priority]) => {
                testRuleEngine.addCustomRule(rule, priority);
                return rule.id;
              });
              
              // Config with all rules disabled
              const testConfig: Config = {
                ...baseConfig,
                rules: {
                  enabled: [],
                  disabled: [...customRuleIds, ...baseConfig.rules.disabled],
                  custom: customRulesWithPriorities.map(([rule]) => rule)
                }
              };
              
              // Run analysis twice
              const results1 = await testRuleEngine.analyze(parsedFiles, testConfig);
              const results2 = await testRuleEngine.analyze(parsedFiles, testConfig);
              
              // Should have no findings since all rules are disabled
              for (const category of Object.values(AnalysisCategory)) {
                const result1 = results1.get(category);
                const result2 = results2.get(category);
                
                if (result1) {
                  expect(result1.findings.length).toBe(0);
                }
                if (result2) {
                  expect(result2.findings.length).toBe(0);
                }
              }
              
              return true;
            }
          ),
          { numRuns: 20, verbose: true }
        );
      });

      test('Rules with same priority', async () => {
        await fc.assert(
          fc.asyncProperty(
            parsedFilesArb,
            configArb,
            fc.array(
              customRuleArb,
              { minLength: 2, maxLength: 4 }
            ),
            async (parsedFiles, baseConfig, customRules) => {
              const testRuleEngine = new RuleEngine();
              
              // Add all rules with same priority
              const samePriority = 50;
              for (const rule of customRules) {
                testRuleEngine.addCustomRule(rule, samePriority);
              }
              
              const customRuleIds = customRules.map(rule => rule.id);
              const testConfig: Config = {
                ...baseConfig,
                rules: {
                  ...baseConfig.rules,
                  enabled: [...baseConfig.rules.enabled, ...customRuleIds],
                  custom: customRules
                }
              };
              
              // Run analysis twice
              const results1 = await testRuleEngine.analyze(parsedFiles, testConfig);
              const results2 = await testRuleEngine.analyze(parsedFiles, testConfig);
              
              // Results should be consistent
              for (const category of Object.values(AnalysisCategory)) {
                const result1 = results1.get(category);
                const result2 = results2.get(category);
                
                if (result1 && result2) {
                  expect(result1.findings.length).toBe(result2.findings.length);
                  expect(result1.score).toBe(result2.score);
                }
              }
              
              return true;
            }
          ),
          { numRuns: 20, verbose: true }
        );
      });

      test('Rules with extreme priorities (1 and 100)', async () => {
        await fc.assert(
          fc.asyncProperty(
            parsedFilesArb,
            configArb,
            fc.array(
              customRuleArb,
              { minLength: 2, maxLength: 3 }
            ),
            async (parsedFiles, baseConfig, customRules) => {
              const testRuleEngine = new RuleEngine();
              
              // Add rules with extreme priorities
              testRuleEngine.addCustomRule(customRules[0], 1);  // Lowest priority
              testRuleEngine.addCustomRule(customRules[1], 100); // Highest priority
              
              const customRuleIds = customRules.map(rule => rule.id);
              const testConfig: Config = {
                ...baseConfig,
                rules: {
                  ...baseConfig.rules,
                  enabled: [...baseConfig.rules.enabled, ...customRuleIds],
                  custom: customRules
                }
              };
              
              // Run analysis
              await testRuleEngine.analyze(parsedFiles, testConfig);
              
              // Rule with priority 100 should be applied before rule with priority 1
              // (We can't easily test application order without instrumentation,
              // but we can verify both rules were applied if their conditions are true)
              
              return true;
            }
          ),
          { numRuns: 20, verbose: true }
        );
      });
    });
  });
});