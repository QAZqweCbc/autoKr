/**
 * Performance Analyzer
 */

import { Finding, Recommendation, Severity, Priority } from '../types';

export class PerformanceAnalyzer {
  /**
   * Calculate critical rendering path length
   */
  calculateCriticalPath(htmlAST: any, cssASTs: Map<string, any>): number {
    let criticalPathLength = 0;
    
    // Count critical resources in HTML
    const criticalResources = this.findCriticalResources(htmlAST);
    criticalPathLength += criticalResources.length;
    
    // Add CSS dependencies
    const cssDependencies = this.countCSSDependencies(cssASTs);
    criticalPathLength += cssDependencies;
    
    // Add base overhead
    criticalPathLength += 2; // HTML parsing + DOM construction
    
    return criticalPathLength;
  }

  /**
   * Identify unoptimized assets
   */
  findUnoptimizedAssets(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    // Check for large images without compression
    const largeImages = this.findLargeImages(htmlAST);
    largeImages.forEach(image => {
      findings.push({
        id: `PERF-IMAGE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: Severity.MEDIUM,
        message: `Large image detected: ${image.src} (estimated size: ${image.estimatedSize}KB)`,
        location: {
          file: 'index.html', // Will be updated with actual file path
          line: image.line || 1,
          column: image.column || 1
        },
        codeSnippet: `<img src="${image.src}" alt="${image.alt || ''}">`,
        ruleId: 'PERF-LARGE-IMAGE'
      });
    });
    
    // Check for unminified CSS/JS references
    const unminifiedResources = this.findUnminifiedResources(htmlAST);
    unminifiedResources.forEach(resource => {
      findings.push({
        id: `PERF-UNMINIFIED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: Severity.LOW,
        message: `Unminified resource: ${resource.src}`,
        location: {
          file: 'index.html',
          line: resource.line || 1,
          column: resource.column || 1
        },
        codeSnippet: resource.tag === 'link' 
          ? `<link rel="stylesheet" href="${resource.src}">`
          : `<script src="${resource.src}"></script>`,
        ruleId: 'PERF-UNMINIFIED'
      });
    });
    
    // Check for missing lazy loading on images
    const missingLazyLoad = this.findMissingLazyLoad(htmlAST);
    missingLazyLoad.forEach(image => {
      findings.push({
        id: `PERF-LAZYLOAD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: Severity.LOW,
        message: `Image missing lazy loading: ${image.src}`,
        location: {
          file: 'index.html',
          line: image.line || 1,
          column: image.column || 1
        },
        codeSnippet: `<img src="${image.src}" alt="${image.alt || ''}" loading="lazy">`,
        ruleId: 'PERF-MISSING-LAZYLOAD'
      });
    });
    
    // Check for blocking resources
    const blockingResources = this.findBlockingResources(htmlAST);
    blockingResources.forEach(resource => {
      findings.push({
        id: `PERF-BLOCKING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: Severity.MEDIUM,
        message: `Blocking resource in head: ${resource.src}`,
        location: {
          file: 'index.html',
          line: resource.line || 1,
          column: resource.column || 1
        },
        codeSnippet: resource.tag === 'script'
          ? `<script src="${resource.src}"></script>`
          : `<link rel="stylesheet" href="${resource.src}">`,
        ruleId: 'PERF-BLOCKING-RESOURCE'
      });
    });
    
    return findings;
  }

  /**
   * Estimate page load time
   */
  estimateLoadTime(
    htmlAST: any,
    cssASTs: Map<string, any>,
    jsASTs: Map<string, any>
  ): number {
    let estimatedTime = 0;
    
    // Base time for HTML parsing and DOM construction
    estimatedTime += 100; // 100ms
    
    // Add time for CSS processing
    const cssSize = this.estimateCSSSize(cssASTs);
    estimatedTime += Math.min(cssSize * 0.5, 500); // 0.5ms per KB, max 500ms
    
    // Add time for JavaScript execution
    const jsSize = this.estimateJSSize(jsASTs);
    estimatedTime += Math.min(jsSize * 1.0, 1000); // 1ms per KB, max 1000ms
    
    // Add time for image loading (simulated)
    const imageCount = this.countImages(htmlAST);
    estimatedTime += imageCount * 50; // 50ms per image
    
    // Add network latency simulation (3G: 300ms RTT)
    estimatedTime += 300;
    
    // Add server response time
    estimatedTime += 200;
    
    return Math.round(estimatedTime);
  }

