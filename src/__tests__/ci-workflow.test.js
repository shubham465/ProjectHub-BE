const fs = require('fs');
const path = require('path');

describe('Backend CI Workflow', () => {
  const workflowPath = path.join(__dirname, '../../.github/workflows/ci.yml');

  it('should have a CI workflow file', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('should trigger on pull_request to main', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    expect(content).toMatch(/on:\s*pull_request:/);
    expect(content).toMatch(/branches:\s*-\s*main/);
  });

  it('should run tests and lint (if applicable)', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    expect(content).toMatch(/npm ci/);
    expect(content).toMatch(/npm test/);
  });
});
