/**
 * Unit Tests for AccessibilityAnalyzer component
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { AccessibilityAnalyzer } from '../analyzers/AccessibilityAnalyzer';
import { Severity, Priority } from '../types';

describe('AccessibilityAnalyzer', () => {
  let analyzer: AccessibilityAnalyzer;

  beforeEach(() => {
    analyzer = new AccessibilityAnalyzer();
  });

  test('should create instance', () => {
    expect(analyzer).toBeInstanceOf(AccessibilityAnalyzer);
  });

  describe('checkSemanticStructure', () => {
    test('should detect missing main landmark', () => {
      const htmlAST = {
        elements: [
          { tagName: 'div', attributes: {} },
          { tagName: 'header', attributes: {} }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const mainFinding = findings.find(f => f.ruleId === 'A11Y-SEM-MAIN');
      expect(mainFinding).toBeDefined();
      expect(mainFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect missing nav landmark', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'div', attributes: {} }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const navFinding = findings.find(f => f.ruleId === 'A11Y-SEM-NAV');
      expect(navFinding).toBeDefined();
      expect(navFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect interactive div without role', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'nav', attributes: {} },
          { tagName: 'div', attributes: { onclick: 'handleClick()' } }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const roleFinding = findings.find(f => f.ruleId === 'A11Y-ARIA-ROLE');
      expect(roleFinding).toBeDefined();
      expect(roleFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect form input without label', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'nav', attributes: {} },
          { tagName: 'input', attributes: { type: 'text', id: 'username' } }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const labelFinding = findings.find(f => f.ruleId === 'A11Y-FORM-LABEL');
      expect(labelFinding).toBeDefined();
      expect(labelFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect redundant ARIA role', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'nav', attributes: {} },
          { tagName: 'button', attributes: { role: 'button' } }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const redundantFinding = findings.find(f => f.ruleId === 'A11Y-ARIA-REDUNDANT');
      expect(redundantFinding).toBeDefined();
      expect(redundantFinding?.severity).toBe(Severity.LOW);
    });

    test('should detect aria-hidden on focusable element', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'nav', attributes: {} },
          { tagName: 'button', attributes: { 'aria-hidden': 'true' } }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      const hiddenFinding = findings.find(f => f.ruleId === 'A11Y-ARIA-HIDDEN');
      expect(hiddenFinding).toBeDefined();
      expect(hiddenFinding?.severity).toBe(Severity.HIGH);
    });

    test('should not report issues for proper semantic structure', () => {
      const htmlAST = {
        elements: [
          { tagName: 'main', attributes: {} },
          { tagName: 'nav', attributes: {} },
          { tagName: 'header', attributes: {} },
          { tagName: 'footer', attributes: {} },
          { tagName: 'button', attributes: {} }
        ]
      };

      const findings = analyzer.checkSemanticStructure(htmlAST);
      
      // Should only have low severity or no critical/high issues
      const criticalOrHigh = findings.filter(f => 
        f.severity === Severity.CRITICAL || f.severity === Severity.HIGH
      );
      expect(criticalOrHigh.length).toBe(0);
    });
  });

  describe('checkColorContrast', () => {
    test('should detect low contrast colors', () => {
      const htmlAST = { elements: [] };
      const cssAST = {
        properties: [
          { property: 'color', value: '#999' },
          { property: 'background-color', value: '#fff' }
        ]
      };

      const findings = analyzer.checkColorContrast(htmlAST, cssAST);
      
      const contrastFinding = findings.find(f => f.ruleId === 'A11Y-CONTRAST-LOW');
      expect(contrastFinding).toBeDefined();
      expect(contrastFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect missing color declarations', () => {
      const htmlAST = { elements: [] };
      const cssAST = {
        properties: []
      };

      const findings = analyzer.checkColorContrast(htmlAST, cssAST);
      
      const missingFinding = findings.find(f => f.ruleId === 'A11Y-CONTRAST-MISSING');
      expect(missingFinding).toBeDefined();
      expect(missingFinding?.severity).toBe(Severity.INFO);
    });

    test('should handle good contrast ratios', () => {
      const htmlAST = { elements: [] };
      const cssAST = {
        properties: [
          { property: 'color', value: '#000' },
          { property: 'background-color', value: '#fff' }
        ]
      };

      const findings = analyzer.checkColorContrast(htmlAST, cssAST);
      
      // Should not have high severity contrast issues
      const highContrastIssues = findings.filter(f => 
        f.ruleId === 'A11Y-CONTRAST-LOW' && f.severity === Severity.HIGH
      );
      expect(highContrastIssues.length).toBe(0);
    });
  });

  describe('checkKeyboardNavigation', () => {
    test('should detect onclick without keyboard handler', () => {
      const htmlAST = {
        elements: [
          { tagName: 'div', attributes: { onclick: 'handleClick()' } }
        ]
      };
      const jsAST = { ast: {} };

      const findings = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
      
      const handlerFinding = findings.find(f => f.ruleId === 'A11Y-KBD-HANDLER');
      expect(handlerFinding).toBeDefined();
      expect(handlerFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect negative tabindex', () => {
      const htmlAST = {
        elements: [
          { tagName: 'button', attributes: { tabindex: '-1' } }
        ]
      };
      const jsAST = { ast: {} };

      const findings = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
      
      const tabindexFinding = findings.find(f => f.ruleId === 'A11Y-KBD-TABINDEX-NEG');
      expect(tabindexFinding).toBeDefined();
      expect(tabindexFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect positive tabindex', () => {
      const htmlAST = {
        elements: [
          { tagName: 'button', attributes: { tabindex: '5' } }
        ]
      };
      const jsAST = { ast: {} };

      const findings = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
      
      const tabindexFinding = findings.find(f => f.ruleId === 'A11Y-KBD-TABINDEX-POS');
      expect(tabindexFinding).toBeDefined();
      expect(tabindexFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect custom control without tabindex', () => {
      const htmlAST = {
        elements: [
          { tagName: 'div', attributes: { role: 'button' } }
        ]
      };
      const jsAST = { ast: {} };

      const findings = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
      
      const tabindexFinding = findings.find(f => f.ruleId === 'A11Y-KBD-TABINDEX-MISSING');
      expect(tabindexFinding).toBeDefined();
      expect(tabindexFinding?.severity).toBe(Severity.HIGH);
    });
  });

  describe('checkImageAltText', () => {
    test('should detect missing alt attribute', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      const altFinding = findings.find(f => f.ruleId === 'A11Y-IMG-ALT-MISSING');
      expect(altFinding).toBeDefined();
      expect(altFinding?.severity).toBe(Severity.CRITICAL);
    });

    test('should detect empty alt text', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg', alt: '' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      const emptyFinding = findings.find(f => f.ruleId === 'A11Y-IMG-ALT-EMPTY');
      expect(emptyFinding).toBeDefined();
      expect(emptyFinding?.severity).toBe(Severity.INFO);
    });

    test('should detect short alt text', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg', alt: 'ab' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      const shortFinding = findings.find(f => f.ruleId === 'A11Y-IMG-ALT-SHORT');
      expect(shortFinding).toBeDefined();
      expect(shortFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should detect filename as alt text', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg', alt: 'image.jpg' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      const filenameFinding = findings.find(f => f.ruleId === 'A11Y-IMG-ALT-FILENAME');
      expect(filenameFinding).toBeDefined();
      expect(filenameFinding?.severity).toBe(Severity.HIGH);
    });

    test('should detect generic alt text', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg', alt: 'image' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      const genericFinding = findings.find(f => f.ruleId === 'A11Y-IMG-ALT-GENERIC');
      expect(genericFinding).toBeDefined();
      expect(genericFinding?.severity).toBe(Severity.MEDIUM);
    });

    test('should accept good alt text', () => {
      const htmlAST = {
        elements: [
          { tagName: 'img', attributes: { src: 'image.jpg', alt: 'A beautiful sunset over the ocean' } }
        ]
      };

      const findings = analyzer.checkImageAltText(htmlAST);
      
      // Should not have critical or high severity issues
      const criticalOrHigh = findings.filter(f => 
        f.severity === Severity.CRITICAL || f.severity === Severity.HIGH
      );
      expect(criticalOrHigh.length).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    test('should generate semantic structure recommendations', () => {
      const findings = [
        {
          id: 'A11Y-SEM-1',
          severity: Severity.HIGH,
          message: 'Missing main landmark',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-SEM-MAIN'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      const semanticRec = recommendations.find(r => 
        r.description.includes('semantic')
      );
      expect(semanticRec).toBeDefined();
      expect(semanticRec?.priority).toBe(Priority.HIGH);
      expect(semanticRec?.implementationSteps.length).toBeGreaterThan(0);
    });

    test('should generate contrast recommendations', () => {
      const findings = [
        {
          id: 'A11Y-CON-1',
          severity: Severity.HIGH,
          message: 'Low contrast',
          location: { file: 'styles.css', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-CONTRAST-LOW'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      const contrastRec = recommendations.find(r => 
        r.description.includes('contrast')
      );
      expect(contrastRec).toBeDefined();
      expect(contrastRec?.priority).toBe(Priority.HIGH);
    });

    test('should generate keyboard navigation recommendations', () => {
      const findings = [
        {
          id: 'A11Y-KBD-1',
          severity: Severity.HIGH,
          message: 'Missing keyboard handler',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-KBD-HANDLER'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      const keyboardRec = recommendations.find(r => 
        r.description.includes('keyboard')
      );
      expect(keyboardRec).toBeDefined();
      expect(keyboardRec?.priority).toBe(Priority.HIGH);
    });

    test('should generate image alt text recommendations', () => {
      const findings = [
        {
          id: 'A11Y-IMG-1',
          severity: Severity.CRITICAL,
          message: 'Missing alt',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-IMG-ALT-MISSING'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      const imageRec = recommendations.find(r => 
        r.description.includes('image')
      );
      expect(imageRec).toBeDefined();
      expect(imageRec?.priority).toBe(Priority.HIGH);
    });
  });

  describe('calculateScore', () => {
    test('should return 100 for no findings', () => {
      const score = analyzer.calculateScore([]);
      expect(score).toBe(100);
    });

    test('should deduct points for critical findings', () => {
      const findings = [
        {
          id: 'A11Y-1',
          severity: Severity.CRITICAL,
          message: 'Critical issue',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-CRITICAL'
        }
      ];

      const score = analyzer.calculateScore(findings);
      expect(score).toBe(85); // 100 - 15
    });

    test('should deduct points for high severity findings', () => {
      const findings = [
        {
          id: 'A11Y-1',
          severity: Severity.HIGH,
          message: 'High issue',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-HIGH'
        }
      ];

      const score = analyzer.calculateScore(findings);
      expect(score).toBe(92); // 100 - 8
    });

    test('should not go below 0', () => {
      const findings = Array(20).fill({
        id: 'A11Y-1',
        severity: Severity.CRITICAL,
        message: 'Critical issue',
        location: { file: 'index.html', line: 1 },
        codeSnippet: '',
        ruleId: 'A11Y-CRITICAL'
      });

      const score = analyzer.calculateScore(findings);
      expect(score).toBe(0);
    });

    test('should calculate score for mixed severity findings', () => {
      const findings = [
        {
          id: 'A11Y-1',
          severity: Severity.CRITICAL,
          message: 'Critical',
          location: { file: 'index.html', line: 1 },
          codeSnippet: '',
          ruleId: 'A11Y-1'
        },
        {
          id: 'A11Y-2',
          severity: Severity.HIGH,
          message: 'High',
          location: { file: 'index.html', line: 2 },
          codeSnippet: '',
          ruleId: 'A11Y-2'
        },
        {
          id: 'A11Y-3',
          severity: Severity.MEDIUM,
          message: 'Medium',
          location: { file: 'index.html', line: 3 },
          codeSnippet: '',
          ruleId: 'A11Y-3'
        }
      ];

      const score = analyzer.calculateScore(findings);
      expect(score).toBe(73); // 100 - 15 - 8 - 4
    });
  });
});
