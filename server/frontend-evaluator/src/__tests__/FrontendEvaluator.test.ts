/**
 * Test for FrontendEvaluator
 */

import { FrontendEvaluator } from '../engine/FrontendEvaluator';
import { FileSet } from '../types';

describe('FrontendEvaluator', () => {
  let evaluator: FrontendEvaluator;

  beforeEach(() => {
    evaluator = new FrontendEvaluator();
  });

  test('should create instance', () => {
    expect(evaluator).toBeInstanceOf(FrontendEvaluator);
  });

  test('should have getVersion method', () => {
    expect(typeof evaluator.getVersion).toBe('function');
    expect(evaluator.getVersion()).toBe('1.0.0');
  });

  test('should validate input files', () => {
    const emptyFileSet: FileSet = {
      htmlFiles: new Map(),
      cssFiles: new Map(),
      jsFiles: new Map(),
      metadata: {
        totalSize: 0,
        fileCount: 0,
        technologies: []
      }
    };

    const result = evaluator.validateInput(emptyFileSet);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('No files provided for analysis');
  });

  test('should validate input with files', () => {
    const fileSet: FileSet = {
      htmlFiles: new Map([['index.html', '<html></html>']]),
      cssFiles: new Map([['styles.css', 'body { color: red; }']]),
      jsFiles: new Map([['app.js', 'console.log("test");']]),
      metadata: {
        totalSize: 0,
        fileCount: 3,
        technologies: []
      }
    };

    const result = evaluator.validateInput(fileSet);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate input with proper metadata', () => {
    const fileSet: FileSet = {
      htmlFiles: new Map([['index.html', '<html></html>']]),
      cssFiles: new Map([['styles.css', 'body { color: red; }']]),
      jsFiles: new Map([['app.js', 'console.log("test");']]),
      metadata: {
        totalSize: 100,
        fileCount: 3,
        technologies: []
      }
    };

    const result = evaluator.validateInput(fileSet);
    expect(result.isValid).toBe(true);
  });
});