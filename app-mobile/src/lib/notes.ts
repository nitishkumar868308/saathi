import { supabase } from "./supabase";

/**
 * Notes — jo baat yaad rakhni hai par jiska koi WAQT nahi.
 *
 * Reminder aur note ka fark yahi ek hai. Reminder ka matlab hi "iska ek waqt
 * hai"; note ka matlab "ye baat bas bachi rehni chahiye" — bazaar ka saamaan,
 * ek idea, gaadi ka number, kisi ka size. Pehle aisi har baat ek jhoote
 * reminder me daali jaati thi (koi bhi time chun ke) jo baad me bina matlab ke
 * bajta rehta tha.
 *
 * Note ka apna koi alarm nahi hota. Zaroorat pade to user use reminder me bhej
 * deta hai (`/add-reminder?text=...`) — tab wahan asli reminder banta hai aur
 * note apni jagah bacha rehta hai.
 */

export type Note = {
  id: string;
  title: string | null;
  body: string;
  is_pinned: boolean;
  /**
   * Is note se bana reminder. `null` = koi reminder nahi (ya wo delete ho chuka).
   *
   * ⚠️ Iske bina user ko kabhi pata nahi chalta tha ki is note ka reminder LAG
   * chuka hai, isliye wo aksar dobara laga deta tha aur ek hi baat ka alarm do
   * baar bajta tha. DB me `on delete set null` hai — reminder hataao to note
   * bacha rehta hai, bas nishaan apne aap hat jaata hai.
   */
  reminder_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Note ke saath uske reminder ka abhi ka haal — list/edit screen ke liye. */
export type NoteWithReminder = Note & {
  reminder: { id: string; title: string; remind_at: string | null; is_on: boolean } | null;
};

function client() {
  if (!supabase) throw new Error("Supabase set nahi hai");
  return supabase;
}

/**
 * Note ka dikhne wala naam.
 *
 * Title zaroori nahi hai — log seedha likhna shuru karte hain, aur pehle unse
 * "title do" maangna likhne ke beech me rukawat daalta hai. Isliye title na ho
 * to pehli line hi title ban jaati hai. Ye sirf DIKHANE ke liye hai; DB me
 * kuch thopa nahi jaata, warna user baad me title badalna chahe to samajh hi
 * na aaye ki wo aaya kahan se.
 */
export function noteTitle(n: Pick<Note, "title" | "body">, fallback: string): string {
  const t = n.title?.trim();
  if (t) return t;
  const first = n.body.split("\n").find((l) => l.trim());
  return first ? first.trim().slice(0, 80) : fallback;
}

/** Card par title ke neeche dikhne wali jhalak — title wali line hata ke. */
export function notePreview(n: Pick<Note, "title" | "body">): string {
  const lines = n.body.split("\n");
  // Title khud pehli line se bana hai to usi line ko neeche dobara dikhana
  // bekaar hai — card me ek hi baat do baar padhi jaati hai.
  const rest = n.title?.trim() ? lines : lines.slice(1);
  return rest.join(" ").replace(/\s+/g, " ").trim();
}

export async function listNotes(): Promise<Note[]> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from("notes")
    .select("*")
    .eq("user_id", uid)
    // Pin kiye hue hamesha upar, baaki me sabse haal ka upar.
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Note[];
}

/**
 * Notes + har note ke reminder ka abhi ka haal.
 *
 * Do query me: pehle notes, phir sirf un reminders ki jo kisi note se judi hain.
 * Ek-ek note par alag query karna (N+1) 40 note wale user par 40 request ban
 * jaata — aur screen tab tak khaali rehti.
 *
 * Reminder mil na paaye (delete ho chuka, ya net aadha chala) to `reminder`
 * null rehta hai. Note tab bhi poora dikhta hai — sirf uska nishaan nahi dikhta.
 */
export async function listNotesWithReminders(): Promise<NoteWithReminder[]> {
  const notes = await listNotes();
  const ids = Array.from(
    new Set(notes.map((n) => n.reminder_id).filter((v): v is string => !!v)),
  );
  if (ids.length === 0) return notes.map((n) => ({ ...n, reminder: null }));

  const { data } = await client()
    .from("reminders")
    .select("id,title,remind_at,is_on")
    .in("id", ids);

  const byId = new Map(
    (data ?? []).map((r) => [
      r.id as string,
      {
        id: r.id as string,
        title: r.title as string,
        remind_at: (r.remind_at as string | null) ?? null,
        is_on: !!r.is_on,
      },
    ]),
  );
  return notes.map((n) => ({
    ...n,
    reminder: n.reminder_id ? (byId.get(n.reminder_id) ?? null) : null,
  }));
}

/**
 * Note aur reminder ko jod do.
 *
 * Best-effort: fail ho jaye to reminder phir bhi ban chuka hai aur bajega —
 * sirf note par uska nishaan nahi lagega. Isi wajah se caller kabhi is par
 * ruka nahi rehta.
 */
export async function linkNoteReminder(noteId: string, reminderId: string): Promise<void> {
  const { error } = await client()
    .from("notes")
    .update({ reminder_id: reminderId })
    .eq("id", noteId);
  if (error) throw error;
}

export async function addNote(input: {
  title?: string | null;
  body: string;
}): Promise<Note> {
  const sb = client();
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("notes")
    .insert({
      title: input.title?.trim() || null,
      body: input.body,
      user_id: u.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Note;
}

export async function updateNote(
  id: string,
  patch: { title?: string | null; body?: string; is_pinned?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = {};
  // `undefined` ko bhi bhej dena PostgREST me column ko null kar deta hai —
  // yaani sirf pin badalne par note ka poora text ud jaata. Isliye jo diya hi
  // nahi gaya use bilkul chhoona nahi.
  if (patch.title !== undefined) body.title = patch.title?.trim() || null;
  if (patch.body !== undefined) body.body = patch.body;
  if (patch.is_pinned !== undefined) body.is_pinned = patch.is_pinned;
  if (Object.keys(body).length === 0) return;

  const { error } = await client().from("notes").update(body).eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await client().from("notes").delete().eq("id", id);
  if (error) throw error;
}
