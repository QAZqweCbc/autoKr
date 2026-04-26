/**
 * Property-based tests for CodeQualityAnalyzer component
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * **Property 1: Code Analysis Round-Trip Consistency**
 * 
 * For any source code input, the analysis results should be consistent 
 * when the same code is analyzed multiple times
 */

import { CodeQualityAnalyzer } from '../analyzers/CodeQualityAnalyzer';
import { Severity } from '../types';

describe('CodeQualityAnalyzer Property Tests', () => {
  let analyzer: CodeQualityAnalyzer;

  beforeEach(() => {
    analyzer = new CodeQualityAnalyzer();
  });

  /**
   * Property 1: Code Analysis Round-Trip Consistency
   * 
   * This test validates that for any source code input, 
   * the analysis results should be consistent when the 
   * same code is analyzed multiple times (idempotence).
   * 
   * We test this property by:
   * 1. Generating random but valid HTML, CSS, and JavaScript ASTs
   * 2. Analyzing the same ASTs multiple times
   * 3. Verifying the results are identical
   */
  describe('Property 1: Code Analysis Round-Trip Consistency', () => {
    /**
     * Helper function to generate random HTML AST
     */
    function generateRandomHTMLAST(): any {
      const hasDoctype = Math.random() > 0.3;
      const elementCount = Math.floor(Math.random() * 20) + 1;
      
      const elements = Array.from({ length: elementCount }, (_, i) => {
        const tags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'button', 'img', 'form', 'input'];
        const semanticTags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
        const allTags = [...tags, ...semanticTags];
        
        const tagName = allTags[Math.floor(Math.random() * allTags.length)];
        const isSemantic = semanticTags.includes(tagName);
        
        const attributes: Record<string, string> = {};
        if (tagName === 'img' && Math.random() > 0.5) {
          attributes.src = `image${i}.jpg`;
          if (Math.random() > 0.3) {
            attributes.alt = `Image ${i}`;
          }
        }
        if (tagName === 'a' && Math.random() > 0.5) {
          attributes.href = `#link${i}`;
        }
        if (Math.random() > 0.7) {
          attributes.class = `class-${i}`;
        }
        if (Math.random() > 0.8) {
          attributes.id = `id-${i}`;
        }
        
        return {
          tagName,
          attributes,
          parentTag: i === 0 ? 'body' : tags[Math.floor(Math.random() * tags.length)],
          depth: Math.floor(Math.random() * 5) + 1,
          isSemantic
        };
      });
      
      // Add some deprecated elements occasionally
      if (Math.random() > 0.8) {
        elements.push({
          tagName: 'font',
          attributes: { size: '3' },
          parentTag: 'body',
          depth: 2,
          isSemantic: false
        });
      }
      
      return {
        doctype: hasDoctype ? 'html' : null,
        elements,
        metadata: {
          title: `Test Page ${Math.random().toString(36).substring(7)}`,
          metaTags: [],
          linkTags: [],
          scriptTags: [],
          styleTags: []
        },
        validation: {
          hasDoctype,
          hasHtmlTag: true,
          hasHeadTag: true,
          hasBodyTag: true,
          isValid: true
        }
      };
    }

    /**
     * Helper function to generate random CSS AST
     */
    function generateRandomCSSAST(): any {
      const selectorCount = Math.floor(Math.random() * 10) + 1;
      
      const selectors = Array.from({ length: selectorCount }, (_, i) => {
        const selectorTypes = [
          `.class-${i}`,
          `#id-${i}`,
          `div`,
          `span`,
          `a:hover`,
          `input[type="text"]`,
          `.container .item`,
          `#header .nav li`
        ];
        
        const selector = selectorTypes[Math.floor(Math.random() * selectorTypes.length)];
        const specificity = Math.floor(Math.random() * 150) + 1;
        const complexity = Math.floor(Math.random() * 10) + 1;
        
        return {
          selector,
          specificity,
          complexity,
          type: selector.includes('.') ? 'class' : 
                selector.includes('#') ? 'id' : 
                selector.includes(':') ? 'pseudo-class' : 
                selector.includes('[') ? 'attribute' : 'element',
          isIdSelector: selector.includes('#'),
          isClassSelector: selector.includes('.'),
          isAttributeSelector: selector.includes('['),
          isPseudoSelector: selector.includes(':') && !selector.includes('::'),
          isPseudoElement: selector.includes('::')
        };
      });
      
      const ruleCount = Math.floor(Math.random() * 8) + 1;
      const rules = Array.from({ length: ruleCount }, () => {
        const selector = selectors[Math.floor(Math.random() * selectors.length)].selector;
        const declarationCount = Math.floor(Math.random() * 5) + 1;
        const declarations = Array.from({ length: declarationCount }, (_j, j) => ({
          property: ['color', 'font-size', 'margin', 'padding', 'background-color'][j % 5],
          value: j % 2 === 0 ? 'red' : '16px',
          important: Math.random() > 0.8
        }));
        
        return {
          type: 'rule',
          selector,
          selectors: [selector],
          source: null,
          declarations
        };
      });
      
      const propertyCount = Math.floor(Math.random() * 15) + 1;
      const properties = Array.from({ length: propertyCount }, (_i, i) => ({
        property: ['color', 'font-size', 'margin', 'padding', 'background-color', 'border', 'display', 'width'][i % 8],
        value: i % 2 === 0 ? 'red' : `${Math.floor(Math.random() * 50) + 10}px`,
        important: Math.random() > 0.9,
        source: null
      }));
      
      return {
        type: 'css',
        rules,
        selectors,
        properties,
        mediaQueries: [],
        keyframes: [],
        validation: {
          isValid: true,
          ruleCount,
          selectorCount: selectors.length,
          propertyCount
        }
      };
    }

    /**
     * Helper function to generate random JavaScript AST
     */
    function generateRandomJavaScriptAST(): any {
      const functionCount = Math.floor(Math.random() * 5) + 1;
      const functions = Array.from({ length: functionCount }, (_i, i) => ({
        type: ['function', 'arrow', 'function-expression'][i % 3],
        name: `func${i}`,
        params: Array.from({ length: Math.floor(Math.random() * 6) }, (_j, j) => `param${j}`),
        async: Math.random() > 0.7,
        generator: Math.random() > 0.9,
        location: { start: { line: i * 10 + 1, column: 1 } }
      }));
      
      const variableCount = Math.floor(Math.random() * 5) + 1;
      const variables = Array.from({ length: variableCount }, (_i, i) => ({
        name: `var${i}`,
        kind: ['const', 'let', 'var'][i % 3],
        hasInit: true,
        location: { start: { line: i * 5 + 1, column: 1 } }
      }));
      
      const classCount = Math.floor(Math.random() * 3);
      const classes = Array.from({ length: classCount }, (_i, i) => ({
        name: `Class${i}`,
        superClass: null,
        methods: Math.floor(Math.random() * 5),
        properties: Math.floor(Math.random() * 3),
        location: { start: { line: i * 20 + 1, column: 1 } }
      }));
      
      const complexity = Math.floor(Math.random() * 30) + 1;
      const lineCount = Math.floor(Math.random() * 100) + 10;
      const statementCount = Math.floor(Math.random() * 50) + 5;
      
      return {
        type: 'javascript',
        analysis: {
          functions,
          variables,
          imports: [],
          exports: [],
          classes,
          calls: [],
          patterns: {
            hasAsyncFunctions: functions.some(f => f.async),
            hasArrowFunctions: functions.some(f => f.type === 'arrow'),
            hasClasses: classCount > 0,
            hasModules: false,
            hasTryCatch: Math.random() > 0.7,
            hasLoops: Math.random() > 0.5,
            hasConditionals: Math.random() > 0.6
          }
        },
        statistics: {
          functionCount,
          variableCount,
          importCount: 0,
          exportCount: 0,
          classCount,
          callCount: 0,
          lineCount,
          statementCount,
          complexity
        },
        ast: {
          type: 'Program',
          body: [],
          loc: { start: { line: 1, column: 1 }, end: { line: lineCount, column: 1 } }
        },
        validation: {
          isValid: true,
          parseSuccess: true
        }
      };
    }

    /**
     * Test HTML analysis idempotence with random ASTs
     */
    test('HTML analysis is idempotent (random ASTs)', () => {
      // Test with 50 random HTML ASTs
      for (let i = 0; i < 50; i++) {
        const htmlAST = generateRandomHTMLAST();
        const filePath = `test${i}.html`;
        
        // Analyze the same AST twice
        const result1 = analyzer.analyzeHTMLStructure(htmlAST, filePath);
        const result2 = analyzer.analyzeHTMLStructure(htmlAST, filePath);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          // Check that findings have consistent structure
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
            expect(result1[j].message).toBe(result2[j].message);
          }
        }
      }
    });

    /**
     * Test CSS analysis idempotence with random ASTs
     */
    test('CSS analysis is idempotent (random ASTs)', () => {
      // Test with 50 random CSS ASTs
      for (let i = 0; i < 50; i++) {
        const cssAST = generateRandomCSSAST();
        const filePath = `styles${i}.css`;
        
        // Analyze the same AST twice
        const result1 = analyzer.analyzeCSSQuality(cssAST, filePath);
        const result2 = analyzer.analyzeCSSQuality(cssAST, filePath);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          // Check that findings have consistent structure
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
          }
        }
      }
    });

    /**
     * Test JavaScript analysis idempotence with random ASTs
     */
    test('JavaScript analysis is idempotent (random ASTs)', () => {
      // Test with 50 random JavaScript ASTs
      for (let i = 0; i < 50; i++) {
        const jsAST = generateRandomJavaScriptAST();
        const filePath = `app${i}.js`;
        
        // Analyze the same AST twice
        const result1 = analyzer.analyzeJavaScriptQuality(jsAST, filePath);
        const result2 = analyzer.analyzeJavaScriptQuality(jsAST, filePath);
        
        // Results should have same number of findings
        expect(result1.length).toBe(result2.length);
        
        // If there are findings, they should be consistent
        if (result1.length > 0) {
          // Check that findings have consistent structure
          for (let j = 0; j < Math.min(result1.length, result2.length); j++) {
            expect(result1[j].severity).toBe(result2[j].severity);
            expect(result1[j].ruleId).toBe(result2[j].ruleId);
          }
        }
      }
    });

    /**
     * Test recommendation generation idempotence
     */
    test('Recommendation generation is idempotent (random findings)', () => {
      // Test with 50 random sets of findings
      for (let i = 0; i < 50; i++) {
        const findingCount = Math.floor(Math.random() * 10) + 1;
        const findings = Array.from({ length: findingCount }, (_j, j) => {
          const severities = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          const ruleTypes = ['HTML', 'CSS', 'JS'];
          const ruleType = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
          
          return {
            id: `finding-${i}-${j}`,
            severity,
            message: `${ruleType} issue ${j}`,
            location: { file: `test.${ruleType.toLowerCase()}`, line: j + 1, column: 1 },
            codeSnippet: `Fix ${ruleType} issue`,
            ruleId: `CQ-${ruleType}-${j}`
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
            ruleId: `CQ-TEST-${j}`
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
     * Test edge cases for analysis consistency
     */
    describe('Edge case consistency', () => {
      test('Empty ASTs produce consistent results', () => {
        const emptyHTMLAST = {
          doctype: null,
          elements: [],
          metadata: { title: '', metaTags: [], linkTags: [], scriptTags: [], styleTags: [] },
          validation: { hasDoctype: false, hasHtmlTag: false, hasHeadTag: false, hasBodyTag: false, isValid: false }
        };
        
        const emptyCSSAST = {
          type: 'css',
          rules: [],
          selectors: [],
          properties: [],
          mediaQueries: [],
          keyframes: [],
          validation: { isValid: false, ruleCount: 0, selectorCount: 0, propertyCount: 0 }
        };
        
        const emptyJSAST = {
          type: 'javascript',
          analysis: { functions: [], variables: [], imports: [], exports: [], classes: [], calls: [], patterns: {} },
          statistics: { functionCount: 0, variableCount: 0, importCount: 0, exportCount: 0, classCount: 0, callCount: 0, lineCount: 0, statementCount: 0, complexity: 0 },
          ast: { type: 'Program', body: [] },
          validation: { isValid: false, parseSuccess: false }
        };
        
        // HTML
        const htmlResult1 = analyzer.analyzeHTMLStructure(emptyHTMLAST, 'empty.html');
        const htmlResult2 = analyzer.analyzeHTMLStructure(emptyHTMLAST, 'empty.html');
        expect(htmlResult1).toEqual(htmlResult2);
        
        // CSS
        const cssResult1 = analyzer.analyzeCSSQuality(emptyCSSAST, 'empty.css');
        const cssResult2 = analyzer.analyzeCSSQuality(emptyCSSAST, 'empty.css');
        expect(cssResult1).toEqual(cssResult2);
        
        // JavaScript
        const jsResult1 = analyzer.analyzeJavaScriptQuality(emptyJSAST, 'empty.js');
        const jsResult2 = analyzer.analyzeJavaScriptQuality(emptyJSAST, 'empty.js');
        expect(jsResult1).toEqual(jsResult2);
      });

      test('ASTs with maximum findings produce consistent results', () => {
        // HTML AST with many issues
        const problematicHTMLAST = {
          doctype: null,
          elements: [
            { tagName: 'font', attributes: {}, parentTag: 'body', depth: 1, isSemantic: false },
            { tagName: 'center', attributes: {}, parentTag: 'body', depth: 1, isSemantic: false },
            { tagName: 'img', attributes: { src: 'test.jpg' }, parentTag: 'body', depth: 1, isSemantic: false }, // Missing alt
            { tagName: 'a', attributes: {}, parentTag: 'body', depth: 1, isSemantic: false }, // Missing href
            { tagName: 'div', attributes: {}, parentTag: 'a', depth: 2, isSemantic: false } // Invalid nesting
          ]
        };
        
        // CSS AST with many issues
        const problematicCSSAST = {
          type: 'css',
          rules: [
            { selector: '.container', declarations: [{ property: 'color', value: 'red', important: true }] },
            { selector: '.container', declarations: [{ property: 'color', value: 'red', important: true }] } // Duplicate
          ],
          selectors: [
            { selector: '#header .nav .item.active .subitem', specificity: 130, complexity: 5 }
          ],
          properties: [
            { property: 'color', value: 'red', important: true },
            { property: 'font-size', value: '16px', important: true },
            { property: 'margin', value: '0', important: true },
            { property: 'padding', value: '10px', important: true }
          ],
          mediaQueries: [],
          keyframes: [],
          validation: { isValid: true, ruleCount: 2, selectorCount: 1, propertyCount: 4 }
        };
        
        // JavaScript AST with many issues
        const problematicJSAST = {
          type: 'javascript',
          analysis: {
            functions: [
              { type: 'function', name: 'tooManyParams', params: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }
            ],
            variables: [],
            imports: [],
            exports: [],
            classes: [],
            calls: [],
            patterns: {}
          },
          statistics: {
            functionCount: 1,
            variableCount: 0,
            importCount: 0,
            exportCount: 0,
            classCount: 0,
            callCount: 0,
            lineCount: 50,
            statementCount: 20,
            complexity: 30
          },
          ast: {
            type: 'Program',
            body: [
              {
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'document' },
                    property: { type: 'Identifier', name: 'addEventListener' }
                  },
                  arguments: [
                    { type: 'Literal', value: 'click' },
                    { type: 'FunctionExpression', params: [], body: { type: 'BlockStatement', body: [] } }
                  ]
                }
              }
            ]
          },
          validation: { isValid: true, parseSuccess: true }
        };
        
        // Test all three
        const htmlResult1 = analyzer.analyzeHTMLStructure(problematicHTMLAST, 'problem.html');
        const htmlResult2 = analyzer.analyzeHTMLStructure(problematicHTMLAST, 'problem.html');
        expect(htmlResult1.length).toBe(htmlResult2.length);
        
        const cssResult1 = analyzer.analyzeCSSQuality(problematicCSSAST, 'problem.css');
        const cssResult2 = analyzer.analyzeCSSQuality(problematicCSSAST, 'problem.css');
        expect(cssResult1.length).toBe(cssResult2.length);
        
        const jsResult1 = analyzer.analyzeJavaScriptQuality(problematicJSAST, 'problem.js');
        const jsResult2 = analyzer.analyzeJavaScriptQuality(problematicJSAST, 'problem.js');
        expect(jsResult1.length).toBe(jsResult2.length);
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
          ruleId: 'CQ-CRITICAL'
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
            ruleId: 'CQ-CRITICAL'
          },
          {
            id: 'high',
            severity: Severity.HIGH,
            message: 'High issue',
            location: { file: 'test.html', line: 2, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'CQ-HIGH'
          },
          {
            id: 'medium',
            severity: Severity.MEDIUM,
            message: 'Medium issue',
            location: { file: 'test.html', line: 3, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'CQ-MEDIUM'
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