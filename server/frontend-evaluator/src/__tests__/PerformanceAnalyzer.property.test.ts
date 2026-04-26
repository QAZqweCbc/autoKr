/**
 * Property-based tests for PerformanceAnalyzer component
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 * **Property 4: Performance Metric Calculation Accuracy**
 * 
 * Performance metrics should be calculated consistently and accurately
 * based on the input code structure
 */

import { PerformanceAnalyzer } from '../analyzers/PerformanceAnalyzer';
import { Severity } from '../types';

describe('PerformanceAnalyzer Property Tests', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  /**
   * Property 4: Performance Metric Calculation Accuracy
   * 
   * This test validates that performance metrics are calculated
   * consistently and accurately based on the input code structure.
   * 
   * We test this property by:
   * 1. Generating random but valid HTML, CSS, and JavaScript ASTs
   * 2. Calculating performance metrics multiple times
   * 3. Verifying the results are consistent (idempotence)
   * 4. Checking that metrics follow expected patterns
   */
  describe('Property 4: Performance Metric Calculation Accuracy', () => {
    /**
     * Helper function to generate random HTML AST
     */
    function generateRandomHTMLAST(): any {
      const elementCount = Math.floor(Math.random() * 30) + 1;
      
      const elements = Array.from({ length: elementCount }, (_, i) => {
        const tags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'button'];
        const resourceTags = ['img', 'link', 'script', 'iframe'];
        const allTags = [...tags, ...resourceTags];
        
        const tagName = allTags[Math.floor(Math.random() * allTags.length)];
        
        const attributes: Record<string, string> = {};
        
        // Add appropriate attributes based on tag
        if (tagName === 'img') {
          attributes.src = `image${i}.${Math.random() > 0.5 ? 'jpg' : 'png'}`;
          if (Math.random() > 0.3) {
            attributes.alt = `Image ${i}`;
          }
          if (Math.random() > 0.7) {
            attributes.loading = 'lazy';
          }
        } else if (tagName === 'link') {
          attributes.rel = 'stylesheet';
          attributes.href = `styles${i}.${Math.random() > 0.5 ? 'css' : 'min.css'}`;
        } else if (tagName === 'script') {
          if (Math.random() > 0.3) {
            attributes.src = `script${i}.${Math.random() > 0.5 ? 'js' : 'min.js'}`;
          }
          if (Math.random() > 0.6) {
            attributes.defer = 'true';
          }
          if (Math.random() > 0.8) {
            attributes.async = 'true';
          }
        } else if (tagName === 'iframe') {
          attributes.src = `iframe${i}.html`;
          if (Math.random() > 0.7) {
            attributes.loading = 'lazy';
          }
        }
        
        if (Math.random() > 0.5) {
          attributes.class = `class-${i}`;
        }
        
        return {
          tagName,
          attributes,
          parentTag: Math.random() > 0.5 ? 'body' : 'head',
          line: i + 1,
          column: Math.floor(Math.random() * 20) + 1
        };
      });
      
      return {
        elements,
        metadata: {
          title: `Test Page ${Math.random().toString(36).substring(7)}`
        }
      };
    }

    /**
     * Helper function to generate random CSS AST
     */
    function generateRandomCSSAST(): any {
      const ruleCount = Math.floor(Math.random() * 15) + 1;
      const rules = Array.from({ length: ruleCount }, () => {
        const selectorTypes = [`.class`, `#id`, `div`, `span`, `a:hover`];
        const selector = selectorTypes[Math.floor(Math.random() * selectorTypes.length)];
        
        const declarationCount = Math.floor(Math.random() * 5) + 1;
        const declarations = Array.from({ length: declarationCount }, (_j, j) => ({
          property: ['color', 'font-size', 'margin', 'padding', 'background-color'][j % 5],
          value: j % 2 === 0 ? 'red' : `${Math.floor(Math.random() * 50) + 10}px`,
          important: Math.random() > 0.8
        }));
        
        return {
          type: 'rule',
          selector,
          declarations
        };
      });
      
      const importCount = Math.floor(Math.random() * 3);
      const imports = Array.from({ length: importCount }, () => ({
        type: 'import',
        url: `import${Math.random().toString(36).substring(7)}.css`
      }));
      
      const allRules = [...imports, ...rules];
      
      const propertyCount = Math.floor(Math.random() * 20) + 1;
      const properties = Array.from({ length: propertyCount }, (_i, i) => ({
        property: ['color', 'font-size', 'margin', 'padding', 'background-color', 'border', 'display', 'width'][i % 8],
        value: i % 2 === 0 ? 'red' : `${Math.floor(Math.random() * 50) + 10}px`,
        important: Math.random() > 0.9
      }));
      
      return {
        rules: allRules,
        properties,
        validation: {
          isValid: true,
          ruleCount: allRules.length,
          propertyCount
        }
      };
    }

    /**
     * Helper function to generate random JavaScript AST
     */
    function generateRandomJavaScriptAST(): any {
      const functionCount = Math.floor(Math.random() * 8) + 1;
      const functions = Array.from({ length: functionCount }, (_i, i) => ({
        type: ['function', 'arrow', 'function-expression'][i % 3],
        name: `func${i}`,
        params: Array.from({ length: Math.floor(Math.random() * 5) }, (_j, j) => `param${j}`),
        async: Math.random() > 0.7,
        generator: Math.random() > 0.9
      }));
      
      const variableCount = Math.floor(Math.random() * 10) + 1;
      const variables = Array.from({ length: variableCount }, (_i, i) => ({
        name: `var${i}`,
        kind: ['const', 'let', 'var'][i % 3],
        hasInit: true
      }));
      
      const classCount = Math.floor(Math.random() * 3);
      const classes = Array.from({ length: classCount }, (_i, i) => ({
        name: `Class${i}`,
        superClass: null,
        methods: Math.floor(Math.random() * 5),
        properties: Math.floor(Math.random() * 3)
      }));
      
      const complexity = Math.floor(Math.random() * 40) + 1;
      const lineCount = Math.floor(Math.random() * 200) + 10;
      const statementCount = Math.floor(Math.random() * 100) + 5;
      
      return {
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
     * Test critical path calculation consistency
     */
    test('Critical path calculation is idempotent (random ASTs)', () => {
      // Test with 30 random HTML and CSS ASTs
      for (let i = 0; i < 30; i++) {
        const htmlAST = generateRandomHTMLAST();
        const cssASTs = new Map([
          ['styles1.css', generateRandomCSSAST()],
          ['styles2.css', generateRandomCSSAST()]
        ]);
        
        // Calculate critical path twice
        const result1 = analyzer.calculateCriticalPath(htmlAST, cssASTs);
        const result2 = analyzer.calculateCriticalPath(htmlAST, cssASTs);
        
        // Results should be identical
        expect(result1).toBe(result2);
        
        // Critical path should be non-negative
        expect(result1).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * Test load time estimation consistency
     */
    test('Load time estimation is idempotent (random ASTs)', () => {
      // Test with 30 random ASTs
      for (let i = 0; i < 30; i++) {
        const htmlAST = generateRandomHTMLAST();
        const cssASTs = new Map([
          ['styles.css', generateRandomCSSAST()],
          ['components.css', generateRandomCSSAST()]
        ]);
        const jsASTs = new Map([
          ['app.js', generateRandomJavaScriptAST()],
          ['utils.js', generateRandomJavaScriptAST()]
        ]);
        
        // Estimate load time twice
        const result1 = analyzer.estimateLoadTime(htmlAST, cssASTs, jsASTs);
        const result2 = analyzer.estimateLoadTime(htmlAST, cssASTs, jsASTs);
        
        // Results should be identical
        expect(result1).toBe(result2);
        
        // Load time should be non-negative
        expect(result1).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * Test unoptimized assets detection consistency
     */
    test('Unoptimized assets detection is idempotent (random ASTs)', () => {
      // Test with 30 random HTML ASTs
      for (let i = 0; i < 30; i++) {
        const htmlAST = generateRandomHTMLAST();
        
        // Find unoptimized assets twice
        const result1 = analyzer.findUnoptimizedAssets(htmlAST);
        const result2 = analyzer.findUnoptimizedAssets(htmlAST);
        
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
     * Test lazy loading opportunities detection consistency
     */
    test('Lazy loading opportunities detection is idempotent (random ASTs)', () => {
      // Test with 30 random HTML ASTs
      for (let i = 0; i < 30; i++) {
        const htmlAST = generateRandomHTMLAST();
        
        // Find lazy loading opportunities twice
        const result1 = analyzer.findLazyLoadingOpportunities(htmlAST);
        const result2 = analyzer.findLazyLoadingOpportunities(htmlAST);
        
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
     * Test recommendation generation consistency
     */
    test('Recommendation generation is idempotent (random findings)', () => {
      // Test with 30 random sets of findings
      for (let i = 0; i < 30; i++) {
        const findingCount = Math.floor(Math.random() * 15) + 1;
        const findings = Array.from({ length: findingCount }, (_j, j) => {
          const severities = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          const ruleTypes = ['PERF-LARGE-IMAGE', 'PERF-UNMINIFIED', 'PERF-MISSING-LAZYLOAD', 'PERF-BLOCKING-RESOURCE', 'PERF-LAZY-OPPORTUNITY'];
          const ruleId = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
          
          return {
            id: `finding-${i}-${j}`,
            severity,
            message: `${ruleId} issue ${j}`,
            location: { file: 'index.html', line: j + 1, column: 1 },
            codeSnippet: `Fix ${ruleId} issue`,
            ruleId
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
     * Test score calculation consistency
     */
    test('Score calculation is idempotent (random inputs)', () => {
      // Test with 50 random inputs
      for (let i = 0; i < 50; i++) {
        const findingCount = Math.floor(Math.random() * 20) + 1;
        const findings = Array.from({ length: findingCount }, (_j, j) => {
          const severities = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];
          const severity = severities[Math.floor(Math.random() * severities.length)];
          
          return {
            id: `finding-${i}-${j}`,
            severity,
            message: `Issue ${j}`,
            location: { file: 'index.html', line: j + 1, column: 1 },
            codeSnippet: `Fix issue`,
            ruleId: `PERF-TEST-${j}`
          };
        });
        
        const estimatedLoadTime = Math.floor(Math.random() * 5000); // 0-5 seconds
        
        // Calculate score twice
        const result1 = analyzer.calculateScore(findings, estimatedLoadTime);
        const result2 = analyzer.calculateScore(findings, estimatedLoadTime);
        
        // Scores should be identical
        expect(result1).toBe(result2);
        
        // Score should be between 0 and 100
        expect(result1).toBeGreaterThanOrEqual(0);
        expect(result1).toBeLessThanOrEqual(100);
      }
    });

    /**
     * Test performance metric patterns
     */
    describe('Performance metric patterns', () => {
      test('More resources should increase critical path length', () => {
        // Simple HTML with few resources
        const simpleHTML = {
          elements: [
            { tagName: 'link', attributes: { rel: 'stylesheet', href: 'styles.css' }, parentTag: 'head' },
            { tagName: 'img', attributes: { src: 'logo.png' }, parentTag: 'body' }
          ]
        };
        
        // Complex HTML with many resources
        const complexHTML = {
          elements: [
            { tagName: 'link', attributes: { rel: 'stylesheet', href: 'styles.css' }, parentTag: 'head' },
            { tagName: 'link', attributes: { rel: 'stylesheet', href: 'components.css' }, parentTag: 'head' },
            { tagName: 'script', attributes: { src: 'app.js' }, parentTag: 'head' },
            { tagName: 'img', attributes: { src: 'hero.jpg' }, parentTag: 'body' },
            { tagName: 'img', attributes: { src: 'banner.png' }, parentTag: 'body' },
            { tagName: 'img', attributes: { src: 'gallery1.jpg' }, parentTag: 'body' },
            { tagName: 'img', attributes: { src: 'gallery2.jpg' }, parentTag: 'body' }
          ]
        };
        
        const cssASTs = new Map([
          ['styles.css', { rules: Array(5).fill({}), properties: Array(10).fill({}) }],
          ['components.css', { rules: Array(10).fill({}), properties: Array(20).fill({}) }]
        ]);
        
        const simplePath = analyzer.calculateCriticalPath(simpleHTML, cssASTs);
        const complexPath = analyzer.calculateCriticalPath(complexHTML, cssASTs);
        
        // Complex HTML should have longer critical path
        expect(complexPath).toBeGreaterThan(simplePath);
      });

      test('More complex code should increase estimated load time', () => {
        const htmlAST = {
          elements: [
            { tagName: 'img', attributes: { src: 'image.jpg' } }
          ]
        };
        
        // Simple CSS and JS
        const simpleCSS = new Map([
          ['styles.css', { rules: Array(2).fill({}), properties: Array(5).fill({}) }]
        ]);
        const simpleJS = new Map([
          ['app.js', { 
            analysis: { functions: Array(2).fill({}), variables: Array(3).fill({}) },
            statistics: { lineCount: 50 }
          }]
        ]);
        
        // Complex CSS and JS
        const complexCSS = new Map([
          ['styles.css', { rules: Array(10).fill({}), properties: Array(30).fill({}) }],
          ['components.css', { rules: Array(15).fill({}), properties: Array(40).fill({}) }]
        ]);
        const complexJS = new Map([
          ['app.js', { 
            analysis: { functions: Array(10).fill({}), variables: Array(20).fill({}) },
            statistics: { lineCount: 500 }
          }],
          ['utils.js', { 
            analysis: { functions: Array(5).fill({}), variables: Array(10).fill({}) },
            statistics: { lineCount: 200 }
          }]
        ]);
        
        const simpleTime = analyzer.estimateLoadTime(htmlAST, simpleCSS, simpleJS);
        const complexTime = analyzer.estimateLoadTime(htmlAST, complexCSS, complexJS);
        
        // Complex code should have longer estimated load time
        expect(complexTime).toBeGreaterThan(simpleTime);
      });

      test('Score should decrease with more findings and longer load time', () => {
        const noFindings: any[] = [];
        const someFindings = [
          {
            id: 'test-1',
            severity: Severity.MEDIUM,
            message: 'Medium issue',
            location: { file: 'index.html', line: 1, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-MEDIUM'
          }
        ];
        const manyFindings = [
          {
            id: 'test-1',
            severity: Severity.CRITICAL,
            message: 'Critical issue',
            location: { file: 'index.html', line: 1, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-CRITICAL'
          },
          {
            id: 'test-2',
            severity: Severity.HIGH,
            message: 'High issue',
            location: { file: 'index.html', line: 2, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-HIGH'
          },
          {
            id: 'test-3',
            severity: Severity.MEDIUM,
            message: 'Medium issue',
            location: { file: 'index.html', line: 3, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-MEDIUM'
          }
        ];
        
        const fastLoadTime = 500; // 0.5 seconds
        const slowLoadTime = 3500; // 3.5 seconds
        
        const score1 = analyzer.calculateScore(noFindings, fastLoadTime);
        const score2 = analyzer.calculateScore(someFindings, fastLoadTime);
        const score3 = analyzer.calculateScore(manyFindings, fastLoadTime);
        const score4 = analyzer.calculateScore(manyFindings, slowLoadTime);
        
        // Score should decrease with more findings
        expect(score1).toBeGreaterThan(score2);
        expect(score2).toBeGreaterThan(score3);
        
        // Score should decrease with longer load time
        expect(score3).toBeGreaterThan(score4);
      });
    });

    /**
     * Test edge cases
     */
    describe('Edge cases', () => {
      test('Empty inputs produce consistent results', () => {
        const emptyHTML = { elements: [] };
        const emptyCSS = new Map();
        const emptyJS = new Map();
        
        // Critical path
        const path1 = analyzer.calculateCriticalPath(emptyHTML, emptyCSS);
        const path2 = analyzer.calculateCriticalPath(emptyHTML, emptyCSS);
        expect(path1).toBe(path2);
        
        // Load time
        const time1 = analyzer.estimateLoadTime(emptyHTML, emptyCSS, emptyJS);
        const time2 = analyzer.estimateLoadTime(emptyHTML, emptyCSS, emptyJS);
        expect(time1).toBe(time2);
        
        // Unoptimized assets
        const assets1 = analyzer.findUnoptimizedAssets(emptyHTML);
        const assets2 = analyzer.findUnoptimizedAssets(emptyHTML);
        expect(assets1).toEqual(assets2);
        
        // Lazy loading opportunities
        const lazy1 = analyzer.findLazyLoadingOpportunities(emptyHTML);
        const lazy2 = analyzer.findLazyLoadingOpportunities(emptyHTML);
        expect(lazy1).toEqual(lazy2);
      });

      test('Score calculation boundary conditions', () => {
        // Test with no findings and fast load time (should be 100)
        const noFindings: any[] = [];
        expect(analyzer.calculateScore(noFindings, 100)).toBe(100);
        
        // Test with many critical findings and slow load time (should be 0)
        const criticalFindings = Array(20).fill({
          id: 'critical',
          severity: Severity.CRITICAL,
          message: 'Critical issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Fix',
          ruleId: 'PERF-CRITICAL'
        });
        expect(analyzer.calculateScore(criticalFindings, 5000)).toBe(0);
        
        // Test with mixed inputs
        const mixedFindings = [
          {
            id: 'test-1',
            severity: Severity.HIGH,
            message: 'High issue',
            location: { file: 'index.html', line: 1, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-HIGH'
          },
          {
            id: 'test-2',
            severity: Severity.LOW,
            message: 'Low issue',
            location: { file: 'index.html', line: 2, column: 1 },
            codeSnippet: 'Fix',
            ruleId: 'PERF-LOW'
          }
        ];
        const score = analyzer.calculateScore(mixedFindings, 1500);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        
        // Calculate twice should be same
        expect(analyzer.calculateScore(mixedFindings, 1500)).toBe(score);
      });
    });
  });
});