/**
 * Accessibility Analyzer
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Finding, Recommendation, Severity, Priority } from '../types';

export class AccessibilityAnalyzer {
  /**
   * Check HTML semantic structure and ARIA attributes
   * Validates: Requirement 4.1
   */
  checkSemanticStructure(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    const elements = htmlAST.elements;
    
    // Check for proper semantic HTML5 elements
    const hasMain = elements.some((el: any) => el.tagName === 'main');
    const hasNav = elements.some((el: any) => el.tagName === 'nav');
    const hasHeader = elements.some((el: any) => el.tagName === 'header');
    const hasFooter = elements.some((el: any) => el.tagName === 'footer');
    
    if (!hasMain) {
      findings.push({
        id: `A11Y-SEM-${findings.length + 1}`,
        severity: Severity.HIGH,
        message: 'Missing <main> landmark element for main content',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add <main> element to wrap primary content',
        ruleId: 'A11Y-SEM-MAIN'
      });
    }
    
    if (!hasNav) {
      findings.push({
        id: `A11Y-SEM-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'Missing <nav> landmark element for navigation',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add <nav> element to wrap navigation links',
        ruleId: 'A11Y-SEM-NAV'
      });
    }
    
    if (!hasHeader) {
      findings.push({
        id: `A11Y-SEM-${findings.length + 1}`,
        severity: Severity.LOW,
        message: 'Missing <header> landmark element',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add <header> element for page header',
        ruleId: 'A11Y-SEM-HEADER'
      });
    }
    
    if (!hasFooter) {
      findings.push({
        id: `A11Y-SEM-${findings.length + 1}`,
        severity: Severity.LOW,
        message: 'Missing <footer> landmark element',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add <footer> element for page footer',
        ruleId: 'A11Y-SEM-FOOTER'
      });
    }

    // Check for non-semantic div usage where semantic elements should be used
    const divs = elements.filter((el: any) => el.tagName === 'div');
    const excessiveDivs = divs.length > 20;
    
    if (excessiveDivs) {
      findings.push({
        id: `A11Y-SEM-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: `Excessive use of <div> elements (${divs.length}). Consider using semantic HTML5 elements`,
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Replace divs with semantic elements like <article>, <section>, <aside>',
        ruleId: 'A11Y-SEM-DIV'
      });
    }

    // Check for ARIA attributes
    elements.forEach((el: any, index: number) => {
      const attrs = el.attributes || {};
      
      // Check for buttons without proper role
      if (el.tagName === 'div' && attrs.onclick && !attrs.role) {
        findings.push({
          id: `A11Y-SEM-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Interactive <div> without role attribute',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Add role="button" or use <button> element instead',
          ruleId: 'A11Y-ARIA-ROLE'
        });
      }
      
      // Check for links without href
      if (el.tagName === 'a' && !attrs.href) {
        findings.push({
          id: `A11Y-SEM-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Link element without href attribute',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Add href attribute or use <button> for actions',
          ruleId: 'A11Y-LINK-HREF'
        });
      }
      
      // Check for form inputs without labels
      if (el.tagName === 'input' && attrs.type !== 'hidden' && !attrs['aria-label'] && !attrs['aria-labelledby']) {
        const hasLabel = elements.some((label: any) => 
          label.tagName === 'label' && label.attributes?.for === attrs.id
        );
        
        if (!hasLabel) {
          findings.push({
            id: `A11Y-SEM-${findings.length + 1}`,
            severity: Severity.HIGH,
            message: 'Form input without associated label',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Add <label> element or aria-label attribute',
            ruleId: 'A11Y-FORM-LABEL'
          });
        }
      }
      
      // Check for incorrect ARIA usage
      if (attrs.role === 'button' && el.tagName === 'button') {
        findings.push({
          id: `A11Y-SEM-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Redundant role="button" on <button> element',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Remove redundant role attribute',
          ruleId: 'A11Y-ARIA-REDUNDANT'
        });
      }
      
      // Check for aria-hidden on focusable elements
      if (attrs['aria-hidden'] === 'true' && (el.tagName === 'button' || el.tagName === 'a' || el.tagName === 'input')) {
        findings.push({
          id: `A11Y-SEM-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Focusable element with aria-hidden="true"',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Remove aria-hidden or make element non-focusable',
          ruleId: 'A11Y-ARIA-HIDDEN'
        });
      }
    });

    return findings;
  }

  /**
   * Verify color contrast ratios
   * Validates: Requirement 4.2
   */
  checkColorContrast(_htmlAST: any, cssAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!cssAST || !cssAST.properties) {
      return findings;
    }

    // Extract color and background-color properties
    const colorProps = cssAST.properties.filter((prop: any) => 
      prop.property === 'color' || prop.property === 'background-color' || prop.property === 'background'
    );

    // Check for low contrast color combinations
    const textColors: string[] = [];
    const bgColors: string[] = [];
    
    colorProps.forEach((prop: any) => {
      if (prop.property === 'color') {
        textColors.push(prop.value);
      } else if (prop.property === 'background-color' || prop.property === 'background') {
        bgColors.push(prop.value);
      }
    });

    textColors.forEach((textColor) => {
      bgColors.forEach((bgColor) => {
        const contrast = this.estimateContrast(textColor, bgColor);
        
        if (contrast < 4.5) {
          findings.push({
            id: `A11Y-CON-${findings.length + 1}`,
            severity: Severity.HIGH,
            message: `Low color contrast ratio (estimated ${contrast.toFixed(2)}:1). WCAG 2.1 AA requires 4.5:1 for normal text`,
            location: { file: 'styles.css', line: 1, column: 1 },
            codeSnippet: `Text: ${textColor}, Background: ${bgColor}`,
            ruleId: 'A11Y-CONTRAST-LOW'
          });
        } else if (contrast < 7.0) {
          findings.push({
            id: `A11Y-CON-${findings.length + 1}`,
            severity: Severity.MEDIUM,
            message: `Color contrast ratio (estimated ${contrast.toFixed(2)}:1) meets AA but not AAA standards (7:1)`,
            location: { file: 'styles.css', line: 1, column: 1 },
            codeSnippet: `Text: ${textColor}, Background: ${bgColor}`,
            ruleId: 'A11Y-CONTRAST-AAA'
          });
        }
      });
    });

    // Check for missing color contrast considerations
    if (textColors.length === 0 || bgColors.length === 0) {
      findings.push({
        id: `A11Y-CON-${findings.length + 1}`,
        severity: Severity.INFO,
        message: 'No explicit color/background-color declarations found. Ensure default colors have sufficient contrast',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Define explicit colors with WCAG-compliant contrast ratios',
        ruleId: 'A11Y-CONTRAST-MISSING'
      });
    }

    return findings;
  }

  /**
   * Estimate contrast ratio between two colors (simplified)
   */
  private estimateContrast(color1: string, color2: string): number {
    // Simplified contrast estimation based on color values
    // In a real implementation, this would use proper luminance calculation
    
    const getColorValue = (color: string): number => {
      // Handle hex colors
      if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        return (r + g + b) / 3;
      }
      
      // Handle rgb/rgba
      if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          const r = parseInt(matches[0]);
          const g = parseInt(matches[1]);
          const b = parseInt(matches[2]);
          return (r + g + b) / 3;
        }
      }
      
      // Handle named colors (simplified)
      const namedColors: Record<string, number> = {
        'white': 255, 'black': 0, 'red': 128, 'green': 128, 'blue': 128,
        'yellow': 200, 'cyan': 200, 'magenta': 128, 'gray': 128, 'grey': 128
      };
      
      return namedColors[color.toLowerCase()] || 128;
    };
    
    const val1 = getColorValue(color1);
    const val2 = getColorValue(color2);
    const diff = Math.abs(val1 - val2);
    
    // Simplified contrast ratio estimation
    // Real calculation would use relative luminance
    return 1 + (diff / 255) * 20;
  }

  /**
   * Check keyboard navigation support
   * Validates: Requirement 4.3
   */
  checkKeyboardNavigation(htmlAST: any, jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    const elements = htmlAST.elements;
    
    // Check for interactive elements without keyboard support
    elements.forEach((el: any, index: number) => {
      const attrs = el.attributes || {};
      
      // Check for onclick without keyboard handler
      if (attrs.onclick && el.tagName !== 'button' && el.tagName !== 'a') {
        const hasKeyHandler = attrs.onkeydown || attrs.onkeyup || attrs.onkeypress;
        
        if (!hasKeyHandler) {
          findings.push({
            id: `A11Y-KBD-${findings.length + 1}`,
            severity: Severity.HIGH,
            message: `Interactive ${el.tagName} with onclick but no keyboard event handler`,
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Add onkeydown or onkeypress handler for keyboard accessibility',
            ruleId: 'A11Y-KBD-HANDLER'
          });
        }
      }
      
      // Check for negative tabindex
      if (attrs.tabindex && parseInt(attrs.tabindex) < 0 && el.tagName !== 'div') {
        findings.push({
          id: `A11Y-KBD-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Negative tabindex removes element from keyboard navigation',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Use tabindex="0" for keyboard accessibility or remove tabindex',
          ruleId: 'A11Y-KBD-TABINDEX-NEG'
        });
      }
      
      // Check for positive tabindex (anti-pattern)
      if (attrs.tabindex && parseInt(attrs.tabindex) > 0) {
        findings.push({
          id: `A11Y-KBD-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Positive tabindex disrupts natural tab order',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Use tabindex="0" or rely on natural DOM order',
          ruleId: 'A11Y-KBD-TABINDEX-POS'
        });
      }
      
      // Check for custom controls without tabindex
      if ((el.tagName === 'div' || el.tagName === 'span') && 
          (attrs.role === 'button' || attrs.role === 'link') && 
          !attrs.tabindex) {
        findings.push({
          id: `A11Y-KBD-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: `Custom ${attrs.role} without tabindex`,
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Add tabindex="0" to make element keyboard focusable',
          ruleId: 'A11Y-KBD-TABINDEX-MISSING'
        });
      }
    });

    // Check JavaScript for keyboard event handlers
    if (jsAST && jsAST.ast) {
      let hasKeyboardHandlers = false;
      
      const traverse = (node: any, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 50) return;
        
        // Check for addEventListener with keyboard events
        if (node.type === 'CallExpression' &&
            node.callee?.property?.name === 'addEventListener') {
          const eventArg = node.arguments?.[0];
          if (eventArg?.type === 'Literal') {
            const eventType = eventArg.value;
            if (eventType === 'keydown' || eventType === 'keyup' || eventType === 'keypress') {
              hasKeyboardHandlers = true;
            }
          }
        }
        
        // Recursively traverse
        for (const key in node) {
          if (key === 'loc' || key === 'range') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => traverse(c, depth + 1));
          } else if (child && typeof child === 'object') {
            traverse(child, depth + 1);
          }
        }
      };
      
      traverse(jsAST.ast);
      
      if (!hasKeyboardHandlers) {
        findings.push({
          id: `A11Y-KBD-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'No keyboard event handlers found in JavaScript',
          location: { file: 'script.js', line: 1, column: 1 },
          codeSnippet: 'Add keyboard event listeners for interactive elements',
          ruleId: 'A11Y-KBD-JS-MISSING'
        });
      }
    }

    return findings;
  }

  /**
   * Verify image alt text completeness
   * Validates: Requirement 4.4
   */
  checkImageAltText(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    const images = htmlAST.elements.filter((el: any) => el.tagName === 'img');
    
    images.forEach((img: any, index: number) => {
      const attrs = img.attributes || {};
      
      // Check for missing alt attribute
      if (!attrs.alt && attrs.alt !== '') {
        findings.push({
          id: `A11Y-IMG-${findings.length + 1}`,
          severity: Severity.CRITICAL,
          message: 'Image missing alt attribute',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Add alt attribute: <img src="..." alt="descriptive text">',
          ruleId: 'A11Y-IMG-ALT-MISSING'
        });
      } else if (attrs.alt === '') {
        // Empty alt is acceptable for decorative images, but check if it's intentional
        findings.push({
          id: `A11Y-IMG-${findings.length + 1}`,
          severity: Severity.INFO,
          message: 'Image has empty alt text. Ensure this is a decorative image',
          location: { file: 'index.html', line: index + 1, column: 1 },
          codeSnippet: 'Empty alt is correct for decorative images only',
          ruleId: 'A11Y-IMG-ALT-EMPTY'
        });
      } else {
        const altText = attrs.alt;
        
        // Check for poor quality alt text
        if (altText.length < 3) {
          findings.push({
            id: `A11Y-IMG-${findings.length + 1}`,
            severity: Severity.MEDIUM,
            message: 'Alt text too short to be descriptive',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Provide more descriptive alt text',
            ruleId: 'A11Y-IMG-ALT-SHORT'
          });
        }
        
        // Check for alt text that's too long
        if (altText.length > 150) {
          findings.push({
            id: `A11Y-IMG-${findings.length + 1}`,
            severity: Severity.LOW,
            message: 'Alt text very long (>150 chars). Consider using aria-describedby for detailed descriptions',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Keep alt text concise, use aria-describedby for details',
            ruleId: 'A11Y-IMG-ALT-LONG'
          });
        }
        
        // Check for filename-like alt text
        const filenamePattern = /\.(jpg|jpeg|png|gif|svg|webp)$/i;
        if (filenamePattern.test(altText)) {
          findings.push({
            id: `A11Y-IMG-${findings.length + 1}`,
            severity: Severity.HIGH,
            message: 'Alt text appears to be a filename',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Replace filename with descriptive text',
            ruleId: 'A11Y-IMG-ALT-FILENAME'
          });
        }
        
        // Check for generic alt text
        const genericTerms = ['image', 'picture', 'photo', 'graphic', 'icon'];
        const lowerAlt = altText.toLowerCase();
        if (genericTerms.some(term => lowerAlt === term)) {
          findings.push({
            id: `A11Y-IMG-${findings.length + 1}`,
            severity: Severity.MEDIUM,
            message: 'Alt text is too generic',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Provide specific description of image content',
            ruleId: 'A11Y-IMG-ALT-GENERIC'
          });
        }
      }
    });

    // Check for background images in CSS (informational)
    if (images.length === 0) {
      findings.push({
        id: `A11Y-IMG-${findings.length + 1}`,
        severity: Severity.INFO,
        message: 'No <img> elements found. If using CSS background images for content, ensure alternative text is provided',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Use <img> with alt text for content images',
        ruleId: 'A11Y-IMG-NONE'
      });
    }

    return findings;
  }

  /**
   * Generate accessibility recommendations
   * Validates: Requirement 4.5
   */
  generateRecommendations(findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Group findings by category
    const semanticFindings = findings.filter(f => f.ruleId.includes('SEM') || f.ruleId.includes('ARIA'));
    const contrastFindings = findings.filter(f => f.ruleId.includes('CONTRAST') || f.ruleId.includes('CON'));
    const keyboardFindings = findings.filter(f => f.ruleId.includes('KBD'));
    const imageFindings = findings.filter(f => f.ruleId.includes('IMG'));

    // Semantic structure recommendations
    if (semanticFindings.length > 0) {
      recommendations.push({
        description: 'Improve semantic HTML structure and ARIA attributes',
        priority: this.getPriorityForFindings(semanticFindings),
        implementationSteps: [
          'Add landmark elements: <main>, <nav>, <header>, <footer>',
          'Replace non-semantic divs with semantic elements like <article>, <section>',
          'Add proper ARIA roles to custom interactive elements',
          'Ensure all form inputs have associated labels',
          'Remove redundant ARIA attributes from native elements'
        ],
        estimatedImpact: 'HIGH - Improves screen reader navigation and document structure'
      });
    }

    // Color contrast recommendations
    if (contrastFindings.length > 0) {
      recommendations.push({
        description: 'Improve color contrast for WCAG compliance',
        priority: this.getPriorityForFindings(contrastFindings),
        implementationSteps: [
          'Ensure text has 4.5:1 contrast ratio for WCAG AA compliance',
          'Aim for 7:1 contrast ratio for WCAG AAA compliance',
          'Use contrast checking tools to verify color combinations',
          'Provide alternative visual indicators beyond color alone',
          'Test with color blindness simulators'
        ],
        estimatedImpact: 'HIGH - Makes content readable for users with visual impairments'
      });
    }

    // Keyboard navigation recommendations
    if (keyboardFindings.length > 0) {
      recommendations.push({
        description: 'Enhance keyboard navigation support',
        priority: this.getPriorityForFindings(keyboardFindings),
        implementationSteps: [
          'Add keyboard event handlers to all interactive elements',
          'Use tabindex="0" for custom focusable elements',
          'Avoid positive tabindex values that disrupt natural order',
          'Ensure all functionality is accessible via keyboard',
          'Provide visible focus indicators for all interactive elements',
          'Test navigation using only keyboard (Tab, Enter, Space, Arrow keys)'
        ],
        estimatedImpact: 'HIGH - Enables keyboard-only users to access all functionality'
      });
    }

    // Image alt text recommendations
    if (imageFindings.length > 0) {
      recommendations.push({
        description: 'Improve image accessibility with proper alt text',
        priority: this.getPriorityForFindings(imageFindings),
        implementationSteps: [
          'Add alt attributes to all <img> elements',
          'Use empty alt="" for purely decorative images',
          'Write descriptive alt text that conveys image meaning',
          'Keep alt text concise (under 150 characters)',
          'Avoid filenames and generic terms like "image" or "photo"',
          'Use aria-describedby for complex images requiring detailed descriptions'
        ],
        estimatedImpact: 'HIGH - Makes visual content accessible to screen reader users'
      });
    }

    return recommendations;
  }

  /**
   * Get priority level based on findings severity
   */
  private getPriorityForFindings(findings: Finding[]): Priority {
    const hasCritical = findings.some(f => f.severity === Severity.CRITICAL);
    const hasHigh = findings.some(f => f.severity === Severity.HIGH);
    
    if (hasCritical || hasHigh) return Priority.HIGH;
    if (findings.some(f => f.severity === Severity.MEDIUM)) return Priority.MEDIUM;
    return Priority.LOW;
  }

  /**
   * Calculate accessibility score
   * Validates: Requirement 4.5
   */
  calculateScore(findings: Finding[]): number {
    let score = 100;
    
    for (const finding of findings) {
      switch (finding.severity) {
        case Severity.CRITICAL:
          score -= 15;
          break;
        case Severity.HIGH:
          score -= 8;
          break;
        case Severity.MEDIUM:
          score -= 4;
          break;
        case Severity.LOW:
          score -= 2;
          break;
        case Severity.INFO:
          score -= 1;
          break;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
}