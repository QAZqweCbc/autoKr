/**
 * Security Analyzer
 */

import { Finding, Recommendation, Severity, Priority } from '../types';

export class SecurityAnalyzer {
  /**
   * Detect XSS vulnerabilities in JavaScript
   */
  detectXSSVulnerabilities(jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!jsAST || !jsAST.ast) {
      return findings;
    }

    // Helper to traverse AST
    const traverse = (node: any, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 50) return;

      // Check for innerHTML usage
      if (node.type === 'MemberExpression' && 
          node.property?.name === 'innerHTML') {
        findings.push({
          id: `SEC-XSS-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Potential XSS vulnerability: innerHTML usage without sanitization',
          location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
          codeSnippet: 'Use textContent or sanitize HTML before assignment',
          ruleId: 'SEC-XSS-INNERHTML'
        });
      }

      // Check for eval() usage
      if (node.type === 'CallExpression' && 
          node.callee?.name === 'eval') {
        findings.push({
          id: `SEC-XSS-${findings.length + 1}`,
          severity: Severity.CRITICAL,
          message: 'Critical XSS vulnerability: eval() usage detected',
          location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
          codeSnippet: 'Avoid eval() - use safer alternatives like JSON.parse()',
          ruleId: 'SEC-XSS-EVAL'
        });
      }

      // Check for document.write usage
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee?.object?.name === 'document' &&
          node.callee?.property?.name === 'write') {
        findings.push({
          id: `SEC-XSS-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Potential XSS vulnerability: document.write() usage',
          location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
          codeSnippet: 'Use DOM manipulation methods instead of document.write()',
          ruleId: 'SEC-XSS-DOCWRITE'
        });
      }

