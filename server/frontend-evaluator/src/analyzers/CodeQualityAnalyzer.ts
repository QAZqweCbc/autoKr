/**
 * Code Quality Analyzer
 */

import { Finding, Recommendation, Severity, Priority } from '../types';

export class CodeQualityAnalyzer {
  /**
   * Analyze HTML structure for semantic correctness
   */
  analyzeHTMLStructure(htmlAST: any, filePath: string): Finding[] {
    const findings: Finding[] = [];
    
    // Check for proper HTML5 doctype
    if (!htmlAST.doctype || htmlAST.doctype.toLowerCase() !== 'html') {
      findings.push({
        id: `CQ-HTML-DOCTYPE-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: 'Missing or incorrect HTML5 doctype declaration',
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Add <!DOCTYPE html> at the beginning of the HTML file',
        ruleId: 'CQ001'
      });
    }
    
    // Check for semantic HTML elements usage
    const semanticElements = htmlAST.elements?.filter((el: any) => el.isSemantic) || [];
    const totalElements = htmlAST.elements?.length || 0;
    const semanticRatio = totalElements > 0 ? semanticElements.length / totalElements : 0;
    
    if (semanticRatio < 0.3 && totalElements > 10) {
      findings.push({
        id: `CQ-HTML-SEMANTIC-${Date.now()}`,
        severity: Severity.LOW,
        message: `Low semantic HTML usage (${Math.round(semanticRatio * 100)}% semantic elements)`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Consider using semantic elements like <header>, <nav>, <main>, <article>, <section>, <footer>',
        ruleId: 'CQ-HTML-SEMANTIC'
      });
    }
    
    // Check for valid nesting structure (div inside p, etc.)
    const invalidNesting = this.checkHTMLNesting(htmlAST);
    if (invalidNesting.length > 0) {
      findings.push({
        id: `CQ-HTML-NESTING-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `Found ${invalidNesting.length} invalid HTML nesting patterns`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Check HTML nesting rules: block elements cannot be inside inline elements',
        ruleId: 'CQ-HTML-NESTING'
      });
    }
    
    // Check for missing required attributes
    const missingAttributes = this.checkMissingAttributes(htmlAST);
    missingAttributes.forEach((attr: any) => {
      findings.push({
        id: `CQ-HTML-ATTR-${Date.now()}-${attr.element}`,
        severity: Severity.MEDIUM,
        message: `Missing ${attr.attribute} attribute on <${attr.element}> element`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: `Add ${attr.attribute}="${attr.suggestedValue || ''}" to <${attr.element}>`,
        ruleId: 'CQ-HTML-ATTR'
      });
    });
    
    // Check for deprecated elements
    const deprecatedElements = this.checkDeprecatedElements(htmlAST);
    deprecatedElements.forEach((element: string) => {
      findings.push({
        id: `CQ-HTML-DEPRECATED-${Date.now()}-${element}`,
        severity: Severity.HIGH,
        message: `Deprecated HTML element <${element}> found`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: `Replace <${element}> with modern HTML5 equivalent`,
        ruleId: 'CQ-HTML-DEPRECATED'
      });
    });
    
    return findings;
  }

