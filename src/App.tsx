import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TRIP_TYPES, TRIP_LABEL, type Item, type State, type Trip, type TripItem, type TripType } from './types';
import {
  addDays, applyTemplate, byCategory, cmp, copyChecklist, fmtDate, generateChecklist, manuallyAdd,
  norm, quickMsg, ruleSummary, splitList, today, uid,
} from './engine';
import { load, save, seed } from './store';
import { importState } from './importer';

type Tab = 'master' | 'trips' | 'stats' | 'settings';
type Modal =
  | { k: 'item'; id?: string } | { k: 'quick' }
  | { k: 'trip'; mode: 'create' | 'edit' | 'duplicate'; id?: string }
  | { k: 'addItems'; id: string } | { k: 'template'; id: string } | { k: 'checklistItem'; id: string }
  | { k: 'categories' } | null;
interface Ctx { s: State; setS: (s: State) => void; say: (m: string, undo?: State) => void; close: () => void }
type IconName = 'grid' | 'bag' | 'chart' | 'settings' | 'check' | 'plus' | 'edit' | 'trash' | 'archive';

const label = (t: TripType) => TRIP_LABEL[t];
const newItem = (name: string, categoryId: string): Item => ({
  id: uid(), name, categoryId, quantity: 1, notes: '', isAlwaysPacked: false, isOptional: false, tripTypes: [], destinations: [],
});

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect {...p} x="3" y="3" width="7" height="7" rx="1" /><rect {...p} x="14" y="3" width="7" height="7" rx="1" /><rect {...p} x="3" y="14" width="7" height="7" rx="1" /><rect {...p} x="14" y="14" width="7" height="7" rx="1" /></>,
    bag: <><path {...p} d="M5 8h14l1 12H4L5 8Z" /><path {...p} d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    chart: <><path {...p} d="M4 20V10" /><path {...p} d="M10 20V4" /><path {...p} d="M16 20v-7" /><path {...p} d="M22 20H2" /></>,
    settings: <><circle {...p} cx="12" cy="12" r="3" /><path {...p} d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.66 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.98l.06-.06A1.7 1.7 0 0 0 7 15.04a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.96a1.7 1.7 0 0 0-.34-1.88L6.6 8.02 8.72 5.9l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.04-1.56V4.7h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.04h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
    check: <path {...p} d="m5 12 4 4L19 6" />,
    plus: <path {...p} d="M12 5v14M5 12h14" />,
    edit: <><path {...p} d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path {...p} d="m13.8 7.2 3 3" /></>,
    trash: <><path {...p} d="M4 7h16M10 11v5M14 11v5M9 7l1-3h4l1 3M6 7l1 14h10l1-14" /></>,
    archive: <><path {...p} d="M4 7h16v13H4zM3 4h18v3H3zM9 12h6" /></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function EmptyIllustration({ kind }: { kind: 'trips' | 'items' }) {
  return <svg className="empty-illustration" viewBox="0 0 120 88" aria-hidden="true"><rect x="22" y="24" width="76" height="48" rx="12" fill="none" stroke="currentColor" strokeWidth="3" /><path d={kind === 'trips' ? 'M45 24v-7a15 15 0 0 1 30 0v7M37 48h46' : 'M40 42h40M40 54h28M30 25h60'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
}

export default function App() {
  const [initial] = useState(load);
  const [s, setS] = useState<State>(initial.state);
  const [recoveryMessage, setRecoveryMessage] = useState(initial.recoveryMessage);
  const [tab, setTab] = useState<Tab>('trips');
  const [tripId, setTripId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: State } | null>(null);
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(false);

  useEffect(() => { if (!recoveryMessage) save(s); }, [s, recoveryMessage]);
  useEffect(() => { navigator.storage?.persist?.(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const c: Ctx = { s, setS, say: (msg, undo) => setToast({ msg, undo }), close: () => setModal(null) };
  const tabs: [Tab, string, IconName][] = [['master', 'Master', 'grid'], ['trips', 'Trips', 'bag'], ['stats', 'Stats', 'chart'], ['settings', 'Settings', 'settings']];

  if (recoveryMessage) return <StorageRecovery message={recoveryMessage} onContinue={() => { setS(seed()); setRecoveryMessage(undefined); }} />;

  return (
    <div className="app">
      <nav>{tabs.map(([k, l, icon]) => (
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setTripId(null); }}><Icon name={icon} /><span>{l}</span></button>
      ))}</nav>
      <main>
        {tab === 'master' && <Master c={c} setModal={setModal} />}
        {tab === 'trips' && (tripId
          ? <TripDetail c={c} id={tripId} back={() => setTripId(null)} setModal={setModal} />
          : <Trips c={c} open={setTripId} setModal={setModal} backupReminderDismissed={backupReminderDismissed} dismissBackupReminder={() => setBackupReminderDismissed(true)} />)}
        {tab === 'stats' && <Stats c={c} />}
        {tab === 'settings' && <Settings c={c} />}
      </main>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {modal.k === 'item' && <ItemForm c={c} id={modal.id} />}
            {modal.k === 'quick' && <QuickAdd c={c} />}
            {modal.k === 'trip' && <TripForm c={c} mode={modal.mode} id={modal.id} onCreated={(id) => { setTab('trips'); setTripId(id); }} />}
            {modal.k === 'addItems' && <AddItems c={c} id={modal.id} />}
            {modal.k === 'template' && <SaveTemplate c={c} id={modal.id} />}
            {modal.k === 'checklistItem' && <ChecklistItemForm c={c} id={modal.id} />}
            {modal.k === 'categories' && <CategoryManager c={c} />}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">{toast.msg}
          {toast.undo && <button onClick={() => { setS(toast.undo!); setToast(null); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

function StorageRecovery({ message, onContinue }: { message: string; onContinue: () => void }) {
  return <main><section className="card"><h1>Saved data needs attention</h1><p>{message}</p><button className="pri" onClick={onContinue}>Continue with sample data</button></section></main>;
}

const Head = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="head"><h1>{title}</h1><div className="row">{children}</div></div>
);
const Sheet = ({ title, onSave, disabled, c, children }: { title: string; onSave: () => void; disabled?: boolean; c: Ctx; children: ReactNode }) => (
  <>
    <div className="sheet-head"><button onClick={c.close}>Cancel</button><b>{title}</b></div>
    <div className="form" onFocusCapture={(e) => (e.target as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })}>{children}</div>
    <div className="sheet-footer"><button className="pri" disabled={disabled} onClick={onSave}>Save</button></div>
  </>
);

/* ---------- Master list ---------- */
function Master({ c, setModal }: { c: Ctx; setModal: (m: Modal) => void }) {
  const { s } = c;
  return (
    <section>
      <Head title="Master List">
        <button onClick={() => setModal({ k: 'item' })}>+ Add</button>
        <button onClick={() => setModal({ k: 'quick' })}>Quick Add</button>
        <button onClick={() => setModal({ k: 'categories' })}>Categories</button>
      </Head>
      {!s.items.length && <div className="empty-state"><EmptyIllustration kind="items" /><p>Build a reusable master list for every trip.</p><button className="pri" onClick={() => setModal({ k: 'item' })}>Add your first item</button></div>}
      {byCategory(s.items, (i) => i.categoryId, (i) => i.name, s.categories).map(([cat, items]) => (
        <div key={cat.id}>
          <h3 className="section-title">{cat.name}</h3>
          <ul>{items.map((i) => (
            <li key={i.id} onClick={() => setModal({ k: 'item', id: i.id })}>
              <div><b>{i.name}</b>{i.quantity > 1 && ` ×${i.quantity}`}{i.isOptional && <em> · Optional</em>}</div>
              <small>{ruleSummary(i, label)}</small>
            </li>
          ))}</ul>
        </div>
      ))}
      <button className="fab" aria-label="Add item" onClick={() => setModal({ k: 'item' })}><Icon name="plus" /></button>
    </section>
  );
}

function CategoryManager({ c }: { c: Ctx }) {
  const { s } = c;
  const [newName, setNewName] = useState('');
  const categories = [...s.categories].sort((a, b) => a.sortOrder - b.sortOrder || cmp(a.name, b.name));
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (s.categories.some((category) => norm(category.name) === norm(name))) { c.say('A category with that name already exists'); return; }
    c.setS({ ...s, categories: [...s.categories, { id: uid(), name, sortOrder: categories.length }] });
    setNewName(''); c.say('Category added');
  };
  const rename = (categoryId: string, raw: string) => {
    const name = raw.trim();
    const category = s.categories.find((entry) => entry.id === categoryId);
    if (!category || !name || name === category.name) return;
    if (s.categories.some((entry) => entry.id !== categoryId && norm(entry.name) === norm(name))) { c.say('A category with that name already exists'); return; }
    c.setS({ ...s, categories: s.categories.map((entry) => entry.id === categoryId ? { ...entry, name } : entry) });
    c.say('Category renamed');
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const orders = new Map(reordered.map((category, sortOrder) => [category.id, sortOrder]));
    c.setS({ ...s, categories: s.categories.map((category) => ({ ...category, sortOrder: orders.get(category.id)! })) });
    c.say('Category order updated');
  };
  const remove = (categoryId: string) => {
    if (s.items.some((item) => item.categoryId === categoryId)) { c.say('Move or delete its items before deleting this category'); return; }
    if (!confirm('Delete this empty category?')) return;
    c.setS({ ...s, categories: s.categories.filter((category) => category.id !== categoryId) });
    c.say('Category deleted');
  };
  return (
    <>
      <div className="head"><b>Categories</b><button className="pri" onClick={c.close}>Done</button></div>
      <div className="form">
        <label>New Category<div className="row"><input value={newName} onChange={(e) => setNewName(e.target.value)} /><button className="pri" disabled={!newName.trim()} onClick={add}>Add</button></div></label>
        <ul>{categories.map((category, index) => (
          <li key={category.id} className="between">
            <input aria-label={`Category ${category.name}`} defaultValue={category.name} onBlur={(e) => rename(category.id, e.target.value)} />
            <div className="row">
              <button disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button disabled={index === categories.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button className="danger" onClick={() => remove(category.id)}>Delete</button>
            </div>
          </li>
        ))}</ul>
      </div>
    </>
  );
}

function ItemForm({ c, id }: { c: Ctx; id?: string }) {
  const { s } = c;
  const ex = s.items.find((i) => i.id === id);
  const [f, setF] = useState({
    name: ex?.name ?? '', categoryId: ex?.categoryId ?? s.categories[0]?.id ?? '', quantity: ex?.quantity ?? 1,
    notes: ex?.notes ?? '', always: ex?.isAlwaysPacked ?? false, optional: ex?.isOptional ?? false,
    types: ex?.tripTypes ?? ([] as TripType[]), dest: ex?.destinations.join(', ') ?? '',
  });
  const [err, setErr] = useState('');
  const submit = () => {
    const name = f.name.trim();
    if (!name || !f.categoryId) return;
    if (s.items.some((i) => i.id !== id && norm(i.name) === norm(name))) return setErr('An item with this name already exists.');
    const item: Item = {
      id: id ?? uid(), name, categoryId: f.categoryId, quantity: Math.min(99, Math.max(1, f.quantity)), notes: f.notes,
      isAlwaysPacked: f.always, isOptional: f.optional, tripTypes: TRIP_TYPES.filter((t) => f.types.includes(t)), destinations: splitList(f.dest),
    };
    c.setS({ ...s, items: id ? s.items.map((i) => (i.id === id ? item : i)) : [...s.items, item] });
    c.say(id ? 'Changes saved' : 'Item added'); c.close();
  };
  const del = () => {
    if (!id || !confirm('Delete this item? It will also be removed from trip checklists and templates.')) return;
    c.setS({
      ...s, items: s.items.filter((i) => i.id !== id), checklist: s.checklist.filter((r) => r.itemId !== id),
      templates: s.templates.map((t) => ({ ...t, items: t.items.filter((x) => x.itemId !== id) })),
    });
    c.say('Item deleted', s); c.close();
  };
  return (
    <Sheet c={c} title={id ? 'Edit Item' : 'Add Item'} onSave={submit} disabled={!f.name.trim() || !f.categoryId}>
      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Category<select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
        {s.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Quantity<input type="number" min={1} max={99} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) || 1 })} /></label>
      <label>Notes<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <h3>Rules</h3>
      <label className="chk"><input type="checkbox" checked={f.always} onChange={(e) => setF({ ...f, always: e.target.checked })} />Always pack</label>
      <label className="chk"><input type="checkbox" checked={f.optional} onChange={(e) => setF({ ...f, optional: e.target.checked })} />Optional</label>
      {TRIP_TYPES.map((t) => (
        <label className="chk" key={t}><input type="checkbox" checked={f.types.includes(t)}
          onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, t] : f.types.filter((x) => x !== t) })} />{TRIP_LABEL[t]}</label>
      ))}
      <label>Destinations (comma separated)<input value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })} /></label>
      {err && <p className="err">{err}</p>}
      {id && <button className="danger" onClick={del}>Delete Item</button>}
    </Sheet>
  );
}

