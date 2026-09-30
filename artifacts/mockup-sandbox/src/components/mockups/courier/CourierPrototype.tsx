import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Info, MapPin, MessageCircle, MoreVertical, Phone, Search, SlidersHorizontal } from "lucide-react";
import "./_group.css";

type Parcel = { id: string; shipper: string; from: string; to: string; courier: string; carrier: string; weight: string; vehicle: string; rate: string; status: string };
const PARCELS: Parcel[] = [
  { id: "900912881298487", shipper: "Amazon, Inc", from: "New York City", to: "Manhattan City", courier: "James A Marcus", carrier: "JNE Truck Cargo", weight: "1.140 kg", vehicle: "Motorcycle", rate: "$234.75", status: "Shipped" },
  { id: "731045526610392", shipper: "Etsy Studio", from: "Brooklyn", to: "Jersey City", courier: "Priya Okafor", carrier: "Harbor Van Co.", weight: "0.620 kg", vehicle: "Van", rate: "$48.20", status: "In transit" },
  { id: "558201947733015", shipper: "Bluebird Books", from: "Queens", to: "Hoboken", courier: "Luis Ferreira", carrier: "JNE Truck Cargo", weight: "2.310 kg", vehicle: "Truck", rate: "$67.90", status: "Shipped" },
];

