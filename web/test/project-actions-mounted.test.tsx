// @vitest-environment jsdom
// The project page's actions mounted (#196): each says under it what it does,
// as its description, for a Bible and for Open Bible Stories; the field that
// opened a release by its tag is gone, and the releases a manager acts on are
// linked from the report.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ProjectView, releaseHint } from '../src/ProjectView';
import { heldWorker, projectOf } from './support/mounted';

beforeEach(() => {
  vi.stubGlobal('fetch', heldWorker().fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const description = (element: HTMLElement): string => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent ?? '';

describe('what each action does (#196)', () => {
  test('a Bible: Add books uploads USFM files, Import books copies from another project, Prepare a release chooses the books', () => {
    render(<ProjectView project={projectOf('bahtraku', 'id_tb1', 'bible')} />);
    expect(description(screen.getByRole('button', { name: 'Add books' }))).toBe('Upload USFM files from your computer');
    expect(description(screen.getByRole('button', { name: 'Import books' }))).toBe('Copy books from another project on Door43');
    expect(description(screen.getByRole('link', { name: 'Prepare a release' }))).toBe('Choose the books for a new release on Door43');
  });

  test('Open Bible Stories: the same actions name stories and Markdown files', () => {
    render(<ProjectView project={projectOf('tc-admin-qa-org', 'en_seedobs', 'obs')} />);
    expect(description(screen.getByRole('button', { name: 'Add stories' }))).toBe('Upload Markdown files from your computer');
    expect(description(screen.getByRole('button', { name: 'Import stories' }))).toBe('Copy stories from another project on Door43');
    expect(description(screen.getByRole('link', { name: 'Prepare a release' }))).toBe('Make a new release of the stories on Door43');
  });

  test('a project of another type is only offered the release, described without books', () => {
    expect(releaseHint(null)).toBe('Make a new release on Door43');
  });

  test('no field opens a release by its tag', () => {
    render(<ProjectView project={projectOf('bahtraku', 'id_tb1', 'bible')} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/A release by its tag/)).toBeNull();
  });
});
