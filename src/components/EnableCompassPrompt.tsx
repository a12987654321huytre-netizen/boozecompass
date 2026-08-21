type EnableCompassPromptProps = {
  onEnable: () => void;
  onSkip: () => void;
};

export function EnableCompassPrompt({ onEnable, onSkip }: EnableCompassPromptProps) {
  return (
    <div className="screen screen--center">
      <p className="eyebrow">Nearly there</p>
      <h1 className="headline headline--small">One More Tap</h1>
      <p className="subcopy">
        iPhone likes to be asked nicely before it'll tell us which way is
        north. Tap below and we're in business.
      </p>
      <button className="btn btn--primary" onClick={onEnable}>
        Point Me North
      </button>
      <button className="btn btn--ghost" onClick={onSkip}>
        Nah, just tell me in words
      </button>
    </div>
  );
}
