import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  NotionResultCard,
  NotionResultsSection,
  NotionSavePanel,
  ResultSummaryStrip,
  PlayerDisplayName,
  formatNotionDate,
} from './components';

describe('Notion results UI', () => {
  it('formats notion dates for cards', () => {
    expect(formatNotionDate('2026-03-14')).toMatch(/2026/);
    expect(formatNotionDate(null)).toBeNull();
  });

  it('renders notion cards with dps block and member chips', () => {
    const html = renderToString(
      <MemoryRouter>
        <NotionResultCard
          item={{
            page_id: 'abc',
            user_label: 'Мира',
            user_id: 'user-1',
            team_label: 'Нахида, Кадзуха, Син Цю, Нилou',
            total_dps: 125000,
            calculated_at: '2026-03-14',
            character_ids: ['nahida', 'kaedehara-kazuha'],
            members: ['Нахида C2 | АТК 1800'],
          }}
          canDelete
          onDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('result-strip');
    expect(html).toContain('result-strip-dps-value');
    expect(html).toContain('125');
    expect(html).toContain('Мира');
    expect(html).toContain('text-genshin-mintbright');
    expect(html).toContain('/results/user-1');
  });

  it('does not highlight other player names', () => {
    const html = renderToString(
      <MemoryRouter>
        <ResultSummaryStrip userName="Test" totalDps={1000} teamEntries={[]} />
      </MemoryRouter>,
    );

    expect(html).toContain('Test');
    expect(html).not.toContain('text-genshin-mintbright');
  });

  it('renders notion section grid and save panel', () => {
    const sectionHtml = renderToString(
      <MemoryRouter>
        <NotionResultsSection
          results={[
            {
              page_id: '1',
              user_label: 'Test',
              user_id: 'user-1',
              team_label: 'A, B, C, D',
              total_dps: 9000,
              calculated_at: '2026-03-14',
              character_ids: ['venti', 'hu-tao'],
              members: [],
            },
          ]}
          onRefresh={vi.fn()}
          canDeleteItem={() => true}
          canDeleteAny
          isAuthenticated
          embedded
          onDelete={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(sectionHtml).toContain('result-strip-list');
    expect(sectionHtml).toContain('glass-panel');
    expect(sectionHtml).toContain('Удалить');
    expect(sectionHtml).toContain('удалять записи');
    expect(sectionHtml).not.toContain('Результаты в Notion');

    const standaloneHtml = renderToString(
      <MemoryRouter>
        <NotionResultsSection
          results={[]}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(standaloneHtml).toContain('Расчёт игроков');

    const saveHtml = renderToString(
      <MemoryRouter>
        <NotionSavePanel onSave={vi.fn()} saveState="idle" />
      </MemoryRouter>,
    );

    expect(saveHtml).toContain('notion-save-panel');
    expect(saveHtml).toContain('Сохранить в Notion');
  });
});
