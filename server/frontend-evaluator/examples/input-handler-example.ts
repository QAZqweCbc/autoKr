/**
 * Example usage of InputHandler component
 * Demonstrates file validation, configuration loading, and FileSet creation
 */

import { InputHandler } from '../src/engine/InputHandler';
import { FrontendEvaluator } from '../src/engine/FrontendEvaluator';
import { OutputFormat } from '../src/types';

async function main() {
  console.log('=== Frontend Evaluator InputHandler Example ===\n');

  // Create InputHandler instance
  const inputHandler = new InputHandler();
  console.log('1. Created InputHandler instance');

  // Create default configuration
  const defaultConfig = inputHandler.createDefaultConfig();
  console.log('2. Created default configuration:');
  console.log(`   - Minimum score: ${defaultConfig.thresholds.minScore}`);
  console.log(`   - Fail on critical: ${defaultConfig.thresholds.failOnCritical}`);
  console.log(`   - Output format: ${defaultConfig.output.format}`);

  // Example JSON configuration
  const exampleConfig = {
    rules: {
      enabled: ['html-validation', 'css-performance'],
      disabled: ['security-xss'],
      custom: []
    },
    thresholds: {
      minScore: 75,
      failOnCritical: true
    },
    output: {
      format: OutputFormat.JSON,
      includeCodeSnippets: true,
      detailedFindings: true
    }
  };

  console.log('\n3. Example configuration for merging:');
  console.log(`   - Enabled rules: ${exampleConfig.rules.enabled.join(', ')}`);
  console.log(`   - Disabled rules: ${exampleConfig.rules.disabled.join(', ')}`);
  console.log(`   - Minimum score: ${exampleConfig.thresholds.minScore}`);

  // Merge configurations
  const mergedConfig = inputHandler.mergeConfigs(defaultConfig, exampleConfig);
  console.log('\n4. Merged configuration:');
  console.log(`   - Total enabled rules: ${mergedConfig.rules.enabled.length}`);
  console.log(`   - Total disabled rules: ${mergedConfig.rules.disabled.length}`);
  console.log(`   - Minimum score: ${mergedConfig.thresholds.minScore}`);

  // Create example FileSet
  const exampleFileSet = {
    htmlFiles: new Map([
      ['index.html', '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>']
    ]),
    cssFiles: new Map([
      ['styles.css', 'body { font-family: Arial, sans-serif; color: #333; }']
    ]),
    jsFiles: new Map([
      ['app.js', 'console.log("Frontend evaluation example");']
    ]),
    metadata: {
      totalSize: 0,
      fileCount: 3,
      technologies: []
    }
  };

  // Validate FileSet
  const validationResult = inputHandler.validateFileSet(exampleFileSet);
  console.log('\n5. FileSet validation:');
  console.log(`   - Valid: ${validationResult.isValid}`);
  console.log(`   - Errors: ${validationResult.errors.length}`);
  console.log(`   - Warnings: ${validationResult.warnings.length}`);

  if (validationResult.warnings.length > 0) {
    console.log('   - Warning messages:');
    validationResult.warnings.forEach(warning => console.log(`     * ${warning}`));
  }

  // Demonstrate file size validation
  console.log('\n6. File size validation example:');
  const largeFileSet = {
    htmlFiles: new Map([
      ['large.html', 'x'.repeat(11 * 1024 * 1024)] // 11MB file (exceeds default 10MB limit)
    ]),
    cssFiles: new Map(),
    jsFiles: new Map(),
    metadata: {
      totalSize: 0,
      fileCount: 1,
      technologies: []
    }
  };

  const largeFileValidation = inputHandler.validateFileSet(largeFileSet);
  console.log(`   - Large file valid: ${largeFileValidation.isValid}`);
  console.log(`   - Large file warnings: ${largeFileValidation.warnings.length}`);

  // Demonstrate technology detection
  console.log('\n7. Technology detection example:');
  const reactFileSet = {
    htmlFiles: new Map([
      ['index.html', '<html><body>React Application</body></html>']
    ]),
    cssFiles: new Map([
      ['styles.css', '/* Tailwind CSS styles */']
    ]),
    jsFiles: new Map([
      ['app.js', 'import React from "react";\nimport ReactDOM from "react-dom";']
    ]),
    metadata: {
      totalSize: 0,
      fileCount: 3,
      technologies: []
    }
  };

  // Update metadata with detected technologies
  const detectedTech = inputHandler['detectTechnologies'](reactFileSet);
  console.log(`   - Detected technologies: ${detectedTech.join(', ')}`);

  // Demonstrate FrontendEvaluator integration
  console.log('\n8. FrontendEvaluator integration example:');
  const evaluator = new FrontendEvaluator();
  
  // Create FileSet using InputHandler (through FrontendEvaluator)
  const filePaths = ['index.html', 'styles.css', 'app.js'];
  console.log(`   - Would create FileSet from paths: ${filePaths.join(', ')}`);
  
  // Load configuration (simulated)
  console.log('   - Would load configuration from .evaluatorrc.json');
  
  // Validate input
  const evaluatorValidation = evaluator.validateInput(exampleFileSet);
  console.log(`   - Evaluator validation result: ${evaluatorValidation.isValid ? 'PASS' : 'FAIL'}`);

  console.log('\n=== Example Complete ===');
  console.log('\nKey features demonstrated:');
  console.log('1. Configuration creation and merging');
  console.log('2. FileSet validation with size checking');
  console.log('3. Technology stack detection');
  console.log('4. Integration with FrontendEvaluator');
  console.log('5. Support for JSON/YAML configuration files');
  console.log('6. File type detection and validation');
}

// Run the example
main().catch(console.error);