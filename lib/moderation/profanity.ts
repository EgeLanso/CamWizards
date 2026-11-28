import "server-only";

interface ProfanityEntry {
  word: string;
  isRegex: boolean;
  regex?: RegExp;
}

let cache: ProfanityEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_.-]+/g, "")
    .replace(/[0-9]+/g, "")
    .replace(/[^a-zA-ZÀ-ɏЀ-ӿ]/g, "");
}

function makeRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

async function loadFromDb(supabase: any): Promise<ProfanityEntry[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;
  const { data } = await supabase.from("profanity_words").select("word, language, is_regex");
  const entries: ProfanityEntry[] = (data || []).map((row: any) => ({
    word: row.word,
    isRegex: Boolean(row.is_regex),
    regex: row.is_regex ? new RegExp(row.word, "i") : undefined
  }));
  cache = entries;
  cacheTime = now;
  return entries;
}

const DEFAULT_WORDS: Record<string, string[]> = {
  tr: ["amk","aq","sik","siktir","orospu","piç","mal","göt","gerizekalı","dörtek","pendik","torpil"],
  en: ["fuck","shit","damn","bitch","asshole","bastard","cunt","dick","pussy","slut","whore","crap","piss","bloody","wanker","twat","motherfucker","nigga","nigger","faggot","fag","retard","idiot","moron","dumbass","jackass","dickhead","prick","twat","scumbag","douche","douchebag","tosser","git","bollocks","bugger","wank","knob","bellend","muppet","plonker","tosser","wanker","nonce","chav","pikey","spaz","spastic"],
  ru: ["сука","блядь","пизда","хуй","ебать","ебат","ёб твою мать","мудак","гандон","пидар","дебил","идиот","урод","козел","козлина","сучка","шлюха","лох","пидор","пидорок","пиздатый","хуеплет","манда","жопа","залупа","пиздеть","ебать","ъебать"],
  de: ["fick","scheiße","arschloch","hure","hurensohn","bastard","dreckssack","dummschwätzer","idiot","depp","arsch","fotze","wichser","wichse","fotze","kacke","mist","verdammt","verfickt","arschgesicht","dreckssau","drecksloch","wichser","arschloch","schlampe","nutte","wichser","wichse","dummkopf","trottel","idiot"],
  es: ["joder","mierda","puta","cabrón","idiota","imbécil","estúcho","culero","pendejo","maricón","puta","puto","coño","hostia","gilipollas","tarado","monguito","capullo","joputa","zorra","gordo","feo","estupido","maldito","maldita","cabron","puto","pendejo","culo","cagar","cagada","verga","verga"],
  fr: ["merde","putain","connard","connasse","enculé","salope","pute","con","conne","idiot","imbécile","débile","abruti","espèce d'idiot","fils de pute","batard","salopard","trou du cul","enculé","enculée","connard","connasse","pute","salope","pétanque","nique","ta gueule","ferme ta gueule","espèce d'abruti"],
};

function defaultEntriesForLanguage(lang: string): ProfanityEntry[] {
  return (DEFAULT_WORDS[lang] || []).map(w => ({ word: w, isRegex: false }));
}

export async function containsProfanity(text: string, supabase: any, language: string = "tr"): Promise<boolean> {
  const entries = await loadFromDb(supabase);
  const defaults = defaultEntriesForLanguage(language);
  const all = [...entries, ...defaults];
  const normalized = normalize(text);
  for (const entry of all) {
    if (entry.isRegex && entry.regex) {
      if (entry.regex.test(text)) return true;
    } else {
      const normWord = normalize(entry.word);
      if (normWord && normalized.includes(normWord)) return true;
    }
  }
  return false;
}

export async function findProfanityWords(text: string, supabase: any, language: string = "tr"): Promise<string[]> {
  const entries = await loadFromDb(supabase);
  const defaults = defaultEntriesForLanguage(language);
  const all = [...entries, ...defaults];
  const normalized = normalize(text);
  const found: string[] = [];
  for (const entry of all) {
    if (entry.isRegex && entry.regex) {
      if (entry.regex.test(text)) found.push(entry.word);
    } else {
      const normWord = normalize(entry.word);
      if (normWord && normalized.includes(normWord)) found.push(entry.word);
    }
  }
  return found;
}

export async function sanitizeText(text: string, supabase: any, language: string = "tr"): Promise<string> {
  const entries = await loadFromDb(supabase);
  const defaults = defaultEntriesForLanguage(language);
  const all = [...entries, ...defaults];
  let result = text;
  for (const entry of all) {
    if (entry.isRegex && entry.regex) {
      result = result.replace(entry.regex, "***");
    } else {
      const regex = new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      result = result.replace(regex, "***");
    }
  }
  return result;
}
