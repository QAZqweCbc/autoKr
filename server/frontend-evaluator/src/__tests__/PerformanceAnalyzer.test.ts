/**
 * Tests for PerformanceAnalyzer component
 */

import { PerformanceAnalyzer } from '../analyzers/PerformanceAnalyzer';
import { Severity } from '../types';

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  test('should create instance', () => {
    expect(analyzer).toBeInstanceOf(PerformanceAnalyzer);
  });

  describe('Critical path calculation', () => {
    test('should calculate critical path length', () => {
      const htmlAST = {
        elements: [
          { tagName: 'link', attributes: { rel: 'stylesheet', href: 'styles.css' }, parentTag: 'head' },
          { tagName: 'script', attributes: { src: 'app.js' }, parentTag: 'head' },
          { tagName: 'img', attributes: { src: 'logo.png', alt: 'Logo' }, parentTag: 'body' }
        ]
      };

      const cssASTs = new Map([
        ['styles.css', { rules: [{ type: 'rule' }, { type: 'rule' }], properties: [] }]
      ]);

      const criticalPath = analyzer.calculateCriticalPath(htmlAST, cssASTs);
      
      expect(criticalPath).toBeGreaterThan(0);
      expect(typeof criticalPath).toBe('number');
    });

    test('should handle empty HTML AST', () => {
      const htmlAST = { elements: [] };
      const cssASTs = new Map();
      
      const criticalPath = analyzer.calculateCriticalPath(htmlAST, cssASTs);
      
      expect(criticalPath).toBe(2); // Base overhead
    });
  });

  describe('Unoptimized assets detection', () => {
    test('should detect large images', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'large-banner.jpg', alt: 'Banner' }, line: 10, column: 5 },
          { tagName: 'img', attributes: { src: 'icon.png', alt: 'Icon' }, line: 15, column: 8 }
        ]
      };

      const findings = analyzer.findUnoptimizedAssets(htmlAST);
      
      const largeImageFinding = findings.find(f => f.message.includes('large-banner.jpg'));
      expect(largeImageFinding).toBeDefined();
      expect(largeImageFinding?.severity).toBe(Severity.MEDIUM);
      expect(largeImageFinding?.ruleId).toBe('PERF-LARGE-IMAGE');
    });

    test('should detect unminified resources', () => {
      const htmlAST = {
        elements: [
          { tagName: 'link', attributes: { rel: 'stylesheet', href: 'styles.css' }, line: 5, column: 3 },
          { tagName: 'script', attributes: { src: 'app.js' }, line: 20, column: 7 },
          { tagName: 'link', attributes: { rel: 'stylesheet', href: 'styles.min.css' }, line: 25, column: 3 }
        ]
      };

      const findings = analyzer.findUnoptimizedAssets(htmlAST);
      
      const unminifiedCSS = findings.find(f => f.message.includes('styles.css') && f.ruleId === 'PERF-UNMINIFIED');
      const unminifiedJS = findings.find(f => f.message.includes('app.js') && f.ruleId === 'PERF-UNMINIFIED');
      
      expect(unminifiedCSS).toBeDefined();
      expect(unminifiedJS).toBeDefined();
      expect(unminifiedCSS?.severity).toBe(Severity.LOW);
      expect(unminifiedJS?.severity).toBe(Severity.LOW);
    });

    test('should detect missing lazy loading', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image1.jpg', alt: 'Image 1' }, line: 30, column: 10 },
          { tagName: 'img', attributes: { src: 'image2.jpg', alt: 'Image 2', loading: 'lazy' }, line: 35, column: 10 }
        ]
      };

      const findings = analyzer.findUnoptimizedAssets(htmlAST);
      
      const missingLazyLoad = findings.find(f => f.message.includes('image1.jpg') && f.ruleId === 'PERF-MISSING-LAZYLOAD');
      expect(missingLazyLoad).toBeDefined();
      expect(missingLazyLoad?.severity).toBe(Severity.LOW);
    });

    test('should detect blocking resources', () => {
      const htmlAST = {
        elements: [
          { tagName: 'script', attributes: { src: 'blocking.js' }, parentTag: 'head', line: 3, column: 5 },
          { tagName: 'link', attributes: { rel: 'stylesheet', href: 'blocking.css' }, parentTag: 'head', line: 4, column: 5 },
          { tagName: 'script', attributes: { src: 'deferred.js', defer: true }, parentTag: 'head', line: 5, column: 5 }
        ]
      };

      const findings = analyzer.findUnoptimizedAssets(htmlAST);
      
      const blockingJS = findings.find(f => f.message.includes('blocking.js') && f.ruleId === 'PERF-BLOCKING-RESOURCE');
      const blockingCSS = findings.find(f => f.message.includes('blocking.css') && f.ruleId === 'PERF-BLOCKING-RESOURCE');
      
      expect(blockingJS).toBeDefined();
      expect(blockingCSS).toBeDefined();
      expect(blockingJS?.severity).toBe(Severity.MEDIUM);
      expect(blockingCSS?.severity).toBe(Severity.MEDIUM);
    });
  });

  describe('Load time estimation', () => {
    test('should estimate load time', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image1.jpg' } },
          { tagName: 'img', attributes: { src: 'image2.jpg' } }
        ]
      };

      const cssASTs = new Map([
        ['styles.css', { rules: Array(10).fill({}), properties: Array(20).fill({}) }]
      ]);

      const jsASTs = new Map([
        ['app.js', { 
          analysis: { functions: Array(5).fill({}), variables: Array(10).fill({}) },
          statistics: { lineCount: 100 }
        }]
      ]);

      const loadTime = analyzer.estimateLoadTime(htmlAST, cssASTs, jsASTs);
      
      expect(loadTime).toBeGreaterThan(0);
      expect(typeof loadTime).toBe('number');
    });

    test('should handle empty inputs', () => {
      const htmlAST = { elements: [] };
      const cssASTs = new Map();
      const jsASTs = new Map();

      const loadTime = analyzer.estimateLoadTime(htmlAST, cssASTs, jsASTs);
      
      expect(loadTime).toBeGreaterThan(0); // Should still have base time
    });
  });

  describe('Lazy loading opportunities', () => {
    test('should find lazy loading opportunities for images', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'above1.jpg', alt: 'Above 1' }, line: 10, column: 5 },
          { tagName: 'img', attributes: { src: 'above2.jpg', alt: 'Above 2' }, line: 15, column: 5 },
          { tagName: 'img', attributes: { src: 'above3.jpg', alt: 'Above 3' }, line: 20, column: 5 },
          { tagName: 'img', attributes: { src: 'below1.jpg', alt: 'Below 1' }, line: 100, column: 5 },
          { tagName: 'img', attributes: { src: 'below2.jpg', alt: 'Below 2', loading: 'lazy' }, line: 105, column: 5 }
        ]
      };

      const findings = analyzer.findLazyLoadingOpportunities(htmlAST);
      
      const lazyOpportunity = findings.find(f => 
        f.message.includes('below1.jpg') && f.ruleId === 'PERF-LAZY-OPPORTUNITY'
      );
      expect(lazyOpportunity).toBeDefined();
      expect(lazyOpportunity?.severity).toBe(Severity.LOW);
    });

    test('should find lazy loading opportunities for iframes', () => {
      const htmlAST = {
        elements: [
          { tagName: 'iframe', attributes: { src: 'video.html' }, line: 50, column: 10 },
          { tagName: 'iframe', attributes: { src: 'map.html', loading: 'lazy' }, line: 60, column: 10 }
        ]
      };

      const findings = analyzer.findLazyLoadingOpportunities(htmlAST);
      
      const iframeOpportunity = findings.find(f => 
        f.message.includes('iframe') && f.ruleId === 'PERF-IFRAME-LAZY'
      );
      expect(iframeOpportunity).toBeDefined();
      expect(iframeOpportunity?.severity).toBe(Severity.LOW);
    });

    test('should find scripts that can be deferred', () => {
      const htmlAST = {
        elements: [
          { tagName: 'script', attributes: { src: 'blocking.js' }, line: 70, column: 5 },
          { tagName: 'script', attributes: { src: 'deferred.js', defer: true }, line: 75, column: 5 },
          { tagName: 'script', line: 80, column: 5 } // Inline script
        ]
      };

      const findings = analyzer.findLazyLoadingOpportunities(htmlAST);
      
      const scriptDefer = findings.find(f => 
        f.message.includes('blocking.js') && f.ruleId === 'PERF-SCRIPT-DEFER'
      );
      expect(scriptDefer).toBeDefined();
      expect(scriptDefer?.severity).toBe(Severity.MEDIUM);
    });
  });

  describe('Recommendation generation', () => {
    test('should generate recommendations from findings', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.MEDIUM,
          message: 'Large image detected',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: '<img src="large.jpg">',
          ruleId: 'PERF-LARGE-IMAGE'
        },
        {
          id: 'test-2',
          severity: Severity.LOW,
          message: 'Unminified resource',
          location: { file: 'index.html', line: 2, column: 1 },
          codeSnippet: '<link rel="stylesheet" href="styles.css">',
          ruleId: 'PERF-UNMINIFIED'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].description).toContain('images');
      expect(recommendations[1].description).toContain('resource');
      expect(recommendations[0].implementationSteps.length).toBeGreaterThan(0);
    });

    test('should prioritize recommendations based on severity', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.CRITICAL,
          message: 'Critical performance issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Critical issue',
          ruleId: 'PERF-CRITICAL'
        },
        {
          id: 'test-2',
          severity: Severity.INFO,
          message: 'Informational finding',
          location: { file: 'index.html', line: 2, column: 1 },
          codeSnippet: 'Info',
          ruleId: 'PERF-INFO'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      // Critical findings should result in HIGH priority recommendations
      const criticalRecommendation = recommendations.find(r => r.description.includes('critical rendering path'));
      expect(criticalRecommendation?.priority).toBe('HIGH');
    });
  });

  describe('Score calculation', () => {
    test('should calculate score based on findings and load time', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.HIGH,
          message: 'High severity issue',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Fix issue',
          ruleId: 'PERF-HIGH'
        },
        {
          id: 'test-2',
          severity: Severity.MEDIUM,
          message: 'Medium severity issue',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Fix issue',
          ruleId: 'PERF-MEDIUM'
        }
      ];

      const loadTime = 2500; // 2.5 seconds
      const score = analyzer.calculateScore(findings, loadTime);
      
      // Starting score: 100
      // HIGH: -8, MEDIUM: -4 = -12
      // Load time > 2000ms: -10
      // Total: 100 - 12 - 10 = 78
      expect(score).toBe(78);
    });

    test('should not go below 0', () => {
      const findings = Array(20).fill({
        id: 'test',
        severity: Severity.CRITICAL,
        message: 'Critical issue',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Fix issue',
        ruleId: 'PERF-CRITICAL'
      });

      const loadTime = 5000; // 5 seconds
      const score = analyzer.calculateScore(findings, loadTime);
      
      // Should be capped at 0
      expect(score).toBe(0);
    });

    test('should not exceed 100', () => {
      const findings: any[] = [];
      const loadTime = 500; // 0.5 seconds

      const score = analyzer.calculateScore(findings, loadTime);
      
      expect(score).toBe(100);
    });
  });
});