      // Check for dangerouslySetInnerHTML (React)
      if (node.type === 'JSXAttribute' && 
          node.name?.name === 'dangerouslySetInnerHTML') {
        findings.push({
          id: `SEC-XSS-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Potential XSS vulnerability: dangerouslySetInnerHTML usage',
          location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
          codeSnippet: 'Sanitize HTML content before using dangerouslySetInnerHTML',
          ruleId: 'SEC-XSS-DANGEROUS'
        });
      }

      // Recursively traverse child nodes
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
    return findings;
  }

  /**
   * Check for CSRF protection indicators
   */
  checkCSRFProtection(htmlAST: any, jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    // Check for CSRF tokens in forms
    if (htmlAST && htmlAST.elements) {
      const forms = htmlAST.elements.filter((el: any) => el.tagName === 'form');
      
      for (const form of forms) {
        const method = form.attributes?.method?.toLowerCase();
        if (method === 'post' || method === 'put' || method === 'delete') {
          // Check if form has CSRF token input
          const formInputs = htmlAST.elements.filter((el: any) => 
            el.tagName === 'input' && el.parentTag === 'form'
          );
          
          const hasToken = formInputs.some((input: any) => {
            const name = input.attributes?.name?.toLowerCase() || '';
            return name.includes('csrf') || name.includes('token') || name.includes('_token');
          });

          if (!hasToken) {
            findings.push({
              id: `SEC-CSRF-${findings.length + 1}`,
              severity: Severity.HIGH,
              message: 'Missing CSRF protection: Form without CSRF token',
              location: { file: 'index.html', line: 1, column: 1 },
              codeSnippet: 'Add CSRF token to form: <input type="hidden" name="csrf_token" value="...">',
              ruleId: 'SEC-CSRF-TOKEN'
            });
          }
        }
      }
    }

    // Check for SameSite cookie attributes in JavaScript
    if (jsAST && jsAST.ast) {
      const traverse = (node: any, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 50) return;

        // Check for document.cookie assignments
        if (node.type === 'AssignmentExpression' &&
            node.left?.type === 'MemberExpression' &&
            node.left?.object?.name === 'document' &&
            node.left?.property?.name === 'cookie') {
          
          const cookieValue = node.right?.value || '';
          if (typeof cookieValue === 'string') {
            if (!cookieValue.toLowerCase().includes('samesite')) {
              findings.push({
                id: `SEC-CSRF-${findings.length + 1}`,
                severity: Severity.MEDIUM,
                message: 'Missing SameSite attribute on cookie',
                location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
                codeSnippet: 'Add SameSite=Strict or SameSite=Lax to cookie',
                ruleId: 'SEC-CSRF-SAMESITE'
              });
            }
            if (!cookieValue.toLowerCase().includes('secure')) {
              findings.push({
                id: `SEC-CSRF-${findings.length + 1}`,
                severity: Severity.MEDIUM,
                message: 'Missing Secure flag on cookie',
                location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
                codeSnippet: 'Add Secure flag to cookie for HTTPS-only transmission',
                ruleId: 'SEC-CSRF-SECURE'
              });
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
    }

    return findings;
  }

  /**
   * Check content security policy
   */
  checkContentSecurityPolicy(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    // Check for CSP meta tag
    const metaTags = htmlAST.elements.filter((el: any) => el.tagName === 'meta');
    const cspMeta = metaTags.find((meta: any) => 
      meta.attributes?.['http-equiv']?.toLowerCase() === 'content-security-policy'
    );

    if (!cspMeta) {
      findings.push({
        id: `SEC-CSP-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'Missing Content Security Policy',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add CSP meta tag: <meta http-equiv="Content-Security-Policy" content="...">',
        ruleId: 'SEC-CSP-MISSING'
      });
    } else {
      const cspContent = cspMeta.attributes?.content || '';
      
      // Check for unsafe-inline
      if (cspContent.includes('unsafe-inline')) {
        findings.push({
          id: `SEC-CSP-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Insecure CSP: unsafe-inline directive allows inline scripts',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Remove unsafe-inline and use nonce or hash-based CSP',
          ruleId: 'SEC-CSP-UNSAFE-INLINE'
        });
      }

      // Check for unsafe-eval
      if (cspContent.includes('unsafe-eval')) {
        findings.push({
          id: `SEC-CSP-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Insecure CSP: unsafe-eval directive allows eval()',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Remove unsafe-eval from CSP',
          ruleId: 'SEC-CSP-UNSAFE-EVAL'
        });
      }

      // Check for wildcard sources
      if (cspContent.includes('*') && !cspContent.includes('*.')) {
        findings.push({
          id: `SEC-CSP-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Overly permissive CSP: wildcard (*) source detected',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Restrict CSP sources to specific domains',
          ruleId: 'SEC-CSP-WILDCARD'
        });
      }
    }

    // Check for inline scripts without nonce
    const scripts = htmlAST.elements.filter((el: any) => el.tagName === 'script');
    const inlineScripts = scripts.filter((script: any) => 
      !script.attributes?.src && !script.attributes?.nonce
    );

    if (inlineScripts.length > 0 && cspMeta) {
      findings.push({
        id: `SEC-CSP-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: `Found ${inlineScripts.length} inline script(s) without nonce attribute`,
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: 'Add nonce attribute to inline scripts or move to external files',
        ruleId: 'SEC-CSP-NONCE'
      });
    }

    return findings;
  }

  /**
   * Detect sensitive data exposure risks
   */
  detectDataExposureRisks(jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!jsAST || !jsAST.ast) {
      return findings;
    }

    const traverse = (node: any, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 50) return;

      // Check for API keys in code
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const value = node.value;
        
