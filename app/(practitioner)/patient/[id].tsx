import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, ChevronUp, FileSignature, Paperclip, Search, SlidersHorizontal } from 'lucide-react-native';
import { EDA, EdHeader, EdCard, FadeIn } from '@/src/ui/editorial';
import { RichText } from '@/src/resources/blocks';
import { useI18n } from '@/src/i18n';
import { fetchPatient, type PatientDetail } from '@/src/api/practitioner';

// One patient, to READ.
//
// This screen used to open on two buttons — Take a note, Book a session — above
// five notes. Both were wrong. The buttons are reachable from where the work
// actually starts (a session, or the + button), and putting them here made a
// page for remembering into a page for doing. And five notes with no sessions,
// no exercises and no documents cannot answer the question a practitioner opens
// a patient to ask, which is "where did we get to". They went to the laptop
// anyway.
//
// So: the panels the care app's member page has, minus progress, journals and
// moments. Tabs rather than one long scroll, because five sections stacked on a
// phone is a lot of thumb between the top and the thing you wanted.
const T = {
  en: {
    kicker: 'PATIENT', missing: 'Patient not found.',
    tabs: { overview: 'Overview', sessions: 'Sessions', notes: 'Notes', resources: 'Resources', documents: 'Documents' },
    searchNotes: 'Search notes',
    noOverview: 'Nothing recorded yet.', noSessions: 'No sessions yet.', noNotes: 'No notes yet.',
    noMatch: 'No notes match that.', noResources: 'Nothing shared yet.', noDocuments: 'No documents yet.',
    private: 'Private',
    statuses: { scheduled: 'Scheduled', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' },
    assign: { assigned: 'Sent', completed: 'Completed', opened: 'Opened' },
    docs: { sent: 'Sent', viewed: 'Viewed', signed: 'Signed', expired: 'Expired', draft: 'Draft' },
    unpaid: 'Unpaid',
    outcome: 'Outcome', billing: 'Payment', reason: 'Reason', price: 'Price',
    place: 'Where', series: 'In series', origin: 'Booked via',
    sessionNote: 'SESSION NOTE', noNote: 'No note written for this session.',
    all: 'All', withQuote: 'With a quote', quote: 'Quote', session: 'Session',
    allNotes: 'All notes', clear: 'Clear',
    viewResponse: 'View response', uploaded: 'UPLOADED', forSignature: 'FOR SIGNATURE',
    outcomes: { scheduled: 'Not yet held', pending: 'Awaiting your decision', completed: 'Took place', cancelled: 'Did not take place', no_show: 'Patient did not attend' },
    payments: { paid: 'Invoiced and paid', unpaid: 'Not invoiced', free: 'Free of charge' },
    sources: { manual: 'You booked it', booking: 'Patient booked online', google: 'From Google Calendar' },
  },
  fr: {
    kicker: 'PATIENT', missing: 'Patient introuvable.',
    tabs: { overview: 'Aperçu', sessions: 'Séances', notes: 'Notes', resources: 'Ressources', documents: 'Documents' },
    searchNotes: 'Rechercher dans les notes',
    noOverview: 'Rien de noté.', noSessions: 'Aucune séance.', noNotes: 'Aucune note.',
    noMatch: 'Aucune note ne correspond.', noResources: 'Rien de partagé.', noDocuments: 'Aucun document.',
    private: 'Privée',
    statuses: { scheduled: 'Planifiée', pending: 'En attente', completed: 'Terminée', cancelled: 'Annulée', no_show: 'Absence' },
    assign: { assigned: 'Envoyée', completed: 'Terminée', opened: 'Ouverte' },
    docs: { sent: 'Envoyé', viewed: 'Vu', signed: 'Signé', expired: 'Expiré', draft: 'Brouillon' },
    unpaid: 'Impayé',
    outcome: 'Résultat', billing: 'Paiement', reason: 'Motif', price: 'Tarif',
    place: 'Lieu', series: 'Dans la série', origin: 'Réservée via',
    sessionNote: 'NOTE DE SÉANCE', noNote: 'Aucune note pour cette séance.',
    all: 'Toutes', withQuote: 'Avec citation', quote: 'Citation', session: 'Séance',
    allNotes: 'Toutes les notes', clear: 'Effacer',
    viewResponse: 'Voir la réponse', uploaded: 'FICHIERS', forSignature: 'À SIGNER',
    outcomes: { scheduled: 'Pas encore eu lieu', pending: 'En attente de votre décision', completed: 'A eu lieu', cancelled: "N'a pas eu lieu", no_show: 'Patient absent' },
    payments: { paid: 'Facturée et payée', unpaid: 'Non facturée', free: 'Gratuite' },
    sources: { manual: 'Réservée par vous', booking: 'Réservée en ligne', google: 'Depuis Google Agenda' },
  },
} as const;

type Tab = 'overview' | 'sessions' | 'notes' | 'resources' | 'documents';
const TABS: Tab[] = ['overview', 'sessions', 'notes', 'resources', 'documents'];

const TONE = {
  green: { bg: EDA.greenTint, fg: EDA.greenDeep },
  amber: { bg: '#FEF3C7', fg: '#B45309' },
  grey: { bg: '#F1F0EC', fg: '#6B6B63' },
  rose: { bg: '#FFE4E6', fg: '#BE123C' },
} as const;

function Chip({ label, tone = 'grey' }: { label: string; tone?: keyof typeof TONE }) {
  const c = TONE[tone];
  return (
    <View style={{ borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 10.5, fontWeight: '800', color: c.fg }}>{label}</Text>
    </View>
  );
}

/** One line of the filter dropdown. A box rather than a switch, because several
 *  can be on at once and a switch reads as "either/or". */
function CheckRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 }}>
      <View style={{ height: 19, width: 19, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? EDA.green : 'transparent', borderWidth: 1.5, borderColor: on ? EDA.green : EDA.line }}>
        {on ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: on ? '700' : '500', color: EDA.ink }}>{label}</Text>
    </Pressable>
  );
}