const Avatar = ({ name, dark }: { name: string; dark?: boolean }) => (
  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${dark ? "bg-[#f58f6c] text-white" : "bg-[#f8d9cc] text-[#8a4a33]"}`}>{name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span>
);

function Onboarding({ next }: { next: () => void }) {
  return (
    <div className="cr-screen flex h-full flex-col bg-white px-7 pb-8 pt-14">
      <div className="relative mx-auto mt-4 h-[330px] w-[300px]">
        <div className="absolute inset-x-4 top-0 h-[300px] rounded-full bg-gradient-to-b from-[#eeeceb] to-white" />
        <div className="absolute left-1/2 top-6 h-[300px] w-[200px] -translate-x-1/2 rounded-t-[40px] border-[10px] border-b-0 border-[#f58f6c]"><div className="mx-auto h-4 w-20 rounded-b-xl bg-[#f58f6c]" /></div>
        <img src="/__mockup/images/courier-mascot.png" alt="Friendly courier carrying parcels" className="absolute left-1/2 top-16 w-[240px] -translate-x-1/2" />
      </div>
      <div className="mt-6 flex justify-center gap-1.5" aria-hidden><span className="h-1.5 w-5 rounded-full bg-[#2f3140]" /><span className="h-1.5 w-1.5 rounded-full bg-[#d6d6db]" /><span className="h-1.5 w-1.5 rounded-full bg-[#d6d6db]" /></div>
      <h1 className="mt-10 text-[32px] font-semibold leading-tight">The all in one<br />parcel tracking</h1>
      <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-[var(--mut)]">Every package you are waiting for, in one calm place. Know where it is and who is bringing it.</p>
      <div className="mt-auto flex items-center justify-between">
        <button data-testid="button-skip" onClick={next} className="rounded-lg px-2 py-2 text-sm text-[var(--mut)] hover:text-[var(--ink)]">Skip</button>
        <button data-testid="button-next" onClick={next} aria-label="Continue" className="grid h-16 w-16 place-items-center rounded-full bg-[var(--char)] text-white shadow-lg transition hover:scale-105"><ArrowUpRight className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

function ParcelCard({ p, open }: { p: Parcel; open: () => void }) {
  return (
    <button data-testid={`card-parcel-${p.id}`} onClick={open} className="w-full rounded-2xl bg-[var(--card)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between"><div><div className="font-semibold">#{p.id}</div><div className="text-xs text-[var(--mut)]">{p.shipper}</div></div><span className="rounded-lg bg-[var(--char)] px-3 py-1.5 text-xs text-white">{p.status}</span></div>
      <div className="mt-4 flex items-center justify-between text-sm"><div><div className="font-medium">{p.from}</div><div className="text-xs text-[var(--mut)]">United States</div></div><ArrowRight className="h-4 w-4 text-[var(--coral)]" /><div className="text-right"><div className="font-medium">{p.to}</div><div className="text-xs text-[var(--mut)]">United States</div></div></div>
      <div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><Avatar name={p.courier} /><div><div className="text-sm font-medium">{p.courier}</div><div className="text-xs text-[var(--mut)]">{p.carrier}</div></div></div><Info className="h-4 w-4 text-[var(--mut)]" /></div>
    </button>
  );
}

function Overview({ open, toast }: { open: (p: Parcel) => void; toast: (s: string) => void }) {
  const [q, setQ] = useState(""); const [num, setNum] = useState("");
  const list = useMemo(() => PARCELS.filter(p => (p.id + p.shipper + p.from + p.to + p.courier).toLowerCase().includes(q.toLowerCase().trim())), [q]);
  const track = () => { const m = PARCELS.find(p => num.trim() && p.id.includes(num.replace(/\D/g, ""))); m ? open(m) : num.trim() ? toast("No demo parcel matches that number") : open(PARCELS[0]); };
  return (
    <div className="cr-screen h-full overflow-y-auto bg-white px-5 pb-8 pt-12">
      <div className="flex items-center justify-between">
        <button onClick={() => toast("Menu is not part of this demo")} aria-label="Menu" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--card)]"><SlidersHorizontal className="h-4 w-4" /></button>
        <div className="text-center"><div className="text-xs text-[var(--mut)]">Current location</div><div className="flex items-center gap-1 text-sm font-medium"><MapPin className="h-3.5 w-3.5 text-[var(--coral)]" />New York City</div></div>
        <button onClick={() => toast("No new notifications (demo)")} aria-label="Notifications" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--card)]"><Bell className="h-4 w-4" /></button>
      </div>
      <label className="mt-5 flex items-center gap-2 rounded-2xl bg-[var(--card)] px-4 py-3"><Search className="h-4 w-4 text-[var(--mut)]" /><input data-testid="input-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search parcels, cities, couriers" className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--mut)]" /></label>
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-[var(--char)] p-5">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full border-[14px] border-white/5" />
        <div className="text-xl font-semibold text-[var(--coral)]">Track your parcel</div>
        <div className="text-sm text-white/80">Enter your parcel tracking number</div>
        <div className="mt-4 flex gap-2"><input data-testid="input-tracking" value={num} onChange={e => setNum(e.target.value)} onKeyDown={e => e.key === "Enter" && track()} placeholder="Your tracking number" className="min-w-0 flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40" /><button data-testid="button-track" onClick={track} className="rounded-xl bg-[var(--coral)] px-4 text-sm font-medium text-white hover:bg-[var(--coral-d)]">Track</button></div>
      </div>
      <div className="mt-6 flex items-center justify-between"><h2 className="text-lg font-semibold">Last tracked parcel</h2><button onClick={() => setQ("")} className="text-sm text-[var(--ink)]/70">See all</button></div>
      <div className="mt-3 space-y-3">
        {list.map(p => <ParcelCard key={p.id} p={p} open={() => open(p)} />)}
        {!list.length && <div className="rounded-2xl bg-[var(--card)] p-8 text-center text-sm text-[var(--mut)]" data-testid="text-no-results">No parcels match "{q}".<br /><button onClick={() => setQ("")} className="mt-2 font-medium text-[var(--coral)]">Clear search</button></div>}
      </div>
      <p className="mt-6 text-center text-[11px] text-[var(--mut)]">Demo prototype with sample parcels</p>
    </div>
  );
}

function StreetMap() {
  const h = [60, 130, 190, 250, 320, 380, 440], v = [40, 110, 170, 240, 300, 360];
  return (
    <svg viewBox="0 0 390 480" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="390" height="480" fill="#eeeef0" />
      {h.map(y => <line key={y} x1="0" x2="390" y1={y} y2={y} stroke="#fff" strokeWidth={y % 3 ? 7 : 12} />)}
      {v.map(x => <line key={x} y1="0" y2="480" x1={x} x2={x} stroke="#fff" strokeWidth={x % 4 ? 7 : 12} />)}
      <line x1="0" y1="470" x2="390" y2="200" stroke="#fff" strokeWidth="9" />
      <path d="M40 400 L40 420 L150 420 L150 370 L270 370 L270 240" fill="none" stroke="#2f3140" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

function Tracking({ p, back, toast }: { p: Parcel; back: () => void; toast: (s: string) => void }) {
  return (
    <div className="cr-screen relative flex h-full flex-col bg-[#eeeef0]">
      <div className="relative flex-1 overflow-hidden">
        <StreetMap />
        <div className="relative flex items-center justify-between px-5 pt-12">
          <button data-testid="button-back" onClick={back} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-lg font-semibold">Tracking parcel</h1>
          <button onClick={() => toast("More options are demo-only")} aria-label="More" className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"><MoreVertical className="h-4 w-4" /></button>
        </div>
        <div className="relative mx-5 mt-5 flex items-center justify-between rounded-2xl bg-[var(--char)] p-4 text-white"><div><div className="font-semibold">#{p.id}</div><div className="text-xs text-white/60">{p.shipper}</div></div><span className="rounded-lg bg-[var(--coral)] px-3 py-1.5 text-xs">{p.status}</span></div>
        <div className="absolute left-[52%] top-[44%] flex items-center gap-2 rounded-xl bg-white p-2 pr-3 shadow-md"><Avatar name={p.courier} /><div><div className="text-[10px] text-[var(--mut)]">Courier</div><div className="text-xs font-semibold">{p.courier.split(" ")[0]}</div></div></div>
        <div className="absolute bottom-[14%] left-[7%] grid h-7 w-7 place-items-center rounded-full bg-[var(--coral)] text-white"><MapPin className="h-4 w-4" /></div>
      </div>
      <div className="rounded-t-3xl bg-[var(--char)] px-5 pb-10 pt-4">
        <div className="flex items-center justify-between text-white"><div className="flex items-center gap-3"><Avatar name={p.courier} dark /><div><div className="text-xs text-white/60">Shipper</div><div className="font-semibold">{p.courier}</div></div></div>
          <div className="flex gap-2"><button data-testid="button-call" onClick={() => toast(`Calling ${p.courier} (demo)`)} aria-label="Call courier" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--coral)]"><Phone className="h-4 w-4" /></button><button data-testid="button-message" onClick={() => toast(`Message sent to ${p.courier} (demo)`)} aria-label="Message courier" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--coral)]"><MessageCircle className="h-4 w-4" /></button></div></div>
      </div>
      <div className="-mt-6 rounded-t-3xl bg-white px-5 pb-6 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-[#dcdce0]" />
        <div className="mt-4 flex items-center justify-between border-b border-[#eee] pb-4"><div><div className="font-semibold">{p.from}</div><div className="text-xs text-[var(--mut)]">United States</div></div><ArrowRight className="h-4 w-4 text-[var(--coral)]" /><div className="text-right"><div className="font-semibold">{p.to}</div><div className="text-xs text-[var(--mut)]">United States</div></div></div>
        <div className="mt-4 flex justify-between"><div><div className="font-semibold">{p.weight}</div><div className="text-xs text-[var(--mut)]">Weight</div></div><div><div className="font-semibold">{p.vehicle}</div><div className="text-xs text-[var(--mut)]">Vehicle</div></div><div className="text-right"><div className="font-semibold text-[#6b4fd8]">{p.rate}</div><div className="text-xs text-[var(--mut)]">Rates</div></div></div>
        <button data-testid="button-next-detail" onClick={() => toast("Estimated arrival: today, 4:20 PM (demo)")} className="mt-5 w-full rounded-2xl bg-[var(--coral)] py-4 font-medium text-white hover:bg-[var(--coral-d)]">Next</button>
      </div>
    </div>
  );
}

export function CourierPrototype() {
  const [screen, setScreen] = useState<"on" | "ov" | "tr">("on");
  const [parcel, setParcel] = useState(PARCELS[0]);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 2200); return () => clearTimeout(t); }, [msg]);
  return (
    <div className="cr-root flex min-h-[100dvh] w-full justify-center bg-[#fbeee8]">
      <div className="relative h-[100dvh] max-h-[844px] w-full max-w-[390px] overflow-hidden bg-white">
        {screen === "on" && <Onboarding next={() => setScreen("ov")} />}
        {screen === "ov" && <Overview toast={setMsg} open={p => { setParcel(p); setScreen("tr"); }} />}
        {screen === "tr" && <Tracking p={parcel} toast={setMsg} back={() => setScreen("ov")} />}
        {msg && <div role="status" className="cr-toast absolute inset-x-6 bottom-6 z-10 rounded-xl bg-[var(--char)] px-4 py-3 text-center text-sm text-white shadow-lg">{msg}</div>}
      </div>
    </div>
  );
}
