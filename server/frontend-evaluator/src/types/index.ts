/**
 * Core type definitions for the Frontend Evaluation System
 */

export enum AnalysisCategory {
  CODE_QUALITY = 'CODE_QUALITY',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  ACCESSIBILITY = 'ACCESSIBILITY',
  BEST_PRACTICES = 'BEST_PRACTICES'
}

export enum Severity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum Priority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum OutputFormat {
  JSON = 'JSON',
  HTML = 'HTML',
  MARKDOWN = 'MARKDOWN',
  CONSOLE = 'CONSOLE'
}

export enum Technology {
  REACT = 'REACT',
  VUE = 'VUE',
  ANGULAR = 'ANGULAR',
  NEXTJS = 'NEXTJS',
  SVELTE = 'SVELTE',
  JQUERY = 'JQUERY',
  BOOTSTRAP = 'BOOTSTRAP',
  TAILWIND = 'TAILWIND',
  MATERIAL_UI = 'MATERIAL_UI',
  WEBPACK = 'WEBPACK',
  VITE = 'VITE',
  TYPESCRIPT = 'TYPESCRIPT'
}

export interface Location {
  file: string;
  line?: number;
  column?: number;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  message: string;
  location: Location;
  codeSnippet: string;
  ruleId: string;
}

export interface Recommendation {
  description: string;
  priority: Priority;
  implementationSteps: string[];
  estimatedImpact: string;
}

export interface AnalysisResult {
  category: AnalysisCategory;
  findings: Finding[];
  score: number; // 0-100
  recommendations: Recommendation[];
}

export interface FileSet {
  htmlFiles: Map<string, string>; // filename -> content
  cssFiles: Map<string, string>;
  jsFiles: Map<string, string>;
  metadata: {
    totalSize: number;
    fileCount: number;
    technologies: Technology[];
  };
}

export interface ReportSummary {
  totalFindings: number;
  criticalIssues: number;
  highPriorityRecommendations: number;
  executiveSummary: string;
}

export interface TechnologyStack {
  frameworks: Technology[];
  libraries: Technology[];
  buildTools: Technology[];
  detectedVersions: Map<Technology, string>;
}

export interface ReportMetadata {
  analysisDuration: number;
  analyzedFiles: number;
  rulesApplied: number;
  timestamp: Date;
}

export interface EvaluationReport {
  summary: ReportSummary;
  categoryResults: Map<AnalysisCategory, AnalysisResult>;
  overallScore: number;
  technologyStack: TechnologyStack;
  generatedAt: Date;
  metadata: ReportMetadata;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: AnalysisCategory;
  severity: Severity;
  condition: RuleCondition;
  message: string;
  recommendation: string;
}

export type RuleCondition = (ast: any, context: AnalysisContext) => boolean;

export interface AnalysisContext {
  filePath: string;
  fileType: 'html' | 'css' | 'js';
  technologyStack: TechnologyStack;
}

export interface Config {
  rules: {
    enabled: string[]; // Rule IDs to enable
    disabled: string[]; // Rule IDs to disable
    custom: Rule[]; // Custom rule definitions
  };
  thresholds: {
    minScore: number; // Minimum acceptable score per category
    failOnCritical: boolean; // Whether to fail on critical issues
  };
  output: {
    format: OutputFormat;
    includeCodeSnippets: boolean;
    detailedFindings: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ErrorResponse {
  errorType: ErrorType;
  message: string;
  context: ErrorContext;
  recoverySuggestion: string;
  partialResults?: AnalysisResult[];
}

export enum ErrorType {
  INPUT_VALIDATION = 'INPUT_VALIDATION',
  ANALYSIS_FAILURE = 'ANALYSIS_FAILURE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  OUTPUT_GENERATION = 'OUTPUT_GENERATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

export interface ErrorContext {
  filePath?: string;
  lineNumber?: number;
  ruleId?: string;
  analysisCategory?: AnalysisCategory;
}