  /**
   * Analyze CSS for quality issues
   */
  analyzeCSSQuality(cssAST: any, filePath: string): Finding[] {
    const findings: Finding[] = [];
    
    // Analyze selector specificity
    const highSpecificitySelectors = cssAST.selectors?.filter((selector: any) => 
      selector.specificity > 100
    ) || [];
    
    if (highSpecificitySelectors.length > 0) {
      findings.push({
        id: `CQ-CSS-SPECIFICITY-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `Found ${highSpecificitySelectors.length} CSS selectors with high specificity`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'High specificity selectors can cause styling conflicts. Consider using classes instead of IDs.',
        ruleId: 'CQ-CSS-SPECIFICITY'
      });
    }
    
    // Check for duplicate rules
    const duplicateRules = this.findDuplicateCSSRules(cssAST);
    if (duplicateRules.length > 0) {
      findings.push({
        id: `CQ-CSS-DUPLICATE-${Date.now()}`,
        severity: Severity.LOW,
        message: `Found ${duplicateRules.length} duplicate CSS rules`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Duplicate rules increase file size and maintenance complexity',
        ruleId: 'CQ-CSS-DUPLICATE'
      });
    }
    
    // Check for inefficient selectors
    const inefficientSelectors = cssAST.selectors?.filter((selector: any) => 
      selector.complexity > 5
    ) || [];
    
    if (inefficientSelectors.length > 0) {
      findings.push({
        id: `CQ-CSS-INEFFICIENT-${Date.now()}`,
        severity: Severity.LOW,
        message: `Found ${inefficientSelectors.length} inefficient CSS selectors`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Complex selectors can impact rendering performance',
        ruleId: 'CQ-CSS-INEFFICIENT'
      });
    }
    
    // Check for !important usage
    const importantDeclarations = cssAST.properties?.filter((prop: any) => 
      prop.important
    ) || [];
    
    if (importantDeclarations.length > 3) {
      findings.push({
        id: `CQ-CSS-IMPORTANT-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `Excessive !important usage (${importantDeclarations.length} declarations)`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Overuse of !important makes CSS harder to maintain',
        ruleId: 'CQ-CSS-IMPORTANT'
      });
    }
    
    // Check for vendor prefix usage
    const vendorPrefixed = cssAST.properties?.filter((prop: any) => 
      prop.property.startsWith('-webkit-') || 
      prop.property.startsWith('-moz-') || 
      prop.property.startsWith('-ms-') || 
      prop.property.startsWith('-o-')
    ) || [];
    
    if (vendorPrefixed.length > 0) {
      findings.push({
        id: `CQ-CSS-VENDOR-${Date.now()}`,
        severity: Severity.INFO,
        message: `Found ${vendorPrefixed.length} vendor-prefixed CSS properties`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Consider using autoprefixer or check browser support',
        ruleId: 'CQ-CSS-VENDOR'
      });
    }
    
    return findings;
  }

  /**
   * Analyze JavaScript for quality issues
   */
  analyzeJavaScriptQuality(jsAST: any, filePath: string): Finding[] {
    const findings: Finding[] = [];
    const analysis = jsAST.analysis;
    const stats = jsAST.statistics;
    
    // Check for potential performance bottlenecks
    if (stats.complexity > 20) {
      findings.push({
        id: `CQ-JS-COMPLEXITY-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `High cyclomatic complexity (${stats.complexity})`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'High complexity makes code harder to test and maintain',
        ruleId: 'CQ-JS-COMPLEXITY'
      });
    }
    
    // Check for long functions (based on statement count)
    const longFunctions = analysis.functions?.filter((func: any) => {
      // Estimate function length by checking if it has many statements
      // This is a simplified check
      return func.params && func.params.length > 5;
    }) || [];
    
    if (longFunctions.length > 0) {
      findings.push({
        id: `CQ-JS-LONGFUNC-${Date.now()}`,
        severity: Severity.LOW,
        message: `Found ${longFunctions.length} functions with many parameters`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Functions with many parameters can be hard to use and test',
        ruleId: 'CQ-JS-LONGFUNC'
      });
    }
    
    // Check for nested callbacks depth
    const deepNesting = this.checkNestedCallbacks(jsAST.ast);
    if (deepNesting > 3) {
      findings.push({
        id: `CQ-JS-NESTING-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `Deep callback nesting detected (depth: ${deepNesting})`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Deep nesting makes code hard to read and maintain',
        ruleId: 'CQ-JS-NESTING'
      });
    }
    
    // Check for potential memory leaks (simplified)
    const potentialLeaks = this.checkPotentialMemoryLeaks(jsAST.ast);
    if (potentialLeaks.length > 0) {
      findings.push({
        id: `CQ-JS-MEMORY-${Date.now()}`,
        severity: Severity.MEDIUM,
        message: `Potential memory leak patterns detected`,
        location: {
          file: filePath,
          line: 1,
          column: 1
        },
        codeSnippet: 'Check for event listeners that are not properly removed',
        ruleId: 'CQ-JS-MEMORY'
      });
    }
    
    // Check for code smells
    const codeSmells = this.detectCodeSmells(jsAST.ast);
    codeSmells.forEach((smell: any) => {
      findings.push({
        id: `CQ-JS-SMELL-${Date.now()}-${smell.type}`,
        severity: Severity.LOW,
        message: `Code smell detected: ${smell.message}`,
        location: {
          file: filePath,
          line: smell.line || 1,
          column: smell.column || 1
        },
        codeSnippet: smell.suggestion,
        ruleId: 'CQ-JS-SMELL'
      });
    });
    
    return findings;
  }

