/**
 * Best Practices Analyzer
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Finding, Recommendation, Severity, Priority } from '../types';

export class BestPracticesAnalyzer {
  /**
   * Validate responsive design implementation
   * Validates: Requirement 5.1
   */
  checkResponsiveDesign(htmlAST: any, cssAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    const elements = htmlAST.elements;
    
    // Check for viewport meta tag
    const hasViewport = elements.some((el: any) => {
      if (el.tagName === 'meta') {
        const attrs = el.attributes || {};
        return attrs.name === 'viewport';
      }
      return false;
    });
    
    if (!hasViewport) {
      findings.push({
        id: `BP-RES-${findings.length + 1}`,
        severity: Severity.CRITICAL,
        message: 'Missing viewport meta tag for responsive design',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        ruleId: 'BP-VIEWPORT-MISSING'
      });
    } else {
      // Check viewport content
      const viewportMeta = elements.find((el: any) => 
        el.tagName === 'meta' && el.attributes?.name === 'viewport'
      );
      const content = viewportMeta?.attributes?.content || '';
      
      if (!content.includes('width=device-width')) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Viewport meta tag missing width=device-width',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Add width=device-width to viewport meta tag',
          ruleId: 'BP-VIEWPORT-WIDTH'
        });
      }
      
      if (!content.includes('initial-scale')) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Viewport meta tag missing initial-scale',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Add initial-scale=1.0 to viewport meta tag',
          ruleId: 'BP-VIEWPORT-SCALE'
        });
      }
    }

    // Check CSS for media queries
    if (cssAST && cssAST.properties) {
      const mediaQueries = cssAST.properties.filter((prop: any) => 
        prop.type === 'media-query' || prop.mediaQuery
      );
      
      if (mediaQueries.length === 0) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'No media queries found. Page may not be responsive',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Add media queries for common breakpoints (768px, 1024px, 1440px)',
          ruleId: 'BP-MEDIA-QUERY-MISSING'
        });
      } else if (mediaQueries.length < 2) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Limited media queries found. Consider adding more breakpoints',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Add media queries for tablet and desktop breakpoints',
          ruleId: 'BP-MEDIA-QUERY-LIMITED'
        });
      }
      
      // Check for common breakpoints
      const breakpoints = [320, 375, 768, 1024, 1440];
      const foundBreakpoints = mediaQueries.filter((mq: any) => {
        const query = mq.mediaQuery || mq.value || '';
        return breakpoints.some(bp => query.includes(`${bp}px`));
      });
      
      if (foundBreakpoints.length < 2) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Consider using standard breakpoints (768px, 1024px, 1440px)',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Use common breakpoints for better device coverage',
          ruleId: 'BP-BREAKPOINT-STANDARD'
        });
      }
      
      // Check for flexible layouts
      const hasFlexbox = cssAST.properties.some((prop: any) => 
        prop.property === 'display' && (prop.value === 'flex' || prop.value === 'inline-flex')
      );
      
      const hasGrid = cssAST.properties.some((prop: any) => 
        prop.property === 'display' && (prop.value === 'grid' || prop.value === 'inline-grid')
      );
      
      if (!hasFlexbox && !hasGrid) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'No flexible layout systems (Flexbox/Grid) detected',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Use CSS Flexbox or Grid for responsive layouts',
          ruleId: 'BP-LAYOUT-FLEXIBLE'
        });
      }
      
      // Check for fixed widths
      const fixedWidths = cssAST.properties.filter((prop: any) => 
        prop.property === 'width' && prop.value && prop.value.includes('px') && !prop.value.includes('max-width')
      );
      
      if (fixedWidths.length > 5) {
        findings.push({
          id: `BP-RES-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: `Excessive fixed pixel widths (${fixedWidths.length}). Consider using relative units`,
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Use %, em, rem, or vw instead of fixed px widths',
          ruleId: 'BP-WIDTH-FIXED'
        });
      }
    }

    return findings;
  }

  /**
   * Check for mobile-first approach indicators
   * Validates: Requirement 5.2
   */
  checkMobileFirstApproach(cssAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!cssAST || !cssAST.properties) {
      return findings;
    }

    const mediaQueries = cssAST.properties.filter((prop: any) => 
      prop.type === 'media-query' || prop.mediaQuery
    );
    
    if (mediaQueries.length === 0) {
      return findings; // Already reported in checkResponsiveDesign
    }

    // Count min-width vs max-width media queries
    let minWidthCount = 0;
    let maxWidthCount = 0;
    
    mediaQueries.forEach((mq: any) => {
      const query = mq.mediaQuery || mq.value || '';
      
      if (query.includes('min-width')) {
        minWidthCount++;
      }
      if (query.includes('max-width')) {
        maxWidthCount++;
      }
    });
    
    // Mobile-first uses min-width (progressive enhancement)
    // Desktop-first uses max-width (graceful degradation)
    if (maxWidthCount > minWidthCount && minWidthCount === 0) {
      findings.push({
        id: `BP-MOB-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'Desktop-first approach detected (max-width queries). Consider mobile-first approach',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Use min-width media queries for mobile-first design',
        ruleId: 'BP-MOBILE-FIRST-APPROACH'
      });
    } else if (maxWidthCount > minWidthCount * 2) {
      findings.push({
        id: `BP-MOB-${findings.length + 1}`,
        severity: Severity.LOW,
        message: 'Predominantly desktop-first approach. Mobile-first is recommended',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Prefer min-width over max-width for better mobile performance',
        ruleId: 'BP-MOBILE-FIRST-MIXED'
      });
    } else if (minWidthCount > 0) {
      findings.push({
        id: `BP-MOB-${findings.length + 1}`,
        severity: Severity.INFO,
        message: 'Mobile-first approach detected (min-width queries)',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Good practice: Using mobile-first approach',
        ruleId: 'BP-MOBILE-FIRST-GOOD'
      });
    }
    
    // Check for base styles before media queries
    const baseStyles = cssAST.properties.filter((prop: any) => 
      !prop.mediaQuery && prop.property && prop.value
    );
    
    if (baseStyles.length === 0 && mediaQueries.length > 0) {
      findings.push({
        id: `BP-MOB-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'No base styles found before media queries',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Define mobile base styles before adding media queries',
        ruleId: 'BP-BASE-STYLES-MISSING'
      });
    }
    
    // Check for mobile-optimized units
    const hasRelativeUnits = cssAST.properties.some((prop: any) => {
      const value = prop.value || '';
      return value.includes('rem') || value.includes('em') || value.includes('%') || value.includes('vw') || value.includes('vh');
    });
    
    if (!hasRelativeUnits) {
      findings.push({
        id: `BP-MOB-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'No relative units (rem, em, %) detected. Use relative units for better scalability',
        location: { file: 'styles.css', line: 1, column: 1 },
        codeSnippet: 'Use rem/em for font sizes, % for widths',
        ruleId: 'BP-RELATIVE-UNITS'
      });
    }

    return findings;
  }

  /**
   * Verify SEO meta tags
   * Validates: Requirement 5.3
   */
  checkSEOMetaTags(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    if (!htmlAST || !htmlAST.elements) {
      return findings;
    }

    const elements = htmlAST.elements;
    
    // Check for title tag
    const titleTag = elements.find((el: any) => el.tagName === 'title');
    
    if (!titleTag) {
      findings.push({
        id: `BP-SEO-${findings.length + 1}`,
        severity: Severity.CRITICAL,
        message: 'Missing <title> tag',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<title>Your Page Title (50-60 characters)</title>',
        ruleId: 'BP-SEO-TITLE-MISSING'
      });
    } else {
      const titleText = titleTag.text || titleTag.content || '';
      
      if (titleText.length === 0) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Empty <title> tag',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Add descriptive title text',
          ruleId: 'BP-SEO-TITLE-EMPTY'
        });
      } else if (titleText.length < 30) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Title tag too short (< 30 characters). Optimal length is 50-60 characters',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Expand title to 50-60 characters for better SEO',
          ruleId: 'BP-SEO-TITLE-SHORT'
        });
      } else if (titleText.length > 60) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Title tag too long (> 60 characters). May be truncated in search results',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Keep title under 60 characters',
          ruleId: 'BP-SEO-TITLE-LONG'
        });
      }
    }
    
    // Check for meta description
    const metaDescription = elements.find((el: any) => 
      el.tagName === 'meta' && el.attributes?.name === 'description'
    );
    
    if (!metaDescription) {
      findings.push({
        id: `BP-SEO-${findings.length + 1}`,
        severity: Severity.HIGH,
        message: 'Missing meta description tag',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<meta name="description" content="Your page description (150-160 characters)">',
        ruleId: 'BP-SEO-DESC-MISSING'
      });
    } else {
      const descContent = metaDescription.attributes?.content || '';
      
      if (descContent.length === 0) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: 'Empty meta description',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Add descriptive content to meta description',
          ruleId: 'BP-SEO-DESC-EMPTY'
        });
      } else if (descContent.length < 120) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: 'Meta description too short (< 120 characters). Optimal length is 150-160 characters',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Expand description to 150-160 characters',
          ruleId: 'BP-SEO-DESC-SHORT'
        });
      } else if (descContent.length > 160) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Meta description too long (> 160 characters). May be truncated',
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: 'Keep description under 160 characters',
          ruleId: 'BP-SEO-DESC-LONG'
        });
      }
    }
    
    // Check for Open Graph tags
    const ogTags = elements.filter((el: any) => 
      el.tagName === 'meta' && el.attributes?.property?.startsWith('og:')
    );
    
    const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
    const foundOgTags = ogTags.map((tag: any) => tag.attributes?.property);
    
    requiredOgTags.forEach(requiredTag => {
      if (!foundOgTags.includes(requiredTag)) {
        findings.push({
          id: `BP-SEO-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: `Missing Open Graph tag: ${requiredTag}`,
          location: { file: 'index.html', line: 1, column: 1 },
          codeSnippet: `<meta property="${requiredTag}" content="...">`,
          ruleId: 'BP-SEO-OG-MISSING'
        });
      }
    });
    
    // Check for Twitter Card tags
    const twitterTags = elements.filter((el: any) => 
      el.tagName === 'meta' && el.attributes?.name?.startsWith('twitter:')
    );
    
    if (twitterTags.length === 0) {
      findings.push({
        id: `BP-SEO-${findings.length + 1}`,
        severity: Severity.LOW,
        message: 'No Twitter Card tags found. Add for better social sharing',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<meta name="twitter:card" content="summary_large_image">',
        ruleId: 'BP-SEO-TWITTER-MISSING'
      });
    }
    
    // Check for canonical URL
    const canonicalLink = elements.find((el: any) => 
      el.tagName === 'link' && el.attributes?.rel === 'canonical'
    );
    
    if (!canonicalLink) {
      findings.push({
        id: `BP-SEO-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'Missing canonical URL link tag',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<link rel="canonical" href="https://example.com/page">',
        ruleId: 'BP-SEO-CANONICAL-MISSING'
      });
    }
    
    // Check for language attribute
    const htmlTag = elements.find((el: any) => el.tagName === 'html');
    if (htmlTag && !htmlTag.attributes?.lang) {
      findings.push({
        id: `BP-SEO-${findings.length + 1}`,
        severity: Severity.MEDIUM,
        message: 'Missing lang attribute on <html> tag',
        location: { file: 'index.html', line: 1, column: 1 },
        codeSnippet: '<html lang="en">',
        ruleId: 'BP-SEO-LANG-MISSING'
      });
    }

    return findings;
  }

  /**
   * Check framework-specific best practices
   * Validates: Requirement 5.4
   */
  checkFrameworkBestPractices(
    htmlAST: any,
    _cssAST: any,
    jsAST: any,
    framework: string
  ): Finding[] {
    const findings: Finding[] = [];
    
    if (!framework || framework === 'none') {
      return findings;
    }

    // React-specific checks
    if (framework.toLowerCase() === 'react') {
      if (jsAST && jsAST.ast) {
        // Check for PropTypes usage
        let hasTypeScript = false;
        
        const traverse = (node: any, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 50) return;
          
          // Check for TypeScript type annotations
          if (node.typeAnnotation || node.typeParameters) {
            hasTypeScript = true;
          }
          
          // Check for class components without PropTypes
          if (node.type === 'ClassDeclaration' && 
              node.superClass?.property?.name === 'Component') {
            const hasPropsValidation = node.body?.body?.some((member: any) => 
              member.key?.name === 'propTypes'
            );
            
            if (!hasPropsValidation && !hasTypeScript) {
              findings.push({
                id: `BP-FW-${findings.length + 1}`,
                severity: Severity.MEDIUM,
                message: 'React component without PropTypes or TypeScript',
                location: { file: 'component.jsx', line: 1, column: 1 },
                codeSnippet: 'Add PropTypes or use TypeScript for type safety',
                ruleId: 'BP-REACT-PROPTYPES'
              });
            }
          }
          
          // Check for hooks usage patterns
          if (node.type === 'CallExpression' && 
              node.callee?.name?.startsWith('use')) {
            // Check if hook is called conditionally (anti-pattern)
            let parent = node.parent;
            while (parent && depth < 10) {
              if (parent.type === 'IfStatement' || 
                  parent.type === 'ConditionalExpression') {
                findings.push({
                  id: `BP-FW-${findings.length + 1}`,
                  severity: Severity.HIGH,
                  message: 'React Hook called conditionally (violates Rules of Hooks)',
                  location: { file: 'component.jsx', line: 1, column: 1 },
                  codeSnippet: 'Hooks must be called at the top level',
                  ruleId: 'BP-REACT-HOOKS-CONDITIONAL'
                });
                break;
              }
              parent = parent.parent;
            }
          }
          
          // Recursively traverse
          for (const key in node) {
            if (key === 'loc' || key === 'range' || key === 'parent') continue;
            const child = node[key];
            if (Array.isArray(child)) {
              child.forEach(c => {
                if (c && typeof c === 'object') {
                  c.parent = node;
                  traverse(c, depth + 1);
                }
              });
            } else if (child && typeof child === 'object') {
              child.parent = node;
              traverse(child, depth + 1);
            }
          }
        };
        
        traverse(jsAST.ast);
      }
    }
    
    // Vue-specific checks
    if (framework.toLowerCase() === 'vue') {
      if (htmlAST && htmlAST.elements) {
        // Check for Vue directives
        const hasVueDirectives = htmlAST.elements.some((el: any) => {
          const attrs = el.attributes || {};
          return Object.keys(attrs).some(attr => 
            attr.startsWith('v-') || attr.startsWith(':') || attr.startsWith('@')
          );
        });
        
        if (hasVueDirectives) {
          findings.push({
            id: `BP-FW-${findings.length + 1}`,
            severity: Severity.INFO,
            message: 'Vue directives detected. Ensure proper usage of Composition API',
            location: { file: 'component.vue', line: 1, column: 1 },
            codeSnippet: 'Use Composition API for better code organization',
            ruleId: 'BP-VUE-COMPOSITION'
          });
        }
      }
    }
    
    // Angular-specific checks
    if (framework.toLowerCase() === 'angular') {
      if (htmlAST && htmlAST.elements) {
        // Check for Angular directives
        const hasAngularDirectives = htmlAST.elements.some((el: any) => {
          const attrs = el.attributes || {};
          return Object.keys(attrs).some(attr => 
            attr.startsWith('*ng') || attr.startsWith('[') || attr.startsWith('(')
          );
        });
        
        if (hasAngularDirectives) {
          findings.push({
            id: `BP-FW-${findings.length + 1}`,
            severity: Severity.INFO,
            message: 'Angular directives detected. Ensure proper module organization',
            location: { file: 'component.html', line: 1, column: 1 },
            codeSnippet: 'Follow Angular style guide for module structure',
            ruleId: 'BP-ANGULAR-MODULES'
          });
        }
      }
    }

    return findings;
  }

  /**
   * Identify anti-patterns
   * Validates: Requirement 5.5
   */
  identifyAntiPatterns(htmlAST: any, cssAST: any, jsAST: any): Finding[] {
    const findings: Finding[] = [];
    
    // Check HTML anti-patterns
    if (htmlAST && htmlAST.elements) {
      htmlAST.elements.forEach((el: any, index: number) => {
        const attrs = el.attributes || {};
        
        // Check for inline styles
        if (attrs.style) {
          findings.push({
            id: `BP-AP-${findings.length + 1}`,
            severity: Severity.MEDIUM,
            message: 'Inline styles detected. Use external CSS for maintainability',
            location: { file: 'index.html', line: index + 1, column: 1 },
            codeSnippet: 'Move styles to external CSS file',
            ruleId: 'BP-ANTI-INLINE-STYLE'
          });
        }
        
        // Check for inline event handlers
        const inlineEvents = ['onclick', 'onload', 'onmouseover', 'onmouseout', 'onchange'];
        inlineEvents.forEach(event => {
          if (attrs[event]) {
            findings.push({
              id: `BP-AP-${findings.length + 1}`,
              severity: Severity.MEDIUM,
              message: `Inline event handler (${event}) detected. Use addEventListener instead`,
              location: { file: 'index.html', line: index + 1, column: 1 },
              codeSnippet: 'Use addEventListener in JavaScript file',
              ruleId: 'BP-ANTI-INLINE-EVENT'
            });
          }
        });
      });
    }
    
    // Check CSS anti-patterns
    if (cssAST && cssAST.properties) {
      // Check for !important usage
      const importantUsage = cssAST.properties.filter((prop: any) => {
        const value = prop.value || '';
        return value.includes('!important');
      });
      
      if (importantUsage.length > 0) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: `Excessive !important usage (${importantUsage.length} instances). Indicates specificity issues`,
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Refactor CSS to avoid !important',
          ruleId: 'BP-ANTI-IMPORTANT'
        });
      }
      
      // Check for overly specific selectors
      const complexSelectors = cssAST.properties.filter((prop: any) => {
        const selector = prop.selector || '';
        const parts = selector.split(/\s+/);
        return parts.length > 4; // More than 4 levels deep
      });
      
      if (complexSelectors.length > 3) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.LOW,
          message: 'Overly specific CSS selectors detected. Simplify for maintainability',
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Use BEM or similar methodology for simpler selectors',
          ruleId: 'BP-ANTI-SELECTOR-COMPLEX'
        });
      }
      
      // Check for duplicate properties
      const propertyGroups = new Map<string, number>();
      cssAST.properties.forEach((prop: any) => {
        const key = `${prop.selector}-${prop.property}`;
        propertyGroups.set(key, (propertyGroups.get(key) || 0) + 1);
      });
      
      const duplicates = Array.from(propertyGroups.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.LOW,
          message: `Duplicate CSS properties detected (${duplicates.length}). May indicate redundancy`,
          location: { file: 'styles.css', line: 1, column: 1 },
          codeSnippet: 'Remove duplicate property declarations',
          ruleId: 'BP-ANTI-CSS-DUPLICATE'
        });
      }
    }
    
    // Check JavaScript anti-patterns
    if (jsAST && jsAST.ast) {
      let globalVarCount = 0;
      let callbackDepth = 0;
      let maxCallbackDepth = 0;
      let magicNumberCount = 0;
      
      const traverse = (node: any, depth = 0, inCallback = false) => {
        if (!node || typeof node !== 'object' || depth > 50) return;
        
        // Check for global variables (var declarations at top level)
        if (node.type === 'VariableDeclaration' && node.kind === 'var' && depth <= 2) {
          globalVarCount++;
        }
        
        // Check for callback nesting
        if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
          if (inCallback) {
            callbackDepth++;
            maxCallbackDepth = Math.max(maxCallbackDepth, callbackDepth);
          }
          
          // Recursively check inside function
          for (const key in node) {
            if (key === 'loc' || key === 'range') continue;
            const child = node[key];
            if (Array.isArray(child)) {
              child.forEach(c => traverse(c, depth + 1, true));
            } else if (child && typeof child === 'object') {
              traverse(child, depth + 1, true);
            }
          }
          
          if (inCallback) {
            callbackDepth--;
          }
          return;
        }
        
        // Check for magic numbers
        if (node.type === 'Literal' && typeof node.value === 'number' && 
            node.value !== 0 && node.value !== 1 && node.value !== -1) {
          magicNumberCount++;
        }
        
        // Recursively traverse
        for (const key in node) {
          if (key === 'loc' || key === 'range') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(c => traverse(c, depth + 1, inCallback));
          } else if (child && typeof child === 'object') {
            traverse(child, depth + 1, inCallback);
          }
        }
      };
      
      traverse(jsAST.ast);
      
      if (globalVarCount > 0) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: `Global variables detected (${globalVarCount}). Use const/let with proper scoping`,
          location: { file: 'script.js', line: 1, column: 1 },
          codeSnippet: 'Replace var with const/let and use modules',
          ruleId: 'BP-ANTI-GLOBAL-VAR'
        });
      }
      
      if (maxCallbackDepth > 3) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.HIGH,
          message: `Callback hell detected (${maxCallbackDepth} levels deep). Use Promises or async/await`,
          location: { file: 'script.js', line: 1, column: 1 },
          codeSnippet: 'Refactor nested callbacks to Promises or async/await',
          ruleId: 'BP-ANTI-CALLBACK-HELL'
        });
      }
      
      if (magicNumberCount > 5) {
        findings.push({
          id: `BP-AP-${findings.length + 1}`,
          severity: Severity.MEDIUM,
          message: `Magic numbers detected (${magicNumberCount}). Use named constants`,
          location: { file: 'script.js', line: 1, column: 1 },
          codeSnippet: 'Define constants: const MAX_ITEMS = 10;',
          ruleId: 'BP-ANTI-MAGIC-NUMBER'
        });
      }
    }

    return findings;
  }

  /**
   * Generate best practices recommendations
   * Validates: Requirement 5.5
   */
  generateRecommendations(findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Group findings by category
    const responsiveFindings = findings.filter(f => f.ruleId.includes('RES') || f.ruleId.includes('VIEWPORT') || f.ruleId.includes('MEDIA'));
    const mobileFindings = findings.filter(f => f.ruleId.includes('MOB') || f.ruleId.includes('MOBILE'));
    const seoFindings = findings.filter(f => f.ruleId.includes('SEO'));
    const frameworkFindings = findings.filter(f => f.ruleId.includes('FW') || f.ruleId.includes('REACT') || f.ruleId.includes('VUE') || f.ruleId.includes('ANGULAR'));
    const antiPatternFindings = findings.filter(f => f.ruleId.includes('ANTI') || f.ruleId.includes('AP'));

    // Responsive design recommendations
    if (responsiveFindings.length > 0) {
      recommendations.push({
        description: 'Implement responsive design best practices',
        priority: this.getPriorityForFindings(responsiveFindings),
        implementationSteps: [
          'Add viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1.0">',
          'Implement media queries for common breakpoints (768px, 1024px, 1440px)',
          'Use flexible layout systems (CSS Flexbox or Grid)',
          'Replace fixed pixel widths with relative units (%, rem, em)',
          'Test on multiple device sizes and orientations',
          'Ensure touch targets are at least 44x44 pixels'
        ],
        estimatedImpact: 'HIGH - Ensures usability across all device sizes'
      });
    }

    // Mobile-first recommendations
    if (mobileFindings.length > 0) {
      recommendations.push({
        description: 'Adopt mobile-first development approach',
        priority: this.getPriorityForFindings(mobileFindings),
        implementationSteps: [
          'Define base styles for mobile devices first',
          'Use min-width media queries for progressive enhancement',
          'Optimize images and assets for mobile bandwidth',
          'Use relative units (rem, em) for better scalability',
          'Implement lazy loading for images and heavy content',
          'Test on actual mobile devices, not just browser emulation'
        ],
        estimatedImpact: 'MEDIUM - Improves mobile performance and user experience'
      });
    }

    // SEO recommendations
    if (seoFindings.length > 0) {
      recommendations.push({
        description: 'Optimize SEO meta tags and social sharing',
        priority: this.getPriorityForFindings(seoFindings),
        implementationSteps: [
          'Add descriptive title tag (50-60 characters)',
          'Write compelling meta description (150-160 characters)',
          'Implement Open Graph tags for social media sharing',
          'Add Twitter Card tags for Twitter sharing',
          'Include canonical URL to prevent duplicate content issues',
          'Add lang attribute to <html> tag',
          'Use structured data (JSON-LD) for rich snippets'
        ],
        estimatedImpact: 'HIGH - Improves search engine visibility and social sharing'
      });
    }

    // Framework-specific recommendations
    if (frameworkFindings.length > 0) {
      recommendations.push({
        description: 'Follow framework-specific best practices',
        priority: this.getPriorityForFindings(frameworkFindings),
        implementationSteps: [
          'Use PropTypes or TypeScript for type safety (React)',
          'Follow Rules of Hooks - call hooks at top level only (React)',
          'Use Composition API for better code organization (Vue)',
          'Follow framework style guides and conventions',
          'Implement proper component structure and organization',
          'Use framework-specific performance optimization techniques'
        ],
        estimatedImpact: 'MEDIUM - Improves code quality and maintainability'
      });
    }

    // Anti-pattern recommendations
    if (antiPatternFindings.length > 0) {
      recommendations.push({
        description: 'Refactor code to eliminate anti-patterns',
        priority: this.getPriorityForFindings(antiPatternFindings),
        implementationSteps: [
          'Move inline styles to external CSS files',
          'Replace inline event handlers with addEventListener',
          'Eliminate !important by improving CSS specificity',
          'Simplify overly complex CSS selectors',
          'Replace var with const/let and use proper scoping',
          'Refactor nested callbacks to Promises or async/await',
          'Extract magic numbers to named constants',
          'Remove duplicate CSS properties'
        ],
        estimatedImpact: 'MEDIUM - Improves code maintainability and reduces technical debt'
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
   * Calculate best practices score
   */
  calculateScore(findings: Finding[]): number {
    let score = 100;
    
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
}