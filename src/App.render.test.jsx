import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App render', () => {
  it('renders loading shell without throwing', () => {
    const html = renderToString(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Главная');
  });
});