  /**
   * Find lazy loading opportunities
   */
  findLazyLoadingOpportunities(htmlAST: any): Finding[] {
    const findings: Finding[] = [];
    
    // Find images below the fold (simplified check)
    const images = this.extractImages(htmlAST);
    const belowFoldImages = images.filter((_img, index) => index > 2); // Assume first 3 images are above fold
    
    belowFoldImages.forEach(image => {
      if (!image.hasLazyLoading) {
        findings.push({
          id: `PERF-LAZY-OPPORTUNITY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: Severity.LOW,
          message: `Lazy loading opportunity for image: ${image.src}`,
          location: {
            file: 'index.html',
            line: image.line || 1,
            column: image.column || 1
          },
          codeSnippet: `<img src="${image.src}" alt="${image.alt || ''}" loading="lazy">`,
          ruleId: 'PERF-LAZY-OPPORTUNITY'
        });
      }
    });
    
    // Find iframes that can be lazy loaded
    const iframes = this.extractIframes(htmlAST);
    iframes.forEach(iframe => {
      if (!iframe.hasLazyLoading) {
        findings.push({
          id: `PERF-IFRAME-LAZY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: Severity.LOW,
          message: `Lazy loading opportunity for iframe`,
          location: {
            file: 'index.html',
            line: iframe.line || 1,
            column: iframe.column || 1
          },
          codeSnippet: `<iframe src="${iframe.src}" loading="lazy"></iframe>`,
          ruleId: 'PERF-IFRAME-LAZY'
        });
      }
    });
    
    // Find scripts that can be deferred
    const scripts = this.extractScripts(htmlAST);
    const blockingScripts = scripts.filter(script => !script.defer && !script.async);
    
    blockingScripts.forEach(script => {
      findings.push({
        id: `PERF-SCRIPT-DEFER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: Severity.MEDIUM,
        message: `Script can be deferred: ${script.src || 'inline script'}`,
        location: {
          file: 'index.html',
          line: script.line || 1,
          column: script.column || 1
        },
        codeSnippet: script.src 
          ? `<script src="${script.src}" defer></script>`
          : 'Consider moving script to bottom of body or adding defer attribute',
        ruleId: 'PERF-SCRIPT-DEFER'
      });
    });
    
    return findings;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(findings: Finding[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const groupedFindings = this.groupFindingsByType(findings);
    
    // Image optimization recommendations
    if (groupedFindings.images.length > 0) {
      recommendations.push({
        description: 'Optimize images for better performance',
        priority: this.getPriorityForFindings(groupedFindings.images),
        implementationSteps: [
          'Compress large images using tools like ImageOptim or Squoosh',
          'Implement lazy loading for images below the fold',
          'Use modern image formats (WebP, AVIF) when supported',
          'Implement responsive images with srcset attribute'
        ],
        estimatedImpact: 'Reduced page load time and bandwidth usage'
      });
    }
    
    // Resource loading recommendations
    if (groupedFindings.resources.length > 0) {
      recommendations.push({
        description: 'Optimize resource loading',
        priority: this.getPriorityForFindings(groupedFindings.resources),
        implementationSteps: [
          'Minify CSS and JavaScript files',
          'Defer non-critical JavaScript',
          'Use async attribute for independent scripts',
          'Combine small CSS/JS files to reduce HTTP requests',
          'Implement resource hints (preload, prefetch)'
        ],
        estimatedImpact: 'Faster initial page render and improved user experience'
      });
    }
    
    // Critical rendering path recommendations
    if (groupedFindings.criticalPath.length > 0) {
      recommendations.push({
        description: 'Optimize critical rendering path',
        priority: this.getPriorityForFindings(groupedFindings.criticalPath),
        implementationSteps: [
          'Inline critical CSS',
          'Defer non-critical CSS',
          'Minimize render-blocking resources',
          'Optimize server response times',
          'Implement caching strategies'
        ],
        estimatedImpact: 'Faster first contentful paint and time to interactive'
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate performance score
   */
  calculateScore(findings: Finding[], estimatedLoadTime: number): number {
    let score = 100;
    
    // Deduct points based on findings
    for (const finding of findings) {
      switch (finding.severity) {
        case Severity.CRITICAL:
          score -= 15;
          break;
        case Severity.HIGH:
          score -= 8;
          break;
        case Severity.MEDIUM:
          score -= 4;
          break;
        case Severity.LOW:
          score -= 2;
          break;
        case Severity.INFO:
          score -= 1;
          break;
      }
    }
    
    // Deduct points based on estimated load time
    if (estimatedLoadTime > 3000) { // > 3 seconds
      score -= 20;
    } else if (estimatedLoadTime > 2000) { // > 2 seconds
      score -= 10;
    } else if (estimatedLoadTime > 1000) { // > 1 second
      score -= 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Helper methods

  private findCriticalResources(htmlAST: any): any[] {
    const criticalResources: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'link' && 
          element.attributes.rel === 'stylesheet' &&
          !element.attributes.media) {
        criticalResources.push({
          type: 'css',
          src: element.attributes.href,
          line: element.line,
          column: element.column
        });
      } else if (element.tagName === 'script' && 
                 element.attributes.src &&
                 !element.attributes.defer &&
                 !element.attributes.async) {
        criticalResources.push({
          type: 'js',
          src: element.attributes.src,
          line: element.line,
          column: element.column
        });
      }
    }
    
    return criticalResources;
  }

  private countCSSDependencies(cssASTs: Map<string, any>): number {
    let dependencies = 0;
    
    for (const [_filename, ast] of cssASTs) {
      // Count @import statements
      const imports = ast.rules?.filter((rule: any) => rule.type === 'import') || [];
      dependencies += imports.length;
      
      // Count url() references
      const urlReferences = ast.properties?.filter((prop: any) => 
        prop.value && prop.value.includes('url(')
      ) || [];
      dependencies += urlReferences.length;
    }
    
    return dependencies;
  }

  private findLargeImages(htmlAST: any): any[] {
    const largeImages: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'img') {
        // Simulate size detection based on filename patterns
        const src = element.attributes.src || '';
        const isLarge = src.includes('large') || 
                       src.includes('banner') || 
                       src.includes('hero') ||
                       (!src.includes('thumb') && !src.includes('icon'));
        
        if (isLarge) {
          largeImages.push({
            src: element.attributes.src || '',
            alt: element.attributes.alt || '',
            line: element.line,
            column: element.column,
            estimatedSize: 200 // Simulated size in KB
          });
        }
      }
    }
    
    return largeImages;
  }

  private findUnminifiedResources(htmlAST: any): any[] {
    const unminified: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'link' && element.attributes.rel === 'stylesheet') {
        const href = element.attributes.href || '';
        if (!href.includes('.min.css') && !href.includes('.min.') && href.includes('.css')) {
          unminified.push({
            tag: 'link',
            src: href,
            line: element.line,
            column: element.column
          });
        }
      } else if (element.tagName === 'script' && element.attributes.src) {
        const src = element.attributes.src || '';
        if (!src.includes('.min.js') && !src.includes('.min.') && src.includes('.js')) {
          unminified.push({
            tag: 'script',
            src: src,
            line: element.line,
            column: element.column
          });
        }
      }
    }
    
    return unminified;
  }

  private findMissingLazyLoad(htmlAST: any): any[] {
    const missingLazyLoad: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'img') {
        const loading = element.attributes.loading;
        if (!loading || loading !== 'lazy') {
          missingLazyLoad.push({
            src: element.attributes.src || '',
            alt: element.attributes.alt || '',
            line: element.line,
            column: element.column,
            hasLazyLoading: false
          });
        }
      }
    }
    
    return missingLazyLoad;
  }

  private findBlockingResources(htmlAST: any): any[] {
    const blocking: any[] = [];
    const elements = htmlAST.elements || [];
    
    // Check for resources in head (typically blocking)
    for (const element of elements) {
      const parentTag = element.parentTag;
      if (parentTag === 'head') {
        if (element.tagName === 'script' && element.attributes.src && 
            !element.attributes.defer && !element.attributes.async) {
          blocking.push({
            tag: 'script',
            src: element.attributes.src,
            line: element.line,
            column: element.column
          });
        } else if (element.tagName === 'link' && 
                   element.attributes.rel === 'stylesheet' &&
                   !element.attributes.media) {
          blocking.push({
            tag: 'link',
            src: element.attributes.href,
            line: element.line,
            column: element.column
          });
        }
      }
    }
    
    return blocking;
  }

  private estimateCSSSize(cssASTs: Map<string, any>): number {
    let totalSize = 0;
    
    for (const [_filename, ast] of cssASTs) {
      // Estimate size based on rule count
      const ruleCount = ast.rules?.length || 0;
      const propertyCount = ast.properties?.length || 0;
      totalSize += ruleCount * 0.5 + propertyCount * 0.2; // KB estimation
    }
    
    return Math.round(totalSize);
  }

  private estimateJSSize(jsASTs: Map<string, any>): number {
    let totalSize = 0;
    
    for (const [_filename, ast] of jsASTs) {
      // Estimate size based on AST complexity
      const functionCount = ast.analysis?.functions?.length || 0;
      const variableCount = ast.analysis?.variables?.length || 0;
      const lineCount = ast.statistics?.lineCount || 0;
      
      totalSize += functionCount * 0.3 + variableCount * 0.1 + lineCount * 0.05;
    }
    
    return Math.round(totalSize);
  }

  private countImages(htmlAST: any): number {
    const elements = htmlAST.elements || [];
    return elements.filter((el: any) => el.tagName === 'img').length;
  }

  private extractImages(htmlAST: any): any[] {
    const images: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'img') {
        const attributes = element.attributes || {};
        images.push({
          src: attributes.src || '',
          alt: attributes.alt || '',
          loading: attributes.loading,
          hasLazyLoading: attributes.loading === 'lazy',
          line: element.line,
          column: element.column
        });
      }
    }
    
    return images;
  }

  private extractIframes(htmlAST: any): any[] {
    const iframes: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'iframe') {
        const attributes = element.attributes || {};
        iframes.push({
          src: attributes.src || '',
          loading: attributes.loading,
          hasLazyLoading: attributes.loading === 'lazy',
          line: element.line,
          column: element.column
        });
      }
    }
    
    return iframes;
  }

  private extractScripts(htmlAST: any): any[] {
    const scripts: any[] = [];
    const elements = htmlAST.elements || [];
    
    for (const element of elements) {
      if (element.tagName === 'script') {
        const attributes = element.attributes || {};
        scripts.push({
          src: attributes.src || '',
          defer: attributes.defer !== undefined,
          async: attributes.async !== undefined,
          line: element.line,
          column: element.column
        });
      }
    }
    
    return scripts;
  }

  private groupFindingsByType(findings: Finding[]): { 
    images: Finding[], 
    resources: Finding[], 
    criticalPath: Finding[] 
  } {
    const grouped = { images: [] as Finding[], resources: [] as Finding[], criticalPath: [] as Finding[] };
    
    for (const finding of findings) {
      if (finding.ruleId?.includes('IMAGE') || finding.ruleId?.includes('LAZY')) {
        grouped.images.push(finding);
      } else if (finding.ruleId?.includes('UNMINIFIED') || finding.ruleId?.includes('BLOCKING') || finding.ruleId?.includes('SCRIPT')) {
        grouped.resources.push(finding);
      } else if (finding.ruleId?.includes('CRITICAL') || finding.ruleId?.includes('PERF-')) {
        grouped.criticalPath.push(finding);
      }
    }
    
    return grouped;
  }

  private getPriorityForFindings(findings: Finding[]): Priority {
    if (findings.some(f => f.severity === Severity.CRITICAL || f.severity === Severity.HIGH)) {
      return Priority.HIGH;
    } else if (findings.some(f => f.severity === Severity.MEDIUM)) {
      return Priority.MEDIUM;
    } else {
      return Priority.LOW;
    }
  }
}