/**
 * Report Generator for evaluation reports
 */

import { EvaluationReport, AnalysisResult, AnalysisCategory, Config, OutputFormat } from '../types';

export class ReportGenerator {
  /**
   * Generate evaluation report
   */
  async generateReport(
    analysisResults: Map<AnalysisCategory, AnalysisResult>,
    config: Config
  ): Promise<EvaluationReport> {
    const overallScore = this.calculateOverallScore(analysisResults);
    const summary = this.generateSummary(analysisResults);
    const technologyStack = this.detectTechnologyStack(analysisResults);

    const report: EvaluationReport = {
      summary,
      categoryResults: analysisResults,
      overallScore,
      technologyStack,
      generatedAt: new Date(),
      metadata: {
        analysisDuration: 0, // Will be calculated during actual analysis
        analyzedFiles: 0, // Will be populated from FileSet
        rulesApplied: config.rules.enabled.length,
        timestamp: new Date()
      }
    };

    return report;
  }

  /**
   * Calculate overall score from category results
   */
  private calculateOverallScore(results: Map<AnalysisCategory, AnalysisResult>): number {
    let totalScore = 0;
    let categoryCount = 0;

    for (const result of results.values()) {
      totalScore += result.score;
      categoryCount++;
    }

    return categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;
  }

  /**
   * Generate report summary
   */
  private generateSummary(results: Map<AnalysisCategory, AnalysisResult>): any {
    let totalFindings = 0;
    let criticalIssues = 0;
    let highPriorityRecommendations = 0;

    for (const result of results.values()) {
      totalFindings += result.findings.length;
      
      for (const finding of result.findings) {
        if (finding.severity === 'CRITICAL') {
          criticalIssues++;
        }
      }

      for (const recommendation of result.recommendations) {
        if (recommendation.priority === 'HIGH') {
          highPriorityRecommendations++;
        }
      }
    }

    const executiveSummary = this.generateExecutiveSummary(results, totalFindings, criticalIssues);

    return {
      totalFindings,
      criticalIssues,
      highPriorityRecommendations,
      executiveSummary
    };
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    results: Map<AnalysisCategory, AnalysisResult>,
    totalFindings: number,
    criticalIssues: number
  ): string {
    if (totalFindings === 0) {
      return 'Excellent! No issues found. The codebase follows best practices across all categories.';
    }

    if (criticalIssues > 0) {
      return `Critical issues detected (${criticalIssues}). Immediate attention required for security and accessibility concerns.`;
    }

    const categoriesWithIssues: string[] = [];
    for (const [category, result] of results) {
      if (result.findings.length > 0) {
        categoriesWithIssues.push(category.toLowerCase().replace('_', ' '));
      }
    }

    if (categoriesWithIssues.length > 0) {
      return `Issues found in ${categoriesWithIssues.join(', ')}. Review recommendations for improvements.`;
    }

    return 'Analysis complete. Minor improvements suggested for optimization.';
  }

  /**
   * Detect technology stack from analysis results
   */
  private detectTechnologyStack(_results: Map<AnalysisCategory, AnalysisResult>): any {
    // Implementation will be added in Task 8
    // Will analyze code patterns to detect frameworks and libraries
    
    return {
      frameworks: [],
      libraries: [],
      buildTools: [],
      detectedVersions: new Map()
    };
  }

  /**
   * Format report based on output format
   */
  formatReport(report: EvaluationReport, format: OutputFormat): string {
    switch (format) {
      case OutputFormat.JSON:
        return this.formatAsJSON(report);
      case OutputFormat.HTML:
        return this.formatAsHTML(report);
      case OutputFormat.MARKDOWN:
        return this.formatAsMarkdown(report);
      case OutputFormat.CONSOLE:
        return this.formatForConsole(report);
      default:
        return this.formatAsJSON(report);
    }
  }

  /**
   * Format report as JSON
   */
  private formatAsJSON(report: EvaluationReport): string {
    // Convert Maps to objects for JSON serialization
    const serializableReport = {
      ...report,
      categoryResults: Object.fromEntries(report.categoryResults),
      technologyStack: {
        ...report.technologyStack,
        detectedVersions: Object.fromEntries(report.technologyStack.detectedVersions)
      }
    };
    
    return JSON.stringify(serializableReport, null, 2);
  }

  /**
   * Format report as HTML
   */
  private formatAsHTML(report: EvaluationReport): string {
    // Implementation will be added in Task 8
    return `<html><body><h1>Frontend Evaluation Report</h1><p>Overall Score: ${report.overallScore}</p></body></html>`;
  }

  /**
   * Format report as Markdown
   */
  private formatAsMarkdown(report: EvaluationReport): string {
    // Implementation will be added in Task 8
    return `# Frontend Evaluation Report\n\n**Overall Score:** ${report.overallScore}/100\n`;
  }

  /**
   * Format report for console output
   */
  private formatForConsole(report: EvaluationReport): string {
    const lines = [
      '='.repeat(60),
      'FRONTEND EVALUATION REPORT',
      '='.repeat(60),
      `Generated: ${report.generatedAt.toISOString()}`,
      `Overall Score: ${report.overallScore}/100`,
      '',
      'SUMMARY:',
      `- Total Findings: ${report.summary.totalFindings}`,
      `- Critical Issues: ${report.summary.criticalIssues}`,
      `- High Priority Recommendations: ${report.summary.highPriorityRecommendations}`,
      '',
      'CATEGORY SCORES:'
    ];

    for (const [category, result] of report.categoryResults) {
      lines.push(`- ${category}: ${result.score}/100 (${result.findings.length} findings)`);
    }

    lines.push('', report.summary.executiveSummary, '='.repeat(60));

    return lines.join('\n');
  }
}