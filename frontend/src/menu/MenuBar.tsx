import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { buildMenus } from './menuModel';
import type { Menu, MenuItem } from './menuModel';
import './menu.css';

/**
 * The menu bar (SPEC 5.7). Click a title to open; while open, hovering another title
 * switches; Escape or a click outside closes. Submenus open on hover. Items show their
 * accelerator and a checkmark when on; disabled items carry their reason as a tooltip.
 */
export function MenuBar() {
  const state = useStore();
  const menus = buildMenus(state);
  const [openId, setOpenId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenId(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [openId]);

  const activate = (item: Extract<MenuItem, { type: 'item' }>) => {
    if (item.disabled) return;
    // A click on a parent opens its submenu too, not only hover: a pointer that is already
    // resting on the item never fires mouseenter (seen as a flaky submenu on the CI runner).
    if (item.submenu) {
      setSubId(item.id);
      return;
    }
    setOpenId(null);
    setSubId(null);
    item.action?.();
  };

  const renderItems = (items: MenuItem[], depth: number) =>
    items.map((item, i) => {
      if (item.type === 'separator')
        return <li key={`sep-${i}`} className="menu__separator" role="separator" />;
      const hasSub = Boolean(item.submenu?.length);
      return (
        <li
          key={item.id}
          className={
            hasSub && subId === item.id ? 'menu__entry menu__entry--sub-open' : 'menu__entry'
          }
          role="none"
          onMouseEnter={() =>
            hasSub ? setSubId(item.id) : depth === 0 ? setSubId(null) : undefined
          }
        >
          <button
            type="button"
            role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={item.checked}
            aria-disabled={item.disabled || undefined}
            aria-haspopup={hasSub || undefined}
            className={item.disabled ? 'menu__item menu__item--disabled' : 'menu__item'}
            title={item.disabled ? item.reason : undefined}
            data-menu-item={item.id}
            onClick={() => (hasSub ? setSubId(subId === item.id ? null : item.id) : activate(item))}
          >
            <span className="menu__check">{item.checked ? '✓' : ''}</span>
            <span className="menu__label">{item.label}</span>
            {item.accelerator ? <span className="menu__accel">{item.accelerator}</span> : null}
            {hasSub ? <span className="menu__arrow">▸</span> : null}
            {item.disabled && item.reason ? (
              <span className="menu__reason">{item.reason}</span>
            ) : null}
          </button>
          {hasSub && subId === item.id ? (
            <ul className="menu__list menu__list--sub" role="menu">
              {renderItems(item.submenu!, depth + 1)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <div className="menubar" ref={rootRef} role="menubar" data-testid="menubar">
      {menus.map((menu: Menu) => (
        <div key={menu.id} className="menubar__menu">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openId === menu.id}
            className={
              openId === menu.id ? 'menubar__title menubar__title--open' : 'menubar__title'
            }
            data-menu={menu.id}
            onClick={() => {
              setSubId(null);
              setOpenId(openId === menu.id ? null : menu.id);
            }}
            onMouseEnter={() => {
              if (openId && openId !== menu.id) {
                setSubId(null);
                setOpenId(menu.id);
              }
            }}
          >
            {menu.label}
          </button>
          {openId === menu.id ? (
            <ul
              className="menu__list"
              role="menu"
              aria-label={menu.label}
              data-testid={`menu-${menu.id}`}
            >
              {renderItems(menu.items, 0)}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
