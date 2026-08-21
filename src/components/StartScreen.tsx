type StartScreenProps = {
  onStart: () => void;
  errorMessage?: string | null;
};

export function StartScreen({ onStart, errorMessage }: StartScreenProps) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Booze Compass</p>
      <h1 className="headline">FIND THE BOOZE.</h1>
      <p className="subcopy">
        Give us your location and we'll point you straight at the nearest
        bottle store. We're nosy about where the booze is, not about you —
        nothing's tracked or stored.
      </p>
      <button className="btn btn--primary" onClick={onStart}>
        START THE HUNT
      </button>
      {errorMessage && <p className="error-text">{errorMessage}</p>}
    </div>
  );
}

export function LocationDeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Booze Compass</p>
      <h1 className="headline headline--small">We're flying blind here.</h1>
      <p className="subcopy">
        Can't sniff out a bottle store without knowing roughly which town
        you're in. Flip location on for this site in your browser settings,
        then give it another go.
      </p>
      <button className="btn btn--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
