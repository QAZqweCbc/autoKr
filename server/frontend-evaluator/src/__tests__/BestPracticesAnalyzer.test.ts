/**
 * Unit tests for BestPracticesAnalyzer
 */

import { BestPracticesAnalyzer } from '../analyzers/BestPracticesAnalyzer';
import { Severity, Priority } from '../types';

describe('BestPracticesAnalyzer', () => {
  let analyzer: BestPracticesAnalyzer;

  beforeEach(() => {
    analyzer = new BestPracticesAnalyzer();
  });

  describe('checkResponsiveDesign', () => {
    it('should detect missing viewport meta tag', () => {
      const htmlAST = {
        elements: [
          { tagName: 'html', attributes: {} },
          { tagName: 'head', attributes: {} },
          { tagName: 'body', attributes: {} }
        ]
      };
      const cssAST = { properties: [] };

      const findings = analyzer.checkResponsiveDesign(htmlAST, cssAST);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.ruleId === 'BP-VIEWPORT-MISSING')).toBe(true);
      expect(findings.find(f => f.ruleId === 'BP-VIEWPORT-MISSING')?.severity).toBe(Severity.CRITICAL);
    });

    it('should detect viewport meta tag with correct attributes', () => {
      const htmlAST = {
        elements: [
          {
            tagName: 'meta',
            attributes: {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1.0'
            }
          }
        ]
      };
      const cssAST = { properties: [] };

      const findings = analyzer.checkResponsiveDesign(htmlAST, cssAST);

      expect(findings.every(f => f.ruleId !== 'BP-VIEWPORT-MISSING')).toBe(true);
    });

    it('should detect missing media queries', () => {
      const htmlAST = {
        elements: [
          {
            tagName: 'meta',
            attributes: {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1.0'
            }
          }
        ]
      };
      const cssAST = { properties: [] };

      const findings = analyzer.checkResponsiveDesign(htmlAST, cssAST);

      expect(findings.some(f => f.ruleId === 'BP-MEDIA-QUERY-MISSING')).toBe(true);
    });

    it('should detect flexible layout systems', () => {
      const htmlAST = {
        elements: [
          {
            tagName: 'meta',
            attributes: {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1.0'
            }
          }
        ]
      };
      const cssAST = {
        properties: [
          { property: 'display', value: 'flex' },
          { type: 'media-query', mediaQuery: 'min-width: 768px' }
        ]
      };

      const findings = analyzer.checkResponsiveDesign(htmlAST, cssAST);

      expect(findings.every(f => f.ruleId !== 'BP-LAYOUT-FLEXIBLE')).toBe(true);
    });
  });

  describe('checkMobileFirstApproach', () => {
    it('should detect desktop-first approach', () => {
      const cssAST = {
        properties: [
          { type: 'media-query', mediaQuery: 'max-width: 768px' },
          { type: 'media-query', mediaQuery: 'max-width: 1024px' }
        ]
      };

      const findings = analyzer.checkMobileFirstApproach(cssAST);

      expect(findings.some(f => f.ruleId === 'BP-MOBILE-FIRST-APPROACH')).toBe(true);
    });

    it('should detect mobile-first approach', () => {
      const cssAST = {
        properties: [
          { property: 'color', value: 'blue' },
          { type: 'media-query', mediaQuery: 'min-width: 768px' },
          { type: 'media-query', mediaQuery: 'min-width: 1024px' }
        ]
      };

      const findings = analyzer.checkMobileFirstApproach(cssAST);

      expect(findings.some(f => f.ruleId === 'BP-MOBILE-FIRST-GOOD')).toBe(true);
    });

    it('should detect missing relative units', () => {
      const cssAST = {
        properties: [
          { property: 'width', value: '100px' },
          { property: 'height', value: '200px' },
          { type: 'media-query', mediaQuery: 'min-width: 768px' }
        ]
      };

      const findings = analyzer.checkMobileFirstApproach(cssAST);

      expect(findings.some(f => f.ruleId === 'BP-RELATIVE-UNITS')).toBe(true);
    });
  });

  describe('checkSEOMetaTags', () => {
    it('should detect missing title tag', () => {
      const htmlAST = {
        elements: [
          { tagName: 'html', attributes: {} },
          { tagName: 'head', attributes: {} }
        ]
      };

      const findings = analyzer.checkSEOMetaTags(htmlAST);

      expect(findings.some(f => f.ruleId === 'BP-SEO-TITLE-MISSING')).toBe(true);
      expect(findings.find(f => f.ruleId === 'BP-SEO-TITLE-MISSING')?.severity).toBe(Severity.CRITICAL);
    });

    it('should detect missing meta description', () => {
      const htmlAST = {
        elements: [
          { tagName: 'title', text: 'My Page Title' }
        ]
      };

      const findings = analyzer.checkSEOMetaTags(htmlAST);

      expect(findings.some(f => f.ruleId === 'BP-SEO-DESC-MISSING')).toBe(true);
    });

    it('should detect title length issues', () => {
      const htmlAST = {
        elements: [
          { tagName: 'title', text: 'Short' }
        ]
      };

      const findings = analyzer.checkSEOMetaTags(htmlAST);

      expect(findings.some(f => f.ruleId === 'BP-SEO-TITLE-SHORT')).toBe(true);
    });

    it('should detect missing Open Graph tags', () => {
      const htmlAST = {
        elements: [
          { tagName: 'title', text: 'My Page Title That Is Long Enough' },
          {
            tagName: 'meta',
            attributes: {
              name: 'description',
              content: 'This is a description that is long enough to meet the minimum requirements for SEO purposes and should not trigger any warnings about length.'
            }
          }
        ]
      };

      const findings = analyzer.checkSEOMetaTags(htmlAST);

      expect(findings.some(f => f.ruleId === 'BP-SEO-OG-MISSING')).toBe(true);
    });

    it('should detect missing canonical URL', () => {
      const htmlAST = {
        elements: [
          { tagName: 'title', text: 'My Page Title That Is Long Enough' }
        ]
      };

      const findings = analyzer.checkSEOMetaTags(htmlAST);

      expect(findings.some(f => f.ruleId === 'BP-SEO-CANONICAL-MISSING')).toBe(true);
    });
  });

  describe('checkFrameworkBestPractices', () => {
    it('should check React PropTypes', () => {
      const htmlAST = { elements: [] };
      const cssAST = { properties: [] };
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ClassDeclaration',
              superClass: {
                type: 'MemberExpression',
                property: { name: 'Component' }
              },
              body: {
                body: []
              }
            }
          ]
        }
      };

      const findings = analyzer.checkFrameworkBestPractices(htmlAST, cssAST, jsAST, 'react');

      expect(findings.some(f => f.ruleId === 'BP-REACT-PROPTYPES')).toBe(true);
    });

    it('should return empty findings for unknown framework', () => {
      const htmlAST = { elements: [] };
      const cssAST = { properties: [] };
      const jsAST = { ast: {} };

      const findings = analyzer.checkFrameworkBestPractices(htmlAST, cssAST, jsAST, 'none');

      expect(findings.length).toBe(0);
    });
  });

  describe('identifyAntiPatterns', () => {
    it('should detect inline styles', () => {
      const htmlAST = {
        elements: [
          {
            tagName: 'div',
            attributes: {
              style: 'color: red; font-size: 16px;'
            }
          }
        ]
      };
      const cssAST = { properties: [] };
      const jsAST = { ast: {} };

      const findings = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);

      expect(findings.some(f => f.ruleId === 'BP-ANTI-INLINE-STYLE')).toBe(true);
    });

    it('should detect inline event handlers', () => {
      const htmlAST = {
        elements: [
          {
            tagName: 'button',
            attributes: {
              onclick: 'handleClick()'
            }
          }
        ]
      };
      const cssAST = { properties: [] };
      const jsAST = { ast: {} };

      const findings = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);

      expect(findings.some(f => f.ruleId === 'BP-ANTI-INLINE-EVENT')).toBe(true);
    });

    it('should detect !important usage', () => {
      const htmlAST = { elements: [] };
      const cssAST = {
        properties: [
          { property: 'color', value: 'red !important' },
          { property: 'font-size', value: '16px !important' }
        ]
      };
      const jsAST = { ast: {} };

      const findings = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);

      expect(findings.some(f => f.ruleId === 'BP-ANTI-IMPORTANT')).toBe(true);
    });

    it('should detect global variables', () => {
      const htmlAST = { elements: [] };
      const cssAST = { properties: [] };
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'VariableDeclaration',
              kind: 'var',
              declarations: []
            }
          ]
        }
      };

      const findings = analyzer.identifyAntiPatterns(htmlAST, cssAST, jsAST);

      expect(findings.some(f => f.ruleId === 'BP-ANTI-GLOBAL-VAR')).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate responsive design recommendations', () => {
      const findings = [
        {
          id: 'BP-RES-1',
          severity: Severity.CRITICAL,
          message: 'Missing viewport meta tag',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-VIEWPORT-MISSING'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.description.includes('responsive'))).toBe(true);
      expect(recommendations[0].priority).toBe(Priority.HIGH);
    });

    it('should generate SEO recommendations', () => {
      const findings = [
        {
          id: 'BP-SEO-1',
          severity: Severity.HIGH,
          message: 'Missing meta description',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-SEO-DESC-MISSING'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.description.includes('SEO'))).toBe(true);
    });

    it('should generate anti-pattern recommendations', () => {
      const findings = [
        {
          id: 'BP-AP-1',
          severity: Severity.MEDIUM,
          message: 'Inline styles detected',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-ANTI-INLINE-STYLE'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.description.includes('anti-pattern'))).toBe(true);
    });
  });

  describe('calculateScore', () => {
    it('should calculate score based on findings severity', () => {
      const findings = [
        {
          id: 'BP-1',
          severity: Severity.CRITICAL,
          message: 'Critical issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-CRITICAL'
        },
        {
          id: 'BP-2',
          severity: Severity.HIGH,
          message: 'High issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-HIGH'
        },
        {
          id: 'BP-3',
          severity: Severity.MEDIUM,
          message: 'Medium issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '',
          ruleId: 'BP-MEDIUM'
        }
      ];

      const score = analyzer.calculateScore(findings);

      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBe(82); // 100 - 10 (critical) - 5 (high) - 3 (medium)
    });

    it('should return 100 for no findings', () => {
      const findings: any[] = [];

      const score = analyzer.calculateScore(findings);

      expect(score).toBe(100);
    });

    it('should not go below 0', () => {
      const findings = Array(50).fill({
        id: 'BP-1',
        severity: Severity.CRITICAL,
        message: 'Critical issue',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '',
        ruleId: 'BP-CRITICAL'
      });

      const score = analyzer.calculateScore(findings);

      expect(score).toBe(0);
    });
  });
});
