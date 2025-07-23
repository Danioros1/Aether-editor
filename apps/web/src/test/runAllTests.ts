#!/usr/bin/env node

/**
 * Test runner script for comprehensive test suite
 * Runs all test categories with proper reporting
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

interface TestResult {
  category: string;
  passed: number;
  failed: number;
  duration: number;
  coverage?: number;
}

const testCategories = [
  {
    name: 'Unit Tests',
    pattern: 'src/**/__tests__/*.test.{ts,tsx}',
    description: 'Individual component and utility tests'
  },
  {
    name: 'Integration Tests',
    pattern: 'src/test/integration/*.test.{ts,tsx}',
    description: 'Complete workflow and user journey tests'
  },
  {
    name: 'Performance Tests',
    pattern: 'src/test/performance/*.test.{ts,tsx}',
    description: 'Performance regression and memory leak tests'
  },
  {
    name: 'Accessibility Tests',
    pattern: 'src/test/integration/accessibility.test.tsx',
    description: 'WCAG compliance and screen reader tests'
  }
];

async function runTestCategory(category: typeof testCategories[0]): Promise<TestResult> {
  console.log(`\n🧪 Running ${category.name}...`);
  console.log(`   ${category.description}`);
  
  const startTime = performance.now();
  
  try {
    const result = execSync(
      `npx vitest run --reporter=json ${category.pattern}`,
      { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    
    const duration = performance.now() - startTime;
    const testData = JSON.parse(result);
    
    return {
      category: category.name,
      passed: testData.numPassedTests || 0,
      failed: testData.numFailedTests || 0,
      duration: Math.round(duration),
      coverage: testData.coverageMap ? calculateCoverage(testData.coverageMap) : undefined
    };
    
  } catch (error: any) {
    const duration = performance.now() - startTime;
    
    // Try to parse error output for test results
    try {
      const errorOutput = error.stdout || error.stderr || '';
      const testData = JSON.parse(errorOutput);
      
      return {
        category: category.name,
        passed: testData.numPassedTests || 0,
        failed: testData.numFailedTests || testData.numTotalTests || 0,
        duration: Math.round(duration)
      };
    } catch {
      return {
        category: category.name,
        passed: 0,
        failed: 1,
        duration: Math.round(duration)
      };
    }
  }
}

function calculateCoverage(coverageMap: any): number {
  if (!coverageMap) return 0;
  
  let totalLines = 0;
  let coveredLines = 0;
  
  Object.values(coverageMap).forEach((file: any) => {
    if (file.s) {
      Object.values(file.s).forEach((count: any) => {
        totalLines++;
        if (count > 0) coveredLines++;
      });
    }
  });
  
  return totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
}

function generateReport(results: TestResult[]): string {
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const averageCoverage = results
    .filter(r => r.coverage !== undefined)
    .reduce((sum, r) => sum + (r.coverage || 0), 0) / results.length;

  let report = `# Test Report - ${new Date().toISOString()}\n\n`;
  
  report += `## Summary\n`;
  report += `- **Total Tests**: ${totalPassed + totalFailed}\n`;
  report += `- **Passed**: ${totalPassed} ✅\n`;
  report += `- **Failed**: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}\n`;
  report += `- **Duration**: ${Math.round(totalDuration / 1000)}s\n`;
  if (averageCoverage > 0) {
    report += `- **Coverage**: ${Math.round(averageCoverage)}%\n`;
  }
  report += `\n`;

  report += `## Test Categories\n\n`;
  
  results.forEach(result => {
    const status = result.failed === 0 ? '✅' : '❌';
    report += `### ${result.category} ${status}\n`;
    report += `- Passed: ${result.passed}\n`;
    report += `- Failed: ${result.failed}\n`;
    report += `- Duration: ${Math.round(result.duration / 1000)}s\n`;
    if (result.coverage) {
      report += `- Coverage: ${result.coverage}%\n`;
    }
    report += `\n`;
  });

  report += `## Performance Thresholds\n\n`;
  report += `The following performance thresholds are enforced:\n\n`;
  report += `- **Initial Render**: < 100ms (empty project)\n`;
  report += `- **Large Project Render**: < 2000ms (50+ assets, 100+ clips)\n`;
  report += `- **Timeline Scroll**: < 16ms average (60fps)\n`;
  report += `- **Asset Library Scroll**: < 16ms average (60fps)\n`;
  report += `- **Memory Usage**: < 100MB for large projects\n`;
  report += `- **Memory Cleanup**: > 80% cleanup after unmount\n\n`;

  report += `## Accessibility Compliance\n\n`;
  report += `Tests verify compliance with:\n\n`;
  report += `- WCAG 2.1 AA standards\n`;
  report += `- Keyboard navigation support\n`;
  report += `- Screen reader compatibility\n`;
  report += `- High contrast mode support\n`;
  report += `- Reduced motion preferences\n`;
  report += `- Touch target sizing (44px minimum)\n\n`;

  if (totalFailed === 0) {
    report += `## ✅ All Tests Passed!\n\n`;
    report += `The application meets all quality, performance, and accessibility standards.\n`;
  } else {
    report += `## ❌ Test Failures Detected\n\n`;
    report += `Please review and fix the failing tests before deployment.\n`;
  }

  return report;
}

async function main() {
  console.log('🚀 Starting Comprehensive Test Suite...\n');
  
  const results: TestResult[] = [];
  
  for (const category of testCategories) {
    const result = await runTestCategory(category);
    results.push(result);
    
    const status = result.failed === 0 ? '✅' : '❌';
    console.log(`   ${status} ${result.passed} passed, ${result.failed} failed (${Math.round(result.duration / 1000)}s)`);
  }
  
  console.log('\n📊 Generating test report...');
  
  const report = generateReport(results);
  writeFileSync('test-report.md', report);
  
  console.log('✅ Test report saved to test-report.md');
  
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! The application is ready for deployment.');
    process.exit(0);
  } else {
    console.log(`\n❌ ${totalFailed} tests failed. Please fix the issues before deployment.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { runTestCategory, generateReport };