        // Common API key patterns (case-insensitive check)
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes('api_key') || lowerValue.includes('apikey') || 
            lowerValue.includes('api-key') || lowerValue.includes('secret') ||
            lowerValue.includes('password') || lowerValue.includes('token')) {
          findings.push({
            id: `SEC-DATA-${findings.length + 1}`,
            severity: Severity.CRITICAL,
            message: 'Potential sensitive data exposure: API key or secret in client-side code',
            location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
            codeSnippet: 'Move sensitive credentials to server-side environment variables',
            ruleId: 'SEC-DATA-APIKEY'
          });
        }
      }

      // Check for localStorage usage with sensitive data
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee?.object?.name === 'localStorage') {
        
        const method = node.callee?.property?.name;
        if (method === 'setItem') {
          const keyArg = node.arguments?.[0];
          if (keyArg?.type === 'Literal') {
            const key = keyArg.value?.toLowerCase() || '';
            if (key.includes('password') || key.includes('token') || 
                key.includes('secret') || key.includes('credit')) {
              findings.push({
                id: `SEC-DATA-${findings.length + 1}`,
                severity: Severity.HIGH,
                message: 'Sensitive data stored in localStorage without encryption',
                location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
                codeSnippet: 'Avoid storing sensitive data in localStorage or encrypt it first',
                ruleId: 'SEC-DATA-LOCALSTORAGE'
              });
            }
          }
        }
      }

      // Check for console.log with potential sensitive data
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee?.object?.name === 'console' &&
          node.callee?.property?.name === 'log') {
        
        findings.push({
          id: `SEC-DATA-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Debug console.log() statement may expose sensitive information',
          location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
          codeSnippet: 'Remove console.log() statements in production code',
          ruleId: 'SEC-DATA-CONSOLE'
        });
      }

      // Check for unencrypted HTTP requests
      if (node.type === 'Literal' && typeof node.value === 'string') {
        if (node.value.startsWith('http://') && !node.value.includes('localhost')) {
          findings.push({
            id: `SEC-DATA-${findings.length + 1}`,
            severity: Severity.HIGH,
            message: 'Unencrypted HTTP connection detected',
            location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
            codeSnippet: 'Use HTTPS instead of HTTP for secure data transmission',
            ruleId: 'SEC-DATA-HTTP'
          });
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
    return findings;
  }

  /**
   * Check input validation patterns
   */
  checkInputValidation(jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!jsAST || !jsAST.ast) {
      return findings;
    }

    const traverse = (node: any, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 50) return;

      // Check for direct user input usage without validation
      if (node.type === 'MemberExpression') {
        const objName = node.object?.name;
        const propName = node.property?.name;

        // Check for direct form input access
        if ((objName === 'document' && propName === 'getElementById') ||
            (objName === 'document' && propName === 'querySelector')) {
          findings.push({
            id: `SEC-INPUT-${findings.length + 1}`,
            severity: Severity.MEDIUM,
            message: 'Potential missing input validation: Direct DOM input access',
            location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
            codeSnippet: 'Validate and sanitize user input before use',
            ruleId: 'SEC-INPUT-VALIDATION'
          });
        }
      }

      // Check for RegExp with potential ReDoS vulnerability
      if (node.type === 'NewExpression' && node.callee?.name === 'RegExp') {
        const patternArg = node.arguments?.[0];
        if (patternArg?.type === 'Literal' && typeof patternArg.value === 'string') {
          const pattern = patternArg.value;
          
          // Check for nested quantifiers (potential ReDoS)
          // Patterns like (a+)+, (a*)+, (a+)*, (a*)* are vulnerable
          const nestedQuantifiers = /\([^)]*[*+][^)]*\)[*+]/.test(pattern);
          if (nestedQuantifiers) {
            findings.push({
              id: `SEC-INPUT-${findings.length + 1}`,
              severity: Severity.MEDIUM,
              message: 'Potential ReDoS vulnerability: Complex regex with nested quantifiers',
              location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
              codeSnippet: 'Simplify regex pattern to avoid catastrophic backtracking',
              ruleId: 'SEC-INPUT-REDOS'
            });
          }
        }
      }

      // Check for weak validation patterns
      if (node.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee?.property?.name === 'match') {
        
        const patternArg = node.arguments?.[0];
        if (patternArg?.type === 'Literal' && typeof patternArg.value === 'string') {
          const pattern = patternArg.value;
          
          // Check for overly permissive patterns
          if (pattern === '.*' || pattern === '.+') {
            findings.push({
              id: `SEC-INPUT-${findings.length + 1}`,
              severity: Severity.LOW,
              message: 'Weak validation pattern: Overly permissive regex',
              location: { file: 'script.js', line: node.loc?.start?.line || 1, column: node.loc?.start?.column || 1 },
              codeSnippet: 'Use more specific validation patterns',
              ruleId: 'SEC-INPUT-WEAK'
            });
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
    return findings;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Group findings by category
    const xssFindings = findings.filter(f => f.ruleId.includes('XSS'));
    const csrfFindings = findings.filter(f => f.ruleId.includes('CSRF'));
    const cspFindings = findings.filter(f => f.ruleId.includes('CSP'));
    const dataFindings = findings.filter(f => f.ruleId.includes('DATA'));
    const inputFindings = findings.filter(f => f.ruleId.includes('INPUT'));

    // XSS recommendations
    if (xssFindings.length > 0) {
      recommendations.push({
        description: 'Implement XSS protection measures',
        priority: this.getPriorityForFindings(xssFindings),
        implementationSteps: [
          'Replace innerHTML with textContent for user-generated content',
          'Remove all eval() calls and use safer alternatives',
          'Sanitize HTML content using DOMPurify or similar library',
          'Use Content Security Policy to prevent inline script execution',
          'Validate and encode all user input before rendering'
        ],
        estimatedImpact: 'HIGH'
      });
    }

    // CSRF recommendations
    if (csrfFindings.length > 0) {
      recommendations.push({
        description: 'Implement CSRF protection',
        priority: this.getPriorityForFindings(csrfFindings),
        implementationSteps: [
          'Add CSRF tokens to all state-changing forms',
          'Set SameSite=Strict or SameSite=Lax on all cookies',
          'Add Secure flag to cookies for HTTPS-only transmission',
          'Implement proper CORS configuration',
          'Verify CSRF tokens on server-side for all POST/PUT/DELETE requests'
        ],
        estimatedImpact: 'HIGH'
      });
    }

    // CSP recommendations
    if (cspFindings.length > 0) {
      recommendations.push({
        description: 'Strengthen Content Security Policy',
        priority: this.getPriorityForFindings(cspFindings),
        implementationSteps: [
          'Add Content-Security-Policy meta tag or HTTP header',
          'Remove unsafe-inline and unsafe-eval directives',
          'Use nonce or hash-based CSP for inline scripts',
          'Restrict script sources to trusted domains only',
          'Move inline scripts to external files'
        ],
        estimatedImpact: 'MEDIUM'
      });
    }

    // Data exposure recommendations
    if (dataFindings.length > 0) {
      recommendations.push({
        description: 'Prevent sensitive data exposure',
        priority: this.getPriorityForFindings(dataFindings),
        implementationSteps: [
          'Move API keys and secrets to server-side environment variables',
          'Avoid storing sensitive data in localStorage',
          'Use HTTPS for all data transmission',
          'Remove console.log() statements in production',
          'Encrypt sensitive data before client-side storage'
        ],
        estimatedImpact: 'HIGH'
      });
    }

    // Input validation recommendations
    if (inputFindings.length > 0) {
      recommendations.push({
        description: 'Improve input validation',
        priority: this.getPriorityForFindings(inputFindings),
        implementationSteps: [
          'Validate all user input on both client and server side',
          'Use specific regex patterns instead of overly permissive ones',
          'Sanitize user input before processing',
          'Avoid complex regex patterns that could cause ReDoS',
          'Implement whitelist-based validation where possible'
        ],
        estimatedImpact: 'MEDIUM'
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
   * Calculate security score
   */
  calculateScore(findings: Finding[]): number {
    let score = 100;
    
    // Security findings are weighted more heavily
    for (const finding of findings) {
      switch (finding.severity) {
        case Severity.CRITICAL:
          score -= 20;
          break;
        case Severity.HIGH:
          score -= 12;
          break;
        case Severity.MEDIUM:
          score -= 6;
          break;
        case Severity.LOW:
          score -= 3;
          break;
        case Severity.INFO:
          score -= 1;
          break;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
}