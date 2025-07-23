// Script to fix Timeline test files by wrapping render calls in act()
import fs from 'fs';
import path from 'path';

const testFiles = [
  'apps/web/src/components/__tests__/Timeline.filmstrip.test.tsx',
  'apps/web/src/components/__tests__/Timeline.multiselect.test.tsx'
];

testFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add act import if not present
    if (!content.includes('act') && content.includes('@testing-library/react')) {
      content = content.replace(
        'import { render, screen',
        'import { render, screen, act'
      );
    }
    
    // Fix render calls that aren't already wrapped in act
    content = content.replace(
      /const { container } = render\(<Timeline[^>]*\/>\);/g,
      `let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });`
    );
    
    // Fix simple render calls
    content = content.replace(
      /render\(<Timeline[^>]*\/>\);/g,
      `act(() => {
      render(<Timeline width={800} height={400} />);
    });`
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  }
});