function QuickAdd({ c }: { c: Ctx }) {
  const [cat, setCat] = useState(c.s.categories[0]?.id ?? '');
  const [text, setText] = useState('');
  const names = splitList(text);
  const go = () => {
    const seen = new Set(c.s.items.map((i) => norm(i.name)));
    const add: Item[] = []; let skipped = 0;
    for (const n of names) {
      if (seen.has(norm(n))) { skipped++; continue; }
      seen.add(norm(n)); add.push(newItem(n, cat));
    }
    c.setS({ ...c.s, items: [...c.s.items, ...add] }); c.say(quickMsg(add.length, skipped)); c.close();
  };
  return (
    <Sheet c={c} title="Quick Add" onSave={go} disabled={!cat || !names.length}>
      <label>Category<select value={cat} onChange={(e) => setCat(e.target.value)}>
        {c.s.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Items<textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <small>One item per line, or separate items with commas.</small>
    </Sheet>
  );
}

/* ---------- Trips ---------- */
function Trips({ c, open, setModal, backupReminderDismissed, dismissBackupReminder }: {
  c: Ctx; open: (id: string) => void; setModal: (m: Modal) => void; backupReminderDismissed: boolean; dismissBackupReminder: () => void;
}) {
  const { s } = c;
  const [seg, setSeg] = useState<'active' | 'archive'>('active');
  const list = s.trips.filter((t) => t.isArchived === (seg === 'archive')).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastBackup = s.lastBackupAt ? new Date(s.lastBackupAt).getTime() : 0;
  const backupDue = s.trips.length > 0 && (!lastBackup || Date.now() - lastBackup > 14 * 24 * 60 * 60 * 1000);
  const patch = (t: Trip, p: Partial<Trip>, msg: string) => { c.setS({ ...s, trips: s.trips.map((x) => (x.id === t.id ? { ...x, ...p } : x)) }); c.say(msg); };
  const del = (t: Trip) => {
    if (!confirm('Delete this trip and its checklist?')) return;
    c.setS({ ...s, trips: s.trips.filter((x) => x.id !== t.id), checklist: s.checklist.filter((r) => r.tripId !== t.id) });
    c.say('Trip deleted', s);
  };
  return (
    <section>
      <Head title="Trips"><button className="pri" onClick={() => setModal({ k: 'trip', mode: 'create' })}>+ Create Trip</button></Head>
      {backupDue && !backupReminderDismissed && <div className="card backup-banner"><div className="between"><b>Back up your packing lists</b><button onClick={dismissBackupReminder} aria-label="Dismiss backup reminder">✕</button></div><small>Export a backup from Settings to keep your lists safe.</small></div>}
      <div className="seg">{(['active', 'archive'] as const).map((k) => (
        <button key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>{k === 'active' ? 'Active' : 'Archive'}</button>))}</div>
      {!list.length && (seg === 'archive' ? <p className="empty">Archived trips will appear here.</p> : <div className="empty-state"><EmptyIllustration kind="trips" /><p>Create a trip and PackMatrix will build a checklist from your rules.</p><button className="pri" onClick={() => setModal({ k: 'trip', mode: 'create' })}>Create your first trip</button></div>)}
      <ul>{list.map((t) => {
        const rows = s.checklist.filter((r) => r.tripId === t.id);
        const done = rows.filter((r) => r.isPacked).length;
        return (
          <li key={t.id} onClick={() => open(t.id)}>
            <div className="between"><b>{t.name}</b><small>{done}/{rows.length}</small></div>
            <small>{t.destination || '—'} · {fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {TRIP_LABEL[t.tripType]}</small>
            <progress value={done} max={rows.length || 1} />
            <div className="row" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => patch(t, { isArchived: !t.isArchived }, t.isArchived ? 'Trip restored' : 'Trip archived')}>{t.isArchived ? 'Restore' : 'Archive'}</button>
              <button className="danger" onClick={() => del(t)}>Delete</button>
            </div>
          </li>
        );
      })}</ul>
      <button className="fab" aria-label="Create trip" onClick={() => setModal({ k: 'trip', mode: 'create' })}><Icon name="plus" /></button>
    </section>
  );
}

function TripForm({ c, mode, id, onCreated }: { c: Ctx; mode: 'create' | 'edit' | 'duplicate'; id?: string; onCreated: (id: string) => void }) {
  const { s } = c;
  const src = s.trips.find((t) => t.id === id);
  const [f, setF] = useState({
    name: src?.name ?? '', destination: src?.destination ?? '', tripType: (src?.tripType ?? 'weekend') as TripType,
    startDate: src?.startDate ?? today(), endDate: src?.endDate ?? addDays(today(), 3),
  });
  const [start, setStart] = useState('rules');
  const [extras, setExtras] = useState<{ name: string; categoryId: string }[]>([]);
  const [xCat, setXCat] = useState(s.categories[0]?.id ?? '');
  const [xText, setXText] = useState('');
  const valid = !!f.name.trim() && f.endDate >= f.startDate;

  const counts = new Map<string, number>();
  s.checklist.forEach((r) => counts.set(r.itemId, (counts.get(r.itemId) ?? 0) + 1));
  const recent = [...counts.entries()]
    .map(([itemId, n]) => ({ item: s.items.find((i) => i.id === itemId), n }))
    .filter((x): x is { item: Item; n: number } => !!x.item)
    .sort((a, b) => b.n - a.n || cmp(a.item.name, b.item.name)).slice(0, 10);

  const addExtras = () => {
    const seen = new Set(extras.map((x) => norm(x.name)));
    const add = splitList(xText).filter((n) => !seen.has(norm(n)) && (seen.add(norm(n)), true)).map((name) => ({ name, categoryId: xCat }));
    setExtras([...extras, ...add]); setXText('');
  };

  const submit = () => {
    if (!valid) return;
    const base = { name: f.name.trim(), destination: f.destination.trim(), tripType: f.tripType, startDate: f.startDate, endDate: f.endDate };
    if (mode === 'edit' && src) {
      c.setS({ ...s, trips: s.trips.map((t) => (t.id === src.id ? { ...t, ...base } : t)) });
      c.say('Trip saved'); c.close(); return;
    }
    const dupe = s.trips.some((t) => norm(t.name) === norm(base.name) && norm(t.destination) === norm(base.destination) && t.startDate === base.startDate && t.endDate === base.endDate);
    if (mode === 'create' && dupe && !confirm('A trip with the same name, destination, and dates already exists. Create anyway?')) return;

    const trip: Trip = { id: uid(), isArchived: false, ...base };
    let rows: TripItem[];
    if (mode === 'duplicate' && src) rows = copyChecklist(s.checklist.filter((r) => r.tripId === src.id), trip.id, true);
    else if (start.startsWith('t:')) { const t = s.templates.find((x) => x.id === start.slice(2)); rows = t ? applyTemplate(t, trip.id) : []; }
    else if (start.startsWith('p:')) rows = copyChecklist(s.checklist.filter((r) => r.tripId === start.slice(2)), trip.id, false);
    else rows = generateChecklist(trip, s.items, []);

    let items = s.items;
    for (const x of extras) {
      let it = items.find((i) => norm(i.name) === norm(x.name));
      if (!it) { it = newItem(x.name, x.categoryId); items = [...items, it]; }
      rows = [...rows, ...manuallyAdd(it, trip.id, rows)];
    }
    c.setS({ ...s, items, trips: [...s.trips, trip], checklist: [...s.checklist, ...rows] });
    c.say(mode === 'create' ? 'Trip created' : 'Trip duplicated'); c.close(); onCreated(trip.id);
  };

  return (
    <Sheet c={c} title={mode === 'create' ? 'Create Trip' : mode === 'edit' ? 'Edit Trip' : 'Duplicate Trip'} onSave={submit} disabled={!valid}>
      <label>Trip Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Destination<input value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></label>
      <label>Trip Type<select value={f.tripType} onChange={(e) => setF({ ...f, tripType: e.target.value as TripType })}>
        {TRIP_TYPES.map((t) => <option key={t} value={t}>{TRIP_LABEL[t]}</option>)}</select></label>
      <label>Start Date<input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
      <label>End Date<input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
      {f.endDate < f.startDate && <p className="err">End date cannot be before start date.</p>}
      {mode === 'create' && (
        <>
          <label>Start With<select value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="rules">Generate from rules</option>
            {s.templates.length > 0 && <optgroup label="Templates">{s.templates.map((t) => <option key={t.id} value={'t:' + t.id}>{t.name}</option>)}</optgroup>}
            {s.trips.length > 0 && <optgroup label="Previous Trips">{s.trips.map((t) => <option key={t.id} value={'p:' + t.id}>{t.name}</option>)}</optgroup>}
          </select></label>
          <h3>Extra Items</h3>
          {extras.map((x) => (
            <div className="between" key={x.name}><span>{x.name} <small>{s.categories.find((k) => k.id === x.categoryId)?.name}</small></span>
              <button onClick={() => setExtras(extras.filter((e) => e !== x))}>✕</button></div>
          ))}
          <select value={xCat} onChange={(e) => setXCat(e.target.value)}>{s.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <textarea rows={3} placeholder="One item per line or comma separated" value={xText} onChange={(e) => setXText(e.target.value)} />
          <button disabled={!splitList(xText).length} onClick={addExtras}>Add Extra Items</button>
          {recent.length > 0 && (
            <details><summary>Recently Packed</summary>
              {recent.map(({ item, n }) => <div className="between" key={item.id}><span>{item.name}</span><small>{n}</small></div>)}
            </details>
          )}
        </>
      )}
      {mode === 'duplicate' && src && <small>{s.checklist.filter((r) => r.tripId === src.id).length} checklist items will be copied.</small>}
    </Sheet>
  );
}

function TripDetail({ c, id, back, setModal }: { c: Ctx; id: string; back: () => void; setModal: (m: Modal) => void }) {
  const { s } = c;
  const trip = s.trips.find((t) => t.id === id);
  const [hide, setHide] = useState(false);
  if (!trip) return <button onClick={back}>‹ Back</button>;
  const rows = s.checklist.filter((r) => r.tripId === id);
  const item = (r: TripItem) => s.items.find((i) => i.id === r.itemId);
  const packed = rows.filter((r) => r.isPacked).length;
  const pct = rows.length ? Math.round((packed / rows.length) * 100) : 0;
  const remaining = rows.filter((r) => !r.isPacked).sort((a, b) => cmp(item(a)?.name ?? '', item(b)?.name ?? ''));
  const groups = byCategory(rows, (r) => item(r)?.categoryId, (r) => item(r)?.name ?? '', s.categories);

  const toggle = (rid: string) => c.setS({ ...s, checklist: s.checklist.map((r) => (r.id === rid ? { ...r, isPacked: !r.isPacked } : r)) });
  const remove = (rid: string) => { c.setS({ ...s, checklist: s.checklist.filter((r) => r.id !== rid) }); c.say('Item removed', s); };
  const regenerate = () => {
    const add = generateChecklist(trip, s.items, rows);
    c.setS({ ...s, checklist: [...s.checklist, ...add] }); c.say(add.length ? `Added ${add.length} from rules` : 'Nothing new to add');
  };
  const archive = () => { c.setS({ ...s, trips: s.trips.map((t) => (t.id === id ? { ...t, isArchived: !t.isArchived } : t)) }); c.say(trip.isArchived ? 'Trip restored' : 'Trip archived'); };

  return (
    <section>
      <div className="head"><button onClick={back}>‹ Trips</button></div>
      <div className="card trip-summary">
        <div><h2>{trip.name}</h2><div className="mut">{trip.destination}</div><small>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} · {TRIP_LABEL[trip.tripType]}</small></div>
        <div className="progress-summary"><div className="progress-ring" style={{ background: `conic-gradient(var(--acc) ${pct}%, var(--line) 0)` }}><b>{pct}%</b></div><div><b>{packed} / {rows.length}</b><small>Packed</small></div></div>
        <label className="chk"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />Hide packed items</label>
      </div>
      <div className="row wrap">
        <button onClick={() => setModal({ k: 'addItems', id })}>+ Add Item</button>
        <button onClick={regenerate}>Regenerate</button>
        <button onClick={() => setModal({ k: 'trip', mode: 'edit', id })}>Edit</button>
        <button onClick={() => setModal({ k: 'trip', mode: 'duplicate', id })}>Duplicate</button>
        <button onClick={() => setModal({ k: 'template', id })}>Save as Template</button>
        <button onClick={archive}>{trip.isArchived ? 'Restore' : 'Archive'}</button>
      </div>
      <h3 className="section-title">Still To Pack ({remaining.length})</h3>
      {remaining.length ? <ul>{remaining.map((r) => <li key={r.id}>{item(r)?.name ?? 'Deleted item'}</li>)}</ul> : <p className="empty">All packed</p>}
      {groups.map(([cat, list]) => {
        const vis = hide ? list.filter((r) => !r.isPacked) : list;
        if (!vis.length) return null;
        return (
          <div key={cat.id}>
            <h3 className="section-title between"><span>{cat.name}</span><small>{list.filter((r) => r.isPacked).length} / {list.length}</small></h3>
            <ul>{vis.map((r) => <ChecklistRow key={r.id} row={r} item={item(r)} onToggle={() => toggle(r.id)} onEdit={() => setModal({ k: 'checklistItem', id: r.id })} onRemove={() => remove(r.id)} />)}</ul>
          </div>
        );
      })}
      {!rows.length && <p className="empty">No items yet. Add items manually or regenerate from the trip rules.</p>}
    </section>
  );
}

function ChecklistRow({ row, item, onToggle, onEdit, onRemove }: { row: TripItem; item?: Item; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const skipClick = useRef(false);
  const closeOrReveal = () => setOffset((value) => value < -48 ? -144 : 0);
  return <div className="swipe-row">
    <div className="swipe-actions"><button aria-label={`Edit ${item?.name ?? 'item'}`} onClick={onEdit}><Icon name="edit" /></button><button className="danger" aria-label={`Remove ${item?.name ?? 'item'}`} onClick={onRemove}><Icon name="trash" /></button></div>
    <li className={`checklist-row ${row.isPacked ? 'packed' : ''}`} style={{ transform: `translateX(${offset}px)` }} onClick={() => { if (skipClick.current) { skipClick.current = false; return; } onToggle(); }} onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; swiping.current = false; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
      if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swiping.current = true;
      if (swiping.current) { e.preventDefault(); setOffset(Math.max(-144, Math.min(0, dx))); }
    }} onPointerUp={() => { if (swiping.current) { skipClick.current = true; closeOrReveal(); } start.current = null; swiping.current = false; }} onPointerCancel={() => { start.current = null; swiping.current = false; setOffset(0); }}>
      <button className="check-toggle" aria-label={row.isPacked ? `Mark ${item?.name ?? 'item'} unpacked` : `Mark ${item?.name ?? 'item'} packed`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{row.isPacked && <Icon name="check" size={20} />}</button>
      <div className="checklist-copy"><b>{item?.name ?? 'Deleted item'}{row.quantity > 1 && ` ×${row.quantity}`}</b>{row.notes && <small>{row.notes}</small>}{row.wasManuallyAdded && <small>Manually added</small>}</div>
      <div className="desktop-row-actions"><button aria-label={`Edit ${item?.name ?? 'item'}`} onClick={(e) => { e.stopPropagation(); onEdit(); }}><Icon name="edit" /></button><button className="danger" aria-label={`Remove ${item?.name ?? 'item'}`} onClick={(e) => { e.stopPropagation(); onRemove(); }}><Icon name="trash" /></button></div>
    </li>
  </div>;
}

function ChecklistItemForm({ c, id }: { c: Ctx; id: string }) {
  const { s } = c;
  const row = s.checklist.find((entry) => entry.id === id);
  const [qty, setQty] = useState(row?.quantity ?? 1);
  const [notes, setNotes] = useState(row?.notes ?? '');
  if (!row) return null;
  const submit = () => {
    c.setS({ ...s, checklist: s.checklist.map((entry) => entry.id === id
      ? { ...entry, quantity: Math.max(1, Math.round(qty || 1)), notes: notes.trim() } : entry) });
    c.say('Checklist item updated'); c.close();
  };
  return (
    <Sheet c={c} title="Edit Checklist Item" onSave={submit}>
      <label>Quantity<input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
      <label>Notes<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </Sheet>
  );
}

function AddItems({ c, id }: { c: Ctx; id: string }) {
  const { s } = c;
  const rows = s.checklist.filter((r) => r.tripId === id);
  const avail = s.items.filter((i) => !rows.some((r) => r.itemId === i.id));
  return (
    <>
      <div className="head"><b>Add Items</b><button className="pri" onClick={c.close}>Done</button></div>
      {!avail.length && <p className="empty">All items added ✓</p>}
      {byCategory(avail, (i) => i.categoryId, (i) => i.name, s.categories).map(([cat, list]) => (
        <div key={cat.id}><h3>{cat.name}</h3>
          <ul>{list.map((i) => (
            <li key={i.id} className="between" onClick={() => { c.setS({ ...s, checklist: [...s.checklist, ...manuallyAdd(i, id, rows)] }); c.say('Item added'); }}>
              <div><div>{i.name}</div><small>{i.isAlwaysPacked ? 'Always packed' : i.tripTypes.length ? i.tripTypes.map(label).join(', ') : 'Any'}</small></div><span>＋</span>
            </li>))}</ul></div>
      ))}
    </>
  );
}

function SaveTemplate({ c, id }: { c: Ctx; id: string }) {
  const { s } = c;
  const trip = s.trips.find((t) => t.id === id)!;
  const [name, setName] = useState(trip.name);
  const seen = new Set<string>();
  const uniq = s.checklist.filter((r) => r.tripId === id && !seen.has(r.itemId) && !!seen.add(r.itemId));
  const submit = () => {
    const n = name.trim(); if (!n || !uniq.length) return;
    const ex = s.templates.find((t) => norm(t.name) === norm(n));
    const tpl = { id: ex?.id ?? uid(), name: n, createdAt: ex?.createdAt ?? new Date().toISOString(), items: uniq.map((r) => ({ itemId: r.itemId, quantity: r.quantity, notes: r.notes })) };
    c.setS({ ...s, templates: ex ? s.templates.map((t) => (t.id === ex.id ? tpl : t)) : [...s.templates, tpl] });
    c.say('Template saved'); c.close();
  };
  return (
    <Sheet c={c} title="Save Template" onSave={submit} disabled={!name.trim() || !uniq.length}>
      <label>Template Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <small>{uniq.length} items included. Saving with an existing name replaces that template.</small>
    </Sheet>
  );
}

/* ---------- Stats & settings ---------- */
function Stats({ c }: { c: Ctx }) {
  const { s } = c;
  const packed = s.checklist.filter((r) => r.isPacked);
  const top = (names: (string | undefined)[]) => {
    const m = new Map<string, number>();
    names.forEach((n) => { const k = n?.trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0]?.[0] ?? 'None yet';
  };
  const itemOf = (r: TripItem) => s.items.find((i) => i.id === r.itemId);
  const rows: [string, string | number][] = [
    ['Total trips created', s.trips.length], ['Total items packed', packed.length],
    ['Most packed item', top(packed.map((r) => itemOf(r)?.name))],
    ['Most used category', top(packed.map((r) => s.categories.find((k) => k.id === itemOf(r)?.categoryId)?.name))],
  ];
  return <section><Head title="Statistics" /><ul>{rows.map(([k, v]) => <li key={k} className="between"><span>{k}</span><b>{v}</b></li>)}</ul></section>;
}

function Settings({ c }: { c: Ctx }) {
  const { s } = c;
  const exportJson = async () => {
    const json = JSON.stringify({ categories: s.categories, items: s.items, trips: s.trips, checklist: s.checklist, templates: s.templates }, null, 2);
    const filename = `packmatrix-backup-${today()}.json`;
    const file = new File([json], filename, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PackMatrix backup' });
      } else {
        const a = document.createElement('a');
        const url = URL.createObjectURL(file);
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      c.setS({ ...s, lastBackupAt: new Date().toISOString() });
      c.say('Backup exported');
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') c.say('Could not export backup');
    }
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const result = importState(JSON.parse(await file.text()));
      if (confirm('Replace all current data with this backup?')) {
        c.setS(result.state);
        const skipped = Object.values(result.skipped).reduce((total, count) => total + count, 0);
        c.say(skipped ? `Backup restored. Skipped ${skipped} invalid row${skipped === 1 ? '' : 's'}.` : 'Backup restored');
      }
    } catch { c.say('Not a valid PackMatrix backup'); }
  };
  return (
    <section>
      <Head title="Settings" />
      <p>{s.items.length} items · {s.trips.length} trips · {s.templates.length} templates. Data is stored on this device only, so export a backup now and then.</p>
      <p>Last backup: {s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleDateString() : 'never'}</p>
      <small>Version {__APP_VERSION__} · Built {new Date(__BUILD_DATE__).toLocaleString()}</small>
      <div className="row wrap">
        <button className="pri" onClick={exportJson}>Export backup</button>
        <label className="btn">Import backup<input type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} /></label>
        <button className="danger" onClick={() => confirm('Erase everything and restore the sample items?') && (c.setS(seed()), c.say('Reset to sample data'))}>Reset</button>
      </div>
    </section>
  );
}
