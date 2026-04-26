/**
 * Property-Based Tests for SecurityAnalyzer
 * 
 * Property 2: Security Vulnerability Detection Consistency
 * For any JavaScript code containing security patterns, the security analyzer 
 * should consistently detect the same vulnerabilities across multiple analyses
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import { SecurityAnalyzer } from '../analyzers/SecurityAnalyzer';
import { Severity } from '../types';

describe('SecurityAnalyzer - Property-Based Tests', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  describe('Property 2: Security Vulnerability Detection Consistency', () => {
    test('should detect XSS vulnerabilities consistently across multiple analyses', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasInnerHTML: fc.boolean(),
            hasEval: fc.boolean(),
            hasDocWrite: fc.boolean(),
            variableName: fc.constantFrom('element', 'div', 'container', 'node'),
            functionName: fc.constantFrom('handleClick', 'render', 'update', 'process')
          }),
          (config) => {
            // Generate JavaScript AST with XSS patterns
            const body: any[] = [];

            if (config.hasInnerHTML) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'AssignmentExpression',
                  left: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: config.variableName },
                    property: { type: 'Identifier', name: 'innerHTML' }
                  },
                  right: { type: 'Identifier', name: 'userInput' }
                }
              });
            }

            if (config.hasEval) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: { type: 'Identifier', name: 'eval' },
                  arguments: [{ type: 'Literal', value: 'alert(1)' }]
                }
              });
            }

            if (config.hasDocWrite) {
              body.push({
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
              });
            }

            const jsAST = {
              ast: {
                type: 'Program',
                body
              }
            };

            // Run analysis multiple times
            const results1 = analyzer.detectXSSVulnerabilities(jsAST);
            const results2 = analyzer.detectXSSVulnerabilities(jsAST);
            const results3 = analyzer.detectXSSVulnerabilities(jsAST);

            // Property: Results should be consistent across multiple analyses
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected number of findings
            let expectedFindings = 0;
            if (config.hasInnerHTML) expectedFindings++;
            if (config.hasEval) expectedFindings++;
            if (config.hasDocWrite) expectedFindings++;

            expect(results1.length).toBe(expectedFindings);

            // Verify severity consistency
            if (config.hasInnerHTML) {
              const innerHTMLFindings = results1.filter(f => f.ruleId === 'SEC-XSS-INNERHTML');
              expect(innerHTMLFindings.length).toBe(1);
              expect(innerHTMLFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.hasEval) {
              const evalFindings = results1.filter(f => f.ruleId === 'SEC-XSS-EVAL');
              expect(evalFindings.length).toBe(1);
              expect(evalFindings[0].severity).toBe(Severity.CRITICAL);
            }

            if (config.hasDocWrite) {
              const docWriteFindings = results1.filter(f => f.ruleId === 'SEC-XSS-DOCWRITE');
              expect(docWriteFindings.length).toBe(1);
              expect(docWriteFindings[0].severity).toBe(Severity.HIGH);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect CSRF protection issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasForm: fc.boolean(),
            hasCSRFToken: fc.boolean(),
            hasCookie: fc.boolean(),
            hasSameSite: fc.boolean(),
            hasSecure: fc.boolean(),
            formMethod: fc.constantFrom('post', 'put', 'delete', 'get')
          }),
          (config) => {
            // Generate HTML AST
            const elements: any[] = [];

            if (config.hasForm) {
              elements.push({
                tagName: 'form',
                attributes: { method: config.formMethod, action: '/submit' },
                parentTag: 'body'
              });

              if (config.hasCSRFToken) {
                elements.push({
                  tagName: 'input',
                  attributes: { type: 'hidden', name: 'csrf_token', value: 'abc123' },
                  parentTag: 'form'
                });
              } else {
                elements.push({
                  tagName: 'input',
                  attributes: { type: 'text', name: 'username' },
                  parentTag: 'form'
                });
              }
            }

            const htmlAST = { elements };

            // Generate JavaScript AST for cookie
            const jsBody: any[] = [];
            if (config.hasCookie) {
              let cookieValue = 'session=abc123';
              if (config.hasSameSite) cookieValue += '; SameSite=Strict';
              if (config.hasSecure) cookieValue += '; Secure';

              jsBody.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'AssignmentExpression',
                  left: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'document' },
                    property: { type: 'Identifier', name: 'cookie' }
                  },
                  right: { type: 'Literal', value: cookieValue }
                }
              });
            }

            const jsAST = {
              ast: {
                type: 'Program',
                body: jsBody
              }
            };

            // Run analysis multiple times
            const results1 = analyzer.checkCSRFProtection(htmlAST, jsAST);
            const results2 = analyzer.checkCSRFProtection(htmlAST, jsAST);
            const results3 = analyzer.checkCSRFProtection(htmlAST, jsAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (config.hasForm && !config.hasCSRFToken && 
                (config.formMethod === 'post' || config.formMethod === 'put' || config.formMethod === 'delete')) {
              const csrfTokenFindings = results1.filter(f => f.ruleId === 'SEC-CSRF-TOKEN');
              expect(csrfTokenFindings.length).toBeGreaterThan(0);
            }

            if (config.hasCookie) {
              if (!config.hasSameSite) {
                const sameSiteFindings = results1.filter(f => f.ruleId === 'SEC-CSRF-SAMESITE');
                expect(sameSiteFindings.length).toBeGreaterThan(0);
              }
              if (!config.hasSecure) {
                const secureFindings = results1.filter(f => f.ruleId === 'SEC-CSRF-SECURE');
                expect(secureFindings.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect CSP issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasCSP: fc.boolean(),
            hasUnsafeInline: fc.boolean(),
            hasUnsafeEval: fc.boolean(),
            hasWildcard: fc.boolean(),
            inlineScriptCount: fc.integer({ min: 0, max: 5 })
          }),
          (config) => {
            const elements: any[] = [];

            if (config.hasCSP) {
              let cspContent = "default-src 'self'";
              if (config.hasWildcard) {
                cspContent = "default-src *";
              } else {
                if (config.hasUnsafeInline) cspContent += " 'unsafe-inline'";
                if (config.hasUnsafeEval) cspContent += " 'unsafe-eval'";
              }

              elements.push({
                tagName: 'meta',
                attributes: {
                  'http-equiv': 'Content-Security-Policy',
                  content: cspContent
                }
              });
            } else {
              elements.push({
                tagName: 'meta',
                attributes: { name: 'viewport', content: 'width=device-width' }
              });
            }

            // Add inline scripts
            for (let i = 0; i < config.inlineScriptCount; i++) {
              elements.push({
                tagName: 'script',
                attributes: {}, // No src, no nonce
                parentTag: 'body'
              });
            }

            const htmlAST = { elements };

            // Run analysis multiple times
            const results1 = analyzer.checkContentSecurityPolicy(htmlAST);
            const results2 = analyzer.checkContentSecurityPolicy(htmlAST);
            const results3 = analyzer.checkContentSecurityPolicy(htmlAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (!config.hasCSP) {
              const missingCSP = results1.filter(f => f.ruleId === 'SEC-CSP-MISSING');
              expect(missingCSP.length).toBe(1);
            }

            if (config.hasCSP && !config.hasWildcard) {
              if (config.hasUnsafeInline) {
                const unsafeInline = results1.filter(f => f.ruleId === 'SEC-CSP-UNSAFE-INLINE');
                expect(unsafeInline.length).toBe(1);
              }

              if (config.hasUnsafeEval) {
                const unsafeEval = results1.filter(f => f.ruleId === 'SEC-CSP-UNSAFE-EVAL');
                expect(unsafeEval.length).toBe(1);
              }
            }

            if (config.hasCSP && config.hasWildcard) {
              const wildcard = results1.filter(f => f.ruleId === 'SEC-CSP-WILDCARD');
              expect(wildcard.length).toBe(1);
            }

            if (config.hasCSP && config.inlineScriptCount > 0) {
              const nonce = results1.filter(f => f.ruleId === 'SEC-CSP-NONCE');
              expect(nonce.length).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect data exposure risks consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasAPIKey: fc.boolean(),
            hasLocalStorage: fc.boolean(),
            hasConsoleLog: fc.boolean(),
            hasHTTP: fc.boolean(),
            apiKeyPattern: fc.constantFrom('api_key', 'apikey', 'secret', 'password', 'token'),
            storageKey: fc.constantFrom('user_password', 'auth_token', 'credit_card', 'api_secret')
          }),
          (config) => {
            const body: any[] = [];

            if (config.hasAPIKey) {
              body.push({
                type: 'VariableDeclaration',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: { type: 'Identifier', name: 'key' },
                    init: { type: 'Literal', value: `${config.apiKeyPattern}_12345` }
                  }
                ]
              });
            }

            if (config.hasLocalStorage) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'localStorage' },
                    property: { type: 'Identifier', name: 'setItem' }
                  },
                  arguments: [
                    { type: 'Literal', value: config.storageKey },
                    { type: 'Identifier', name: 'sensitiveData' }
                  ]
                }
              });
            }

            if (config.hasConsoleLog) {
              body.push({
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
              });
            }

            if (config.hasHTTP) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: { type: 'Identifier', name: 'fetch' },
                  arguments: [{ type: 'Literal', value: 'http://api.example.com/data' }]
                }
              });
            }

            const jsAST = {
              ast: {
                type: 'Program',
                body
              }
            };

            // Run analysis multiple times
            const results1 = analyzer.detectDataExposureRisks(jsAST);
            const results2 = analyzer.detectDataExposureRisks(jsAST);
            const results3 = analyzer.detectDataExposureRisks(jsAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (config.hasAPIKey) {
              const apiKeyFindings = results1.filter(f => f.ruleId === 'SEC-DATA-APIKEY');
              expect(apiKeyFindings.length).toBeGreaterThan(0);
              expect(apiKeyFindings[0].severity).toBe(Severity.CRITICAL);
            }

            if (config.hasLocalStorage) {
              const localStorageFindings = results1.filter(f => f.ruleId === 'SEC-DATA-LOCALSTORAGE');
              expect(localStorageFindings.length).toBeGreaterThan(0);
              expect(localStorageFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.hasConsoleLog) {
              const consoleFindings = results1.filter(f => f.ruleId === 'SEC-DATA-CONSOLE');
              expect(consoleFindings.length).toBeGreaterThan(0);
              expect(consoleFindings[0].severity).toBe(Severity.LOW);
            }

            if (config.hasHTTP) {
              const httpFindings = results1.filter(f => f.ruleId === 'SEC-DATA-HTTP');
              expect(httpFindings.length).toBeGreaterThan(0);
              expect(httpFindings[0].severity).toBe(Severity.HIGH);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect input validation issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasDOMAccess: fc.boolean(),
            hasReDoS: fc.boolean(),
            hasWeakValidation: fc.boolean(),
            domMethod: fc.constantFrom('getElementById', 'querySelector'),
            redosPattern: fc.constantFrom('(a+)+b', '(x*)*y', '(.*)*z')
          }),
          (config) => {
            const body: any[] = [];

            if (config.hasDOMAccess) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'document' },
                    property: { type: 'Identifier', name: config.domMethod }
                  },
                  arguments: [{ type: 'Literal', value: 'userInput' }]
                }
              });
            }

            if (config.hasReDoS) {
              body.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'NewExpression',
                  callee: { type: 'Identifier', name: 'RegExp' },
                  arguments: [{ type: 'Literal', value: config.redosPattern }]
                }
              });
            }

            if (config.hasWeakValidation) {
              body.push({
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
              });
            }

            const jsAST = {
              ast: {
                type: 'Program',
                body
              }
            };

            // Run analysis multiple times
            const results1 = analyzer.checkInputValidation(jsAST);
            const results2 = analyzer.checkInputValidation(jsAST);
            const results3 = analyzer.checkInputValidation(jsAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (config.hasDOMAccess) {
              const validationFindings = results1.filter(f => f.ruleId === 'SEC-INPUT-VALIDATION');
              expect(validationFindings.length).toBeGreaterThan(0);
              expect(validationFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasReDoS) {
              const redosFindings = results1.filter(f => f.ruleId === 'SEC-INPUT-REDOS');
              expect(redosFindings.length).toBeGreaterThan(0);
              expect(redosFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasWeakValidation) {
              const weakFindings = results1.filter(f => f.ruleId === 'SEC-INPUT-WEAK');
              expect(weakFindings.length).toBeGreaterThan(0);
              expect(weakFindings[0].severity).toBe(Severity.LOW);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should generate consistent recommendations across analyses', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              ruleId: fc.constantFrom(
                'SEC-XSS-INNERHTML',
                'SEC-CSRF-TOKEN',
                'SEC-CSP-MISSING',
                'SEC-DATA-APIKEY',
                'SEC-INPUT-VALIDATION'
              ),
              severity: fc.constantFrom(Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (findingsConfig) => {
            // Generate findings from config
            const findings = findingsConfig.map((config, index) => ({
              id: `SEC-${index + 1}`,
              severity: config.severity,
              message: `Test finding ${index + 1}`,
              location: { file: 'test.js', line: index + 1, column: 1 },
              codeSnippet: 'test code',
              ruleId: config.ruleId
            }));

            // Run recommendation generation multiple times
            const recs1 = analyzer.generateRecommendations(findings);
            const recs2 = analyzer.generateRecommendations(findings);
            const recs3 = analyzer.generateRecommendations(findings);

            // Property: Recommendations should be consistent
            expect(recs1.length).toBe(recs2.length);
            expect(recs2.length).toBe(recs3.length);

            // Verify recommendation structure
            recs1.forEach(rec => {
              expect(rec.description).toBeDefined();
              expect(rec.priority).toBeDefined();
              expect(rec.implementationSteps).toBeDefined();
              expect(rec.implementationSteps.length).toBeGreaterThan(0);
              expect(rec.estimatedImpact).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should calculate consistent security scores', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              severity: fc.constantFrom(
                Severity.CRITICAL,
                Severity.HIGH,
                Severity.MEDIUM,
                Severity.LOW,
                Severity.INFO
              )
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (findingsConfig) => {
            // Generate findings
            const findings = findingsConfig.map((config, index) => ({
              id: `SEC-${index + 1}`,
              severity: config.severity,
              message: `Test finding ${index + 1}`,
              location: { file: 'test.js', line: index + 1, column: 1 },
              codeSnippet: 'test code',
              ruleId: `SEC-TEST-${index + 1}`
            }));

            // Run score calculation multiple times
            const score1 = analyzer.calculateScore(findings);
            const score2 = analyzer.calculateScore(findings);
            const score3 = analyzer.calculateScore(findings);

            // Property: Scores should be consistent
            expect(score1).toBe(score2);
            expect(score2).toBe(score3);

            // Property: Score should be in valid range
            expect(score1).toBeGreaterThanOrEqual(0);
            expect(score1).toBeLessThanOrEqual(100);

            // Property: More severe findings should result in lower scores
            const criticalCount = findingsConfig.filter(f => f.severity === Severity.CRITICAL).length;
            const highCount = findingsConfig.filter(f => f.severity === Severity.HIGH).length;
            
            const expectedDeduction = (criticalCount * 20) + (highCount * 12);
            const expectedScore = Math.max(0, 100 - expectedDeduction);
            
            // Score should be at most the expected score (could be lower due to other severities)
            expect(score1).toBeLessThanOrEqual(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
