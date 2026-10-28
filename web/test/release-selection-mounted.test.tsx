// @vitest-environment jsdom
// The release stepper's selection step mounted (#191, #190), in two short
// steps: first the books, then the version and "Prepare the snapshot". The
// new and changed books in their own list, with a released book deleted
// from the default branch; the books carried forward from the last release in a
// closed section the manager opens to leave some out, offering only Carry
// forward and Leave out;
// Include, Carry forward, and Leave out in the same columns on every row, a
// choice that does not apply disabled and named with why; buttons that set
// every book of a list at once, skipping the books a choice does not apply to;
// a removal listed as one made book by book is (R2, R9).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ReleaseStepper } from '../src/ReleaseStepper';
import { freshness, heldWorker, planOf, projectOf } from './support/mounted';

const project = projectOf('bahtraku', 'id_tb1', 'bible');
const base = '/api/projects/bahtraku/id_tb1';
const base_ = planOf('p1');
const planWith = (books: { id: string; group: 'new' | 'changed_released' | 'unchanged' | 'deleted_from_branch' | 'unknown'; selection: 'include' | 'carry_forward' | 'leave_out' }[]) => ({
  ...base_,
  preview: { ...base_.preview, books, version: { baseline_tag: 'v1.0.0', proposed: 'v1.0.1', rule_applied: 'revisions' as const } },
});
const plan = planWith([
  { id: 'mat', group: 'changed_released', selection: 'carry_forward' },
  { id: 'mrk', group: 'new', selection: 'leave_out' },
  { id: 'jhn', group: 'unchanged', selection: 'carry_forward' },
  { id: 'jud', group: 'deleted_from_branch', selection: 'carry_forward' },
  { id: 'act', group: 'unchanged', selection: 'carry_forward' },
]);

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

async function openStep(answer: unknown = plan) {
  render(<ReleaseStepper project={project} onFailure={() => {}} />);
  await vi.waitFor(() => expect(worker.waiting()).toContain(`GET ${base}/preparations`));
  await worker.answer('GET', `${base}/preparations`, { preparations: [], freshness });
  await vi.waitFor(() => expect(worker.waiting()).toContain(`POST ${base}/releases/plan`));
  await worker.answer('POST', `${base}/releases/plan`, answer);
}

const row = (book: string) => screen.getByRole('rowheader', { name: book }).closest('tr')!;
const chosen = (book: string) => (within(row(book)).getAllByRole('radio') as HTMLInputElement[]).find(radio => radio.checked)?.value;
const changed = () => screen.getByRole('region', { name: 'New and changed books' });
const carried = () => screen.getByText(/^Books (carried forward )?from v1\.0\.0/).closest('details')!;

