import './placeholder.css';

/** A dim outlined box naming the panel that will live here in a later phase. */
export function Placeholder({ name, phase }: { name: string; phase: number }) {
  return (
    <div
      className="placeholder"
      data-testid={`placeholder-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span>{name}</span>
      <span className="placeholder__phase">phase {phase}</span>
    </div>
  );
}
