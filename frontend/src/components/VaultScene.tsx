/**
 * The 3D scene on the sign-in splash, built by hand: no model file, no WebGL,
 * no library. It is a rounded isometric box assembled from three shaded faces
 * with CSS 3D transforms, and a result sheet that is filed through the slot on
 * a loop.
 *
 * Read as: a graded result sheet going into the office safe. The travel is kept
 * short and well inside the stage so nothing drifts out of the panel. The whole
 * thing is decorative, so it is aria-hidden and stops moving under
 * prefers-reduced-motion.
 */
export function VaultScene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene__stage">
        {/* the result sheet drops through the slot */}
        <div className="sheet">
          <div className="sheet__face">
            <span className="sheet__grade">A+</span>
            <span className="sheet__line" />
            <span className="sheet__line sheet__line--short" />
            <span className="sheet__line" />
          </div>
        </div>

        <div className="vault">
          <div className="vault__top">
            <div className="vault__slot" />
          </div>
          <div className="vault__left" />
          <div className="vault__right">
            {/* grade lights on the front face */}
            <span className="pip pip--a" />
            <span className="pip pip--b" />
            <span className="pip pip--c" />
          </div>

          {/* the yellow block tucked against the box, as in the reference */}
          <div className="chip">
            <div className="chip__top" />
            <div className="chip__left" />
            <div className="chip__right" />
          </div>
        </div>

        <div className="scene__shadow" />
      </div>
    </div>
  )
}
