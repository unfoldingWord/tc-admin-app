// The review before creating, in plain words (#193): what a creation plan's
// `metadata.json` says about the new project, read from plans recorded on QA
// (E49: 2026-10-06/project-create/tc-admin-qa; E50: …/tc-admin-qa-flavor; an
// Open Bible Stories plan: 2026-10-05/project-create/tc-admin-qa-org-obs).
import { describe, expect, test } from 'vitest';
import { metadataFacts } from '../src/create-project';
import { BIBLE_METADATA, FLAVOR_METADATA, OBS_METADATA } from './support/create-plans';
const asText = (facts: ReturnType<typeof metadataFacts>) => facts.map(fact => `${fact.label}: ${fact.value}`);

describe('the project\'s details, from the plan\'s metadata (#193)', () => {
  test('W1: a Bible plan reads as its title, abbreviation, language, type, testament scope, translation details, license, and maker', () => {
    expect(asText(metadataFacts(BIBLE_METADATA))).toEqual([
      'Title: tC Admin probe 2026-10-06 0633',
      'Abbreviation: tcap0633',
      'Language: Bahasa Indonesia · id',
      'Project type: Bible',
      'Testament scope: New Testament (27 books)',
      'Kind of project: Standard',
      'Translation type: First translation',
      'Audience: Common',
      'License: CC BY-SA 4.0, in ingredients/license.md',
      'Made with: tC Admin 0.1.0, by tc-admin-qa',
    ]);
  });

  test('W1: translation details other than the defaults read in their own words (E50)', () => {
    const facts = asText(metadataFacts(FLAVOR_METADATA));
    expect(facts).toContain('Kind of project: Daughter translation');
    expect(facts).toContain('Translation type: Revision');
    expect(facts).toContain('Audience: Literary');
  });

  test('W1: an Open Bible Stories plan has no testament scope or translation details, and says what its scope is', () => {
    expect(asText(metadataFacts(OBS_METADATA))).toEqual([
      'Title: tC Admin probe OBS 2026-10-05 1948',
      'Abbreviation: obs1948',
      'Language: Bahasa Indonesia · id',
      'Project type: Open Bible Stories',
      'Scope: The Bible passages the stories draw on, in 33 books',
      'License: CC BY-SA 4.0, in ingredients/license.md',
      'Made with: tC Admin 0.1.0, by tc-admin-qa',
    ]);
  });

  test('a right-to-left language says so, a scope of both testaments or of some books reads as such, and the default language is preferred', () => {
    const metadata = {
      meta: { defaultLocale: 'fr' },
      identification: { name: { en: 'English title', fr: 'Titre' } },
      languages: [{ tag: 'ar', name: { en: 'Arabic' }, scriptDirection: 'rtl' }],
      type: { flavorType: { flavor: { name: 'textTranslation' }, currentScope: { GEN: [], EXO: [] } } },
    };
    const facts = asText(metadataFacts(metadata));
    expect(facts).toContain('Title: Titre');
    expect(facts).toContain('Language: Arabic · ar · right to left');
    expect(facts).toContain('Testament scope: 2 books');
  });

  test('H3: a value the metadata does not carry reads "Not stated", never a default', () => {
    expect(asText(metadataFacts({}))).toEqual(['Title: Not stated', 'Abbreviation: Not stated', 'Language: Not stated', 'Project type: Not stated', 'License: Not stated', 'Made with: Not stated']);
  });
});
