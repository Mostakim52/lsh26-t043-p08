import {
  GPA_LETTER_SCALE,
  MARKS,
  RULES,
  SUBJECT_GRADE_SCALE,
} from '../engine/rules';
import { Callout, Card, GradeBadge } from './ui';

const ORDER = ['R-10', 'R-11', 'R-12', 'R-13', 'R-29', 'GS'];

export function RulesView() {
  return (
    <>
      <Callout tone="info" mark="i" title="One assumption, stated up front">
        The brief fixes the marking for subjects that have a practical part: theory out of{' '}
        {MARKS.theoryMax} with a pass mark of {MARKS.theoryPass}, practical out of{' '}
        {MARKS.practicalMax} with a pass mark of {MARKS.practicalPass}. It does not say how a
        subject <em>without</em> a practical part is marked, so this engine treats it as one written
        paper out of {MARKS.writtenOnlyMax} with a pass mark of {MARKS.writtenOnlyPass} - the same
        threshold the two component pass marks add up to ({MARKS.theoryPass} + {MARKS.practicalPass}{' '}
        = {MARKS.writtenOnlyPass}). Change the constants in{' '}
        <code>src/engine/rules.ts</code> and both the calculation and this page follow.
      </Callout>

      <Card
        title="Rules as written"
        description="Hover any rule chip elsewhere in the app to read the same text in place."
      >
        <div className="def-list">
          {ORDER.map((id) => {
            const rule = RULES[id];
            return (
              <div className="def-list__item" key={id}>
                <div>
                  <span className="rule-chip">{id === 'GS' ? 'Grade scale' : id}</span>
                </div>
                <div>
                  <h3>{rule.title}</h3>
                  <p>{rule.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid--two">
        <Card
          title="Subject grade points"
          description="Applied to the mark out of 100 once a subject has cleared its pass marks."
          bodyless
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mark range</th>
                  <th className="right">Grade point</th>
                  <th className="center">Letter</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECT_GRADE_SCALE.map((band) => (
                  <tr key={band.letter}>
                    <td className="num">
                      {band.min} - {band.max}
                    </td>
                    <td className="right num">{band.gp.toFixed(2)}</td>
                    <td className="center">
                      <GradeBadge letter={band.letter} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Letter grade from the final GPA"
          description="Read after rounding to 2 decimal places, and after any cancellation."
          bodyless
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>GPA range</th>
                  <th className="center">Letter</th>
                </tr>
              </thead>
              <tbody>
                {GPA_LETTER_SCALE.map((band) => (
                  <tr key={band.letter}>
                    <td className="num">
                      {band.min === band.max
                        ? band.min.toFixed(2)
                        : `${band.min.toFixed(2)} - ${band.max.toFixed(2)}`}
                    </td>
                    <td className="center">
                      <GradeBadge letter={band.letter} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Pass marks" description="Failing either part of a practical subject fails the whole subject.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th className="right">Out of</th>
                <th className="right">Pass mark</th>
                <th>Applies to</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Theory paper</td>
                <td className="right num">{MARKS.theoryMax}</td>
                <td className="right num">{MARKS.theoryPass}</td>
                <td className="muted">Subjects with a practical part</td>
              </tr>
              <tr>
                <td>Practical</td>
                <td className="right num">{MARKS.practicalMax}</td>
                <td className="right num">{MARKS.practicalPass}</td>
                <td className="muted">Subjects with a practical part</td>
              </tr>
              <tr>
                <td>Written paper</td>
                <td className="right num">{MARKS.writtenOnlyMax}</td>
                <td className="right num">{MARKS.writtenOnlyPass}</td>
                <td className="muted">Subjects with no practical part</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
