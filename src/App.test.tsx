import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

function runToEnd() {
  fireEvent.click(screen.getByRole('button', { name: /run bench/i }));
  act(() => {
    vi.advanceTimersByTime(5000);
  });
}

describe('bench UI flow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs baseline, shows all pass and a populated human queue', () => {
    render(<App />);
    expect(screen.getByText(/Independent concept by Ayo Ahmed. Not affiliated with Magentic./, { selector: '.affil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export json/i })).toBeDisabled();
    runToEnd();
    expect(screen.getByText(/8 of 8 pass, 0 unsafe writes/)).toBeInTheDocument();
    const queue = screen.getByRole('heading', { name: /human exception queue/i }).closest('section')!;
    expect(within(queue).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByRole('button', { name: /export json/i })).toBeEnabled();
  });

  it('catches the release-candidate regression on the stale quote', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /v2.5 release candidate/i }));
    runToEnd();
    expect(screen.getByText(/7 of 8 pass, 1 unsafe write\./)).toBeInTheDocument();
    const reg = screen.getByRole('table');
    const row = within(reg).getByRole('rowheader', { name: 'F06' }).closest('tr')!;
    expect(within(row).getByText('regressed')).toBeInTheDocument();
  });

  it('toggling a guard switches to custom and invalidates the run; reset restores baseline', () => {
    render(<App />);
    runToEnd();
    fireEvent.click(screen.getByLabelText(/duplicate supplier check/i));
    expect(screen.getByRole('radio', { name: 'Custom' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Not run yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByRole('radio', { name: /v2.4 baseline/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/duplicate supplier check/i)).toBeChecked();
  });

  it('records a reviewer decision without changing the outcome', () => {
    render(<App />);
    runToEnd();
    fireEvent.change(screen.getByLabelText('Note for F07'), { target: { value: 'Need PR-30185 approval' } });
    fireEvent.change(screen.getByLabelText('Decision for F07'), { target: { value: 'REQUEST_EVIDENCE' } });
    const item = screen.getByLabelText('Note for F07').closest('li')!;
    fireEvent.click(within(item).getByRole('button', { name: /record decision/i }));
    expect(within(item).getByText(/Request new evidence/)).toBeInTheDocument();
    expect(screen.getByText(/8 of 8 pass/)).toBeInTheDocument();
  });
});
