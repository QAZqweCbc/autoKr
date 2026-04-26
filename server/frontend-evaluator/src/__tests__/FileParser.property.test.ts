/**
 * Property-based tests for FileParser component
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * **Property 1: Code Analysis Round-Trip Consistency**
 * 
 * For any source code input, the analysis results should be consistent 
 * when the same code is analyzed multiple times
 */

import { FileParser } from '../parsers/FileParser';

describe('FileParser Property Tests', () => {
  let fileParser: FileParser;

  beforeEach(() => {
    fileParser = new FileParser();
  });

  /**
   * Property 1: Code Analysis Round-Trip Consistency
   * 
   * This test validates that for any source code input, 
   * the analysis results should be consistent when the 
   * same code is analyzed multiple times (idempotence).
   * 
   * We test this property by:
   * 1. Generating random but valid HTML, CSS, and JavaScript code
   * 2. Parsing the same content multiple times
   * 3. Verifying the results are identical
   */
  describe('Property 1: Code Analysis Round-Trip Consistency', () => {
    /**
     * Helper function to generate random HTML content
     */
    function generateRandomHTML(): string {
      const tags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'button'];
      const attributes = ['id', 'class', 'style', 'title', 'data-test'];
      const content = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => {
        const tag = tags[Math.floor(Math.random() * tags.length)];
        const hasAttributes = Math.random() > 0.5;
        const attrString = hasAttributes 
          ? ` ${attributes[Math.floor(Math.random() * attributes.length)]}="test-${Math.random().toString(36).substring(7)}"`
          : '';
        return `<${tag}${attrString}>Content ${Math.random().toString(36).substring(7)}</${tag}>`;
      }).join('\n');

      return `<!DOCTYPE html>
<html>
<head>
  <title>Test Page ${Math.random().toString(36).substring(7)}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  ${content}
</body>
</html>`;
    }

    /**
     * Helper function to generate random CSS content
     */
    function generateRandomCSS(): string {
      const selectors = ['body', '.container', '#header', 'div', 'p', 'a', 'button', 'input'];
      const properties = [
        'color: red;',
        'font-size: 16px;',
        'margin: 0;',
        'padding: 10px;',
        'background-color: #f0f0f0;',
        'border: 1px solid #ccc;',
        'display: block;',
        'width: 100%;'
      ];

      let rules = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => {
        const selector = selectors[Math.floor(Math.random() * selectors.length)];
        const props = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => 
          properties[Math.floor(Math.random() * properties.length)]
        ).join(' ');
        return `${selector} { ${props} }`;
      }).join('\n');

      // Add media query sometimes
      if (Math.random() > 0.7) {
        rules += `\n@media (max-width: 768px) { body { font-size: 14px; } }`;
      }

      return rules;
    }

    /**
     * Helper function to generate random JavaScript content
     */
    function generateRandomJavaScript(): string {
      const constructsWithId = [
        (id: number) => `const x${id} = 1;`,
        (id: number) => `let y${id} = "test";`,
        (id: number) => `var z${id} = true;`,
        (id: number) => `function add${id}(a, b) { return a + b; }`,
        (id: number) => `const multiply${id} = (x, y) => x * y;`,
        (id: number) => `class Calculator${id} { add(a, b) { return a + b; } }`
      ];

      const constructsWithoutId = [
        'console.log("test");',
        'if (Math.random() > 0.5) { console.log("positive"); }',
        'for (let i = 0; i < 5; i++) { console.log(i); }',
        'try { riskyOperation(); } catch (error) { console.error(error); }'
      ];

      const count = Math.floor(Math.random() * 5) + 1;
      return Array.from({ length: count }, (_, i) => {
        // 60% chance of using a construct with ID, 40% without
        if (Math.random() < 0.6 && constructsWithId.length > 0) {
          const construct = constructsWithId[Math.floor(Math.random() * constructsWithId.length)];
          return construct(i);
        } else {
          return constructsWithoutId[Math.floor(Math.random() * constructsWithoutId.length)];
        }
      }).join('\n');
    }

    /**
     * Test HTML parsing idempotence with random inputs
     */
    test('HTML parsing is idempotent (random inputs)', async () => {
      // Test with 50 random HTML inputs
      for (let i = 0; i < 50; i++) {
        const htmlContent = generateRandomHTML();
        
        // Parse the same content twice
        const result1 = await fileParser.parseHTML(htmlContent);
        const result2 = await fileParser.parseHTML(htmlContent);
        
        // Results should be deeply equal
        expect(result1).toEqual(result2);
        
        // Additional consistency checks
        expect(result1.type).toBe('html');
        expect(result2.type).toBe('html');
        expect(result1.validation.isValid).toBe(result2.validation.isValid);
      }
    });

    /**
     * Test CSS parsing idempotence with random inputs
     */
    test('CSS parsing is idempotent (random inputs)', async () => {
      // Test with 50 random CSS inputs
      for (let i = 0; i < 50; i++) {
        const cssContent = generateRandomCSS();
        
        // Parse the same content twice
        const result1 = await fileParser.parseCSS(cssContent);
        const result2 = await fileParser.parseCSS(cssContent);
        
        // Results should be deeply equal
        expect(result1).toEqual(result2);
        
        // Additional consistency checks
        expect(result1.type).toBe('css');
        expect(result2.type).toBe('css');
        expect(result1.validation.isValid).toBe(result2.validation.isValid);
      }
    });

    /**
     * Test JavaScript parsing idempotence with random inputs
     */
    test('JavaScript parsing is idempotent (random inputs)', async () => {
      // Test with 50 random JavaScript inputs
      for (let i = 0; i < 50; i++) {
        const jsContent = generateRandomJavaScript();
        
        // Parse the same content twice
        const result1 = await fileParser.parseJavaScript(jsContent);
        const result2 = await fileParser.parseJavaScript(jsContent);
        
        // Results should be deeply equal
        expect(result1).toEqual(result2);
        
        // Additional consistency checks
        expect(result1.type).toBe('javascript');
        expect(result2.type).toBe('javascript');
        expect(result1.validation.isValid).toBe(result2.validation.isValid);
      }
    });

    /**
     * Test validation consistency with random inputs
     */
    test('Validation methods are consistent (random inputs)', () => {
      // Test with 100 random inputs
      for (let i = 0; i < 100; i++) {
        const htmlContent = generateRandomHTML();
        const cssContent = generateRandomCSS();
        const jsContent = generateRandomJavaScript();
        
        // Validate each content type twice
        const htmlResult1 = fileParser.validateHTML(htmlContent);
        const htmlResult2 = fileParser.validateHTML(htmlContent);
        
        const cssResult1 = fileParser.validateCSS(cssContent);
        const cssResult2 = fileParser.validateCSS(cssContent);
        
        const jsResult1 = fileParser.validateJavaScript(jsContent);
        const jsResult2 = fileParser.validateJavaScript(jsContent);
        
        // Validation should be consistent
        expect(htmlResult1).toBe(htmlResult2);
        expect(cssResult1).toBe(cssResult2);
        expect(jsResult1).toBe(jsResult2);
      }
    });

    /**
     * Test edge cases for parsing consistency
     */
    describe('Edge case consistency', () => {
      test('Empty content', async () => {
        const emptyHTML = '<!DOCTYPE html><html><head></head><body></body></html>';
        const emptyCSS = 'body {}';
        const emptyJS = 'const x = 1;';
        
        // HTML
        const htmlResult1 = await fileParser.parseHTML(emptyHTML);
        const htmlResult2 = await fileParser.parseHTML(emptyHTML);
        expect(htmlResult1).toEqual(htmlResult2);
        
        // CSS
        const cssResult1 = await fileParser.parseCSS(emptyCSS);
        const cssResult2 = await fileParser.parseCSS(emptyCSS);
        expect(cssResult1).toEqual(cssResult2);
        
        // JavaScript
        const jsResult1 = await fileParser.parseJavaScript(emptyJS);
        const jsResult2 = await fileParser.parseJavaScript(emptyJS);
        expect(jsResult1).toEqual(jsResult2);
      });

      test('Content with special characters', async () => {
        const htmlWithSpecialChars = '<!DOCTYPE html><html><body><div>&amp; &lt; &gt; &quot; &apos; &#x20;</div></body></html>';
        const cssWithSpecialChars = 'body { content: "test \\" quoted \\" string"; font-family: "Arial", sans-serif; }';
        const jsWithSpecialChars = 'const str = "test \\" quoted \\" string \\\' single \\\' quote"; console.log(`template ${str}`);';
        
        // HTML
        const htmlResult1 = await fileParser.parseHTML(htmlWithSpecialChars);
        const htmlResult2 = await fileParser.parseHTML(htmlWithSpecialChars);
        expect(htmlResult1).toEqual(htmlResult2);
        
        // CSS
        const cssResult1 = await fileParser.parseCSS(cssWithSpecialChars);
        const cssResult2 = await fileParser.parseCSS(cssWithSpecialChars);
        expect(cssResult1).toEqual(cssResult2);
        
        // JavaScript
        const jsResult1 = await fileParser.parseJavaScript(jsWithSpecialChars);
        const jsResult2 = await fileParser.parseJavaScript(jsWithSpecialChars);
        expect(jsResult1).toEqual(jsResult2);
      });

      test('Content with maximum complexity', async () => {
        const complexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complex Page</title>
  <link rel="stylesheet" href="styles.css">
  <script src="script.js" defer></script>
  <style>
    body { margin: 0; padding: 0; }
    .container { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <header id="main-header" class="header" data-test="header">
    <nav>
      <ul>
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <section aria-labelledby="section-title">
      <h1 id="section-title">Main Content</h1>
      <article>
        <p>This is a complex article with <strong>bold</strong> and <em>italic</em> text.</p>
        <div class="nested">
          <div class="deeply-nested">
            <span>Deep content</span>
          </div>
        </div>
      </article>
    </section>
  </main>
  <footer>
    <p>&copy; 2024 Test Site</p>
  </footer>
</body>
</html>`;

        const complexCSS = `/* Reset */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Layout */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Components */
.button {
  display: inline-block;
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.button:hover {
  background-color: #0056b3;
}

.button:focus {
  outline: 2px solid #0056b3;
  outline-offset: 2px;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }
  
  .button {
    padding: 10px 20px;
  }
}

@media (max-width: 480px) {
  body {
    font-size: 14px;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fade-in {
  animation: fadeIn 0.5s ease-in;
}`;

        const complexJS = `// Module imports
import { useState, useEffect } from 'react';
import { fetchData, processData } from './utils';

// Component definition
class ComplexComponent {
  constructor(config) {
    this.config = config;
    this.state = {
      data: null,
      loading: false,
      error: null
    };
  }

  async fetchData() {
    try {
      this.setState({ loading: true });
      const response = await fetch(this.config.endpoint);
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      const data = await response.json();
      const processedData = processData(data);
      this.setState({ data: processedData, loading: false });
      return processedData;
    } catch (error) {
      this.setState({ error: error.message, loading: false });
      throw error;
    }
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.onStateChange?.(this.state);
  }

  // Arrow function
  handleClick = (event) => {
    event.preventDefault();
    console.log('Button clicked', event.target);
    this.fetchData();
  };

  // Generator function
  *dataGenerator() {
    let index = 0;
    while (index < this.state.data?.length) {
      yield this.state.data[index];
      index++;
    }
  }
}

// Functional component with hooks
function App() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAddItem = useCallback((item) => {
    setItems(prev => [...prev, item]);
  }, []);

  const memoizedValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.value, 0);
  }, [items]);

  return {
    count,
    items,
    handleAddItem,
    memoizedValue
  };
}

// Export statements
export { ComplexComponent, App };
export default App;`;

        // Test all three complex examples
        const htmlResult1 = await fileParser.parseHTML(complexHTML);
        const htmlResult2 = await fileParser.parseHTML(complexHTML);
        expect(htmlResult1).toEqual(htmlResult2);

        const cssResult1 = await fileParser.parseCSS(complexCSS);
        const cssResult2 = await fileParser.parseCSS(complexCSS);
        expect(cssResult1).toEqual(cssResult2);

        const jsResult1 = await fileParser.parseJavaScript(complexJS);
        const jsResult2 = await fileParser.parseJavaScript(complexJS);
        expect(jsResult1).toEqual(jsResult2);
      });
    });
  });
});