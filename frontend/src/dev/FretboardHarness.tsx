/**
 * Dev harness at /#/dev/fretboard: four fretboards side by side so the component can be
 * eyeballed in several configurations at once. Not linked from the UI.
 */
import { Fretboard } from '@/fretboard/Fretboard';
import { presetByName } from '@/music/tuning';
import { useStore } from '@/store';
import './harness.css';

export function FretboardHarness() {
  const riff = useStore((s) => s.riff);
  const bb = presetByName('Bb Standard')!;
  const e = presetByName('E Standard')!;
  const b7 = presetByName('B Standard 7')!;
  const boards = [
    {
      title: 'Bb Standard, 0-12, dots',
      tuning: bb,
      range: { from: 0, to: 12 },
      letters: false,
      realistic: false,
      sharps: false,
    },
    {
      title: 'Bb Standard, 0-12, letters',
      tuning: bb,
      range: { from: 0, to: 12 },
      letters: true,
      realistic: false,
      sharps: false,
    },
    {
      title: 'E Standard, 0-24, realistic spacing',
      tuning: e,
      range: { from: 0, to: 24 },
      letters: true,
      realistic: true,
      sharps: true,
    },
    {
      title: 'B Standard 7, seven strings, 0-12',
      tuning: b7,
      range: { from: 0, to: 12 },
      letters: true,
      realistic: false,
      sharps: false,
    },
  ];
  return (
    <div className="harness" data-testid="fretboard-harness">
      <h1>fretboard harness</h1>
      <p>
        <a href="#/">back to the app</a>
      </p>
      {boards.map((b, i) => (
        <section key={b.title} className="harness__board" data-testid={`harness-board-${i}`}>
          <h2>{b.title}</h2>
          <div className="harness__svg">
            <Fretboard
              tuning={b.tuning}
              notes={riff.notes}
              range={b.range}
              showLetters={b.letters}
              accidentals={b.sharps ? 'sharps' : 'flats'}
              realisticSpacing={b.realistic}
              label={b.title}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