  /**
   * Generate code quality recommendations
   */
  generateRecommendations(findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const groupedFindings = this.groupFindingsByType(findings);
    
    // HTML recommendations
    if (groupedFindings.html.length > 0) {
      recommendations.push({
        description: 'Improve HTML structure and semantics',
        priority: this.getPriorityForFindings(groupedFindings.html),
        implementationSteps: [
          'Review HTML doctype declaration',
          'Replace non-semantic elements with semantic alternatives',
          'Fix invalid nesting patterns',
          'Add missing required attributes'
        ],
        estimatedImpact: 'Improved accessibility, SEO, and maintainability'
      });
    }
    
    // CSS recommendations
    if (groupedFindings.css.length > 0) {
      recommendations.push({
        description: 'Optimize CSS selectors and rules',
        priority: this.getPriorityForFindings(groupedFindings.css),
        implementationSteps: [
          'Reduce selector specificity',
          'Remove duplicate rules',
          'Simplify complex selectors',
          'Reduce !important usage'
        ],
        estimatedImpact: 'Better performance and easier maintenance'
      });
    }
    
    // JavaScript recommendations
    if (groupedFindings.js.length > 0) {
      recommendations.push({
        description: 'Improve JavaScript code quality',
        priority: this.getPriorityForFindings(groupedFindings.js),
        implementationSteps: [
          'Refactor complex functions',
          'Reduce callback nesting',
          'Fix potential memory leaks',
          'Address code smells'
        ],
        estimatedImpact: 'Better performance, maintainability, and fewer bugs'
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate code quality score
   */
  calculateScore(findings: Finding[]): number {
    // Start with perfect score
    let score = 100;
    
    // Deduct points based on findings severity
    for (const finding of findings) {
      switch (finding.severity) {
        case Severity.CRITICAL:
          score -= 10;
          break;
        case Severity.HIGH:
          score -= 5;
          break;
        case Severity.MEDIUM:
          score -= 3;
          break;
        case Severity.LOW:
          score -= 1;
          break;
        case Severity.INFO:
          score -= 0.5;
          break;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Helper: Check HTML nesting validity
   */
  private checkHTMLNesting(htmlAST: any): any[] {
    const invalidNesting: any[] = [];
    const elements = htmlAST.elements || [];
    
    // Simplified check for common nesting issues
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const parentTag = element.parentTag;
      
      // Check for inline elements containing block elements
      const inlineElements = ['a', 'span', 'strong', 'em', 'code', 'b', 'i'];
      const blockElements = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
      
      if (inlineElements.includes(element.tagName) && 
          parentTag && blockElements.includes(parentTag)) {
        // This is actually valid (inline inside block)
        continue;
      }
      
      if (blockElements.includes(element.tagName) && 
          parentTag && inlineElements.includes(parentTag)) {
        invalidNesting.push({
          element: element.tagName,
          parent: parentTag,
          message: `Block element <${element.tagName}> inside inline element <${parentTag}>`
        });
      }
    }
    
    return invalidNesting;
  }

  /**
   * Helper: Check for missing required attributes
   */
  private checkMissingAttributes(htmlAST: any): any[] {
    const missing: any[] = [];
    const elements = htmlAST.elements || [];
    
    const requiredAttributes: Record<string, string[]> = {
      'img': ['alt', 'src'],
      'a': ['href'],
      'form': ['action'],
      'input': ['type'],
      'textarea': ['name'],
      'button': ['type']
    };
    
    for (const element of elements) {
      const required = requiredAttributes[element.tagName];
      if (required) {
        const attributes = element.attributes || {};
        for (const attr of required) {
          if (!attributes[attr]) {
            missing.push({
              element: element.tagName,
              attribute: attr,
              suggestedValue: attr === 'alt' ? 'descriptive text' : 
                            attr === 'href' ? '#' : 
                            attr === 'type' ? 'text' : ''
            });
          }
        }
      }
    }
    
    return missing;
  }

  /**
   * Helper: Check for deprecated elements
   */
  private checkDeprecatedElements(htmlAST: any): string[] {
    const deprecated: string[] = [];
    const elements = htmlAST.elements || [];
    
    const deprecatedTags = [
      'font', 'center', 'strike', 'tt', 'big', 'acronym',
      'applet', 'basefont', 'dir', 'frame', 'frameset',
      'noframes', 'isindex', 'listing', 'xmp', 'nextid'
    ];
    
    for (const element of elements) {
      if (deprecatedTags.includes(element.tagName)) {
        deprecated.push(element.tagName);
      }
    }
    
    return [...new Set(deprecated)]; // Remove duplicates
  }

  /**
   * Helper: Find duplicate CSS rules
   */
  private findDuplicateCSSRules(cssAST: any): any[] {
    const duplicates: any[] = [];
    const ruleMap = new Map<string, number>();
    const rules = cssAST.rules || [];
    
    for (const rule of rules) {
      const key = `${rule.selector}|${JSON.stringify(rule.declarations)}`;
      if (ruleMap.has(key)) {
        duplicates.push(rule);
      } else {
        ruleMap.set(key, 1);
      }
    }
    
    return duplicates;
  }

  /**
   * Helper: Check nested callbacks depth
   */
  private checkNestedCallbacks(ast: any): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    const walk = (node: any) => {
      if (!node) return;
      
      // Check for callback patterns
      if (node.type === 'FunctionExpression' || 
          node.type === 'ArrowFunctionExpression' ||
          node.type === 'FunctionDeclaration') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
        
        // Walk child nodes
        if (node.body) {
          if (Array.isArray(node.body)) {
            node.body.forEach(walk);
          } else {
            walk(node.body);
          }
        }
        
        currentDepth--;
      } else {
        // Walk all properties
        for (const key in node) {
          if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
              node[key].forEach(walk);
            } else {
              walk(node[key]);
            }
          }
        }
      }
    };
    
    walk(ast);
    return maxDepth;
  }

  /**
   * Helper: Check for potential memory leaks
   */
  private checkPotentialMemoryLeaks(ast: any): any[] {
    const leaks: any[] = [];
    
    // Simplified check for common patterns
    const walk = (node: any) => {
      if (!node) return;
      
      // Check for event listeners without removal
      if (node.type === 'CallExpression' && 
          node.callee && 
          node.callee.property && 
          node.callee.property.name === 'addEventListener') {
        leaks.push({
          type: 'event-listener',
          line: node.loc?.start?.line,
          column: node.loc?.start?.column
        });
      }
      
      // Check for setInterval without clearInterval
      if (node.type === 'CallExpression' && 
          node.callee && 
          node.callee.name === 'setInterval') {
        leaks.push({
          type: 'interval',
          line: node.loc?.start?.line,
          column: node.loc?.start?.column
        });
      }
      
      // Walk all properties
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(walk);
          } else {
            walk(node[key]);
          }
        }
      }
    };
    
