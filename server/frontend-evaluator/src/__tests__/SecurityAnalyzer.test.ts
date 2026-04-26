/**
 * Tests for SecurityAnalyzer component
 */

import { SecurityAnalyzer } from '../analyzers/SecurityAnalyzer';
import { Severity } from '../types';

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  test('should create instance', () => {
    expect(analyzer).toBeInstanceOf(SecurityAnalyzer);
  });

  describe('XSS vulnerability detection', () => {
    test('should detect innerHTML usage', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'AssignmentExpression',
                left: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'element' },
                  property: { type: 'Identifier', name: 'innerHTML' }
                },
                right: { type: 'Identifier', name: 'userInput' }
              }
            }
          ]
        }
      };

      const findings = analyzer.detectXSSVulnerabilities(jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const innerHTMLFinding = findings.find(f => f.message.includes('innerHTML'));
      expect(innerHTMLFinding).toBeDefined();
      expect(innerHTMLFinding?.severity).toBe(Severity.HIGH);
      expect(innerHTMLFinding?.ruleId).toBe('SEC-XSS-INNERHTML');
    });

    test('should detect eval() usage', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: { type: 'Identifier', name: 'eval' },
                arguments: [{ type: 'Literal', value: 'alert(1)' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.detectXSSVulnerabilities(jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const evalFinding = findings.find(f => f.message.includes('eval'));
      expect(evalFinding).toBeDefined();
      expect(evalFinding?.severity).toBe(Severity.CRITICAL);
      expect(evalFinding?.ruleId).toBe('SEC-XSS-EVAL');
    });

    test('should detect document.write usage', () => {
      const jsAST = {
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
                  property: { type: 'Identifier', name: 'write' }
                },
                arguments: [{ type: 'Literal', value: '<script>alert(1)</script>' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.detectXSSVulnerabilities(jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const docWriteFinding = findings.find(f => f.message.includes('document.write'));
      expect(docWriteFinding).toBeDefined();
      expect(docWriteFinding?.severity).toBe(Severity.HIGH);
      expect(docWriteFinding?.ruleId).toBe('SEC-XSS-DOCWRITE');
    });
  });

  describe('CSRF protection checks', () => {
    test('should detect missing CSRF token in POST form', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'form', 
            attributes: { method: 'post', action: '/submit' },
            parentTag: 'body'
          },
          {
            tagName: 'input',
            attributes: { type: 'text', name: 'username' },
            parentTag: 'form'
          }
        ]
      };

      const jsAST = { ast: { type: 'Program', body: [] } };
      const findings = analyzer.checkCSRFProtection(htmlAST, jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const csrfFinding = findings.find(f => f.message.includes('CSRF token'));
      expect(csrfFinding).toBeDefined();
      expect(csrfFinding?.severity).toBe(Severity.HIGH);
      expect(csrfFinding?.ruleId).toBe('SEC-CSRF-TOKEN');
    });

    test('should not flag form with CSRF token', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'form', 
            attributes: { method: 'post', action: '/submit' },
            parentTag: 'body'
          },
          {
            tagName: 'input',
            attributes: { type: 'hidden', name: 'csrf_token', value: 'abc123' },
            parentTag: 'form'
          }
        ]
      };

      const jsAST = { ast: { type: 'Program', body: [] } };
      const findings = analyzer.checkCSRFProtection(htmlAST, jsAST);
      
      const csrfTokenFinding = findings.find(f => f.ruleId === 'SEC-CSRF-TOKEN');
      expect(csrfTokenFinding).toBeUndefined();
    });

    test('should detect missing SameSite attribute on cookie', () => {
      const htmlAST = { elements: [] };
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'AssignmentExpression',
                left: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'document' },
                  property: { type: 'Identifier', name: 'cookie' }
                },
                right: { type: 'Literal', value: 'session=abc123; Path=/' }
              }
            }
          ]
        }
      };

      const findings = analyzer.checkCSRFProtection(htmlAST, jsAST);
      
      const sameSiteFinding = findings.find(f => f.message.includes('SameSite'));
      expect(sameSiteFinding).toBeDefined();
      expect(sameSiteFinding?.severity).toBe(Severity.MEDIUM);
      expect(sameSiteFinding?.ruleId).toBe('SEC-CSRF-SAMESITE');
    });

    test('should detect missing Secure flag on cookie', () => {
      const htmlAST = { elements: [] };
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'AssignmentExpression',
                left: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'document' },
                  property: { type: 'Identifier', name: 'cookie' }
                },
                right: { type: 'Literal', value: 'session=abc123; SameSite=Strict' }
              }
            }
          ]
        }
      };

      const findings = analyzer.checkCSRFProtection(htmlAST, jsAST);
      
      const secureFinding = findings.find(f => f.message.includes('Secure flag'));
      expect(secureFinding).toBeDefined();
      expect(secureFinding?.severity).toBe(Severity.MEDIUM);
      expect(secureFinding?.ruleId).toBe('SEC-CSRF-SECURE');
    });
  });

  describe('Content Security Policy checks', () => {
    test('should detect missing CSP', () => {
      const htmlAST = {
        elements: [
          { tagName: 'meta', attributes: { name: 'viewport', content: 'width=device-width' } }
        ]
      };

      const findings = analyzer.checkContentSecurityPolicy(htmlAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const cspFinding = findings.find(f => f.message.includes('Missing Content Security Policy'));
      expect(cspFinding).toBeDefined();
      expect(cspFinding?.severity).toBe(Severity.MEDIUM);
      expect(cspFinding?.ruleId).toBe('SEC-CSP-MISSING');
    });

    test('should detect unsafe-inline in CSP', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'meta', 
            attributes: { 
              'http-equiv': 'Content-Security-Policy',
              content: "default-src 'self' 'unsafe-inline'"
            } 
          }
        ]
      };

      const findings = analyzer.checkContentSecurityPolicy(htmlAST);
      
      const unsafeInlineFinding = findings.find(f => f.message.includes('unsafe-inline'));
      expect(unsafeInlineFinding).toBeDefined();
      expect(unsafeInlineFinding?.severity).toBe(Severity.HIGH);
      expect(unsafeInlineFinding?.ruleId).toBe('SEC-CSP-UNSAFE-INLINE');
    });

    test('should detect unsafe-eval in CSP', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'meta', 
            attributes: { 
              'http-equiv': 'Content-Security-Policy',
              content: "default-src 'self' 'unsafe-eval'"
            } 
          }
        ]
      };

      const findings = analyzer.checkContentSecurityPolicy(htmlAST);
      
      const unsafeEvalFinding = findings.find(f => f.message.includes('unsafe-eval'));
      expect(unsafeEvalFinding).toBeDefined();
      expect(unsafeEvalFinding?.severity).toBe(Severity.HIGH);
      expect(unsafeEvalFinding?.ruleId).toBe('SEC-CSP-UNSAFE-EVAL');
    });

    test('should detect wildcard in CSP', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'meta', 
            attributes: { 
              'http-equiv': 'Content-Security-Policy',
              content: "default-src *"
            } 
          }
        ]
      };

      const findings = analyzer.checkContentSecurityPolicy(htmlAST);
      
      const wildcardFinding = findings.find(f => f.message.includes('wildcard'));
      expect(wildcardFinding).toBeDefined();
      expect(wildcardFinding?.severity).toBe(Severity.MEDIUM);
      expect(wildcardFinding?.ruleId).toBe('SEC-CSP-WILDCARD');
    });

    test('should detect inline scripts without nonce', () => {
      const htmlAST = {
        elements: [
          { 
            tagName: 'meta', 
            attributes: { 
              'http-equiv': 'Content-Security-Policy',
              content: "default-src 'self'"
            } 
          },
          {
            tagName: 'script',
            attributes: {}, // No src, no nonce - inline script
            parentTag: 'body'
          }
        ]
      };

      const findings = analyzer.checkContentSecurityPolicy(htmlAST);
      
      const nonceFinding = findings.find(f => f.message.includes('nonce'));
      expect(nonceFinding).toBeDefined();
      expect(nonceFinding?.severity).toBe(Severity.MEDIUM);
      expect(nonceFinding?.ruleId).toBe('SEC-CSP-NONCE');
    });
  });

  describe('Data exposure detection', () => {
    test('should detect API key in code', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: 'key' },
                  init: { type: 'Literal', value: 'api_key_12345' }
                }
              ]
            }
          ]
        }
      };

      const findings = analyzer.detectDataExposureRisks(jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const apiKeyFinding = findings.find(f => f.message.includes('API key'));
      expect(apiKeyFinding).toBeDefined();
      expect(apiKeyFinding?.severity).toBe(Severity.CRITICAL);
      expect(apiKeyFinding?.ruleId).toBe('SEC-DATA-APIKEY');
    });

    test('should detect sensitive data in localStorage', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'localStorage' },
                  property: { type: 'Identifier', name: 'setItem' }
                },
                arguments: [
                  { type: 'Literal', value: 'user_password' },
                  { type: 'Identifier', name: 'password' }
                ]
              }
            }
          ]
        }
      };

      const findings = analyzer.detectDataExposureRisks(jsAST);
      
      const localStorageFinding = findings.find(f => f.message.includes('localStorage'));
      expect(localStorageFinding).toBeDefined();
      expect(localStorageFinding?.severity).toBe(Severity.HIGH);
      expect(localStorageFinding?.ruleId).toBe('SEC-DATA-LOCALSTORAGE');
    });

    test('should detect console.log statements', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'console' },
                  property: { type: 'Identifier', name: 'log' }
                },
                arguments: [{ type: 'Literal', value: 'Debug info' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.detectDataExposureRisks(jsAST);
      
      const consoleFinding = findings.find(f => f.message.includes('console.log'));
      expect(consoleFinding).toBeDefined();
      expect(consoleFinding?.severity).toBe(Severity.LOW);
      expect(consoleFinding?.ruleId).toBe('SEC-DATA-CONSOLE');
    });

    test('should detect unencrypted HTTP connections', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: { type: 'Identifier', name: 'fetch' },
                arguments: [{ type: 'Literal', value: 'http://api.example.com/data' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.detectDataExposureRisks(jsAST);
      
      const httpFinding = findings.find(f => f.message.includes('HTTP connection'));
      expect(httpFinding).toBeDefined();
      expect(httpFinding?.severity).toBe(Severity.HIGH);
      expect(httpFinding?.ruleId).toBe('SEC-DATA-HTTP');
    });
  });

  describe('Input validation checks', () => {
    test('should detect direct DOM input access', () => {
      const jsAST = {
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
                  property: { type: 'Identifier', name: 'getElementById' }
                },
                arguments: [{ type: 'Literal', value: 'userInput' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.checkInputValidation(jsAST);
      
      expect(findings.length).toBeGreaterThan(0);
      const validationFinding = findings.find(f => f.message.includes('input validation'));
      expect(validationFinding).toBeDefined();
      expect(validationFinding?.severity).toBe(Severity.MEDIUM);
      expect(validationFinding?.ruleId).toBe('SEC-INPUT-VALIDATION');
    });

    test('should detect potential ReDoS vulnerability', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'NewExpression',
                callee: { type: 'Identifier', name: 'RegExp' },
                arguments: [{ type: 'Literal', value: '(a+)+b' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.checkInputValidation(jsAST);
      
      const redosFinding = findings.find(f => f.message.includes('ReDoS'));
      expect(redosFinding).toBeDefined();
      expect(redosFinding?.severity).toBe(Severity.MEDIUM);
      expect(redosFinding?.ruleId).toBe('SEC-INPUT-REDOS');
    });

    test('should detect weak validation patterns', () => {
      const jsAST = {
        ast: {
          type: 'Program',
          body: [
            {
              type: 'ExpressionStatement',
              expression: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'input' },
                  property: { type: 'Identifier', name: 'match' }
                },
                arguments: [{ type: 'Literal', value: '.*' }]
              }
            }
          ]
        }
      };

      const findings = analyzer.checkInputValidation(jsAST);
      
      const weakFinding = findings.find(f => f.message.includes('Weak validation'));
      expect(weakFinding).toBeDefined();
      expect(weakFinding?.severity).toBe(Severity.LOW);
      expect(weakFinding?.ruleId).toBe('SEC-INPUT-WEAK');
    });
  });

  describe('Recommendation generation', () => {
    test('should generate XSS recommendations', () => {
      const findings = [
        {
          id: 'SEC-XSS-1',
          severity: Severity.HIGH,
          message: 'innerHTML usage detected',
          location: { file: 'app.js', line: 10, column: 5 },
          codeSnippet: 'Use textContent',
          ruleId: 'SEC-XSS-INNERHTML'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const xssRec = recommendations.find(r => r.description.includes('XSS'));
      expect(xssRec).toBeDefined();
      expect(xssRec?.priority).toBe('HIGH');
      expect(xssRec?.implementationSteps.length).toBeGreaterThan(0);
    });

    test('should generate CSRF recommendations', () => {
      const findings = [
        {
          id: 'SEC-CSRF-1',
          severity: Severity.HIGH,
          message: 'Missing CSRF token',
          location: { file: 'index.html', line: 20, column: 1 },
          codeSnippet: 'Add CSRF token',
          ruleId: 'SEC-CSRF-TOKEN'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const csrfRec = recommendations.find(r => r.description.includes('CSRF'));
      expect(csrfRec).toBeDefined();
      expect(csrfRec?.priority).toBe('HIGH');
    });

    test('should generate CSP recommendations', () => {
      const findings = [
        {
          id: 'SEC-CSP-1',
          severity: Severity.MEDIUM,
          message: 'Missing CSP',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Add CSP',
          ruleId: 'SEC-CSP-MISSING'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const cspRec = recommendations.find(r => r.description.includes('Content Security Policy'));
      expect(cspRec).toBeDefined();
      expect(cspRec?.priority).toBe('MEDIUM');
    });

    test('should generate data exposure recommendations', () => {
      const findings = [
        {
          id: 'SEC-DATA-1',
          severity: Severity.CRITICAL,
          message: 'API key in code',
          location: { file: 'app.js', line: 5, column: 10 },
          codeSnippet: 'Move to env',
          ruleId: 'SEC-DATA-APIKEY'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const dataRec = recommendations.find(r => r.description.includes('sensitive data'));
      expect(dataRec).toBeDefined();
      expect(dataRec?.priority).toBe('HIGH');
    });

    test('should generate input validation recommendations', () => {
      const findings = [
        {
          id: 'SEC-INPUT-1',
          severity: Severity.MEDIUM,
          message: 'Missing validation',
          location: { file: 'app.js', line: 15, column: 3 },
          codeSnippet: 'Add validation',
          ruleId: 'SEC-INPUT-VALIDATION'
        }
      ];

      const recommendations = analyzer.generateRecommendations(findings);
      
      expect(recommendations.length).toBeGreaterThan(0);
      const inputRec = recommendations.find(r => r.description.includes('input validation'));
      expect(inputRec).toBeDefined();
      expect(inputRec?.priority).toBe('MEDIUM');
    });
  });

  describe('Score calculation', () => {
    test('should calculate score based on findings', () => {
      const findings = [
        {
          id: 'test-1',
          severity: Severity.CRITICAL,
          message: 'Critical issue',
          location: { file: 'app.js', line: 1, column: 1 },
          codeSnippet: 'Fix',
          ruleId: 'SEC-TEST-1'
        },
        {
          id: 'test-2',
          severity: Severity.HIGH,
          message: 'High issue',
          location: { file: 'app.js', line: 2, column: 1 },
          codeSnippet: 'Fix',
          ruleId: 'SEC-TEST-2'
        },
        {
          id: 'test-3',
          severity: Severity.MEDIUM,
          message: 'Medium issue',
          location: { file: 'app.js', line: 3, column: 1 },
          codeSnippet: 'Fix',
          ruleId: 'SEC-TEST-3'
        }
      ];

      const score = analyzer.calculateScore(findings);
      
      // Starting: 100
      // CRITICAL: -20, HIGH: -12, MEDIUM: -6 = -38 total
      // Expected: 62
      expect(score).toBe(62);
    });

    test('should not go below 0', () => {
      const findings = Array(10).fill({
        id: 'test',
        severity: Severity.CRITICAL,
        message: 'Critical',
        location: { file: 'app.js', line: 1, column: 1 },
        codeSnippet: 'Fix',
        ruleId: 'SEC-TEST'
      });

      const score = analyzer.calculateScore(findings);
      
      // 10 * 20 = 200 points deducted, should be capped at 0
      expect(score).toBe(0);
    });

    test('should not exceed 100', () => {
      const findings: any[] = [];

      const score = analyzer.calculateScore(findings);
      
      expect(score).toBe(100);
    });
  });
});
