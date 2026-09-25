export function EvidenceLedger() {
  return (
    <section className="evidence-ledger" aria-label="Evidence scope">
      <div>
        <span className="eyebrow">IMPLEMENTATION</span>
        <h3>Checked within the model.</h3>
        <p>
          Volume conservation, assembled geometry, full-stroke checks, timed
          receipts and paired scene identity are executable checks.
        </p>
      </div>
      <div>
        <span className="eyebrow">INDEPENDENT MODEL CHECK</span>
        <h3>The optical gap remains.</h3>
        <p>
          A new 16-image Blender grid covered only 6 of 12 side-view level
          intervals and missed all four overhead pellet features. The original
          five-image failures remain retained.
        </p>
        <a className="text-button" href="/data/readiness-optics.json" download>
          Inspect the independent optical audit
        </a>
      </div>
      <div>
        <span className="eyebrow">PHYSICAL COMPARISON</span>
        <h3>Not yet measured.</h3>
        <p>
          No printed fit, real-camera calibration, robot deployment or
          biological validation. The holder is research geometry, not a
          fabrication recommendation.
        </p>
      </div>
    </section>
  );
}
