// ============================================================
// GHARBI AGENCY — Portfolio data (single source for grid + 3D ring)
// To add a video: drop media/<id>.mp4 + media/<id>_thumb.jpg,
// run the thumb → media/tex/<id>.webp step (360x640), add a line here.
// ============================================================

export const CATEGORIES = {
  ugc: 'UGC',
  mashups: 'Mashup',
  vsl: 'VSL',
  ugly: 'Ugly Ad',
};

export const WORKS = [
  { id: 'ugc_hedi',          cat: 'ugc',     title: 'Hedi — Hook UGC',          featured: true },
  { id: 'dhekra_kabr',       cat: 'ugc',     title: 'Dhekra — Kbar' },
  { id: 'ghiras_hook2',      cat: 'ugc',     title: 'Ghiras — Hook 2' },
  { id: 'vd1_creative',      cat: 'mashups', title: 'VD 1 — Creative Premium',  featured: true },
  { id: 'video_set',         cat: 'mashups', title: 'Video Set — Fast Cut' },
  { id: 'ai_zan9a_store',    cat: 'mashups', title: 'Zan9a Store — Dynamic' },
  { id: 'clarity_metzawjin', cat: 'vsl',     title: 'Clarity — Pack Metzawjin', featured: true },
  { id: 'clarity',           cat: 'vsl',     title: 'Clarity — Story Hook' },
  { id: 'dhekra_bac',        cat: 'vsl',     title: 'Dhekra — Lel Bac' },
  { id: 'dhekra_sghar',      cat: 'vsl',     title: 'Dhekra — L Sghar' },
  { id: 'camera_hook',       cat: 'ugly',    title: 'Camera — Sghar Hook',      featured: true },
  { id: 'camera_abed_hook1', cat: 'ugly',    title: 'Camera — Abed Kbar 1' },
  { id: 'camera_abed_hook3', cat: 'ugly',    title: 'Camera — Abed Kbar 3' },
  { id: 'magnet_hook3',      cat: 'ugly',    title: 'Magnet — Hook 3' },
  { id: 'ugc_badia_hook3',   cat: 'ugc',     title: 'Badia — Hook 3' },
  { id: 'vsl_hook1',         cat: 'vsl',     title: 'VSL — Hook 1' },
  { id: 'sequence_07',       cat: 'mashups', title: 'Sequence 07' },
  { id: 'c000_20',           cat: 'ugc',     title: 'UGC — Take 20' },
  { id: 'mashup_new1',       cat: 'mashups', title: 'Mashup — New Cut' },
  { id: 'vsl_flo_hook2',     cat: 'vsl',     title: 'Flo — Hook 2' },
  { id: 'video_may_v2',      cat: 'ugc',     title: 'May — V2' },
  { id: 'vd_chargeur',       cat: 'ugly',    title: 'Chargeur — Ugly Ad' },
].map((w) => ({
  ...w,
  video: `media/${w.id}.mp4`,
  thumb: `media/${w.id}_thumb.jpg`,
  tex: `media/tex/${w.id}.webp`,
  label: CATEGORIES[w.cat],
}));
