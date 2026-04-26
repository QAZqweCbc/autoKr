/**
 * Example usage of RuleEngine component
 * Demonstrates rule loading, priority handling, and custom rule validation
 */

import { RuleEngine } from '../src/engine/RuleEngine';
import { Config, AnalysisCategory, Severity, Rule } from '../src/types';

async function demonstrateRuleEngine() {
  console.log('=== RuleEngine Demonstration ===\n');

  // Create a RuleEngine instance
  const ruleEngine = new RuleEngine();
  
  console.log('1. Initializing RuleEngine with built-in rules...');
  const builtInRules = ruleEngine.getAllRules();
  console.log(`   Loaded ${builtInRules.length} built-in rules`);
  console.log(`   Built-in rule categories: ${[...new Set(builtInRules.map(r => r.category))].join(', ')}`);
  console.log();

  // Demonstrate custom rule loading
  console.log('2. Loading custom rules from configuration files...');
  try {
    // Load from JSON
    const jsonRules = await ruleEngine.loadCustomRules('./examples/custom-rules.json');
    console.log(`   Loaded ${jsonRules.length} custom rules from JSON`);
    
    // Load from YAML
    const yamlRules = await ruleEngine.loadCustomRules('./examples/custom-rules.yaml');
    console.log(`   Loaded ${yamlRules.length} custom rules from YAML`);
  } catch (error) {
    console.log(`   Error loading custom rules: ${error}`);
  }
  console.log();

  // Demonstrate custom rule validation
  console.log('3. Validating and adding custom rules programmatically...');
  const customRule: Rule = {
    id: 'DEMO001',
    name: 'Demo Custom Rule',
    description: 'A demonstration custom rule',
    category: AnalysisCategory.CODE_QUALITY,
    severity: Severity.MEDIUM,
    condition: () => {
      // Simple condition that always returns true for demonstration
      return true;
    },
    message: 'Demo rule triggered',
    recommendation: 'This is a demonstration recommendation'
  };

  const validation = ruleEngine.validateCustomRule(customRule);
  if (validation.isValid) {
    console.log('   Custom rule validation: PASSED');
    const addResult = ruleEngine.addCustomRule(customRule, 85);
    if (addResult.success) {
      console.log('   Custom rule added successfully');
    } else {
      console.log(`   Failed to add custom rule: ${addResult.error}`);
    }
  } else {
    console.log(`   Custom rule validation failed: ${validation.errors.join(', ')}`);
  }
  console.log();

  // Demonstrate rule priority management
  console.log('4. Managing rule priorities...');
  const ruleId = 'DEMO001';
  const originalPriority = ruleEngine.getRulePriority(ruleId);
  console.log(`   Original priority for ${ruleId}: ${originalPriority}`);
  
  const setSuccess = ruleEngine.setRulePriority(ruleId, 95);
  if (setSuccess) {
    const newPriority = ruleEngine.getRulePriority(ruleId);
    console.log(`   New priority for ${ruleId}: ${newPriority}`);
  }
  console.log();

  // Demonstrate rule application with configuration
  console.log('5. Applying rules with configuration...');
  const config: Config = {
    rules: {
      enabled: ['DEMO001', 'CQ001', 'PERF001'], // Enable demo rule and some built-in rules
      disabled: ['CQ002'], // Disable one built-in rule
      custom: [] // No inline custom rules
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

  // Create mock parsed files for demonstration
  const mockParsedFiles = {
    htmlASTs: new Map([
      ['index.html', { type: 'html', content: '<html><body>Test</body></html>' }]
    ]),
    cssASTs: new Map([
      ['styles.css', { type: 'css', selectors: ['.test'] }]
    ]),
    jsASTs: new Map([
      ['app.js', { type: 'js', code: 'console.log("test");' }]
    ])
  };

  try {
    const results = await ruleEngine.analyze(mockParsedFiles, config);
    
    console.log('   Analysis Results:');
    for (const [category, result] of results) {
      console.log(`   - ${category}: ${result.findings.length} findings, Score: ${result.score}/100`);
      if (result.recommendations.length > 0) {
        console.log(`     Recommendations: ${result.recommendations.length}`);
      }
    }
  } catch (error) {
    console.log(`   Error during analysis: ${error}`);
  }
  console.log();

  // Demonstrate getting all rules
  console.log('6. Listing all available rules...');
  const allRules = ruleEngine.getAllRules();
  console.log(`   Total rules available: ${allRules.length}`);
  
  // Group by category
  const rulesByCategory = allRules.reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, Rule[]>);
  
  for (const [category, rules] of Object.entries(rulesByCategory)) {
    console.log(`   ${category}: ${rules.length} rules`);
  }
  console.log();

  // Demonstrate removing custom rules
  console.log('7. Cleaning up custom rules...');
  const customRulesBefore = ruleEngine.getCustomRules();
  console.log(`   Custom rules before cleanup: ${customRulesBefore.length}`);
  
  ruleEngine.clearCustomRules();
  
  const customRulesAfter = ruleEngine.getCustomRules();
  console.log(`   Custom rules after cleanup: ${customRulesAfter.length}`);
  
  console.log('\n=== RuleEngine Demonstration Complete ===');
}

// Run the demonstration
demonstrateRuleEngine().catch(console.error);