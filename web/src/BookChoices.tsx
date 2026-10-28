// One list of books in a release preparation's selection (#191, #190): the
// buttons that set every book in it at once, each skipping the books its
// choice does not apply to, and the table of Include, Carry forward, and Leave
// out in the same columns on every row, a choice that does not apply disabled
// with its reason. The stepper shows the new and changed books in one list and
// the books carried forward from the last release in another, which offers
// only Carry forward and Leave out: an unchanged book's file on the default
// branch is the released one, or is gone, so Include would add nothing (Rich,
// 28 October 2026, #190).

import { SELECTION_STATES } from '@tc-admin/shared/schema';
import type { SelectionState } from '@tc-admin/shared/schema';
import { ALL_BOOKS_LABELS, GROUP_LABELS, SELECTION_LABELS, selectAll, unavailableReason } from './release-stepper';
import type { Book, Selection } from './release-stepper';

interface Props {
  /** What the list is, for the buttons' group: "Set every new and changed book". */
  label: string;
  books: readonly Book[];
  selection: Selection;
  onChange: (update: (current: Selection) => Selection) => void;
  /** The choices this list offers, one column and one all-books button each; every choice when not given. */
  states?: readonly SelectionState[];
}

export function BookChoices({ label, books, selection, onChange, states = SELECTION_STATES }: Props) {
  return (
    <>
      <div className="actions" role="group" aria-label={label}>
        {states.map(state => (
          <button key={state} type="button" className="secondary" onClick={() => onChange(current => selectAll(books, current, state))}>
            {ALL_BOOKS_LABELS[state]}
          </button>
        ))}
      </div>
      <table className="files selection">
        <thead>
          <tr>
            <th scope="col">Book</th>
            <th scope="col">Since the last release</th>
            {states.map(state => (
              <th scope="col" key={state} className="choice-column">
                {SELECTION_LABELS[state]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {books.map(book => (
            <tr key={book.id}>
              <th scope="row">{book.id.toUpperCase()}</th>
              <td>{GROUP_LABELS[book.group]}</td>
              {states.map(state => {
                const reason = unavailableReason(book, state);
                return (
                  <td key={state} className="choice-column">
                    <label className={reason ? 'choice unavailable' : 'choice'}>
                      <input
                        type="radio"
                        name={`selection-${book.id}`}
                        value={state}
                        disabled={reason !== null}
                        checked={(selection[book.id] ?? book.selection) === state}
                        onChange={() => onChange(current => ({ ...current, [book.id]: state }))}
                      />
                      <span className="visually-hidden">
                        {SELECTION_LABELS[state]} {book.id.toUpperCase()}
                        {reason && `: ${reason}`}
                      </span>
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