/** Note bodies are the web editor's sanitized HTML. A preview wants text. */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bytes as something a person reads. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The practitioner's own label for a tag, falling back to a de-slugged form. */
function tagLabel(slug: string, vocab?: { slug: string; label: string }[]): string {
  return vocab?.find((t) => t.slug === slug)?.label ?? slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One fact inside an expanded session: label left, value right. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 }}>
      <Text style={{ width: 92, fontSize: 12.5, color: EDA.faint }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: EDA.ink }}>{value}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = typeof id === 'string' ? id : '';
  const { locale } = useI18n();
  const tr = T[locale] ?? T.en;

  const [data, setData] = useState<PatientDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [q, setQ] = useState('');
  // One at a time. Several sessions open at once turns a history into a wall,
  // and the reason to open one is to compare it with the rows around it.
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  // Multi-select, two axes. Tags OR together (a note matching ANY selected tag
  // qualifies); the quote flag ANDs across, because "tagged recurrence" and
  // "has a quote" are different questions, not competing answers.
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [quoteOnly, setQuoteOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchPatient(patientId).then((d) => { if (alive) { setData(d); setLoaded(true); } });
      return () => { alive = false; };
    }, [patientId]),
  );

  const loc = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const dayTime = (iso: string) => new Date(iso).toLocaleString(loc, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const price = (cents: number, currency = 'EUR') => {
    try { return new Intl.NumberFormat(loc, { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100); }
    catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
  };
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/(practitioner)/people' as never));

  // Searching happens on device: the list is one patient's notes, already in
  // hand, and a round trip per keystroke would be slower and offline-fragile.
  // Title and body both, because half of what you remember is in the body.
  const notes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let all = data?.notes ?? [];
    if (quoteOnly) all = all.filter((n) => n.hasQuote);
    if (pickedTags.length) all = all.filter((n) => n.tags?.some((t) => pickedTags.includes(t)));
    if (!needle) return all;
    // Search the TEXT, not the markup: '<p>' is in every note and matches nothing
    // a practitioner is looking for.
    return all.filter((n) => `${n.title ?? ''} ${plain(n.content)}`.toLowerCase().includes(needle));
  }, [q, quoteOnly, pickedTags, data]);

  // Only tags this patient's notes actually carry. Offering the whole vocabulary
  // would mean chips that always return nothing.
  const tagsInUse = useMemo(() => {
    const used = new Set((data?.notes ?? []).flatMap((n) => n.tags ?? []));
    return [...used].map((slug) => ({ slug, label: tagLabel(slug, data?.tags) }));
  }, [data]);
  const anyQuote = useMemo(() => (data?.notes ?? []).some((n) => n.hasQuote), [data]);
  const activeFilters = quoteOnly || pickedTags.length > 0;
  const filterSummary = useMemo(() => {
    const parts = [...(quoteOnly ? [tr.withQuote] : []), ...pickedTags.map((sl) => tagLabel(sl, data?.tags))];
    return parts.length ? parts.join(' · ') : tr.allNotes;
  }, [quoteOnly, pickedTags, data, tr]);

  const count = (t: Tab) =>
    t === 'sessions' ? data?.sessions.length
      : t === 'notes' ? data?.notes.length
        : t === 'resources' ? data?.resources.length
          : t === 'documents' ? data?.documents.length
            : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: EDA.canvas }}>
      <StatusBar style="dark" />
      <EdHeader kicker={tr.kicker} title={data?.patient.name ?? '…'} onBack={back} />

      {/* Tabs scroll horizontally: five labels do not fit a phone, and shrinking
          them to fit would make every one of them harder to hit. */}
      {data && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // A horizontal ScrollView inside a column stretches to fill unless it
          // is told not to, which turns a row of tabs into a wall of them.
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, gap: 8, alignItems: 'center' }}
        >
          {TABS.map((t) => {
            const on = t === tab;
            const n = count(t);
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: on ? EDA.green : EDA.card, borderWidth: 1, borderColor: on ? EDA.green : EDA.line }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#fff' : EDA.inkSoft }}>{tr.tabs[t]}</Text>
                {n ? <Text style={{ fontSize: 11.5, fontWeight: '700', color: on ? 'rgba(255,255,255,0.75)' : EDA.faint }}>{n}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <FadeIn>
          {!loaded && <ActivityIndicator />}
          {loaded && !data && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.missing}</Text>}

          {data && tab === 'overview' && (
            <>
              {data.patient.email ? (
                <EdCard style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14.5, color: EDA.ink }}>{data.patient.email}</Text>
                  {data.patient.lastSessionAt ? (
                    <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 3 }}>{day(data.patient.lastSessionAt)}</Text>
                  ) : null}
                </EdCard>
              ) : null}
              {data.overview.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noOverview}</Text>}
              {data.overview.map((s) => (
                <EdCard key={s.id} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: EDA.faint, marginBottom: 6 }}>{s.title.toUpperCase()}</Text>
                  {Array.isArray(s.value) ? (
                    s.value.map((v, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: i ? 5 : 0 }}>
                        <Text style={{ fontSize: 14.5, color: EDA.faint }}>·</Text>
                        <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: EDA.ink }}>{v}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 14.5, lineHeight: 21, color: EDA.ink }}>{s.value}</Text>
                  )}
                </EdCard>
              ))}
            </>
          )}

          {data && tab === 'sessions' && (
            <>
              {data.sessions.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noSessions}</Text>}
              {data.sessions.map((s) => {
                const open = openSession === s.id;
                return (
                  <EdCard key={s.id} onPress={() => setOpenSession(open ? null : s.id)} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: EDA.ink }}>{dayTime(s.scheduledAt)}</Text>
                      <Chip
                        label={tr.statuses[s.status as keyof typeof tr.statuses] ?? s.status}
                        tone={s.status === 'completed' ? 'green' : s.status === 'pending' ? 'amber' : s.status === 'cancelled' ? 'rose' : 'grey'}
                      />
                      {/* Two icons rather than one rotated. A `transform:
                          rotate` on a lucide SVG does not apply under
                          react-native-web — the chevron simply disappeared when
                          expanded, losing the only affordance saying so. */}
                      {open ? <ChevronUp size={15} color={EDA.faint} /> : <ChevronDown size={15} color={EDA.faint} />}
                    </View>
                    <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 4 }}>
                      {s.sessionTypeLabel ?? s.sessionType} · {s.sessionFormat.replace('_', ' ')} · {s.durationMinutes}m
                      {s.paymentStatus === 'unpaid' ? ` · ${tr.unpaid}` : ''}
                    </Text>

                    {open && (
                      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: EDA.line, paddingTop: 13 }}>
                        {/* What was DECIDED, in the order it gets asked: did it
                            happen, was it paid, and if not, why not. */}
                        <Row label={tr.outcome} value={tr.outcomes[s.status as keyof typeof tr.outcomes] ?? s.status} />
                        <Row label={tr.billing} value={tr.payments[s.paymentStatus as keyof typeof tr.payments] ?? s.paymentStatus} />
                        {s.cancellationReason ? <Row label={tr.reason} value={s.cancellationReason} /> : null}
                        {s.priceCents != null ? <Row label={tr.price} value={price(s.priceCents, data.currency)} /> : null}
                        {s.location ? <Row label={tr.place} value={s.location} /> : null}
                        {s.seriesTotal ? <Row label={tr.series} value={`${s.seriesPosition}/${s.seriesTotal}`} /> : null}
                        {s.source && tr.sources[s.source as keyof typeof tr.sources]
                          ? <Row label={tr.origin} value={tr.sources[s.source as keyof typeof tr.sources]} /> : null}

                        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: EDA.faint, marginTop: 15, marginBottom: 7 }}>
                          {tr.sessionNote}
                        </Text>
                        {s.note ? (
                          <View style={{ borderRadius: 14, backgroundColor: EDA.canvas, padding: 13 }}>
                            <RichText html={s.note} />
                          </View>
                        ) : (
                          // Said plainly. "No note" is a real answer when scanning a
                          // history — it is how you spot the one you never wrote up.
                          <Text style={{ fontSize: 14, color: EDA.faint }}>{tr.noNote}</Text>
                        )}
                      </View>
                    )}
                  </EdCard>
                );
              })}
            </>
          )}

          {data && tab === 'notes' && (
            <>
              <EdCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, marginBottom: 14 }}>
                <Search size={16} color={EDA.faint} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={tr.searchNotes}
                  placeholderTextColor={EDA.faint}
                  style={{ flex: 1, fontSize: 15, color: EDA.ink }}
                  autoCorrect={false}
                />
              </EdCard>
              {/* Filters. Nothing selected means everything, which is the state
                  you want when you have opened a patient to remind yourself of
                  them rather than to look something up. */}
              {(tagsInUse.length > 0 || anyQuote) && (
                <View style={{ marginBottom: 14 }}>
                  <Pressable
                    onPress={() => setFilterOpen((v) => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: activeFilters ? EDA.green : EDA.line, backgroundColor: EDA.card, paddingHorizontal: 14, paddingVertical: 11 }}
                  >
                    <SlidersHorizontal size={15} color={activeFilters ? EDA.green : EDA.faint} />
                    {/* The button states what is ON, not just that filtering
                        exists. A closed dropdown that hides its own selection is
                        how a list ends up looking wrong for no visible reason. */}
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: activeFilters ? EDA.greenDeep : EDA.inkSoft }} numberOfLines={1}>
                      {filterSummary}
                    </Text>
                    {activeFilters ? (
                      <Pressable onPress={() => { setPickedTags([]); setQuoteOnly(false); }} hitSlop={8}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: EDA.green }}>{tr.clear}</Text>
                      </Pressable>
                    ) : null}
                    {filterOpen ? <ChevronUp size={15} color={EDA.faint} /> : <ChevronDown size={15} color={EDA.faint} />}
                  </Pressable>

                  {filterOpen && (
                    <EdCard style={{ marginTop: 8, paddingVertical: 4 }}>
                      {anyQuote && (
                        <CheckRow label={tr.withQuote} on={quoteOnly} onPress={() => setQuoteOnly((v) => !v)} />
                      )}
                      {tagsInUse.map((t) => (
                        <CheckRow
                          key={t.slug}
                          label={t.label}
                          on={pickedTags.includes(t.slug)}
                          onPress={() => setPickedTags((cur) => cur.includes(t.slug) ? cur.filter((x) => x !== t.slug) : [...cur, t.slug])}
                        />
                      ))}
                    </EdCard>
                  )}
                </View>
              )}

              {data.notes.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noNotes}</Text>}
              {data.notes.length > 0 && notes.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noMatch}</Text>}
              {notes.map((n) => {
                const open = openNote === n.id;
                return (
                  <EdCard key={n.id} onPress={() => setOpenNote(open ? null : n.id)} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      {/* The SESSION's date when there is one. A note is about a
                          session, not about the evening it got typed up. */}
                      <Text style={{ flex: 1, fontSize: 12, color: EDA.faint }}>
                        {n.sessionAt ? `${tr.session} · ${day(n.sessionAt)}` : day(n.createdAt)}
                      </Text>
                      {n.isPrivate ? <Chip label={tr.private} /> : null}
                      {open ? <ChevronUp size={15} color={EDA.faint} /> : <ChevronDown size={15} color={EDA.faint} />}
                    </View>

                    {n.title ? <Text style={{ fontSize: 15.5, fontWeight: '700', color: EDA.ink, marginTop: 4 }}>{n.title}</Text> : null}

                    {open ? (
                      // Rich only once opened. The content is the web editor's
                      // sanitized HTML — rendering it as plain text put literal
                      // <p> tags on screen, which is what the list used to do.
                      <View style={{ marginTop: 8 }}><RichText html={n.content} /></View>
                    ) : (
                      <Text numberOfLines={3} style={{ fontSize: 14.5, lineHeight: 22, color: EDA.inkSoft, marginTop: 4 }}>
                        {plain(n.content)}
                      </Text>
                    )}

                    {(n.tags?.length || n.hasQuote) ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                        {n.hasQuote ? <Chip label={tr.quote} tone="grey" /> : null}
                        {(n.tags ?? []).map((slug) => (
                          <Chip key={slug} label={tagLabel(slug, data.tags)} tone="green" />
                        ))}
                      </View>
                    ) : null}
                  </EdCard>
                );
              })}
            </>
          )}

          {data && tab === 'resources' && (
            <>
              {data.resources.length === 0 && <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noResources}</Text>}
              {data.resources.map((r) => (
                <EdCard
                  key={r.id}
                  // Openable only when something actually came back. A row that
                  // looks tappable and answers nothing is worse than a flat one.
                  onPress={r.responseId ? () => router.navigate({ pathname: '/(practitioner)/submission', params: { id: r.responseId } } as never) : undefined}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{r.title ?? '—'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
                      <Chip
                        label={tr.assign[r.status as keyof typeof tr.assign] ?? r.status}
                        tone={r.status === 'completed' ? 'green' : 'grey'}
                      />
                      <Text style={{ fontSize: 12.5, color: EDA.faint }}>{day(r.completedAt ?? r.assignedAt)}</Text>
                    </View>
                    {r.responseId ? (
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: EDA.green, marginTop: 6 }}>{tr.viewResponse}</Text>
                    ) : null}
                  </View>
                  {r.responseId ? <ChevronRight size={17} color={EDA.faint} /> : null}
                </EdCard>
              ))}
            </>
          )}

          {data && tab === 'documents' && (
            <>
              {data.documents.length === 0 && (data.files ?? []).length === 0 && (
                <Text style={{ fontSize: 14, color: EDA.inkSoft }}>{tr.noDocuments}</Text>
              )}

              {/* Uploaded files. A different table from the signature documents
                  below, and the reason this tab looked empty for a patient who
                  plainly had one. */}
              {(data.files ?? []).length > 0 && (
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: EDA.faint, marginBottom: 8 }}>{tr.uploaded}</Text>
              )}
              {(data.files ?? []).map((f) => (
                <EdCard key={f.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                  <Paperclip size={16} color={EDA.faint} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{f.name}</Text>
                    <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 4 }}>
                      {day(f.createdAt)}{f.sizeBytes ? ` · ${fileSize(f.sizeBytes)}` : ''}{f.folder ? ` · ${f.folder}` : ''}
                    </Text>
                  </View>
                </EdCard>
              ))}

              {data.documents.length > 0 && (
                <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: EDA.faint, marginTop: (data.files ?? []).length ? 14 : 0, marginBottom: 8 }}>{tr.forSignature}</Text>
              )}
              {data.documents.map((d) => (
                <EdCard key={d.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
                  <FileSignature size={16} color={EDA.faint} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: EDA.ink }}>{d.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
                      <Chip
                        label={tr.docs[d.status as keyof typeof tr.docs] ?? d.status}
                        tone={d.status === 'signed' ? 'green' : d.status === 'expired' ? 'rose' : 'grey'}
                      />
                      <Text style={{ fontSize: 12.5, color: EDA.faint }}>{day(d.signedAt ?? d.viewedAt ?? d.sentAt)}</Text>
                    </View>
                    {d.signedAt && d.signerName ? (
                      <Text style={{ fontSize: 12.5, color: EDA.faint, marginTop: 4 }}>{d.signerName}</Text>
                    ) : null}
                  </View>
                </EdCard>
              ))}
            </>
          )}
        </FadeIn>
      </ScrollView>
    </View>
  );
}
