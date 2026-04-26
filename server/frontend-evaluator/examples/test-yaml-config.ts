/**
 * Test YAML configuration loading
 */

import { InputHandler } from '../src/engine/InputHandler';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testYamlConfig() {
  console.log('Testing YAML configuration loading...\n');
  
  const inputHandler = new InputHandler();
  const yamlConfigPath = path.join(__dirname, 'config.example.yaml');
  
  try {
    // Check if file exists
    await fs.access(yamlConfigPath);
    
    // Load configuration
    const config = await inputHandler.loadConfig(yamlConfigPath);
    
    console.log('✅ YAML configuration loaded successfully!');
    console.log(`\nConfiguration details:`);
    console.log(`- Enabled rules: ${config.rules.enabled.length} rules`);
    console.log(`- Disabled rules: ${config.rules.disabled.length} rules`);
    console.log(`- Minimum score: ${config.thresholds.minScore}`);
    console.log(`- Output format: ${config.output.format}`);
    console.log(`- Include code snippets: ${config.output.includeCodeSnippets}`);
    
    // Verify specific values
    console.log(`\n✅ Verification:`);
    console.log(`- Contains 'html-validation' in enabled rules: ${config.rules.enabled.includes('html-validation')}`);
    console.log(`- Minimum score is 80: ${config.thresholds.minScore === 80}`);
    console.log(`- Fail on critical is true: ${config.thresholds.failOnCritical === true}`);
    
  } catch (error) {
    console.error('❌ Failed to load YAML configuration:', error instanceof Error ? error.message : String(error));
  }
}

testYamlConfig().catch(console.error);