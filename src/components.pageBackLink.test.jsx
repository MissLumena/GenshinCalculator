import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PageBackLink } from './components';

describe('PageBackLink', () => {
  it('renders back arrow link with label', () => {
    const html = renderToString(
      <MemoryRouter>
        <PageBackLink to="/team" label="К команде" />
      </MemoryRouter>,
    );
    expect(html).toContain('←');
    expect(html).toContain('К команде');
    expect(html).toContain('href="/team"');
  });
});
