// One release of a project by its tag (S7, R8): `release.lookup` says whether
// Door43 has it and which commit it targets; a pre-release can be promoted
// here with one edit of its flag, whether or not the page that created it is
// still open. When Door43 has no release under the tag, the project's stored
// preparations are read (`preparation.list`), and one that records making that
// release is named, with the date (decided 28 October 2026 by Rich, #188).
// Nothing else is written from this page.

import { useEffect, useState } from 'react';
import type { OperationOutput, ProjectSummary } from '@tc-admin/shared/schema';
import { ApiError, callOperation, failureMessage } from './api/client';
import { projectHash, releaseHash } from './portfolio-labels';
import { madeRelease, madeReleaseSentence } from './preparations';
import type { MadeRelease } from './preparations';
import { onProjectHost } from './release-stepper';

type Lookup = OperationOutput<'release.lookup'>;

const expired = (failure: unknown) => failure instanceof ApiError && failure.error.code === 'session_expired';

/**
 * `release.lookup` for the tag and, when Door43 has no release under it, what the project's stored preparations record
 * of making one (#188): `null` when none records it, or when the list cannot be read, which leaves Door43's answer alone.
 */
async function lookUp(owner: string, repo: string, tag: string): Promise<{ lookup: Lookup; made: MadeRelease | null }> {
  const lookup = await callOperation('release.lookup', { owner, repo, tag });
  if (lookup.release) return { lookup, made: null };
  try {
    const listed = await callOperation('preparation.list', { owner, repo });
    return { lookup, made: madeRelease(listed.preparations, tag) };
  } catch (failure) {
    if (expired(failure)) throw failure;
    return { lookup, made: null };
  }
}

interface Props {
  project: ProjectSummary;
  tag: string;
  onFailure: (failure: unknown) => void;
}

export function ReleaseView({ project, tag, onFailure }: Props) {
  const { owner, repo } = project.ref;
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [made, setMade] = useState<MadeRelease | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState<string[]>([]);

  const read = () =>
    lookUp(owner, repo, tag).then(
      found => {
        setLookup(found.lookup);
        setMade(found.made);
        setProblem(null);
      },
      (failure: unknown) => (expired(failure) ? onFailure(failure) : setProblem(failureMessage(failure))),
    );

  useEffect(() => {
    let current = true;
    void lookUp(owner, repo, tag).then(
      found => {
        if (!current) return;
        setLookup(found.lookup);
        setMade(found.made);
      },
      (failure: unknown) => current && (expired(failure) ? onFailure(failure) : setProblem(failureMessage(failure))),
    );
    return () => {
      current = false;
    };
  }, [owner, repo, tag, onFailure]);

  const promote = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const receipt = await callOperation('release.promote', { owner, repo, tag });
      setPromoted(receipt.wrote.map(write => `${write.kind} ${write.target}`));
      setLookup({ found: true, release: { ...receipt.result, target_sha: lookup?.release?.target_sha ?? '' } });
    } catch (failure) {
      if (expired(failure)) onFailure(failure);
      else {
        setProblem(failureMessage(failure));
        // Door43 may have applied an edit whose answer was lost: the release is read again, and the button stays
        // disabled until that read settles, so nothing is sent twice (X1).
        await read();
      }
    } finally {
      setBusy(false);
    }
  };

  const release = lookup?.release ?? null;
  return (
    <section>
      <p>
        <a href={projectHash(project)}>{project.title}</a> · <a href={releaseHash(project)}>Prepare a release</a> · <a href="#">All projects</a>
      </p>
      <h1>
        Release {tag} of {project.title}
      </h1>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      {!lookup && !problem && <p className="muted">Looking the release up on Door43…</p>}
      {lookup && !release && <p role="status">{made ? madeReleaseSentence(made) : `Door43 has no release under the tag ${tag} for this project.`}</p>}
      {release && (
        <>
          <dl className="report">
            <dt>Tag</dt>
            <dd>{release.tag}</dd>
            <dt>Status</dt>
            <dd>{release.prerelease ? 'Pre-release' : 'Full release'}</dd>
            <dt>Commit</dt>
            <dd>
              <code>{release.target_sha ? release.target_sha.slice(0, 10) : 'not named'}</code>
            </dd>
            <dt>On Door43</dt>
            <dd>
              {onProjectHost(release.url, project.ref.url) ? (
                <a href={release.url} target="_blank" rel="noreferrer">
                  {release.url}
                </a>
              ) : (
                <span className="muted">a link outside the project's Door43 host is not shown</span>
              )}
            </dd>
          </dl>
          {promoted.length > 0 && <p className="muted">Written: {promoted.join(' · ')}</p>}
          {release.prerelease && (
            <div className="actions">
              <button type="button" onClick={() => void promote()} disabled={busy}>
                Promote to a full release
              </button>
              <span className="muted">Promotion changes the pre-release flag only: not the version, not the contents.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
