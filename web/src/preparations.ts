// A project's release preparations as the interface finds them again (#125):
// which ones are still under way, to continue or discard, and which are
// finished; the words for each; a preparation's own address; the preparation
// a `preparation_active` refusal names; and what tC Admin recorded of making a
// release Door43 no longer has (#188). Pure functions; the stepper, the
// project view, and the release page call the operations.

import type { OperationErrorShape, Preparation, PreparationState, ProjectSummary } from '@tc-admin/shared/schema';
import { projectHash } from './portfolio-labels';
import { STATE_LABELS } from './release-stepper';

type Ref = Pick<ProjectSummary, 'ref'>;

/**
 * The states of a preparation still under way (domain model §6): every state before a
 * release but `discarded`. Each may be continued or discarded; `restart_required` is
 * continued by starting again from the selection, which discards it first (R5).
 */
export const ACTIVE_STATES: readonly PreparationState[] = ['selecting', 'snapshot_prepared', 'health_checking', 'health_blocked', 'ready_for_release', 'retryable_failure', 'restart_required'];
/** The finished states: released, or discarded. Nothing more is done to them here; a pre-release is promoted from its release's page (S7). */
export const FINISHED_STATES: readonly PreparationState[] = ['pre_release', 'full_release', 'discarded'];

export const isActive = (preparation: Pick<Preparation, 'state'>): boolean => ACTIVE_STATES.includes(preparation.state);

/** The preparations still under way, in the list's order (newest first). */
export const activePreparations = <P extends Pick<Preparation, 'state'>>(preparations: readonly P[]): P[] => preparations.filter(isActive);

/** The version a preparation goes by: the one confirmed, else its id, the version it was created with. */
export const preparationVersion = (preparation: Pick<Preparation, 'id' | 'version'>): string => preparation.version.confirmed ?? preparation.id;

/** One preparation under way, in glossary words: "A release is being prepared: version v1.1.0 · Health check running". */
export const activeSummary = (preparation: Pick<Preparation, 'id' | 'version' | 'state'>): string => `A release is being prepared: version ${preparationVersion(preparation)} · ${STATE_LABELS[preparation.state]}`;

/** A preparation's own address, `#/<owner>/<repo>/release/<version>`, so a reload lands back on it. */
export const preparationHash = (project: Ref, id: string): string => `${projectHash(project)}/release/${encodeURIComponent(id)}`;

/** The preparation a `preparation_active` refusal names (`details.preparation_id`, the version), or `null` for any other failure. */
export function refusedFor(error: Pick<OperationErrorShape, 'code' | 'details'> | null): string | null {
  if (!error || error.code !== 'preparation_active') return null;
  const id = error.details.preparation_id;
  return typeof id === 'string' && id ? id : null;
}

/** The list with one preparation replaced by its newer answer (after a discard), so the list need not be read again: Workers KV lists eventually. */
export const withAnswer = <P extends Pick<Preparation, 'id'>>(preparations: readonly P[], answer: P): P[] => preparations.map(preparation => (preparation.id === answer.id ? answer : preparation));

/**
 * A release tC Admin recorded under a tag: made as a pre-release or a full release, when, and when it was promoted, if
 * it was. `found` marks a release recorded when tC Admin found it already on Door43 (after a lost answer, or a refusal
 * because it existed), whose date is when it was found, not made; `promotion_found` the same for a promotion (bench
 * round 1 on #197).
 */
export interface MadeRelease {
  tag: string;
  prerelease: boolean;
  made_at: string;
  found: boolean;
  promoted_at: string | null;
  promotion_found: boolean;
}

/** The history events of a release or promotion tC Admin itself wrote (`release-create.ts`, `release-promote.ts`); any other recorded one was found on Door43. */
const MADE_EVENTS: readonly string[] = ['release.create', 'release.create, warnings acknowledged', 'release.promote'];

/**
 * What the listed preparations record of making the release under `tag` (#188): the preparation released under it, and
 * the history entries of its creation and its promotion. `null` when none records a release under that tag.
 */
export function madeRelease(preparations: readonly Pick<Preparation, 'state' | 'release' | 'history'>[], tag: string): MadeRelease | null {
  const released = preparations.find(preparation => (preparation.state === 'pre_release' || preparation.state === 'full_release') && preparation.release?.tag === tag);
  const made = released?.history.find(entry => entry.to === 'pre_release' || entry.to === 'full_release');
  if (!released || !made) return null;
  const promoted = released.history.find(entry => entry.from === 'pre_release' && entry.to === 'full_release');
  return { tag, prerelease: made.to === 'pre_release', made_at: made.at, found: !MADE_EVENTS.includes(made.event), promoted_at: promoted?.at ?? null, promotion_found: promoted ? !MADE_EVENTS.includes(promoted.event) : false };
}

/** The release page's words for a release tC Admin made and Door43 no longer has (#188), each date as `date` writes it. */
export function madeReleaseSentence(made: MadeRelease, date: (at: string) => string = at => new Date(at).toLocaleDateString()): string {
  const kind = `${made.prerelease ? 'pre-release' : 'full release'} ${made.tag}`;
  const recorded = made.found ? `tC Admin recorded the ${kind} on ${date(made.made_at)}, when it found the release already on Door43` : `tC Admin made the ${kind} on ${date(made.made_at)}`;
  const promoted = !made.promoted_at ? '' : made.promotion_found ? `, and recorded its promotion to a full release on ${date(made.promoted_at)}` : ` and promoted it to a full release on ${date(made.promoted_at)}`;
  return `${recorded}${promoted}. Door43 no longer has it: it may have been deleted on Door43.`;
}
