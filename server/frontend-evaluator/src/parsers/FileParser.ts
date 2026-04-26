/**
 * File Parser for HTML, CSS, and JavaScript files
 */

import { FileSet } from '../types';
import { ParsedFiles } from '../engine/RuleEngine';
import { JSDOM } from 'jsdom';
import postcss, { Root } from 'postcss';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export class FileParser {
  /**
   * Parse all files in a FileSet
   */
  async parseFiles(files: FileSet): Promise<ParsedFiles> {
    const htmlASTs = new Map<string, any>();
    const cssASTs = new Map<string, any>();
    const jsASTs = new Map<string, any>();

    // Parse HTML files
    for (const [filename, content] of files.htmlFiles) {
      try {
        const ast = await this.parseHTML(content);
        htmlASTs.set(filename, ast);
      } catch (error) {
        console.warn(`Failed to parse HTML file ${filename}: ${error}`);
      }
    }

    // Parse CSS files
    for (const [filename, content] of files.cssFiles) {
      try {
        const ast = await this.parseCSS(content);
        cssASTs.set(filename, ast);
      } catch (error) {
        console.warn(`Failed to parse CSS file ${filename}: ${error}`);
      }
    }

    // Parse JavaScript files
    for (const [filename, content] of files.jsFiles) {
      try {
        const ast = await this.parseJavaScript(content);
        jsASTs.set(filename, ast);
      } catch (error) {
        console.warn(`Failed to parse JavaScript file ${filename}: ${error}`);
      }
    }

    return {
      htmlASTs,
      cssASTs,
      jsASTs
    };
  }

  /**
   * Parse HTML content into structured representation
   */
  async parseHTML(content: string): Promise<any> {
    try {
      const dom = new JSDOM(content, {
        // Configure JSDOM options
        url: 'http://localhost',
        referrer: 'http://localhost',
        contentType: 'text/html',
        includeNodeLocations: true,
        storageQuota: 10000000
      });

      const document = dom.window.document;
      
      // Extract structured information
      const htmlAST = {
        type: 'html',
        doctype: document.doctype ? document.doctype.name : null,
        rootElement: this.extractElementInfo(document.documentElement),
        head: this.extractElementInfo(document.head),
        body: this.extractElementInfo(document.body),
        elements: this.extractAllElements(document),
        metadata: {
          title: document.title,
          metaTags: this.extractMetaTags(document),
          linkTags: this.extractLinkTags(document),
          scriptTags: this.extractScriptTags(document),
          styleTags: this.extractStyleTags(document)
        },
        validation: {
          hasDoctype: !!document.doctype,
          hasHtmlTag: !!document.documentElement,
          hasHeadTag: !!document.head,
          hasBodyTag: !!document.body,
          isValid: this.validateHTML(content)
        }
      };

      return htmlAST;
    } catch (error) {
      throw new Error(`HTML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract information from an element
   */
  private extractElementInfo(element: Element | null): any {
    if (!element) return null;

    return {
      tagName: element.tagName.toLowerCase(),
      attributes: this.extractAttributes(element),
      childrenCount: element.children.length,
      textContent: element.textContent?.trim() || '',
      hasId: element.hasAttribute('id'),
      hasClass: element.hasAttribute('class'),
      isSemantic: this.isSemanticElement(element.tagName)
    };
  }

  /**
   * Extract all elements from document
   */
  private extractAllElements(document: Document): any[] {
    const elements: any[] = [];
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach((element, index) => {
      elements.push({
        index,
        tagName: element.tagName.toLowerCase(),
        attributes: this.extractAttributes(element),
        parentTag: element.parentElement?.tagName.toLowerCase() || 'root',
        depth: this.calculateElementDepth(element),
        isVisible: this.isElementVisible(element)
      });
    });

    return elements;
  }

  /**
   * Extract element attributes
   */
  private extractAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  /**
   * Calculate element depth in DOM tree
   */
  private calculateElementDepth(element: Element): number {
    let depth = 0;
    let currentElement: Element | null = element;
    
    while (currentElement && currentElement.parentElement) {
      depth++;
      currentElement = currentElement.parentElement;
    }
    
    return depth;
  }

  /**
   * Check if element is visible (basic check)
   */
  private isElementVisible(element: Element): boolean {
    const style = element.getAttribute('style');
    if (style && style.includes('display: none')) {
      return false;
    }
    return true;
  }

  /**
   * Check if element is semantic HTML element
   */
  private isSemanticElement(tagName: string): boolean {
    const semanticTags = [
      'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
      'figure', 'figcaption', 'time', 'mark', 'summary', 'details'
    ];
    return semanticTags.includes(tagName.toLowerCase());
  }

  /**
   * Extract meta tags information
   */
  private extractMetaTags(document: Document): any[] {
    const metaTags = document.querySelectorAll('meta');
    const metas: any[] = [];
    
    metaTags.forEach(meta => {
      metas.push({
        name: meta.getAttribute('name') || meta.getAttribute('property') || 'unknown',
        content: meta.getAttribute('content') || '',
        charset: meta.getAttribute('charset') || null,
        httpEquiv: meta.getAttribute('http-equiv') || null
      });
    });
    
    return metas;
  }

  /**
   * Extract link tags information
   */
  private extractLinkTags(document: Document): any[] {
    const linkTags = document.querySelectorAll('link');
    const links: any[] = [];
    
    linkTags.forEach(link => {
      links.push({
        rel: link.getAttribute('rel') || '',
        href: link.getAttribute('href') || '',
        type: link.getAttribute('type') || '',
        sizes: link.getAttribute('sizes') || null,
        crossorigin: link.getAttribute('crossorigin') || null
      });
    });
    
    return links;
  }

  /**
   * Extract script tags information
   */
  private extractScriptTags(document: Document): any[] {
    const scriptTags = document.querySelectorAll('script');
    const scripts: any[] = [];
    
    scriptTags.forEach(script => {
      scripts.push({
        src: script.getAttribute('src') || null,
        type: script.getAttribute('type') || 'text/javascript',
        async: script.hasAttribute('async'),
        defer: script.hasAttribute('defer'),
        crossorigin: script.getAttribute('crossorigin') || null,
        integrity: script.getAttribute('integrity') || null,
        hasContent: !!script.textContent?.trim()
      });
    });
    
    return scripts;
  }

  /**
   * Extract style tags information
   */
  private extractStyleTags(document: Document): any[] {
    const styleTags = document.querySelectorAll('style');
    const styles: any[] = [];
    
    styleTags.forEach(style => {
      styles.push({
        type: style.getAttribute('type') || 'text/css',
        hasContent: !!style.textContent?.trim(),
        contentLength: style.textContent?.length || 0
      });
    });
    
    return styles;
  }

  /**
   * Parse CSS content into AST with selector analysis
   */
  async parseCSS(content: string): Promise<any> {
    try {
      const root = postcss.parse(content);
      
      // Extract structured information
      const cssAST = {
        type: 'css',
        rules: this.extractCSSRules(root),
        selectors: this.extractCSSSelectors(root),
        properties: this.extractCSSProperties(root),
        mediaQueries: this.extractMediaQueries(root),
        keyframes: this.extractKeyframes(root),
        validation: {
          isValid: this.validateCSS(content),
          ruleCount: root.nodes.length,
          selectorCount: this.countSelectors(root),
          propertyCount: this.countProperties(root)
        }
      };

      return cssAST;
    } catch (error) {
      throw new Error(`CSS parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract CSS rules information
   */
  private extractCSSRules(root: Root): any[] {
    const rules: any[] = [];
    
    root.walkRules((rule: any) => {
      rules.push({
        type: 'rule',
        selector: rule.selector,
        selectors: rule.selectors,
        source: rule.source?.start ? {
          line: rule.source.start.line,
          column: rule.source.start.column,
          file: rule.source.input.file
        } : null,
        declarations: this.extractDeclarations(rule)
      });
    });
    
    return rules;
  }

  /**
   * Extract CSS selectors with analysis
   */
  private extractCSSSelectors(root: Root): any[] {
    const selectors: any[] = [];
    
    root.walkRules((rule: any) => {
      rule.selectors.forEach((selector: string) => {
        selectors.push({
          selector,
          specificity: this.calculateSpecificity(selector),
          type: this.analyzeSelectorType(selector),
          complexity: this.calculateSelectorComplexity(selector),
          isIdSelector: selector.includes('#'),
          isClassSelector: selector.includes('.'),
          isAttributeSelector: selector.includes('['),
          isPseudoSelector: selector.includes(':') && !selector.includes('::'),
          isPseudoElement: selector.includes('::')
        });
      });
    });
    
    return selectors;
  }

  /**
   * Extract CSS properties information
   */
  private extractCSSProperties(root: Root): any[] {
    const properties: any[] = [];
    
    root.walkDecls((decl: any) => {
      properties.push({
        property: decl.prop,
        value: decl.value,
        important: decl.important,
        source: decl.source?.start ? {
          line: decl.source.start.line,
          column: decl.source.start.column,
          file: decl.source.input.file
        } : null
      });
    });
    
    return properties;
  }

  /**
   * Extract media queries information
   */
  private extractMediaQueries(root: Root): any[] {
    const mediaQueries: any[] = [];
    
    root.walkAtRules('media', (atRule: any) => {
      mediaQueries.push({
        params: atRule.params,
        rules: atRule.nodes?.length || 0,
        source: atRule.source?.start ? {
          line: atRule.source.start.line,
          column: atRule.source.start.column,
          file: atRule.source.input.file
        } : null
      });
    });
    
    return mediaQueries;
  }

  /**
   * Extract keyframes information
   */
  private extractKeyframes(root: Root): any[] {
    const keyframes: any[] = [];
    
    root.walkAtRules(/keyframes$/, (atRule: any) => {
      keyframes.push({
        name: atRule.params,
        steps: atRule.nodes?.length || 0,
        source: atRule.source?.start ? {
          line: atRule.source.start.line,
          column: atRule.source.start.column,
          file: atRule.source.input.file
        } : null
      });
    });
    
    return keyframes;
  }

  /**
   * Extract declarations from a rule
   */
  private extractDeclarations(rule: any): any[] {
    const declarations: any[] = [];
    
    rule.walkDecls((decl: any) => {
      declarations.push({
        property: decl.prop,
        value: decl.value,
        important: decl.important
      });
    });
    
    return declarations;
  }

  /**
   * Calculate CSS selector specificity
   */
  private calculateSpecificity(selector: string): number {
    // Simplified specificity calculation
    let specificity = 0;
    
    // Count ID selectors
    const idMatches = selector.match(/#[a-zA-Z][a-zA-Z0-9_-]*/g);
    if (idMatches) specificity += idMatches.length * 100;
    
    // Count class selectors, attribute selectors, and pseudo-classes
    const classMatches = selector.match(/\.[a-zA-Z][a-zA-Z0-9_-]*/g);
    const attrMatches = selector.match(/\[[^\]]+\]/g);
    const pseudoClassMatches = selector.match(/:[a-zA-Z][a-zA-Z0-9_-]*(?![(:])/g);
    
    if (classMatches) specificity += classMatches.length * 10;
    if (attrMatches) specificity += attrMatches.length * 10;
    if (pseudoClassMatches) specificity += pseudoClassMatches.length * 10;
    
    // Count element selectors and pseudo-elements
    const elementMatches = selector.match(/^[a-zA-Z][a-zA-Z0-9]*|(?<=[ >+~,])[a-zA-Z][a-zA-Z0-9]*/g);
    const pseudoElementMatches = selector.match(/::[a-zA-Z][a-zA-Z0-9_-]*/g);
    
    if (elementMatches) specificity += elementMatches.length;
    if (pseudoElementMatches) specificity += pseudoElementMatches.length;
    
    return specificity;
  }

  /**
   * Analyze selector type
   */
  private analyzeSelectorType(selector: string): string {
    if (selector.startsWith('.')) return 'class';
    if (selector.startsWith('#')) return 'id';
    if (selector.includes('[')) return 'attribute';
    if (selector.includes(':')) {
      if (selector.includes('::')) return 'pseudo-element';
      return 'pseudo-class';
    }
    return 'element';
  }

  /**
   * Calculate selector complexity
   */
  private calculateSelectorComplexity(selector: string): number {
    let complexity = 1; // Base complexity
    
    // Add complexity for combinators
    const combinators = selector.match(/[ >+~]/g);
    if (combinators) complexity += combinators.length;
    
    // Add complexity for multiple selectors
    const selectorParts = selector.split(',');
    if (selectorParts.length > 1) complexity += selectorParts.length - 1;
    
    // Add complexity for nested structures
    const depth = (selector.match(/[ >]/g) || []).length;
    complexity += depth;
    
    return complexity;
  }

  /**
   * Count total selectors in CSS
   */
  private countSelectors(root: Root): number {
    let count = 0;
    
    root.walkRules((rule: any) => {
      count += rule.selectors.length;
    });
    
    return count;
  }

  /**
   * Count total properties in CSS
   */
  private countProperties(root: Root): number {
    let count = 0;
    
    root.walkDecls(() => {
      count++;
    });
    
    return count;
  }

  /**
   * Parse JavaScript content into AST
   */
  async parseJavaScript(content: string): Promise<any> {
    try {
      const ast = acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        ranges: true,
        allowReserved: true,
        allowImportExportEverywhere: false,
        allowAwaitOutsideFunction: false,
        allowHashBang: true
      });

      // Extract structured information
      const jsAST = {
        type: 'javascript',
        ast,
        analysis: this.analyzeJavaScriptAST(ast),
        statistics: this.calculateJavaScriptStatistics(ast),
        validation: {
          isValid: this.validateJavaScript(content),
          parseSuccess: true
        }
      };

      return jsAST;
    } catch (error) {
      throw new Error(`JavaScript parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze JavaScript AST for structure and patterns
   */
  private analyzeJavaScriptAST(ast: any): any {
    const analysis = {
      functions: [] as any[],
      variables: [] as any[],
      imports: [] as any[],
      exports: [] as any[],
      classes: [] as any[],
      calls: [] as any[],
      patterns: {
        hasAsyncFunctions: false,
        hasArrowFunctions: false,
        hasClasses: false,
        hasModules: false,
        hasTryCatch: false,
        hasLoops: false,
        hasConditionals: false
      }
    };

    // Walk the AST to collect information
    walk.simple(ast, {
      FunctionDeclaration(node: any) {
        analysis.functions.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          params: node.params.map((p: any) => p.name || 'unknown'),
          async: node.async || false,
          generator: node.generator || false,
          location: node.loc
        });
      },
      
      ArrowFunctionExpression(node: any) {
        analysis.patterns.hasArrowFunctions = true;
        analysis.functions.push({
          type: 'arrow',
          params: node.params.map((p: any) => p.name || 'unknown'),
          async: node.async || false,
          location: node.loc
        });
      },
      
      FunctionExpression(node: any) {
        analysis.functions.push({
          type: 'function-expression',
          name: node.id?.name || 'anonymous',
          params: node.params.map((p: any) => p.name || 'unknown'),
          async: node.async || false,
          generator: node.generator || false,
          location: node.loc
        });
      },
      
      VariableDeclaration(node: any) {
        node.declarations.forEach((decl: any) => {
          analysis.variables.push({
            name: decl.id.name,
            kind: node.kind,
            hasInit: !!decl.init,
            location: decl.loc
          });
        });
      },
      
      ImportDeclaration(node: any) {
        analysis.imports.push({
          source: node.source.value,
          specifiers: node.specifiers.map((s: any) => ({
            type: s.type,
            local: s.local?.name,
            imported: s.imported?.name
          })),
          location: node.loc
        });
        analysis.patterns.hasModules = true;
      },
      
      ExportNamedDeclaration(node: any) {
        analysis.exports.push({
          specifiers: node.specifiers?.map((s: any) => ({
            local: s.local?.name,
            exported: s.exported?.name
          })) || [],
          declaration: node.declaration?.type || null,
          source: node.source?.value || null,
          location: node.loc
        });
        analysis.patterns.hasModules = true;
      },
      
      ExportDefaultDeclaration(node: any) {
        analysis.exports.push({
          type: 'default',
          declaration: node.declaration?.type || null,
          location: node.loc
        });
        analysis.patterns.hasModules = true;
      },
      
      ClassDeclaration(node: any) {
        analysis.patterns.hasClasses = true;
        analysis.classes.push({
          name: node.id?.name || 'anonymous',
          superClass: node.superClass?.name || null,
          methods: node.body.body.filter((b: any) => b.type === 'MethodDefinition').length,
          properties: node.body.body.filter((b: any) => b.type === 'PropertyDefinition').length,
          location: node.loc
        });
      },
      
      CallExpression(node: any) {
        analysis.calls.push({
          callee: node.callee.type === 'Identifier' ? node.callee.name : node.callee.type,
          arguments: node.arguments.length,
          location: node.loc
        });
      },
      
      TryStatement(_node: any) {
        analysis.patterns.hasTryCatch = true;
      },
      
      ForStatement(_node: any) {
        analysis.patterns.hasLoops = true;
      },
      
      WhileStatement(_node: any) {
        analysis.patterns.hasLoops = true;
      },
      
      DoWhileStatement(_node: any) {
        analysis.patterns.hasLoops = true;
      },
      
      ForInStatement(_node: any) {
        analysis.patterns.hasLoops = true;
      },
      
      ForOfStatement(_node: any) {
        analysis.patterns.hasLoops = true;
      },
      
      IfStatement(_node: any) {
        analysis.patterns.hasConditionals = true;
      },
      
      ConditionalExpression(_node: any) {
        analysis.patterns.hasConditionals = true;
      },
      
      AwaitExpression(_node: any) {
        analysis.patterns.hasAsyncFunctions = true;
      }
    });

    return analysis;
  }

  /**
   * Calculate JavaScript statistics
   */
  private calculateJavaScriptStatistics(ast: any): any {
    let functionCount = 0;
    let variableCount = 0;
    let importCount = 0;
    let exportCount = 0;
    let classCount = 0;
    let callCount = 0;
    let lineCount = 0;
    
    // Count nodes
    walk.simple(ast, {
      FunctionDeclaration() { functionCount++; },
      FunctionExpression() { functionCount++; },
      ArrowFunctionExpression() { functionCount++; },
      VariableDeclaration() { variableCount++; },
      ImportDeclaration() { importCount++; },
      ExportNamedDeclaration() { exportCount++; },
      ExportDefaultDeclaration() { exportCount++; },
      ClassDeclaration() { classCount++; },
      CallExpression() { callCount++; }
    });

    // Estimate line count from AST
    if (ast.loc && ast.loc.end) {
      lineCount = ast.loc.end.line;
    }

    return {
      functionCount,
      variableCount,
      importCount,
      exportCount,
      classCount,
      callCount,
      lineCount,
      statementCount: this.countStatements(ast),
      complexity: this.calculateCyclomaticComplexity(ast)
    };
  }

  /**
   * Count statements in JavaScript code
   */
  private countStatements(ast: any): number {
    let count = 0;
    
    walk.simple(ast, {
      ExpressionStatement() { count++; },
      VariableDeclaration() { count++; },
      IfStatement() { count++; },
      ForStatement() { count++; },
      WhileStatement() { count++; },
      DoWhileStatement() { count++; },
      ForInStatement() { count++; },
      ForOfStatement() { count++; },
      TryStatement() { count++; },
      SwitchStatement() { count++; },
      ReturnStatement() { count++; },
      ThrowStatement() { count++; },
      BreakStatement() { count++; },
      ContinueStatement() { count++; },
      DebuggerStatement() { count++; }
    });
    
    return count;
  }

  /**
   * Calculate cyclomatic complexity (simplified)
   */
  private calculateCyclomaticComplexity(ast: any): number {
    let complexity = 1; // Base complexity
    
    walk.simple(ast, {
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      ForStatement() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      SwitchCase(node: any) {
        if (node.test) complexity++;
      },
      LogicalExpression(node: any) {
        if (node.operator === '&&' || node.operator === '||') complexity++;
      },
      CatchClause() { complexity++; }
    });
    
    return complexity;
  }

  /**
   * Validate HTML syntax
   */
  validateHTML(content: string): boolean {
    try {
      // Basic HTML validation using JSDOM
      new JSDOM(content, {
        url: 'http://localhost',
        contentType: 'text/html'
      });
      
      // Additional checks
      const hasHtmlTag = content.includes('<html') || content.includes('<!DOCTYPE');
      const hasBodyTag = content.includes('<body');
      
      return hasHtmlTag && hasBodyTag;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate CSS syntax
   */
  validateCSS(content: string): boolean {
    try {
      postcss.parse(content);
      return content.includes('{') && content.includes('}');
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate JavaScript syntax
   */
  validateJavaScript(content: string): boolean {
    try {
      acorn.parse(content, {
        ecmaVersion: 'latest',
        sourceType: 'module'
      });
      return content.trim().length > 0;
    } catch (error) {
      return false;
    }
  }
}