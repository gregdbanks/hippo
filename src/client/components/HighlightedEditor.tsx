import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import type { TextMatch } from '../lib/format';
import { highlightSegments } from '../lib/format';

const COPIED_STYLES = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'textIndent',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

function syncMirror(area: HTMLTextAreaElement, mirror: HTMLDivElement) {
  const style = getComputedStyle(area);
  for (const key of COPIED_STYLES) mirror.style[key] = style[key];
  const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  mirror.style.width = `${area.clientWidth + borderX}px`;
  mirror.style.height = `${area.clientHeight + borderY}px`;
  mirror.scrollTop = area.scrollTop;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  matches: TextMatch[];
  current: number;
  scrollKey: string;
  areaRef: RefObject<HTMLTextAreaElement>;
}

export function HighlightedEditor({ value, onChange, matches, current, scrollKey, areaRef }: Props) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => highlightSegments(value, matches, current), [value, matches, current]);

  useLayoutEffect(() => {
    if (areaRef.current && mirrorRef.current) syncMirror(areaRef.current, mirrorRef.current);
  });

  useEffect(() => {
    const area = areaRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => mirrorRef.current && syncMirror(area, mirrorRef.current));
    observer.observe(area);
    return () => observer.disconnect();
  }, [areaRef]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const mirror = mirrorRef.current;
    const mark = mirror?.querySelector<HTMLElement>('[data-current]');
    if (!area || !mirror || !mark) return;
    area.scrollTop = Math.max(0, mark.offsetTop - area.clientHeight / 3);
    mirror.scrollTop = area.scrollTop;
    area.scrollIntoView({ block: 'nearest' });
  }, [current, scrollKey, areaRef]);

  return (
    <div className="hl-wrap">
      <div ref={mirrorRef} className="hl-mirror" aria-hidden="true">
        {segments.map((s, i) => (s.kind === 'plain'
          ? <span key={i}>{s.text}</span>
          : <mark key={i} className={s.kind === 'current' ? 'hl-current' : 'hl-match'} data-current={s.kind === 'current' ? '' : undefined}>{s.text}</mark>))}
        {'\n'}
      </div>
      <textarea
        ref={areaRef}
        className="editor-textarea hl-area"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={e => { if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop; }}
        spellCheck={false}
      />
    </div>
  );
}
