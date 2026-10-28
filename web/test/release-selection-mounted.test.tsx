// @vitest-environment jsdom
// The release stepper's book table mounted (#191): Include, Carry forward, and
// Leave out in the same columns on every row; a choice that does not apply is
// disabled and its name says why; the buttons above set every book at once,
// skipping the books a choice does not apply to, and a removal made that way is
// listed as one made book by book is (R2, R9).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ReleaseStepper } from '../src/ReleaseStepper';
import { freshness, heldWorker, planOf, projectOf } from './support/mounted';

const project = projectOf('bahtraku', 'id_tb1', 'bible');
const base = '/api/projects/bahtraku/id_tb1';
const base_ = planOf('p1');
const plan = {
  ...base_,
  preview: {
    ...base_.preview,
    books: [
      { id: 'mat', group: 'changed_released' as const, selection: 'carry_forward' as const },
      { id: 'mrk', group: 'new' as const, selection: 'leave_out' as const },
      { id: 'jhn', group: 'unchanged' as const, selection: 'carry_forward' as const },
    ],
  },
};

let worker: ReturnType<typeof heldWorker>;

beforeEach(() => {
  worker = heldWorker();
  vi.stubGlobal('fetch', worker.fetch);
  window.history.replaceState(null, '', '#/bahtraku/id_tb1/release');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openTable() {
  render(<ReleaseStepper project={project} onFailure={() => {}} />);
  await vi.waitFor(() => expect(worker.waiting()).toContain(`GET ${base}/preparations`));
  await worker.answer('GET', `${base}/preparations`, { preparations: [], freshness });
  await vi.waitFor(() => expect(worker.waiting()).toContain(`POST ${base}/releases/plan`));
  await worker.answer('POST', `${base}/releases/plan`, plan);
}

const row = (book: string) => screen.getByRole('rowheader', { name: book }).closest('tr')!;
const chosen = (book: string) => (within(row(book)).getAllByRole('radio') as HTMLInputElement[]).find(radio => radio.checked)?.value;

describe('the book table (#191)', () => {
  test('R4: every row has the three choices in the same columns, the defaults chosen, and a new book\'s Carry forward disabled with its reason', async () => {
    await openTable();
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers).toEqual(['Book', 'Since the last release', 'Include', 'Carry forward', 'Leave out']);
    for (const book of ['MAT', 'MRK', 'JHN']) expect(within(row(book)).getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['include', 'carry_forward', 'leave_out']);
    expect([chosen('MAT'), chosen('MRK'), chosen('JHN')]).toEqual(['carry_forward', 'leave_out', 'carry_forward']);
    const carry = screen.getByRole('radio', { name: 'Carry forward MRK: not in the last release' }) as HTMLInputElement;
    expect(carry.disabled).toBe(true);
    expect((screen.getByRole('radio', { name: 'Carry forward MAT' }) as HTMLInputElement).disabled).toBe(false);
  });

  test('R2, R9: the all-books buttons set every book a choice applies to; leaving all out lists the removals as one by one does', async () => {
    await openTable();
    const buttons = within(screen.getByRole('group', { name: 'Set every book' }));
    fireEvent.click(buttons.getByRole('button', { name: 'Include all' }));
    expect([chosen('MAT'), chosen('MRK'), chosen('JHN')]).toEqual(['include', 'include', 'include']);
    fireEvent.click(buttons.getByRole('button', { name: 'Carry all forward' }));
    expect([chosen('MAT'), chosen('MRK'), chosen('JHN')]).toEqual(['carry_forward', 'include', 'carry_forward']);
    fireEvent.click(buttons.getByRole('button', { name: 'Leave all out' }));
    expect([chosen('MAT'), chosen('MRK'), chosen('JHN')]).toEqual(['leave_out', 'leave_out', 'leave_out']);
    expect(screen.getByText(/Removed from this release onward: MAT, JHN\./)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Prepare the snapshot' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
