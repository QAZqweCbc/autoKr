/**
 * Example usage of AccessibilityAnalyzer
 * Demonstrates how to check WCAG compliance for HTML/CSS/JS
 */

import { AccessibilityAnalyzer } from '../src/analyzers/AccessibilityAnalyzer';
import { FileParser } from '../src/parsers/FileParser';
import { FileSet, Technology } from '../src/types';

async function demonstrateAccessibilityAnalyzer() {
  console.log('=== Accessibility Analyzer Example ===\n');

  // Create sample HTML with accessibility issues
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Page</title>
</head>
<body>
  <div class="header">
    <h1>Welcome</h1>
  </div>
  
  <div class="content">
    <img src="logo.png">
    <div onclick="handleClick()">Click me</div>
    <input type="text" placeholder="Enter name">
    <a>Learn more</a>
  </div>
  
  <div class="footer">
    <p>© 2024</p>
  </div>
</body>
</html>
  `;

  // Create sample CSS with contrast issues
  const cssContent = `
body {
  color: #999;
  background-color: #fff;
}

.header {
  color: #ccc;
  background: white;
}
  `;

  // Create sample JavaScript
  const jsContent = `
document.querySelector('.content').addEventListener('click', function() {
  console.log('Clicked');
});
  `;

  // Create FileSet
  const fileSet: FileSet = {
    htmlFiles: new Map([['index.html', htmlContent]]),
    cssFiles: new Map([['styles.css', cssContent]]),
    jsFiles: new Map([['app.js', jsContent]]),
    metadata: {
      totalSize: htmlContent.length + cssContent.length + jsContent.length,
      fileCount: 3,
      technologies: [Technology.TYPESCRIPT]
    }
  };

  // Parse files
  const parser = new FileParser();
  const parsedFiles = await parser.parseFiles(fileSet);

  // Create analyzer
  const analyzer = new AccessibilityAnalyzer();

  // Check semantic structure
  console.log('1. Checking Semantic Structure...');
  const htmlAST = parsedFiles.htmlASTs.get('index.html');
  const semanticFindings = analyzer.checkSemanticStructure(htmlAST);
  console.log(`   Found ${semanticFindings.length} semantic issues:`);
  semanticFindings.slice(0, 3).forEach(finding => {
    console.log(`   - [${finding.severity}] ${finding.message}`);
  });
  console.log();

  // Check color contrast
  console.log('2. Checking Color Contrast...');
  const cssAST = parsedFiles.cssASTs.get('styles.css');
  const contrastFindings = analyzer.checkColorContrast(htmlAST, cssAST);
  console.log(`   Found ${contrastFindings.length} contrast issues:`);
  contrastFindings.slice(0, 3).forEach(finding => {
    console.log(`   - [${finding.severity}] ${finding.message}`);
  });
  console.log();

  // Check keyboard navigation
  console.log('3. Checking Keyboard Navigation...');
  const jsAST = parsedFiles.jsASTs.get('app.js');
  const keyboardFindings = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
  console.log(`   Found ${keyboardFindings.length} keyboard navigation issues:`);
  keyboardFindings.slice(0, 3).forEach(finding => {
    console.log(`   - [${finding.severity}] ${finding.message}`);
  });
  console.log();

  // Check image alt text
  console.log('4. Checking Image Alt Text...');
  const imageFindings = analyzer.checkImageAltText(htmlAST);
  console.log(`   Found ${imageFindings.length} image accessibility issues:`);
  imageFindings.forEach(finding => {
    console.log(`   - [${finding.severity}] ${finding.message}`);
  });
  console.log();

  // Combine all findings
  const allFindings = [
    ...semanticFindings,
    ...contrastFindings,
    ...keyboardFindings,
    ...imageFindings
  ];

  // Generate recommendations
  console.log('5. Generating Recommendations...');
  const recommendations = analyzer.generateRecommendations(allFindings);
  console.log(`   Generated ${recommendations.length} recommendations:`);
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. [${rec.priority}] ${rec.description}`);
    console.log(`      Impact: ${rec.estimatedImpact}`);
    console.log(`      Steps: ${rec.implementationSteps.length} implementation steps`);
  });
  console.log();

  // Calculate accessibility score
  console.log('6. Calculating Accessibility Score...');
  const score = analyzer.calculateScore(allFindings);
  console.log(`   Accessibility Score: ${score}/100`);
  console.log(`   Total Issues: ${allFindings.length}`);
  console.log(`   - Critical: ${allFindings.filter(f => f.severity === 'CRITICAL').length}`);
  console.log(`   - High: ${allFindings.filter(f => f.severity === 'HIGH').length}`);
  console.log(`   - Medium: ${allFindings.filter(f => f.severity === 'MEDIUM').length}`);
  console.log(`   - Low: ${allFindings.filter(f => f.severity === 'LOW').length}`);
  console.log(`   - Info: ${allFindings.filter(f => f.severity === 'INFO').length}`);
  console.log();

  // Summary
  console.log('=== Summary ===');
  console.log(`The page has significant accessibility issues that need attention.`);
  console.log(`Key areas to improve:`);
  console.log(`- Add semantic HTML5 landmarks (<main>, <nav>, <header>, <footer>)`);
  console.log(`- Improve color contrast ratios for WCAG compliance`);
  console.log(`- Add keyboard event handlers to interactive elements`);
  console.log(`- Provide alt text for all images`);
  console.log(`- Add labels to form inputs`);
}

// Run the example
demonstrateAccessibilityAnalyzer().catch(console.error);