describe('the selection step (#190, #191)', () => {
  test('R4: the books come first: the new and changed ones, then the ones carried forward in a closed section, then "Continue to the version"; no version or Prepare yet', async () => {
    await openStep();
    const order = [changed(), carried(), screen.getByRole('button', { name: 'Continue to the version' })];
    for (let index = 1; index < order.length; index += 1) expect(order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText('Version:')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prepare the snapshot' })).toBeNull();
    expect(within(changed()).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['MAT', 'MRK', 'JUD']);
    expect(carried().open).toBe(false);
    expect(within(carried()).getByText('Books carried forward from v1.0.0 (2)')).toBeTruthy();
    expect(within(carried()).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['JHN', 'ACT']);
  });

  test('R2, R9: "Continue to the version" opens the version with the tally and the removals, focused; "Back to the books" keeps every choice', async () => {
    await openStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Include MRK' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Leave out JUD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to the version' }));
    const heading = screen.getByRole('heading', { name: 'Version' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('Compared with the last full release, v1.0.0: 1 included · 3 carried forward · 1 left out')).toBeTruthy();
    expect(screen.getByText(/Removed from this release onward: JUD\./)).toBeTruthy();
    expect((screen.getByLabelText('Version:') as HTMLInputElement).value).toBe('v1.0.1');
    expect(screen.getByRole('button', { name: 'Prepare the snapshot' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'New and changed books' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the books' }));
    expect([chosen('MRK'), chosen('JUD')]).toEqual(['include', 'leave_out']);
  });

  test('R4: the new and changed books have the three choices in the same columns, the defaults chosen, a choice that does not apply disabled with its reason (#191)', async () => {
    await openStep();
    expect(within(changed()).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Book', 'Since the last release', 'Include', 'Carry forward', 'Leave out']);
    for (const book of ['MAT', 'MRK', 'JUD']) expect(within(row(book)).getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['include', 'carry_forward', 'leave_out']);
    expect([chosen('MAT'), chosen('MRK'), chosen('JUD')]).toEqual(['carry_forward', 'leave_out', 'carry_forward']);
    expect((screen.getByRole('radio', { name: 'Carry forward MRK: not in the last release' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: 'Carry forward MAT' }) as HTMLInputElement).disabled).toBe(false);
  });

  test('R2, R4: a released book deleted from the default branch is kept by default, cannot be included, and left out is listed as a removal (#190)', async () => {
    await openStep();
    expect(within(row('JUD')).getByText('Deleted from the default branch')).toBeTruthy();
    expect(chosen('JUD')).toBe('carry_forward');
    expect((screen.getByRole('radio', { name: 'Include JUD: not on the default branch' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: 'Carry forward JUD' }) as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Leave out JUD' }));
    expect(screen.getByText(/Removed from this release onward: JUD\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Carry forward JUD' }));
    expect(screen.queryByText(/Removed from this release onward/)).toBeNull();
  });

  test('R4: the books carried forward offer only Carry forward and Leave out, since an unchanged book\'s file is the released one (#190)', async () => {
    await openStep();
    expect(within(carried()).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Book', 'Since the last release', 'Carry forward', 'Leave out']);
    for (const book of ['JHN', 'ACT']) expect(within(row(book)).getAllByRole('radio').map(radio => (radio as HTMLInputElement).value)).toEqual(['carry_forward', 'leave_out']);
    expect(within(screen.getByRole('group', { name: 'Set every book carried forward' })).getAllByRole('button').map(button => button.textContent)).toEqual(['Carry all forward', 'Leave all out']);
  });

  test('R2, R9: each list\'s buttons set only its books; leaving the carried books out names them as removals and the section says how many are left out', async () => {
    await openStep();
    const changedButtons = within(screen.getByRole('group', { name: 'Set every new and changed book' }));
    fireEvent.click(changedButtons.getByRole('button', { name: 'Include all' }));
    // A deleted book cannot be included: it keeps its choice.
    expect([chosen('MAT'), chosen('MRK'), chosen('JUD'), chosen('JHN'), chosen('ACT')]).toEqual(['include', 'include', 'carry_forward', 'carry_forward', 'carry_forward']);
    fireEvent.click(changedButtons.getByRole('button', { name: 'Carry all forward' }));
    expect([chosen('MAT'), chosen('MRK')]).toEqual(['carry_forward', 'include']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Set every book carried forward' })).getByRole('button', { name: 'Leave all out' }));
    expect([chosen('JHN'), chosen('ACT')]).toEqual(['leave_out', 'leave_out']);
    expect(screen.getByText(/Removed from this release onward: JHN, ACT\./)).toBeTruthy();
    expect(within(carried()).getByText('Books from v1.0.0 (2, 2 left out)')).toBeTruthy();
  });

  test('R4: with nothing new or changed, the step says so, and a release that leaves every book out cannot go on to the version', async () => {
    await openStep(planWith([{ id: 'jhn', group: 'unchanged', selection: 'carry_forward' }]));
    expect(within(changed()).getByText('No book is new or changed since v1.0.0.')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Set every book carried forward' })).getByRole('button', { name: 'Leave all out' }));
    expect((screen.getByRole('button', { name: 'Continue to the version' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('A release needs at least one book included or carried forward.')).toBeTruthy();
  });
});
