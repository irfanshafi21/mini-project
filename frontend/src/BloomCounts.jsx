import { LEVELS } from './blooms'
export default function BloomCounts({marks,count,value={},onChange}){
 const allocated=Object.values(value).reduce((n,c)=>n+(Number(c)||0),0)
 return <section className="bloom-allocation" aria-label={`${marks}-mark Bloom allocation`}><h4>{marks}-mark questions: K-level allocation</h4><div className="bloom-grid">{Object.entries(LEVELS).map(([level,name])=><label className="field" key={level}><span>{level} · {name}</span><input type="number" min="0" max={count} value={value[level] || 0} aria-label={`${marks}-mark ${level} questions`} onChange={e=>onChange({...value,[level]:Number(e.target.value)})}/></label>)}</div><p className={allocated===count?'small muted':'small error'} role="status">{allocated} / {count} questions allocated</p></section>
}
