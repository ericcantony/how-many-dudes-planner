import { useState } from 'react';
import { APP_VERSION, CHANGELOG, GAME_VERSION, versionOf } from '../changelog';
import { CREDITS } from '../credits';
import { Modal } from './bits';

const builtAt = new Date(__BUILD_TIME__);

/** "v1.1.1.20" in the header; opens the changelog, which also says which build you're looking at. */
export function VersionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link version-btn" onClick={() => setOpen(true)} title="What's new">
        v{APP_VERSION}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="What’s new">
        <div className="changelog">
          <p className="muted small">
            You’re on <strong>v{APP_VERSION}</strong>, built from commit{' '}
            {CREDITS.repo ? (
              <a href={`${CREDITS.repo}/commit/${__BUILD_COMMIT__}`} target="_blank" rel="noreferrer">
                <code>{__BUILD_COMMIT__}</code>
              </a>
            ) : (
              <code>{__BUILD_COMMIT__}</code>
            )}{' '}
            on {builtAt.toLocaleString()}. Versions follow the game: How Many Dudes? {GAME_VERSION}, then the planner’s own
            major and release numbers.
          </p>
          <ol className="releases">
            {CHANGELOG.map((r) => (
              <li key={r.minor}>
                <h3>
                  v{versionOf(r)} <span className="muted small">{r.date}</span>
                </h3>
                <p className="release-title">{r.title}</p>
                <ul>
                  {r.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </Modal>
    </>
  );
}
