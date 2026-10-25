import { useStore } from '@/store';
import { SECTION_KIND_LIST, sortedSections } from '@/store/sectionOps';
import type { SectionKind } from '@/model/types';

/**
 * The section list: label, bar range, kind, split / merge. Clicking a label moves the edit
 * cursor to the section (Phase 4 also solos it). Only split and merge change boundaries,
 * so the sections can never stop covering the loop.
 */
export function SectionsPanel() {
  const riff = useStore((s) => s.riff);
  const splitSection = useStore((s) => s.splitSection);
  const mergeWithNext = useStore((s) => s.mergeSectionWithNext);
  const updateSection = useStore((s) => s.updateSection);
  const goToSection = useStore((s) => s.goToSection);
  const soloSectionId = useStore((s) => s.soloSectionId);
  const toggleSolo = useStore((s) => s.toggleSoloSection);
  const sections = sortedSections(riff.sections);

  return (
    <div className="inspector__sections" data-testid="sections-panel">
      <h3>sections</h3>
      <ul>
        {sections.map((s, i) => {
          const end = s.startBar + s.lengthBars;
          return (
            <li key={s.id} data-section={s.id}>
              <button
                type="button"
                className={
                  soloSectionId === s.id
                    ? 'inspector__section-go inspector__section-go--solo'
                    : 'inspector__section-go'
                }
                onClick={() => {
                  goToSection(s.id);
                  toggleSolo(s.id);
                }}
                title={
                  soloSectionId === s.id
                    ? 'soloed: click to loop the whole riff'
                    : 'go to section and loop only it'
                }
                aria-pressed={soloSectionId === s.id}
              >
                bars {s.startBar + 1}-{end}
              </button>
              <input
                aria-label={`section ${i + 1} label`}
                value={s.label}
                onChange={(e) => updateSection(s.id, { label: e.target.value })}
              />
              <select
                aria-label={`section ${i + 1} kind`}
                value={s.kind}
                onChange={(e) => updateSection(s.id, { kind: e.target.value as SectionKind })}
              >
                {SECTION_KIND_LIST.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={s.lengthBars < 2}
                onClick={() => splitSection(s.id, s.startBar + Math.floor(s.lengthBars / 2))}
                title="split in half"
              >
                split
              </button>
              <button
                type="button"
                disabled={i === sections.length - 1}
                onClick={() => mergeWithNext(s.id)}
                title="merge with the next section"
              >
                merge
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
