import type { FilterPreference } from '../hooks/useFilterPreference';

export function FilterToggle({
  preference,
  onChange,
  disabled,
}: {
  preference: FilterPreference;
  onChange: (pref: FilterPreference) => void;
  disabled?: boolean;
}) {
  return (
    <div className="filter-toggle" role="group" aria-label="Store filter">
      <button
        className={`filter-toggle__option${preference === 'nearest' ? ' is-active' : ''}`}
        onClick={() => onChange('nearest')}
      >
        Nearest
      </button>
      <button
        className={`filter-toggle__option${preference === 'nearest-open' ? ' is-active' : ''}`}
        onClick={() => onChange('nearest-open')}
        disabled={disabled}
        title={disabled ? 'No opening-hours data nearby yet' : undefined}
        aria-label="Nearest open store"
      >
        Open Now
      </button>
    </div>
  );
}

export function CachedBanner() {
  return <p className="banner">Running on yesterday's intel</p>;
}

export function LowAccuracyBanner() {
  return <p className="banner">Squinting for a better fix…</p>;
}

export function WidenNetBanner({
  currentRadiusMeters,
  isWidening,
  canWidenFurther,
  onWiden,
}: {
  currentRadiusMeters: number;
  isWidening: boolean;
  canWidenFurther: boolean;
  onWiden: () => void;
}) {
  // Search radii are always whole kilometres (5, 10, 15... 50) - a plain
  // integer reads cleaner here than formatDistance's "5.0 km" (which is
  // the right call for store *distances*, where the decimal matters).
  const radiusLabel = `${Math.round(currentRadiusMeters / 1000)} km`;

  if (isWidening) {
    return (
      <button className="banner banner--tappable" disabled>
        Casting the net wider…
      </button>
    );
  }

  if (!canWidenFurther) {
    return <p className="banner">Searched out to {radiusLabel}. That's the whole net, captain.</p>;
  }

  return (
    <button className="banner banner--tappable" onClick={onWiden} aria-label={`Widen the search past ${radiusLabel}`}>
      {radiusLabel} and counting <span aria-hidden="true">·</span> Widen the net
      <span aria-hidden="true"> →</span>
    </button>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="screen screen--center">
      <div className="spinner" aria-hidden="true" />
      <p className="subcopy">{label}</p>
    </div>
  );
}

export function NoStoresFound({
  onSearchFarther,
  canSearchFarther,
}: {
  onSearchFarther: () => void;
  canSearchFarther: boolean;
}) {
  return (
    <div className="screen screen--center">
      <h1 className="headline headline--small">
        {canSearchFarther ? 'Bone dry out here.' : 'NOT A BOTTLE STORE IN SIGHT.'}
      </h1>
      {canSearchFarther ? (
        <button className="btn btn--secondary" onClick={onSearchFarther}>
          Widen the net
        </button>
      ) : (
        <p className="subcopy">There is absolutely fokol out here.</p>
      )}
    </div>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="screen screen--center">
      <h1 className="headline headline--small">The map gods are sulking.</h1>
      <p className="subcopy">{message}</p>
      <button className="btn btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function ArrivedScreen({
  storeName,
  address,
  onDirections,
  onNextNearest,
}: {
  storeName: string;
  address?: string;
  onDirections: () => void;
  onNextNearest: () => void;
}) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Mission accomplished</p>
      <h1 className="headline">YOU HAVE ARRIVED.</h1>
      <p className="store-name store-name--large">{storeName}</p>
      {address && <p className="subcopy">{address}</p>}
      <p className="quip">Go forth and hydrate. Responsibly. With wine.</p>
      <div className="arrived-actions">
        <button className="btn btn--secondary" onClick={onDirections}>
          Open in Maps
        </button>
        <button className="btn btn--ghost" onClick={onNextNearest}>
          Nope, try the next one
        </button>
      </div>
    </div>
  );
}
