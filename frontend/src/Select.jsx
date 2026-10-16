import { Children, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Select({ children, value, onChange, name, required, disabled, autoFocus, 'aria-label': ariaLabel }) {
  const options = Children.toArray(children).filter(Boolean).map(child => ({ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled }))
  const current = String(value ?? '')
  const chosen = options.find(option => option.value === current)
  const id = useId(), root = useRef(null), trigger = useRef(null), menu = useRef(null), search = useRef(null)
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0), [position, setPosition] = useState(null), [portal, setPortal] = useState(null), [label, setLabel] = useState('')
  const filtered = options.filter(option => String(option.label).toLowerCase().includes(query.toLowerCase()))
  function close() { setOpen(false); trigger.current?.focus() }
  function choose(option) {
    if (!option || option.disabled) return
    onChange?.({ target: { name, value: option.value }, currentTarget: { name, value: option.value } })
    close()
  }
  function show() {
    if (disabled || trigger.current?.matches(':disabled')) return
    const rect = trigger.current.getBoundingClientRect()
    const below = innerHeight - rect.bottom, above = rect.top
    const upward = below < 220 && above > below
    setPosition({ left: Math.max(8, Math.min(rect.left, innerWidth - Math.min(Math.max(rect.width, 200), innerWidth - 16) - 8)), width: Math.min(Math.max(rect.width, 200), innerWidth - 16), maxHeight: Math.max(100, Math.min(320, (upward ? above : below) - 20)), ...(upward ? { bottom: innerHeight - rect.top + 7 } : { top: rect.bottom + 7 }) })
    setPortal(root.current?.closest('dialog') || document.body); setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === current))); setOpen(true)
  }
  useEffect(() => {
    setLabel(root.current?.closest('label')?.querySelector('span')?.textContent || name || 'Choose an option')
    if (autoFocus) trigger.current?.focus()
  }, [autoFocus, name])
  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const outside = event => { if (!root.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false) }
    const dismiss = event => { if (!menu.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const item = document.getElementById(`${id}-${active}`), list = item?.parentElement
    if (!item || !list) return
    const box = item.getBoundingClientRect(), bounds = list.getBoundingClientRect()
    if (box.bottom > bounds.bottom) list.scrollTop += box.bottom - bounds.bottom
    else if (box.top < bounds.top) list.scrollTop -= bounds.top - box.top
  }, [active, id, open])
  function keyboard(event) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', ' '].includes(event.key) && !(event.target === search.current && event.key === ' ')) {
      event.preventDefault()
      if (event.key === 'Escape') { close(); return }
      if (!open) { show(); return }
      if (event.key === 'Enter' || event.key === ' ') { choose(filtered[active]); return }
      if (event.key === 'Home') setActive(0)
      else if (event.key === 'End') setActive(filtered.length - 1)
      else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % (filtered.length || 1))
    }
    if (event.key === 'Tab') setOpen(false)
  }
  return <div className="custom-select" ref={root}>
    <select className="select-validation" name={name} value={current} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={onChange} onInvalid={event => { event.preventDefault(); show(); trigger.current?.focus() }}>{children}</select>
    <button ref={trigger} type="button" role="combobox" aria-label={ariaLabel || label} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox" aria-required={required || undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled} className={`select-trigger ${open ? 'is-open' : ''}`} onClick={() => open ? close() : show()} onKeyDown={keyboard}><span>{chosen?.label || 'Choose an option'}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {open && position && createPortal(<div ref={menu} className="select-popover" style={position} onKeyDown={keyboard}>
      {options.length >= 7 && <div className="select-search"><input ref={search} aria-label={`Search ${ariaLabel || label}`} placeholder="Search options..." value={query} onChange={event => { setQuery(event.target.value); setActive(0) }} aria-controls={id} aria-activedescendant={`${id}-${active}`} /></div>}
      <div id={id} role="listbox" aria-label={ariaLabel || label} className="select-options">{filtered.length ? filtered.map((option, index) => <div key={`${option.value}-${index}`} id={`${id}-${index}`} role="option" aria-selected={option.value === current} aria-disabled={option.disabled || undefined} className={`select-option ${active === index ? 'is-highlighted' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}><span>{option.label}</span>{option.value === current && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}</div>) : <div className="select-no-results">No matching options</div>}</div>
    </div>, portal)}
  </div>
}
