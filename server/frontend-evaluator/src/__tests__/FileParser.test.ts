/**
 * Tests for FileParser component
 */

import { FileParser } from '../parsers/FileParser';
import { FileSet } from '../types';

describe('FileParser', () => {
  let fileParser: FileParser;

  beforeEach(() => {
    fileParser = new FileParser();
  });

  test('should create instance', () => {
    expect(fileParser).toBeInstanceOf(FileParser);
  });

  describe('HTML parsing', () => {
    test('should parse valid HTML', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>Hello World</h1>
          <p>This is a test paragraph.</p>
        </body>
        </html>
      `;

      const result = await fileParser.parseHTML(html);
      
      expect(result.type).toBe('html');
      expect(result.doctype).toBe('html');
      expect(result.metadata.title).toBe('Test Page');
      expect(result.validation.hasDoctype).toBe(true);
      expect(result.validation.hasHtmlTag).toBe(true);
      expect(result.validation.hasHeadTag).toBe(true);
      expect(result.validation.hasBodyTag).toBe(true);
      expect(result.validation.isValid).toBe(true);
    });

    test('should validate HTML syntax', () => {
      const validHTML = '<html><body>Test</body></html>';
      const invalidHTML = 'invalid html content';

      expect(fileParser.validateHTML(validHTML)).toBe(true);
      expect(fileParser.validateHTML(invalidHTML)).toBe(false);
    });

    test('should extract element information', async () => {
      const html = '<div id="test" class="container">Content</div>';
      const dom = new (await import('jsdom')).JSDOM(html);
      const element = dom.window.document.querySelector('div');
      
      const elementInfo = (fileParser as any).extractElementInfo(element);
      
      expect(elementInfo.tagName).toBe('div');
      expect(elementInfo.attributes.id).toBe('test');
      expect(elementInfo.attributes.class).toBe('container');
      expect(elementInfo.textContent).toBe('Content');
      expect(elementInfo.hasId).toBe(true);
      expect(elementInfo.hasClass).toBe(true);
    });
  });

  describe('CSS parsing', () => {
    test('should parse valid CSS', async () => {
      const css = `
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        #header {
          background-color: #f0f0f0;
          padding: 20px;
        }
        
        @media (max-width: 768px) {
          .container {
            padding: 0 15px;
          }
        }
      `;

      const result = await fileParser.parseCSS(css);
      
      expect(result.type).toBe('css');
      expect(result.rules).toHaveLength(4); // body, .container, #header, @media
      expect(result.selectors).toHaveLength(4); // body, .container, #header, .container (inside media query)
      expect(result.mediaQueries).toHaveLength(1);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.ruleCount).toBe(4);
    });

    test('should validate CSS syntax', () => {
      const validCSS = 'body { color: red; }';
      const invalidCSS = 'invalid css content';

      expect(fileParser.validateCSS(validCSS)).toBe(true);
      expect(fileParser.validateCSS(invalidCSS)).toBe(false);
    });

    test('should calculate selector specificity', () => {
      const calculateSpecificity = (fileParser as any).calculateSpecificity;
      
      expect(calculateSpecificity('body')).toBe(1); // Element selector
      expect(calculateSpecificity('.container')).toBe(10); // Class selector
      expect(calculateSpecificity('#header')).toBe(100); // ID selector
      expect(calculateSpecificity('div.container#main')).toBe(111); // Element + Class + ID
    });

    test('should analyze selector type', () => {
      const analyzeSelectorType = (fileParser as any).analyzeSelectorType;
      
      expect(analyzeSelectorType('div')).toBe('element');
      expect(analyzeSelectorType('.container')).toBe('class');
      expect(analyzeSelectorType('#header')).toBe('id');
      expect(analyzeSelectorType('[data-test]')).toBe('attribute');
      expect(analyzeSelectorType(':hover')).toBe('pseudo-class');
      expect(analyzeSelectorType('::before')).toBe('pseudo-element');
    });
  });

  describe('JavaScript parsing', () => {
    test('should parse valid JavaScript', async () => {
      const js = `
        const message = 'Hello World';
        
        function greet(name) {
          return \`Hello, \${name}!\`;
        }
        
        class Calculator {
          add(a, b) {
            return a + b;
          }
        }
        
        export { greet };
      `;

      const result = await fileParser.parseJavaScript(js);
      
      expect(result.type).toBe('javascript');
      expect(result.analysis.functions.length).toBeGreaterThan(0);
      expect(result.analysis.variables.length).toBeGreaterThan(0);
      expect(result.analysis.classes.length).toBeGreaterThan(0);
      expect(result.analysis.exports.length).toBeGreaterThan(0);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.parseSuccess).toBe(true);
    });

    test('should validate JavaScript syntax', () => {
      const validJS = 'const x = 10;';
      const invalidJS = 'const x = ;';

      expect(fileParser.validateJavaScript(validJS)).toBe(true);
      expect(fileParser.validateJavaScript(invalidJS)).toBe(false);
    });

    test('should calculate JavaScript statistics', async () => {
      const js = `
        function add(a, b) { return a + b; }
        const multiply = (x, y) => x * y;
        let counter = 0;
        
        if (counter > 0) {
          console.log('Positive');
        }
      `;

      const result = await fileParser.parseJavaScript(js);
      
      expect(result.statistics.functionCount).toBe(2);
      expect(result.statistics.variableCount).toBe(2); // const message, let counter
      expect(result.statistics.statementCount).toBeGreaterThan(0);
      expect(result.statistics.complexity).toBeGreaterThan(0);
    });
  });

  describe('parseFiles method', () => {
    test('should parse multiple files', async () => {
      const fileSet: FileSet = {
        htmlFiles: new Map([['index.html', '<html><body>Test</body></html>']]),
        cssFiles: new Map([['styles.css', 'body { color: red; }']]),
        jsFiles: new Map([['app.js', 'console.log("test");']]),
        metadata: {
          totalSize: 0,
          fileCount: 0,
          technologies: []
        }
      };

      const result = await fileParser.parseFiles(fileSet);
      
      expect(result.htmlASTs.size).toBe(1);
      expect(result.cssASTs.size).toBe(1);
      expect(result.jsASTs.size).toBe(1);
      expect(result.htmlASTs.has('index.html')).toBe(true);
      expect(result.cssASTs.has('styles.css')).toBe(true);
      expect(result.jsASTs.has('app.js')).toBe(true);
    });

    test('should handle parsing errors gracefully', async () => {
      const fileSet: FileSet = {
        htmlFiles: new Map([['invalid.html', '<invalid>']]),
        cssFiles: new Map([['invalid.css', 'invalid css']]),
        jsFiles: new Map([['invalid.js', 'invalid js']]),
        metadata: {
          totalSize: 0,
          fileCount: 0,
          technologies: []
        }
      };

      // Should not throw errors
      const result = await fileParser.parseFiles(fileSet);
      
      // Should have empty ASTs for invalid files (parsing fails)
      // Note: JSDOM is very tolerant, so HTML might still parse
      expect(result.cssASTs.size).toBe(0);
      expect(result.jsASTs.size).toBe(0);
    });
  });

  describe('utility methods', () => {
    test('should calculate element depth', () => {
      const html = `
        <div>
          <span>
            <strong>Text</strong>
          </span>
        </div>
      `;
      
      const dom = new (require('jsdom')).JSDOM(html);
      const strongElement = dom.window.document.querySelector('strong');
      
      const depth = (fileParser as any).calculateElementDepth(strongElement);
      expect(depth).toBe(4); // html -> body -> div -> span -> strong
    });

    test('should check if element is semantic', () => {
      const isSemanticElement = (fileParser as any).isSemanticElement;
      
      expect(isSemanticElement('header')).toBe(true);
      expect(isSemanticElement('nav')).toBe(true);
      expect(isSemanticElement('div')).toBe(false);
      expect(isSemanticElement('span')).toBe(false);
    });

    test('should check if element is visible', () => {
      const html1 = '<div style="display: none">Hidden</div>';
      const html2 = '<div>Visible</div>';
      
      const dom1 = new (require('jsdom')).JSDOM(html1);
      const dom2 = new (require('jsdom')).JSDOM(html2);
      
      const element1 = dom1.window.document.querySelector('div');
      const element2 = dom2.window.document.querySelector('div');
      
      const isElementVisible = (fileParser as any).isElementVisible;
      
      expect(isElementVisible(element1)).toBe(false);
      expect(isElementVisible(element2)).toBe(true);
    });
  });
});