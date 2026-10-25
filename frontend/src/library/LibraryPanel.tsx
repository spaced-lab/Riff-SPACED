import { useMemo, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { useStore } from '@/store';
import type { Tier } from '@/store/libraryOps';
import { allTags, filterItems } from './search';
import './library.css';

type MenuState = { tier: Tier; id: string; name: string; x: number; y: number } | null;

/**
 * The library panel (SPEC 5.2 left column, P5.T2): three collapsible groups, a search box
 * with token-AND matching, tag chips, a context menu per item (open, duplicate, rename,
 * delete with confirm), the current item highlighted, a `modified` dot on riffs edited
 * since their last file save, and drag a riff onto an arrangement to append it.
 */
export function LibraryPanel() {
  const library = useStore((s) => s.library);
  const currentRiffId = useStore((s) => s.currentRiffId);
  const currentArrangementId = useStore((s) => s.currentArrangementId);
  const currentSongId = useStore((s) => s.currentSongId);
  const editing = useStore((s) => s.editing);
  const dirtyRiffIds = useStore((s) => s.dirtyRiffIds);
  const openRiff = useStore((s) => s.openRiff);
  const openArrangement = useStore((s) => s.openArrangement);
  const openSong = useStore((s) => s.openSong);
  const duplicateRiff = useStore((s) => s.duplicateRiff);
  const renameItem = useStore((s) => s.renameItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const appendRiff = useStore((s) => s.appendRiffToArrangement);
  const openDialog = useStore((s) => s.openDialog);
  const toast = useStore((s) => s.toast);
  const createRiff = useStore((s) => s.createRiff);
  const createArrangement = useStore((s) => s.createArrangement);
  const createSong = useStore((s) => s.createSong);
  const saveCurrent = useStore((s) => s.saveCurrent);

  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<Tier, boolean>>({
    riffs: false,
    arrangements: false,
    songs: false,
  });
  const [menu, setMenu] = useState<MenuState>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const effectiveQuery = activeTag ? `${query} ${activeTag}` : query;
  const riffs = useMemo(
    () => filterItems(library.riffs, effectiveQuery),
    [library.riffs, effectiveQuery],
  );
  const arrangements = useMemo(
    () => filterItems(library.arrangements, effectiveQuery),
    [library.arrangements, effectiveQuery],
  );
  const songs = useMemo(
    () => filterItems(library.songs, effectiveQuery),
    [library.songs, effectiveQuery],
  );
  const tags = useMemo(
    () => allTags([...library.riffs, ...library.arrangements, ...library.songs]),
    [library],
  );

  const openContext = (e: MouseEvent, tier: Tier, id: string, name: string) => {
    e.preventDefault();
    setMenu({ tier, id, name, x: e.clientX, y: e.clientY });
  };

  const open = (tier: Tier, id: string) => {
    if (tier === 'riffs') openRiff(id);
    else if (tier === 'arrangements') openArrangement(id);
    else openSong(id);
  };

  const rename = (tier: Tier, id: string, name: string) =>
    openDialog({
      kind: 'prompt',
      title: 'rename',
      defaultValue: name,
      confirmLabel: 'rename',
      onConfirm: (value) => renameItem(tier, id, value),
    });

  const remove = (tier: Tier, id: string, name: string) =>
    openDialog({
      title: `delete "${name}"?`,
      message:
        tier === 'riffs'
          ? 'the riff is removed from the library and from every arrangement that uses it. this cannot be undone.'
          : tier === 'arrangements'
            ? 'the arrangement is removed from the library and from every song that uses it.'
            : 'the song is removed from the library.',
      confirmLabel: 'delete',
      danger: true,
      onConfirm: () => {
        deleteItem(tier, id);
        toast(`deleted ${name}`);
      },
    });

  const onDrop = (e: DragEvent, arrangementId: string) => {
    e.preventDefault();
    setDropTarget(null);
    const riffId = e.dataTransfer.getData('application/x-riffspaced-riff');
    if (!riffId) return;
    const error = appendRiff(arrangementId, riffId);
    if (error) toast(error, 'warn');
    else toast('added to arrangement');
  };

  const isCurrent = (tier: Tier, id: string) =>
    (tier === 'riffs' && editing === 'riff' && id === currentRiffId) ||
    (tier === 'arrangements' && editing === 'arrangement' && id === currentArrangementId) ||
    (tier === 'songs' && editing === 'song' && id === currentSongId);

  const group = (
    tier: Tier,
    title: string,
    items: { id: string; label: string; meta: string }[],
    onNew: () => void,
  ) => (
    <section className="library__group" data-testid={`library-${tier}`}>
      <header className="library__header">
        <button
          type="button"
          className="library__toggle"
          aria-expanded={!collapsed[tier]}
          onClick={() => setCollapsed({ ...collapsed, [tier]: !collapsed[tier] })}
        >
          {collapsed[tier] ? '▸' : '▾'} {title}{' '}
          <span className="library__count">{items.length}</span>
        </button>
        <button
          type="button"
          className="library__new"
          onClick={onNew}
          title={`new ${title.slice(0, -1)}`}
          aria-label={`new ${title.slice(0, -1)}`}
        >
          +
        </button>
      </header>
      {collapsed[tier] ? null : (
        <ul>
          {items.length === 0 ? (
            <li className="library__empty">
              nothing here{effectiveQuery.trim() ? ' matches' : ' yet'}
            </li>
          ) : null}
          {items.map((item) => (
            <li
              key={item.id}
              className={[
                'library__item',
                isCurrent(tier, item.id) ? 'library__item--current' : '',
                dropTarget === item.id ? 'library__item--drop' : '',
              ].join(' ')}
              data-library-item={item.id}
              draggable={tier === 'riffs'}
              onDragStart={(e) => {
                if (tier !== 'riffs') return;
                e.dataTransfer.setData('application/x-riffspaced-riff', item.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDragOver={(e) => {
                if (tier !== 'arrangements') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dropTarget !== item.id) setDropTarget(item.id);
              }}
              onDragLeave={() => (dropTarget === item.id ? setDropTarget(null) : undefined)}
              onDrop={(e) => (tier === 'arrangements' ? onDrop(e, item.id) : undefined)}
              onClick={() => open(tier, item.id)}
              onContextMenu={(e) => openContext(e, tier, item.id, item.label)}
            >
              <span className="library__name">
                {item.label}
                {tier === 'riffs' && dirtyRiffIds.includes(item.id) ? (
                  <span
                    className="library__dirty"
                    title="modified since last file save"
                    data-testid="dirty-dot"
                  >
                    ●
                  </span>
                ) : null}
              </span>
              <span className="library__meta">{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div
      className="library"
      data-testid="library-panel"
      onClick={() => (menu ? setMenu(null) : undefined)}
    >
      <input
        className="library__search"
        type="search"
        placeholder="search name, tag, tuning, section"
        aria-label="search library"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tags.length ? (
        <div className="library__tags" data-testid="tag-chips">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={activeTag === t ? 'library__chip library__chip--on' : 'library__chip'}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              aria-pressed={activeTag === t}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {group(
        'riffs',
        'riffs',
        riffs.map((r) => ({
          id: r.id,
          label: r.name,
          meta: `${r.lengthBars} bars · ${r.tempo.bpm} bpm · ${r.tuning.name}`,
        })),
        () => createRiff(),
      )}
      {group(
        'arrangements',
        'arrangements',
        arrangements.map((a) => ({
          id: a.id,
          label: a.name,
          meta: `${a.entries.length} entries · ${a.tempo.bpm} bpm`,
        })),
        () => createArrangement(),
      )}
      {group(
        'songs',
        'songs',
        songs.map((s) => ({
          id: s.id,
          label: s.title,
          meta: `${s.parts.length} parts · ${s.tuning.name}`,
        })),
        () => createSong(),
      )}

      {menu ? (
        <ul
          className="library__menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          data-testid="library-context-menu"
        >
          <li>
            <button type="button" role="menuitem" onClick={() => open(menu.tier, menu.id)}>
              open
            </button>
          </li>
          {menu.tier === 'riffs' ? (
            <li>
              <button type="button" role="menuitem" onClick={() => duplicateRiff(menu.id)}>
                duplicate
              </button>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => rename(menu.tier, menu.id, menu.name)}
            >
              rename
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              className="library__menu-danger"
              onClick={() => remove(menu.tier, menu.id, menu.name)}
            >
              delete
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                open(menu.tier, menu.id);
                void saveCurrent({ saveAs: true });
              }}
            >
              export...
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
