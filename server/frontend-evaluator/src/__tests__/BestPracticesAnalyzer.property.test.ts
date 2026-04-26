/**
 * Property-based tests for BestPracticesAnalyzer component
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 * **Property 5: Best Practices Validation Consistency**
 * 
 * For any frontend code following or violating best practices, 
 * the analyzer should consistently identify the same patterns and anti-patterns
 */

import { BestPracticesAnalyzer } from '../analyzers/BestPracticesAnalyzer';
import { Severity } from '../types';

describe('BestPracticesAnalyzer Property Tests', () => {
  let analyzer: BestPracticesAnalyzer;

  beforeEach(() => {
    analyzer = new BestPracticesAnalyzer();
  });

  /**
   * Property 5: Best Practices Validation Consistency
   * 
   * This test validates that for any frontend code following or violating 
   * best practices, the analyzer should consistently identify the same 
   * patterns and anti-patterns across multiple analyses.
   * 
   * We test this property by:
   * 1. Generating random but valid HTML, CSS, and JavaScript ASTs with various best practice violations
   * 2. Analyzing the same ASTs multiple times
   * 3. Verifying the results are identical (idempotence)
   */
  describe('Property 5: Best Practices Validation Consistency', () => {
    /**
     * Helper function to generate random HTML AST with responsive design elements
     */
    function generateRandomHTMLAST(): any {
      const hasViewport = Math.random() > 0.5;
      const viewportContent = hasViewport ? 
        (Math.random() > 0.7 ? 'width=device-width, initial-scale=1.0' : 
         Math.random() > 0.5 ? 'width=device-width' : 'initial-scale=1.0') : '';
      
      const elements: any[] = [];
      
      // Add viewport meta tag
      if (hasViewport) {
        elements.push({
          tagName: 'meta',
          attributes: {
            name: 'viewport',
            content: viewportContent
          }
        });
      }
      
      // Add title tag
      const titleLength = Math.floor(Math.random() * 100);
      const titleText = titleLength > 0 ? 'A'.repeat(titleLength) : '';
      if (Math.random() > 0.3) {
        elements.push({
          tagName: 'title',
          text: titleText,
          content: titleText
        });
      }
      
      // Add meta description
      const descLength = Math.floor(Math.random() * 200);
      const descContent = descLength > 0 ? 'B'.repeat(descLength) : '';
      if (Math.random() > 0.4) {
        elements.push({
          tagName: 'meta',
          attributes: {
            name: 'description',
            content: descContent
          }
        });
      }
      
      // Add Open Graph tags
      const ogTags = ['og:title', 'og:description', 'og:image', 'og:url'];
      ogTags.forEach(tag => {
        if (Math.random() > 0.6) {
          elements.push({
            tagName: 'meta',
            attributes: {
              property: tag,
              content: `Content for ${tag}`
            }
          });
        }
      });
      
      // Add Twitter Card tags
      if (Math.random() > 0.7) {
        elements.push({
          tagName: 'meta',
          attributes: {
            name: 'twitter:card',
            content: 'summary_large_image'
          }
        });
      }
      
      // Add canonical link
      if (Math.random() > 0.5) {
        elements.push({
          tagName: 'link',
          attributes: {
            rel: 'canonical',
            href: 'https://example.com/page'
          }
        });
      }
      
      // Add html tag with lang attribute
      if (Math.random() > 0.5) {
        elements.push({
          tagName: 'html',
          attributes: {
            lang: Math.random() > 0.5 ? 'en' : undefined
          }
        });
      }
      
      // Add elements with inline styles and event handlers
      const elementCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < elementCount; i++) {
        const attrs: any = {};
        
        if (Math.random() > 0.7) {
          attrs.style = 'color: red;';
        }
        
        if (Math.random() > 0.8) {
          attrs.onclick = 'handleClick()';
        }
        
        elements.push({
          tagName: 'div',
          attributes: attrs
        });
      }
      
      return {
        elements,
        metadata: {
          title: titleText,
          metaTags: [],
          linkTags: [],
          scriptTags: [],
          styleTags: []
        }
      };
    }

    /**
     * Helper function to generate random CSS AST with responsive design elements
     */
    function generateRandomCSSAST(): any {
      const properties: any[] = [];
      
      // Add media queries
      const mediaQueryCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < mediaQueryCount; i++) {
        const isMinWidth = Math.random() > 0.5;
        const breakpoint = [320, 375, 768, 1024, 1440][Math.floor(Math.random() * 5)];
        
        properties.push({
          type: 'media-query',
          mediaQuery: `(${isMinWidth ? 'min' : 'max'}-width: ${breakpoint}px)`,
          value: `(${isMinWidth ? 'min' : 'max'}-width: ${breakpoint}px)`
        });
      }
      
      // Add base styles
      const baseStyleCount = Math.floor(Math.random() * 10);
      for (let i = 0; i < baseStyleCount; i++) {
        const units = ['px', 'rem', 'em', '%', 'vw', 'vh'];
        const unit = units[Math.floor(Math.random() * units.length)];
        
        properties.push({
          property: ['width', 'font-size', 'margin', 'padding'][Math.floor(Math.random() * 4)],
          value: `${Math.floor(Math.random() * 50)}${unit}`,
          important: Math.random() > 0.8
        });
      }
      
      // Add flexbox/grid
      if (Math.random() > 0.5) {
        properties.push({
          property: 'display',
          value: Math.random() > 0.5 ? 'flex' : 'grid'
        });
      }
      
      // Add selectors with varying complexity
      const selectorCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < selectorCount; i++) {
        const depth = Math.floor(Math.random() * 6);
        const selector = Array(depth).fill('.class').join(' ');
        
        properties.push({
          selector: selector || '.simple',
          property: 'color',
          value: Math.random() > 0.7 ? 'red !important' : 'blue'
        });
      }
      
      return {
        type: 'css',
        properties,
        rules: [],
        selectors: [],
        mediaQueries: [],
        keyframes: [],
        validation: {
          isValid: true,
          ruleCount: 0,
          selectorCount: 0,
          propertyCount: properties.length
        }
      };
    }

    /**
     * Helper function to generate random JavaScript AST with patterns
     */
    function generateRandomJavaScriptAST(): any {
      const body: any[] = [];
      
      // Add global var declarations
      const varCount = Math.floor(Math.random() * 3);
      for (let i = 0; i < varCount; i++) {
        body.push({
          type: 'VariableDeclaration',
          kind: 'var',
          declarations: [{
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: `globalVar${i}` },
            init: { type: 'Literal', value: 0 }
          }]
        });
      }
      
      // Add nested callbacks
      const callbackDepth = Math.floor(Math.random() * 5);
      let currentCallback: any = {
        type: 'BlockStatement',
        body: []
      };
      
      for (let i = 0; i < callbackDepth; i++) {
        currentCallback = {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: 'asyncFunc' },
          arguments: [{
            type: 'FunctionExpression',
            params: [],
            body: currentCallback
          }]
        };
      }
      
      if (callbackDepth > 0) {
        body.push({
          type: 'ExpressionStatement',
          expression: currentCallback
        });
      }
      
      // Add magic numbers
      const magicNumberCount = Math.floor(Math.random() * 10);
      for (let i = 0; i < magicNumberCount; i++) {
        body.push({
          type: 'ExpressionStatement',
          expression: {
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: Math.floor(Math.random() * 100) + 2 }
          }
        });
      }
      
      return {
        type: 'javascript',
        ast: {
          type: 'Program',
          body
        },
        analysis: {
          functions: [],
          variables: [],
          imports: [],
          exports: [],
          classes: [],
          calls: [],
          patterns: {}
        },
        statistics: {
          functionCount: 0,
          variableCount: varCount,
          importCount: 0,
          exportCount: 0,
          classCount: 0,
          callCount: 0,
          lineCount: 50,
          statementCount: body.length,
          complexity: 10
        },
        validation: {
          isValid: true,
          parseSuccess: true
        }
      };
    }

    /**
     * Test responsive design analysis idempotence
     * Validates: Requirement 5.1
     */
    test('Responsive design analysis is idempotent (random ASTs)', () => {
      // Test with 50 random HTML/CSS AST combinations
      for (let i = 0; i < 50; i++) {
        const htmlAST = generateRandomHTMLAST();
        const cssAST = generateRandomCSSAST();
        
        // Analyze the same ASTs twice
        const result1 = analyzer.checkResponsiveDesign(htmlAST, cssAST);
        const result2 = analyzer.checkResponsiveDesign(htmlAST, cssAST);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
            expect(result1[j].message).toBe(result2[j].message);
          }
        }
      }
    });

    /**
     * Test mobile-first approach analysis idempotence
     * Validates: Requirement 5.2
     */
    test('Mobile-first approach analysis is idempotent (random ASTs)', () => {
      // Test with 50 random CSS ASTs
      for (let i = 0; i < 50; i++) {
        const cssAST = generateRandomCSSAST();
        
        // Analyze the same AST twice
        const result1 = analyzer.checkMobileFirstApproach(cssAST);
        const result2 = analyzer.checkMobileFirstApproach(cssAST);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
          }
        }
      }
    });

    /**
     * Test SEO meta tags analysis idempotence
     * Validates: Requirement 5.3
     */
    test('SEO meta tags analysis is idempotent (random ASTs)', () => {
      // Test with 50 random HTML ASTs
      for (let i = 0; i < 50; i++) {
        const htmlAST = generateRandomHTMLAST();
        
        // Analyze the same AST twice
        const result1 = analyzer.checkSEOMetaTags(htmlAST);
        const result2 = analyzer.checkSEOMetaTags(htmlAST);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
            expect(result1[j].message).toBe(result2[j].message);
          }
        }
      }
    });

    /**
     * Test framework best practices analysis idempotence
     * Validates: Requirement 5.4
     */
    test('Framework best practices analysis is idempotent (random ASTs)', () => {
      const frameworks = ['react', 'vue', 'angular', 'none'];
      
      // Test with 50 random AST combinations
      for (let i = 0; i < 50; i++) {
        const htmlAST = generateRandomHTMLAST();
        const cssAST = generateRandomCSSAST();
        const jsAST = generateRandomJavaScriptAST();
        const framework = frameworks[Math.floor(Math.random() * frameworks.length)];
        
        // Analyze the same ASTs twice
        const result1 = analyzer.checkFrameworkBestPractices(htmlAST, cssAST, jsAST, framework);
        const result2 = analyzer.checkFrameworkBestPractices(htmlAST, cssAST, jsAST, framework);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
          }
        }
      }
    });

    /**
     * Test anti-pattern identification idempotence
     * Validates: Requirement 5.5
     */
    test('Anti-pattern identification is idempotent (random ASTs)', () => {
      // Test with 50 random AST combinations
      for (let i = 0; i < 50; i++) {
        const htmlAST = generateRandomHTMLAST();
        const cssAST = generateRandomCSSAST();
        const jsAST = generateRandomJavaScriptAST();
        
        // Analyze the same ASTs twice
        const result1 = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);
        const result2 = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
          }
        }
      }
    });

    /**
     * Test recommendation generation idempotence
     * Validates: Requirement 5.5
     */
    test('Recommendation generation is idempotent (random findings)', () => {
      // Test with 50 random sets of findings
      for (let i = 0; i < 50; i++) {
        const findingCount = Math.floor(Math.random() * 15) + 1;
        const findings = Array.from({ length: findingCount }, (_j, j) => {
          const severities = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          const ruleTypes = ['RES', 'MOB', 'SEO', 'FW', 'ANTI'];
          const ruleType = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
          
          return {
            id: `finding-${i}-${j}`,
            severity,
            message: `${ruleType} issue ${j}`,
            location: { file: 'test.html', line: j + 1, column: 1 },
            codeSnippet: `Fix ${ruleType} issue`,
            ruleId: `BP-${ruleType}-${j}`
          };
        });
        
        // Generate recommendations twice
        const result1 = analyzer.generateRecommendations(findings);
        const result2 = analyzer.generateRecommendations(findings);
        
        // Results should have same number of recommendations
        expect(result1.length).toBe(result2.length);
        
        // If there are recommendations, they should be consistent
        if (result1.length > 0) {
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].description).toBe(result2[j].description);
            expect(result1[j].priority).toBe(result2[j].priority);
            expect(result1[j].implementationSteps.length).toBe(result2[j].implementationSteps.length);
          }
        }
      }
    });

    /**
     * Test score calculation idempotence
     */
    test('Score calculation is idempotent (random findings)', () => {
      // Test with 100 random sets of findings
      for (let i = 0; i < 100; i++) {
        const findingCount = Math.floor(Math.random() * 20) + 1;
        const findings = Array.from({ length: findingCount }, (_j, j) => {
          const severities = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          return {
            id: `finding-${i}-${j}`,
            severity,
            message: `Issue ${j}`,
            location: { file: 'test.html', line: j + 1, column: 1 },
            codeSnippet: `Fix issue`,
            ruleId: `BP-TEST-${j}`
          };
        });
        
        // Calculate score twice
        const result1 = analyzer.calculateScore(findings);
        const result2 = analyzer.calculateScore(findings);
        
        // Scores should be identical
        expect(result1).toBe(result2);
        
        // Score should be between 0 and 100
        expect(result1).toBeGreaterThanOrEqual(0);
        expect(result1).toBeLessThanOrEqual(100);
      }
    });

    /**
     * Test edge cases for best practices analysis consistency
     */
    describe('Edge case consistency', () => {
      test('Empty ASTs produce consistent results', () => {
        const emptyHTMLAST = { elements: [] };
        const emptyCSSAST = { type: 'css', properties: [], rules: [], selectors: [] };
        const emptyJSAST = { type: 'javascript', ast: { type: 'Program', body: [] }, analysis: {}, statistics: {} };
        
        // Responsive design
        const resResult1 = analyzer.checkResponsiveDesign(emptyHTMLAST, emptyCSSAST);
        const resResult2 = analyzer.checkResponsiveDesign(emptyHTMLAST, emptyCSSAST);
        expect(resResult1).toEqual(resResult2);
        
        // Mobile-first
        const mobResult1 = analyzer.checkMobileFirstApproach(emptyCSSAST);
        const mobResult2 = analyzer.checkMobileFirstApproach(emptyCSSAST);
        expect(mobResult1).toEqual(mobResult2);
        
        // SEO
        const seoResult1 = analyzer.checkSEOMetaTags(emptyHTMLAST);
        const seoResult2 = analyzer.checkSEOMetaTags(emptyHTMLAST);
        expect(seoResult1).toEqual(seoResult2);
        
        // Framework
        const fwResult1 = analyzer.checkFrameworkBestPractices(emptyHTMLAST, emptyCSSAST, emptyJSAST, 'react');
        const fwResult2 = analyzer.checkFrameworkBestPractices(emptyHTMLAST, emptyCSSAST, emptyJSAST, 'react');
        expect(fwResult1).toEqual(fwResult2);
        
        // Anti-patterns
        const apResult1 = analyzer.identifyAntiPatterns(emptyHTMLAST, emptyCSSAST, emptyJSAST);
        const apResult2 = analyzer.identifyAntiPatterns(emptyHTMLAST, emptyCSSAST, emptyJSAST);
        expect(apResult1).toEqual(apResult2);
      });

      test('ASTs with maximum violations produce consistent results', () => {
        // HTML with many violations
        const problematicHTMLAST = {
          elements: [
            { tagName: 'div', attributes: { style: 'color: red;', onclick: 'alert()' } },
            { tagName: 'div', attributes: { style: 'font-size: 16px;', onload: 'init()' } },
            { tagName: 'span', attributes: { onclick: 'handleClick()' } }
          ]
        };
        
        // CSS with many violations
        const problematicCSSAST = {
          type: 'css',
          properties: [
            { property: 'color', value: 'red !important', selector: '.a .b .c .d .e' },
            { property: 'color', value: 'blue !important', selector: '.a .b .c .d .e' },
            { property: 'width', value: '500px' },
            { property: 'width', value: '600px' },
            { property: 'width', value: '700px' }
          ],
          rules: [],
          selectors: []
        };
        
        // JavaScript with many violations
        const problematicJSAST = {
          type: 'javascript',
          ast: {
            type: 'Program',
            body: [
              { type: 'VariableDeclaration', kind: 'var', declarations: [] },
              { type: 'VariableDeclaration', kind: 'var', declarations: [] },
              {
                type: 'ExpressionStatement',
                expression: {
                  type: 'BinaryExpression',
                  left: { type: 'Identifier', name: 'x' },
                  right: { type: 'Literal', value: 42 }
                }
              }
            ]
          },
          analysis: {},
          statistics: {}
        };
        
        // Test all methods
        const resResult1 = analyzer.checkResponsiveDesign(problematicHTMLAST, problematicCSSAST);
        const resResult2 = analyzer.checkResponsiveDesign(problematicHTMLAST, problematicCSSAST);
        expect(resResult1.length).toBe(resResult2.length);
        
        const mobResult1 = analyzer.checkMobileFirstApproach(problematicCSSAST);
        const mobResult2 = analyzer.checkMobileFirstApproach(problematicCSSAST);
        expect(mobResult1.length).toBe(mobResult2.length);
        
        const seoResult1 = analyzer.checkSEOMetaTags(problematicHTMLAST);
        const seoResult2 = analyzer.checkSEOMetaTags(problematicHTMLAST);
        expect(seoResult1.length).toBe(seoResult2.length);
        
        const apResult1 = analyzer.identifyAntiPatterns(problematicHTMLAST, problematicCSSAST, problematicJSAST);
        const apResult2 = analyzer.identifyAntiPatterns(problematicHTMLAST, problematicCSSAST, problematicJSAST);
        expect(apResult1.length).toBe(apResult2.length);
      });

      test('Score calculation boundary conditions', () => {
        // Test with no findings (should be 100)
        const noFindings: any[] = [];
        expect(analyzer.calculateScore(noFindings)).toBe(100);
        
        // Test with many critical findings (should be 0)
        const criticalFindings = Array(20).fill({
          id: 'critical',
          severity: Severity.CRITICAL,
          message: 'Critical issue',
          location: { file: 'test.html', line: 1, column: 1 },
          codeSnippet: 'Fix',
          ruleId: 'BP-CRITICAL'
        });
        expect(analyzer.calculateScore(criticalFindings)).toBe(0);
        
        // Test with mixed severity findings
        const mixedFindings = [
          {
            id: 'critical',
            severity: Severity.CRITICAL,
            message: 'Critical issue',
            location: { file: 'test.html', line: 1, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'BP-CRITICAL'
          },
          {
            id: 'high',
            severity: Severity.HIGH,
            message: 'High issue',
            location: { file: 'test.html', line: 2, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'BP-HIGH'
          },
          {
            id: 'medium',
            severity: Severity.MEDIUM,
            message: 'Medium issue',
            location: { file: 'test.html', line: 3, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'BP-MEDIUM'
          }
        ];
        const score = analyzer.calculateScore(mixedFindings);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        
        // Calculate twice should be same
        expect(analyzer.calculateScore(mixedFindings)).toBe(score);
      });
    });
  });
});
