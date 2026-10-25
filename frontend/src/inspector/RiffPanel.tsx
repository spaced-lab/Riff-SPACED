import { useState } from 'react';
import { useStore } from '@/store';

/** Name and tags of the open riff (tags feed the library search and chips). */
export function RiffPanel() {
  const riff = useStore((s) => s.riff);
  const currentRiffId = useStore((s) => s.currentRiffId);
  const editing = useStore((s) => s.editing);
  const renameItem = useStore((s) => s.renameItem);
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);
  const [draft, setDraft] = useState('');
  if (editing !== 'riff' || !currentRiffId) return null;

  const commitTag = () => {
    const tag = draft.trim();
    if (tag) addTag('riffs', currentRiffId, tag);
    setDraft('');
  };

  return (
    <div data-testid="riff-panel">
      <h3>riff</h3>
      <label className="inspector__field">
        <span>name</span>
        <input
          aria-label="riff name"
          value={riff.name}
          onChange={(e) => renameItem('riffs', currentRiffId, e.target.value)}
        />
      </label>
      <div className="inspector__field">
        <span>tags</span>
        <div className="inspector__tags">
          {(riff.tags ?? []).map((t) => (
            <span key={t} className="inspector__tag" data-tag={t}>
              {t}
              <button
                type="button"
                aria-label={`remove tag ${t}`}
                onClick={() => removeTag('riffs', currentRiffId, t)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            aria-label="add tag"
            placeholder="add tag, Enter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTag();
              }
            }}
            onBlur={commitTag}
          />
        </div>
      </div>
    </div>
  );
}
