"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Trophy, ArrowRight, Waves, Tv, Fingerprint, Clock, Copy, Check, LogOut, RotateCcw, BookOpen, ExternalLink, Play, CheckCircle2, XCircle, LoaderCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import type { Settings, GameView, CatalogEntry } from '@/lib/types';
import catalogue from '@/data/catalog-public.json';
import coverage from '@/data/coverage.json';
import { translate, type Language } from '@/lib/i18n';
const catalog = catalogue as CatalogEntry[];
const initial: Settings = { mode: 'multi', category: 'mixed', difficulty: 'all', season: -1, episode: '', rounds: 10, duration: 30, specials: false };
type Credentials = {
    code: string;
    token: string;
};
type ApiResult = {
    error?: string;
    token?: string;
    state?: GameView;
    left?: boolean;
};
function Picker({ label, value, items, onChange, disabled = false }: {
    label: string;
    value: string;
    items: [
        string,
        string
    ][];
    onChange: (v: string) => void;
    disabled?: boolean;
}) { return <div><label className="field-label">{label}</label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{items.map(([v, l]) => <SelectItem value={v} key={v}>{l}</SelectItem>)}</SelectContent></Select></div>; }
export default function Home() {
    const [language, setLanguage] = useState<Language>('de');
    const t = useCallback((text: string) => translate(text, language), [language]);
    const locale = language === 'en' ? 'en-US' : 'de-DE';
    const levels = { easy: t("Einfach"), medium: t("Mittel"), hard: t("Schwer") };
    useEffect(() => { const requested = new URLSearchParams(location.search).get('lang'); let saved: string | null = null; try { saved = localStorage.getItem('tahm-language'); } catch {} const selected = requested === 'en' || requested === 'de' ? requested : saved === 'en' ? 'en' : 'de'; setLanguage(selected); try { localStorage.setItem('tahm-language', selected); } catch {} }, []);
    useEffect(() => { document.documentElement.lang = language; document.title = language === 'en' ? 'Two and a Half Men Quiz Club – Multiplayer Trivia' : 'Two and a Half Men Quiz Club – Multiplayer-Lore-Quiz'; const meta = document.querySelector('meta[name="description"]'); if (meta)
        meta.setAttribute('content', language === 'en' ? 'Play Two and a Half Men trivia with friends: episodes, characters and a shared session leaderboard.' : 'Spiele mit Freunden: Two-and-a-Half-Men-Folgen und Charaktere. Gemeinsame Räume, drei Schwierigkeitsgrade und eine Session-Rangliste.'); }, [language]);
    function chooseLanguage(value: Language) { try { localStorage.setItem('tahm-language', value); } catch {} setLanguage(value); const url = new URL(location.href); url.searchParams.set('lang', value); history.replaceState({}, '', url); setError(''); }
    const [name, setName] = useState(''), [settings, setSettings] = useState<Settings>(initial), [joinCode, setJoinCode] = useState(''), [state, setState] = useState<GameView | null>(null), [credentials, setCredentials] = useState<Credentials | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [answer, setAnswer] = useState(''), [copied, setCopied] = useState(false), [now, setNow] = useState(Date.now()), [connected, setConnected] = useState(true), [ready, setReady] = useState(false);
    const clockOffset = useRef(0), requestLock = useRef(false), latest = useRef<GameView | null>(null), hardInput = useRef<HTMLInputElement>(null);
    const apply = useCallback((next: GameView) => { if (latest.current?.code === next.code && latest.current.serverTime > next.serverTime)
        return; try {
        const raw = localStorage.getItem('tahm-current') || sessionStorage.getItem('tahm-current');
        if (raw) {
            const saved = JSON.parse(raw);
            if (saved.code === next.code) {
                const value = JSON.stringify({ ...saved, expires: next.expires });
                localStorage.setItem('tahm-current', value);
                localStorage.setItem(`tahm-room-${next.code}`, value);
                sessionStorage.removeItem('tahm-current');
            }
        }
    }
    catch { } clockOffset.current = next.serverTime - Date.now(); latest.current = next; setState(next); setNow(next.serverTime); setConnected(true); }, []);
    useEffect(() => { try {
        setName(localStorage.getItem('tahm-nickname') || '');
        const params = new URLSearchParams(location.search);
        const code = params.get('room')?.toUpperCase() || '';
        if (code)
            setJoinCode(code);
        for (const key of Object.keys(localStorage)) {
            if (key === 'tahm-current' || key.startsWith('tahm-room-')) {
                try {
                    const v = JSON.parse(localStorage.getItem(key) || 'null');
                    if (!v || !v.expires || v.expires <= Date.now())
                        localStorage.removeItem(key);
                }
                catch {
                    localStorage.removeItem(key);
                }
            }
        }
        const raw = localStorage.getItem('tahm-current') || sessionStorage.getItem('tahm-current');
        if (raw) {
            const saved = JSON.parse(raw);
            if (!code || saved.code === code)
                setCredentials(saved);
        }
    }
    catch { } setReady(true); }, []);
    useEffect(() => { const id = setInterval(() => setNow(Date.now() + clockOffset.current), 200); return () => clearInterval(id); }, []);
    useEffect(() => { if (state?.code)
        window.scrollTo({ top: 0, behavior: 'instant' }); }, [state?.code]);
    useEffect(() => {
        if (!credentials)
            return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const abort = new AbortController();
        async function poll() { try {
            const r = await fetch(`/api/game?code=${credentials!.code}`, { headers: { 'Accept-Language': language, Authorization: `Bearer ${credentials!.token}` }, cache: 'no-store', signal: abort.signal });
            const data = await r.json() as GameView & {
                error: string;
            };
            if (stopped)
                return;
            if (!r.ok) {
                if (r.status === 410 || r.status === 401) {
                    setCredentials(null);
                    setState(null);
                    latest.current = null;
                    localStorage.removeItem('tahm-current');
                    localStorage.removeItem(`tahm-room-${credentials!.code}`);
                    sessionStorage.removeItem('tahm-current');
                    setError(data.error);
                    return;
                }
                throw Error(data.error);
            }
            apply(data);
        }
        catch (e) {
            if (!stopped) {
                setConnected(false);
                if (!latest.current)
                    setError(e instanceof Error ? e.message : t("Verbindung unterbrochen."));
            }
        }
        finally {
            if (!stopped)
                timer = setTimeout(poll, 1200);
        } }
        void poll();
        return () => { stopped = true; abort.abort(); clearTimeout(timer); };
    }, [credentials, apply, language]);
    useEffect(() => { setAnswer(''); if (state?.question?.choices.length === 0 && state.status === 'playing')
        hardInput.current?.focus(); }, [state?.index, state?.game, state?.status]);
    const post = useCallback(async (op: string, extra: Record<string, unknown> = {}, auth = credentials) => {
        if (requestLock.current)
            return;
        requestLock.current = true;
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': language, ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) }, body: JSON.stringify({ op, code: auth?.code, ...extra }) });
            const data = await r.json() as ApiResult;
            if (!r.ok)
                throw Error(data.error);
            if (data.token && data.state) {
                const next = { code: data.state.code, token: data.token, expires: data.state.expires };
                localStorage.setItem('tahm-current', JSON.stringify(next));
                localStorage.setItem(`tahm-room-${next.code}`, JSON.stringify(next));
                setCredentials(next);
                localStorage.setItem('tahm-nickname', name);
            }
            if (data.state)
                apply(data.state);
            return data;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : t("Die Anfrage konnte nicht gesendet werden."));
            return null;
        }
        finally {
            requestLock.current = false;
            setBusy(false);
        }
    }, [credentials, name, apply, language]);
    async function join() { const code = joinCode.trim().toUpperCase(); try {
        const raw = localStorage.getItem(`tahm-room-${code}`);
        if (raw) {
            const saved = JSON.parse(raw);
            const r = await fetch(`/api/game?code=${code}`, { headers: { 'Accept-Language': language, Authorization: `Bearer ${saved.token}` } });
            if (r.ok) {
                apply(await r.json() as GameView);
                localStorage.setItem('tahm-current', raw);
                setCredentials(saved);
                setError('');
                return;
            }
        }
    }
    catch { } await post('join', { code, name }, null); }
    async function leave() { const r = await post('leave'); if (r) {
        localStorage.removeItem('tahm-current');
        sessionStorage.removeItem('tahm-current');
        setCredentials(null);
        setState(null);
        latest.current = null;
        history.replaceState({}, '', location.pathname);
    } }
    async function copyInvite() { try {
        await navigator.clipboard.writeText(`${location.origin}/?room=${state!.code}&lang=${language}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
    }
    catch {
        setError(t("Kopieren nicht möglich. Teile bitte den angezeigten Raumcode."));
    } }
    const submit = useCallback((value: string) => { if (!state || state.status !== 'playing' || state.result || busy)
        return; void post('answer', { answer: value, index: state.index, game: state.game }); }, [state, busy, post]);
    useEffect(() => { function key(e: KeyboardEvent) { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.ctrlKey || e.metaKey || e.altKey)
        return; if (state?.status === 'playing' && state.question?.choices.length && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        submit(String(+e.key - 1));
    } } window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [state, submit]);
    useEffect(() => {
        const ctx = (document as unknown as {
            modelContext?: {
                registerTool: (t: unknown, o: unknown) => unknown;
            };
        }).modelContext;
        if (!ctx)
            return;
        const lifecycle = new AbortController();
        const tool = { name: 'read_quiz_session', title: t("Quiz-Session lesen"), description: t("Liest ausschließlich den aktuell sichtbaren Quizstand und die Rangliste. Enthält keine geheimen Antworten oder Zugangsdaten."), inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: (input: unknown) => { if (!input || typeof input !== 'object' || Object.keys(input).length)
                throw Error(t("Keine Parameter erwartet.")); const s = latest.current; return s ? { code: s.code, status: s.status, round: s.round, players: s.players, question: s.question, answer: s.answer } : { status: 'setup' }; } };
        try {
            Promise.resolve(ctx.registerTool(tool, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { }
        return () => lifecycle.abort();
    }, [t]);
    const selectedEpisodes = catalog.filter(e => e.ready && (settings.season === -1 || e.season === settings.season) && (settings.specials || e.kind === 'episode'));
    const episodeCount = selectedEpisodes.filter(e => !settings.episode || e.id === settings.episode).reduce((n,e) => n + (settings.difficulty === 'all' ? e.counts.easy + e.counts.medium + e.counts.hard : e.counts[settings.difficulty]), 0);
    const characterCount = settings.difficulty === 'all' ? Object.values(coverage.characterCounts).reduce((a,b) => a+b,0) : coverage.characterCounts[settings.difficulty];
    const availableCount = (settings.category === 'characters' ? 0 : episodeCount) + (settings.category === 'episodes' ? 0 : characterCount);
    const enoughQuestions = availableCount >= settings.rounds;
    const seasonOptions = [['-1', t("Alle Staffeln")], ...Array.from(new Set(catalog.filter(e => e.ready && e.season > 0).map(e => e.season))).sort((a, b) => a - b).map(s => [String(s), (t("Staffel ") + s + "")]), ...(settings.specials ? [['0', t("Specials & Kinofilm")]] : [])] as [
        string,
        string
    ][];
    const seconds = state ? Math.max(0, Math.ceil((state.end - now) / 1000)) : 0;
    const host = state?.players.find(p => p.id === state.host), canStart = !!state && (state.host === state.me || !host?.active);
    const score = state?.players.find(p => p.id === state.me)?.score || 0;
    const statusLabel = state?.status === 'lobby' ? t("WARTERAUM") : state?.status === 'finished' ? t("SPIEL BEENDET") : state ? t("QUIZ LÄUFT") : t("WILLKOMMEN IN MALIBU");
    return <main className="shell"><header className="topbar"><a className="brand" href="/" aria-label={t("Two and a Half Men Quiz Club Startseite")}><Waves /><span>TWO AND A HALF MEN <b>QUIZ CLUB</b></span></a><div className="language-switch" role="group" aria-label="Language / Sprache"><button type="button" aria-pressed={language === 'de'} onClick={() => chooseLanguage('de')}>Deutsch</button><button type="button" aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>English</button></div><span className="fan-label">{t("DAS INOFFIZIELLE FAN-QUIZ")}</span>{state && <button className="text-button" onClick={leave} disabled={busy}><LogOut size={16}/>{t("Raum verlassen")}</button>}</header>
 <div className="page-heading"><div><p className="eyebrow">{statusLabel}</p><h1>{state ? <>{t("Ein Strandhaus. ")}<em>{t("Großes Wissen.")}</em></> : <>{t("Zweieinhalb Männer. ")}<em>{t("Wie viel weißt du?")}</em></>}</h1><p>{state ? ("Session " + state.code + " · " + state.players.length + t(" von 8 Spielern · ") + state.gamesPlayed + " " + (state.gamesPlayed === 1 ? t("Spiel") : t("Spiele")) + "") : t("Charlie, Alan, Jake & du. Wer kennt das Strandhaus am besten?")}</p></div><span className="edition">MULTIPLAYER<br /><b>LORE EDITION</b></span></div>
 {error && <div role="alert" className="alert"><span>{t(error)}</span><button onClick={() => setError('')} aria-label={t("Meldung schließen")}>×</button></div>}
 {!connected && credentials && <div role="status" className="connection"><LoaderCircle className="spin" size={17}/>{t("Verbindung unterbrochen. Wir verbinden dich erneut; dein Punktestand bleibt erhalten.")}</div>}
 <div className="game-layout"><section className="setup panel">
 {!state && <><div className="scene"><img src="/malibu-banner.png" alt={t("Ein Strandhaus in Malibu mit Klavier und Meerblick")}/><span className="scene-tag">TWO AND A HALF MEN · MALIBU</span></div><div className="panel-body"><div className="section-title"><span className="step">01</span><div><h2>{t("Nimm Platz im Strandhaus.")}</h2><p>{t("Erstelle ein Spiel und lade deine Freunde ein.")}</p></div></div>
 <label className="field-label" htmlFor="nickname">{t("Dein Nickname")}</label><input id="nickname" value={name} onChange={e => setName(e.target.value)} maxLength={24} minLength={2} autoComplete="nickname" placeholder={t("Wie sollen wir dich nennen?")}/>
 <div className="form-grid"><Picker label={t("Fragenmix")} value={settings.category} items={[["mixed", t("Folgen & Charaktere")], ["episodes", t("Nur Folgen")], ["characters", t("Nur Charaktere")]]} onChange={v => setSettings(s => ({ ...s, category: v as Settings['category'] }))}/><Picker label={t("Schwierigkeit")} value={settings.difficulty} items={[["all", t("Bunt gemischt")], ["easy", t("Einfach")], ["medium", t("Mittel")], ["hard", t("Schwer")]]} onChange={v => setSettings(s => ({ ...s, difficulty: v as Settings['difficulty'] }))}/>
 {settings.category !== 'characters' && <><Picker label={t("Staffel")} value={String(settings.season)} items={seasonOptions} onChange={v => setSettings(s => ({ ...s, season: +v, episode: '' }))}/><Picker label={t("Folge")} value={settings.episode || 'all'} items={[["all", t("Alle Folgen der Auswahl")], ...selectedEpisodes.map(e => [e.id, language === 'en' ? e.originalTitle : e.title] as [
                string,
                string
            ])]} onChange={v => setSettings(s => ({ ...s, episode: v === 'all' ? '' : v }))}/></>}
 <Picker label={t("Fragen pro Spiel")} value={String(settings.rounds)} items={[4, 5, 10, 13, 15, 20].map(n => [String(n), ("" + n + t(" Fragen"))])} onChange={v => setSettings(s => ({ ...s, rounds: +v }))}/><Picker label={t("Zeit pro Frage")} value={String(settings.duration)} items={[15, 20, 30, 45, 60].map(n => [String(n), ("" + n + t(" Sekunden"))])} onChange={v => setSettings(s => ({ ...s, duration: +v }))}/></div>
 
 <p className={`pool-count ${enoughQuestions ? "" : "warning"}`} role="status">{availableCount} {t("Fragen in deiner Auswahl.")}{!enoughQuestions && <> {t("Wähle weniger Fragen pro Spiel oder erweitere deine Auswahl.")}</>}</p><div className="start-actions"><button className="primary" onClick={() => post('create', { name, settings: { ...settings, mode: 'multi' } }, null)} disabled={busy || !ready || name.trim().length < 2 || !enoughQuestions}>{busy ? <LoaderCircle className="spin" size={19}/> : <Users size={19}/>}{t("Raum erstellen")}<ArrowRight size={19}/></button><button className="secondary" onClick={() => post('create', { name, settings: { ...settings, mode: 'solo' } }, null)} disabled={busy || !ready || name.trim().length < 2 || !enoughQuestions}><Play size={17}/>{t("Solo üben")}</button></div>
 <div className="join-form"><label htmlFor="roomcode" className="field-label">{t("Du hast schon einen Raumcode?")}</label><div><input id="roomcode" className="code-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} maxLength={6} placeholder="ABC123" onKeyDown={e => { if (e.key === 'Enter')
            void join(); }}/><button className="secondary" onClick={join} disabled={busy || name.trim().length < 2 || joinCode.length !== 6}>{t("Beitreten")}<ArrowRight size={16}/></button></div></div>
 <p className="subtle">{t("Charakternamen auswählen · Schwere Detailfragen teilweise eintippen")}</p></div></>}
 {credentials && !state && <div className="restoring"><LoaderCircle className="spin"/>{t("Session wird geladen …")}</div>}
 {state?.status === 'lobby' && <div className="panel-body lobby"><span className="pill">{t("ALLE IM STRANDHAUS?")}</span><h2>{t("Dein Raum wartet.")}</h2><p>{t("Teile den Link oder den Raumcode mit deinen Freunden.")}</p><div className="room-code"><span>{t("RAUMCODE")}</span><strong>{state.code}</strong><button className="secondary" onClick={copyInvite}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? t("Link kopiert") : t("Einladungslink kopieren")}</button></div><div className="player-list">{state.players.map(p => <div key={p.id}><span className="avatar">{p.name.slice(0, 2).toUpperCase()}</span><span>{p.name}{p.id === state.me ? t(" (du)") : ''}</span>{p.id === state.host && <small>{t("Gastgeber")}</small>}</div>)}</div><div className="match-settings"><span>{state.settings.rounds}{t(" Fragen")}</span><span>{state.settings.duration}{t(" s je Frage")}</span><span>{state.settings.difficulty === 'all' ? t("Gemischte Schwierigkeit") : levels[state.settings.difficulty]}</span></div>{canStart ? <button className="primary" disabled={busy} onClick={() => post('start')}><Play size={18}/>{t("Spiel starten")}<ArrowRight size={18}/></button> : <p className="waiting">{t("Der Gastgeber startet, sobald ihr bereit seid.")}</p>}<p className="subtle">{t("Weitere Spieler können vor dem nächsten Spiel beitreten.")}</p></div>}
 {state?.status === 'countdown' && <div className="countdown"><p className="eyebrow">{t("DIE RUNDE GEHT AUFS HAUS.")}</p><strong>{seconds || 1}</strong><h2>{t("Gleich geht’s los!")}</h2><p>{t("Alle bekommen dieselben Fragen zur selben Zeit.")}</p></div>}
 {state && ['playing', 'reveal'].includes(state.status) && state.question && <div className="panel-body play-area"><div className="question-top"><span className={`pill ${state.question.difficulty}`}>{levels[state.question.difficulty]}</span><span>{t("Frage ")}{state.round} / {state.settings.rounds}</span><span className="timer"><Clock size={17}/>{state.status === 'reveal' ? Math.max(0, Math.ceil((state.nextAt - now) / 1000)) : seconds}s</span></div><Progress className="time-progress" value={state.status === 'playing' ? seconds / state.settings.duration * 100 : 0} aria-label={t("Verbleibende Antwortzeit")}/><p className="episode-label"><Tv size={16}/>{state.question.episode}</p><h2 className="question-prompt">{state.question.prompt}</h2>
 {state.question.choices.length > 0 ? <div className="answer-grid">{state.question.choices.map((choice, i) => { const chosen = state.result?.choice === choice, revealed = state.status === 'reveal', correct = revealed && state.answer?.text === choice; return <button key={i} disabled={busy || !!state.result || revealed || !connected || seconds === 0} className={`answer-option ${chosen ? 'chosen' : ''} ${correct ? 'correct' : ''} ${chosen && revealed && !correct ? 'incorrect' : ''}`} onClick={() => submit(String(i))}><span className="answer-key">{i + 1}</span><span>{choice}</span>{correct && <CheckCircle2 size={19}/>}</button>; })}</div> : <form className="free-answer" onSubmit={e => { e.preventDefault(); submit(answer); }}><label className="field-label" htmlFor="answer">{t("Deine Antwort")}</label><input ref={hardInput} id="answer" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={160} placeholder={t("Du weißt das. Oder?")} autoComplete="off" disabled={!!state.result || state.status === 'reveal' || !connected}/><button className="primary" disabled={busy || !answer.trim() || !!state.result || state.status === 'reveal' || !connected || seconds === 0} type="submit">{t("Antwort abgeben")}<ArrowRight size={18}/></button><p className="subtle">{t("Großschreibung, Umlaute und Satzzeichen sind egal.")}</p></form>}
 {state.result && state.status === 'playing' && <p className="submitted" role="status"><Check size={18}/>{t("Antwort gespeichert. Die Auflösung kommt für alle gleichzeitig.")}</p>}
 {state.status === 'reveal' && state.answer && <div className={`reveal-box ${state.result?.correct ? 'win' : ''}`} role="status"><div>{state.result?.correct ? <CheckCircle2 /> : <XCircle />}<h3>{state.result?.correct ? (t("Richtig! +") + state.result.points + t(" Punkte")) : state.result ? t("Diesmal daneben.") : t("Zeit abgelaufen.")}</h3></div><p><b>{state.answer.text}</b></p>{state.answer.explanation !== state.answer.text + "." && <p>{state.answer.explanation}</p>}<a href={state.answer.source} target="_blank" rel="noreferrer">{t("In der Quelle nachlesen")}<ExternalLink size={13}/></a>{state.question.review === 'generated' && <small>{t("Aus Quellen erzeugt und teilweise automatisch übersetzt; redaktionell noch nicht vollständig geprüft.")}</small>}</div>}
 <div className="round-status"><span>{state.players.filter(p => p.answered).length} / {state.players.length}{t(" Antworten")}</span><span>{t("Deine Session: ")}<b>{score.toLocaleString(locale)}{t(" Punkte")}</b></span></div></div>}
 {state?.status === 'finished' && <div className="panel-body results"><div className="winner-icon"><Trophy size={42}/></div><p className="eyebrow">{t("MALIBU HAT EINEN CHAMPION.")}</p><h2>{state.players[0]?.name}</h2><p>{t("führt die Session mit ")}<b>{state.players[0]?.score.toLocaleString(locale)}{t(" Punkten")}</b>{t(" an.")}</p><div className="round-results"><h3>{t("Dieses Spiel")}</h3>{[...state.players].sort((a, b) => b.roundScore - a.roundScore).map((p, i) => <div key={p.id}><span>{i + 1}. {p.name}</span><b>+{p.roundScore.toLocaleString(locale)}</b></div>)}</div>{canStart ? <button className="primary" onClick={() => post('start')} disabled={busy}><RotateCcw size={18}/>{t("Nächstes Spiel")}<ArrowRight size={18}/></button> : <p className="waiting">{t("Warte auf das nächste Spiel des Gastgebers.")}</p>}<p className="subtle">{t("Eure Session-Punkte bleiben erhalten. Neue Fragen, nächste Chance.")}</p><button className="text-button invite-again" onClick={copyInvite}><Copy size={15}/>{copied ? t("Link kopiert") : t("Weitere Freunde einladen")}</button></div>}
 </section><aside><section className="leaderboard panel"><div className="board-title"><Trophy /><div><p className="eyebrow">{t("EURE SESSION")}</p><h2>{t("Die Besten von Malibu")}</h2></div></div>{state ? <><Table><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead>Nickname</TableHead><TableHead className="score-col">{t("Punkte")}</TableHead></TableRow></TableHeader><TableBody>{state.players.map((p, i) => <TableRow key={p.id} className={p.id === state.me ? 'my-row' : ''}><TableCell className="rank-col">{i === 0 ? <Trophy size={16}/> : i + 1}</TableCell><TableCell><span className="board-name">{p.name}</span>{p.id === state.me && <small className="you">{t("DU")}</small>}{!p.active && <small className="offline">{t("abwesend")}</small>}</TableCell><TableCell className="score-col">{p.score.toLocaleString(locale)}</TableCell></TableRow>)}</TableBody></Table><p className="board-note">{t("Gesamtpunkte aus allen Spielen dieser Session.")}</p></> : <div className="empty-board"><Trophy size={42}/><h3>{t("Hier ist noch Platz für Legenden.")}</h3><p>{t("Startet euer erstes Spiel.")}<br />{t("Jeder Punkt zählt – auch im nächsten Spiel.")}</p></div>}<div className="retention"><Clock size={16}/><span>{state ? (t("Verfällt am ") + new Date(state.expires).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + t(" ohne neue Spielaktivität.")) : t("Session verfällt nach 24 h Inaktivität.")}</span></div></section>
 <section className="rules"><p className="eyebrow">{t("DAS SPIEL IST EINFACH.")}</p><div><Tv /><p><b>{coverage.ready}{t(" Folgen · alle 12 Staffeln")}</b><span>{coverage.questions.toLocaleString(locale)}{t(" Fragen, inklusive Charakterwissen.")}</span></p></div><div><Fingerprint /><p><b>{t("Wissen bringt Punkte.")}</b><span>{t("Einfach 100 · Mittel 200 · Schwer 300.")}<br />{t("Dazu bis zu 100 Punkte für Tempo.")}</span></p></div><div><Users /><p><b>{t("Zusammen spielen")}</b><span>{t("1–8 Spieler. Eine Antwort pro Frage.")}<br />{t("Gemeinsame Auflösung nach dem Timer.")}</span></p></div></section>
 <Dialog><DialogTrigger asChild><button className="catalog-button"><BookOpen size={17}/>{t("Fragenkatalog & Quellen")}<ArrowRight size={16}/></button></DialogTrigger><DialogContent className="catalog-dialog"><DialogHeader><DialogTitle>{t("Fragenkatalog & Quellen")}</DialogTitle><DialogDescription>{t("Alle 262 Folgen: jeweils 4 leichte, 4 mittlere und 5 schwere Fragen. Dazu 36 allgemeine Charakterfragen.")}</DialogDescription></DialogHeader><p className="catalog-notice">{coverage.questions} {t("Fragen auf Deutsch und Englisch. Die Quellen zur Auflösung werden nach jeder Frage angezeigt. Enthält Spoiler bis zum Serienfinale.")}</p><div className="catalog-scroll"><Table><TableHeader><TableRow><TableHead>{t("Folge")}</TableHead><TableHead>{t("E / M / S")}</TableHead></TableRow></TableHeader><TableBody>{catalog.map(e => <TableRow key={e.id}><TableCell><a href={e.source} target="_blank" rel="noreferrer"><small>{e.season ? `S${e.season} · E${e.number}` : e.kind === 'movie' ? t("KINOFILM") : 'SPECIAL'}</small><br />{language === 'en' ? e.originalTitle : e.title} ↗</a></TableCell><TableCell>{e.counts.easy} / {e.counts.medium} / {e.counts.hard}{!e.ready && <small className="offline">{t("in Arbeit")}</small>}</TableCell></TableRow>)}</TableBody></Table></div><p className="license">{t("Der erweiterte Bestand enthält automatisch erzeugte Lückenfragen und Übersetzungen sowie Fragen zu Titelzitaten und Produktion. Eine vollständige redaktionelle Prüfung steht noch aus.")}</p><a className="license" href="/quellen.html" target="_blank" rel="noreferrer">{t("Quellen, Autoren & Lizenzen")} ↗</a></DialogContent></Dialog>
 </aside></div><footer><span>{t("Ein inoffizielles Fanprojekt · Two and a Half Men © Warner Bros. Entertainment")}</span><span>{t("Kein Konto nötig. Nickname genügt.")}</span></footer></main>;
}