    walk(ast);
    return leaks;
  }

  /**
   * Helper: Detect code smells
   */
  private detectCodeSmells(ast: any): any[] {
    const smells: any[] = [];
    
    // Simplified code smell detection
    const walk = (node: any) => {
      if (!node) return;
      
      // Check for long parameter lists
      if ((node.type === 'FunctionDeclaration' || 
           node.type === 'FunctionExpression' ||
           node.type === 'ArrowFunctionExpression') &&
          node.params && node.params.length > 5) {
        smells.push({
          type: 'many-parameters',
          message: `Function has ${node.params.length} parameters`,
          suggestion: 'Consider using an options object or breaking into smaller functions',
          line: node.loc?.start?.line,
          column: node.loc?.start?.column
        });
      }
      
      // Check for deep conditional nesting
      if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
        let depth = 1;
        let current = node;
        while (current.alternate && 
               (current.alternate.type === 'IfStatement' || 
                current.alternate.type === 'ConditionalExpression')) {
          depth++;
          current = current.alternate;
        }
        
        if (depth > 3) {
          smells.push({
            type: 'deep-conditional',
            message: `Deep conditional nesting (depth: ${depth})`,
            suggestion: 'Consider using switch statement or lookup table',
            line: node.loc?.start?.line,
            column: node.loc?.start?.column
          });
        }
      }
      
      // Walk all properties
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(walk);
          } else {
            walk(node[key]);
          }
        }
      }
    };
    
    walk(ast);
    return smells;
  }

  /**
   * Helper: Group findings by type
   */
  private groupFindingsByType(findings: Finding[]): { html: Finding[], css: Finding[], js: Finding[] } {
    const grouped = { html: [] as Finding[], css: [] as Finding[], js: [] as Finding[] };
    
    for (const finding of findings) {
      if (finding.ruleId?.includes('HTML')) {
        grouped.html.push(finding);
      } else if (finding.ruleId?.includes('CSS')) {
        grouped.css.push(finding);
      } else if (finding.ruleId?.includes('JS')) {
        grouped.js.push(finding);
      }
    }
    
    return grouped;
  }

  /**
   * Helper: Get priority for a group of findings
   */
  private getPriorityForFindings(findings: Finding[]): Priority {
    if (findings.some(f => f.severity === Severity.CRITICAL || f.severity === Severity.HIGH)) {
      return Priority.HIGH;
    } else if (findings.some(f => f.severity === Severity.MEDIUM)) {
      return Priority.MEDIUM;
    } else {
      return Priority.LOW;
    }
  }
}