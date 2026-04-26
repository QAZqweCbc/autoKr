/**
 * Test for core type definitions
 */

import { AnalysisCategory, Severity, Priority, OutputFormat, Technology } from '../types';

describe('Core Type Definitions', () => {
  test('AnalysisCategory enum values', () => {
    expect(AnalysisCategory.CODE_QUALITY).toBe('CODE_QUALITY');
    expect(AnalysisCategory.PERFORMANCE).toBe('PERFORMANCE');
    expect(AnalysisCategory.SECURITY).toBe('SECURITY');
    expect(AnalysisCategory.ACCESSIBILITY).toBe('ACCESSIBILITY');
    expect(AnalysisCategory.BEST_PRACTICES).toBe('BEST_PRACTICES');
  });

  test('Severity enum values', () => {
    expect(Severity.CRITICAL).toBe('CRITICAL');
    expect(Severity.HIGH).toBe('HIGH');
    expect(Severity.MEDIUM).toBe('MEDIUM');
    expect(Severity.LOW).toBe('LOW');
    expect(Severity.INFO).toBe('INFO');
  });

  test('Priority enum values', () => {
    expect(Priority.HIGH).toBe('HIGH');
    expect(Priority.MEDIUM).toBe('MEDIUM');
    expect(Priority.LOW).toBe('LOW');
  });

  test('OutputFormat enum values', () => {
    expect(OutputFormat.JSON).toBe('JSON');
    expect(OutputFormat.HTML).toBe('HTML');
    expect(OutputFormat.MARKDOWN).toBe('MARKDOWN');
    expect(OutputFormat.CONSOLE).toBe('CONSOLE');
  });

  test('Technology enum values', () => {
    expect(Technology.REACT).toBe('REACT');
    expect(Technology.VUE).toBe('VUE');
    expect(Technology.ANGULAR).toBe('ANGULAR');
    expect(Technology.NEXTJS).toBe('NEXTJS');
    expect(Technology.SVELTE).toBe('SVELTE');
    expect(Technology.TAILWIND).toBe('TAILWIND');
  });
});