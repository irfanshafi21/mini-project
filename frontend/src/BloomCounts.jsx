import { LEVELS } from './blooms'
export default function BloomCounts({ marks, count, value = {}, onChange }) {
  const allocated = Object.values(value).reduce((sum, n) => sum + (Number(n) || 0), 0)
  const complete = allocated === count
  return <section className="bloom-allocation" aria-label={`${marks}-mark Bloom allocation`}>
    <div className="bloom-heading"><div><span className="eyebrow">COGNITIVE LEVELS</span><h4>{marks}-mark questions</h4></div><span className={`allocation-badge ${complete ? 'complete' : 'incomplete'}`} role="status">{allocated} / {count} allocated</span></div>
    <div className="bloom-grid">{Object.entries(LEVELS).map(([level, name]) => <label className="field bloom-tile" key={level}><span><strong>{level}</strong><span>{name}</span></span><input type="number" min="0" max={count} value={value[level] || 0} aria-label={`${marks}-mark ${level} questions`} onChange={e => onChange({ ...value, [level]: Math.max(0, Number(e.target.value) || 0) })} /></label>)}</div>
  </section>
}
