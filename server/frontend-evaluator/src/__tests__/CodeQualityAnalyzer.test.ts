/**
 * Tests for CodeQualityAnalyzer component
 */

import { CodeQualityAnalyzer } from '../analyzers/CodeQualityAnalyzer';
import { Severity } from '../types';

describe('CodeQualityAnalyzer', () => {
  let analyzer: CodeQualityAnalyzer;

  beforeEach(() => {
    analyzer = new CodeQualityAnalyzer();
  });

  test('should create instance', () => {
    expect(analyzer).toBeInstanceOf(CodeQualityAnalyzer);
  });

  describe('HTML structure analysis', () => {
    test('should detect missing HTML doctype', () => {
      const htmlAST = {
        doctype: null,
        elements: [
          { tagName: 'html', attributes: {}, parentTag: 'root', depth: 1 },
          { tagName: 'body', attributes: {}, parentTag: 'html', depth: 2 }
        ]
      };

      const findings = analyzer.analyzeHTMLStructure(htmlAST, 'test.html');
      
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe(Severity.MEDIUM);
      expect(findings[0].message).toContain('doctype');
    });

    test('should detect low semantic HTML usage', () => {
      const htmlAST = {
        doctype: 'html',
        elements: [
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'div', attributes: {}, parentTag: 'body', depth: 2, isSemantic: false },
          { tagName: 'header', attributes: {}, parentTag: 'body', depth: 2, isSemantic: true }
        ]
      };

      const findings = analyzer.analyzeHTMLStructure(htmlAST, 'test.html');
      
      const semanticFinding = findings.find(f => f.message.includes('semantic'));
      expect(semanticFinding).toBeDefined();
      expect(semanticFinding?.severity).toBe(Severity.LOW);
    });

    test('should detect missing required attributes', () => {
      const htmlAST = {
        doctype: 'html',
        elements: [
          { 
            tagName: 'img', 
            attributes: { src: 'image.jpg' }, // Missing alt
            parentTag: 'body', 
            depth: 2 
          },
          { 
            tagName: 'a', 
            attributes: {}, // Missing href
            parentTag: 'body', 
            depth: 2 
          }
        ]
      };

      const findings = analyzer.analyzeHTMLStructure(htmlAST, 'test.html');
      
      const imgFinding = findings.find(f => f.message.includes('alt'));
      const aFinding = findings.find(f => f.message.includes('href'));
      
      expect(imgFinding).toBeDefined();
      expect(aFinding).toBeDefined();
      expect(imgFinding?.severity).toBe(Severity.MEDIUM);
      expect(aFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect deprecated elements', () => {
      const htmlAST = {
        doctype: 'html',
        elements: [
          { tagName: 'font', attributes: {}, parentTag: 'body', depth: 2 },
          { tagName: 'center', attributes: {}, parentTag: 'body', depth: 2 }
        ]
      };

      const findings = analyzer.analyzeHTMLStructure(htmlAST, 'test.html');
      
      // The analyzer should find deprecated elements
      // Note: The checkDeprecatedElements method looks for specific deprecated tags
      const deprecatedFindings = findings.filter(f => 
        f.message.includes('deprecated') || f.message.includes('font') || f.message.includes('center')
      );
      expect(deprecatedFindings.length).toBeGreaterThan(0);
      if (deprecatedFindings.length > 0) {
        expect(deprecatedFindings[0].severity).toBe(Severity.HIGH);
      }
    });
  });

  describe('CSS quality analysis', () => {
    test('should detect high specificity selectors', () => {
      const cssAST = {
        selectors: [
          { selector: '#header .nav .item.active', specificity: 121, complexity: 4 },
          { selector: '.container', specificity: 10, complexity: 1 }
        ],
        rules: [],
        properties: []
      };

      const findings = analyzer.analyzeCSSQuality(cssAST, 'styles.css');
      
      const specificityFinding = findings.find(f => f.message.includes('specificity'));
      expect(specificityFinding).toBeDefined();
      expect(specificityFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect duplicate CSS rules', () => {
      const cssAST = {
        selectors: [],
        rules: [
          { selector: '.container', declarations: [{ property: 'color', value: 'red' }] },
          { selector: '.container', declarations: [{ property: 'color', value: 'red' }] }
        ],
        properties: []
      };

      const findings = analyzer.analyzeCSSQuality(cssAST, 'styles.css');
      
      const duplicateFinding = findings.find(f => f.message.includes('duplicate'));
      expect(duplicateFinding).toBeDefined();
      expect(duplicateFinding?.severity).toBe(Severity.LOW);
    });

    test('should detect inefficient selectors', () => {
      const cssAST = {
        selectors: [
          { selector: 'div > ul > li > a > span', complexity: 6 },
          { selector: '.item', complexity: 1 }
        ],
        rules: [],
        properties: []
      };

      const findings = analyzer.analyzeCSSQuality(cssAST, 'styles.css');
      
      const inefficientFinding = findings.find(f => f.message.includes('inefficient'));
      expect(inefficientFinding).toBeDefined();
      expect(inefficientFinding?.severity).toBe(Severity.LOW);
    });

    test('should detect excessive !important usage', () => {
      const cssAST = {
        selectors: [],
        rules: [],
        properties: [
          { property: 'color', value: 'red', important: true },
          { property: 'font-size', value: '16px', important: true },
          { property: 'margin', value: '0', important: true },
          { property: 'padding', value: '10px', important: true },
          { property: 'background', value: 'white', important: false }
        ]
      };

      const findings = analyzer.analyzeCSSQuality(cssAST, 'styles.css');
      
      const importantFinding = findings.find(f => f.message.includes('!important'));
      expect(importantFinding).toBeDefined();
      expect(importantFinding?.severity).toBe(Severity.MEDIUM);
    });
  });

  describe('JavaScript quality analysis', () => {
    test('should detect high cyclomatic complexity', () => {
      const jsAST = {
        analysis: {
          functions: [
            { type: 'function', name: 'complexFunction', params: ['a', 'b', 'c', 'd', 'e', 'f'] }
          ]
        },
        statistics: {
          complexity: 25,
          functionCount: 1,
          variableCount: 0,
          importCount: 0,
          exportCount: 0,
          classCount: 0,
          callCount: 0,
          lineCount: 50,
          statementCount: 20
        }
      };

      const findings = analyzer.analyzeJavaScriptQuality(jsAST, 'app.js');
      
      const complexityFinding = findings.find(f => f.message.includes('complexity'));
      expect(complexityFinding).toBeDefined();
      expect(complexityFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect functions with many parameters', () => {
      const jsAST = {
        analysis: {
          functions: [
            { type: 'function', name: 'tooManyParams', params: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
          ]
        },
        statistics: {
          complexity: 5,
          functionCount: 1,
          variableCount: 0,
          importCount: 0,
          exportCount: 0,
          classCount: 0,
          callCount: 0,
          lineCount: 10,
          statementCount: 5
        }
      };

      const findings = analyzer.analyzeJavaScriptQuality(jsAST, 'app.js');
      
      const longFuncFinding = findings.find(f => f.message.includes('parameters'));
      expect(longFuncFinding).toBeDefined();
      expect(longFuncFinding?.severity).toBe(Severity.LOW);
    });

    test('should detect potential memory leaks', () => {
      const jsAST = {
        analysis: {},
        statistics: {
          complexity: 1,
          functionCount: 0,
          variableCount: 0,
          importCount: 0,
          exportCount: 0,
          classCount: 0,
          callCount: 0,
          lineCount: 5,
          statementCount: 2
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
        }
      };

      const findings = analyzer.analyzeJavaScriptQuality(jsAST, 'app.js');
      
      const memoryFinding = findings.find(f => f.message.includes('memory'));
      expect(memoryFinding).toBeDefined();
      expect(memoryFinding?.severity).toBe(Severity.MEDIUM);
    });
  });

  describe('Recommendation generation', () => {
    test('should generate recommendations from findings', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.MEDIUM,
          message: 'Missing HTML doctype',
          location: { file: 'test.html', line: 1, column: 1 },
          codeSnippet: 'Add <!DOCTYPE html>',
          ruleId: 'CQ-HTML-DOCTYPE'
        },
        {
          id: 'test-2',
          severity: Severity.LOW,
          message: 'High CSS specificity',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Reduce selector specificity',
          ruleId: 'CQ-CSS-SPECIFICITY'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].description).toContain('HTML');
      expect(recommendations[1].description).toContain('CSS');
      expect(recommendations[0].implementationSteps.length).toBeGreaterThan(0);
    });

    test('should prioritize recommendations based on severity', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.CRITICAL,
          message: 'Critical security issue',
          location: { file: 'app.js', line: 1, column: 1 },
          codeSnippet: 'Fix security issue',
          ruleId: 'CQ-JS-SECURITY'
        },
        {
          id: 'test-2',
          severity: Severity.INFO,
          message: 'Informational finding',
          location: { file: 'test.html', line: 1, column: 1 },
          codeSnippet: 'Consider improvement',
          ruleId: 'CQ-HTML-INFO'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      // Critical findings should result in HIGH priority recommendations
      // Note: The getPriorityForFindings method checks if any finding has CRITICAL or HIGH severity
      // Since we have a CRITICAL finding, priority should be HIGH
      const jsRecommendation = recommendations.find(r => r.description.includes('JavaScript'));
      expect(jsRecommendation?.priority).toBe('HIGH');
    });
  });

  describe('Score calculation', () => {
    test('should calculate score based on findings', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.HIGH,
          message: 'High severity issue',
          location: { file: 'test.html', line: 1, column: 1 },
          codeSnippet: 'Fix issue',
          ruleId: 'CQ-HTML-HIGH'
        },
        {
          id: 'test-2',
          severity: Severity.MEDIUM,
          message: 'Medium severity issue',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Fix issue',
          ruleId: 'CQ-CSS-MEDIUM'
        },
        {
          id: 'test-3',
          severity: Severity.LOW,
          message: 'Low severity issue',
          location: { file: 'app.js', line: 1, column: 1 },
          codeSnippet: 'Fix issue',
          ruleId: 'CQ-JS-LOW'
        }
      ];

      const score = analyzer.calculateScore(findings);
      
      // Starting score: 100
      // HIGH: -5, MEDIUM: -3, LOW: -1 = -9 total
      // Expected score: 91
      expect(score).toBe(91);
    });

    test('should not go below 0', () => {
      const findings = Array(30).fill({
        id: 'test',
        severity: Severity.CRITICAL,
        message: 'Critical issue',
        location: { file: 'test.html', line: 1, column: 1 },
        codeSnippet: 'Fix issue',
        ruleId: 'CQ-HTML-CRITICAL'
      });

      const score = analyzer.calculateScore(findings);
      
      // 30 critical findings * 10 = 300 points deducted
      // Should be capped at 0
      expect(score).toBe(0);
    });

    test('should not exceed 100', () => {
      const findings: any[] = [];

      const score = analyzer.calculateScore(findings);
      
      expect(score).toBe(100);
    });
  });
});