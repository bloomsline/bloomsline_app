// The server's English sentences, in French for a French practitioner.
//
// Most errors the practitioner routes send are written once, in English, and
// the phone displayed them as they came. Messages from the shared care actions
// already arrive in the user's language; these are the ones that did not.
//
// A message NOT on the list used to be shown as it came, so a new English
// sentence from the server reached a French practitioner in English. Now an
// unlisted message that reads as English becomes a plain French "something went
// wrong" instead; one that is already French (the shared actions) passes through.
// Losing the detail is the lesser harm: the list is the place to add it back.
const FR: Record<string, string> = {
  'Too many requests.': 'Trop de demandes. Réessayez dans un instant.',
  'Not found.': 'Introuvable.',
  'Not found': 'Introuvable.',
  'Forbidden': 'Accès refusé.',
  'Unauthorized': 'Session expirée. Reconnectez-vous.',
  'Write something first.': 'Écrivez quelque chose d’abord.',
  'Pick the session this note is about.': 'Choisissez la séance concernée par cette note.',
  'Pick a patient.': 'Choisissez un patient.',
  'Pick a patient and a time.': 'Choisissez un patient et un horaire.',
  'A name is required.': 'Un nom est requis.',
  'First and last name are required.': 'Le prénom et le nom sont requis.',
  'A valid scheduledAt is required.': 'Choisissez un horaire valide.',
  'This session is not part of a series.': 'Cette séance ne fait pas partie d’une série.',
  'Link this guest booking to a patient before managing the session.': 'Associez cette réservation à un patient avant de gérer la séance.',
  'This session can’t be closed from its current state.': 'Cette séance ne peut pas être clôturée dans son état actuel.',
  'Could not add the patient.': 'Impossible d’ajouter le patient.',
  'Could not book.': 'Réservation impossible.',
  'Could not save the note.': 'Impossible d’enregistrer la note.',
  'Could not share it.': 'Partage impossible.',
  'Could not update the request.': 'Impossible de mettre à jour la demande.',
  'Could not close the session.': 'Impossible de clôturer la séance.',
  'Could not move the session.': 'Impossible de déplacer la séance.',
  'Could not cancel the session.': 'Impossible d’annuler la séance.',
  'Could not delete the session.': 'Impossible de supprimer la séance.',
  'Could not send the details.': 'Impossible d’envoyer les détails.',
  'Could not send the reminder.': 'Impossible d’envoyer le rappel.',
  'Could not reach the server.': 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  'Could not keep the draft.': 'Impossible de conserver le brouillon.',
  'This note changed since you opened it. Close it and open it again.': 'Cette note a changé depuis que vous l’avez ouverte. Fermez-la et rouvrez-la.',
  'Could not discard.': 'Suppression impossible.',
  'The session note is full. Shorten the note or the comment.': 'La note de séance est pleine. Raccourcissez la note ou le commentaire.',
  'The unsaved draft of this session note is full. Shorten the draft or the comment.': 'Le brouillon non enregistré de cette note de séance est plein. Raccourcissez le brouillon ou le commentaire.',
};

const FR_GENERIC = 'Une erreur s’est produite. Veuillez réessayer.';
const FRENCH_MARKS = /[àâçéèêëîïôûùüÿœ«»]|\b(le|la|les|des|du|une|est|pas|vous|votre|impossible|cette|ce|il|elle|un|et|en|au|aux|avec|pour|sur)\b/i;
const ENGLISH_WORDS = /\b(the|a|an|could|not|please|your|you|is|are|this|that|was|cannot|can't|failed|invalid|required|must|no|too|first|pick|only|with|for|of|to)\b/i;

/** An unlisted sentence reads as English: English words and nothing French. */
export function looksEnglish(message: string): boolean {
  return ENGLISH_WORDS.test(message) && !FRENCH_MARKS.test(message);
}

export function localizeServerMessage(message: string | null | undefined, locale: 'en' | 'fr'): string | undefined {
  if (!message) return undefined;
  if (locale !== 'fr') return message;
  const listed = FR[message.trim()];
  if (listed) return listed;
  return looksEnglish(message) ? FR_GENERIC : message;
}
