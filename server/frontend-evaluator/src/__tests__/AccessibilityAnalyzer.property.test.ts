/**
 * Property-Based Tests for AccessibilityAnalyzer
 * 
 * Property 3: Accessibility Analysis Completeness
 * For any HTML markup with accessibility attributes, the accessibility analyzer 
 * should identify all relevant WCAG compliance issues
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import * as fc from 'fast-check';
import { AccessibilityAnalyzer } from '../analyzers/AccessibilityAnalyzer';
import { Severity } from '../types';

describe('AccessibilityAnalyzer - Property-Based Tests', () => {
  let analyzer: AccessibilityAnalyzer;

  beforeEach(() => {
    analyzer = new AccessibilityAnalyzer();
  });

  describe('Property 3: Accessibility Analysis Completeness', () => {
    test('should detect semantic structure issues consistently across multiple analyses', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasMain: fc.boolean(),
            hasNav: fc.boolean(),
            hasHeader: fc.boolean(),
            hasFooter: fc.boolean(),
            divCount: fc.integer({ min: 0, max: 30 }),
            hasInteractiveDiv: fc.boolean(),
            hasLinkWithoutHref: fc.boolean(),
            hasInputWithoutLabel: fc.boolean(),
            hasRedundantRole: fc.boolean(),
            hasAriaHiddenOnFocusable: fc.boolean()
          }),
          (config) => {
            // Generate HTML AST based on configuration
            const elements: any[] = [];

            if (config.hasMain) {
              elements.push({ tagName: 'main', attributes: {} });
            }

            if (config.hasNav) {
              elements.push({ tagName: 'nav', attributes: {} });
            }

            if (config.hasHeader) {
              elements.push({ tagName: 'header', attributes: {} });
            }

            if (config.hasFooter) {
              elements.push({ tagName: 'footer', attributes: {} });
            }

            // Add divs
            for (let i = 0; i < config.divCount; i++) {
              elements.push({ tagName: 'div', attributes: {} });
            }

            if (config.hasInteractiveDiv) {
              elements.push({
                tagName: 'div',
                attributes: { onclick: 'handleClick()' }
              });
            }

            if (config.hasLinkWithoutHref) {
              elements.push({
                tagName: 'a',
                attributes: { class: 'link' }
              });
            }

            if (config.hasInputWithoutLabel) {
              elements.push({
                tagName: 'input',
                attributes: { type: 'text', id: 'username' }
              });
            }

            if (config.hasRedundantRole) {
              elements.push({
                tagName: 'button',
                attributes: { role: 'button' }
              });
            }

            if (config.hasAriaHiddenOnFocusable) {
              elements.push({
                tagName: 'button',
                attributes: { 'aria-hidden': 'true' }
              });
            }

            const htmlAST = { elements };

            // Run analysis multiple times
            const results1 = analyzer.checkSemanticStructure(htmlAST);
            const results2 = analyzer.checkSemanticStructure(htmlAST);
            const results3 = analyzer.checkSemanticStructure(htmlAST);

            // Property: Results should be consistent across multiple analyses
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings based on configuration
            if (!config.hasMain) {
              const mainFindings = results1.filter(f => f.ruleId === 'A11Y-SEM-MAIN');
              expect(mainFindings.length).toBe(1);
              expect(mainFindings[0].severity).toBe(Severity.HIGH);
            }

            if (!config.hasNav) {
              const navFindings = results1.filter(f => f.ruleId === 'A11Y-SEM-NAV');
              expect(navFindings.length).toBe(1);
              expect(navFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (!config.hasHeader) {
              const headerFindings = results1.filter(f => f.ruleId === 'A11Y-SEM-HEADER');
              expect(headerFindings.length).toBe(1);
              expect(headerFindings[0].severity).toBe(Severity.LOW);
            }

            if (!config.hasFooter) {
              const footerFindings = results1.filter(f => f.ruleId === 'A11Y-SEM-FOOTER');
              expect(footerFindings.length).toBe(1);
              expect(footerFindings[0].severity).toBe(Severity.LOW);
            }

            if (config.divCount > 20) {
              const divFindings = results1.filter(f => f.ruleId === 'A11Y-SEM-DIV');
              expect(divFindings.length).toBe(1);
              expect(divFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasInteractiveDiv) {
              const roleFindings = results1.filter(f => f.ruleId === 'A11Y-ARIA-ROLE');
              expect(roleFindings.length).toBe(1);
              expect(roleFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.hasLinkWithoutHref) {
              const hrefFindings = results1.filter(f => f.ruleId === 'A11Y-LINK-HREF');
              expect(hrefFindings.length).toBe(1);
              expect(hrefFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasInputWithoutLabel) {
              const labelFindings = results1.filter(f => f.ruleId === 'A11Y-FORM-LABEL');
              expect(labelFindings.length).toBe(1);
              expect(labelFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.hasRedundantRole) {
              const redundantFindings = results1.filter(f => f.ruleId === 'A11Y-ARIA-REDUNDANT');
              expect(redundantFindings.length).toBe(1);
              expect(redundantFindings[0].severity).toBe(Severity.LOW);
            }

            if (config.hasAriaHiddenOnFocusable) {
              const hiddenFindings = results1.filter(f => f.ruleId === 'A11Y-ARIA-HIDDEN');
              expect(hiddenFindings.length).toBe(1);
              expect(hiddenFindings[0].severity).toBe(Severity.HIGH);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect color contrast issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            textColor: fc.constantFrom('#000000', '#FFFFFF', '#808080', '#FF0000', 'rgb(0,0,0)', 'rgb(255,255,255)', 'black', 'white'),
            bgColor: fc.constantFrom('#FFFFFF', '#000000', '#F0F0F0', '#333333', 'rgb(255,255,255)', 'rgb(0,0,0)', 'white', 'black'),
            hasColors: fc.boolean()
          }),
          (config) => {
            const properties: any[] = [];

            if (config.hasColors) {
              properties.push({
                property: 'color',
                value: config.textColor
              });
              properties.push({
                property: 'background-color',
                value: config.bgColor
              });
            }

            const cssAST = { properties };

            // Run analysis multiple times
            const results1 = analyzer.checkColorContrast({}, cssAST);
            const results2 = analyzer.checkColorContrast({}, cssAST);
            const results3 = analyzer.checkColorContrast({}, cssAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify findings structure
            results1.forEach(finding => {
              expect(finding.ruleId).toMatch(/^A11Y-CONTRAST-/);
              expect(finding.severity).toBeDefined();
              expect(finding.message).toBeDefined();
            });

            if (!config.hasColors) {
              const missingFindings = results1.filter(f => f.ruleId === 'A11Y-CONTRAST-MISSING');
              expect(missingFindings.length).toBe(1);
              expect(missingFindings[0].severity).toBe(Severity.INFO);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect keyboard navigation issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasOnclickWithoutKeyHandler: fc.boolean(),
            hasNegativeTabindex: fc.boolean(),
            hasPositiveTabindex: fc.boolean(),
            hasCustomControlWithoutTabindex: fc.boolean(),
            hasKeyboardHandlers: fc.boolean(),
            elementTag: fc.constantFrom('div', 'span', 'p'),
            tabindexValue: fc.integer({ min: -1, max: 5 })
          }),
          (config) => {
            const elements: any[] = [];

            if (config.hasOnclickWithoutKeyHandler) {
              elements.push({
                tagName: config.elementTag,
                attributes: { onclick: 'handleClick()' }
              });
            }

            if (config.hasNegativeTabindex) {
              elements.push({
                tagName: 'button',
                attributes: { tabindex: '-1' }
              });
            }

            if (config.hasPositiveTabindex) {
              elements.push({
                tagName: 'div',
                attributes: { tabindex: config.tabindexValue > 0 ? String(config.tabindexValue) : '1' }
              });
            }

            if (config.hasCustomControlWithoutTabindex) {
              elements.push({
                tagName: 'div',
                attributes: { role: 'button' }
              });
            }

            const htmlAST = { elements };

            // Generate JavaScript AST
            const jsBody: any[] = [];

            if (config.hasKeyboardHandlers) {
              jsBody.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'element' },
                    property: { type: 'Identifier', name: 'addEventListener' }
                  },
                  arguments: [
                    { type: 'Literal', value: 'keydown' },
                    { type: 'Identifier', name: 'handleKeyDown' }
                  ]
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
            const results1 = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
            const results2 = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
            const results3 = analyzer.checkKeyboardNavigation(htmlAST, jsAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (config.hasOnclickWithoutKeyHandler) {
              const handlerFindings = results1.filter(f => f.ruleId === 'A11Y-KBD-HANDLER');
              expect(handlerFindings.length).toBe(1);
              expect(handlerFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.hasNegativeTabindex) {
              const negTabFindings = results1.filter(f => f.ruleId === 'A11Y-KBD-TABINDEX-NEG');
              expect(negTabFindings.length).toBe(1);
              expect(negTabFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasPositiveTabindex) {
              const posTabFindings = results1.filter(f => f.ruleId === 'A11Y-KBD-TABINDEX-POS');
              expect(posTabFindings.length).toBe(1);
              expect(posTabFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.hasCustomControlWithoutTabindex) {
              const missingTabFindings = results1.filter(f => f.ruleId === 'A11Y-KBD-TABINDEX-MISSING');
              expect(missingTabFindings.length).toBe(1);
              expect(missingTabFindings[0].severity).toBe(Severity.HIGH);
            }

            if (!config.hasKeyboardHandlers) {
              const jsFindings = results1.filter(f => f.ruleId === 'A11Y-KBD-JS-MISSING');
              expect(jsFindings.length).toBe(1);
              expect(jsFindings[0].severity).toBe(Severity.MEDIUM);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect image alt text issues consistently', () => {
      fc.assert(
        fc.property(
          fc.record({
            imageCount: fc.integer({ min: 0, max: 5 }),
            hasMissingAlt: fc.boolean(),
            hasEmptyAlt: fc.boolean(),
            hasShortAlt: fc.boolean(),
            hasLongAlt: fc.boolean(),
            hasFilenameAlt: fc.boolean(),
            hasGenericAlt: fc.boolean(),
            altText: fc.constantFrom('a', 'ab', 'Good description of image', 'image', 'photo.jpg', 'This is a very long description that exceeds the recommended length for alt text and should probably be moved to aria-describedby instead of being in the alt attribute')
          }),
          (config) => {
            const elements: any[] = [];

            // Add images based on configuration
            if (config.imageCount > 0) {
              let imageIndex = 0;

              // Add image with missing alt
              if (config.hasMissingAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg` }
                });
              }

              // Add image with empty alt
              if (config.hasEmptyAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg`, alt: '' }
                });
              }

              // Add image with short alt
              if (config.hasShortAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg`, alt: 'ab' }
                });
              }

              // Add image with long alt
              if (config.hasLongAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { 
                    src: `image${imageIndex++}.jpg`, 
                    alt: 'This is a very long description that exceeds the recommended length for alt text and should probably be moved to aria-describedby instead of being in the alt attribute'
                  }
                });
              }

              // Add image with filename alt
              if (config.hasFilenameAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg`, alt: 'photo.jpg' }
                });
              }

              // Add image with generic alt
              if (config.hasGenericAlt) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg`, alt: 'image' }
                });
              }

              // Fill remaining images with normal alt text
              while (imageIndex < config.imageCount) {
                elements.push({
                  tagName: 'img',
                  attributes: { src: `image${imageIndex++}.jpg`, alt: 'Normal descriptive alt text' }
                });
              }
            }

            const htmlAST = { elements };

            // Run analysis multiple times
            const results1 = analyzer.checkImageAltText(htmlAST);
            const results2 = analyzer.checkImageAltText(htmlAST);
            const results3 = analyzer.checkImageAltText(htmlAST);

            // Property: Results should be consistent
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);

            // Verify expected findings
            if (config.imageCount === 0) {
              const noneFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-NONE');
              expect(noneFindings.length).toBe(1);
              expect(noneFindings[0].severity).toBe(Severity.INFO);
            }

            if (config.imageCount > 0 && config.hasMissingAlt) {
              const missingFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-MISSING');
              expect(missingFindings.length).toBeGreaterThan(0);
              expect(missingFindings[0].severity).toBe(Severity.CRITICAL);
            }

            if (config.imageCount > 0 && config.hasEmptyAlt) {
              const emptyFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-EMPTY');
              expect(emptyFindings.length).toBeGreaterThan(0);
              expect(emptyFindings[0].severity).toBe(Severity.INFO);
            }

            if (config.imageCount > 0 && config.hasShortAlt) {
              const shortFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-SHORT');
              expect(shortFindings.length).toBeGreaterThan(0);
              expect(shortFindings[0].severity).toBe(Severity.MEDIUM);
            }

            if (config.imageCount > 0 && config.hasLongAlt) {
              const longFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-LONG');
              expect(longFindings.length).toBeGreaterThan(0);
              expect(longFindings[0].severity).toBe(Severity.LOW);
            }

            if (config.imageCount > 0 && config.hasFilenameAlt) {
              const filenameFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-FILENAME');
              expect(filenameFindings.length).toBeGreaterThan(0);
              expect(filenameFindings[0].severity).toBe(Severity.HIGH);
            }

            if (config.imageCount > 0 && config.hasGenericAlt) {
              const genericFindings = results1.filter(f => f.ruleId === 'A11Y-IMG-ALT-GENERIC');
              expect(genericFindings.length).toBeGreaterThan(0);
              expect(genericFindings[0].severity).toBe(Severity.MEDIUM);
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
                'A11Y-SEM-MAIN',
                'A11Y-CONTRAST-LOW',
                'A11Y-KBD-HANDLER',
                'A11Y-IMG-ALT-MISSING',
                'A11Y-ARIA-ROLE'
              ),
              severity: fc.constantFrom(Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO)
            }),
            { minLength: 1, maxLength: 15 }
          ),
          (findingsConfig) => {
            // Generate findings from config
            const findings = findingsConfig.map((config, index) => ({
              id: `A11Y-${index + 1}`,
              severity: config.severity,
              message: `Test finding ${index + 1}`,
              location: { file: 'test.html', line: index + 1, column: 1 },
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

            // Verify recommendations are generated for each category
            const hasSemanticFindings = findingsConfig.some(f => f.ruleId.includes('SEM') || f.ruleId.includes('ARIA'));
            const hasContrastFindings = findingsConfig.some(f => f.ruleId.includes('CONTRAST'));
            const hasKeyboardFindings = findingsConfig.some(f => f.ruleId.includes('KBD'));
            const hasImageFindings = findingsConfig.some(f => f.ruleId.includes('IMG'));

            if (hasSemanticFindings) {
              const semanticRecs = recs1.filter(r => r.description.toLowerCase().includes('semantic'));
              expect(semanticRecs.length).toBeGreaterThan(0);
            }

            if (hasContrastFindings) {
              const contrastRecs = recs1.filter(r => r.description.toLowerCase().includes('contrast'));
              expect(contrastRecs.length).toBeGreaterThan(0);
            }

            if (hasKeyboardFindings) {
              const keyboardRecs = recs1.filter(r => r.description.toLowerCase().includes('keyboard'));
              expect(keyboardRecs.length).toBeGreaterThan(0);
            }

            if (hasImageFindings) {
              const imageRecs = recs1.filter(r => r.description.toLowerCase().includes('image'));
              expect(imageRecs.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should calculate consistent accessibility scores', () => {
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
              id: `A11Y-${index + 1}`,
              severity: config.severity,
              message: `Test finding ${index + 1}`,
              location: { file: 'test.html', line: index + 1, column: 1 },
              codeSnippet: 'test code',
              ruleId: `A11Y-TEST-${index + 1}`
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
            
            const expectedDeduction = (criticalCount * 15) + (highCount * 8);
            const expectedScore = Math.max(0, 100 - expectedDeduction);
            
            // Score should be at most the expected score (could be lower due to other severities)
            expect(score1).toBeLessThanOrEqual(expectedScore);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should detect all accessibility issues in comprehensive markup', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasSemanticIssues: fc.boolean(),
            hasContrastIssues: fc.boolean(),
            hasKeyboardIssues: fc.boolean(),
            hasImageIssues: fc.boolean()
          }),
          (config) => {
            // Build comprehensive HTML/CSS/JS AST
            const elements: any[] = [];
            const cssProperties: any[] = [];
            const jsBody: any[] = [];

            // Add semantic issues
            if (config.hasSemanticIssues) {
              elements.push({ tagName: 'div', attributes: { onclick: 'test()' } });
              elements.push({ tagName: 'input', attributes: { type: 'text', id: 'test' } });
            } else {
              elements.push({ tagName: 'main', attributes: {} });
              elements.push({ tagName: 'nav', attributes: {} });
            }

            // Add contrast issues
            if (config.hasContrastIssues) {
              cssProperties.push({ property: 'color', value: '#888888' });
              cssProperties.push({ property: 'background-color', value: '#999999' });
            } else {
              cssProperties.push({ property: 'color', value: '#000000' });
              cssProperties.push({ property: 'background-color', value: '#FFFFFF' });
            }

            // Add keyboard issues
            if (config.hasKeyboardIssues) {
              elements.push({ tagName: 'div', attributes: { role: 'button' } });
            } else {
              jsBody.push({
                type: 'ExpressionStatement',
                expression: {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'element' },
                    property: { type: 'Identifier', name: 'addEventListener' }
                  },
                  arguments: [
                    { type: 'Literal', value: 'keydown' },
                    { type: 'Identifier', name: 'handler' }
                  ]
                }
              });
            }

            // Add image issues
            if (config.hasImageIssues) {
              elements.push({ tagName: 'img', attributes: { src: 'test.jpg' } });
            } else {
              elements.push({ tagName: 'img', attributes: { src: 'test.jpg', alt: 'Descriptive text' } });
            }

            const htmlAST = { elements };
            const cssAST = { properties: cssProperties };
            const jsAST = { ast: { type: 'Program', body: jsBody } };

            // Run all analysis methods
            const semanticResults = analyzer.checkSemanticStructure(htmlAST);
            const contrastResults = analyzer.checkColorContrast(htmlAST, cssAST);
            const keyboardResults = analyzer.checkKeyboardNavigation(htmlAST, jsAST);
            const imageResults = analyzer.checkImageAltText(htmlAST);

            // Property: Analyzer should detect issues in each category when present
            if (config.hasSemanticIssues) {
              expect(semanticResults.length).toBeGreaterThan(0);
            }

            if (config.hasContrastIssues) {
              expect(contrastResults.length).toBeGreaterThan(0);
            }

            if (config.hasKeyboardIssues) {
              expect(keyboardResults.length).toBeGreaterThan(0);
            }

            if (config.hasImageIssues) {
              expect(imageResults.length).toBeGreaterThan(0);
            }

            // Combine all findings
            const allFindings = [
              ...semanticResults,
              ...contrastResults,
              ...keyboardResults,
              ...imageResults
            ];

            // Generate recommendations and score
            const recommendations = analyzer.generateRecommendations(allFindings);
            const score = analyzer.calculateScore(allFindings);

            // Property: Recommendations should be generated when findings exist
            if (allFindings.length > 0) {
              expect(recommendations.length).toBeGreaterThan(0);
            }

            // Property: Score should reflect the number and severity of findings
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            
            if (allFindings.length > 0) {
              expect(score).toBeLessThan(100);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
